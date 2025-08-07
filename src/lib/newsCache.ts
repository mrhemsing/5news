import { supabase } from './supabase';
import { NewsArticle } from '@/types/news';

// News cache using Supabase
export interface NewsCache {
  id: string;
  date: string;
  articles: NewsArticle[];
  created_at: string;
}

export async function getCachedNews(
  date: string
): Promise<NewsArticle[] | null> {
  try {
    if (!supabase) {
      console.log('Supabase not configured, skipping news cache lookup');
      return null;
    }

    const { data, error } = await supabase
      .from('news_cache')
      .select('articles')
      .eq('date', date)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if cache is less than 2 hours old
    const cacheAge = Date.now() - new Date(data.created_at).getTime();
    const twoHours = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

    if (cacheAge > twoHours) {
      console.log('News cache is too old, fetching fresh data');
      return null;
    }

    console.log('Using cached news data');
    return data.articles;
  } catch (error) {
    console.error('Error fetching cached news:', error);
    return null;
  }
}

export async function setCachedNews(
  date: string,
  articles: NewsArticle[]
): Promise<void> {
  try {
    if (!supabase) {
      console.log('Supabase not configured, skipping news cache storage');
      return;
    }

    // Use upsert to handle duplicate dates gracefully
    const { error } = await supabase.from('news_cache').upsert(
      {
        date,
        articles,
        created_at: new Date().toISOString()
      },
      {
        onConflict: 'date',
        ignoreDuplicates: false
      }
    );

    if (error) {
      console.error('Error caching news:', error);
    } else {
      console.log('News cached successfully');
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
