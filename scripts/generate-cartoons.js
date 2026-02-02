#!/usr/bin/env node

// Script to pre-generate cartoons for headlines
// Can be run as a scheduled job (cron, GitHub Actions, etc.)

const fetch = require('node-fetch');

// RSS parsing function
function parseRSSFeed(xmlText) {
  const articles = [];

  // Simple regex-based parsing for RSS
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const titleRegex = /<title>([^<]+)<\/title>/;
  const linkRegex = /<link>([^<]+)<\/link>/;
  const descriptionRegex = /<description>([^<]+)<\/description>/;
  const sourceRegex = /<source[^>]*>([^<]+)<\/source>/;

  let match;
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemContent = match[1];

    const titleMatch = itemContent.match(titleRegex);
    const linkMatch = itemContent.match(linkRegex);
    const descriptionMatch = itemContent.match(descriptionRegex);
    const sourceMatch = itemContent.match(sourceRegex);

    if (titleMatch && linkMatch) {
      articles.push({
        title: titleMatch[1].trim(),
        url: linkMatch[1].trim(),
        description: descriptionMatch ? descriptionMatch[1].trim() : '',
        source: sourceMatch ? { name: sourceMatch[1].trim() } : { name: '' }
      });
    }
  }

  return articles;
}

async function getLatestHeadlines() {
  try {
    // Use the same Google News RSS feeds as the main news API
    const rssFeeds = [
      'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q=breaking+news&hl=en-US&gl=US&ceid=US:en',
      'https://news.google.com/rss/search?q=latest+news&hl=en-US&gl=US&ceid=US:en'
    ];

    let allArticles = [];

    for (const feedUrl of rssFeeds) {
      try {
        const response = await fetch(feedUrl);
        if (!response.ok) {
          console.warn(`Failed to fetch RSS feed: ${feedUrl}`);
          continue;
        }

        const xmlText = await response.text();
        const articles = parseRSSFeed(xmlText);
        allArticles = allArticles.concat(articles);
      } catch (error) {
        console.warn(`Error fetching RSS feed ${feedUrl}:`, error);
        continue;
      }
    }

    // Remove duplicates based on title
    const uniqueArticles = allArticles.filter(
      (article, index, self) =>
        index === self.findIndex(a => a.title === article.title)
    );

    // Use the same filtering logic as the main news API
    const filteredArticles = uniqueArticles.filter(article => {
      // Skip single word headlines
      const cleanTitle = article.title.replace(/\s*\([^)]*\)/g, '').trim();
      if (cleanTitle.split(' ').length <= 1) {
        return false;
      }

      const sourceName = (article.source?.name || '').toLowerCase();
      const articleUrl = (article.url || '').toLowerCase();

      // Specifically exclude Yahoo Finance articles
      if (
        sourceName.includes('yahoo finance') ||
        sourceName.includes('yahoo.finance') ||
        articleUrl.includes('finance.yahoo.com') ||
        articleUrl.includes('uk.finance.yahoo.com')
      ) {
        return false;
      }

      // Whitelist of approved news sources (exact matches only)
      const approvedSources = [
        'abc news',
        'abcnews',
        'abc',
        'abc news network',
        'abcnews.com',
        'abcnews.go.com'
      ];

      // Check if the source name matches any approved source
      const isApprovedSource = approvedSources.some(approvedSource => {
        // Normalize both strings for comparison
        const normalizedSourceName = sourceName.toLowerCase().trim();
        const normalizedApprovedSource = approvedSource.toLowerCase().trim();

        // Use exact match only - no partial matching
        if (normalizedSourceName === normalizedApprovedSource) {
          return true;
        }

        // Check URL matching for domain-based sources (only for exact domain matches)
        const domainMatch = articleUrl.includes(
          approvedSource.replace(/\s+/g, '')
        );
        if (domainMatch) {
          // Additional check to ensure it's not a partial match (e.g., "times" matching "prince william times")
          const urlParts = articleUrl.split('.');
          const sourceParts = approvedSource.replace(/\s+/g, '').split('.');

          // Only allow if the main domain part matches exactly
          if (urlParts.length > 0 && sourceParts.length > 0) {
            const urlDomain = urlParts[0].replace('www', '');
            const sourceDomain = sourceParts[0];
            if (urlDomain === sourceDomain) {
              return true;
            }
          }
        }

        return false;
      });

      return isApprovedSource;
    });

    return filteredArticles.map(
      article => article.title.replace(/\s*\([^)]*\)/g, '').trim() // Remove text in parentheses
    );
  } catch (error) {
    console.error('Error fetching headlines:', error);
    return [];
  }
}

async function generateCartoons() {
  try {
    // Always use an absolute URL. Note: VERCEL_URL does not include protocol.
    const baseUrl = process.env.BASE_URL
      ? process.env.BASE_URL
      : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    // Use the server-side batch endpoint which respects caching and rate limiting.
    const response = await fetch(`${baseUrl}/api/generate-cartoons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Generate cartoons error: ${response.status} ${text}`);
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

  // Optional: still fetch headlines for logging, but the server decides what to generate.
  const headlines = await getLatestHeadlines();
  console.log(`Found ${headlines.length} headlines in RSS (server will generate a small batch of missing cartoons)`);

  // Generate cartoons (server-side will decide what needs generating)
  const result = await generateCartoons();

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
