#!/usr/bin/env node

// Script to pre-generate cartoons for headlines
// Can be run as a scheduled job (cron, GitHub Actions, etc.)

const fetch = require('node-fetch');

async function getLatestHeadlines() {
  try {
    const apiKey = process.env.GNEWS_API_KEY;
    if (!apiKey) {
      throw new Error('GNEWS_API_KEY not found');
    }

    const response = await fetch(
      `https://gnews.io/api/v4/search?q=news&lang=en&country=us&max=30&apikey=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`GNews API error: ${response.status}`);
    }

    const data = await response.json();

    // GNews returns articles directly, not wrapped in a response object
    const articles = data.articles || data;

    // Filter out sports and finance articles (same logic as API)
    const filteredArticles = articles.filter(article => {
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

    return filteredArticles.map(
      article => article.title.replace(/\s*\([^)]*\)/g, '').trim() // Remove text in parentheses
    );
  } catch (error) {
    console.error('Error fetching headlines:', error);
    return [];
  }
}

async function generateCartoons(headlines) {
  try {
    const baseUrl =
      process.env.BASE_URL || process.env.VERCEL_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/cartoonize`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ headlines })
    });

    if (!response.ok) {
      throw new Error(`Cartoon generation error: ${response.status}`);
    }

    const result = await response.json();
    console.log('Background cartoon generation results:', result);
    return result;
  } catch (error) {
    console.error('Error generating cartoons:', error);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('Starting background cartoon generation...');

  // Get latest headlines
  const headlines = await getLatestHeadlines();
  console.log(`Found ${headlines.length} headlines to process`);

  if (headlines.length === 0) {
    console.log('No headlines found, exiting');
    return;
  }

  // Generate cartoons for headlines
  const result = await generateCartoons(headlines);

  if (result.success) {
    console.log('Background cartoon generation completed successfully');
    console.log(`Processed ${result.results.length} headlines`);

    const stats = {
      success: result.results.filter(r => r.status === 'success').length,
      cached: result.results.filter(r => r.status === 'cached').length,
      failed: result.results.filter(r => r.status === 'failed').length
    };

    console.log('Stats:', stats);
  } else {
    console.error('Background cartoon generation failed:', result.error);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { getLatestHeadlines, generateCartoons, main };
