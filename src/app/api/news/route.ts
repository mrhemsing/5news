import { NextResponse } from 'next/server';
import { NewsApiResponse, NewsArticle } from '@/types/news';
import {
  getCachedNews,
  setCachedNews,
  getAllCachedPages
} from '@/lib/newsCache';

// Helper function to calculate string similarity
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;
  
  // Simple similarity based on common words
  const words1 = str1.split(' ').filter(w => w.length > 2);
  const words2 = str2.split(' ').filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0.0;
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalWords = Math.max(words1.length, words2.length);
  
  return commonWords.length / totalWords;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const forceRefresh = searchParams.get('refresh') === 'true';

    const apiKey = process.env.GNEWS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GNews API key not configured' },
        { status: 500 }
      );
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Fetch from multiple non-sports categories to get more diverse content
    const categories = ['general', 'world', 'technology', 'science', 'health'];
    const category = categories[page % categories.length]; // Rotate through categories

    // Try to get cached news first (for any page, unless force refresh)
    if (!forceRefresh) {
      const cachedArticles = await getCachedNews(today, page, category);
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
      `Making GNews API request for page ${page} (category: ${category}) (API calls remaining: ~${
        100 - Math.floor(Date.now() / (24 * 60 * 60 * 1000))
      } today)`
    );

    const response = await fetch(
      `https://gnews.io/api/v4/top-headlines?category=${category}&lang=en&country=us&max=100&apikey=${apiKey}`
    );

    if (!response.ok) {
      if (response.status === 429) {
        console.error('News API rate limit exceeded');
        return NextResponse.json(
          {
            error: 'Rate limit exceeded. Please try again later.',
            articles: [],
            totalResults: 0,
            hasMore: false
          },
          { status: 429 }
        );
      }
      throw new Error(`News API error: ${response.status}`);
    }

    const data: NewsApiResponse = await response.json();

    // Debug: Log the response structure
    console.log('GNews API response:', {
      totalArticles: data.articles?.length || 0,
      responseKeys: Object.keys(data),
      sampleArticle: data.articles?.[0]
    });

    // GNews returns articles directly, not wrapped in a response object
    const articles = data.articles || data;

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

    // Enhanced deduplication - remove similar articles by title and content
    const uniqueArticles = filteredArticles.filter((article, index, self) => {
      // First, remove exact URL duplicates
      const urlDuplicate = self.findIndex(a => a.url === article.url);
      if (urlDuplicate < index) {
        console.log('Removing URL duplicate:', article.title);
        return false;
      }

      // Then, remove similar headlines (using title similarity)
      const currentTitle = article.title.toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();

      const similarTitle = self.findIndex(a => {
        if (a.url === article.url) return false; // Skip self
        const otherTitle = a.title.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Check if titles are very similar (90% similarity)
        const similarity = calculateSimilarity(currentTitle, otherTitle);
        return similarity > 0.9;
      });

      if (similarTitle < index) {
        console.log('Removing similar headline:', article.title);
        return false;
      }

      // Finally, remove articles with very similar content
      const currentContent = (article.content || article.description || '').toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const similarContent = self.findIndex(a => {
        if (a.url === article.url) return false; // Skip self
        const otherContent = (a.content || a.description || '').toLowerCase()
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Check if content is very similar (85% similarity)
        const similarity = calculateSimilarity(currentContent, otherContent);
        return similarity > 0.85;
      });

      if (similarContent < index) {
        console.log('Removing similar content:', article.title);
        return false;
      }

      return true;
    });

    // Additional deduplication: prefer certain sources over others for similar stories
    const preferredSources = [
      'reuters',
      'associated press',
      'bbc',
      'cnn',
      'nbc news',
      'abc news',
      'cbs news',
      'fox news',
      'usa today',
      'the washington post',
      'the new york times',
      'the wall street journal',
      'time',
      'newsweek'
    ];

    const finalArticles = uniqueArticles.filter((article, index, self) => {
      const currentTitle = article.title.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Check if there's a similar story from a preferred source
      const preferredDuplicate = self.findIndex(a => {
        if (a.url === article.url) return false;
        
        const otherTitle = a.title.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        const similarity = calculateSimilarity(currentTitle, otherTitle);
        if (similarity > 0.8) {
          // If we have a similar story, prefer the one from a preferred source
          const currentSource = (article.source?.name || '').toLowerCase();
          const otherSource = (a.source?.name || '').toLowerCase();
          
          const currentIsPreferred = preferredSources.some(source => 
            currentSource.includes(source)
          );
          const otherIsPreferred = preferredSources.some(source => 
            otherSource.includes(source)
          );
          
          // If the other article is from a preferred source and this one isn't, remove this one
          if (otherIsPreferred && !currentIsPreferred) {
            console.log(`Removing duplicate in favor of preferred source: ${article.title}`);
            return true;
          }
        }
        return false;
      });

      return preferredDuplicate === -1;
    });

    // Add unique IDs to articles
    const articlesWithIds: NewsArticle[] = finalArticles.map(
      (article, index) => ({
        ...article,
        id: `article-${index}-${Date.now()}`,
        title: article.title.replace(/\s*\([^)]*\)/g, '').trim() // Remove text in parentheses
      })
    );

    // Cache the results for the current page
    await setCachedNews(today, articlesWithIds, page, category);

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
