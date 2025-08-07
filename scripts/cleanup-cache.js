#!/usr/bin/env node

// Script to clean up expired cache entries
// Can be run as a scheduled job

const { clearExpiredCache } = require('../src/lib/cartoonCache');
const { clearExpiredNewsCache } = require('../src/lib/newsCache');
const { clearExpiredTTSCache } = require('../src/lib/ttsCache');

async function cleanupAllCaches() {
  console.log('Starting cache cleanup...');

  try {
    // Clean up cartoon cache
    console.log('Cleaning up cartoon cache...');
    await clearExpiredCache();

    // Clean up news cache
    console.log('Cleaning up news cache...');
    await clearExpiredNewsCache();

    // Clean up TTS cache
    console.log('Cleaning up TTS cache...');
    await clearExpiredTTSCache();

    console.log('Cache cleanup completed successfully');
  } catch (error) {
    console.error('Error during cache cleanup:', error);
  }
}

// Run the script
if (require.main === module) {
  cleanupAllCaches().catch(console.error);
}

module.exports = { cleanupAllCaches };
