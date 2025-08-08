// Copy and paste this into your browser console when you visit your app

async function testNewsAPI() {
  try {
    console.log('Testing news API...');

    const response = await fetch('/api/news');

    if (!response.ok) {
      console.error('API Error:', response.status, response.statusText);
      return;
    }

    const data = await response.json();

    console.log('=== API Response ===');
    console.log('Total Articles:', data.articles?.length || 0);
    console.log('Total Results:', data.totalResults);
    console.log('Has More:', data.hasMore);

    if (data.articles && data.articles.length > 0) {
      console.log('\n=== Sample Articles ===');
      data.articles.slice(0, 5).forEach((article, index) => {
        console.log(`${index + 1}. ${article.title}`);
      });

      console.log(`\n=== Summary ===`);
      console.log(`Total articles: ${data.articles.length}`);
      console.log(`This should match what you see on the page.`);
    } else {
      console.log('No articles received');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the test
testNewsAPI();
