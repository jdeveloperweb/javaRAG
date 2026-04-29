import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Sparkles, Loader2, PlusCircle, Trash2, Clock, MessageSquare, Menu, X, StopCircle } from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
interface Citation {
  source: string;
  text: string;
  documentId?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  modelUsed?: string;
  timestamp: Date;
  citations?: Citation[];
  isStreaming?: boolean;
}

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

const ChatView = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [provider, setProvider] = useState<'OPENAI' | 'ANTHROPIC'>('OPENAI');
  const [useSpringAi, setUseSpringAi] = useState(true);
  const [configuredProviders, setConfiguredProviders] = useState<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);
  const tokenQueueRef = useRef<string[]>([]);
  const processingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isDoneRef = useRef<boolean>(false);
  
  // History states
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Viewer Modal state
  const [viewerData, setViewerData] = useState<{title: string, fullText: string, chunkText: string} | null>(null);
  const [showFullDoc, setShowFullDoc] = useState(false);
  const [showCitations, setShowCitations] = useState<boolean>(() => {
    const saved = localStorage.getItem('showCitations');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    fetchActiveProvider();
    fetchConversations();
  }, []);

  const fetchActiveProvider = async () => {
    try {
      const response = await axios.get('/api/v1/config');
      const configs: any[] = response.data;

      // Determine which providers have a non-empty API key
      const withKey = new Set<string>(
        configs
          .filter((c: any) => c.apiKey && c.apiKey.trim().length > 0)
          .map((c: any) => c.providerName as string)
      );
      setConfiguredProviders(withKey);

      // Pick the active provider, but only if it has a key configured
      const active = configs.find((c: any) => c.active);
      if (active && withKey.has(active.providerName) &&
          (active.providerName === 'OPENAI' || active.providerName === 'ANTHROPIC')) {
        setProvider(active.providerName);
      } else {
        // Fallback to first configured provider
        if (withKey.has('OPENAI')) setProvider('OPENAI');
        else if (withKey.has('ANTHROPIC')) setProvider('ANTHROPIC');
      }
    } catch (error) {
      console.error('Error fetching active provider:', error);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await axios.get('/api/v1/chat/conversations');
      setConversations(response.data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchMessages = async (conversationId: number) => {
    setIsLoading(true);
    try {
      const response = await axios.get(`/api/v1/chat/conversations/${conversationId}/messages`);
      const historyMessages: Message[] = response.data.map((m: any) => {
        let citations: Citation[] | undefined;
        if (m.citationsJson) {
          try {
            citations = JSON.parse(m.citationsJson);
          } catch (e) {
            console.error('Failed to parse citations JSON', e);
          }
        }
        return {
          id: m.id.toString(),
          role: m.role.toLowerCase() === 'user' ? 'user' : 'assistant',
          content: m.content,
          timestamp: new Date(m.createdAt),
          citations,
        };
      });
      setMessages(historyMessages);
      setCurrentConversationId(conversationId);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setInput('');
  };

  const handleDeleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja apagar esta conversa?')) return;
    
    try {
      await axios.delete(`/api/v1/chat/conversations/${id}`);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversationId === id) {
        handleNewChat();
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Tem certeza que deseja apagar TODO o histórico?')) return;
    
    try {
      await axios.delete('/api/v1/chat/conversations');
      setConversations([]);
      handleNewChat();
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  const handleCitationClick = async (citation: Citation) => {
    if (!citation.documentId) return;
    setShowFullDoc(false);
    try {
      const response = await axios.get(`/api/v1/documents/${citation.documentId}`);
      setViewerData({
        title: citation.source,
        fullText: response.data.extractedText,
        chunkText: citation.text
      });
    } catch (err) {
      console.error("Failed to load document", err);
    }
  };

  const highlightText = (fullText: string, chunkText: string) => {
    if (!fullText || !chunkText) return fullText;
    const parts = fullText.split(chunkText);
    if (parts.length === 1) return fullText;
    
    return (
      <>
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            <span className="whitespace-pre-wrap">{part}</span>
            {i !== parts.length - 1 && (
              <mark className="bg-amber-200 text-amber-900 rounded px-1 shadow-sm whitespace-pre-wrap" id="highlighted-chunk">{chunkText}</mark>
            )}
          </React.Fragment>
        ))}
      </>
    );
  };

  /** Extract [n] references from AI text, returns 1-based indices */
  const getCitedIndices = (text: string): Set<number> => {
    const regex = /\[(\d+)\]/g;
    const indices = new Set<number>();
    let match;
    while ((match = regex.exec(text)) !== null) {
      indices.add(parseInt(match[1], 10));
    }
    return indices;
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleStopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }
    tokenQueueRef.current = [];
    isDoneRef.current = false;
    setIsStreaming(false);
    setIsLoading(false);
    setMessages(prev => prev.map((m, i) =>
      i === prev.length - 1 && m.isStreaming ? { ...m, isStreaming: false } : m
    ));
  }, []);

  const startTokenProcessor = (aiMessageId: string) => {
    if (processingIntervalRef.current) return;

    processingIntervalRef.current = setInterval(() => {
      if (tokenQueueRef.current.length > 0) {
        const nextToken = tokenQueueRef.current.shift();
        if (nextToken) {
          setMessages(prev => prev.map(m =>
            m.id === aiMessageId ? { ...m, content: m.content + nextToken } : m
          ));
        }
      } else if (isDoneRef.current) {
        // Queue is empty and backend is done
        stopTokenProcessor(aiMessageId);
      }
    }, 35); // 35ms per token for a natural "word by word" feel
  };

  const stopTokenProcessor = (aiMessageId: string) => {
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }
    setIsStreaming(false);
    setIsLoading(false);
    isDoneRef.current = false;
    setMessages(prev => prev.map(m =>
      m.id === aiMessageId ? { ...m, isStreaming: false } : m
    ));
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    const aiMessageId = (Date.now() + 1).toString();
    const savedInput = input;

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsStreaming(true);
    tokenQueueRef.current = [];
    isDoneRef.current = false;

    // Create empty assistant message for streaming
    setMessages(prev => [...prev, {
      id: aiMessageId,
      role: 'assistant' as const,
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }]);

    startTokenProcessor(aiMessageId);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/v1/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: savedInput,
          provider,
          tenantId: 'default',
          useSpringAi,
          conversationId: currentConversationId,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            const data = line.slice(5);
            
            if (currentEvent === 'token') {
              // No SSE, uma linha 'data:' vazia frequentemente representa um token de quebra de linha
              tokenQueueRef.current.push(data === '' ? '\n' : data);
            } else if (currentEvent === 'citations') {
              try {
                const citations: Citation[] = JSON.parse(data.trim());
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, citations } : m
                ));
              } catch (e) { console.error('Failed to parse citations', e); }
            } else if (currentEvent === 'done') {
              try {
                const meta = JSON.parse(data.trim());
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, modelUsed: meta.modelUsed } : m
                ));
                if (!currentConversationId && meta.conversationId) {
                  setCurrentConversationId(meta.conversationId);
                  fetchConversations();
                }
                isDoneRef.current = true;
              } catch (e) { console.error('Failed to parse done event', e); }
            } else if (currentEvent === 'error') {
              try {
                const err = JSON.parse(data.trim());
                tokenQueueRef.current.push('\n\n⚠️ Erro: ' + err.message);
                isDoneRef.current = true;
              } catch (e) { console.error('Failed to parse error', e); }
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Stream cancelled by user');
      } else {
        console.error('Error streaming:', error);
        tokenQueueRef.current.push('⚠️ Erro ao conectar com o servidor.');
        isDoneRef.current = true;
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50/50">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="w-72 h-full glass border-r border-slate-200/50 flex flex-col z-20"
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-500" />
                Histórico
              </h2>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 lg:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center gap-2 p-3 rounded-xl bg-primary-600 text-white font-bold shadow-lg shadow-primary-200 hover:bg-primary-700 transition-all mb-4"
              >
                <PlusCircle className="w-5 h-5" />
                Novo Chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => fetchMessages(conv.id)}
                  className={`group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                    currentConversationId === conv.id 
                      ? 'bg-white shadow-md border border-slate-100 text-primary-600' 
                      : 'text-slate-600 hover:bg-white/50 hover:text-slate-900'
                  }`}
                >
                  <MessageSquare className={`w-4 h-4 shrink-0 ${currentConversationId === conv.id ? 'text-primary-500' : 'text-slate-400'}`} />
                  <span className="text-sm font-medium truncate pr-6">{conv.title}</span>
                  <button
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className="absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100">
              <button
                onClick={handleClearAll}
                className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all text-sm font-semibold"
              >
                <Trash2 className="w-4 h-4" />
                Limpar Histórico
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-4 top-4 z-10 p-2 glass rounded-xl shadow-lg border border-slate-200 text-slate-600 hover:text-primary-600 transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col h-full max-w-4xl mx-auto w-full gap-6 pb-4 pt-4 lg:pt-0">
          {/* Model Selection Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-4 glass rounded-3xl mx-4 mt-4"
          >
            <div className="flex items-center gap-4">
              <div className="flex bg-slate-100 rounded-xl p-1 shadow-inner">
                <button
                  onClick={() => configuredProviders.has('OPENAI') && setProvider('OPENAI')}
                  disabled={!configuredProviders.has('OPENAI')}
                  title={!configuredProviders.has('OPENAI') ? 'API Key não configurada' : ''}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                    !configuredProviders.has('OPENAI')
                      ? 'text-slate-400 cursor-not-allowed opacity-60'
                      : provider === 'OPENAI' ? 'bg-white text-primary-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  OpenAI
                </button>
                <button
                  onClick={() => configuredProviders.has('ANTHROPIC') && setProvider('ANTHROPIC')}
                  disabled={!configuredProviders.has('ANTHROPIC')}
                  title={!configuredProviders.has('ANTHROPIC') ? 'API Key não configurada' : ''}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                    !configuredProviders.has('ANTHROPIC')
                      ? 'text-slate-400 cursor-not-allowed opacity-60'
                      : provider === 'ANTHROPIC' ? 'bg-white text-primary-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Claude
                </button>
              </div>
              
              <div className="h-6 w-[1px] bg-slate-200 mx-2 hidden sm:block" />
              
              <label className="hidden sm:flex items-center gap-3 cursor-pointer group">
                <div 
                  onClick={() => setUseSpringAi(!useSpringAi)}
                  className={`w-11 h-6 rounded-full relative transition-all duration-300 ${useSpringAi ? 'bg-primary-500 shadow-lg shadow-primary-200' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${useSpringAi ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm font-bold text-slate-600 group-hover:text-primary-600 transition-colors">Spring AI</span>
              </label>

              <div className="h-6 w-[1px] bg-slate-200 mx-2 hidden sm:block" />

              <label className="hidden sm:flex items-center gap-3 cursor-pointer group">
                <div 
                  onClick={() => {
                    const newVal = !showCitations;
                    setShowCitations(newVal);
                    localStorage.setItem('showCitations', JSON.stringify(newVal));
                  }}
                  className={`w-11 h-6 rounded-full relative transition-all duration-300 ${showCitations ? 'bg-amber-500 shadow-lg shadow-amber-200' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${showCitations ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm font-bold text-slate-600 group-hover:text-amber-600 transition-colors">Referências</span>
              </label>
            </div>
            
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full text-slate-500 text-xs font-semibold tracking-wide border border-slate-100">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">RAG Hybrid Search Enabled</span>
              <span className="sm:hidden">RAG</span>
            </div>
          </motion.div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto space-y-6 px-4 custom-scrollbar">
            {messages.length === 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center h-full text-slate-300 space-y-6"
              >
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl border border-slate-50">
                  <Bot className="w-12 h-12 text-slate-400 opacity-40" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-400">Como posso ajudar hoje?</p>
                  <p className="text-sm text-slate-400/80">Inicie uma conversa para buscar em seus documentos.</p>
                </div>
              </motion.div>
            )}
            
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.role === 'assistant' && (
                    <div className="w-9 h-9 bg-white shadow-md flex items-center justify-center rounded-xl border border-slate-100 mt-1 shrink-0">
                      <Bot className="w-5 h-5 text-primary-500" />
                    </div>
                  )}
                  
                  <div className={`max-w-[85%] group relative ${m.role === 'user' ? 'order-first' : ''}`}>
                    <div 
                      className={`p-4 px-5 rounded-2xl shadow-sm ${
                        m.role === 'user' 
                          ? 'bg-primary-600 text-white rounded-tr-none' 
                          : 'bg-white text-slate-800 rounded-tl-none border border-slate-100 shadow-sm'
                      }`}
                    >
                      <div className={`prose prose-slate max-w-none text-[15px] leading-relaxed ${m.role === 'user' ? 'prose-invert prose-p:text-white prose-headings:text-white prose-strong:text-white prose-a:text-blue-200' : ''}`}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code(props) {
                              const {children, className, node, ...rest} = props
                              const match = /language-(\w+)/.exec(className || '')
                              return match ? (
                                <SyntaxHighlighter
                                  {...rest}
                                  PreTag="div"
                                  children={String(children).replace(/\n$/, '')}
                                  language={match[1]}
                                  style={vscDarkPlus as any}
                                />
                              ) : (
                                <code {...rest} className={className}>
                                  {children}
                                </code>
                              )
                            },
                            table: ({ children }) => (
                              <div className="overflow-hidden my-4 rounded-xl border border-slate-200 shadow-sm">
                                <table className="w-full text-sm text-left text-slate-600 border-collapse">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => (
                              <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                                {children}
                              </thead>
                            ),
                            th: ({ children }) => (
                              <th className="px-4 py-3 font-bold bg-slate-50/50">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="px-4 py-3 border-b border-slate-100 last:border-0 bg-white">
                                {children}
                              </td>
                            ),
                            tr: ({ children }) => (
                              <tr className="hover:bg-slate-50/30 transition-colors">
                                {children}
                              </tr>
                            )
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                        {m.isStreaming && (
                          <span className="inline-block w-2 h-5 bg-primary-500 ml-1 translate-y-1 animate-pulse" />
                        )}
                      </div>

                      {showCitations && m.citations && m.citations.length > 0 && (() => {
                        const cited = getCitedIndices(m.content);
                        // Only show citations referenced in text; fallback to all if none detected
                        const citationsToShow = cited.size > 0
                          ? m.citations
                              .map((c, i) => ({ ...c, originalIndex: i + 1 }))
                              .filter(c => cited.has(c.originalIndex))
                          : m.citations.map((c, i) => ({ ...c, originalIndex: i + 1 }));

                        return (
                          <div className="mt-4 pt-4 border-t border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3 text-amber-500" />
                              Fontes Utilizadas
                            </p>
                            <div className="flex flex-col gap-2">
                              {citationsToShow.map((c) => (
                                <div 
                                  key={c.originalIndex}
                                  onClick={() => handleCitationClick(c)}
                                  className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 text-xs cursor-pointer hover:bg-white hover:border-primary-200 transition-all group/cit"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-primary-600 block">[{c.originalIndex}] {c.source}</span>
                                    <span className="text-[10px] text-slate-400 group-hover/cit:text-primary-400 font-semibold tracking-wider">VER DOCUMENTO</span>
                                  </div>
                                  <span className="text-slate-500 line-clamp-2" title={c.text}>{c.text}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    {m.modelUsed && (
                      <span className="absolute -bottom-5 left-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                        Powered by {m.modelUsed}
                      </span>
                    )}
                  </div>

                  {m.role === 'user' && (
                    <div className="w-9 h-9 bg-slate-900 shadow-lg flex items-center justify-center rounded-xl mt-1 shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                </motion.div>
              ))}
              
              {isLoading && !isStreaming && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex gap-4 justify-start"
                >
                  <div className="w-9 h-9 bg-white shadow-md flex items-center justify-center rounded-xl border border-slate-100 mt-1">
                    <Bot className="w-5 h-5 text-primary-500" />
                  </div>
                  <div className="bg-white border border-slate-100 shadow-md shadow-slate-200/50 p-4 px-6 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                    <motion.div 
                      animate={{ y: [0, -5, 0] }} 
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                      className="w-1.5 h-1.5 bg-primary-400 rounded-full" 
                    />
                    <motion.div 
                      animate={{ y: [0, -5, 0] }} 
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                      className="w-1.5 h-1.5 bg-primary-500 rounded-full" 
                    />
                    <motion.div 
                      animate={{ y: [0, -5, 0] }} 
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                      className="w-1.5 h-1.5 bg-primary-600 rounded-full" 
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4"
          >
            <div className="glass p-2 px-3 rounded-2xl flex items-center gap-3 shadow-2xl shadow-slate-200/50">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Digite sua dúvida sobre os documentos..."
                className="flex-1 bg-transparent px-2 py-3 focus:outline-none text-slate-800 font-medium placeholder:text-slate-400"
              />
              {isStreaming ? (
                <button
                  onClick={handleStopStreaming}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all bg-red-500 text-white shadow-lg shadow-red-200 hover:bg-red-600 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <StopCircle className="w-5 h-5" />
                  <span className="hidden sm:inline">Parar</span>
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all ${
                    isLoading || !input.trim() 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                      : 'bg-primary-600 text-white shadow-lg shadow-primary-200 hover:shadow-primary-300 hover:-translate-y-0.5 active:translate-y-0'
                  }`}
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  <span className="hidden sm:inline">Enviar</span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Document Viewer Modal */}
      <AnimatePresence>
        {viewerData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setViewerData(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{viewerData.title}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trecho Citado</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewerData(null)}
                  className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar bg-white text-sm text-slate-700 leading-relaxed">
                {/* Chunk text - always visible */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-inner mb-4">
                  <p className="text-[10px] font-bold text-amber-600 mb-2 uppercase tracking-widest">Trecho Utilizado na Resposta</p>
                  <span className="whitespace-pre-wrap text-slate-800 font-sans text-sm leading-relaxed">{viewerData.chunkText}</span>
                </div>

                {/* Toggle to expand full document */}
                {viewerData.fullText && (
                  <div>
                    <button
                      onClick={() => setShowFullDoc(!showFullDoc)}
                      className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-primary-600 transition-colors mb-3 uppercase tracking-widest"
                    >
                      <span>{showFullDoc ? '▼ Ocultar Documento Completo' : '▶ Ver Documento Completo'}</span>
                    </button>
                    {showFullDoc && (
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-700 leading-relaxed font-serif"
                           ref={node => {
                             if (node) {
                               setTimeout(() => {
                                 const mark = node.querySelector('#highlighted-chunk');
                                 if (mark) mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
                               }, 200);
                             }
                           }}>
                        {highlightText(viewerData.fullText, viewerData.chunkText)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatView;
