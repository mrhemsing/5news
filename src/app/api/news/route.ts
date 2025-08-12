import { NextResponse } from 'next/server';
import { NewsArticle } from '@/types/news';
import {
  getCachedNews,
  setCachedNews,
  getAllCachedPages
} from '@/lib/newsCache';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Try to get cached news first (for any page, unless force refresh)
    let existingArticles: NewsArticle[] = [];
    if (!forceRefresh) {
      const cachedArticles = await getCachedNews();
      if (cachedArticles) {
        console.log(`Returning cached news data for page ${page}`);
        // Apply VIDEO filter to cached articles as well
        existingArticles = cachedArticles.filter(article => {
          const cleanTitle = article.title.replace(/\s*\([^)]*\)/g, '').trim();
          if (cleanTitle.toLowerCase().includes('video')) {
            console.log('Filtered out cached video headline:', article.title);
            return false;
          }
          return true;
        });
        console.log(
          `Filtered cached articles: ${cachedArticles.length} -> ${existingArticles.length}`
        );
      }
    }

    // If we're requesting page 1 and don't have it cached, check if we have other pages
    if (page === 1 && !forceRefresh && existingArticles.length === 0) {
      const cachedPages = await getAllCachedPages(
        new Date().toISOString().split('T')[0]
      );
      if (cachedPages.length > 0) {
        console.log(
          'Found cached pages, serving from cache instead of making API call'
        );
        const cachedArticles = await getCachedNews();
        if (cachedArticles) {
          existingArticles = cachedArticles;
        }
      }
    }

    // Check if we need to fetch fresh articles
    const shouldFetchFresh =
      forceRefresh ||
      existingArticles.length === 0 ||
      (existingArticles.length > 0 &&
        Date.now() - new Date(existingArticles[0]?.publishedAt || 0).getTime() >
          30 * 60 * 1000);

    if (shouldFetchFresh) {
      console.log(
        `Making Google News RSS request for page ${page} (stealth mode)`
      );

      // Minimal delay to avoid rate limiting
      const initialDelay = 100 + Math.random() * 200;
      console.log(
        `Initial delay: ${Math.round(initialDelay / 1000)} seconds...`
      );
      await new Promise(resolve => setTimeout(resolve, initialDelay));

      let mergedArticles: NewsArticle[] = [];

      const rssUrls = [
        'https://news.google.com/rss/search?q=ABC+News&hl=en-US&gl=US&ceid=US:en&num=20',
        'https://news.google.com/rss/search?q=ABC+News&hl=en&gl=US&ceid=US:en&num=20'
      ];

      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ];

      // Try Google News RSS with enhanced anti-blocking
      let googleNewsSuccess = false;
      for (const rssUrl of rssUrls) {
        if (googleNewsSuccess) break;

        let retries = 2;
        while (retries > 0 && !googleNewsSuccess) {
          try {
            const userAgent =
              userAgents[Math.floor(Math.random() * userAgents.length)];
            console.log(
              `Trying Google News RSS: ${rssUrl} (attempt ${3 - retries}/2)`
            );

            if (retries < 2) {
              const naturalDelay = 500 + Math.random() * 1000;
              console.log(
                `Natural delay: ${Math.round(naturalDelay / 1000)} seconds...`
              );
              await new Promise(resolve => setTimeout(resolve, naturalDelay));
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
              const response = await fetch(rssUrl, {
                headers: {
                  'User-Agent': userAgent,
                  Accept:
                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                  'Accept-Language': 'en-US,en;q=0.5',
                  'Accept-Encoding': 'gzip, deflate',
                  Connection: 'keep-alive',
                  'Upgrade-Insecure-Requests': '1',
                  'Cache-Control': 'max-age=0'
                },
                signal: controller.signal
              });

              clearTimeout(timeoutId);

              if (response.ok) {
                const rssText = await response.text();
                console.log(
                  `✓ Google News RSS success! Length: ${rssText.length} characters`
                );

                const articles = await parseGoogleNewsRSS(rssText);
                console.log(
                  `Got ${articles.length} articles from Google News RSS`
                );

                mergedArticles = mergeArticles(mergedArticles, articles);
                googleNewsSuccess = true;
                break;
              } else if (response.status === 503) {
                console.log(
                  `503 Service Unavailable - trying next URL variation...`
                );
                break;
              } else {
                console.log(
                  `Failed: ${response.status} ${response.statusText}`
                );
                retries--;
                if (retries > 0) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
            } catch (fetchError: any) {
              clearTimeout(timeoutId);
              if (fetchError.name === 'AbortError') {
                console.log('RSS fetch timed out, trying next attempt...');
              } else {
                console.error(`RSS fetch error:`, fetchError);
              }
              retries--;
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 3000));
              }
            }
          } catch (error) {
            console.error(`Error with Google News RSS:`, error);
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          }
        }

        if (
          !googleNewsSuccess &&
          rssUrls.indexOf(rssUrl) < rssUrls.length - 1
        ) {
          const naturalDelay = 2000 + Math.random() * 2000;
          console.log(
            `Natural delay before next URL: ${Math.round(
              naturalDelay / 1000
            )} seconds...`
          );
          await new Promise(resolve => setTimeout(resolve, naturalDelay));
        }
      }

      if (!googleNewsSuccess) {
        console.log(
          'All Google News RSS variations failed. This may indicate IP blocking.'
        );

        // Fallback: Return filtered cached articles if available
        if (existingArticles.length > 0) {
          console.log(
            'Falling back to filtered cached articles due to RSS failure'
          );
          const sortedCachedArticles = [...existingArticles].sort(
            (a, b) =>
              new Date(b.publishedAt).getTime() -
              new Date(a.publishedAt).getTime()
          );

          return NextResponse.json({
            articles: sortedCachedArticles,
            totalResults: sortedCachedArticles.length,
            hasMore: false,
            fallback: true
          });
        }

        return NextResponse.json(
          {
            error:
              'Google News RSS temporarily unavailable. Please try again later.'
          },
          { status: 503 }
        );
      }

      // Filter and deduplicate articles
      const filteredArticles = mergedArticles.filter(article => {
        const cleanTitle = article.title.replace(/\s*\([^)]*\)/g, '').trim();
        if (cleanTitle.split(' ').length <= 1) {
          console.log('Filtered out single word:', article.title);
          return false;
        }
        if (cleanTitle.toLowerCase().includes('live updates')) {
          console.log('Filtered out live updates:', article.title);
          return false;
        }
        if (cleanTitle.toLowerCase().includes('latest news')) {
          console.log('Filtered out latest news:', article.title);
          return false;
        }
        if (cleanTitle.toLowerCase().includes('video')) {
          console.log('Filtered out video headline:', article.title);
          return false;
        }
        return true;
      });

      const uniqueArticles = filteredArticles.filter((article, index, self) => {
        const urlIndex = self.findIndex(a => a.url === article.url);
        if (urlIndex !== index) {
          console.log('Filtered out duplicate URL:', article.title);
          return false;
        }
        return true;
      });

      // Add unique IDs to new articles
      const newArticlesWithIds: NewsArticle[] = uniqueArticles.map(
        (article, index) => ({
          ...article,
          id: `article-${Date.now()}-${index}`,
          title: article.title.replace(/\s*\([^)]*\)/g, '').trim()
        })
      );

      // Merge new articles with existing ones
      const allArticles = mergeArticles(existingArticles, newArticlesWithIds);

      // Filter out articles with malformed URLs - less strict validation
      const validArticles = allArticles.filter(article => {
        // Only filter out extremely long URLs (likely malformed)
        if (article.url.length > 500) {
          console.log(
            `Filtered out article with extremely long URL (${article.url.length} chars): "${article.title}"`
          );
          return false;
        }

        // Accept any URL that looks like it could be valid
        // (either ABC News URLs or Google News URLs that we've processed)
        if (
          article.url.includes('abcnews.go.com') ||
          article.url.includes('abc.com') ||
          article.url.includes('news.google.com')
        ) {
          return true;
        }

        // Log any other URLs for debugging
        console.log(
          `⚠️  Unknown URL format: ${article.url} for "${article.title}"`
        );
        return true; // Don't filter out, just log for debugging
      });

      console.log(
        `Filtered out ${
          allArticles.length - validArticles.length
        } articles with malformed URLs`
      );

             // Cache the filtered results
       await setCachedNews(validArticles, page);

       console.log(
         `📤 Returning ${validArticles.length} articles to frontend:`
       );
       validArticles.slice(0, 5).forEach((article, index) => {
         const date = new Date(article.publishedAt);
         console.log(`${index + 1}. "${article.title}" - ${date.toISOString()}`);
       });

       // Add debug info to verify sorting
       const firstArticle = validArticles[0];
       const lastArticle =
         validArticles[validArticles.length - 1];
       const debugInfo = {
         firstArticle: {
           title: firstArticle?.title,
           publishedAt: firstArticle?.publishedAt,
           timestamp: firstArticle
             ? new Date(firstArticle.publishedAt).getTime()
             : null
         },
         lastArticle: {
           title: lastArticle?.title,
           publishedAt: lastArticle?.publishedAt,
           timestamp: lastArticle
             ? new Date(lastArticle.publishedAt).getTime()
             : null
         },
         totalArticles: validArticles.length,
         sortingVerified:
           firstArticle && lastArticle
             ? new Date(firstArticle.publishedAt).getTime() >
               new Date(lastArticle.publishedAt).getTime()
             : false
       };

       console.log(
         `SORTING_VERIFICATION: ${
           debugInfo.sortingVerified ? '✅' : '❌'
         } Sorting verified - First article is newer than last article`
       );

       return NextResponse.json({
         articles: validArticles,
         totalResults: validArticles.length,
         hasMore: false,
         debug: debugInfo
       });
    } else {
      // Return existing cached articles
      const sortedCachedArticles = [...existingArticles].sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );

      const validCachedArticles = sortedCachedArticles.filter(article => {
        // Only filter out extremely long URLs (likely malformed)
        if (article.url.length > 500) {
          console.log(
            `Filtered out cached article with extremely long URL (${article.url.length} chars): "${article.title}"`
          );
          return false;
        }

        // Accept any URL that looks like it could be valid
        if (
          article.url.includes('abcnews.go.com') ||
          article.url.includes('abc.com') ||
          article.url.includes('news.google.com')
        ) {
          return true;
        }

        // Log any other URLs for debugging
        console.log(
          `⚠️  Unknown cached URL format: ${article.url} for "${article.title}"`
        );
        return true; // Don't filter out, just log for debugging
      });

             return NextResponse.json({
         articles: validCachedArticles,
         totalResults: validCachedArticles.length,
         hasMore: false
       });
    }
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
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

// Function to extract real URL and published date from Google News redirect
async function extractRealUrlFromGoogleNews(
  googleNewsUrl: string
): Promise<{ url: string; publishedAt: string | null }> {
  try {
    // DISABLED: We want to keep Google News redirect URLs, not extract direct ABC News URLs
    // Method 1 & 2 disabled to preserve Google News redirect links
    console.log(`🔗 Keeping Google News redirect URL: ${googleNewsUrl}`);

    // Method 3: Return original Google News URL (most reliable)
    if (googleNewsUrl.includes('/articles/')) {
      console.log(`🔗 Using original Google News URL: ${googleNewsUrl}`);
      console.log(
        `ℹ️ Users will be redirected to ABC News articles through Google News`
      );

      // Extract timestamp from Google News URL if available for better dating
      const urlTimestampMatch = googleNewsUrl.match(/[?&]t=(\d+)/);
      let publishedAt: string | null = null;

      if (urlTimestampMatch) {
        const timestamp = parseInt(urlTimestampMatch[1]);
        if (!isNaN(timestamp)) {
          publishedAt = new Date(timestamp * 1000).toISOString();
          console.log(
            `✓ Extracted timestamp from Google News URL: ${publishedAt}`
          );
        }
      }

      return { url: googleNewsUrl, publishedAt: publishedAt };
    }

    // If all else fails, return the original URL
    console.log(
      `⚠️ Could not extract real URL, keeping original: ${googleNewsUrl}`
    );
    return { url: googleNewsUrl, publishedAt: null };
  } catch (error: any) {
    console.log(`❌ Error in extractRealUrlFromGoogleNews: ${error.message}`);
    return { url: googleNewsUrl, publishedAt: null };
  }
}

// Function to extract published date from ABC News article page
async function extractPublishedDateFromABCNews(
  articleUrl: string
): Promise<string | null> {
  try {
    // Only try to fetch if it's an actual ABC News URL
    if (
      !articleUrl.includes('abcnews.go.com') &&
      !articleUrl.includes('abc.com')
    ) {
      console.log(
        `⚠️ Skipping date extraction - not an ABC News URL: ${articleUrl}`
      );
      return null;
    }

    console.log(
      `📅 Fetching ABC News article to extract published date: ${articleUrl}`
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(articleUrl, {
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
      console.log(
        `📄 ABC News article fetched successfully. HTML length: ${html.length} characters`
      );

      // Look for various date patterns in ABC News articles
      const datePatterns = [
        // Meta tags
        /<meta property="article:published_time" content="([^"]+)"/i,
        /<meta name="publish_date" content="([^"]+)"/i,
        /<meta name="date" content="([^"]+)"/i,
        /<meta property="og:updated_time" content="([^"]+)"/i,

        // Schema.org structured data
        /"datePublished":\s*"([^"]+)"/i,
        /"dateCreated":\s*"([^"]+)"/i,
        /"dateModified":\s*"([^"]+)"/i,

        // HTML time elements
        /<time[^>]*datetime="([^"]+)"[^>]*>/i,
        /<time[^>]*>([^<]+)<\/time>/i,

        // Common date formats in ABC News
        /(\d{1,2}\/\d{1,2}\/\d{4})/i,
        /(\d{4}-\d{2}-\d{2})/i,
        /(\w+ \d{1,2},? \d{4})/i
      ];

      console.log(`🔍 Searching for date patterns in ABC News article...`);

      for (const pattern of datePatterns) {
        console.log(`🔍 Trying date pattern: ${pattern.source}`);
        const match = html.match(pattern);
        if (match && match[1]) {
          console.log(`✅ Date pattern matched! Found: ${match[1]}`);
          try {
            let dateString = match[1];

            // Clean up the date string
            dateString = dateString.replace(/T.*$/, ''); // Remove time part if present
            dateString = dateString.replace(/Z$/, ''); // Remove Z suffix

            console.log(`🔍 Cleaned date string: ${dateString}`);

            // Try to parse the date
            let parsedDate: Date;

            if (dateString.includes('-')) {
              // ISO format: 2024-01-15
              parsedDate = new Date(dateString);
            } else if (dateString.includes('/')) {
              // US format: 01/15/2024
              const [month, day, year] = dateString.split('/');
              parsedDate = new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day)
              );
            } else if (dateString.includes(',')) {
              // Text format: January 15, 2024
              parsedDate = new Date(dateString);
            } else {
              // Try direct parsing
              parsedDate = new Date(dateString);
            }

            if (!isNaN(parsedDate.getTime())) {
              const isoDate = parsedDate.toISOString();
              console.log(
                `✓ Extracted published date: ${isoDate} from pattern: ${pattern.source}`
              );
              return isoDate;
            } else {
              console.log(`⚠️ Parsed date is invalid: ${parsedDate}`);
            }
          } catch (e: any) {
            console.log(`❌ Error parsing date: ${e.message}`);
          }
        } else {
          console.log(`❌ Date pattern ${pattern.source} found no matches`);
        }
      }

      console.log('⚠️ No valid date found in ABC News article');

      // Let's see what the HTML actually contains
      console.log(
        `🔍 HTML preview (first 500 chars): ${html.substring(0, 500)}`
      );

      return null;
    } else {
      console.log(
        `❌ ABC News article fetch failed: ${response.status} ${response.statusText}`
      );
      return null;
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('⏰ Timeout while fetching ABC News article for date');
    } else {
      console.log(
        `❌ Error fetching ABC News article for date: ${error.message}`
      );
    }
    return null;
  }
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

              // Use the original URL from the RSS feed (this should be a proper Google News URL)
              let directUrl = googleNewsUrl;
              console.log(`🔗 Using original RSS URL: ${googleNewsUrl}`);

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

                  // Extract date using multiple methods for reliability
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

                  // Method 2: Use RSS feed generation time with offset based on item position
                  if (!publishedAt) {
                    // Calculate time offset based on item position (newer items appear first)
                    const timeOffset = listIndex * 1000 + itemIndex * 500; // 1 second per list, 0.5 seconds per item
                    const calculatedTime = rssFeedTime - timeOffset;
                    publishedAt = new Date(calculatedTime).toISOString();
                    console.log(
                      `📅 Calculated date from RSS feed time for "${title}": ${publishedAt} (position: list ${listIndex}, item ${itemIndex})`
                    );
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

            // Use the original URL from the RSS feed (this should be a proper Google News URL)
            let directUrl = googleNewsUrl;
            console.log(`🔗 Using original RSS URL: ${googleNewsUrl}`);

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

                // Extract date using multiple methods for reliability
                let publishedAt: string | null = null;

                // Method 1: Try to extract from RSS pubDate tag (most reliable)
                if (pubDateMatch) {
                  try {
                    const pubDate = new Date(pubDateMatch[1]);
                    if (!isNaN(pubDate.getTime())) {
                      publishedAt = pubDate.toISOString();
                      console.log(
                        `✓ Extracted date from RSS pubDate for "${title}": ${publishedAt}`
                      );
                    }
                  } catch (e) {
                    console.log(
                      `⚠️ Failed to parse RSS pubDate: ${pubDateMatch[1]}`
                    );
                  }
                }

                // Method 2: Try to extract from Google News URL timestamp parameter
                if (!publishedAt) {
                  const urlTimestampMatch = googleNewsUrl.match(
                    /[?&]ceid=[^&]*&gl=[^&]*&hl=[^&]*&t=(\d+)/
                  );
                  if (urlTimestampMatch) {
                    const timestamp = parseInt(urlTimestampMatch[1]);
                    if (!isNaN(timestamp)) {
                      publishedAt = new Date(timestamp * 1000).toISOString();
                      console.log(
                        `✓ Extracted date from Google News timestamp for "${title}": ${publishedAt}`
                      );
                    }
                  }
                }

                // Method 3: Use RSS feed generation time with offset based on item position
                if (!publishedAt) {
                  const timeOffset = index * 1000; // 1 second per item
                  const calculatedTime = rssFeedTime - timeOffset;
                  publishedAt = new Date(calculatedTime).toISOString();
                  console.log(
                    `📅 Calculated date from RSS feed time for "${title}": ${publishedAt} (position: ${index})`
                  );
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
