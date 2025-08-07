'use client';

import { useState, useEffect, useRef } from 'react';
import { NewsArticle } from '@/types/news';
import Image from 'next/image';

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
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Clear cartoon URL when image fails to load
  const handleImageError = () => {
    console.log('Cartoon image failed to load:', cartoonUrl);
    setImageError(true);
    setCartoonUrl(null); // Clear the URL to prevent further attempts

    // Retry cartoon generation if we haven't exceeded max retries
    if (retryCount < 2) {
      console.log('Retrying cartoon generation due to image load failure');
      setTimeout(() => {
        setRetryCount(retryCount + 1);
        generateCartoon(article.title, retryCount + 1);
      }, 2000); // Wait 2 seconds before retry
    }
  };

  // Generate cartoon when component mounts based on headline
  useEffect(() => {
    if (!cartoonUrl && !cartoonLoading) {
      setRetryCount(0); // Reset retry count for new headline
      generateCartoon(article.title);
    }
  }, [article.title]);

  const generateCartoon = async (headline: string, retryAttempt = 0) => {
    if (cartoonUrl || cartoonLoading) return;

    setCartoonLoading(true);
    try {
      console.log(
        `Generating cartoon for headline (attempt ${retryAttempt + 1}):`,
        headline
      );
      const response = await fetch('/api/cartoonize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ headline })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Cartoon response:', data);
        if (data.cartoonUrl) {
          setCartoonUrl(data.cartoonUrl);
          setRetryCount(0); // Reset retry count on success
          // If it was cached or fallback, we can stop loading immediately
          if (data.cached || data.fallback) {
            setCartoonLoading(false);
          }
        } else {
          // No cartoon URL returned, try to retry
          throw new Error('No cartoon URL returned');
        }
      } else {
        console.error('Cartoon API error:', response.status);
        throw new Error(`Cartoon API error: ${response.status}`);
      }
    } catch (error) {
      console.error(
        `Error generating cartoon (attempt ${retryAttempt + 1}):`,
        error
      );

      // Retry logic - up to 3 attempts with exponential backoff
      if (retryAttempt < 2) {
        const delay = Math.pow(2, retryAttempt) * 1000; // 1s, 2s, 4s delays
        console.log(`Retrying cartoon generation in ${delay}ms...`);
        setTimeout(() => {
          setRetryCount(retryAttempt + 1);
          generateCartoon(headline, retryAttempt + 1);
        }, delay);
      } else {
        console.log('Max retry attempts reached for cartoon generation');
        setRetryCount(0); // Reset for next time
      }
    } finally {
      if (retryAttempt >= 2) {
        setCartoonLoading(false);
      }
    }
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
    if (audioLoading) return;

    setAudioLoading(true);
    try {
      console.log('Generating audio for text:', text.substring(0, 100) + '...');
      console.log('Clearing any existing audio URL to force regeneration');
      setAudioUrl(null); // Clear existing audio to force regeneration

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.audioData) {
          // Convert base64 to blob URL
          const audioBlob = new Blob(
            [Uint8Array.from(atob(data.audioData), c => c.charCodeAt(0))],
            { type: 'audio/mpeg' }
          );
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
          console.log('Audio generated successfully');

          // Automatically play the audio
          const audio = new Audio(url);
          setCurrentAudio(audio);
          audio.onended = () => {
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-visible border border-gray-200 dark:border-gray-700">
      <div className="p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-[120px] h-[80px] rounded-lg overflow-hidden relative">
              {cartoonLoading && (
                <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center z-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              )}
              {cartoonUrl && !imageError ? (
                <Image
                  src={cartoonUrl}
                  alt={article.title}
                  width={120}
                  height={80}
                  className="w-full h-full object-cover"
                  onError={handleImageError}
                  priority={true}
                  unoptimized={true}
                />
              ) : (
                <div className="w-[120px] h-[80px] bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-gray-400 dark:text-gray-500 text-2xl mb-1">
                      🎨
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-0 leading-tight kid-headline">
                  {article.title.includes(' - ')
                    ? article.title.split(' - ')[0]
                    : article.title}
                </h3>
                <div className="flex items-center space-x-2 mt-1">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200 cursor-pointer underline">
                    {article.source.name}
                  </a>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(article.publishedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="mt-3 sm:mt-0 sm:ml-8 flex-shrink-0 flex space-x-2">
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
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-400">
            <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed kid-summary">
              {article.simpleExplanation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
