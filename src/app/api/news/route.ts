import { NextResponse } from 'next/server';
import { NewsArticle } from '@/types/news';
import {
  getCachedNews,
  setCachedNews,
  getAllCachedPages
} from '@/lib/newsCache';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Get user agent early for browser refresh detection.
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    // Detect browser refresh by checking for Cache-Control: no-cache header
    const cacheControl = request.headers.get('cache-control');
    const pragma = request.headers.get('pragma');
    const secFetchMode = request.headers.get('sec-fetch-mode');
    const secFetchDest = request.headers.get('sec-fetch-dest');
    const secFetchSite = request.headers.get('sec-fetch-site');

    // Enhanced detection for mobile Chrome and other aggressive caching browsers
    let isBrowserRefresh =
      cacheControl?.includes('no-cache') ||
      pragma?.includes('no-cache') ||
      secFetchMode === 'navigate' ||
      secFetchDest === 'document' ||
      secFetchSite === 'same-origin' ||
      // Mobile Chrome specific - check for user agent and common mobile refresh patterns
      (userAgent.toLowerCase().includes('mobile') &&
        (cacheControl?.includes('max-age=0') ||
          cacheControl?.includes('no-store') ||
          // Check if this is likely a manual refresh (not navigation)
          request.headers.get('referer') === null ||
          request.headers.get('referer') === '' ||
          // Check for timestamp parameters that indicate manual refresh
          searchParams.has('_t') ||
          searchParams.has('timestamp') ||
          searchParams.has('refresh')));

    // Log request details for debugging device differences
    const acceptLanguage = request.headers.get('accept-language') || 'Unknown';
    console.log(
      `🌐 API Request - Page: ${page}, Force Refresh: ${forceRefresh}, Browser Refresh: ${isBrowserRefresh}`
    );
    console.log(`📱 Request User-Agent: ${userAgent.substring(0, 80)}...`);
    console.log(`🌍 Request Accept-Language: ${acceptLanguage}`);
    console.log(
      `🔄 Cache-Control: ${cacheControl}, Pragma: ${pragma}, Sec-Fetch-Mode: ${secFetchMode}`
    );

    // Fetch headlines from centralized Supabase database
    const headlines = await fetchHeadlinesFromDatabase();

    if (!headlines || headlines.length === 0) {
      console.log('❌ No headlines found in database');
      return NextResponse.json(
        {
          error:
            'No headlines available yet. The cron job will populate the database shortly. Please try again in a few minutes.',
          status: 'initializing',
          message: 'Database is being populated by scheduled cron job'
        },
        { status: 503 }
      );
    }

    // Filter out sports-related stories
    const filteredHeadlines = headlines.filter(headline => {
      return !isSportsStory(headline.title);
    });

    console.log(
      `🏀 Filtered out ${
        headlines.length - filteredHeadlines.length
      } sports stories`
    );

    // Apply pagination
    const articlesPerPage = 20;
    const startIndex = (page - 1) * articlesPerPage;
    const endIndex = startIndex + articlesPerPage;
    const paginatedHeadlines = filteredHeadlines.slice(startIndex, endIndex);

    console.log(
      `📊 Returning ${
        paginatedHeadlines.length
      } headlines (page ${page} of ${Math.ceil(
        filteredHeadlines.length / articlesPerPage
      )})`
    );
    console.log(`📊 Total headlines in database: ${filteredHeadlines.length}`);
    console.log(
      `📊 Database last updated: ${headlines[0]?.fetchedAt || 'Unknown'}`
    );

    return NextResponse.json({
      articles: paginatedHeadlines,
      totalResults: filteredHeadlines.length,
      hasMore: endIndex < filteredHeadlines.length,
      page: page,
      totalPages: Math.ceil(filteredHeadlines.length / articlesPerPage),
      databaseTimestamp: filteredHeadlines[0]?.fetchedAt || null
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news from database' },
      { status: 500 }
    );
  }
}

async function fetchHeadlinesFromDatabase() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch headlines from the centralized database, sorted by published date (newest first)
    const { data: headlines, error } = await supabase
      .from('headlines')
      .select('*')
      .order('publishedAt', { ascending: false })
      .limit(100); // Limit to prevent overwhelming response

    if (error) {
      console.error('❌ Error fetching headlines from database:', error);
      return null;
    }

    if (!headlines || headlines.length === 0) {
      console.log('❌ No headlines found in database');
      return null;
    }

    // Transform to match the expected NewsArticle format
    const transformedHeadlines = headlines.map((headline: any) => ({
      id: headline.id,
      title: headline.title,
      url: headline.url,
      publishedAt: headline.publishedAt,
      description: headline.title, // Use title as description for now
      content: headline.title,
      urlToImage: '',
      source: {
        id: null,
        name: headline.source || 'ABC News'
      },
      fetchedAt: headline.fetchedAt // Preserve the fetchedAt timestamp
    }));

    console.log(
      `✅ Successfully fetched ${transformedHeadlines.length} headlines from database`
    );
    return transformedHeadlines;
  } catch (error) {
    console.error('❌ Error in fetchHeadlinesFromDatabase:', error);
    return null;
  }
}

// Function to detect if a headline is sports-related
function isSportsStory(title: string): boolean {
  const titleUpper = title.toUpperCase();

  // Sports-specific patterns
  const sportsPatterns = [
    // Common sports verbs
    /\b(VISITS|HOSTS|KNOCKS OFF|DEFEATS|BEATS|WINS|LOSES|PLAYS|FACES|TRAILS|LEADS)\b/,
    // Point-based scoring (basketball, football, etc.)
    /\b\d+\s*-?\s*POINT\s+(SHOWING|GAME|PERFORMANCE|EFFORT|OUTING|NIGHT|CONTRIBUTION)\b/i,
    /\b\d+\s*-?\s*POINTS?\b/i,
    // Division references
    /\b(DIVISION|CONFERENCE|LEAGUE)\s+(OPPONENTS|MATCHUP|GAME|MEET|CLASH)\b/i,
    // Team vs team patterns
    /\b(VS|V\.|VERSUS)\b/i,
    // Common sports terms
    /\b(TOURNAMENT|CHAMPIONSHIP|PLAYOFFS?|SEMIFINALS?|FINALS?|QUARTERFINALS?)\b/i,
    // College/university team patterns (common in sports headlines)
    /\b([A-Z]{2,}\s+)?(VISITS|HOSTS|TRAVELS TO|WELCOMES)\s+[A-Z]{2,}\b/,
    // Score patterns
    /\b\d+\s*-\s*\d+\b.*\b(WINS?|LOSES?|BEATS?|DEFEATS?)\b/i,
    // Season references
    /\b(SEASON|REGULAR SEASON|POSTSEASON|PRESEASON)\b/i
  ];

  // Check for sports patterns
  for (const pattern of sportsPatterns) {
    if (pattern.test(title)) {
      return true;
    }
  }

  // Check for common college/university abbreviations that are often sports teams
  // This is a heuristic - college names in all caps often indicate sports
  const collegeTeamPattern =
    /\b([A-Z]{2,}\s+){1,3}(VISITS|HOSTS|TRAVELS|WELCOMES|PLAYS|FACES)\b/;
  if (collegeTeamPattern.test(titleUpper)) {
    // Additional check: if it contains point references, it's likely sports
    if (/\bPOINT/i.test(title)) {
      return true;
    }
  }

  return false;
}

// Function to decode HTML entities
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™')
    .replace(/&hellip;/g, '...')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"');
}

// Function to clean HTML tags from text
function cleanHtmlTags(text: string): string {
  return text
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
}

// Function to parse Google News RSS feed
async function parseGoogleNewsRSS(rssText: string): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];
  const processedUrls = new Set<string>();

  try {
    // Extract RSS feed generation time for fallback dating
    const lastBuildDateMatch = rssText.match(
      /<lastBuildDate>([^<]+)<\/lastBuildDate>/
    );
    const rssFeedTime = lastBuildDateMatch
      ? new Date(lastBuildDateMatch[1]).getTime()
      : Date.now();
    console.log(
      `📅 RSS feed generated at: ${new Date(rssFeedTime).toISOString()}`
    );

    // Method 1: Try parsing <ol> lists (Google News format)
    const listMatches = rssText.match(/<ol>([\s\S]*?)<\/ol>/g);

    if (listMatches) {
      for (let listIndex = 0; listIndex < listMatches.length; listIndex++) {
        const list = listMatches[listIndex];
        const itemMatches = list.match(/<li>([\s\S]*?)<\/li>/g);

        if (itemMatches) {
          for (let itemIndex = 0; itemIndex < itemMatches.length; itemIndex++) {
            const item = itemMatches[itemIndex];
            const linkMatch = item.match(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/);

            if (linkMatch) {
              const googleNewsUrl = linkMatch[1];
              const title = decodeHtmlEntities(linkMatch[2].trim());

              // Convert any direct ABC News URLs to proper Google News RSS format
              let directUrl = googleNewsUrl;
              console.log(`🔗 RSS feed provided URL: ${googleNewsUrl}`);

              // If the RSS feed provides direct ABC News URLs, convert them to Google News format
              if (
                googleNewsUrl.includes('abcnews.go.com') ||
                googleNewsUrl.includes('abc.com')
              ) {
                console.log(
                  `⚠️ RSS feed provided direct ABC News URL: ${googleNewsUrl}`
                );
                console.log(`🔄 Converting to Google News RSS format...`);

                // Extract the article ID from the ABC News URL
                const articleIdMatch = googleNewsUrl.match(
                  /\/article-([A-Za-z0-9]+)/
                );
                if (articleIdMatch) {
                  const articleId = articleIdMatch[1];
                  // Create a proper Google News RSS URL
                  directUrl = `https://news.google.com/rss/articles/${articleId}?hl=en-US&gl=US&ceid=US:en`;
                  console.log(
                    `✅ Converted to Google News RSS URL: ${directUrl}`
                  );
                } else {
                  console.log(
                    `❌ Could not extract article ID from ABC News URL`
                  );
                  continue; // Skip this article if we can't convert it
                }
              } else if (
                googleNewsUrl.includes('news.google.com/rss/articles/')
              ) {
                console.log(
                  `✅ RSS feed provided Google News RSS URL: ${googleNewsUrl}`
                );
                console.log(
                  `ℹ️ Users will be redirected to ABC News articles through Google News`
                );
              } else if (
                googleNewsUrl.includes('news.google.com/articles/redirect')
              ) {
                console.log(
                  `❌ RSS feed provided invalid redirect URL: ${googleNewsUrl}`
                );
                console.log(`⚠️ This URL format should not exist in RSS feeds`);
                // Filter out these invalid URLs
                continue;
              } else {
                console.log(
                  `⚠️ Unexpected URL format from RSS: ${googleNewsUrl}`
                );
                // Still use it, but log for debugging
              }

              // Try multiple methods to extract source name
              let sourceName = 'Google News';

              // Method 1: Look for <font> tags (common in Google News RSS)
              const sourceMatch = item.match(/<font[^>]*>([^<]*)<\/font>/);
              if (sourceMatch) {
                sourceName = decodeHtmlEntities(sourceMatch[1].trim());
              } else {
                // Method 2: Look for source in the title (format: "Title - Source")
                const titleParts = title.split(' - ');
                if (titleParts.length > 1) {
                  sourceName = titleParts[titleParts.length - 1].trim();
                }
              }

              // Only include articles from ABC News sources
              if (title && title.length > 0 && !processedUrls.has(directUrl)) {
                const isABCSource =
                  sourceName.toLowerCase().includes('abc') ||
                  sourceName.toLowerCase().includes('abc news') ||
                  googleNewsUrl.includes('abcnews.go.com') ||
                  googleNewsUrl.includes('abc.com');

                if (isABCSource) {
                  // Filter out headlines with "live" or "watch" words
                  const titleLower = title.toLowerCase();
                  const titleUpper = title.toUpperCase();

                  const shouldFilter =
                    titleUpper.startsWith('LIVE:') ||
                    titleUpper.startsWith('WATCH:') ||
                    titleUpper.startsWith('LIVE ') ||
                    titleUpper.startsWith('WATCH ') ||
                    titleUpper.startsWith('BREAKING:') ||
                    titleUpper.startsWith('BREAKING ') ||
                    titleUpper.startsWith('UPDATE:') ||
                    titleUpper.startsWith('UPDATE ') ||
                    titleLower.includes('live') ||
                    titleLower.includes('watch') ||
                    titleLower.includes('livestream') ||
                    titleLower.includes('live stream') ||
                    titleLower.includes('live coverage') ||
                    titleLower.includes('live updates') ||
                    titleLower.includes('live breaking') ||
                    titleLower.includes('watch live') ||
                    titleLower.includes('live now') ||
                    titleLower.includes('breaking live') ||
                    titleLower.includes('live video') ||
                    titleLower.includes('live feed') ||
                    titleLower.includes('live event') ||
                    titleLower.includes('live broadcast') ||
                    titleLower.includes('live report') ||
                    titleLower.includes('live news') ||
                    titleLower.includes('live story') ||
                    titleLower.includes('live update') ||
                    titleLower.includes('live streaming') ||
                    titleLower.includes('streaming') ||
                    titleLower.includes('broadcast') ||
                    titleLower.includes('coverage') ||
                    titleLower.includes('updates') ||
                    titleLower.includes('breaking');

                  if (shouldFilter) {
                    console.log(`Filtered out live/watch headline: "${title}"`);
                    continue;
                  }

                  // Extract date using Google News URL timestamp parameter
                  let publishedAt: string | null = null;

                  // Method 1: Try to extract from Google News URL timestamp parameter
                  const urlTimestampMatch = googleNewsUrl.match(/[?&]t=(\d+)/);
                  if (urlTimestampMatch) {
                    const timestamp = parseInt(urlTimestampMatch[1]);
                    if (!isNaN(timestamp)) {
                      publishedAt = new Date(timestamp * 1000).toISOString();
                      console.log(
                        `✓ Extracted date from Google News URL timestamp for "${title}": ${publishedAt}`
                      );
                    }
                  }

                  // Only include articles with valid dates - no more calculated dates!
                  if (!publishedAt) {
                    console.log(
                      `❌ Skipping article without valid date: "${title}"`
                    );
                    continue; // Skip this article entirely
                  }

                  // Filter out articles older than 4 days to ensure freshness
                  const articleDate = new Date(publishedAt);
                  const fourDaysAgo = new Date(
                    Date.now() - 4 * 24 * 60 * 60 * 1000
                  );
                  if (articleDate < fourDaysAgo) {
                    console.log(
                      `❌ Skipping old article: "${title}" (${publishedAt}) - older than 4 days`
                    );
                    continue; // Skip this article entirely
                  }

                  if (publishedAt && !processedUrls.has(directUrl)) {
                    processedUrls.add(directUrl);

                    articles.push({
                      id: `google-${listIndex}-${itemIndex}-${Date.now()}`,
                      title: title,
                      url: directUrl,
                      publishedAt: publishedAt,
                      description: title,
                      content: title,
                      urlToImage: '',
                      source: {
                        id: null,
                        name: 'ABC News'
                      }
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    // Method 2: If no articles found, try standard RSS <item> parsing
    if (articles.length === 0) {
      const itemMatches = rssText.match(/<item>([\s\S]*?)<\/item>/g);

      if (itemMatches) {
        for (let index = 0; index < itemMatches.length; index++) {
          const item = itemMatches[index];
          const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
          const linkMatch = item.match(/<link>([^<]*)<\/link>/);
          const descriptionMatch = item.match(
            /<description>([\s\S]*?)<\/description>/
          );
          const pubDateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/);

          if (titleMatch && linkMatch) {
            const title = decodeHtmlEntities(
              titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').trim()
            );
            const googleNewsUrl = linkMatch[1].trim();

            // Convert any direct ABC News URLs to proper Google News RSS format
            let directUrl = googleNewsUrl;
            console.log(`🔗 RSS feed provided URL: ${googleNewsUrl}`);

            // If the RSS feed provides direct ABC News URLs, convert them to Google News format
            if (
              googleNewsUrl.includes('abcnews.go.com') ||
              googleNewsUrl.includes('abc.com')
            ) {
              console.log(
                `⚠️ RSS feed provided direct ABC News URL: ${googleNewsUrl}`
              );
              console.log(`🔄 Converting to Google News RSS format...`);

              // Extract the article ID from the ABC News URL
              const articleIdMatch = googleNewsUrl.match(
                /\/article-([A-Za-z0-9]+)/
              );
              if (articleIdMatch) {
                const articleId = articleIdMatch[1];
                // Create a proper Google News RSS URL
                directUrl = `https://news.google.com/rss/articles/${articleId}?hl=en-US&gl=US&ceid=US:en`;
                console.log(
                  `✅ Converted to Google News RSS URL: ${directUrl}`
                );
              } else {
                console.log(
                  `❌ Could not extract article ID from ABC News URL`
                );
                continue; // Skip this article if we can't convert it
              }
            } else if (
              googleNewsUrl.includes('news.google.com/rss/articles/')
            ) {
              console.log(
                `✅ RSS feed provided Google News RSS URL: ${googleNewsUrl}`
              );
              console.log(
                `ℹ️ Users will be redirected to ABC News articles through Google News`
              );
            } else if (
              googleNewsUrl.includes('news.google.com/articles/redirect')
            ) {
              console.log(
                `❌ RSS feed provided invalid redirect URL: ${googleNewsUrl}`
              );
              console.log(`⚠️ This URL format should not exist in RSS feeds`);
              // Filter out these invalid URLs
              continue;
            } else {
              console.log(
                `⚠️ Unexpected URL format from RSS: ${googleNewsUrl}`
              );
              // Still use it, but log for debugging
            }

            let description = descriptionMatch
              ? cleanHtmlTags(
                  decodeHtmlEntities(
                    descriptionMatch[1]
                      .replace(/<!\[CDATA\[(.*?)\]\]>/, '$1')
                      .trim()
                  )
                )
              : '';

            // Try to extract better description from ABC News article if available
            if (
              (!description || description.length < 50) &&
              (directUrl.includes('abcnews.go.com') ||
                directUrl.includes('abc.com'))
            ) {
              try {
                console.log(
                  `📝 Fetching ABC News article to extract better description: ${directUrl}`
                );

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);

                const response = await fetch(directUrl, {
                  method: 'GET',
                  headers: {
                    'User-Agent':
                      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                  },
                  signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                  const html = await response.text();

                  // Look for article content in various patterns
                  const contentPatterns = [
                    /<meta name="description" content="([^"]+)"/i,
                    /<meta property="og:description" content="([^"]+)"/i,
                    /<p[^>]*class="[^"]*content[^"]*"[^>]*>([^<]+)<\/p>/i,
                    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([^<]+)<\/div>/i
                  ];

                  for (const pattern of contentPatterns) {
                    const match = html.match(pattern);
                    if (match && match[1] && match[1].length > 50) {
                      const cleanContent = cleanHtmlTags(
                        decodeHtmlEntities(match[1])
                      );
                      if (cleanContent.length > 50) {
                        description = cleanContent;
                        console.log(
                          `✓ Extracted better description from ABC News article: ${description.substring(
                            0,
                            100
                          )}...`
                        );
                        break;
                      }
                    }
                  }
                }
              } catch (error: any) {
                if (error.name === 'AbortError') {
                  console.log(
                    '⏰ Timeout while fetching ABC News article for description'
                  );
                } else {
                  console.log(
                    `❌ Error fetching ABC News article for description: ${error.message}`
                  );
                }
              }
            }

            // Extract source name from URL or title
            let sourceName = 'Google News';
            const titleParts = title.split(' - ');
            if (titleParts.length > 1) {
              sourceName = titleParts[titleParts.length - 1].trim();
            }

            // Only include articles from ABC News sources
            if (!processedUrls.has(directUrl)) {
              const isABCSource =
                sourceName.toLowerCase().includes('abc') ||
                sourceName.toLowerCase().includes('abc news') ||
                googleNewsUrl.includes('abcnews.go.com') ||
                googleNewsUrl.includes('abc.com');

              if (isABCSource) {
                // Filter out headlines with "live" or "watch" words
                const titleLower = title.toLowerCase();
                const liveWatchPatterns = [
                  'live',
                  'watch',
                  'livestream',
                  'live stream',
                  'live coverage',
                  'live updates',
                  'live breaking',
                  'watch live',
                  'live now',
                  'breaking live'
                ];

                const shouldFilter = liveWatchPatterns.some(pattern =>
                  titleLower.includes(pattern)
                );

                if (shouldFilter) {
                  console.log(`Filtered out live/watch headline: "${title}"`);
                  continue;
                }

                // Extract date using RSS pubDate tag (most reliable)
                let publishedAt: string | null = null;

                // Method 1: Try to extract from RSS pubDate tag (most reliable)
                if (pubDateMatch) {
                  try {
                    const rawPubDate = pubDateMatch[1];
                    console.log(
                      `📅 Raw RSS pubDate for "${title}": ${rawPubDate}`
                    );

                    const pubDate = new Date(rawPubDate);
                    if (!isNaN(pubDate.getTime())) {
                      publishedAt = pubDate.toISOString();
                      console.log(
                        `✓ Extracted date from RSS pubDate for "${title}": ${publishedAt}`
                      );
                      console.log(
                        `✓ Local time equivalent: ${pubDate.toString()}`
                      );
                    } else {
                      console.log(`❌ Invalid RSS pubDate: ${rawPubDate}`);
                    }
                  } catch (e) {
                    console.log(
                      `⚠️ Failed to parse RSS pubDate: ${pubDateMatch[1]}`
                    );
                  }
                } else {
                  console.log(`❌ No RSS pubDate found for "${title}"`);
                }

                // Method 2: Try to extract from Google News URL timestamp parameter (fallback)
                if (!publishedAt) {
                  const urlTimestampMatch = googleNewsUrl.match(
                    /[?&]ceid=[^&]*&gl=[^&]*&hl=[^&]*&t=(\d+)/
                  );
                  if (urlTimestampMatch) {
                    const timestamp = parseInt(urlTimestampMatch[1]);
                    if (!isNaN(timestamp)) {
                      publishedAt = new Date(timestamp * 1000).toISOString();
                      console.log(
                        `⚠️ FALLBACK: Extracted date from Google News timestamp for "${title}": ${publishedAt}`
                      );
                      console.log(
                        `⚠️ FALLBACK: Local time equivalent: ${new Date(
                          timestamp * 1000
                        ).toString()}`
                      );
                    }
                  } else {
                    console.log(`❌ No URL timestamp found for "${title}"`);
                  }
                }

                // Only include articles with valid dates - no more calculated dates!
                if (!publishedAt) {
                  console.log(
                    `❌ Skipping article without valid date: "${title}"`
                  );
                  continue; // Skip this article entirely
                }

                // Log the final date being used
                console.log(`🎯 FINAL DATE for "${title}": ${publishedAt}`);
                console.log(
                  `🎯 FINAL DATE local: ${new Date(publishedAt).toString()}`
                );

                // Validate that the date is reasonable (not in the future, not too old)
                const validatedDate = new Date(publishedAt);
                const now = new Date();
                const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

                if (validatedDate > now) {
                  console.log(
                    `⚠️ WARNING: Article date is in the future: ${publishedAt}`
                  );
                  console.log(
                    `⚠️ This suggests a date parsing issue - skipping article`
                  );
                  continue;
                }

                if (validatedDate < oneDayAgo) {
                  console.log(
                    `⚠️ WARNING: Article date is more than 1 day old: ${publishedAt}`
                  );
                  console.log(
                    `⚠️ This might be a stale article - but continuing`
                  );
                }

                // Filter out articles older than 4 days to ensure freshness
                const articleDate = new Date(publishedAt);
                const fourDaysAgo = new Date(
                  Date.now() - 4 * 24 * 60 * 60 * 1000
                );
                if (articleDate < fourDaysAgo) {
                  console.log(
                    `❌ Skipping old article: "${title}" (${publishedAt}) - older than 4 days`
                  );
                  continue; // Skip this article entirely
                }

                if (publishedAt) {
                  processedUrls.add(directUrl);

                  articles.push({
                    id: `rss-${index}-${Date.now()}`,
                    title: title,
                    url: directUrl,
                    publishedAt: publishedAt,
                    description: description || title,
                    content: description || title,
                    urlToImage: '',
                    source: {
                      id: null,
                      name: 'ABC News'
                    }
                  });
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error parsing Google News RSS feed:', error);
  }

  // Sort articles by actual publication date before returning
  console.log(`🔄 Starting to sort ${articles.length} articles by date...`);

  // Validate and log all dates before sorting
  articles.forEach((article, index) => {
    const date = new Date(article.publishedAt);
    if (isNaN(date.getTime())) {
      console.log(
        `⚠️ Invalid date for article ${index}: "${article.title}" - ${article.publishedAt}`
      );
      // Fix invalid dates by using current time
      article.publishedAt = new Date().toISOString();
    } else {
      console.log(
        `📅 Article ${index}: "${article.title}" - ${article.publishedAt}`
      );
    }
  });

  // Sort by publishedAt (newest first) to maintain chronological order
  articles.sort((a, b) => {
    const dateA = new Date(a.publishedAt);
    const dateB = new Date(b.publishedAt);

    // Ensure we have valid dates
    if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
      console.log(
        `⚠️ Invalid date detected during sorting: dateA=${a.publishedAt}, dateB=${b.publishedAt}`
      );
      return 0; // Keep original order if dates are invalid
    }

    const timeA = dateA.getTime();
    const timeB = dateB.getTime();

    // Sort newest first (descending order)
    const result = timeB - timeA;

    if (result !== 0) {
      console.log(
        `🔄 Sorting: "${a.title}" (${dateA.toISOString()}) vs "${
          b.title
        }" (${dateB.toISOString()}) = ${result > 0 ? 'A first' : 'B first'}`
      );
    }

    return result;
  });

  console.log(`✅ Sorting completed. First 3 articles after sorting:`);
  articles.slice(0, 3).forEach((article, index) => {
    const date = new Date(article.publishedAt);
    console.log(`${index + 1}. "${article.title}" - ${date.toISOString()}`);
  });

  // Add a simple log that will definitely show in Vercel
  console.log(
    `SORTING_DEBUG: First article after sort: "${articles[0]?.title}" at ${articles[0]?.publishedAt}`
  );
  console.log(
    `SORTING_DEBUG: Last article after sort: "${
      articles[articles.length - 1]?.title
    }" at ${articles[articles.length - 1]?.publishedAt}`
  );

  console.log(`Parsed ${articles.length} articles from Google News RSS feed`);

  // Log the date range of articles for debugging
  if (articles.length > 0) {
    const dates = articles
      .map(a => new Date(a.publishedAt))
      .sort((a, b) => a.getTime() - b.getTime());
    console.log(
      `📅 Date range: ${dates[0].toISOString()} to ${dates[
        dates.length - 1
      ].toISOString()}`
    );
    console.log(
      `📅 Total time span: ${Math.round(
        (dates[dates.length - 1].getTime() - dates[0].getTime()) /
          (1000 * 60 * 60 * 24)
      )} days`
    );
  }

  return articles;
}

// Function to merge new articles with existing ones, ensuring 48-hour retention
function mergeArticles(
  existingArticles: NewsArticle[],
  newArticles: NewsArticle[]
): NewsArticle[] {
  const mergedArticles: NewsArticle[] = [];
  const existingUrls = new Set(existingArticles.map(article => article.url));
  const newUrls = new Set(newArticles.map(article => article.url));

  // Calculate 48 hours ago
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  console.log(
    `Merge: ${existingArticles.length} existing articles, ${newArticles.length} new articles`
  );
  console.log(`48 hours ago: ${fortyEightHoursAgo.toISOString()}`);

  // Add existing articles that are not in the new set AND are not older than 48 hours
  let keptExisting = 0;
  let filteredOutExisting = 0;
  existingArticles.forEach(article => {
    // Validate the date before processing
    let articleDate = new Date(article.publishedAt);
    if (isNaN(articleDate.getTime())) {
      console.log(
        `Warning: Invalid date for existing article "${article.title}": ${article.publishedAt}`
      );
      // Fix invalid dates by using current time
      article.publishedAt = new Date().toISOString();
      articleDate = new Date(article.publishedAt);
    }

    if (!newUrls.has(article.url) && articleDate > fortyEightHoursAgo) {
      mergedArticles.push(article);
      keptExisting++;
    } else {
      filteredOutExisting++;
      if (articleDate <= fortyEightHoursAgo) {
        console.log(
          `Filtered out old article: ${article.title} (${article.publishedAt})`
        );
      }
    }
  });

  // Add all new articles that are not in the existing set
  let addedNew = 0;
  let skippedNew = 0;
  newArticles.forEach(article => {
    if (!existingUrls.has(article.url)) {
      // Validate the date before adding
      const articleDate = new Date(article.publishedAt);
      if (isNaN(articleDate.getTime())) {
        console.log(
          `Warning: Invalid date for article "${article.title}": ${article.publishedAt}`
        );
        // Fix invalid dates by using current time
        article.publishedAt = new Date().toISOString();
      }

      mergedArticles.push(article);
      addedNew++;
    } else {
      skippedNew++;
      console.log(`Skipped duplicate new article: ${article.title}`);
    }
  });

  console.log(
    `Merge results: kept ${keptExisting} existing, added ${addedNew} new, filtered out ${filteredOutExisting} old, skipped ${skippedNew} duplicates`
  );

  // Sort by publishedAt (newest first) to maintain chronological order
  mergedArticles.sort((a, b) => {
    const dateA = new Date(a.publishedAt);
    const dateB = new Date(b.publishedAt);

    // Ensure we have valid dates
    if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
      console.log(
        `⚠️ Invalid date detected during merge sorting: dateA=${a.publishedAt}, dateB=${b.publishedAt}`
      );
      return 0; // Keep original order if dates are invalid
    }

    const timeA = dateA.getTime();
    const timeB = dateB.getTime();

    // Sort newest first (descending order)
    const result = timeB - timeA;

    if (result !== 0) {
      console.log(
        `🔄 Merge sorting: "${a.title}" (${dateA.toISOString()}) vs "${
          b.title
        }" (${dateB.toISOString()}) = ${result > 0 ? 'A first' : 'B first'}`
      );
    }

    return result;
  });

  console.log(
    `✅ Merge sorting completed. First 3 articles after merge sorting:`
  );
  mergedArticles.slice(0, 3).forEach((article, index) => {
    const date = new Date(article.publishedAt);
    console.log(`${index + 1}. "${article.title}" - ${date.toISOString()}`);
  });

  return mergedArticles;
}
