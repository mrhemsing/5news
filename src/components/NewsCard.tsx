'use client';

import { useState } from 'react';
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            {article.urlToImage && !imageError ? (
              <div className="w-[120px] h-[80px] rounded-lg overflow-hidden">
                <Image
                  src={article.urlToImage}
                  alt={article.title}
                  width={120}
                  height={80}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              </div>
            ) : (
              <div className="w-[120px] h-[80px] bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="text-gray-400 dark:text-gray-500 text-2xl mb-1">
                    📰
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    NEWS
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-0 leading-tight">
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

              <div className="mt-3 sm:mt-0 sm:ml-8 flex-shrink-0">
                <button
                  onClick={handleExplain}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors duration-200">
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
                    🤔
                  </span>{' '}
                  <span className="text-gray-300">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {isExpanded && article.simpleExplanation && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-400">
            <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
              {article.simpleExplanation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
