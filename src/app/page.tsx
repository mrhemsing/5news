'use client';

import { useState, useEffect, useRef } from 'react';
import { NewsArticle } from '@/types/news';
import NewsCard from '@/components/NewsCard';
import Logo from '@/components/Logo';

export default function Home() {
  // Test deployment - 2025-01-07
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failedArticles, setFailedArticles] = useState<Set<string>>(new Set());
  // Removed validArticles state - using only articles
  const [initialLoading, setInitialLoading] = useState(true);

  const currentRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      console.log('Initializing app...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      setInitialLoading(false);
      console.log('Initial loading complete, checking localStorage...');

      const savedArticles = localStorage.getItem('5news-articles');
      if (savedArticles) {
        try {
          const parsedData = JSON.parse(savedArticles);
          console.log('Found saved articles in localStorage:', parsedData);
          const isRecent =
            parsedData.timestamp &&
            Date.now() - parsedData.timestamp < 2 * 60 * 60 * 1000;
          if (
            isRecent &&
            Array.isArray(parsedData.articles) &&
            parsedData.articles.length > 0
          ) {
            console.log(
              'Restoring articles from localStorage:',
              parsedData.articles.length
            );
            setArticles(parsedData.articles);
            setLoading(false); // Set loading to false when restoring from localStorage
            console.log('Articles restored, loading state set to false');
            // Return a flag indicating we restored articles
            return true;
          } else {
            console.log('Saved articles are stale or invalid, cleaning up...');
            localStorage.removeItem('5news-articles');
          }
        } catch (error) {
          console.error('Error parsing saved articles:', error);
          localStorage.removeItem('5news-articles');
        }
      } else {
        console.log('No saved articles found in localStorage');
      }

      console.log('Proceeding to fetch news...');
      fetchNews();
      return false;
    };

    // Add a safety timeout ONLY for initial page load
    let safetyTimeout: NodeJS.Timeout | null = null;

    initializeApp().then(articlesRestored => {
      // Only set safety timeout if we didn't restore articles from localStorage
      if (!articlesRestored) {
        safetyTimeout = setTimeout(() => {
          console.log('Safety timeout triggered - forcing loading to false');
          setLoading(false);
          // Only show error if we don't have any articles yet
          if (articles.length === 0) {
            setError('Loading timeout - please refresh the page');
          }
        }, 30000); // 30 seconds
      }
    });

    return () => {
      if (safetyTimeout) {
        clearTimeout(safetyTimeout);
      }
      // Abort any ongoing request when component unmounts
      if (currentRequestRef.current) {
        currentRequestRef.current.abort();
      }
    };
  }, []); // Remove currentRequest dependency to prevent re-runs

  // Save articles to localStorage whenever they change
  useEffect(() => {
    if (articles.length > 0) {
      const articleData = {
        articles,
        timestamp: Date.now(),
        count: articles.length
      };
      localStorage.setItem('5news-articles', JSON.stringify(articleData));
    }
  }, [articles]);

  // Handle page visibility changes (when user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && articles.length > 0) {
        // Check if articles are stale (older than 1 hour)
        const lastUpdate = localStorage.getItem('5news-articles');
        if (lastUpdate) {
          try {
            const parsedData = JSON.parse(lastUpdate);
            const isStale =
              parsedData.timestamp &&
              Date.now() - parsedData.timestamp > 60 * 60 * 1000;
            if (isStale) {
              console.log('Articles are stale, refreshing...');
              fetchNews(1, false, true);
            }
          } catch (error) {
            console.error('Error checking article freshness:', error);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [articles]);

  // Set up automatic background refresh every 6 hours (reduced from 1 hour to save API calls)
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('Auto-refreshing headlines...');
      fetchNews(1, false, true);
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
        // Use a separate timeout for pagination to avoid conflicts with main loading
        setTimeout(() => {
          fetchNews(page + 1, true);
        }, 100);
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
    console.log(
      `fetchNews called: pageNum=${pageNum}, append=${append}, forceRefresh=${forceRefresh}, currentArticles=${articles.length}`
    );

    // Don't fetch if we already have articles and this isn't a force refresh
    if (!forceRefresh && pageNum === 1 && articles.length > 0) {
      console.log('Articles already loaded, skipping fetch');
      setLoading(false); // Ensure loading is set to false when skipping
      return;
    }

    // Prevent multiple simultaneous requests (check before setting loading state)
    if (loading && !append) {
      console.log('Already loading, skipping duplicate request');
      return;
    }

    // Set loading state first - only set main loading for first page
    if (pageNum === 1) {
      setLoading(true);
      setError(null); // Clear any previous errors
    } else {
      setLoadingMore(true);
    }

    // Abort any existing request
    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
    }

    // Create an AbortController for this request
    const abortController = new AbortController();
    currentRequestRef.current = abortController;

    try {
      // Add 1-second delay for lazy loading
      if (append) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const refreshParam = forceRefresh ? '&refresh=true' : '';
      const response = await fetch(`/api/news?page=${pageNum}${refreshParam}`, {
        signal: abortController.signal
      });

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

        // Check if we already have these articles to prevent duplicates
        const existingUrls = new Set(
          articles.map((article: NewsArticle) => article.url)
        );
        const uniqueNewArticles = newArticles.filter(
          (article: NewsArticle) => !existingUrls.has(article.url)
        );

        if (uniqueNewArticles.length > 0) {
          // Simply append new articles - API already handles deduplication and sorting
          setArticles(prev => [...prev, ...uniqueNewArticles]);
        }

        // If no new articles were added or we've reached the end, we've reached the end
        if (
          uniqueNewArticles.length === 0 ||
          endIndex >= data.articles.length
        ) {
          setHasMore(false);
          setLoadingMore(false); // Reset loading state when no more articles
        }
      } else {
        // For the first page or force refresh, replace all articles
        const articlesPerPage = 20;
        const initialArticles = data.articles.slice(0, articlesPerPage);
        setArticles(initialArticles);

        // Reset pagination state
        setPage(1);
        setHasMore(data.articles.length > articlesPerPage);

        // Clear localStorage on force refresh to ensure fresh state
        if (forceRefresh) {
          localStorage.removeItem('5news-articles');
        }
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
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Fetch request was aborted');
        return;
      }
      setError('Failed to load news. Please try again later.');
      console.error('Error fetching news:', err);
    } finally {
      console.log('fetchNews finally block: setting loading states to false');
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleExplain = (articleId: string, explanation: string) => {
    setArticles(prevArticles =>
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
      <div className="min-h-screen relative overflow-hidden">
        {/* Children's Wallpaper Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-green-100 to-yellow-100">
          {/* Hand-drawn Dinosaurs and Cartoons */}
          <div className="absolute top-10 left-10 w-16 h-16 opacity-20">
            <div className="w-full h-full bg-green-400 rounded-full"></div>
            <div className="absolute -bottom-2 left-2 w-8 h-4 bg-green-500 rounded-full"></div>
            <div className="absolute top-2 right-2 w-3 h-3 bg-green-600 rounded-full"></div>
            <div className="absolute top-4 left-1 w-2 h-2 bg-green-700 rounded-full"></div>
          </div>

          <div className="absolute top-32 right-16 w-20 h-16 opacity-20">
            <div className="w-full h-20 bg-orange-400 rounded-full"></div>
            <div className="absolute -bottom-4 left-4 w-12 h-6 bg-orange-500 rounded-full"></div>
            <div className="absolute top-6 right-4 w-4 h-4 bg-orange-600 rounded-full"></div>
            <div className="absolute top-8 left-2 w-3 h-3 bg-orange-700 rounded-full"></div>
          </div>

          <div className="absolute bottom-20 left-20 w-14 h-12 opacity-20">
            <div className="w-full h-16 bg-purple-400 rounded-full"></div>
            <div className="absolute -bottom-3 left-3 w-10 h-5 bg-purple-500 rounded-full"></div>
            <div className="absolute top-5 right-3 w-3 h-3 bg-purple-600 rounded-full"></div>
          </div>

          <div className="absolute bottom-32 right-24 w-18 h-14 opacity-20">
            <div className="w-full h-18 bg-pink-400 rounded-full"></div>
            <div className="absolute -bottom-3 left-4 w-12 h-6 bg-pink-500 rounded-full"></div>
            <div className="absolute top-6 right-4 w-4 h-4 bg-pink-600 rounded-full"></div>
          </div>

          {/* Floating Cartoon Elements */}
          <div className="absolute top-1/4 left-1/3 w-8 h-8 opacity-15">
            <div className="w-full h-full bg-yellow-300 rounded-full"></div>
            <div className="absolute top-1 left-1 w-6 h-6 bg-yellow-400 rounded-full"></div>
          </div>

          <div className="absolute top-3/4 right-1/4 w-6 h-6 opacity-15">
            <div className="w-full h-full bg-blue-300 rounded-full"></div>
            <div className="absolute top-1 left-1 w-4 h-4 bg-blue-400 rounded-full"></div>
          </div>

          <div className="absolute top-1/2 left-1/4 w-10 h-10 opacity-15">
            <div className="w-full h-full bg-red-300 rounded-full"></div>
            <div className="absolute top-1 left-1 w-8 h-8 bg-red-400 rounded-full"></div>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p
              className="mt-8 text-gray-700 font-bold text-base md:text-xl"
              style={{ fontFamily: 'Eraser, cursive' }}>
              GIVE ME ONE TEENY-TINY MOMENT —<br />
              YOUR STORIES ARE COMING!
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Children's Wallpaper Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-green-100 to-yellow-100">
          {/* Hand-drawn Dinosaurs and Cartoons */}
          <div className="absolute top-10 left-10 w-16 h-16 opacity-20">
            <div className="w-full h-full bg-green-400 rounded-full"></div>
            <div className="absolute -bottom-2 left-2 w-8 h-4 bg-green-500 rounded-full"></div>
            <div className="absolute top-2 right-2 w-3 h-3 bg-green-600 rounded-full"></div>
            <div className="absolute top-4 left-1 w-2 h-2 bg-green-700 rounded-full"></div>
          </div>

          <div className="absolute top-32 right-16 w-20 h-16 opacity-20">
            <div className="w-full h-20 bg-orange-400 rounded-full"></div>
            <div className="absolute -bottom-4 left-4 w-12 h-6 bg-orange-500 rounded-full"></div>
            <div className="absolute top-6 right-4 w-4 h-4 bg-orange-600 rounded-full"></div>
            <div className="absolute top-8 left-2 w-3 h-3 bg-orange-700 rounded-full"></div>
          </div>

          <div className="absolute bottom-20 left-20 w-14 h-12 opacity-20">
            <div className="w-full h-16 bg-purple-400 rounded-full"></div>
            <div className="absolute -bottom-3 left-3 w-10 h-5 bg-purple-500 rounded-full"></div>
            <div className="absolute top-5 right-3 w-3 h-3 bg-purple-600 rounded-full"></div>
          </div>

          <div className="absolute bottom-32 right-24 w-18 h-14 opacity-20">
            <div className="w-full h-18 bg-pink-400 rounded-full"></div>
            <div className="absolute -bottom-3 left-4 w-12 h-6 bg-pink-500 rounded-full"></div>
            <div className="absolute top-6 right-4 w-4 h-4 bg-pink-600 rounded-full"></div>
          </div>

          {/* Floating Cartoon Elements */}
          <div className="absolute top-1/4 left-1/3 w-8 h-8 opacity-15">
            <div className="w-full h-full bg-yellow-300 rounded-full"></div>
            <div className="absolute top-1 left-1 w-6 h-6 bg-yellow-400 rounded-full"></div>
          </div>

          <div className="absolute top-3/4 right-1/4 w-6 h-6 opacity-15">
            <div className="w-full h-full bg-blue-300 rounded-full"></div>
            <div className="absolute top-1 left-1 w-4 h-4 bg-blue-400 rounded-full"></div>
          </div>

          <div className="absolute top-1/2 left-1/4 w-10 h-10 opacity-15">
            <div className="w-full h-full bg-red-300 rounded-full"></div>
            <div className="absolute top-1 left-1 w-8 h-8 bg-red-400 rounded-full"></div>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p
                className="mt-8 text-gray-600 dark:text-gray-400 font-bold text-base md:text-xl"
                style={{ fontFamily: 'Eraser, cursive' }}>
                Loading the latest news...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Children's Wallpaper Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-green-100 to-yellow-100">
          {/* Hand-drawn Dinosaurs and Cartoons */}
          <div className="absolute top-10 left-10 w-16 h-16 opacity-20">
            <div className="w-full h-full bg-green-400 rounded-full"></div>
            <div className="absolute -bottom-2 left-2 w-8 h-4 bg-green-500 rounded-full"></div>
            <div className="absolute top-2 right-2 w-3 h-3 bg-green-600 rounded-full"></div>
            <div className="absolute top-4 left-1 w-2 h-2 bg-green-700 rounded-full"></div>
          </div>

          <div className="absolute top-32 right-16 w-20 h-16 opacity-20">
            <div className="w-full h-20 bg-orange-400 rounded-full"></div>
            <div className="absolute -bottom-4 left-4 w-12 h-6 bg-orange-500 rounded-full"></div>
            <div className="absolute top-6 right-4 w-4 h-4 bg-orange-600 rounded-full"></div>
            <div className="absolute top-8 left-2 w-3 h-3 bg-orange-700 rounded-full"></div>
          </div>

          <div className="absolute bottom-20 left-20 w-14 h-12 opacity-20">
            <div className="w-full h-16 bg-purple-400 rounded-full"></div>
            <div className="absolute -bottom-3 left-3 w-10 h-5 bg-purple-500 rounded-full"></div>
            <div className="absolute top-5 right-3 w-3 h-3 bg-purple-600 rounded-full"></div>
          </div>

          <div className="absolute bottom-32 right-24 w-18 h-14 opacity-20">
            <div className="w-full h-18 bg-pink-400 rounded-full"></div>
            <div className="absolute -bottom-3 left-4 w-12 h-6 bg-pink-500 rounded-full"></div>
            <div className="absolute top-6 right-4 w-4 h-4 bg-pink-600 rounded-full"></div>
          </div>

          {/* Floating Cartoon Elements */}
          <div className="absolute top-1/4 left-1/3 w-8 h-8 opacity-15">
            <div className="w-full h-full bg-yellow-300 rounded-full"></div>
            <div className="absolute top-1 left-1 w-6 h-6 bg-yellow-400 rounded-full"></div>
          </div>

          <div className="absolute top-3/4 right-1/4 w-6 h-6 opacity-15">
            <div className="w-full h-full bg-blue-300 rounded-full"></div>
            <div className="absolute top-1 left-1 w-4 h-4 bg-blue-400 rounded-full"></div>
          </div>

          <div className="absolute top-1/2 left-1/4 w-10 h-10 opacity-15">
            <div className="w-full h-full bg-red-300 rounded-full"></div>
            <div className="absolute top-1 left-1 w-8 h-8 bg-red-400 rounded-full"></div>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Children's Wallpaper Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-green-100 to-yellow-100">
        {/* Hand-drawn Dinosaurs and Cartoons */}
        <div className="absolute top-10 left-10 w-16 h-16 opacity-20">
          <div className="w-full h-full bg-green-400 rounded-full"></div>
          <div className="absolute -bottom-2 left-2 w-8 h-4 bg-green-500 rounded-full"></div>
          <div className="absolute top-2 right-2 w-3 h-3 bg-green-600 rounded-full"></div>
          <div className="absolute top-4 left-1 w-2 h-2 bg-green-700 rounded-full"></div>
        </div>

        <div className="absolute top-32 right-16 w-20 h-16 opacity-20">
          <div className="w-full h-20 bg-orange-400 rounded-full"></div>
          <div className="absolute -bottom-4 left-4 w-12 h-6 bg-orange-500 rounded-full"></div>
          <div className="absolute top-6 right-4 w-4 h-4 bg-orange-600 rounded-full"></div>
          <div className="absolute top-8 left-2 w-3 h-3 bg-orange-700 rounded-full"></div>
        </div>

        <div className="absolute bottom-20 left-20 w-14 h-12 opacity-20">
          <div className="w-full h-16 bg-purple-400 rounded-full"></div>
          <div className="absolute -bottom-3 left-3 w-10 h-5 bg-purple-500 rounded-full"></div>
          <div className="absolute top-5 right-3 w-3 h-3 bg-purple-600 rounded-full"></div>
        </div>

        <div className="absolute bottom-32 right-24 w-18 h-14 opacity-20">
          <div className="w-full h-18 bg-pink-400 rounded-full"></div>
          <div className="absolute -bottom-3 left-4 w-12 h-6 bg-pink-500 rounded-full"></div>
          <div className="absolute top-6 right-4 w-4 h-4 bg-pink-600 rounded-full"></div>
        </div>

        {/* Floating Cartoon Elements */}
        <div className="absolute top-1/4 left-1/3 w-8 h-8 opacity-15">
          <div className="w-full h-full bg-yellow-300 rounded-full"></div>
          <div className="absolute top-1 left-1 w-6 h-6 bg-yellow-400 rounded-full"></div>
        </div>

        <div className="absolute top-3/4 right-1/4 w-6 h-6 opacity-15">
          <div className="w-full h-full bg-blue-300 rounded-full"></div>
          <div className="absolute top-1 left-1 w-4 h-4 bg-blue-400 rounded-full"></div>
        </div>

        <div className="absolute top-1/2 left-1/4 w-10 h-10 opacity-15">
          <div className="w-full h-full bg-red-300 rounded-full"></div>
          <div className="absolute top-1 left-1 w-8 h-8 bg-red-400 rounded-full"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10">
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
                  background:
                    'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
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
          </div>

          {/* News Grid */}
          <div className="max-w-4xl mx-auto space-y-6">
            {articles
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
    </div>
  );
}
