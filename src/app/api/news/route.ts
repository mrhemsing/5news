import { NextResponse } from 'next/server';
import { NewsApiResponse, NewsArticle } from '@/types/news';
import { getCachedNews, setCachedNews } from '@/lib/newsCache';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');

    const apiKey = process.env.GNEWS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GNews API key not configured' },
        { status: 500 }
      );
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Try to get cached news first (only for page 1)
    if (page === 1) {
      const cachedArticles = await getCachedNews(today);
      if (cachedArticles) {
        console.log('Returning cached news data');
        return NextResponse.json({
          articles: cachedArticles,
          totalResults: cachedArticles.length,
          hasMore: false
        });
      }
    }

    const response = await fetch(
      `https://gnews.io/api/v4/search?q=news&lang=en&country=us&max=100&apikey=${apiKey}`
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

    // Filter out sports and finance articles
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

      // Skip headlines containing specific words
      if (cleanTitle.toLowerCase().includes('rail')) {
        console.log('Filtered out RAIL:', article.title);
        return false;
      }

      // Skip articles from specific sources
      const sourceName = (article.source?.name || '').toLowerCase();
      const articleUrl = (article.url || '').toLowerCase();

      // Check both source name and URL for the domains we want to filter
      if (
        sourceName.includes('risbb.cc') ||
        sourceName.includes('cult of mac') ||
        sourceName.includes('bleeding cool') ||
        sourceName.includes('smbc-comics.com') ||
        sourceName.includes('sporting news') ||
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

      // Keywords to exclude - make this less aggressive
      const sportsKeywords = [
        'nfl', 'nba', 'mlb', 'nhl', 'ncaa', 'championship', 'tournament', 'playoff',
        'coach', 'player', 'team', 'game', 'match', 'score', 'win', 'loss', 'victory',
        'league', 'season', 'draft', 'trade', 'contract', 'salary', 'transfer'
      ];

      const financeKeywords = [
        'stock market', 'trading', 'investment', 'bitcoin', 'crypto', 'cryptocurrency',
        'ethereum', 'nasdaq', 'dow', 's&p', 'federal reserve', 'interest rate',
        'earnings', 'revenue', 'profit', 'quarterly', 'annual', 'dividend',
        'portfolio', 'fund', 'etf', 'mutual fund', 'hedge fund', 'wall street'
      ];

      const tvShowKeywords = [
        'bachelor', 'bachelorette', 'survivor', 'big brother', 'american idol',
        'the voice', 'dancing with the stars', 'masked singer', 'talent show', 'game show'
      ];

      const allKeywords = [
        ...sportsKeywords,
        ...financeKeywords,
        ...tvShowKeywords
      ];

      // Check if any keywords are in the title, description, or content
      const hasExcludedKeyword = allKeywords.some(
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

    // Cache the results for page 1
    if (page === 1) {
      await setCachedNews(today, articlesWithIds);
    }

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
