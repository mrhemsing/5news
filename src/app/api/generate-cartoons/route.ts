import { NextResponse } from 'next/server';
import { getCachedCartoon } from '@/lib/cartoonCache';
import { createClient } from '@supabase/supabase-js';
import { cleanForCartoon } from '@/lib/cartoonKey';

// Allow this route more time; warming multiple thumbnails can take a while.
export const maxDuration = 300;

async function fetchHeadlinesFromDatabase(limit = 25) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('headlines')
    .select('*')
    .order('publishedAt', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data;
}

export async function POST() {
  try {
    // Pull the same headlines the site is showing (from Supabase "headlines" table).
    const headlines = await fetchHeadlinesFromDatabase(40);

    if (!headlines || headlines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No headlines found in database'
      });
    }

    console.log(`Found ${headlines.length} headlines to process`);
    const results = [];

    // Process a modest batch per run; keep this conservative to avoid 429s/timeouts.
    // The workflow calls this endpoint multiple times with sleeps in-between.
    const MAX_PER_RUN = 4;
    const headlinesToProcess = headlines.slice(0, 40).slice(0, MAX_PER_RUN);

    for (const row of headlinesToProcess) {
      try {
        const rawTitle = String(row.title ?? '').trim();
        const headline = cleanForCartoon(rawTitle);
        if (!headline) continue;

        console.log(`Processing headline: ${headline}`);

        // Check if cartoon already exists (cache key matches /api/cartoonize cleaning)
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
        const baseUrl = process.env.BASE_URL
          ? process.env.BASE_URL
          : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

        const response = await fetch(
          `${baseUrl}/api/cartoonize`,
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
        console.error(`Error processing headline "${String((row as any)?.title ?? '')}":`, error);
        results.push({
          headline: String((row as any)?.title ?? ''),
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
