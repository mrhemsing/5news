import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
    
    if (!REPLICATE_API_TOKEN) {
      return NextResponse.json({
        success: false,
        error: 'Replicate API token not configured'
      });
    }

    // Test with a simple prompt
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
        input: {
          prompt: 'cartoon illustration, childlike drawing style, simple lines, bright vibrant colors, cute and friendly, showing: a happy sun, colorful background, fun and playful, kid-friendly art',
          negative_prompt: 'realistic, photographic, adult, complex, dark, scary, blurry, text, words, letters',
          num_inference_steps: 10,
          guidance_scale: 7.5,
          width: 512,
          height: 512,
          seed: 12345
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        error: `Replicate API error: ${response.status}`,
        details: errorText
      });
    }

    const prediction = await response.json();
    
    return NextResponse.json({
      success: true,
      message: 'Replicate API is working',
      prediction_id: prediction.id
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
