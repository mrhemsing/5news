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
  const [initialLoading, setInitialLoading] = useState(true);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      // Add 1-second fake delay on initial load
      await new Promise(resolve => setTimeout(resolve, 1000));
      setInitialLoading(false);
      fetchNews();
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
      // Don't trigger if we're already loading, don't have more articles, or are loading more
      if (loading || loadingMore || !hasMore) {
        return;
      }

      const scrollPosition = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      const threshold = documentHeight - 1000;

      if (scrollPosition >= threshold) {
        // Set loadingMore to true immediately to prevent multiple requests
        setLoadingMore(true);
        fetchNews(page + 1, true);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, loadingMore, loading, page]); // Added page back to dependencies

  const fetchNews = async (
    pageNum = 1,
    append = false,
    forceRefresh = false
  ) => {
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
        // For pagination, we need to handle it on the frontend since API returns all articles
        const articlesPerPage = 20;
        const startIndex = (pageNum - 1) * articlesPerPage;
        const endIndex = startIndex + articlesPerPage;
        const newArticles = data.articles.slice(startIndex, endIndex);

        // Deduplicate articles before appending
        const existingUrls = new Set(articles.map(article => article.url));
        const existingTitles = new Set(
          articles.map(article =>
            article.title
              .toLowerCase()
              .replace(/[^\w\s]/g, '')
              .trim()
          )
        );

        const filteredNewArticles = newArticles.filter(
          (article: NewsArticle) => {
            const url = article.url;
            const cleanTitle = article.title
              .toLowerCase()
              .replace(/[^\w\s]/g, '')
              .trim();

            // Check if URL or title already exists
            if (existingUrls.has(url)) {
              console.log(
                'Filtered out duplicate URL in frontend:',
                article.title
              );
              return false;
            }

            if (existingTitles.has(cleanTitle)) {
              console.log(
                'Filtered out duplicate title in frontend:',
                article.title
              );
              return false;
            }

            return true;
          }
        );

        setArticles(prev => [...prev, ...filteredNewArticles]);
        setValidArticles(prev => [...prev, ...filteredNewArticles]);

        // If no new articles were added or we've reached the end, we've reached the end
        if (
          filteredNewArticles.length === 0 ||
          endIndex >= data.articles.length
        ) {
          setHasMore(false);
          setLoadingMore(false); // Reset loading state when no more articles
        }
      } else {
        // For the first page, show the first 20 articles
        const articlesPerPage = 20;
        const initialArticles = data.articles.slice(0, articlesPerPage);
        setArticles(initialArticles);
        setValidArticles(initialArticles);
      }

      // Set hasMore based on whether there are more articles available
      const articlesPerPage = 20;
      const currentEndIndex = pageNum * articlesPerPage;
      const hasMoreArticles = currentEndIndex < data.articles.length;
      setHasMore(hasMoreArticles);

      // If no articles returned and we're loading more, reset the loading state
      if (append && (!data.articles || data.articles.length === 0)) {
        setLoadingMore(false);
      }

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
          <div className="flex justify-center mb-5">
            <Logo />
          </div>

          {/* Chalkboard subtitle */}
          <div className="w-full md:max-w-4xl md:mx-auto">
            <div
              className="mt-4 px-4 md:px-6 py-2 md:py-3 rounded-lg shadow-lg chalkboard-wrapper relative z-0 w-full md:w-fit md:mx-auto"
              style={{
                background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
                border: '3px solid #4a5568',
                boxShadow:
                  '0 4px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                maxWidth: '90vw'
              }}>
              {/* Top left bolt */}
              <div className="absolute top-2 left-2 w-3 h-3 md:w-4 md:h-4 bg-gray-600 rounded-full shadow-lg flex items-center justify-center">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-800 rounded-full"></div>
              </div>

              {/* Top right bolt */}
              <div className="absolute top-2 right-2 w-3 h-3 md:w-4 md:h-4 bg-gray-600 rounded-full shadow-lg flex items-center justify-center">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-800 rounded-full"></div>
              </div>

              <span
                className="chalk-text text-white font-bold text-base md:text-xl tracking-wide"
                style={{
                  fontFamily:
                    '"Eraser", "Indie Flower", "Chalkduster", "Chalkboard", "Comic Sans MS", "Comic Sans", cursive',
                  textShadow:
                    '2px 2px 4px rgba(0,0,0,0.8), 1px 1px 2px rgba(255,255,255,0.3), 0 0 8px rgba(255,255,255,0.1)',
                  color: '#ffffff',
                  fontWeight: 'bold',
                  letterSpacing: '0.08em',
                  transform: 'rotate(-0.5deg)',
                  display: 'inline-block',
                  lineHeight: '1.2'
                }}>
                <span
                  style={{
                    transform: 'rotate(1deg)',
                    display: 'inline-block'
                  }}>
                  T
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.8deg)',
                    display: 'inline-block'
                  }}>
                  O
                </span>
                <span
                  style={{
                    transform: 'rotate(0.3deg)',
                    display: 'inline-block'
                  }}>
                  D
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.2deg)',
                    display: 'inline-block'
                  }}>
                  A
                </span>
                <span
                  style={{
                    transform: 'rotate(0.7deg)',
                    display: 'inline-block'
                  }}>
                  Y
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.4deg)',
                    display: 'inline-block'
                  }}>
                  &apos;
                </span>
                <span
                  style={{
                    transform: 'rotate(0.1deg)',
                    display: 'inline-block'
                  }}>
                  S
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.6deg)',
                    display: 'inline-block',
                    marginRight: '0.3em'
                  }}>
                  {' '}
                </span>
                <span
                  style={{
                    transform: 'rotate(0.6deg)',
                    display: 'inline-block'
                  }}>
                  T
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.2deg)',
                    display: 'inline-block'
                  }}>
                  O
                </span>
                <span
                  style={{
                    transform: 'rotate(0.3deg)',
                    display: 'inline-block'
                  }}>
                  P
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.4deg)',
                    display: 'inline-block',
                    marginRight: '0.3em'
                  }}>
                  {' '}
                </span>
                <span
                  style={{
                    transform: 'rotate(0.6deg)',
                    display: 'inline-block'
                  }}>
                  A
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.2deg)',
                    display: 'inline-block'
                  }}>
                  B
                </span>
                <span
                  style={{
                    transform: 'rotate(0.3deg)',
                    display: 'inline-block'
                  }}>
                  C
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.4deg)',
                    display: 'inline-block',
                    marginRight: '0.3em'
                  }}>
                  {' '}
                </span>
                <span
                  style={{
                    transform: 'rotate(0.1deg)',
                    display: 'inline-block'
                  }}>
                  N
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.3deg)',
                    display: 'inline-block'
                  }}>
                  E
                </span>
                <span
                  style={{
                    transform: 'rotate(0.5deg)',
                    display: 'inline-block'
                  }}>
                  W
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.2deg)',
                    display: 'inline-block'
                  }}>
                  S
                </span>
                <br className="block md:hidden" />
                <span
                  style={{
                    transform: 'rotate(0.3deg)',
                    display: 'inline-block',
                    marginRight: '0.3em'
                  }}>
                  {' '}
                </span>
                <span
                  style={{
                    transform: 'rotate(0.6deg)',
                    display: 'inline-block'
                  }}>
                  H
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.2deg)',
                    display: 'inline-block'
                  }}>
                  E
                </span>
                <span
                  style={{
                    transform: 'rotate(0.3deg)',
                    display: 'inline-block'
                  }}>
                  A
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.4deg)',
                    display: 'inline-block'
                  }}>
                  D
                </span>
                <span
                  style={{
                    transform: 'rotate(0.1deg)',
                    display: 'inline-block'
                  }}>
                  L
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.7deg)',
                    display: 'inline-block'
                  }}>
                  I
                </span>
                <span
                  style={{
                    transform: 'rotate(0.5deg)',
                    display: 'inline-block'
                  }}>
                  N
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.3deg)',
                    display: 'inline-block'
                  }}>
                  E
                </span>
                <span
                  style={{
                    transform: 'rotate(0.2deg)',
                    display: 'inline-block'
                  }}>
                  S
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.6deg)',
                    display: 'inline-block',
                    marginRight: '0.3em',
                    lineHeight: '1.8'
                  }}>
                  {' '}
                </span>
                <span
                  style={{
                    transform: 'rotate(0.4deg)',
                    display: 'inline-block',
                    lineHeight: '1.8'
                  }}>
                  M
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.1deg)',
                    display: 'inline-block',
                    lineHeight: '1.8'
                  }}>
                  A
                </span>
                <span
                  style={{
                    transform: 'rotate(0.3deg)',
                    display: 'inline-block',
                    lineHeight: '1.8'
                  }}>
                  D
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.5deg)',
                    display: 'inline-block',
                    lineHeight: '1.8'
                  }}>
                  E
                </span>
                <span
                  style={{
                    transform: 'rotate(0.2deg)',
                    display: 'inline-block',
                    marginRight: '0.3em',
                    lineHeight: '1.8'
                  }}>
                  {' '}
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.4deg)',
                    display: 'inline-block',
                    lineHeight: '1.8'
                  }}>
                  K
                </span>
                <span
                  style={{
                    transform: 'rotate(0.6deg)',
                    display: 'inline-block',
                    lineHeight: '1.8'
                  }}>
                  I
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.3deg)',
                    display: 'inline-block',
                    lineHeight: '1.8'
                  }}>
                  D
                </span>
                <span
                  style={{
                    transform: 'rotate(0.1deg)',
                    display: 'inline-block',
                    marginRight: '0.3em',
                    lineHeight: '1.8'
                  }}>
                  {' '}
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.7deg)',
                    display: 'inline-block',
                    lineHeight: '1.8'
                  }}>
                  F
                </span>
                <span
                  style={{
                    transform: 'rotate(0.4deg)',
                    display: 'inline-block',
                    lineHeight: '1.8'
                  }}>
                  R
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.2deg)',
                    display: 'inline-block',
                    lineHeight: '1.8'
                  }}>
                  I
                </span>
                <span
                  style={{
                    transform: 'rotate(0.5deg)',
                    display: 'inline-block',
                    lineHeight: '1.8'
                  }}>
                  E
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.3deg)',
                    display: 'inline-block',
                    lineHeight: '1.8'
                  }}>
                  N
                </span>
                <span
                  style={{
                    transform: 'rotate(0.2deg)',
                    display: 'inline-block',
                    lineHeight: '1.8'
                  }}>
                  D
                </span>
                <span
                  style={{
                    transform: 'rotate(-0.6deg)',
                    display: 'inline-block',
                    lineHeight: '1.8'
                  }}>
                  L
                </span>
                <span
                  style={{
                    transform: 'rotate(0.1deg)',
                    display: 'inline-block',
                    lineHeight: '1.8'
                  }}>
                  Y
                </span>
              </span>
            </div>
          </div>

          {backgroundRefreshing && (
            <div className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center justify-center">
              <span className="animate-spin mr-1">🔄</span>
              Refreshing headlines...
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
          {hasMore && !loadingMore && articles.length > 0 && (
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
          <p>Powered by Google News RSS, OpenAI and Eleven Labs.</p>
        </div>
      </div>
    </div>
  );
}
