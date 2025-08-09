import { NextResponse } from 'next/server';
import { getCachedNews } from '@/lib/newsCache';
import { getCachedCartoon } from '@/lib/cartoonCache';

export async function POST() {
  try {
    // Get headlines from cache (last 48 hours)
    const headlines = await getCachedNews();

    if (!headlines || headlines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No headlines found in cache'
      });
    }

    console.log(`Found ${headlines.length} headlines to process`);
    const results = [];
    const headlinesToProcess = headlines.slice(0, 10); // Process first 10 headlines

    for (const article of headlinesToProcess) {
      try {
        const headline = article.title;
        console.log(`Processing headline: ${headline}`);

        // Check if cartoon already exists
        const existingCartoon = await getCachedCartoon(headline);
        if (existingCartoon) {
          console.log(`Cartoon already cached for: ${headline}`);
          results.push({
            headline,
            status: 'already_cached',
            cartoonUrl: existingCartoon
          });
          continue;
        }

        console.log(`Generating cartoon for: ${headline}`);
        // Generate cartoon
        const response = await fetch(
          `${process.env.VERCEL_URL || 'http://localhost:3000'}/api/cartoonize`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ headline })
          }
        );

        console.log(`Cartoon API response status: ${response.status}`);
        if (response.ok) {
          const data = await response.json();
          console.log(`Cartoon API response:`, data);
          results.push({
            headline,
            status: data.success ? 'success' : 'failed',
            cartoonUrl: data.cartoonUrl,
            error: data.error
          });
        } else {
          const errorText = await response.text();
          console.error(`Cartoon API error for "${headline}":`, response.status, errorText);
          results.push({
            headline,
            status: 'failed',
            error: `API error: ${response.status} - ${errorText}`
          });
        }
      } catch (error) {
        console.error(`Error processing headline "${article.title}":`, error);
        results.push({
          headline: article.title,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const stats = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      already_cached: results.filter(r => r.status === 'already_cached').length,
      failed: results.filter(r => r.status === 'failed').length
    };

    console.log('Cartoon generation stats:', stats);
    console.log('Failed headlines:', results.filter(r => r.status === 'failed'));

    return NextResponse.json({
      success: true,
      results,
      stats
    });
  } catch (error) {
    console.error('Error generating cartoons:', error);
    return NextResponse.json(
      { error: 'Failed to generate cartoons' },
      { status: 500 }
    );
  }
}
