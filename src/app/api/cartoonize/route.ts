import { NextResponse } from 'next/server';
import { getCachedCartoon, setCachedCartoon } from '@/lib/cartoonCache';

// Use Replicate's Stable Diffusion for accurate cartoon generation
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Function to validate if a cartoon URL is still accessible
async function validateCartoonUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.log('URL validation failed:', error);
    return false;
  }
}

export async function POST(request: Request) {
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
    const cleanHeadline = headline
      .replace(/ - .*$/, '') // Remove everything after " - "
      .replace(/['"]/g, '') // Remove quotes
      .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();

    console.log('Cleaned headline:', cleanHeadline);

    // Check if cartoon is already cached
    const cachedCartoon = await getCachedCartoon(cleanHeadline);
    if (cachedCartoon) {
      console.log('Found cached cartoon for headline, validating URL...');

      // Validate if the cached URL is still accessible
      const isUrlValid = await validateCartoonUrl(cachedCartoon);
      if (isUrlValid) {
        console.log('Cached cartoon URL is still valid');
        return NextResponse.json({
          cartoonUrl: cachedCartoon,
          success: true,
          cached: true
        });
      } else {
        console.log('Cached cartoon URL is expired, regenerating...');
        // Continue to generate new cartoon
      }
    }

    const cartoonPrompt = `cartoon illustration, childlike drawing style, simple lines, bright vibrant colors, cute and friendly, showing: ${cleanHeadline}, colorful background, fun and playful, kid-friendly art, simple clean composition, clear visual representation of the story`;
    const negativePrompt =
      'realistic, photographic, adult, complex, dark, scary, blurry, text, words, letters';

    console.log('Sending request to Replicate API...');
    console.log('Cartoon prompt:', cartoonPrompt);

    // Use Replicate's Stable Diffusion for text-to-image cartoon generation
    const response = await fetch('https://api.replicate.com/v1/predictions', {
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

    console.log('Replicate API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Replicate API error response:', errorText);

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
      console.error(`Replicate API error: ${response.status}`, errorText);
      throw new Error(`Replicate API error: ${response.status}`);
    }

    const prediction = await response.json();
    console.log('Replicate prediction created:', prediction.id);

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
        console.error(`Failed to fetch prediction status: ${statusResponse.status}`);
        throw new Error(`Failed to fetch prediction status: ${statusResponse.status}`);
      }

      result = await statusResponse.json();
      console.log(`Poll ${i + 1}: Status = ${result.status}`);

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
      console.error('Polling timeout - prediction still processing after 60 seconds');
      console.error('Final status:', result?.status);
      throw new Error('Cartoon generation timed out - prediction still processing');
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

    // Cache the generated cartoon
    await setCachedCartoon(cleanHeadline, cartoonUrl);
    console.log('Cached new cartoon for headline');

    return NextResponse.json({
      cartoonUrl,
      success: true,
      cached: false
    });
  } catch (error) {
    console.error('Error generating cartoon:', error);
    return NextResponse.json(
      { error: 'Failed to generate cartoon image' },
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
            console.error(`Failed to fetch prediction status: ${statusResponse.status}`);
            throw new Error(`Failed to fetch prediction status: ${statusResponse.status}`);
          }

          result = await statusResponse.json();
          console.log(`Background poll ${i + 1} for "${headline}": Status = ${result.status}`);

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
          console.error(`Background cartoon generation failed for "${headline}":`, errorMsg);
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
