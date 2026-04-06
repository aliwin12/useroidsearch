/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { 
  Search, Globe, Loader2, ExternalLink, X, ArrowRight, 
  History, MapPin, MessageSquare, Zap, User, Bot, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { cn } from './lib/utils';

// Types
interface SearchResult {
  title: string;
  uri: string;
  snippet?: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

type SearchMode = 'web' | 'maps' | 'pro' | 'chat';

export default function App() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('web');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatSession, setChatSession] = useState<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('useroid_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  const addToHistory = (q: string) => {
    const newHistory = [q, ...history.filter(h => h !== q)].slice(0, 5);
    setHistory(newHistory);
    localStorage.setItem('useroid_history', JSON.stringify(newHistory));
  };

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const activeQuery = overrideQuery || query;
    if (!activeQuery.trim()) return;

    if (mode === 'chat') {
      handleChat(activeQuery);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setAnswer(null);
    setResults([]);
    addToHistory(activeQuery);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API_KEY_MISSING");

      const genAI = new GoogleGenAI({ apiKey });
      let response;

      if (mode === 'web') {
        response = await genAI.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: activeQuery,
          config: { tools: [{ googleSearch: {} }] },
        });
      } else if (mode === 'maps') {
        response = await genAI.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: activeQuery,
          config: { tools: [{ googleMaps: {} }] },
        });
      } else if (mode === 'pro') {
        response = await genAI.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: activeQuery,
          config: { 
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } 
          },
        });
      }

      if (!response) throw new Error("No response from AI");

      setAnswer(response.text || "I found some information, but couldn't generate a summary.");
      
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        const formattedResults: SearchResult[] = chunks
          .filter(chunk => chunk.web || chunk.maps)
          .map(chunk => {
            if (chunk.web) {
              return {
                title: chunk.web.title || 'Untitled',
                uri: chunk.web.uri || '',
              };
            } else {
              return {
                title: chunk.maps?.title || 'Map Location',
                uri: chunk.maps?.uri || '',
              };
            }
          });
        setResults(formattedResults);
      }
    } catch (error: any) {
      console.error("Search error:", error);
      setAnswer(`Error: ${error.message || "An unexpected error occurred."}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleChat = async (msg: string) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return;

    const newUserMsg: ChatMessage = { role: 'user', text: msg };
    setChatHistory(prev => [...prev, newUserMsg]);
    setQuery('');
    setIsSearching(true);
    setHasSearched(true);

    try {
      const genAI = new GoogleGenAI({ apiKey });
      let session = chatSession;
      if (!session) {
        session = genAI.chats.create({
          model: "gemini-3.1-pro-preview",
          config: {
            systemInstruction: "You are USEROID, a helpful and intelligent AI assistant. Provide concise and accurate answers.",
          }
        });
        setChatSession(session);
      }

      const result = await session.sendMessage({ message: msg });
      const modelMsg: ChatMessage = { role: 'model', text: result.text || "I'm sorry, I couldn't process that." };
      setChatHistory(prev => [...prev, modelMsg]);
    } catch (error: any) {
      console.error("Chat error:", error);
      setChatHistory(prev => [...prev, { role: 'model', text: "Error: " + error.message }]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setHasSearched(false);
    setResults([]);
    setAnswer(null);
    setChatHistory([]);
    setChatSession(null);
    searchInputRef.current?.focus();
  };

  const isApiKeyMissing = !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      {isApiKeyMissing && !hasSearched && (
        <div className="bg-amber-50 border-b border-amber-100 p-3 text-center">
          <p className="text-sm text-amber-800">
            <b>Setup Required:</b> Please add your <b>GEMINI_API_KEY</b> to the <b>Secrets</b> panel in the sidebar.
          </p>
        </div>
      )}

      {/* Mode Selector */}
      <div className="flex justify-center pt-6 gap-2 px-4">
        {[
          { id: 'web', icon: Globe, label: 'Web' },
          { id: 'maps', icon: MapPin, label: 'Maps' },
          { id: 'pro', icon: Zap, label: 'Pro' },
          { id: 'chat', icon: MessageSquare, label: 'Chat' },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setMode(m.id as SearchMode);
              if (hasSearched && m.id !== 'chat') {
                setHasSearched(false);
                setAnswer(null);
                setResults([]);
              }
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
              mode === m.id 
                ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20" 
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}
          >
            <m.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Header / Logo Section */}
      <motion.header 
        layout
        className={cn(
          "flex flex-col items-center justify-center transition-all duration-500 ease-in-out px-4",
          hasSearched ? "pt-8 pb-4" : "flex-1"
        )}
      >
        <motion.div layout className="text-center mb-8">
          <h1 className={cn(
            "font-display font-bold tracking-tighter text-slate-900 transition-all duration-500",
            hasSearched ? "text-4xl" : "text-7xl md:text-8xl"
          )}>
            USEROID
          </h1>
          {!hasSearched && (
            <p className="mt-4 text-slate-500 text-lg font-medium">
              {mode === 'web' && "Search the web with intelligence."}
              {mode === 'maps' && "Find places and locations."}
              {mode === 'pro' && "Deep thinking for complex queries."}
              {mode === 'chat' && "Chat with your AI assistant."}
            </p>
          )}
        </motion.div>

        {/* Search Bar Container */}
        {mode !== 'chat' || !hasSearched ? (
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
                placeholder={
                  mode === 'web' ? "Ask anything..." :
                  mode === 'maps' ? "Find a place..." :
                  mode === 'pro' ? "Complex question..." : "Start a chat..."
                }
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
        ) : null}
      </motion.header>

      {/* Results Section */}
      <AnimatePresence mode="wait">
        {hasSearched && (
          <motion.main 
            key={mode}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex-1 w-full max-w-4xl mx-auto px-4 pb-20 overflow-hidden flex flex-col"
          >
            {mode === 'chat' ? (
              <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {chatHistory.map((msg, idx) => (
                    <div key={idx} className={cn(
                      "flex gap-4",
                      msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                    )}>
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                        msg.role === 'user' ? "bg-slate-900 text-white" : "bg-blue-100 text-blue-600"
                      )}>
                        {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>
                      <div className={cn(
                        "max-w-[80%] p-4 rounded-2xl",
                        msg.role === 'user' ? "bg-slate-100 text-slate-900 rounded-tr-none" : "bg-blue-50 text-slate-900 rounded-tl-none"
                      )}>
                        <div className="prose prose-sm prose-slate max-w-none">
                          <Markdown>{msg.text}</Markdown>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isSearching && (
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="bg-blue-50 p-4 rounded-2xl rounded-tl-none">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-4 border-t border-slate-100">
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (query.trim()) handleChat(query);
                    }}
                    className="relative"
                  >
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Type your message..."
                      className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={isSearching || !query.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <section className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-blue-600 font-semibold uppercase tracking-wider text-xs">
                      {mode === 'web' && <Globe className="w-4 h-4" />}
                      {mode === 'maps' && <MapPin className="w-4 h-4" />}
                      {mode === 'pro' && <Zap className="w-4 h-4" />}
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
                              {result.uri ? new URL(result.uri).hostname : 'Location'}
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
            )}
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
