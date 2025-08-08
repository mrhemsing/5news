import { NextResponse } from 'next/server';
import { getCachedTTS, setCachedTTS } from '@/lib/ttsCache';

const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah voice

export async function POST(request: Request) {
  try {
    const { text, timestamp } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    // Try to get cached TTS first
    const cachedAudioUrl = await getCachedTTS(text, VOICE_ID);
    if (cachedAudioUrl) {
      console.log('Using cached TTS audio');
      return NextResponse.json({
        audioUrl: cachedAudioUrl,
        cached: true
      });
    }

    console.log('Generating speech for text:', text.substring(0, 100) + '...');
    console.log('Using voice ID:', VOICE_ID);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        console.error('ElevenLabs API error: 401 missing_permissions');
        return NextResponse.json(
          { error: 'API key missing permissions', fallback: true },
          { status: 401 }
        );
      }
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    
    // Convert to base64 for client-side access
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;

    console.log('Successfully generated speech audio');

    // Cache the TTS result
    await setCachedTTS(text, VOICE_ID, audioUrl);

    return NextResponse.json({
      audioUrl,
      cached: false
    });
  } catch (error) {
    console.error('Error generating speech:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    );
  }
}
