const fetch = require('node-fetch');

async function testNewsAPI() {
  try {
    // Get API key from environment or prompt user
    let apiKey = process.env.GNEWS_API_KEY;

    if (!apiKey) {
      console.log('GNEWS_API_KEY not found in environment.');
      console.log('Please set your API key or add it to the script.');
      console.log('You can get your API key from: https://gnews.io/');
      return;
    }

    console.log('Testing GNews API...');
    console.log('API Key:', apiKey.substring(0, 10) + '...');

    const response = await fetch(
      `https://gnews.io/api/v4/search?q=news&lang=en&country=us&max=100&apikey=${apiKey}`
    );

    if (!response.ok) {
      console.error('API Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error Details:', errorText);
      return;
    }

    const data = await response.json();

    console.log('\n=== API Response ===');
    console.log('Total Articles:', data.articles?.length || 0);
    console.log('Response Keys:', Object.keys(data));

    if (data.articles && data.articles.length > 0) {
      console.log('\n=== Sample Articles ===');
      data.articles.slice(0, 5).forEach((article, index) => {
        console.log(`\n${index + 1}. ${article.title}`);
        console.log(`   Source: ${article.source?.name}`);
        console.log(`   URL: ${article.url}`);
      });

      console.log(`\n=== Summary ===`);
      console.log(`Total articles received: ${data.articles.length}`);
      console.log(`This should match what your app displays.`);
    } else {
      console.log('No articles received from API');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testNewsAPI();
