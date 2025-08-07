#!/usr/bin/env node

// Script to pre-generate cartoons for headlines
// Can be run as a scheduled job (cron, GitHub Actions, etc.)

const fetch = require('node-fetch');

async function getLatestHeadlines() {
  try {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      throw new Error('NEWS_API_KEY not found');
    }

    const response = await fetch(
      `https://newsapi.org/v2/everything?q=news&language=en&sortBy=publishedAt&apiKey=${apiKey}&pageSize=20`
    );

    if (!response.ok) {
      throw new Error(`News API error: ${response.status}`);
    }

    const data = await response.json();
    return data.articles.map(article => article.title);
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
