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
        `Making Google News RSS request for page ${page} (stealth mode)`
      );

      // Add natural initial delay (simulate human opening browser)
      const initialDelay = 1000 + Math.random() * 2000; // 1-3 seconds
      console.log(
        `Initial delay: ${Math.round(initialDelay / 1000)} seconds...`
      );
      await new Promise(resolve => setTimeout(resolve, initialDelay));

      // Focused Google News RSS strategy with enhanced date extraction
      let mergedArticles: NewsArticle[] = [];

      const rssUrls = [
        'https://news.google.com/rss/search?q=ABC+News&hl=en-US&gl=US&ceid=US:en&num=20',
        'https://news.google.com/rss/search?q=ABC+News&hl=en&gl=US&ceid=US:en&num=20',
        'https://news.google.com/rss/search?q=ABC+News&hl=en-US&gl=US&num=20',
        'https://news.google.com/rss/search?q=ABC+News&hl=en&gl=US&num=20'
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

        let retries = 2;
        while (retries > 0 && !googleNewsSuccess) {
          try {
            const userAgent =
              userAgents[Math.floor(Math.random() * userAgents.length)];
            console.log(
              `Trying Google News RSS: ${rssUrl} (attempt ${3 - retries}/2)`
            );

            // Add natural delay before request (simulate human thinking)
            if (retries < 2) {
              const naturalDelay = 2000 + Math.random() * 3000; // 2-5 seconds
              console.log(
                `Natural delay: ${Math.round(naturalDelay / 1000)} seconds...`
              );
              await new Promise(resolve => setTimeout(resolve, naturalDelay));
            }

            // Enhanced headers to mimic real browser behavior with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

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
                break; // Try next URL variation
              } else {
                console.log(
                  `Failed: ${response.status} ${response.statusText}`
                );
                retries--;
                if (retries > 0) {
                  await new Promise(resolve => setTimeout(resolve, 3000));
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
          const naturalDelay = 8000 + Math.random() * 4000; // 8-12 seconds
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

      // Filter out articles with malformed URLs before caching and returning
      const validArticles = allArticles.filter(article => {
        // Check if URL is a malformed Google News article ID (extremely long)
        if (article.url.includes('/articles/') && article.url.length > 200) {
          console.log(
            `Filtered out article with malformed URL: "${article.title}"`
          );
          console.log(
            `URL length: ${article.url.length}, URL: ${article.url.substring(
              0,
              100
            )}...`
          );
          return false;
        }

        // Check if URL is a Google News redirect that we couldn't resolve
        if (
          article.url.includes('news.google.com') &&
          !article.url.includes('abcnews.go.com')
        ) {
          console.log(
            `Filtered out article with unresolved Google News URL: "${article.title}"`
          );
          return false;
        }

        return true;
      });

      console.log(
        `Filtered out ${
          allArticles.length - validArticles.length
        } articles with malformed URLs`
      );

      // Cache the filtered results
      await setCachedNews(validArticles, page);

      // Log the order of articles being returned
      console.log('Returning fresh articles - order verification:');
      validArticles.slice(0, 5).forEach((article, index) => {
        console.log(
          `${index + 1}. "${article.title}" - ${article.publishedAt}`
        );
      });

      // Return filtered articles - let frontend handle pagination
      return NextResponse.json({
        articles: validArticles,
        totalResults: validArticles.length,
        hasMore: false // Google News RSS doesn't support pagination
      });
    } else {
      // Return existing cached articles - ensure they're properly sorted and filtered
      const sortedCachedArticles = [...existingArticles].sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );

      // Apply the same URL filtering to cached articles
      const validCachedArticles = sortedCachedArticles.filter(article => {
        // Check if URL is a malformed Google News article ID (extremely long)
        if (article.url.includes('/articles/') && article.url.length > 200) {
          console.log(
            `Filtered out cached article with malformed URL: "${article.title}"`
          );
          return false;
        }

        // Check if URL is a Google News redirect that we couldn't resolve
        if (
          article.url.includes('news.google.com') &&
          !article.url.includes('abcnews.go.com')
        ) {
          console.log(
            `Filtered out cached article with unresolved Google News URL: "${article.title}"`
          );
          return false;
        }

        return true;
      });

      console.log(
        `Filtered out ${
          sortedCachedArticles.length - validCachedArticles.length
        } cached articles with malformed URLs`
      );

      console.log('Returning cached articles - ensuring proper sorting');
      console.log('First 3 cached articles:');
      validCachedArticles.slice(0, 3).forEach((article, index) => {
        console.log(
          `${index + 1}. "${article.title}" - ${article.publishedAt}`
        );
      });

      return NextResponse.json({
        articles: validCachedArticles,
        totalResults: validCachedArticles.length,
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

// Function to extract real ABC News URL from Google News article page
async function extractRealUrlFromGoogleNews(
  googleNewsUrl: string
): Promise<string> {
  try {
    console.log(`🔍 Starting URL extraction for: ${googleNewsUrl}`);

    // Use a realistic User-Agent
    const userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    console.log(
      `📡 Fetching Google News article page with User-Agent: ${userAgent.substring(
        0,
        50
      )}...`
    );

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const response = await fetch(googleNewsUrl, {
        headers: {
          'User-Agent': userAgent,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log(
        `📊 Response status: ${response.status} ${response.statusText}`
      );

      if (!response.ok) {
        console.log(
          `❌ Failed to fetch Google News article: ${response.status}`
        );
        if (response.status === 503) {
          console.log(`🚫 503 error - likely IP blocked by Google`);
        }
        return googleNewsUrl; // Return original URL if fetch fails
      }

      const html = await response.text();
      console.log(
        `✅ Successfully fetched Google News article, length: ${html.length} characters`
      );

      // Look for ABC News URLs in the HTML content with multiple patterns
      const abcUrlPatterns = [
        // Direct ABC News URLs
        /https:\/\/abcnews\.go\.com\/[^\s"']+/g,
        /https:\/\/abc\.com\/[^\s"']+/g,
        // URLs in href attributes
        /href="([^"]*abcnews\.go\.com[^"]*)"/g,
        /href="([^"]*abc\.com[^"]*)"/g,
        // URLs in data attributes
        /data-url="([^"]*abcnews\.go\.com[^"]*)"/g,
        /data-url="([^"]*abc\.com[^"]*)"/g,
        // URLs in onclick attributes
        /onclick="[^"]*['"]([^'"]*abcnews\.go\.com[^'"]*)['"][^"]*"/g,
        /onclick="[^"]*['"]([^'"]*abc\.com[^'"]*)['"][^"]*"/g
      ];

      console.log(
        `🔍 Searching for ABC News URLs using ${abcUrlPatterns.length} patterns...`
      );

      for (let i = 0; i < abcUrlPatterns.length; i++) {
        const pattern = abcUrlPatterns[i];
        console.log(`🔍 Pattern ${i + 1}: ${pattern.source}`);

        const matches = html.match(pattern);
        if (matches && matches.length > 0) {
          console.log(
            `🎯 Found ${matches.length} matches with pattern ${i + 1}`
          );

          for (let j = 0; j < matches.length; j++) {
            const match = matches[j];
            console.log(`  Match ${j + 1}: ${match.substring(0, 100)}...`);

            let realUrl = match;

            // Clean up the URL if it's in an attribute
            if (realUrl.includes('href="')) {
              realUrl = realUrl.replace(/href="([^"]*)"/, '$1');
              console.log(`  Cleaned href attribute: ${realUrl}`);
            } else if (realUrl.includes('data-url="')) {
              realUrl = realUrl.replace(/data-url="([^"]*)"/, '$1');
              console.log(`  Cleaned data-url attribute: ${realUrl}`);
            } else if (realUrl.includes('onclick=')) {
              realUrl = realUrl.replace(
                /onclick="[^"]*['"]([^'"]*)['"][^"]*"/,
                '$1'
              );
              console.log(`  Cleaned onclick attribute: ${realUrl}`);
            }

            // Validate the URL
            if (
              realUrl.includes('abcnews.go.com') ||
              realUrl.includes('abc.com')
            ) {
              // Clean up any remaining HTML entities or fragments
              realUrl = realUrl.split('#')[0].split('?')[0]; // Remove fragments and query params
              realUrl = decodeHtmlEntities(realUrl);

              console.log(
                `✅ Successfully extracted real ABC News URL: ${realUrl}`
              );
              return realUrl;
            } else {
              console.log(
                `⚠️  URL doesn't contain ABC News domain: ${realUrl}`
              );
            }
          }
        } else {
          console.log(`❌ No matches found with pattern ${i + 1}`);
        }
      }

      // If no ABC News URL found, look for any external news URL
      const externalUrlPattern = /href="(https:\/\/[^"]*\.com\/[^"]*)"/g;
      const externalMatches = html.match(externalUrlPattern);
      if (externalMatches && externalMatches.length > 0) {
        const externalUrl = externalMatches[0].replace(/href="([^"]*)"/, '$1');
        console.log(`⚠️  Found external URL (not ABC): ${externalUrl}`);
      }

      console.log(`❌ No real ABC News URL found in Google News article`);
      console.log(
        `🔍 HTML preview (first 500 chars): ${html.substring(0, 500)}...`
      );

      // Fallback: Don't construct malformed URLs from Google News article IDs
      // Instead, return the original Google News URL and let the calling function handle it
      console.log(
        `⚠️  No real ABC News URL found, returning original Google News URL`
      );
      return googleNewsUrl;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error(`💥 Error during fetch:`, fetchError);
      return googleNewsUrl; // Return original URL on fetch error
    }
  } catch (error) {
    console.error(`💥 Error fetching Google News article:`, error);
    return googleNewsUrl; // Return original URL on error
  }
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

              // Extract the actual ABC News URL from Google News redirect
              let directUrl = googleNewsUrl;

              // Method 1: Look for URL parameter that contains the actual article URL
              const urlParamMatch = googleNewsUrl.match(/[?&]url=([^&]+)/);
              if (urlParamMatch) {
                try {
                  const decodedUrl = decodeURIComponent(urlParamMatch[1]);
                  if (
                    decodedUrl.includes('abcnews.go.com') ||
                    decodedUrl.includes('abc.com')
                  ) {
                    directUrl = decodedUrl;
                    console.log(
                      `✓ Extracted direct ABC News URL: ${directUrl}`
                    );
                  }
                } catch (e) {
                  // If decoding fails, keep the original URL
                }
              }

              // Method 2: Look for the actual article URL in the Google News URL path
              // Note: Google News article IDs are not real ABC News paths, so we skip this method
              // to avoid creating malformed URLs

              // Method 3: Look for redirect URLs in other parameters
              if (directUrl === googleNewsUrl) {
                const redirectMatch =
                  googleNewsUrl.match(/[?&]redirect=([^&]+)/);
                if (redirectMatch) {
                  try {
                    const decodedUrl = decodeURIComponent(redirectMatch[1]);
                    if (
                      decodedUrl.includes('abcnews.go.com') ||
                      decodedUrl.includes('abc.com')
                    ) {
                      directUrl = decodedUrl;
                      console.log(
                        `✓ Extracted direct ABC News URL from redirect param: ${directUrl}`
                      );
                    }
                  } catch (e) {
                    // If decoding fails, keep the original URL
                  }
                }
              }

              // Method 4: Look for article URLs in other common patterns
              if (directUrl === googleNewsUrl) {
                const articleMatch = googleNewsUrl.match(/[?&]article=([^&]+)/);
                if (articleMatch) {
                  try {
                    const decodedUrl = decodeURIComponent(articleMatch[1]);
                    if (
                      decodedUrl.includes('abcnews.go.com') ||
                      decodedUrl.includes('abc.com')
                    ) {
                      directUrl = decodedUrl;
                      console.log(
                        `✓ Extracted direct ABC News URL from article param: ${directUrl}`
                      );
                    }
                  } catch (e) {
                    // If decoding fails, keep the original URL
                  }
                }
              }

              // Method 5: Handle Google News article ID format by fetching the real article page
              if (
                directUrl === googleNewsUrl &&
                googleNewsUrl.includes('/articles/')
              ) {
                console.log(
                  `🔍 Found Google News article ID format, attempting to extract real URL...`
                );
                console.log(`📝 Original Google News URL: ${googleNewsUrl}`);

                try {
                  // Fetch the actual Google News article page to extract the real ABC News URL
                  // Add timeout to prevent hanging
                  console.log(
                    `🚀 Calling extractRealUrlFromGoogleNews with timeout...`
                  );

                  const timeoutPromise = new Promise<string>((_, reject) => {
                    setTimeout(
                      () => reject(new Error('URL extraction timeout')),
                      10000
                    ); // 10 second timeout
                  });

                  const realUrlPromise =
                    extractRealUrlFromGoogleNews(googleNewsUrl);

                  const realUrl = await Promise.race([
                    realUrlPromise,
                    timeoutPromise
                  ]);

                  console.log(`📊 Real URL extraction result: ${realUrl}`);

                  if (realUrl !== googleNewsUrl) {
                    directUrl = realUrl;
                    console.log(
                      `✅ Successfully extracted real URL: ${directUrl}`
                    );
                  } else {
                    console.log(
                      `⚠️  Could not extract real URL, keeping Google News URL`
                    );
                  }
                } catch (error) {
                  console.error(`💥 Error during real URL extraction:`, error);
                  console.log(`⚠️  Error occurred, keeping Google News URL`);
                  // Don't try to extract real URLs for this article to prevent further hanging
                  directUrl = googleNewsUrl;
                }
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
                !processedUrls.has(directUrl) // Check against direct URL for deduplication
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

                  if (publishedAt && !processedUrls.has(directUrl)) {
                    processedUrls.add(directUrl); // Track direct URLs instead of Google News URLs

                    // Debug: Log the URLs being used
                    console.log(`=== Article Creation Debug ===`);
                    console.log(`Title: "${title}"`);
                    console.log(`Original Google News URL: ${googleNewsUrl}`);
                    console.log(`Final direct URL: ${directUrl}`);
                    console.log(
                      `URLs are different: ${googleNewsUrl !== directUrl}`
                    );
                    console.log(`===============================`);

                    articles.push({
                      id: `google-${listIndex}-${itemIndex}-${Date.now()}`,
                      title: title,
                      url: directUrl, // Use direct ABC News URL instead of Google News redirect
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

            // Extract the actual ABC News URL from Google News redirect (same logic as above)
            let directUrl = googleNewsUrl;

            // Method 1: Look for URL parameter that contains the actual article URL
            const urlParamMatch = googleNewsUrl.match(/[?&]url=([^&]+)/);
            if (urlParamMatch) {
              try {
                const decodedUrl = decodeURIComponent(urlParamMatch[1]);
                if (
                  decodedUrl.includes('abcnews.go.com') ||
                  decodedUrl.includes('abc.com')
                ) {
                  directUrl = decodedUrl;
                  console.log(
                    `✓ Extracted direct ABC News URL (RSS): ${directUrl}`
                  );
                }
              } catch (e) {
                // If decoding fails, keep the original URL
              }
            }

            // Method 2: Look for the actual article URL in the Google News URL path
            // Note: Google News article IDs are not real ABC News paths, so we skip this method
            // to avoid creating malformed URLs

            // Method 3: Look for redirect URLs in other parameters
            if (directUrl === googleNewsUrl) {
              const redirectMatch = googleNewsUrl.match(/[?&]redirect=([^&]+)/);
              if (redirectMatch) {
                try {
                  const decodedUrl = decodeURIComponent(redirectMatch[1]);
                  if (
                    decodedUrl.includes('abcnews.go.com') ||
                    decodedUrl.includes('abc.com')
                  ) {
                    directUrl = decodedUrl;
                    console.log(
                      `✓ Extracted direct ABC News URL from redirect param (RSS): ${directUrl}`
                    );
                  }
                } catch (e) {
                  // If decoding fails, keep the original URL
                }
              }
            }

            // Method 4: Look for article URLs in other common patterns
            if (directUrl === googleNewsUrl) {
              const articleMatch = googleNewsUrl.match(/[?&]article=([^&]+)/);
              if (articleMatch) {
                try {
                  const decodedUrl = decodeURIComponent(articleMatch[1]);
                  if (
                    decodedUrl.includes('abcnews.go.com') ||
                    decodedUrl.includes('abc.com')
                  ) {
                    directUrl = decodedUrl;
                    console.log(
                      `✓ Extracted direct ABC News URL from article param (RSS): ${directUrl}`
                    );
                  }
                } catch (e) {
                  // If decoding fails, keep the original URL
                }
              }
            }

            // Method 5: Handle Google News article ID format (like CBMiowFBVV95cUxQT1VZNXJXaE9YZFp2c1VVMjFhTlY4allIMHV0cnhNVnlOZHdMNG1PcHNtQUxBVDdla0tlenpwUmRxVlczdzRxNm5uYXRIWkdDcXI5TzJxNi1NRkNaZFEwNVI3TlpVN3dudnpLV2w5eTU0aWhGbkZYWk5jeG41TGNLR2tVaEMwMXY5RTBBaERTVzNpN2VlSjM4b2NzUnB4bHlLZ0JZ0gGoAUFVX3lxTE9QdlFwYWNBS0xsclZwd0N5dWszOHktRENvRlJuYzY1cnFUQ0lUODgySGpFWFozYlVadXhzWnJEc3RiUW5MSUR5RG5FZUE3TEFxbXRiNE5qbzhmS2lkMTFPN2pNVE8zV2FfQTdva0JxcUwzbW15NnZ0d2VVVWdQbmhzT2lTTUt1a25qY1Y5ZGo0OGdEM2FFZVdPZjM5X1BITlpqQXVGd2F4NA)
            if (
              directUrl === googleNewsUrl &&
              googleNewsUrl.includes('/articles/')
            ) {
              // Extract the article ID from the URL
              const articleIdMatch = googleNewsUrl.match(/\/articles\/([^?]+)/);
              if (articleIdMatch) {
                const articleId = articleIdMatch[1];
                console.log(
                  `🔍 Found Google News article ID (RSS): ${articleId}`
                );

                console.log(
                  `🚀 Found Google News article ID (RSS): ${articleId}, attempting to extract real URL...`
                );

                // Fetch the actual Google News article page to extract the real ABC News URL
                console.log(
                  `📡 Calling extractRealUrlFromGoogleNews for RSS article...`
                );
                const realUrl = await extractRealUrlFromGoogleNews(
                  googleNewsUrl
                );
                if (realUrl !== googleNewsUrl) {
                  directUrl = realUrl;
                  console.log(
                    `✅ Successfully extracted real URL (RSS): ${directUrl}`
                  );
                } else {
                  console.log(
                    `⚠️  Could not extract real URL (RSS), keeping Google News URL`
                  );
                }
              }
            }

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
            if (!processedUrls.has(directUrl)) {
              // Check against direct URL for deduplication
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
                  processedUrls.add(directUrl); // Track direct URLs instead of Google News URLs

                  // Debug: Log the URLs being used
                  console.log(`=== Article Creation Debug (RSS) ===`);
                  console.log(`Title: "${title}"`);
                  console.log(`Original Google News URL: ${googleNewsUrl}`);
                  console.log(`Final direct URL: ${directUrl}`);
                  console.log(
                    `URLs are different: ${googleNewsUrl !== directUrl}`
                  );
                  console.log(`=====================================`);

                  articles.push({
                    id: `rss-${index}-${Date.now()}`,
                    title: title,
                    url: directUrl, // Use direct ABC News URL instead of Google News redirect
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
