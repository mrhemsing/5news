const fetch = require('node-fetch');

async function testNewsAPI() {
  try {
    console.log('Testing news API refresh...');
    
    const response = await fetch('http://localhost:3000/api/news?refresh=true');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log('API Response:');
    console.log(`Total articles: ${data.totalResults}`);
    console.log(`Has more: ${data.hasMore}`);
    console.log('\nFirst few articles:');
    
    if (data.articles && data.articles.length > 0) {
      data.articles.slice(0, 3).forEach((article, index) => {
        console.log(`\n${index + 1}. ${article.title}`);
        console.log(`   Source: ${article.source}`);
        console.log(`   URL: ${article.url}`);
        console.log(`   Published: ${article.publishedAt}`);
      });
    }
    
  } catch (error) {
    console.error('Error testing news API:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\nMake sure the development server is running with: npm run dev');
    }
  }
}

testNewsAPI();
