import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, PlusCircle, Trash2, Clock, MessageSquare, Menu, X } from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  modelUsed?: string;
  timestamp: Date;
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
  const [provider, setProvider] = useState<'OPENAI' | 'ANTHROPIC'>('OPENAI');
  const [useSpringAi, setUseSpringAi] = useState(true);
  
  // History states
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    fetchActiveProvider();
    fetchConversations();
  }, []);

  const fetchActiveProvider = async () => {
    try {
      const response = await axios.get('/api/v1/config');
      const active = response.data.find((c: any) => c.active);
      if (active && (active.providerName === 'OPENAI' || active.providerName === 'ANTHROPIC')) {
        setProvider(active.providerName);
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
      const historyMessages: Message[] = response.data.map((m: any) => ({
        id: m.id.toString(),
        role: m.role.toLowerCase() === 'user' ? 'user' : 'assistant',
        content: m.content,
        timestamp: new Date(m.createdAt),
      }));
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

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post('/api/v1/chat/query', {
        message: input,
        provider,
        tenantId: 'default',
        useSpringAi,
        conversationId: currentConversationId
      });

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.answer,
        modelUsed: response.data.modelUsed,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
      
      if (!currentConversationId) {
        setCurrentConversationId(response.data.conversationId);
        fetchConversations();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
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
                  onClick={() => setProvider('OPENAI')}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                    provider === 'OPENAI' ? 'bg-white text-primary-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  OpenAI
                </button>
                <button
                  onClick={() => setProvider('ANTHROPIC')}
                  className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                    provider === 'ANTHROPIC' ? 'bg-white text-primary-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
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
                  
                  <div className={`max-w-[80%] group relative ${m.role === 'user' ? 'order-first' : ''}`}>
                    <div className={`p-4 px-5 rounded-2xl shadow-sm ${
                      m.role === 'user' 
                        ? 'bg-primary-600 text-white rounded-tr-none' 
                        : 'bg-white text-slate-800 rounded-tl-none border border-slate-100 shadow-md shadow-slate-200/50'
                    }`}>
                      <div className="prose prose-slate max-w-none text-[15px] leading-relaxed">
                        {m.content.split('\n').map((line, i) => (
                          <p key={i} className={i > 0 ? 'mt-3' : ''}>{line}</p>
                        ))}
                      </div>
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
              
              {isLoading && (
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
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
