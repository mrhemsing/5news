'use client';

import { useState, useEffect } from 'react';
import { NewsArticle } from '@/types/news';
import NewsCard from '@/components/NewsCard';
import Logo from '@/components/Logo';

export default function Home() {
  // Test deployment - 2025-01-07
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failedArticles, setFailedArticles] = useState<Set<string>>(new Set());
  const [validArticles, setValidArticles] = useState<NewsArticle[]>([]);
  const [validatingArticles, setValidatingArticles] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [usageInfo, setUsageInfo] = useState<any>(null);

  useEffect(() => {
    const initializeApp = async () => {
      // Add 1-second fake delay on initial load
      await new Promise(resolve => setTimeout(resolve, 1000));
      setInitialLoading(false);
      fetchNews();
      
      // Fetch usage info
      try {
        const response = await fetch('/api/usage');
        if (response.ok) {
          const data = await response.json();
          setUsageInfo(data);
        }
      } catch (error) {
        console.error('Error fetching usage info:', error);
      }
    };

    initializeApp();
  }, []);

  // Set up automatic background refresh every 6 hours (reduced from 1 hour to save API calls)
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('Auto-refreshing headlines...');
      setBackgroundRefreshing(true);
      fetchNews(1, false, true).finally(() => {
        setBackgroundRefreshing(false);
      });
    }, 6 * 60 * 60 * 1000); // 6 hours in milliseconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      const threshold = documentHeight - 1000;

      if (scrollPosition >= threshold) {
        if (hasMore && !loadingMore && !loading) {
          fetchNews(page + 1, true);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, loadingMore, loading]); // Removed 'page' from dependencies

  const fetchNews = async (pageNum = 1, append = false, forceRefresh = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      // Add 1-second delay for lazy loading
      if (append) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const refreshParam = forceRefresh ? '&refresh=true' : '';
      const response = await fetch(`/api/news?page=${pageNum}${refreshParam}`);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            'Rate limit exceeded. Please try again in a few minutes.'
          );
        }
        throw new Error('Failed to fetch news');
      }

      const data = await response.json();

      if (append) {
        setArticles(prev => [...prev, ...data.articles]);
        setValidArticles(prev => [...prev, ...data.articles]);
      } else {
        setArticles(data.articles);
        setValidArticles(data.articles);
      }

      setHasMore(data.hasMore);
      setPage(pageNum);
    } catch (err) {
      setError('Failed to load news. Please try again later.');
      console.error('Error fetching news:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleExplain = (articleId: string, explanation: string) => {
    setValidArticles(prevArticles =>
      prevArticles.map(article =>
        article.id === articleId
          ? { ...article, simpleExplanation: explanation }
          : article
      )
    );
  };

  const handleExplainError = (articleId: string) => {
    setFailedArticles(prev => {
      const newSet = new Set(prev);
      newSet.add(articleId);
      return newSet;
    });
  };

  const testArticlesForValidity = async (
    articlesToTest: NewsArticle[],
    showAnimation = false
  ) => {
    if (showAnimation) {
      setValidatingArticles(true);
    }
    const validArticlesList: NewsArticle[] = [];

    for (const article of articlesToTest) {
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
            validArticlesList.push(article);
          }
        }
      } catch (error) {
        console.error('Error testing article:', error);
      }
    }

    setValidArticles(prev => [...prev, ...validArticlesList]);
    if (showAnimation) {
      setValidatingArticles(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Give me one teeny-tiny moment — your stories are coming!
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Loading the latest news...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 text-red-700 dark:text-red-400 px-4 py-3 rounded">
              {error}
            </div>
            <button
              onClick={() => fetchNews()}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo />
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            TODAY&apos;S TOP HEADLINES
            <br className="block md:hidden" />
            <span className="hidden md:inline"> </span>
            MADE KID FRIENDLY
          </p>
          {backgroundRefreshing && (
            <div className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center justify-center">
              <span className="animate-spin mr-1">🔄</span>
              Refreshing headlines...
            </div>
          )}
          {usageInfo && (
            <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center justify-center space-x-4">
                <span>API Usage: {usageInfo.percentageUsed}% ({usageInfo.remainingCalls} remaining)</span>
                <span>•</span>
                <span>Cache: {usageInfo.cacheStrategy.duration}</span>
              </div>
            </div>
          )}
        </div>

        {/* News Grid */}
        <div className="max-w-4xl mx-auto space-y-6">
          {validArticles
            .filter(article => !failedArticles.has(article.id))
            .map(article => (
              <NewsCard
                key={article.id}
                article={article}
                onExplain={handleExplain}
                onExplainError={handleExplainError}
              />
            ))}

          {/* Loading More Indicator */}
          {loadingMore && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Loading more articles..
              </p>
            </div>
          )}

          {/* Load More Button (for testing) */}
          {hasMore && !loadingMore && (
            <div className="text-center py-8">
              <button
                onClick={() => fetchNews(page + 1, true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors duration-200">
                Load More Headlines
              </button>
            </div>
          )}

          {/* End of Results */}
          {!hasMore && articles.length > 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                You&apos;ve reached the end of the headlines!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Powered by NewsAPI.org and OpenAI.</p>
        </div>
      </div>
    </div>
  );
}
