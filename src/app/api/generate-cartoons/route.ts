import { NextResponse } from 'next/server';
import { getCachedNews } from '@/lib/newsCache';
import { getCachedCartoon } from '@/lib/cartoonCache';

export async function POST() {
  try {
    // Get today's headlines from cache
    const today = new Date().toISOString().split('T')[0];
    const headlines = await getCachedNews(today, 1);
    
    if (!headlines || headlines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No headlines found in cache'
      });
    }

    const results = [];
    const headlinesToProcess = headlines.slice(0, 10); // Process first 10 headlines

    for (const article of headlinesToProcess) {
      try {
        const headline = article.title;
        
        // Check if cartoon already exists
        const existingCartoon = await getCachedCartoon(headline);
        if (existingCartoon) {
          results.push({
            headline,
            status: 'already_cached',
            cartoonUrl: existingCartoon
          });
          continue;
        }

        // Generate cartoon
        const response = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/cartoonize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ headline })
        });

        if (response.ok) {
          const data = await response.json();
          results.push({
            headline,
            status: data.success ? 'success' : 'failed',
            cartoonUrl: data.cartoonUrl,
            error: data.error
          });
        } else {
          results.push({
            headline,
            status: 'failed',
            error: `API error: ${response.status}`
          });
        }
      } catch (error) {
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
