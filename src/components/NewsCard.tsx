'use client';

import { useState, useEffect, useRef } from 'react';
import { NewsArticle } from '@/types/news';
import Image from 'next/image';

// Client-side queue to prevent a thundering herd of /api/cartoonize calls.
// Without this, dozens of cards mount at once and immediately trip server-side rate limits,
// resulting in placeholders everywhere.
declare global {
  interface Window {
    __abcnewzCartoonQueue?: Promise<unknown>;
  }
}

function enqueueCartoonTask<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof window === 'undefined') return fn();
  const prev = window.__abcnewzCartoonQueue ?? Promise.resolve();

  const next = prev
    .catch(() => undefined)
    .then(fn);

  // Keep the chain alive even if one task fails.
  window.__abcnewzCartoonQueue = next.catch(() => undefined);
  return next;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

interface NewsCardProps {
  article: NewsArticle;
  onExplain: (articleId: string, explanation: string) => void;
  onExplainError: (articleId: string) => void;
}

export default function NewsCard({
  article,
  onExplain,
  onExplainError
}: NewsCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [explanationError, setExplanationError] = useState(false);
  const [cartoonUrl, setCartoonUrl] = useState<string | null>(null);
  const [cartoonLoading, setCartoonLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(
    null
  );
  const [isStopping, setIsStopping] = useState(false);
  const [useProxy, setUseProxy] = useState(true);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Clear cartoon URL when image fails to load
  const handleImageError = () => {
    console.log('Cartoon image failed to load:', cartoonUrl);
    setImageError(true);

    // If we're using proxy, try direct URL as fallback
    if (useProxy && cartoonUrl) {
      console.log('Trying direct URL as fallback');
      setUseProxy(false);
      setImageError(false);
      return; // Don't clear cartoonUrl, let it retry with direct URL
    }

    // If direct URL also failed, clear the URL and regenerate
    if (!useProxy && cartoonUrl) {
      console.log(
        'Direct URL also failed, clearing cartoon URL and regenerating'
      );
      setCartoonUrl(null);
      // Regenerate cartoon immediately since the URL is expired
      setTimeout(() => {
        setRetryCount(0); // Reset retry count for fresh generation
        setUseProxy(true); // Reset to use proxy for next attempt
        generateCartoon(article.title);
      }, 1000); // Wait 1 second before regenerating
      return;
    }

    // Retry cartoon generation if we haven't exceeded max retries
    if (retryCount < 2) {
      console.log('Retrying cartoon generation due to image load failure');
      setTimeout(() => {
        setRetryCount(retryCount + 1);
        setUseProxy(true); // Reset to use proxy for next attempt
        generateCartoon(article.title);
      }, 2000); // Wait 2 seconds before retry
    } else {
      console.log(
        'Max retries reached, giving up on cartoon for this headline'
      );
    }
  };

  // Generate cartoon when component mounts or when article changes
  useEffect(() => {
    console.log(
      `🔄 NewsCard useEffect triggered for article: ${article.id} - "${article.title}"`
    );

    // Clear any existing cartoon when article changes
    setCartoonUrl(null);
    setImageError(false);
    setRetryCount(0);
    setUseProxy(true);
    setCartoonLoading(false); // Ensure loading state is reset

    // Generate new cartoon for this headline
    console.log(`🎨 Starting cartoon generation for: "${article.title}"`);
    generateCartoon(article.title);

    // Cleanup function to reset state when component unmounts or article changes
    return () => {
      console.log(`🧹 Cleaning up NewsCard for article: ${article.id}`);
      setCartoonUrl(null);
      setImageError(false);
      setRetryCount(0);
      setUseProxy(true);
      setCartoonLoading(false);
    };
  }, [article.id]); // Use article.id instead of article.title to detect new articles

  const generateCartoon = async (headline: string) => {
    if (cartoonUrl || cartoonLoading) return;

    setCartoonLoading(true);

    // Serialize generation attempts across all cards on the page.
    // This avoids having 20+ requests all immediately 429.
    await enqueueCartoonTask(async () => {
      try {
        // Small delay so multiple tabs/devices don't align perfectly.
        await sleep(Math.floor(Math.random() * 800));

        for (let attempt = 0; attempt < 3; attempt++) {
          console.log(`Generating cartoon (attempt ${attempt + 1}):`, headline);

          const response = await fetchWithTimeout(
            '/api/cartoonize',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ headline })
            },
            25000
          );

          console.log(`Cartoon API response status: ${response.status}`);

          if (response.ok) {
            const data = await response.json();
            console.log('Cartoon response:', data);

            if (data.cartoonUrl) {
              setCartoonUrl(data.cartoonUrl);
              setRetryCount(0);
              return;
            }

            // No URL even though ok.
            console.error('No cartoon URL returned from API');
          } else if (response.status === 429) {
            const data = await response.json().catch(() => ({}));
            const retryAfter = Number(data.retryAfter ?? 15);
            const jitterMs = Math.floor(Math.random() * 1500);
            const waitMs = Math.max(1, retryAfter) * 1000 + jitterMs;
            console.log(`Rate limited; waiting ${waitMs}ms then retrying…`);
            await sleep(waitMs);
            continue;
          } else {
            const errorText = await response.text().catch(() => '');
            console.error('Cartoon API error:', response.status, errorText);
            break;
          }

          // Brief backoff for non-429 failures.
          await sleep(500 + attempt * 750);
        }

        console.log('Giving up on cartoon generation for this headline (for now)');
      } catch (error) {
        console.error('Error generating cartoon:', error);

        // If this request hung and got aborted, wait a beat so we don't hammer immediately.
        await sleep(500);
      }
    });

    setCartoonLoading(false);
  };

  const handleExplain = async () => {
    if (article.simpleExplanation) {
      setIsExpanded(!isExpanded);
      return;
    }

    setIsLoading(true);
    setExplanationError(false);
    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: article.title,
          content: article.content || article.description
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.explanation && data.explanation.trim()) {
          onExplain(article.id, data.explanation);
          setIsExpanded(true);
        } else {
          setExplanationError(true);
          onExplainError(article.id);
        }
      } else {
        setExplanationError(true);
        onExplainError(article.id);
      }
    } catch (error) {
      console.error('Error getting explanation:', error);
      setExplanationError(true);
      onExplainError(article.id);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate high-quality audio using ElevenLabs
  const generateAudio = async (text: string) => {
    setAudioLoading(true);
    setAudioUrl(null);
    setIsPlaying(false);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          timestamp: Date.now()
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('TTS response:', data);

        if (data.audioUrl) {
          setAudioUrl(data.audioUrl);

          // Create audio element
          const audio = new Audio(data.audioUrl);
          setCurrentAudio(audio);

          // Set up event listeners
          audio.onended = () => {
            console.log('Audio ended');
            setIsPlaying(false);
            setCurrentAudio(null);
          };
          audio.onerror = () => {
            console.error('Audio error');
            setIsPlaying(false);
            setCurrentAudio(null);
          };
          audio.onloadstart = () => {
            console.log('Audio loading started');
            setIsPlaying(true);
          };
          audio.oncanplay = () => {
            console.log('Audio can play, starting playback');
            if (!isStopping) {
              audio.play().catch(e => {
                console.error('Failed to play audio:', e);
                setIsPlaying(false);
                setCurrentAudio(null);
              });
            } else {
              console.log('Skipping playback because stopping');
            }
          };
          audio.load(); // Explicitly load the audio
        }
      } else {
        const errorData = await response.json();
        console.error('TTS API error:', response.status, errorData);

        // Check if it's a permissions issue and fallback to browser speech
        if (errorData.fallback) {
          console.log('Falling back to browser speech synthesis');
          playWithBrowserSpeech(text);
        } else {
          // Other error, try browser speech as fallback
          playWithBrowserSpeech(text);
        }
      }
    } catch (error) {
      console.error('Error generating audio:', error);
      // Fallback to browser speech synthesis
      playWithBrowserSpeech(text);
    } finally {
      setAudioLoading(false);
    }
  };

  // Fallback to browser speech synthesis
  const playWithBrowserSpeech = (text: string) => {
    try {
      if (!window.speechSynthesis) {
        console.error('Speech synthesis not supported');
        alert('Speech synthesis is not supported in this browser');
        return;
      }

      if (isPlaying) {
        speechSynthesis.cancel();
        setIsPlaying(false);
        return;
      }

      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);

      const speakWithVoice = () => {
        const voices = speechSynthesis.getVoices();
        const femaleVoice =
          voices.find(
            voice =>
              voice.name.includes('Samantha') ||
              voice.name.includes('Victoria') ||
              voice.name.includes('Karen') ||
              voice.name.includes('Alex') ||
              voice.name.includes('Female') ||
              (voice.lang.startsWith('en') && voice.name.includes('female'))
          ) || voices[0];

        if (femaleVoice) {
          utterance.voice = femaleVoice;
        }

        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 0.9;

        utterance.onstart = () => {
          console.log('Browser speech started');
          setIsPlaying(true);
        };
        utterance.onend = () => {
          console.log('Browser speech ended');
          setIsPlaying(false);
        };
        utterance.onerror = event => {
          console.error('Browser speech error:', event);
          setIsPlaying(false);
        };

        speechSynthesis.speak(utterance);
      };

      if (speechSynthesis.getVoices().length > 0) {
        speakWithVoice();
      } else {
        speechSynthesis.onvoiceschanged = speakWithVoice;
      }
    } catch (error) {
      console.error('Error with browser speech synthesis:', error);
      alert('Unable to play audio. Please try again.');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-visible border border-gray-200">
      <div className="p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-[120px] h-[80px] rounded-lg overflow-hidden relative">
              {cartoonLoading && (
                <div className="absolute inset-0 bg-blue-100 flex items-center justify-center z-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              )}
              {cartoonUrl && !imageError ? (
                <Image
                  src={
                    useProxy
                      ? `/api/proxy-image?url=${encodeURIComponent(cartoonUrl)}`
                      : cartoonUrl
                  }
                  alt={article.title}
                  width={120}
                  height={80}
                  className="w-full h-full object-cover"
                  onError={handleImageError}
                  priority={true}
                  unoptimized={true}
                />
              ) : (
                <div className="w-[120px] h-[80px] bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-gray-400 text-2xl mb-1">🎨</div>
                    <div className="text-xs text-gray-500 font-medium">
                      CARTOON
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 min-w-0">
                <h3
                  className="text-xl md:text-2xl font-black text-gray-900 mb-0 leading-tight"
                  style={{
                    fontFamily:
                      'var(--font-architects-daughter), "Architects Daughter", "Comic Sans MS", cursive',
                    textTransform: 'uppercase',
                    fontWeight: '900',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.1'
                  }}>
                  {article.title.includes(' - ')
                    ? article.title.split(' - ')[0]
                    : article.title}
                </h3>
                <div className="flex items-center space-x-2 mt-1">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 transition-colors duration-200 cursor-pointer underline">
                    {article.source.name}
                  </a>
                  <span className="text-xs text-gray-500">
                    {new Date(article.publishedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="mt-3 sm:mt-0 sm:ml-8 flex-shrink-0 flex space-x-2 pt-1 sm:pt-0">
                <button
                  onClick={handleExplain}
                  disabled={isLoading}
                  onMouseEnter={() => {
                    const timer = setTimeout(() => {
                      setShowTooltip(true);
                    }, 2000);
                    // Store timer reference to clear on mouse leave
                    if (buttonRef.current) {
                      (buttonRef.current as any).tooltipTimer = timer;
                    }
                  }}
                  onMouseLeave={() => {
                    if (
                      buttonRef.current &&
                      (buttonRef.current as any).tooltipTimer
                    ) {
                      clearTimeout((buttonRef.current as any).tooltipTimer);
                    }
                    setShowTooltip(false);
                  }}
                  ref={buttonRef}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors duration-200 relative group">
                  <span
                    className={`text-2xl inline-block ${
                      isLoading ? 'animate-pulse' : ''
                    }`}
                    style={
                      isLoading
                        ? {
                            animation: 'shake 1.2s infinite',
                            transform: 'translateZ(0)'
                          }
                        : {}
                    }>
                    {isExpanded ? '🙈' : '🤓'}
                  </span>
                  <div
                    className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 hidden lg:block ${
                      showTooltip ? 'opacity-100' : 'opacity-0'
                    }`}>
                    Tell me more!
                  </div>
                </button>

                {isExpanded && article.simpleExplanation && (
                  <button
                    onClick={() => {
                      console.log(
                        'Button clicked, isPlaying:',
                        isPlaying,
                        'currentAudio:',
                        !!currentAudio
                      );

                      if (isPlaying) {
                        console.log('Attempting to stop audio...');
                        setIsStopping(true); // Set flag to prevent playback
                        // Stop audio
                        if (currentAudio) {
                          console.log('Stopping ElevenLabs audio');
                          // Stop ElevenLabs audio
                          currentAudio.pause();
                          currentAudio.currentTime = 0;
                          // Remove all event listeners
                          currentAudio.onended = null;
                          currentAudio.onerror = null;
                          currentAudio.onloadstart = null;
                          currentAudio.oncanplay = null;
                          // Immediately clear the audio element
                          const audioToStop = currentAudio;
                          setCurrentAudio(null);
                          setIsPlaying(false);
                          setIsStopping(false); // Clear flag
                          // Force garbage collection of the audio element
                          setTimeout(() => {
                            if (audioToStop) {
                              audioToStop.src = '';
                              audioToStop.load();
                            }
                          }, 0);
                          return; // Important: return here to prevent replay
                        } else {
                          console.log('Stopping browser speech');
                          // Stop browser speech
                          speechSynthesis.cancel();
                          setIsPlaying(false);
                          setIsStopping(false); // Clear flag
                          return; // Important: return here to prevent replay
                        }
                      }

                      console.log('Starting audio playback...');
                      // Only generate/play if not currently playing and not stopping
                      if (audioUrl && !isStopping) {
                        // Play existing audio
                        const audio = new Audio(audioUrl);
                        setCurrentAudio(audio);
                        audio.onended = () => {
                          console.log('Audio ended naturally');
                          setIsPlaying(false);
                          setCurrentAudio(null);
                        };
                        audio.onerror = e => {
                          console.error('Audio playback error:', e);
                          setIsPlaying(false);
                          setCurrentAudio(null);
                        };
                        audio.onloadstart = () => {
                          console.log('Audio loading started');
                          setIsPlaying(true);
                        };
                        audio.oncanplay = () => {
                          console.log('Audio can play, starting playback');
                          if (!isStopping) {
                            audio.play().catch(e => {
                              console.error('Failed to play audio:', e);
                              setIsPlaying(false);
                              setCurrentAudio(null);
                            });
                          } else {
                            console.log('Skipping playback because stopping');
                          }
                        };
                        audio.load(); // Explicitly load the audio
                      } else {
                        // Generate new audio
                        if (article.simpleExplanation) {
                          generateAudio(article.simpleExplanation);
                        }
                      }
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-0">
                    <span className="text-2xl">
                      {audioLoading ? '⏳' : isPlaying ? '⏹️' : '👂'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {isExpanded && article.simpleExplanation && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
            <p className="text-sm text-blue-700 leading-relaxed kid-summary">
              {article.simpleExplanation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
