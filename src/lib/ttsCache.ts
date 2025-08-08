import { supabase } from './supabase';

// TTS cache using Supabase
export interface TTSCache {
  id: string;
  text_hash: string;
  audio_url: string;
  voice_id: string;
  created_at: string;
}

// Simple hash function for text
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}

export async function getCachedTTS(
  text: string,
  voiceId: string
): Promise<string | null> {
  try {
    if (!supabase) {
      console.log('Supabase not configured, skipping TTS cache lookup');
      return null;
    }

    const textHash = hashText(text);

    const { data, error } = await supabase
      .from('tts_cache')
      .select('audio_url, created_at')
      .eq('text_hash', textHash)
      .eq('voice_id', voiceId)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if cache is less than 24 hours old
    const cacheAge = Date.now() - new Date(data.created_at).getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (cacheAge > twentyFourHours) {
      console.log('TTS cache is too old, generating fresh audio');
      return null;
    }

    console.log('Using cached TTS audio');
    return data.audio_url;
  } catch (error) {
    console.error('Error fetching cached TTS:', error);
    return null;
  }
}

export async function setCachedTTS(
  text: string,
  voiceId: string,
  audioUrl: string
): Promise<void> {
  try {
    if (!supabase) {
      console.log('Supabase not configured, skipping TTS cache storage');
      return;
    }

    const textHash = hashText(text);

    // Use upsert to handle duplicate text/voice combinations gracefully
    const { error } = await supabase.from('tts_cache').upsert(
      {
        text_hash: textHash,
        voice_id: voiceId,
        audio_url: audioUrl,
        created_at: new Date().toISOString()
      },
      {
        onConflict: 'text_hash,voice_id',
        ignoreDuplicates: false
      }
    );

    if (error) {
      console.error('Error caching TTS:', error);
    } else {
      console.log('TTS cached successfully');
    }
  } catch (error) {
    console.error('Error setting cached TTS:', error);
  }
}

export async function clearExpiredTTSCache(): Promise<void> {
  try {
    if (!supabase) {
      console.log('Supabase not configured, skipping TTS cache cleanup');
      return;
    }

    // Delete TTS cache older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { error } = await supabase
      .from('tts_cache')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (error) {
      console.error('Error clearing expired TTS cache:', error);
    }
  } catch (error) {
    console.error('Error clearing expired TTS cache:', error);
  }
}
