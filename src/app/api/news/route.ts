import { NextResponse } from 'next/server';
import { NewsApiResponse, NewsArticle } from '@/types/news';
import { getCachedNews, setCachedNews, getAllCachedPages } from '@/lib/newsCache';

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
        console.log('Found cached pages, serving from cache instead of making API call');
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

    console.log(`Making GNews API request for page ${page} (API calls remaining: ~${100 - Math.floor(Date.now() / (24 * 60 * 60 * 1000))} today)`);

    const response = await fetch(
      `https://gnews.io/api/v4/top-headlines?category=general&lang=en&country=us&max=100&apikey=${apiKey}`
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
        'american idol'
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

    // Remove duplicate articles by URL
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
