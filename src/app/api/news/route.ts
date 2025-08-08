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
      `https://gnews.io/api/v4/top-headlines?lang=en&country=us&max=100&apikey=${apiKey}`
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

    // No filtering for now - return all articles
    const filteredArticles = articles;

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
