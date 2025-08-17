'use client';

import { useState, useEffect, useRef } from 'react';
import { NewsArticle } from '@/types/news';
import NewsCard from '@/components/NewsCard';
import Logo from '@/components/Logo';

export default function Home() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failedArticles, setFailedArticles] = useState<Set<string>>(new Set());
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
            Date.now() - parsedData.timestamp < 15 * 60 * 1000;
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
            setLoading(false);
            console.log('Articles restored, loading state set to false');
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
      fetchNews(1, false, false);
      return false;
    };

    initializeApp().then(() => {
      console.log('App initialized successfully');
    });

    return () => {
      if (currentRequestRef.current) {
        currentRequestRef.current.abort();
      }
    };
  }, []);

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

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && articles.length > 0) {
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

  useEffect(() => {
    const interval = setInterval(() => {
      console.log('Auto-refreshing headlines...');
      fetchNews(1, false, true);
    }, 6 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (loading || loadingMore || !hasMore) {
        return;
      }

      const scrollPosition = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      const threshold = documentHeight - 1000;

      if (scrollPosition >= threshold) {
        setLoadingMore(true);
        setTimeout(() => {
          fetchNews(page + 1, true);
        }, 100);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, loadingMore, loading, page]);

  const fetchNews = async (
    pageNum: number,
    append = false,
    forceRefresh = false
  ) => {
    console.log(
      `fetchNews called: pageNum=${pageNum}, append=${append}, forceRefresh=${forceRefresh}, currentArticles=${articles.length}`
    );

    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    if (isMobile && !forceRefresh && articles.length > 0) {
      const lastFetchTime = localStorage.getItem('5news-last-fetch');
      if (lastFetchTime) {
        const timeSinceLastFetch = Date.now() - parseInt(lastFetchTime);
        const fiveMinutes = 5 * 60 * 1000;
        if (timeSinceLastFetch > fiveMinutes) {
          console.log(
            `📱 Mobile detected with stale cache (${Math.round(
              timeSinceLastFetch / 1000
            )}s old) - forcing refresh`
          );
          forceRefresh = true;
        }
      }
    }

    if (!forceRefresh && pageNum === 1 && articles.length > 0) {
      console.log('Articles already loaded, skipping fetch');
      setLoading(false);
      return;
    }

    if (loading && !append) {
      console.log('Already loading, skipping duplicate request');
      return;
    }

    if (pageNum === 1) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
    }

    const abortController = new AbortController();
    currentRequestRef.current = abortController;

    try {
      if (append) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const refreshParam = forceRefresh ? '&refresh=true' : '';
      const timestampParam = isMobile ? `&_t=${Date.now()}` : '';
      const response = await fetch(
        `/api/news?page=${pageNum}${refreshParam}${timestampParam}`,
        {
          signal: abortController.signal
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            'Rate limit exceeded. Please try again in a few minutes.'
          );
        }
        throw new Error('Failed to fetch news');
      }

      const data = await response.json();
      console.log('API response data:', data);

      if (append) {
        const articlesPerPage = 20;
        const startIndex = (pageNum - 1) * articlesPerPage;
        const endIndex = startIndex + articlesPerPage;
        const newArticles = data.articles.slice(startIndex, endIndex);

        const existingUrls = new Set(
          articles.map((article: NewsArticle) => article.url)
        );
        const uniqueNewArticles = newArticles.filter(
          (article: NewsArticle) => !existingUrls.has(article.url)
        );

        if (uniqueNewArticles.length > 0) {
          setArticles(prev => [...prev, ...uniqueNewArticles]);
        }

        if (
          uniqueNewArticles.length === 0 ||
          endIndex >= data.articles.length
        ) {
          setHasMore(false);
          setLoadingMore(false);
        }
      } else {
        const articlesPerPage = 20;
        const initialArticles = data.articles.slice(0, articlesPerPage);
        setArticles(initialArticles);

        setPage(1);
        setHasMore(data.articles.length > articlesPerPage);

        if (forceRefresh) {
          localStorage.removeItem('5news-articles');
        }
      }

      const articlesPerPage = 20;
      const currentEndIndex = pageNum * articlesPerPage;
      const hasMoreArticles = currentEndIndex < data.articles.length;
      setHasMore(hasMoreArticles);

      if (isMobile) {
        localStorage.setItem('5news-last-fetch', Date.now().toString());
        console.log('📱 Updated mobile last fetch timestamp');
      }

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

      if (currentRequestRef.current === abortController) {
        currentRequestRef.current = null;
      }
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
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-green-100 to-yellow-100">
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
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-green-100 to-yellow-100">
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
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-green-100 to-yellow-100">
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

        <div className="relative z-10">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center">
              <div
                className={`px-4 py-3 rounded border ${
                  error.includes('initializing') || error.includes('populate')
                    ? 'bg-blue-100 dark:bg-blue-900/20 border-blue-400 text-blue-700 dark:text-blue-400'
                    : 'bg-red-100 dark:bg-red-900/20 border-red-400 text-red-700 dark:text-red-400'
                }`}>
                {error}
              </div>
              <button
                onClick={() => fetchNews(1, false, true)}
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
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-green-100 via-green-50 to-emerald-100">
      {/* Dinosaur background decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Dinosaur 1 - Top left */}
        <div className="absolute top-20 left-10 w-16 h-16 opacity-20">
          <div className="w-full h-full bg-green-300 rounded-full"></div>
          <div className="absolute -bottom-2 left-2 w-3 h-3 bg-green-400 rounded-full"></div>
          <div className="absolute -bottom-2 right-2 w-3 h-3 bg-green-400 rounded-full"></div>
          <div className="absolute top-1 left-1 w-2 h-2 bg-green-500 rounded-full"></div>
        </div>

        {/* Dinosaur 2 - Top right */}
        <div className="absolute top-32 right-16 w-20 h-20 opacity-15">
          <div className="w-full h-full bg-emerald-300 rounded-full"></div>
          <div className="absolute -bottom-3 left-3 w-4 h-4 bg-emerald-400 rounded-full"></div>
          <div className="absolute -bottom-3 right-3 w-4 h-4 bg-emerald-400 rounded-full"></div>
          <div className="absolute top-2 right-2 w-3 h-3 bg-emerald-500 rounded-full"></div>
        </div>

        {/* Dinosaur 3 - Bottom left */}
        <div className="absolute bottom-32 left-20 w-14 h-14 opacity-25">
          <div className="w-full h-full bg-green-200 rounded-full"></div>
          <div className="absolute -bottom-2 left-2 w-3 h-3 bg-green-300 rounded-full"></div>
          <div className="absolute -bottom-2 right-2 w-3 h-3 bg-green-300 rounded-full"></div>
          <div className="absolute top-1 left-1 w-2 h-2 bg-green-400 rounded-full"></div>
        </div>

        {/* Dinosaur 4 - Bottom right */}
        <div className="absolute bottom-20 right-24 w-18 h-18 opacity-20">
          <div className="w-full h-full bg-emerald-200 rounded-full"></div>
          <div className="absolute -bottom-2 left-2 w-3 h-3 bg-emerald-300 rounded-full"></div>
          <div className="absolute -bottom-2 right-2 w-3 h-3 bg-emerald-300 rounded-full"></div>
          <div className="absolute top-1 right-1 w-2 h-2 bg-emerald-400 rounded-full"></div>
        </div>

        {/* Small dinosaur eggs scattered around */}
        <div className="absolute top-40 left-1/4 w-6 h-8 bg-green-200 rounded-full opacity-30"></div>
        <div className="absolute top-60 right-1/3 w-5 h-7 bg-emerald-200 rounded-full opacity-25"></div>
        <div className="absolute bottom-40 left-1/3 w-7 h-6 bg-green-200 rounded-full opacity-30"></div>
        <div className="absolute bottom-60 right-1/4 w-6 h-7 bg-emerald-200 rounded-full opacity-25"></div>
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-0">
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
                  '0 4px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
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
                className="chalk-text text-white font-bold text-lg md:text-xl tracking-wide"
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
                <br className="block md:hidden" />
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
      </div>

      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            {articles
              .filter(article => !failedArticles.has(article.id))
              .filter(article => {
                const title = article.title.toLowerCase();
                const content = article.content?.toLowerCase() || '';
                const combinedText = `${title} ${content}`;

                // Filter out local road/accident reports and TV show transcripts
                const unwantedTerms = [
                  'shut down',
                  'accident',
                  'police',
                  'this week',
                  'transcript'
                ];
                return !unwantedTerms.some(term => combinedText.includes(term));
              })
              .map(article => (
                <NewsCard
                  key={article.id}
                  article={article}
                  onExplain={handleExplain}
                  onExplainError={handleExplainError}
                />
              ))}

            {loadingMore && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  Loading more articles..
                </p>
              </div>
            )}

            {hasMore && !loadingMore && articles.length > 0 && (
              <div className="text-center py-8">
                <button
                  onClick={() => fetchNews(page + 1, true)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors duration-200">
                  Load More Headlines
                </button>
              </div>
            )}

            {!hasMore && articles.length > 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">
                  You&apos;ve reached the end of the headlines!
                </p>
              </div>
            )}
          </div>

          <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>Powered by Google News RSS, OpenAI and Eleven Labs.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
