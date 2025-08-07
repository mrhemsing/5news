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
      `https://newsapi.org/v2/everything?q=news&language=en&sortBy=publishedAt&apiKey=${apiKey}&pageSize=20&excludeDomains=espn.com,bleacherreport.com,yahoo.com/sports,cnbc.com,bloomberg.com,marketwatch.com,reuters.com/business`
    );

    if (!response.ok) {
      throw new Error(`News API error: ${response.status}`);
    }

    const data: NewsApiResponse = await response.json();

    // Filter out sports and finance articles
    const filteredArticles = data.articles.filter(article => {
      const title = article.title.toLowerCase();
      const description = (article.description || '').toLowerCase();
      const content = (article.content || '').toLowerCase();

      // Skip single word headlines
      const cleanTitle = article.title.replace(/\s*\([^)]*\)/g, '').trim();
      if (cleanTitle.split(' ').length <= 1) {
        return false;
      }

      // Skip headlines containing specific words
      if (cleanTitle.toLowerCase().includes('rail')) {
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
        return false;
      }

      // Keywords to exclude
      const sportsKeywords = [
        'sport',
        'football',
        'basketball',
        'baseball',
        'soccer',
        'tennis',
        'golf',
        'hockey',
        'nfl',
        'nba',
        'mlb',
        'nhl',
        'ncaa',
        'championship',
        'tournament',
        'playoff',
        'coach',
        'player',
        'team',
        'game',
        'match',
        'score',
        'win',
        'loss',
        'victory',
        'league',
        'season',
        'draft',
        'trade',
        'contract',
        'salary',
        'transfer'
      ];

      const financeKeywords = [
        'stock',
        'market',
        'trading',
        'investment',
        'finance',
        'financial',
        'economy',
        'dollar',
        'euro',
        'currency',
        'bitcoin',
        'crypto',
        'cryptocurrency',
        'ethereum',
        'nasdaq',
        'dow',
        's&p',
        'federal reserve',
        'interest rate',
        'inflation',
        'earnings',
        'revenue',
        'profit',
        'loss',
        'quarterly',
        'annual',
        'dividend',
        'portfolio',
        'fund',
        'etf',
        'mutual fund',
        'hedge fund',
        'wall street'
      ];

      const tvShowKeywords = [
        'tv show',
        'television show',
        'reality show',
        'sitcom',
        'drama series',
        'netflix show',
        'hulu show',
        'amazon prime show',
        'disney+ show',
        'hbo show',
        'season finale',
        'series finale',
        'episode',
        'cast member',
        'tv star',
        'television star',
        'reality star',
        'celebrity',
        'actor',
        'actress',
        'host',
        'contestant',
        'eliminated',
        'voted off',
        'winner',
        'runner-up',
        'audition',
        'premiere',
        'ratings',
        'viewership',
        'nielsen',
        'bachelor',
        'bachelorette',
        'survivor',
        'big brother',
        'american idol',
        'the voice',
        'dancing with the stars',
        'masked singer',
        'talent show',
        'game show'
      ];

      const allKeywords = [
        ...sportsKeywords,
        ...financeKeywords,
        ...tvShowKeywords
      ];

      // Check if any keywords are in the title, description, or content
      return !allKeywords.some(
        keyword =>
          title.includes(keyword) ||
          description.includes(keyword) ||
          content.includes(keyword)
      );
    });

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

    // More flexible logic: if we got articles and haven't reached the total, there might be more
    const hasMore = articlesWithIds.length > 0 && page * 10 < data.totalResults;

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
