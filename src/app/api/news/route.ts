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
        `Making Google News RSS request for page ${page} (API calls remaining: unlimited)`
      );

      // Use Google News RSS with ABC News whitelist
      const rssUrls = [
        'https://news.google.com/rss/search?q=ABC+News&hl=en-US&gl=US&ceid=US:en'
      ];

      let mergedArticles: NewsArticle[] = [];

      for (const rssUrl of rssUrls) {
        try {
          console.log(`Fetching from: ${rssUrl}`);
          const response = await fetch(rssUrl);

          if (!response.ok) {
            console.log(`Failed to fetch from ${rssUrl}: ${response.status}`);
            continue;
          }

          const rssText = await response.text();
          console.log(`RSS text length: ${rssText.length} characters`);

          const articles = parseRSSFeed(rssText);
          console.log(`Got ${articles.length} articles from ${rssUrl}`);

          // Merge articles from this source
          mergedArticles = mergeArticles(mergedArticles, articles);
        } catch (error) {
          console.error(`Error fetching from ${rssUrl}:`, error);
        }
      }

      console.log(
        'Total articles after merging all sources:',
        mergedArticles.length
      );

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

      // Return all articles - let frontend handle pagination
      return NextResponse.json({
        articles: allArticles,
        totalResults: allArticles.length,
        hasMore: false // Google News RSS doesn't support pagination
      });
    } else {
      // Return existing cached articles
      return NextResponse.json({
        articles: existingArticles,
        totalResults: existingArticles.length,
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
function parseRSSFeed(rssText: string): NewsArticle[] {
  const articles: NewsArticle[] = [];
  const processedUrls = new Set<string>(); // Track processed URLs to avoid duplicates

  try {
    // Method 1: Try parsing <ol> lists (Google News format)
    const listMatches = rssText.match(/<ol>([\s\S]*?)<\/ol>/g);

    if (listMatches) {
      listMatches.forEach((list, listIndex) => {
        // Extract individual list items
        const itemMatches = list.match(/<li>([\s\S]*?)<\/li>/g);

        if (itemMatches) {
          itemMatches.forEach((item, itemIndex) => {
            // Extract link and text from <a> tags
            const linkMatch = item.match(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/);

            if (linkMatch) {
              const url = linkMatch[1];
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
                    const urlObj = new URL(url);
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
              if (title && title.length > 0 && !processedUrls.has(url)) {
                // Check if the source is ABC News or related
                const isABCSource = sourceName.toLowerCase().includes('abc') || 
                                   sourceName.toLowerCase().includes('abc news') ||
                                   url.includes('abcnews.go.com') ||
                                   url.includes('abc.com');
                
                if (isABCSource) {
                  processedUrls.add(url);
                  articles.push({
                    id: `google-${listIndex}-${itemIndex}-${Date.now()}`,
                    title: title,
                    url: url,
                    publishedAt: new Date().toISOString(),
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
          });
        }
      });
    }

    // Method 2: If no articles found, try standard RSS <item> parsing
    if (articles.length === 0) {
      const itemMatches = rssText.match(/<item>([\s\S]*?)<\/item>/g);

      if (itemMatches) {
        itemMatches.forEach((item, index) => {
          const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
          const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
          const descriptionMatch = item.match(
            /<description>([\s\S]*?)<\/description>/
          );

          if (titleMatch && linkMatch) {
            const title = decodeHtmlEntities(
              titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').trim()
            );
            const url = linkMatch[1].trim();
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
                const urlObj = new URL(url);
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
            if (!processedUrls.has(url)) {
              // Check if the source is ABC News or related
              const isABCSource = sourceName.toLowerCase().includes('abc') || 
                                 sourceName.toLowerCase().includes('abc news') ||
                                 url.includes('abcnews.go.com') ||
                                 url.includes('abc.com');
              
              if (isABCSource) {
                processedUrls.add(url);
                articles.push({
                  id: `rss-${index}-${Date.now()}`,
                  title: title,
                  url: url,
                  publishedAt: new Date().toISOString(),
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
        });
      }
    }

    // Method 3: If still no articles, try simple link extraction
    if (articles.length === 0) {
      const linkMatches = rssText.match(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g);

      if (linkMatches) {
        linkMatches.forEach((link, index) => {
          const match = link.match(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/);
          if (match) {
            const url = match[1];
            const title = decodeHtmlEntities(match[2].trim());

            // Only include news.google.com links and skip if already processed
            if (
              url.includes('news.google.com') &&
              title &&
              title.length > 0 &&
              !processedUrls.has(url)
            ) {
              // Extract source name from URL or title
              let sourceName = 'Google News';

              // Method 1: Look for source in the title (format: "Title - Source")
              const titleParts = title.split(' - ');
              if (titleParts.length > 1) {
                sourceName = titleParts[titleParts.length - 1].trim();
              } else {
                // Method 2: Extract domain from URL
                try {
                  const urlObj = new URL(url);
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
              const isABCSource = sourceName.toLowerCase().includes('abc') || 
                                 sourceName.toLowerCase().includes('abc news') ||
                                 url.includes('abcnews.go.com') ||
                                 url.includes('abc.com');
              
              if (isABCSource) {
                processedUrls.add(url);
                articles.push({
                  id: `link-${index}-${Date.now()}`,
                  title: title,
                  url: url,
                  publishedAt: new Date().toISOString(),
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
        });
      }
    }
  } catch (error) {
    console.error('Error parsing RSS feed:', error);
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
    const articleDate = new Date(article.publishedAt);
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
