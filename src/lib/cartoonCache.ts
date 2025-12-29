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

export async function deleteCachedCartoon(headline: string): Promise<void> {
  try {
    if (!supabase) {
      console.log('Supabase not configured, skipping cache deletion');
      return;
    }

    const { error } = await supabase
      .from('cartoon_cache')
      .delete()
      .eq('headline', headline);

    if (error) {
      console.error('Error deleting cached cartoon:', error);
    } else {
      console.log(`Deleted expired cache entry for headline: ${headline}`);
    }
  } catch (error) {
    console.error('Error deleting cached cartoon:', error);
  }
}

export async function deleteCachedCartoonByUrl(
  cartoonUrl: string
): Promise<void> {
  try {
    if (!supabase) {
      console.log('Supabase not configured, skipping cache deletion');
      return;
    }

    const { error } = await supabase
      .from('cartoon_cache')
      .delete()
      .eq('cartoon_url', cartoonUrl);

    if (error) {
      console.error('Error deleting cached cartoon by URL:', error);
    } else {
      console.log(`Deleted expired cache entry for URL: ${cartoonUrl}`);
    }
  } catch (error) {
    console.error('Error deleting cached cartoon by URL:', error);
  }
}

// Database-backed rate limiter that works across serverless instances
// Returns true if we can proceed, false if we need to wait
export async function acquireRateLimitLock(): Promise<boolean> {
  try {
    if (!supabase) {
      console.log('Supabase not configured, allowing request');
      return true;
    }

    // Check if we can make a request (last request was more than 15 seconds ago)
    const fifteenSecondsAgo = new Date(Date.now() - 15000);

    // First, check the current state of the lock
    const { data: lockData, error: selectError } = await supabase
      .from('rate_limit_lock')
      .select('last_request')
      .eq('id', 'replicate_api')
      .single();

    if (selectError || !lockData) {
      // Lock doesn't exist yet, allow request (will be created after request)
      return true;
    }

    // Lock exists, check if we can proceed
    const lastRequest = new Date(lockData.last_request);
    const timeSinceLastRequest = Date.now() - lastRequest.getTime();

    if (timeSinceLastRequest < 15000) {
      // Too soon, can't proceed
      console.log(
        `Rate limit: Last request was ${Math.round(
          timeSinceLastRequest / 1000
        )}s ago, need to wait ${Math.round(
          (15000 - timeSinceLastRequest) / 1000
        )}s more`
      );
      return false;
    }

    // Can proceed - lock will be updated after successful request
    return true;
  } catch (error) {
    console.error('Error checking rate limit lock:', error);
    return true; // Allow on error to not block requests
  }
}

// Update the rate limit lock after a successful request
export async function updateRateLimitLock(): Promise<void> {
  try {
    if (!supabase) {
      return;
    }

    // Upsert the lock with current timestamp
    await supabase.from('rate_limit_lock').upsert(
      {
        id: 'replicate_api',
        last_request: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        onConflict: 'id',
        ignoreDuplicates: false
      }
    );
  } catch (error) {
    console.error('Error updating rate limit lock:', error);
    // Don't throw - this is not critical
  }
}
