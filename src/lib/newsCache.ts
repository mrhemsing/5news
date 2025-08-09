import { supabase } from './supabase';
import { NewsArticle } from '@/types/news';

// News cache using Supabase with 48-hour retention
export interface NewsCache {
  id: string;
  date: string;
  page: number;
  articles: NewsArticle[];
  created_at: string;
}

export async function getCachedNews(): Promise<NewsArticle[] | null> {
  try {
    if (!supabase) {
      console.log('Supabase not configured, skipping news cache lookup');
      return null;
    }

    // Calculate 48 hours ago to get articles from the last 48 hours
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Query for articles from the last 48 hours, not just today
    const { data, error } = await supabase
      .from('news_cache')
      .select('articles, created_at')
      .gte('created_at', fortyEightHoursAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return null;
    }

    // Merge all articles from the last 48 hours
    let allArticles: NewsArticle[] = [];
    data.forEach(cacheEntry => {
      if (cacheEntry.articles && Array.isArray(cacheEntry.articles)) {
        allArticles = [...allArticles, ...cacheEntry.articles];
      }
    });

    // Remove duplicates based on URL
    const uniqueArticles = allArticles.filter(
      (article, index, self) =>
        index === self.findIndex(a => a.url === article.url)
    );

    // Filter articles to only include those from the last 48 hours based on publishedAt
    const fortyEightHoursAgoDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const recentArticles = uniqueArticles.filter(article => {
      const articleDate = new Date(article.publishedAt);
      return articleDate > fortyEightHoursAgoDate;
    });

    // Sort by publishedAt (newest first)
    recentArticles.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    console.log(
      `Retrieved ${recentArticles.length} articles from last 48 hours`
    );
    return recentArticles;
  } catch (error) {
    console.error('Error fetching cached news:', error);
    return null;
  }
}

export async function setCachedNews(
  articles: NewsArticle[],
  page: number = 1
): Promise<void> {
  try {
    if (!supabase) {
      console.log('Supabase not configured, skipping news cache storage');
      return;
    }

    // Store articles with current timestamp for 48-hour retention
    const { error } = await supabase.from('news_cache').insert({
      date: new Date().toISOString().split('T')[0], // Keep date for organization
      page,
      articles,
      created_at: new Date().toISOString()
    });

    if (error) {
      console.error('Error caching news:', error);
    } else {
      console.log(
        `News cached successfully with ${articles.length} articles on page ${page}`
      );
    }
  } catch (error) {
    console.error('Error setting cached news:', error);
  }
}

export async function clearExpiredNewsCache(): Promise<void> {
  try {
    if (!supabase) {
      console.log('Supabase not configured, skipping news cache cleanup');
      return;
    }

    // Delete news cache older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { error } = await supabase
      .from('news_cache')
      .delete()
      .lt('created_at', sevenDaysAgo.toISOString());

    if (error) {
      console.error('Error clearing expired news cache:', error);
    }
  } catch (error) {
    console.error('Error clearing expired news cache:', error);
  }
}

// Function to get all cached pages for a date
export async function getAllCachedPages(date: string): Promise<number[]> {
  try {
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('news_cache')
      .select('page')
      .eq('date', date)
      .order('page', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(entry => entry.page);
  } catch (error) {
    console.error('Error getting cached pages:', error);
    return [];
  }
}
