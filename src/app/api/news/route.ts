import { NextResponse } from 'next/server';
import { NewsApiResponse, NewsArticle } from '@/types/news';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');

    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'News API key not configured' },
        { status: 500 }
      );
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    const response = await fetch(
      `https://newsapi.org/v2/everything?q=news&language=en&sortBy=publishedAt&apiKey=${apiKey}&pageSize=10&page=${page}`
    );

    if (!response.ok) {
      throw new Error(`News API error: ${response.status}`);
    }

    const data: NewsApiResponse = await response.json();

    // Add unique IDs to articles
    const articlesWithIds: NewsArticle[] = data.articles.map(
      (article, index) => ({
        ...article,
        id: `article-${index}-${Date.now()}`
      })
    );

    // More flexible logic: if we got articles and haven't reached the total, there might be more
    const hasMore = data.articles.length > 0 && page * 10 < data.totalResults;

    return NextResponse.json({
      articles: articlesWithIds,
      totalResults: data.totalResults,
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
