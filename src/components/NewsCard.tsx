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
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Generate cartoon when component mounts based on headline
  useEffect(() => {
    if (!cartoonUrl && !cartoonLoading) {
      generateCartoon(article.title);
    }
  }, [article.title]);

  const generateCartoon = async (headline: string) => {
    if (cartoonUrl || cartoonLoading) return;

    setCartoonLoading(true);
    try {
      console.log('Generating cartoon for headline:', headline);
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
          // If it was cached or fallback, we can stop loading immediately
          if (data.cached || data.fallback) {
            setCartoonLoading(false);
          }
        }
      } else {
        console.error('Cartoon API error:', response.status);
      }
    } catch (error) {
      console.error('Error generating cartoon:', error);
    } finally {
      setCartoonLoading(false);
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
              {cartoonUrl ? (
                <Image
                  src={cartoonUrl}
                  alt={article.title}
                  width={120}
                  height={80}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                  priority={true}
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
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {article.source.name}
                  </span>
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
                    🤓
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
                      try {
                        // Check if speech synthesis is supported
                        if (!window.speechSynthesis) {
                          console.error('Speech synthesis not supported');
                          alert(
                            'Speech synthesis is not supported in this browser'
                          );
                          return;
                        }

                        if (isPlaying) {
                          // Stop speech
                          speechSynthesis.cancel();
                          setIsPlaying(false);
                          return;
                        }

                        // Cancel any ongoing speech
                        speechSynthesis.cancel();

                        const utterance = new SpeechSynthesisUtterance(
                          article.simpleExplanation
                        );

                        // Wait for voices to load if they're not available yet
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
                                (voice.lang.startsWith('en') &&
                                  voice.name.includes('female'))
                            ) || voices[0];

                          if (femaleVoice) {
                            utterance.voice = femaleVoice;
                          }

                          utterance.rate = 1.0;
                          utterance.pitch = 1.0;
                          utterance.volume = 0.9;

                          // Add event listeners for debugging and state management
                          utterance.onstart = () => {
                            console.log('Speech started');
                            setIsPlaying(true);
                          };
                          utterance.onend = () => {
                            console.log('Speech ended');
                            setIsPlaying(false);
                          };
                          utterance.onerror = event => {
                            console.error('Speech error:', event);
                            setIsPlaying(false);
                          };

                          speechSynthesis.speak(utterance);
                        };

                        // If voices are already loaded, speak immediately
                        if (speechSynthesis.getVoices().length > 0) {
                          speakWithVoice();
                        } else {
                          // Wait for voices to load
                          speechSynthesis.onvoiceschanged = speakWithVoice;
                        }
                      } catch (error) {
                        console.error('Error with speech synthesis:', error);
                        alert('Unable to play audio. Please try again.');
                      }
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-0">
                    <span className="text-2xl">{isPlaying ? '⏹️' : '👂'}</span>
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
