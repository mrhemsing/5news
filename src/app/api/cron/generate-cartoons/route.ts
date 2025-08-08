import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    console.log('Cron job triggered: Generating cartoons...');

    // Get latest headlines by calling the news API
    const apiKey = process.env.GNEWS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GNews API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://gnews.io/api/v4/search?q=news&lang=en&country=us&max=30&apikey=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`GNews API error: ${response.status}`);
    }

    const data = await response.json();
    const articles = data.articles || data;

    // Filter articles (same logic as the script)
    const filteredArticles = articles.filter((article: any) => {
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
      if (
        sourceName.includes('risbb.cc') ||
        sourceName.includes('cult of mac') ||
        sourceName.includes('bleeding cool') ||
        sourceName.includes('smbc-comics.com') ||
        sourceName.includes('sporting news')
      ) {
        return false;
      }

      // Keywords to exclude
      const sportsKeywords = [
        'sport', 'football', 'basketball', 'baseball', 'soccer', 'tennis', 'golf', 'hockey',
        'nfl', 'nba', 'mlb', 'nhl', 'ncaa', 'championship', 'tournament', 'playoff',
        'coach', 'player', 'team', 'game', 'match', 'score', 'win', 'loss', 'victory',
        'league', 'season', 'draft', 'trade', 'contract', 'salary', 'transfer'
      ];

      const financeKeywords = [
        'stock', 'market', 'trading', 'investment', 'finance', 'financial', 'economy',
        'economic', 'dollar', 'euro', 'currency', 'bank', 'banking', 'profit', 'revenue',
        'earnings', 'quarterly', 'annual', 'fiscal', 'budget', 'deficit', 'surplus'
      ];

      const tvShowKeywords = [
        'nielsen', 'bachelor', 'bachelorette', 'survivor', 'big brother', 'american idol',
        'the voice', 'dancing with the stars', 'masked singer', 'talent show', 'game show'
      ];

      const allKeywords = [...sportsKeywords, ...financeKeywords, ...tvShowKeywords];

      // Check if any keywords are in the title, description, or content
      return !allKeywords.some(
        keyword =>
          title.includes(keyword) ||
          description.includes(keyword) ||
          content.includes(keyword)
      );
    });

    const headlines = filteredArticles.map(
      (article: any) => article.title.replace(/\s*\([^)]*\)/g, '').trim()
    );

    console.log(`Found ${headlines.length} headlines to process`);

    if (headlines.length === 0) {
      console.log('No headlines found, exiting');
      return NextResponse.json({
        success: true,
        message: 'No headlines found'
      });
    }

    // Generate cartoons for headlines by calling the cartoonize API
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.BASE_URL || 'http://localhost:3000';

    const cartoonResponse = await fetch(`${baseUrl}/api/cartoonize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ headlines })
    });

    if (!cartoonResponse.ok) {
      throw new Error(`Cartoon generation error: ${cartoonResponse.status}`);
    }

    const result = await cartoonResponse.json();
    console.log('Background cartoon generation results:', result);

    if (result.success) {
      console.log('Background cartoon generation completed successfully');
      console.log(`Processed ${result.results?.length || 0} headlines`);

      const stats = {
        success: result.results?.filter((r: any) => r.status === 'success')?.length || 0,
        cached: result.results?.filter((r: any) => r.status === 'cached')?.length || 0,
        failed: result.results?.filter((r: any) => r.status === 'failed')?.length || 0
      };

      console.log('Stats:', stats);

      return NextResponse.json({
        success: true,
        message: 'Cartoons generated successfully',
        stats
      });
    } else {
      console.error('Background cartoon generation failed:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { success: false, error: 'Cron job failed' },
      { status: 500 }
    );
  }
}
