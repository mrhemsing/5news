const fetch = require('node-fetch');

async function testRawGNews() {
  try {
    // Test the raw GNews API (you'll need to add your API key)
    const apiKey = 'YOUR_GNEWS_API_KEY_HERE'; // Replace with your actual API key
    
    console.log('Testing raw GNews API...');
    
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
    
    console.log('\n=== Raw GNews API Response ===');
    console.log('Total Articles:', data.articles?.length || 0);
    console.log('Response Keys:', Object.keys(data));
    
    if (data.articles && data.articles.length > 0) {
      console.log('\n=== Sample Articles ===');
      data.articles.slice(0, 10).forEach((article, index) => {
        console.log(`\n${index + 1}. ${article.title}`);
        console.log(`   Source: ${article.source?.name}`);
        console.log(`   Published: ${article.publishedAt}`);
      });
      
      console.log(`\n=== Summary ===`);
      console.log(`Total articles from GNews: ${data.articles.length}`);
      console.log(`This should be 100 if API is working correctly.`);
    } else {
      console.log('No articles received from GNews API');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testRawGNews();
