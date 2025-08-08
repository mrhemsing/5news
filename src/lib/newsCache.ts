import { supabase } from './supabase';
import { NewsArticle } from '@/types/news';

// News cache using Supabase
export interface NewsCache {
  id: string;
  date: string;
  articles: NewsArticle[];
  created_at: string;
  page?: number;
}

export async function getCachedNews(
  date: string,
  page: number = 1
): Promise<NewsArticle[] | null> {
  try {
    if (!supabase) {
      console.log('Supabase not configured, skipping news cache lookup');
      return null;
    }

    const { data, error } = await supabase
      .from('news_cache')
      .select('articles, created_at, page')
      .eq('date', date)
      .eq('page', page)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if cache is less than 6 hours old (extended from 2 hours to save API calls)
    const cacheAge = Date.now() - new Date(data.created_at).getTime();
    const sixHours = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

    if (cacheAge > sixHours) {
      console.log(
        `News cache for page ${page} is too old, fetching fresh data`
      );
      return null;
    }

    console.log(`Using cached news data for page ${page}`);
    return data.articles;
  } catch (error) {
    console.error('Error fetching cached news:', error);
    return null;
  }
}

export async function setCachedNews(
  date: string,
  articles: NewsArticle[],
  page: number = 1
): Promise<void> {
  try {
    if (!supabase) {
      console.log('Supabase not configured, skipping news cache storage');
      return;
    }

    // Use upsert to handle duplicate dates and pages gracefully
    const { error } = await supabase.from('news_cache').upsert(
      {
        date,
        articles,
        page,
        created_at: new Date().toISOString()
      },
      {
        onConflict: 'date,page',
        ignoreDuplicates: false
      }
    );

    if (error) {
      console.error('Error caching news:', error);
    } else {
      console.log(`News cached successfully for page ${page}`);
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

// New function to get all cached pages for a date
export async function getAllCachedPages(date: string): Promise<number[]> {
  try {
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('news_cache')
      .select('page')
      .eq('date', date);

    if (error || !data) {
      return [];
    }

    return data.map(item => item.page || 1);
  } catch (error) {
    console.error('Error getting cached pages:', error);
    return [];
  }
}
