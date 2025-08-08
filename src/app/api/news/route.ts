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
    const testRSS = searchParams.get('test') === 'true'; // Add test parameter

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // If test mode, skip cache entirely
    if (testRSS) {
      console.log('TEST MODE: Bypassing cache to test RSS parsing');
    } else {
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

    // Debug: Log the RSS content structure
    console.log('RSS Response length:', rssText.length);
    console.log('RSS Response preview:', rssText.substring(0, 1000));

    // Parse RSS XML to extract articles
    const articles = parseRSSFeed(rssText);

    console.log('Parsed articles count:', articles.length);
    if (articles.length > 0) {
      console.log('First article sample:', articles[0]);
    } else {
      console.log('No articles parsed - RSS structure may be different');
    }

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

      // Only filter out very specific sports/finance content
      const verySpecificKeywords = [
        'nfl',
        'nba',
        'mlb',
        'nhl',
        'ncaa',
        'championship',
        'tournament',
        'playoff',
        'bitcoin',
        'crypto',
        'cryptocurrency',
        'ethereum',
        'nasdaq',
        'dow',
        's&p',
        'bachelor',
        'bachelorette',
        'survivor',
        'big brother',
        'american idol',
        // Enhanced sports filtering
        'football',
        'basketball',
        'baseball',
        'hockey',
        'soccer',
        'tennis',
        'golf',
        'olympics',
        'world cup',
        'super bowl',
        'final four',
        'march madness',
        'playoffs',
        'championship game',
        'all-star',
        'draft pick',
        'free agent',
        'trade deadline',
        'injury report',
        'coach fired',
        'team owner',
        'stadium',
        'arena'
      ];

      // Check if any very specific keywords are in the title, description, or content
      const hasExcludedKeyword = verySpecificKeywords.some(
        keyword =>
          title.includes(keyword) ||
          description.includes(keyword) ||
          content.includes(keyword)
      );

      if (hasExcludedKeyword) {
        console.log('Filtered out keyword match:', article.title);
        return false;
      }

      return true;
    });

    console.log('After filtering:', filteredArticles.length, 'articles');

    // Simple deduplication - remove exact URL duplicates only
    const uniqueArticles = filteredArticles.filter(
      (article, index, self) =>
        index === self.findIndex(a => a.url === article.url)
    );

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

// Function to parse Google News RSS feed
function parseRSSFeed(rssText: string): NewsArticle[] {
  const articles: NewsArticle[] = [];

  try {
    console.log('Starting RSS parsing...');

    // Method 1: Try parsing <ol> lists (Google News format)
    const listMatches = rssText.match(/<ol>([\s\S]*?)<\/ol>/g);
    console.log('Found list matches:', listMatches ? listMatches.length : 0);

    if (listMatches) {
      listMatches.forEach((list, listIndex) => {
        // Extract individual list items
        const itemMatches = list.match(/<li>([\s\S]*?)<\/li>/g);
        console.log(
          `List ${listIndex} has ${itemMatches ? itemMatches.length : 0} items`
        );

        if (itemMatches) {
          itemMatches.forEach((item, itemIndex) => {
            // Extract link and text from <a> tags
            const linkMatch = item.match(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/);
            const sourceMatch = item.match(/<font[^>]*>([^<]*)<\/font>/);

            if (linkMatch) {
              const url = linkMatch[1];
              const title = linkMatch[2].trim();
              const sourceName = sourceMatch
                ? sourceMatch[1].trim()
                : 'Google News';

              // Skip if title is empty or just whitespace
              if (title && title.length > 0) {
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
      console.log('Trying standard RSS <item> parsing...');
      const itemMatches = rssText.match(/<item>([\s\S]*?)<\/item>/g);
      console.log('Found item matches:', itemMatches ? itemMatches.length : 0);

      if (itemMatches) {
        itemMatches.forEach((item, index) => {
          const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
          const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
          const descriptionMatch = item.match(
            /<description>([\s\S]*?)<\/description>/
          );

          if (titleMatch && linkMatch) {
            const title = titleMatch[1]
              .replace(/<!\[CDATA\[(.*?)\]\]>/, '$1')
              .trim();
            const url = linkMatch[1].trim();
            const description = descriptionMatch
              ? descriptionMatch[1]
                  .replace(/<!\[CDATA\[(.*?)\]\]>/, '$1')
                  .trim()
              : '';

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
        });
      }
    }

    // Method 3: If still no articles, try simple link extraction
    if (articles.length === 0) {
      console.log('Trying simple link extraction...');
      const linkMatches = rssText.match(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g);
      console.log('Found link matches:', linkMatches ? linkMatches.length : 0);

      if (linkMatches) {
        linkMatches.forEach((link, index) => {
          const match = link.match(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/);
          if (match) {
            const url = match[1];
            const title = match[2].trim();

            // Only include news.google.com links
            if (url.includes('news.google.com') && title && title.length > 0) {
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

    console.log(`Parsed ${articles.length} articles from Google News RSS`);
  } catch (error) {
    console.error('Error parsing RSS feed:', error);
  }

  return articles;
}
