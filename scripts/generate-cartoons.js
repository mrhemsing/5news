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

    // Use the same API endpoint as the main news API
    const response = await fetch(
      `https://gnews.io/api/v4/top-headlines?category=general&lang=en&country=us&max=100&apikey=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`GNews API error: ${response.status}`);
    }

    const data = await response.json();

    // GNews returns articles directly, not wrapped in a response object
    const articles = data.articles || data;

    // Use the same filtering logic as the main news API
    const filteredArticles = articles.filter(article => {
      const title = article.title.toLowerCase();
      const description = (article.description || '').toLowerCase();
      const content = (article.content || '').toLowerCase();

      // Skip single word headlines
      const cleanTitle = article.title.replace(/\s*\([^)]*\)/g, '').trim();
      if (cleanTitle.split(' ').length <= 1) {
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
        return false;
      }

      // Only filter out very specific sports/finance content (same as main API)
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
        return false;
      }

      return true;
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
