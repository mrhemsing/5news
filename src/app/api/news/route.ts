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

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Try to get cached news first (for any page, unless force refresh)
    if (!forceRefresh) {
      const cachedArticles = await getCachedNews(today, page);
      if (cachedArticles) {
        console.log(`Returning cached news data for page ${page}`);
        return NextResponse.json({
          articles: cachedArticles,
          totalResults: cachedArticles.length,
          hasMore: cachedArticles.length >= 20 // Assume there might be more if we got 20+ articles
        });
      }
    }

    // If we're requesting page 1 and don't have it cached, check if we have other pages
    // This helps when users refresh and we can serve from cache instead of making new API calls
    if (page === 1 && !forceRefresh) {
      const cachedPages = await getAllCachedPages(today);
      if (cachedPages.length > 0) {
        console.log(
          'Found cached pages, serving from cache instead of making API call'
        );
        // Return the first cached page we have
        const firstCachedPage = Math.min(...cachedPages);
        const cachedArticles = await getCachedNews(today, firstCachedPage);
        if (cachedArticles) {
          return NextResponse.json({
            articles: cachedArticles,
            totalResults: cachedArticles.length,
            hasMore: cachedPages.length > 1 || cachedArticles.length >= 20
          });
        }
      }
    }

    console.log(
      `Making Google News RSS request for page ${page} (API calls remaining: unlimited)`
    );

    // Use Google News RSS for high-quality, diverse content
    const response = await fetch(
      'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en'
    );

    if (!response.ok) {
      throw new Error(`Google News RSS error: ${response.status}`);
    }

    const rssText = await response.text();

    // Parse RSS XML to extract articles
    const articles = parseRSSFeed(rssText);

    console.log('Before filtering:', articles.length, 'articles');

    // Gentle filtering - only remove the most inappropriate content
    const filteredArticles = articles.filter(article => {
      const title = article.title.toLowerCase();
      const description = (article.description || '').toLowerCase();
      const content = (article.content || '').toLowerCase();

      // Skip single word headlines
      const cleanTitle = article.title.replace(/\s*\([^)]*\)/g, '').trim();
      if (cleanTitle.split(' ').length <= 1) {
        console.log('Filtered out single word:', article.title);
        return false;
      }

      // Skip articles from specific sources that are not kid-friendly
      const sourceName = (article.source?.name || '').toLowerCase();
      const articleUrl = (article.url || '').toLowerCase();

      if (
        sourceName.includes('breitbart') ||
        sourceName.includes('risbb.cc') ||
        sourceName.includes('cult of mac') ||
        sourceName.includes('bleeding cool') ||
        sourceName.includes('smbc-comics.com') ||
        sourceName.includes('sporting news') ||
        articleUrl.includes('breitbart.com') ||
        articleUrl.includes('risbb.cc') ||
        articleUrl.includes('cultofmac.com') ||
        articleUrl.includes('bleedingcool.com') ||
        articleUrl.includes('smbc-comics.com') ||
        articleUrl.includes('sportingnews.com')
      ) {
        console.log(
          'Filtered out source:',
          article.source?.name,
          'URL:',
          article.url
        );
        return false;
      }

      // Enhanced sports filtering - comprehensive list of sports-related keywords
      const sportsKeywords = [
        // Major sports leagues
        'nfl',
        'nba',
        'mlb',
        'nhl',
        'ncaa',
        'nascar',
        'f1',
        'formula 1',
        'premier league',
        'la liga',
        'bundesliga',
        'serie a',
        'champions league',

        // Sports terms
        'football',
        'basketball',
        'baseball',
        'hockey',
        'soccer',
        'tennis',
        'golf',
        'cricket',
        'rugby',
        'volleyball',
        'swimming',
        'track',
        'athletics',

        // Sports events and competitions
        'olympics',
        'world cup',
        'super bowl',
        'final four',
        'march madness',
        'playoffs',
        'championship',
        'tournament',
        'all-star',
        'draft',
        'playoff',
        'semifinal',
        'quarterfinal',
        'final',
        'championship game',

        // Sports positions and roles
        'quarterback',
        'point guard',
        'pitcher',
        'goalie',
        'striker',
        'midfielder',
        'defender',
        'coach',
        'manager',
        'player',
        'athlete',
        'team',

        // Sports actions and events
        'game',
        'match',
        'race',
        'competition',
        'tournament',
        'league',
        'season',
        'playoff',
        'draft pick',
        'free agent',
        'trade deadline',
        'injury report',
        'coach fired',
        'team owner',
        'stadium',
        'arena',
        'field',
        'court',
        'pitch',
        'track',
        'pool',

        // Sports statistics and terms
        'score',
        'win',
        'loss',
        'victory',
        'defeat',
        'tie',
        'draw',
        'points',
        'goals',
        'runs',
        'touchdown',
        'home run',
        'goal',
        'assist',
        'rebound',
        'steal',
        'block',
        'save',
        'hit',

        // Sports teams and organizations
        'team',
        'franchise',
        'club',
        'association',
        'federation',

        // Sports media and coverage
        'sports center',
        'espn',
        'sports news',
        'game recap',
        'post-game',
        'pre-game',
        'halftime',
        'overtime',
        'extra time',

        // Specific sports events
        'world series',
        'stanley cup',
        'nba finals',
        'super bowl',
        'world cup final',
        'olympic games',
        'paralympics',

        // Sports betting and fantasy
        'betting',
        'odds',
        'fantasy',
        'draft',
        'pick',
        'trade',

        // Sports injuries and health
        'injury',
        'concussion',
        'recovery',
        'rehab',
        'surgery',
        'medical',
        'health',
        'fitness',
        'training'
      ];

      // Check if any sports keywords are in the title, description, or content
      const hasSportsKeyword = sportsKeywords.some(
        keyword =>
          title.includes(keyword) ||
          description.includes(keyword) ||
          content.includes(keyword)
      );

      if (hasSportsKeyword) {
        console.log('Filtered out sports content:', article.title);
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

    // Add unique IDs to articles
    const articlesWithIds: NewsArticle[] = uniqueArticles.map(
      (article, index) => ({
        ...article,
        id: `article-${index}-${Date.now()}`,
        title: article.title.replace(/\s*\([^)]*\)/g, '').trim() // Remove text in parentheses
      })
    );

    // Cache the results for the current page
    await setCachedNews(today, articlesWithIds, page);

    // More flexible logic: if we got articles and haven't reached the total, there might be more
    const hasMore = articlesWithIds.length > 0 && articlesWithIds.length >= 20;

    return NextResponse.json({
      articles: articlesWithIds,
      totalResults: articlesWithIds.length,
      hasMore
    });
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
            const sourceMatch = item.match(/<font[^>]*>([^<]*)<\/font>/);

            if (linkMatch) {
              const url = linkMatch[1];
              const title = decodeHtmlEntities(linkMatch[2].trim());
              const sourceName = sourceMatch
                ? decodeHtmlEntities(sourceMatch[1].trim())
                : 'Google News';

              // Skip if title is empty, just whitespace, or URL already processed
              if (title && title.length > 0 && !processedUrls.has(url)) {
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
                    name: sourceName
                  }
                });
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

            // Skip if URL already processed
            if (!processedUrls.has(url)) {
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
                  name: 'Google News'
                }
              });
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
                  name: 'Google News'
                }
              });
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
