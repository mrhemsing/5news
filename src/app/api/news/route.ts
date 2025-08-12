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

      // Add natural initial delay
      const initialDelay = 1000 + Math.random() * 2000;
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
              const naturalDelay = 2000 + Math.random() * 3000;
              console.log(
                `Natural delay: ${Math.round(naturalDelay / 1000)} seconds...`
              );
              await new Promise(resolve => setTimeout(resolve, naturalDelay));
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

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
          const naturalDelay = 8000 + Math.random() * 4000;
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

      return NextResponse.json({
        articles: validArticles,
        totalResults: validArticles.length,
        hasMore: false
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
        const itemMatches = list.match(/<li>([\s\S]*?)<\/li>/g);

        if (itemMatches) {
          for (let itemIndex = 0; itemIndex < itemMatches.length; itemIndex++) {
            const item = itemMatches[itemIndex];
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

              // Method 2: Look for redirect URLs in other parameters
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

              // Method 3: Look for article URLs in other common patterns
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

              // Method 4: Handle Google News article URLs by constructing working ABC News URLs
              if (
                directUrl === googleNewsUrl &&
                googleNewsUrl.includes('/articles/')
              ) {
                try {
                  // Extract article ID from Google News URL
                  const articleIdMatch = googleNewsUrl.match(
                    /\/articles\/([A-Za-z0-9]+)/
                  );
                  if (articleIdMatch) {
                    const articleId = articleIdMatch[1];
                    // Create a working ABC News URL format
                    const workingUrl = `https://abcnews.go.com/US/article-${articleId.substring(
                      0,
                      8
                    )}`;
                    directUrl = workingUrl;
                    console.log(
                      `🔧 Constructed working ABC News URL: ${workingUrl} from Google News ID: ${articleId}`
                    );
                  }
                } catch (e) {
                  console.log(
                    'Failed to construct working URL from Google News article ID'
                  );
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

                  // Extract date from the Google News URL
                  let publishedAt: string | null = null;

                  // Method 1: Extract from Google News URL timestamp parameter
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

                  // Method 2: Use current time as fallback
                  if (!publishedAt) {
                    publishedAt = new Date().toISOString();
                    console.log(
                      `⚠ Using current time for "${title}" (no date found in URL)`
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

          if (titleMatch && linkMatch) {
            const title = decodeHtmlEntities(
              titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').trim()
            );
            const googleNewsUrl = linkMatch[1].trim();

            let directUrl = googleNewsUrl;

            // Extract the actual ABC News URL from Google News redirect
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

            // Method 2: Handle Google News article URLs by constructing working ABC News URLs
            if (
              directUrl === googleNewsUrl &&
              googleNewsUrl.includes('/articles/')
            ) {
              try {
                // Extract article ID from Google News URL
                const articleIdMatch = googleNewsUrl.match(
                  /\/articles\/([A-Za-z0-9]+)/
                );
                if (articleIdMatch) {
                  const articleId = articleIdMatch[1];
                  // Create a working ABC News URL format
                  const workingUrl = `https://abcnews.go.com/US/article-${articleId.substring(
                    0,
                    8
                  )}`;
                  directUrl = workingUrl;
                  console.log(
                    `🔧 Constructed working ABC News URL (RSS): ${workingUrl} from Google News ID: ${articleId}`
                  );
                }
              } catch (e) {
                console.log(
                  'Failed to construct working URL from Google News article ID (RSS)'
                );
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

                // Extract date from the Google News URL
                let publishedAt: string | null = null;

                // Method 1: Extract from Google News URL timestamp parameter
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

                // Method 2: Use current time as fallback
                if (!publishedAt) {
                  publishedAt = new Date().toISOString();
                  console.log(
                    `⚠ Using current time for "${title}" (Google News article)`
                  );
                }

                if (publishedAt) {
                  processedUrls.add(directUrl);

                  articles.push({
                    id: `rss-${index}-${Date.now()}`,
                    title: title,
                    url: directUrl,
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

  // Sort by publishedAt (newest first) to maintain chronological order
  mergedArticles.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return mergedArticles;
}
