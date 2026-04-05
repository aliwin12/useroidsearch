/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Search, Globe, Loader2, ExternalLink, X, ArrowRight, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { cn } from './lib/utils';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface SearchResult {
  title: string;
  uri: string;
  snippet?: string;
}

export default function App() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('useroid_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  const addToHistory = (q: string) => {
    const newHistory = [q, ...history.filter(h => h !== q)].slice(0, 5);
    setHistory(newHistory);
    localStorage.setItem('useroid_history', JSON.stringify(newHistory));
  };

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const activeQuery = overrideQuery || query;
    if (!activeQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    setAnswer(null);
    setResults([]);
    addToHistory(activeQuery);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: activeQuery,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      setAnswer(response.text || "No summary available.");
      
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        const formattedResults: SearchResult[] = chunks
          .filter(chunk => chunk.web)
          .map(chunk => ({
            title: chunk.web?.title || 'Untitled',
            uri: chunk.web?.uri || '',
          }));
        setResults(formattedResults);
      }
    } catch (error) {
      console.error("Search error:", error);
      setAnswer("Sorry, something went wrong while searching. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setHasSearched(false);
    setResults([]);
    setAnswer(null);
    searchInputRef.current?.focus();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      {/* Header / Logo Section */}
      <motion.header 
        layout
        className={cn(
          "flex flex-col items-center justify-center transition-all duration-500 ease-in-out px-4",
          hasSearched ? "pt-8 pb-4" : "flex-1"
        )}
      >
        <motion.div 
          layout
          className="text-center mb-8"
        >
          <h1 className={cn(
            "font-display font-bold tracking-tighter text-slate-900 transition-all duration-500",
            hasSearched ? "text-4xl" : "text-7xl md:text-8xl"
          )}>
            USEROID
          </h1>
          {!hasSearched && (
            <p className="mt-4 text-slate-500 text-lg font-medium">
              Search the web with intelligence.
            </p>
          )}
        </motion.div>

        {/* Search Bar Container */}
        <motion.div 
          layout
          className={cn(
            "w-full max-w-2xl relative group",
            hasSearched ? "mb-6" : "mb-12"
          )}
        >
          <form onSubmit={handleSearch} className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything..."
              className="w-full pl-12 pr-12 py-4 bg-white border border-slate-200 rounded-2xl search-shadow hover:search-shadow-hover focus:search-shadow-hover focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-lg"
            />
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute inset-y-0 right-14 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <button
              type="submit"
              disabled={isSearching}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all"
            >
              {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
            </button>
          </form>

          {/* Search History / Suggestions */}
          {!hasSearched && history.length > 0 && !query && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 flex flex-wrap gap-2 justify-center"
            >
              {history.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(item);
                    handleSearch(undefined, item);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                  <History className="w-3 h-3" />
                  {item}
                </button>
              ))}
            </motion.div>
          )}
        </motion.div>
      </motion.header>

      {/* Results Section */}
      <AnimatePresence>
        {hasSearched && (
          <motion.main 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex-1 w-full max-w-4xl mx-auto px-4 pb-20"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Answer / Summary */}
              <div className="lg:col-span-2 space-y-6">
                <section className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-4 text-blue-600 font-semibold uppercase tracking-wider text-xs">
                    <Globe className="w-4 h-4" />
                    AI Overview
                  </div>
                  {isSearching ? (
                    <div className="space-y-4 animate-pulse">
                      <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                      <div className="h-4 bg-slate-100 rounded w-full"></div>
                      <div className="h-4 bg-slate-100 rounded w-5/6"></div>
                    </div>
                  ) : (
                    <div className="prose prose-slate max-w-none prose-p:leading-relaxed prose-p:text-slate-700">
                      <Markdown>{answer || ''}</Markdown>
                    </div>
                  )}
                </section>
              </div>

              {/* Sidebar / Sources */}
              <div className="space-y-6">
                <section>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">
                    Sources
                  </h3>
                  <div className="space-y-3">
                    {isSearching ? (
                      [1, 2, 3].map(i => (
                        <div key={i} className="h-20 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>
                      ))
                    ) : results.length > 0 ? (
                      results.map((result, idx) => (
                        <motion.a
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          key={idx}
                          href={result.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-semibold text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                              {result.title}
                            </h4>
                            <ExternalLink className="w-3 h-3 text-slate-400 flex-shrink-0 mt-1" />
                          </div>
                          <p className="mt-1 text-xs text-slate-400 truncate">
                            {new URL(result.uri).hostname}
                          </p>
                        </motion.a>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400 italic px-2">No sources found.</p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </motion.main>
        )}
      </AnimatePresence>

      {/* Footer */}
      {!hasSearched && (
        <footer className="py-8 text-center text-slate-400 text-sm">
          <p>© 2026 USEROID. Powered by Gemini AI.</p>
        </footer>
      )}
    </div>
  );
}
