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
        existingArticles = cachedArticles;
      }
    }

    // If we're requesting page 1 and don't have it cached, check if we have other pages
    // This helps when users refresh and we can serve from cache instead of making new API calls
    if (page === 1 && !forceRefresh && existingArticles.length === 0) {
      const cachedPages = await getAllCachedPages(
        new Date().toISOString().split('T')[0]
      );
      if (cachedPages.length > 0) {
        console.log(
          'Found cached pages, serving from cache instead of making API call'
        );
        // Return the first cached page we have
        const cachedArticles = await getCachedNews();
        if (cachedArticles) {
          existingArticles = cachedArticles;
        }
      }
    }

    // Check if we need to fetch fresh articles (cache expired or force refresh)
    const shouldFetchFresh =
      forceRefresh ||
      existingArticles.length === 0 ||
      (existingArticles.length > 0 &&
        Date.now() - new Date(existingArticles[0]?.publishedAt || 0).getTime() >
          30 * 60 * 1000);

    if (shouldFetchFresh) {
      console.log(
        `Making Google News RSS request for page ${page} (enhanced date extraction)`
      );

      // Focused Google News RSS strategy with enhanced date extraction
      let mergedArticles: NewsArticle[] = [];

      const rssUrls = [
        'https://news.google.com/rss/search?q=ABC+News&hl=en-US&gl=US&ceid=US:en&num=50',
        'https://news.google.com/rss/search?q=ABC+News&hl=en&gl=US&ceid=US:en&num=50',
        'https://news.google.com/rss/search?q=ABC+News&hl=en-US&gl=US&num=50',
        'https://news.google.com/rss/search?q=ABC+News&hl=en&gl=US&num=50'
      ];

      // Enhanced User-Agent rotation with more realistic patterns
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
      ];

      // Try Google News RSS with enhanced anti-blocking
      let googleNewsSuccess = false;
      for (const rssUrl of rssUrls) {
        if (googleNewsSuccess) break;

        let retries = 3;
        while (retries > 0 && !googleNewsSuccess) {
          try {
            const userAgent =
              userAgents[Math.floor(Math.random() * userAgents.length)];
            console.log(
              `Trying Google News RSS: ${rssUrl} (attempt ${4 - retries}/3)`
            );

            // Enhanced headers to mimic real browser behavior
            const response = await fetch(rssUrl, {
              headers: {
                'User-Agent': userAgent,
                Accept:
                  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                Connection: 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0',
                Pragma: 'no-cache',
                DNT: '1',
                Referer: 'https://www.google.com/',
                Origin: 'https://www.google.com',
                'Sec-Ch-Ua':
                  '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"'
              }
            });

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
              break; // Try next URL variation
            } else {
              console.log(`Failed: ${response.status} ${response.statusText}`);
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
          console.log(`Waiting 5 seconds before trying next URL variation...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      if (!googleNewsSuccess) {
        console.log(
          'All Google News RSS variations failed. This may indicate IP blocking.'
        );
        console.log(
          'Consider: 1) Wait 1-2 hours for IP block to expire, 2) Use VPN, 3) Check network restrictions'
        );
        return NextResponse.json(
          {
            error:
              'Google News RSS temporarily unavailable. Please try again later.'
          },
          { status: 503 }
        );
      }

      // Simple content filtering - only filter out low-quality headlines
      const filteredArticles = mergedArticles.filter(article => {
        // Skip single word headlines
        const cleanTitle = article.title.replace(/\s*\([^)]*\)/g, '').trim();
        if (cleanTitle.split(' ').length <= 1) {
          console.log('Filtered out single word:', article.title);
          return false;
        }

        // Skip headlines containing "LIVE UPDATES"
        if (cleanTitle.toLowerCase().includes('live updates')) {
          console.log('Filtered out live updates:', article.title);
          return false;
        }

        // Skip headlines containing "LATEST NEWS"
        if (cleanTitle.toLowerCase().includes('latest news')) {
          console.log('Filtered out latest news:', article.title);
          return false;
        }

        // Skip headlines containing "FRESH AIR"
        if (cleanTitle.toLowerCase().includes('fresh air')) {
          console.log('Filtered out fresh air:', article.title);
          return false;
        }

        return true;
      });

      console.log('After filtering:', filteredArticles.length, 'articles');

      // Enhanced deduplication - remove duplicates based on title similarity and URL
      const uniqueArticles = filteredArticles.filter((article, index, self) => {
        // Check for exact URL duplicates first
        const urlIndex = self.findIndex(a => a.url === article.url);
        if (urlIndex !== index) {
          console.log('Filtered out duplicate URL:', article.title);
          return false;
        }

        // Check for title similarity (case-insensitive, ignoring punctuation)
        const cleanTitle = article.title
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .trim();
        const titleIndex = self.findIndex(a => {
          const aCleanTitle = a.title
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .trim();
          return aCleanTitle === cleanTitle;
        });

        if (titleIndex !== index) {
          console.log('Filtered out duplicate title:', article.title);
          return false;
        }

        return true;
      });

      // Add unique IDs to new articles
      const newArticlesWithIds: NewsArticle[] = uniqueArticles.map(
        (article, index) => ({
          ...article,
          id: `article-${Date.now()}-${index}`,
          title: article.title.replace(/\s*\([^)]*\)/g, '').trim() // Remove text in parentheses
        })
      );

      // Merge new articles with existing ones (48-hour retention)
      const allArticles = mergeArticles(existingArticles, newArticlesWithIds);

      console.log(
        `Merged articles: ${existingArticles.length} existing + ${newArticlesWithIds.length} new = ${allArticles.length} total`
      );

      // Debug: Log article dates to verify 48-hour retention
      if (allArticles.length > 0) {
        const oldestArticle = allArticles[allArticles.length - 1];
        const newestArticle = allArticles[0];
        console.log(
          `Date range: ${oldestArticle.publishedAt} to ${newestArticle.publishedAt}`
        );

        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const articlesInRange = allArticles.filter(
          article => new Date(article.publishedAt) > fortyEightHoursAgo
        );
        console.log(
          `Articles within 48 hours: ${articlesInRange.length}/${allArticles.length}`
        );
      }

      // Cache the merged results
      await setCachedNews(allArticles, page);

      // Log the order of articles being returned
      console.log('Returning fresh articles - order verification:');
      allArticles.slice(0, 5).forEach((article, index) => {
        console.log(
          `${index + 1}. "${article.title}" - ${article.publishedAt}`
        );
      });

      // Return all articles - let frontend handle pagination
      return NextResponse.json({
        articles: allArticles,
        totalResults: allArticles.length,
        hasMore: false // Google News RSS doesn't support pagination
      });
    } else {
      // Return existing cached articles - ensure they're properly sorted
      const sortedCachedArticles = [...existingArticles].sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );

      console.log('Returning cached articles - ensuring proper sorting');
      console.log('First 3 cached articles:');
      sortedCachedArticles.slice(0, 3).forEach((article, index) => {
        console.log(
          `${index + 1}. "${article.title}" - ${article.publishedAt}`
        );
      });

      return NextResponse.json({
        articles: sortedCachedArticles,
        totalResults: sortedCachedArticles.length,
        hasMore: false // Google News RSS doesn't support pagination
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

// Function to parse Google News RSS feed
async function parseGoogleNewsRSS(rssText: string): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];
  const processedUrls = new Set<string>();

  try {
    // Method 1: Try parsing <ol> lists (Google News format)
    const listMatches = rssText.match(/<ol>([\s\S]*?)<\/ol>/g);

    if (listMatches) {
      for (let listIndex = 0; listIndex < listMatches.length; listIndex++) {
        const list = listMatches[listIndex];
        // Extract individual list items
        const itemMatches = list.match(/<li>([\s\S]*?)<\/li>/g);

        if (itemMatches) {
          for (let itemIndex = 0; itemIndex < itemMatches.length; itemIndex++) {
            const item = itemMatches[itemIndex];
            // Extract link and text from <a> tags
            const linkMatch = item.match(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/);

            if (linkMatch) {
              const googleNewsUrl = linkMatch[1];
              const title = decodeHtmlEntities(linkMatch[2].trim());

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
                } else {
                  // Method 3: Extract domain from URL
                  try {
                    const urlObj = new URL(googleNewsUrl);
                    const domain = urlObj.hostname.replace('www.', '');
                    if (domain && domain !== 'news.google.com') {
                      // Clean up domain name for display
                      sourceName =
                        domain
                          .replace('.com', '')
                          .replace('.org', '')
                          .replace('.net', '')
                          .replace('.co.uk', '')
                          .replace('.io', '')
                          .split('.')
                          .pop() || domain;
                    }
                  } catch (e) {
                    // If URL parsing fails, try to extract from the title
                    const titleParts = title.split(' - ');
                    if (titleParts.length > 1) {
                      sourceName = titleParts[titleParts.length - 1].trim();
                    }
                  }
                }
              }

              // Only include articles from ABC News sources
              if (
                title &&
                title.length > 0 &&
                !processedUrls.has(googleNewsUrl)
              ) {
                // Check if the source is ABC News or related
                const isABCSource =
                  sourceName.toLowerCase().includes('abc') ||
                  sourceName.toLowerCase().includes('abc news') ||
                  googleNewsUrl.includes('abcnews.go.com') ||
                  googleNewsUrl.includes('abc.com');

                if (isABCSource) {
                  // Filter out headlines with "live" or "watch" words (and variations)
                  const titleLower = title.toLowerCase();
                  const titleUpper = title.toUpperCase();

                  // Check for common patterns that indicate live content or video content
                  const shouldFilter =
                    // Check for "LIVE:" or "WATCH:" at the beginning of headlines
                    titleUpper.startsWith('LIVE:') ||
                    titleUpper.startsWith('WATCH:') ||
                    titleUpper.startsWith('LIVE ') ||
                    titleUpper.startsWith('WATCH ') ||
                    titleUpper.startsWith('BREAKING:') ||
                    titleUpper.startsWith('BREAKING ') ||
                    titleUpper.startsWith('UPDATE:') ||
                    titleUpper.startsWith('UPDATE ') ||
                    // Check for other live/watch patterns anywhere in the title
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
                    continue; // Skip this article
                  }

                  // Extract date from the Google News URL (most reliable for Google News)
                  let publishedAt: string | null = null;

                  // Method 1: Extract from Google News URL timestamp parameter (most accurate)
                  const urlTimestampMatch = googleNewsUrl.match(/[?&]t=(\d+)/);
                  if (urlTimestampMatch) {
                    const timestamp = parseInt(urlTimestampMatch[1]);
                    if (!isNaN(timestamp)) {
                      publishedAt = new Date(timestamp * 1000).toISOString();
                      console.log(
                        `✓ Extracted date from Google News timestamp for "${title}": ${publishedAt}`
                      );
                    }
                  }

                  // Method 2: Extract from Google News URL path patterns
                  if (!publishedAt) {
                    const urlDatePatterns = [
                      /\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//, // YYYY/MM/DD
                      /\/(\d{4})-(\d{1,2})-(\d{1,2})\//, // YYYY-MM-DD
                      /\/(\d{4})\.(\d{1,2})\.(\d{1,2})\//, // YYYY.MM.DD
                      /\/(\d{4})_(\d{1,2})_(\d{1,2})\//, // YYYY_MM_DD
                      /\/(\d{4})_(\d{1,2})_(\d{1,2})\./, // YYYY_MM_DD.
                      /\/(\d{1,2})\/(\d{1,2})\/(\d{4})\//, // MM/DD/YYYY
                      /\/(\d{1,2})-(\d{1,2})-(\d{4})\//, // MM-DD-YYYY
                      /\/(\d{1,2})\.(\d{1,2})\.(\d{4})\// // MM.DD.YYYY
                    ];

                    for (const pattern of urlDatePatterns) {
                      const match = googleNewsUrl.match(pattern);
                      if (match) {
                        try {
                          let year, month, day;
                          if (pattern.source.startsWith('\\/(\\d{4})')) {
                            // YYYY-MM-DD format
                            [, year, month, day] = match;
                          } else {
                            // MM-DD-YYYY format
                            [, month, day, year] = match;
                          }

                          const dateFromUrl = new Date(
                            parseInt(year),
                            parseInt(month) - 1,
                            parseInt(day)
                          );

                          if (
                            !isNaN(dateFromUrl.getTime()) &&
                            dateFromUrl > new Date('2020-01-01')
                          ) {
                            publishedAt = dateFromUrl.toISOString();
                            console.log(
                              `✓ Extracted date from URL pattern for "${title}": ${publishedAt}`
                            );
                            break;
                          }
                        } catch (e) {
                          // Continue to next pattern
                        }
                      }
                    }
                  }

                  // Method 3: Extract from Google News article ID (often contains timestamp)
                  if (!publishedAt) {
                    const articleIdMatch = googleNewsUrl.match(
                      /\/articles\/([A-Za-z0-9]+)/
                    );
                    if (articleIdMatch) {
                      const articleId = articleIdMatch[1];
                      // Some Google News article IDs contain timestamps
                      if (articleId.length >= 8) {
                        try {
                          const possibleTimestamp = parseInt(
                            articleId.substring(0, 8)
                          );
                          if (
                            !isNaN(possibleTimestamp) &&
                            possibleTimestamp > 20200000
                          ) {
                            const year = Math.floor(possibleTimestamp / 10000);
                            const month = Math.floor(
                              (possibleTimestamp % 10000) / 100
                            );
                            const day = possibleTimestamp % 100;

                            if (
                              month >= 1 &&
                              month <= 12 &&
                              day >= 1 &&
                              day <= 31
                            ) {
                              const dateFromId = new Date(year, month - 1, day);
                              if (
                                !isNaN(dateFromId.getTime()) &&
                                dateFromId > new Date('2020-01-01')
                              ) {
                                publishedAt = dateFromId.toISOString();
                                console.log(
                                  `✓ Extracted date from article ID for "${title}": ${publishedAt}`
                                );
                              }
                            }
                          }
                        } catch (e) {
                          // Continue to next method
                        }
                      }
                    }
                  }

                  // Method 4: Use current time as fallback (least accurate)
                  if (!publishedAt) {
                    publishedAt = new Date().toISOString();
                    console.log(
                      `⚠ Using current time for "${title}" (no date found in URL)`
                    );
                  }

                  if (publishedAt && !processedUrls.has(googleNewsUrl)) {
                    processedUrls.add(googleNewsUrl);
                    articles.push({
                      id: `google-${listIndex}-${itemIndex}-${Date.now()}`,
                      title: title,
                      url: googleNewsUrl,
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

          if (titleMatch && linkMatch) {
            const title = decodeHtmlEntities(
              titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').trim()
            );
            const googleNewsUrl = linkMatch[1].trim();
            const description = descriptionMatch
              ? decodeHtmlEntities(
                  descriptionMatch[1]
                    .replace(/<!\[CDATA\[(.*?)\]\]>/, '$1')
                    .trim()
                )
              : '';

            // Extract source name from URL or title
            let sourceName = 'Google News';

            // Method 1: Look for source in the title (format: "Title - Source")
            const titleParts = title.split(' - ');
            if (titleParts.length > 1) {
              sourceName = titleParts[titleParts.length - 1].trim();
            } else {
              // Method 2: Extract domain from URL
              try {
                const urlObj = new URL(googleNewsUrl);
                const domain = urlObj.hostname.replace('www.', '');
                if (domain && domain !== 'news.google.com') {
                  // Clean up domain name for display
                  sourceName =
                    domain
                      .replace('.com', '')
                      .replace('.org', '')
                      .replace('.net', '')
                      .replace('.co.uk', '')
                      .replace('.io', '')
                      .split('.')
                      .pop() || domain;
                }
              } catch (e) {
                // If URL parsing fails, try to extract from the title
                const titleParts = title.split(' - ');
                if (titleParts.length > 1) {
                  sourceName = titleParts[titleParts.length - 1].trim();
                }
              }
            }

            // Only include articles from ABC News sources
            if (!processedUrls.has(googleNewsUrl)) {
              // Check if the source is ABC News or related
              const isABCSource =
                sourceName.toLowerCase().includes('abc') ||
                sourceName.toLowerCase().includes('abc news') ||
                googleNewsUrl.includes('abcnews.go.com') ||
                googleNewsUrl.includes('abc.com');

              if (isABCSource) {
                // Filter out headlines with "live" or "watch" words (and variations)
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
                  continue; // Skip this article
                }

                // Extract date from the Google News URL
                let publishedAt: string | null = null;

                // Method 1: Extract from Google News URL timestamp parameter (most accurate)
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

                // Method 2: Extract from Google News URL path patterns
                if (!publishedAt) {
                  const urlDateMatch =
                    googleNewsUrl.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//) ||
                    googleNewsUrl.match(/\/(\d{4})-(\d{1,2})-(\d{1,2})\//) ||
                    googleNewsUrl.match(/\/(\d{4})\.(\d{1,2})\.(\d{1,2})\//) ||
                    googleNewsUrl.match(/\/(\d{4})_(\d{1,2})_(\d{1,2})\//) ||
                    googleNewsUrl.match(/\/(\d{4})_(\d{1,2})_(\d{1,2})\./);

                  if (urlDateMatch) {
                    const [, year, month, day] = urlDateMatch;
                    const dateFromUrl = new Date(
                      parseInt(year),
                      parseInt(month) - 1,
                      parseInt(day)
                    );
                    if (!isNaN(dateFromUrl.getTime())) {
                      publishedAt = dateFromUrl.toISOString();
                      console.log(
                        `✓ Extracted date from URL for "${title}": ${publishedAt}`
                      );
                    }
                  }
                }

                // Method 3: Extract from Google News article ID (often contains timestamp)
                if (!publishedAt) {
                  const articleIdMatch = googleNewsUrl.match(
                    /\/articles\/([A-Za-z0-9]+)/
                  );
                  if (articleIdMatch) {
                    const articleId = articleIdMatch[1];
                    // Some Google News article IDs contain timestamps
                    if (articleId.length >= 8) {
                      try {
                        const possibleTimestamp = parseInt(
                          articleId.substring(0, 8)
                        );
                        if (
                          !isNaN(possibleTimestamp) &&
                          possibleTimestamp > 20200000
                        ) {
                          const year = Math.floor(possibleTimestamp / 10000);
                          const month = Math.floor(
                            (possibleTimestamp % 10000) / 100
                          );
                          const day = possibleTimestamp % 100;

                          if (
                            month >= 1 &&
                            month <= 12 &&
                            day >= 1 &&
                            day <= 31
                          ) {
                            const dateFromId = new Date(year, month - 1, day);
                            if (
                              !isNaN(dateFromId.getTime()) &&
                              dateFromId > new Date('2020-01-01')
                            ) {
                              publishedAt = dateFromId.toISOString();
                              console.log(
                                `✓ Extracted date from article ID for "${title}": ${publishedAt}`
                              );
                            }
                          }
                        }
                      } catch (e) {
                        // Continue to next method
                      }
                    }
                  }
                }

                // Method 4: Use current time as fallback for Google News articles
                if (!publishedAt) {
                  publishedAt = new Date().toISOString();
                  console.log(
                    `⚠ Using current time for "${title}" (Google News article)`
                  );
                }

                if (publishedAt) {
                  processedUrls.add(googleNewsUrl);
                  articles.push({
                    id: `rss-${index}-${Date.now()}`,
                    title: title,
                    url: googleNewsUrl,
                    publishedAt: publishedAt,
                    description: description,
                    content: description,
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
  articles.sort((a, b) => {
    const dateA = new Date(a.publishedAt);
    const dateB = new Date(b.publishedAt);
    return dateB.getTime() - dateA.getTime(); // Newest first
  });

  console.log(`Parsed ${articles.length} articles from Google News RSS feed`);
  if (articles.length > 0) {
    console.log('First 3 articles after parsing:');
    articles.slice(0, 3).forEach((article, index) => {
      console.log(`${index + 1}. "${article.title}" - ${article.publishedAt}`);
    });
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

  // Log dates before sorting for debugging
  console.log('Dates before sorting:');
  mergedArticles.slice(0, 5).forEach((article, index) => {
    console.log(`${index + 1}. "${article.title}" - ${article.publishedAt}`);
  });

  // Sort by publishedAt (newest first) to maintain chronological order
  mergedArticles.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  // Log dates after sorting for debugging
  console.log('Dates after sorting (newest first):');
  mergedArticles.slice(0, 5).forEach((article, index) => {
    console.log(`${index + 1}. "${article.title}" - ${article.publishedAt}`);
  });

  return mergedArticles;
}
