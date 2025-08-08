const fetch = require('node-fetch');

async function testAppAPI() {
  try {
    // Test your deployed app's API
    const appUrl = 'https://5news-mrhemsing.vercel.app'; // Replace with your actual Vercel URL

    console.log("Testing your app's news API...");
    console.log('URL:', `${appUrl}/api/news`);

    const response = await fetch(`${appUrl}/api/news`);

    if (!response.ok) {
      console.error('App API Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error Details:', errorText);
      return;
    }

    const data = await response.json();

    console.log('\n=== App API Response ===');
    console.log('Total Articles:', data.articles?.length || 0);
    console.log('Total Results:', data.totalResults);
    console.log('Has More:', data.hasMore);

    if (data.articles && data.articles.length > 0) {
      console.log('\n=== Sample Articles ===');
      data.articles.slice(0, 5).forEach((article, index) => {
        console.log(`\n${index + 1}. ${article.title}`);
        console.log(`   Source: ${article.source?.name}`);
        console.log(`   ID: ${article.id}`);
      });

      console.log(`\n=== Summary ===`);
      console.log(`Total articles from your app: ${data.articles.length}`);
      console.log(`This should match what you see on the page.`);
    } else {
      console.log('No articles received from your app API');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAppAPI();
