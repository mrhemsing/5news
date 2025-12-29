import { NextResponse } from 'next/server';
import { deleteCachedCartoonByUrl } from '@/lib/cartoonCache';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    // Add a simple test endpoint
    if (imageUrl === 'test') {
      return NextResponse.json({ message: 'Proxy image route is working!' });
    }

    if (!imageUrl) {
      console.error('Proxy image error: No URL provided');
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    console.log('Proxying image:', imageUrl);

    // Fetch the image from Replicate with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; 5news-bot/1.0)'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        `Proxy image error: Failed to fetch image - Status: ${response.status}, URL: ${imageUrl}`
      );

      // If we get a 404, the URL is expired - invalidate the cache entry
      if (response.status === 404) {
        console.log('Image URL expired (404), invalidating cache entry...');
        try {
          await deleteCachedCartoonByUrl(imageUrl);
        } catch (error) {
          console.error('Error invalidating cache:', error);
        }
      }

      return NextResponse.json(
        {
          error: `Failed to fetch image: ${response.status}`,
          expired: response.status === 404 // Signal to frontend that URL is expired
        },
        { status: response.status }
      );
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    console.log(
      `Successfully proxied image: ${imageUrl} (${imageBuffer.byteLength} bytes)`
    );

    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/png',
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('Error proxying image:', error);

    // Check if it's a timeout error
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Image fetch timeout' },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to proxy image' },
      { status: 500 }
    );
  }
}
