// Simple script to clear the news cache
// This script calls the API with refresh=true to force a cache refresh

const API_URL = 'http://localhost:3000/api/news?refresh=true';

console.log('🗑️  Clearing news cache...');
console.log(`📡 Calling: ${API_URL}`);

fetch(API_URL)
  .then(response => {
    console.log(`📊 Response status: ${response.status}`);
    if (response.ok) {
      console.log('✅ Cache cleared successfully!');
      console.log(
        '🔄 The next request will fetch fresh articles with direct ABC News URLs'
      );
    } else {
      console.log('❌ Failed to clear cache');
    }
  })
  .catch(error => {
    console.error('💥 Error clearing cache:', error.message);
    console.log(
      '💡 Make sure your Next.js server is running on localhost:3000'
    );
  });
