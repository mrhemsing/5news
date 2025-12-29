import { NextResponse } from 'next/server';
import {
  getCachedCartoon,
  setCachedCartoon,
  deleteCachedCartoon,
  acquireRateLimitLock,
  updateRateLimitLock
} from '@/lib/cartoonCache';

// Configure for Vercel - allow up to 60 seconds for function execution
export const maxDuration = 60;

// Use Replicate's Stable Diffusion for accurate cartoon generation
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Simple in-memory queue to limit concurrent requests to Replicate
// This prevents rate limiting by queuing requests instead of firing them all at once
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  private maxConcurrent = 1; // Only allow 1 concurrent request to Replicate (more conservative)
  private lastRequestTime = 0;
  private minDelayBetweenRequests = 15000; // 15 seconds between requests to avoid rate limits (increased significantly)

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          // Add delay between requests to avoid rate limiting
          // Add jitter (random delay) to spread out requests across different serverless instances
          const timeSinceLastRequest = Date.now() - this.lastRequestTime;
          const jitter = Math.random() * 5000; // 0-5 seconds random delay to spread across instances (increased)
          const totalDelay = this.minDelayBetweenRequests + jitter;

          if (timeSinceLastRequest < totalDelay) {
            const delay = totalDelay - timeSinceLastRequest;
            console.log(
              `Rate limiting: waiting ${Math.round(
                delay
              )}ms before next request (with ${Math.round(jitter)}ms jitter)`
            );
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          this.lastRequestTime = Date.now();
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processQueue();
        }
      });
      this.processQueue();
    });
  }

  private processQueue() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}

const requestQueue = new RequestQueue();

// Function to validate if a cartoon URL is still accessible
async function validateCartoonUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    // Use GET instead of HEAD - some CDNs (like Replicate) may respond differently to HEAD
    // Also check for 404 specifically since that means the URL is expired
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Range: 'bytes=0-1' // Only fetch first 2 bytes to check if URL is valid
      }
    });

    clearTimeout(timeoutId);

    // 404 means the URL is definitely expired
    if (response.status === 404) {
      console.log('URL validation: 404 detected - URL is expired');
      return false;
    }

    return response.ok;
  } catch (error) {
    console.log('URL validation failed:', error);
    return false;
  }
}

export async function POST(request: Request) {
  // Store headline for potential fallback use
  let cleanHeadline: string | null = null;

  try {
    const { headline } = await request.json();

    if (!headline) {
      return NextResponse.json(
        { error: 'Headline is required' },
        { status: 400 }
      );
    }

    if (!REPLICATE_API_TOKEN) {
      console.error('Replicate API token not found in environment');
      return NextResponse.json(
        { error: 'Replicate API key not configured' },
        { status: 500 }
      );
    }

    console.log(
      'Using Replicate API token:',
      REPLICATE_API_TOKEN.substring(0, 10) + '...'
    );

    // Create a childlike cartoon prompt from the headline
    console.log('Generating cartoon from headline:', headline);

    // Clean and simplify the headline for better cartoon generation
    const cleaned = headline
      .replace(/ - .*$/, '') // Remove everything after " - "
      .replace(/['"]/g, '') // Remove quotes
      .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();

    if (!cleaned) {
      return NextResponse.json(
        { error: 'Invalid headline after cleaning' },
        { status: 400 }
      );
    }

    cleanHeadline = cleaned;
    console.log('Cleaned headline:', cleanHeadline);

    // Check if cartoon is already cached
    // Use cleaned directly since we know it's not null after the check above
    const cachedCartoon = await getCachedCartoon(cleaned);
    if (cachedCartoon) {
      console.log('Found cached cartoon for headline, validating URL...');

      // Validate if the cached URL is still accessible (with timeout)
      try {
        const isUrlValid = await validateCartoonUrl(cachedCartoon);
        if (isUrlValid) {
          console.log('Cached cartoon URL is still valid');
          return NextResponse.json({
            cartoonUrl: cachedCartoon,
            success: true,
            cached: true
          });
        } else {
          console.log(
            'Cached cartoon URL validation failed (expired), deleting from cache and regenerating...'
          );
          // Delete expired cache entry
          await deleteCachedCartoon(cleaned);
          // Continue to generate new cartoon
        }
      } catch (validationError) {
        console.log(
          'URL validation error (might be transient), will try to regenerate:',
          validationError
        );
        // Continue to generate new cartoon - validation might have timed out
      }
    }

    const cartoonPrompt = `cartoon illustration, childlike drawing style, simple lines, bright vibrant colors, cute and friendly, showing: ${cleaned}, colorful background, fun and playful, kid-friendly art, simple clean composition, clear visual representation of the story`;
    const negativePrompt =
      'realistic, photographic, adult, complex, dark, scary, blurry, text, words, letters';

    console.log('Sending request to Replicate API...');
    console.log('Cartoon prompt:', cartoonPrompt);

    // Use database-backed rate limiter to prevent rate limiting across instances
    // This works across all serverless instances, not just one
    const canProceed = await acquireRateLimitLock();
    if (!canProceed) {
      console.log(
        'Rate limit: Too soon since last request, returning 429 to retry later'
      );
      // Try to return cached cartoon as fallback
      const fallbackCartoon = await getCachedCartoon(cleaned);
      if (fallbackCartoon) {
        console.log('Returning cached cartoon as fallback due to rate limit');
        return NextResponse.json({
          cartoonUrl: fallbackCartoon,
          success: true,
          cached: true,
          fallback: true,
          warning: 'Using cached image - rate limited'
        });
      }
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: 15, // Suggest retrying after 15 seconds
          success: false
        },
        { status: 429 }
      );
    }

    // Use request queue to prevent rate limiting (additional protection)
    // This ensures we don't send too many requests to Replicate simultaneously
    const response = await requestQueue.add(async () => {
      return await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          Authorization: `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          version:
            '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b', // Stable Diffusion XL (back to original)
          input: {
            prompt: cartoonPrompt,
            negative_prompt: negativePrompt,
            num_inference_steps: 20, // More steps for better quality
            guidance_scale: 7.5,
            width: 512,
            height: 512,
            seed: Math.floor(Math.random() * 1000000)
          }
        })
      });
    });

    console.log('Replicate API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Replicate API error response:', errorText);
      console.error('Replicate API error status:', response.status);
      console.error('Headline that failed:', cleaned);

      if (response.status === 402) {
        console.log('Replicate API 402 error - credits may not be applied yet');
        // Return null as fallback - no cartoon generated
        return NextResponse.json({
          cartoonUrl: null,
          success: false,
          cached: false,
          fallback: true
        });
      }

      if (response.status === 429) {
        console.error('Replicate API rate limit exceeded (429)');
        // Try to return cached cartoon as fallback before returning 429
        if (cleaned) {
          const fallbackCartoon = await getCachedCartoon(cleaned);
          if (fallbackCartoon) {
            console.log(
              'Returning cached cartoon as fallback due to rate limit'
            );
            return NextResponse.json({
              cartoonUrl: fallbackCartoon,
              success: true,
              cached: true,
              fallback: true,
              warning: 'Using cached image - rate limited'
            });
          }
        }
        // Return a special response that the client can retry
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            retryAfter: 60, // Suggest retrying after 60 seconds
            success: false
          },
          { status: 429 }
        );
      }

      if (response.status === 401) {
        console.error('Replicate API authentication failed (401)');
        throw new Error('Authentication failed - check API token');
      }

      console.error(`Replicate API error: ${response.status}`, errorText);
      throw new Error(
        `Replicate API error: ${response.status} - ${errorText.substring(
          0,
          200
        )}`
      );
    }

    const prediction = await response.json();
    console.log('Replicate prediction created:', prediction.id);

    // Poll for completion - increased timeout to 60 seconds
    let result;
    let completed = false;
    for (let i = 0; i < 60; i++) {
      // Max 60 seconds (increased from 20)
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout per request

        const statusResponse = await fetch(prediction.urls.get, {
          headers: {
            Authorization: `Token ${REPLICATE_API_TOKEN}`
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!statusResponse.ok) {
          const errorText = await statusResponse.text();
          console.error(
            `Failed to fetch prediction status: ${statusResponse.status}`,
            errorText
          );
          // Don't throw immediately - might be transient, continue polling
          if (statusResponse.status === 401 || statusResponse.status === 403) {
            throw new Error(
              `Authentication error fetching status: ${statusResponse.status}`
            );
          }
          // For other errors, wait a bit longer and retry
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        result = await statusResponse.json();
        console.log(`Poll ${i + 1}: Status = ${result.status}`);
      } catch (fetchError: any) {
        if (
          fetchError.name === 'AbortError' ||
          fetchError.name === 'TimeoutError'
        ) {
          console.error(`Timeout fetching prediction status on poll ${i + 1}`);
          // Continue polling - might be network issue
          continue;
        }
        if (fetchError.message?.includes('Authentication')) {
          throw fetchError;
        }
        console.error(
          `Error fetching prediction status on poll ${i + 1}:`,
          fetchError
        );
        // Continue polling for other errors
        continue;
      }

      // Skip if result wasn't set (shouldn't happen, but safety check)
      if (!result) {
        continue;
      }

      if (result.status === 'succeeded') {
        completed = true;
        break;
      } else if (result.status === 'failed') {
        console.error('Replicate prediction failed:', result);
        throw new Error('Cartoon generation failed');
      } else if (result.status === 'canceled') {
        console.error('Replicate prediction was canceled:', result);
        throw new Error('Cartoon generation was canceled');
      }
      // Continue polling if status is 'starting' or 'processing'
    }

    console.log('Final result:', result);

    // Check if we completed successfully
    if (!completed) {
      console.error(
        'Polling timeout - prediction still processing after 60 seconds'
      );
      console.error('Final status:', result?.status);
      throw new Error(
        'Cartoon generation timed out - prediction still processing'
      );
    }

    if (
      !result ||
      !result.output ||
      !Array.isArray(result.output) ||
      result.output.length === 0
    ) {
      console.error('Invalid output from Replicate:', result);
      throw new Error('Failed to generate cartoon image - invalid output');
    }

    const cartoonUrl = result.output[0];

    if (!cartoonUrl) {
      throw new Error('Failed to generate cartoon image - no URL');
    }

    console.log('Successfully generated cartoon URL:', cartoonUrl);

    // Update rate limit lock after successful request
    await updateRateLimitLock();

    // Cache the generated cartoon
    await setCachedCartoon(cleaned, cartoonUrl);
    console.log('Cached new cartoon for headline');

    return NextResponse.json({
      cartoonUrl,
      success: true,
      cached: false
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('Error generating cartoon:', errorMessage);
    console.error('Error stack:', errorStack);
    console.error(
      'Error type:',
      error instanceof Error ? error.constructor.name : typeof error
    );

    // As a fallback, try to return cached cartoon even if validation failed earlier
    // This gives users something to see rather than a placeholder
    if (cleanHeadline) {
      try {
        const fallbackCartoon = await getCachedCartoon(cleanHeadline);
        if (fallbackCartoon) {
          console.log(
            'Returning cached cartoon as fallback despite generation error'
          );
          return NextResponse.json({
            cartoonUrl: fallbackCartoon,
            success: true,
            cached: true,
            fallback: true,
            warning: 'Using cached image - generation failed'
          });
        }
      } catch (fallbackError) {
        console.error('Fallback cache lookup also failed:', fallbackError);
      }
    }

    // Return more detailed error information for debugging
    return NextResponse.json(
      {
        error: 'Failed to generate cartoon image',
        details: errorMessage,
        // Only include stack in development
        ...(process.env.NODE_ENV === 'development' && errorStack
          ? { stack: errorStack }
          : {})
      },
      { status: 500 }
    );
  }
}

// Background generation endpoint for scheduled jobs
export async function PUT(request: Request) {
  try {
    const { headlines } = await request.json();

    if (!headlines || !Array.isArray(headlines)) {
      return NextResponse.json(
        { error: 'Headlines array is required' },
        { status: 400 }
      );
    }

    if (!REPLICATE_API_TOKEN) {
      console.error('Replicate API token not found in environment');
      return NextResponse.json(
        { error: 'Replicate API key not configured' },
        { status: 500 }
      );
    }

    const results = [];

    for (const headline of headlines) {
      try {
        console.log('Background generating cartoon for:', headline);

        // Check if already cached
        const cachedCartoon = await getCachedCartoon(headline);
        if (cachedCartoon) {
          console.log('Cartoon already cached for:', headline);
          results.push({
            headline,
            status: 'cached',
            cartoonUrl: cachedCartoon
          });
          continue;
        }

        // Clean and simplify the headline
        const cleanHeadline = headline
          .replace(/ - .*$/, '')
          .replace(/['"]/g, '')
          .replace(/[^\w\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const cartoonPrompt = `cartoon illustration, childlike drawing style, simple lines, bright vibrant colors, cute and friendly, showing: ${cleanHeadline}, colorful background, fun and playful, kid-friendly art, simple clean composition, clear visual representation of the story`;
        const negativePrompt =
          'realistic, photographic, adult, complex, dark, scary, blurry, text, words, letters';

        const response = await fetch(
          'https://api.replicate.com/v1/predictions',
          {
            method: 'POST',
            headers: {
              Authorization: `Token ${REPLICATE_API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              version:
                '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
              input: {
                prompt: cartoonPrompt,
                negative_prompt: negativePrompt,
                num_inference_steps: 20,
                guidance_scale: 7.5,
                width: 512,
                height: 512,
                seed: Math.floor(Math.random() * 1000000)
              }
            })
          }
        );

        if (!response.ok) {
          console.error(
            'Replicate API error for headline:',
            headline,
            response.status
          );
          results.push({
            headline,
            status: 'failed',
            error: `API error: ${response.status}`
          });
          continue;
        }

        const prediction = await response.json();

        // Poll for completion - increased timeout to 60 seconds
        let result;
        let completed = false;
        for (let i = 0; i < 60; i++) {
          // Max 60 seconds (increased from 20)
          await new Promise(resolve => setTimeout(resolve, 1000));

          const statusResponse = await fetch(prediction.urls.get, {
            headers: {
              Authorization: `Token ${REPLICATE_API_TOKEN}`
            }
          });

          if (!statusResponse.ok) {
            console.error(
              `Failed to fetch prediction status: ${statusResponse.status}`
            );
            throw new Error(
              `Failed to fetch prediction status: ${statusResponse.status}`
            );
          }

          result = await statusResponse.json();
          console.log(
            `Background poll ${i + 1} for "${headline}": Status = ${
              result.status
            }`
          );

          if (result.status === 'succeeded') {
            completed = true;
            break;
          } else if (result.status === 'failed') {
            throw new Error('Cartoon generation failed');
          } else if (result.status === 'canceled') {
            throw new Error('Cartoon generation was canceled');
          }
          // Continue polling if status is 'starting' or 'processing'
        }

        if (completed && result.output && result.output[0]) {
          const cartoonUrl = result.output[0];
          await setCachedCartoon(cleanHeadline, cartoonUrl);
          results.push({ headline, status: 'success', cartoonUrl });
          console.log('Background cartoon generated for:', headline);
        } else {
          const errorMsg = completed
            ? 'No output generated'
            : 'Polling timeout - prediction still processing after 60 seconds';
          console.error(
            `Background cartoon generation failed for "${headline}":`,
            errorMsg
          );
          results.push({
            headline,
            status: 'failed',
            error: errorMsg
          });
        }
      } catch (error) {
        console.error(
          'Error generating background cartoon for:',
          headline,
          error
        );
        results.push({
          headline,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Background cartoon generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate background cartoons' },
      { status: 500 }
    );
  }
}
