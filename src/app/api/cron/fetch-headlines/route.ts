import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This endpoint will be called by a cron job every 30 minutes
export async function GET(request: Request) {
  try {
    // Verify the request is from our cron service (add security)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🕐 Starting scheduled headline fetch...');

    // Fetch fresh headlines from RSS feeds
    const headlines = await fetchFreshHeadlines();

    if (headlines.length === 0) {
      console.log('❌ No headlines fetched, skipping update');
      return NextResponse.json(
        { error: 'No headlines fetched' },
        { status: 400 }
      );
    }

    // Store in central Supabase database
    await storeHeadlinesInDatabase(headlines);

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
    return NextResponse.json(
      { error: 'Failed to fetch headlines' },
      { status: 500 }
    );
  }
}

async function fetchFreshHeadlines() {
  const headlines = [];

  try {
    const rssUrls = [
      'https://news.google.com/rss/search?q=ABC+News&hl=en-US&gl=US&ceid=US:en&num=50',
      'https://news.google.com/rss/search?q=ABC+News&hl=en&gl=US&ceid=US:en&num=50'
    ];

    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];

    for (const rssUrl of rssUrls) {
      try {
        const userAgent =
          userAgents[Math.floor(Math.random() * userAgents.length)];
        const response = await fetch(rssUrl, {
          headers: {
            'User-Agent': userAgent,
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
          }
        });

        if (response.ok) {
          const rssText = await response.text();
          const parsedHeadlines = await parseRSSFeed(rssText);
          headlines.push(...parsedHeadlines);
          console.log(
            `✅ Fetched ${parsedHeadlines.length} headlines from ${rssUrl}`
          );
        }
      } catch (error) {
        console.error(`❌ Error fetching from ${rssUrl}:`, error);
      }
    }

    // Remove duplicates and sort by date
    const uniqueHeadlines = removeDuplicates(headlines);
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

  try {
    // Parse RSS feed (simplified version of existing logic)
    const itemMatches = rssText.match(/<item>([\s\S]*?)<\/item>/g);

    if (itemMatches) {
      for (const item of itemMatches) {
        const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = item.match(/<link>([^<]*)<\/link>/);
        const pubDateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/);

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
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const { error: deleteError } = await supabase
      .from('headlines')
      .delete()
      .lt('publishedAt', fourDaysAgo.toISOString());

    if (deleteError) {
      console.error('❌ Error clearing old headlines:', deleteError);
    } else {
      console.log('🧹 Cleared old headlines from database');
    }

    // Insert new headlines
    const { error: insertError } = await supabase
      .from('headlines')
      .insert(headlines);

    if (insertError) {
      console.error('❌ Error inserting headlines:', insertError);
      throw insertError;
    }

    console.log(
      `✅ Successfully stored ${headlines.length} headlines in database`
    );
  } catch (error) {
    console.error('❌ Error storing headlines in database:', error);
    throw error;
  }
}
