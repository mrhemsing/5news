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

    // Get the most recent cache entry (single source of truth)
    const { data, error } = await supabase
      .from('news_cache')
      .select('articles, created_at')
      .order('created_at', { ascending: false })
      .limit(1); // Only get the most recent cache entry

    if (error || !data || data.length === 0) {
      console.log('No cached news found');
      return null;
    }

    const latestCache = data[0];
    const articles = latestCache.articles || [];

    // Validate that articles are recent (within 4 days)
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const recentArticles = articles.filter((article: NewsArticle) => {
      const articleDate = new Date(article.publishedAt);
      return articleDate > fourDaysAgo;
    });

    // Sort by publishedAt (newest first)
    recentArticles.sort(
      (a: NewsArticle, b: NewsArticle) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    console.log(
      `📱 Retrieved ${recentArticles.length} articles from single global cache (created: ${latestCache.created_at})`
    );
    return recentArticles;
  } catch (error) {
    console.error('Error fetching cached news:', error);
    return null;
  }
}

export async function setCachedNews(articles: NewsArticle[]): Promise<void> {
  try {
    if (!supabase) {
      console.log('Supabase not configured, skipping news cache storage');
      return;
    }

    // Clear any existing cache entries to ensure single source of truth
    const { error: deleteError } = await supabase
      .from('news_cache')
      .delete()
      .neq('id', 0); // Delete all existing cache entries

    if (deleteError) {
      console.error('Error clearing existing cache:', deleteError);
    } else {
      console.log('🧹 Cleared existing cache entries for single global cache');
    }

    // Store articles in a single global cache entry
    const { error } = await supabase.from('news_cache').insert({
      date: new Date().toISOString().split('T')[0],
      page: 0, // Use page 0 to indicate global cache
      articles,
      created_at: new Date().toISOString()
    });

    if (error) {
      console.error('Error caching news:', error);
    } else {
      console.log(
        `📱 News cached successfully in single global cache with ${articles.length} articles`
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
