import { NextResponse } from 'next/server';
import { NewsApiResponse, NewsArticle } from '@/types/news';

export async function GET() {
  try {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'News API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}&pageSize=10`
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

    return NextResponse.json({
      articles: articlesWithIds,
      totalResults: data.totalResults
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
}
