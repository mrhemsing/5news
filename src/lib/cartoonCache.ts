import { supabase } from './supabase';

// Cartoon cache using Supabase
export interface CartoonCache {
  id: string;
  headline: string;
  cartoon_url: string;
  created_at: string;
}

export async function getCachedCartoon(
  headline: string
): Promise<string | null> {
  try {
    if (!supabase) {
      console.log('Supabase not configured, skipping cache lookup');
      return null;
    }

    const { data, error } = await supabase
      .from('cartoon_cache')
      .select('cartoon_url')
      .eq('headline', headline)
      .single();

    if (error || !data) {
      return null;
    }

    return data.cartoon_url;
  } catch (error) {
    console.error('Error fetching cached cartoon:', error);
    return null;
  }
}

export async function setCachedCartoon(
  headline: string,
  cartoonUrl: string
): Promise<void> {
  try {
    if (!supabase) {
      console.log('Supabase not configured, skipping cache storage');
      return;
    }

    // Use upsert to handle duplicate headlines gracefully
    const { error } = await supabase.from('cartoon_cache').upsert(
      {
        headline,
        cartoon_url: cartoonUrl,
        created_at: new Date().toISOString()
      },
      {
        onConflict: 'headline',
        ignoreDuplicates: false
      }
    );

    if (error) {
      console.error('Error caching cartoon:', error);
    }
  } catch (error) {
    console.error('Error setting cached cartoon:', error);
  }
}

export async function clearExpiredCache(): Promise<void> {
  try {
    if (!supabase) {
      console.log('Supabase not configured, skipping cache cleanup');
      return;
    }

    // Delete cartoons older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { error } = await supabase
      .from('cartoon_cache')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (error) {
      console.error('Error clearing expired cache:', error);
    }
  } catch (error) {
    console.error('Error clearing expired cache:', error);
  }
}
