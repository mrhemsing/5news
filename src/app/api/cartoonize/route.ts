import { NextResponse } from 'next/server';
import { getCachedCartoon, setCachedCartoon } from '@/lib/cartoonCache';

// Use Replicate's Stable Diffusion for accurate cartoon generation
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

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
      console.log('Found cached cartoon for headline');
      return NextResponse.json({
        cartoonUrl: cachedCartoon,
        success: true,
        cached: true
      });
    }

    const cartoonPrompt = `cartoon illustration, childlike drawing style, simple lines, bright vibrant colors, cute and friendly, showing: ${cleanHeadline}, colorful background, fun and playful, kid-friendly art, simple clean composition, clear visual representation of the story`;
    const negativePrompt =
      'realistic, photographic, adult, complex, dark, scary, blurry, text, words, letters';

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

    if (!response.ok) {
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
      console.error(
        `Replicate API error: ${response.status}`,
        await response.text()
      );
      throw new Error(`Replicate API error: ${response.status}`);
    }

    const prediction = await response.json();

    // Poll for completion
    let result;
    for (let i = 0; i < 20; i++) {
      // Max 20 seconds
      await new Promise(resolve => setTimeout(resolve, 1000));

      const statusResponse = await fetch(prediction.urls.get, {
        headers: {
          Authorization: `Token ${REPLICATE_API_TOKEN}`
        }
      });

      result = await statusResponse.json();
      console.log(`Poll ${i + 1}: Status = ${result.status}`);

      if (result.status === 'succeeded') {
        break;
      } else if (result.status === 'failed') {
        console.error('Replicate prediction failed:', result);
        throw new Error('Cartoon generation failed');
      }
    }

    console.log('Final result:', result);

    if (
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
