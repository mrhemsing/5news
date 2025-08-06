'use client';

import { useState, useEffect } from 'react';
import { NewsArticle } from '@/types/news';
import NewsCard from '@/components/NewsCard';
import Logo from '@/components/Logo';

export default function Home() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/news');

      if (!response.ok) {
        throw new Error('Failed to fetch news');
      }

      const data = await response.json();
      setArticles(data.articles);
    } catch (err) {
      setError('Failed to load news. Please try again later.');
      console.error('Error fetching news:', err);
    } finally {
      setLoading(false);
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
              onClick={fetchNews}
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
            Top headlines explained like you were 5
          </p>
        </div>

        {/* News Grid */}
        <div className="max-w-4xl mx-auto space-y-6">
          {articles.map(article => (
            <NewsCard
              key={article.id}
              article={article}
              onExplain={handleExplain}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Powered by NewsAPI.org and OpenAI. Click &quot;Explain Like I&apos;m
            5&quot; to get simple explanations of complex news stories.
          </p>
        </div>
      </div>
    </div>
  );
}
