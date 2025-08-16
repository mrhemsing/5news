import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// This endpoint will be called by a cron job every 30 minutes
export async function GET(request: Request) {
  return await handleHeadlineFetch(request);
}

// Added POST method for GitHub Actions compatibility
export async function POST(request: Request) {
  return await handleHeadlineFetch(request);
}

async function handleHeadlineFetch(request: Request) {
  try {
    // Verify the request is from our cron service (add security)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🕐 Starting scheduled headline fetch...');

    // Fetch fresh headlines from RSS feeds
    console.log('📡 About to call fetchFreshHeadlines...');
    const headlines = await fetchFreshHeadlines();
    console.log(
      `📊 fetchFreshHeadlines returned ${headlines.length} headlines`
    );

    if (headlines.length === 0) {
      console.log('❌ No headlines fetched, skipping update');
      return NextResponse.json(
        { error: 'No headlines fetched' },
        { status: 400 }
      );
    }

    // Store in central Supabase database
    console.log('💾 About to call storeHeadlinesInDatabase...');
    await storeHeadlinesInDatabase(headlines);
    console.log('✅ storeHeadlinesInDatabase completed successfully');

    console.log(
      `✅ Successfully updated ${headlines.length} headlines in central database`
    );

    return NextResponse.json({
      success: true,
      headlinesCount: headlines.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error in scheduled headline fetch:', error);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Error value:', error);

    // Provide more detailed error information
    let errorMessage = 'Failed to fetch headlines';
    let errorDetails: Record<string, any> | null = null;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = {
        name: error.name,
        stack: error.stack,
        message: error.message
      };
    } else {
      // Handle non-Error objects
      errorMessage = String(error);
      errorDetails = {
        type: typeof error,
        constructor: error?.constructor?.name,
        value: error
      };
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

async function fetchFreshHeadlines() {
  const headlines = [];
  console.log('🔄 Starting to fetch fresh headlines...');

  try {
    const rssUrls = [
      'https://news.google.com/rss/search?q=ABC+News&hl=en-US&gl=US&ceid=US:en&num=50',
      'https://news.google.com/rss/search?q=ABC+News&hl=en&gl=US&ceid=US:en&num=50'
    ];

    console.log(`📡 Attempting to fetch from ${rssUrls.length} RSS sources...`);

    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];

    for (const rssUrl of rssUrls) {
      try {
        console.log(`🔗 Attempting to fetch from: ${rssUrl}`);
        const userAgent =
          userAgents[Math.floor(Math.random() * userAgents.length)];
        console.log(`🤖 Using User-Agent: ${userAgent}`);
        const response = await fetch(rssUrl, {
          headers: {
            'User-Agent': userAgent,
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
          }
        });
        console.log(
          `📡 Response status: ${response.status} ${response.statusText}`
        );

        if (response.ok) {
          console.log(`📄 Response OK, reading RSS text...`);
          const rssText = await response.text();
          console.log(`📄 RSS text length: ${rssText.length} characters`);
          console.log(`📄 First 200 chars: ${rssText.substring(0, 200)}...`);

          console.log(`🔍 About to parse RSS feed...`);
          const parsedHeadlines = await parseRSSFeed(rssText);
          console.log(`🔍 Parsed ${parsedHeadlines.length} headlines`);

          headlines.push(...parsedHeadlines);
          console.log(
            `✅ Fetched ${parsedHeadlines.length} headlines from ${rssUrl}`
          );
        } else {
          console.log(
            `❌ RSS response not OK: ${response.status} ${response.statusText}`
          );
        }
      } catch (error) {
        console.error(`❌ Error fetching from ${rssUrl}:`, error);
      }
    }

    // Remove duplicates and sort by date
    const uniqueHeadlines = removeDuplicates(headlines);
    console.log(
      `🔄 Removed ${
        headlines.length - uniqueHeadlines.length
      } duplicate headlines`
    );

    const sortedHeadlines = uniqueHeadlines.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    // Filter to only last 4 days
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const recentHeadlines = sortedHeadlines.filter(
      headline => new Date(headline.publishedAt) > fourDaysAgo
    );

    console.log(
      `📊 Processed ${recentHeadlines.length} recent headlines from ${headlines.length} total`
    );
    return recentHeadlines;
  } catch (error) {
    console.error('❌ Error in fetchFreshHeadlines:', error);
    return [];
  }
}

async function parseRSSFeed(rssText: string) {
  const headlines = [];
  console.log(`🔍 parseRSSFeed called with ${rssText.length} characters`);

  try {
    // Parse RSS feed (simplified version of existing logic)
    console.log(`🔍 Looking for <item> tags...`);
    const itemMatches = rssText.match(/<item>([\s\S]*?)<\/item>/g);
    console.log(
      `🔍 Found ${itemMatches ? itemMatches.length : 0} item matches`
    );

    if (itemMatches) {
      console.log(`🔍 Processing ${itemMatches.length} items...`);
      for (let i = 0; i < itemMatches.length; i++) {
        const item = itemMatches[i];
        console.log(`🔍 Processing item ${i + 1}/${itemMatches.length}`);

        const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = item.match(/<link>([^<]*)<\/link>/);
        const pubDateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/);

        console.log(
          `🔍 Item ${
            i + 1
          } - Title match: ${!!titleMatch}, Link match: ${!!linkMatch}, Date match: ${!!pubDateMatch}`
        );

        if (titleMatch && linkMatch && pubDateMatch) {
          const title = titleMatch[1]
            .replace(/<!\[CDATA\[(.*?)\]\]>/, '$1')
            .trim();
          const url = linkMatch[1].trim();
          const pubDate = pubDateMatch[1];

          // Filter out unwanted headlines
          if (shouldIncludeHeadline(title)) {
            headlines.push({
              id: `headline-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 9)}`,
              title: title.replace(/\s*\([^)]*\)/g, '').trim(),
              url: url,
              publishedAt: new Date(pubDate).toISOString(),
              source: 'ABC News',
              fetchedAt: new Date().toISOString()
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error parsing RSS feed:', error);
  }

  return headlines;
}

function shouldIncludeHeadline(title: string): boolean {
  const titleLower = title.toLowerCase();

  // Filter out unwanted content
  const excludePatterns = [
    'video',
    'live',
    'watch',
    'livestream',
    'live stream',
    'live coverage',
    'live updates',
    'breaking live',
    'latest news',
    'live breaking',
    'watch live'
  ];

  return !excludePatterns.some(pattern => titleLower.includes(pattern));
}

function removeDuplicates(headlines: any[]) {
  const seen = new Set();
  return headlines.filter(headline => {
    const key = headline.title.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function storeHeadlinesInDatabase(headlines: any[]) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // First, clear old headlines (older than 4 days)
    console.log(`🧹 About to clear old headlines...`);
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    console.log(`🧹 Four days ago: ${fourDaysAgo.toISOString()}`);

    const { error: deleteError } = await supabase
      .from('headlines')
      .delete()
      .lt('publishedAt', fourDaysAgo.toISOString());

    if (deleteError) {
      console.error('❌ Error clearing old headlines:', deleteError);
    } else {
      console.log('🧹 Cleared old headlines from database');
    }

    // Insert new headlines with upsert to handle duplicates
    const { data: upsertData, error: insertError } = await supabase
      .from('headlines')
      .upsert(headlines, {
        onConflict: 'url',
        ignoreDuplicates: false
      });

    if (insertError) {
      console.error('❌ Error inserting headlines:', insertError);
      throw insertError;
    }

    console.log(
      `✅ Successfully upserted ${headlines.length} headlines in database`
    );

    if (upsertData) {
      console.log(`📊 Upsert result: ${upsertData.length} records affected`);
    }
  } catch (error) {
    console.error('❌ Error storing headlines in database:', error);

    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    // Check if it's a Supabase error
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('Supabase error code:', (error as any).code);
      console.error('Supabase error details:', (error as any).details);
      console.error('Supabase error hint:', (error as any).hint);
    }

    throw error;
  }
}
