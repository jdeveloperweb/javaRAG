import React, { useState } from 'react';
import { Layout, MessageSquare, Upload, Settings, Database, Globe } from 'lucide-react';
import ChatView from './components/ChatView';
import IngestionView from './components/IngestionView';
import ConfigView from './components/ConfigView';

function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'ingestion' | 'config'>('chat');

  return (
    <div className="flex h-screen w-full bg-white text-slate-900 font-medium">
      {/* Sidebar - Flat Style */}
      <aside className="w-20 lg:w-64 flex flex-col bg-slate-900 text-white relative z-20">
        <div className="p-8 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-flat-blue flex items-center justify-center rounded">
              <Database className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight hidden lg:block">RAG Java</h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('chat')}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-all ${
              activeTab === 'chat' ? 'flat-nav-active' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="font-semibold hidden lg:block text-sm">Assistant</span>
          </button>
          
          <button
            onClick={() => setActiveTab('ingestion')}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-all ${
              activeTab === 'ingestion' ? 'flat-nav-active' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Upload className="w-5 h-5" />
            <span className="font-semibold hidden lg:block text-sm">Library</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-all ${
              activeTab === 'config' ? 'flat-nav-active' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="font-semibold hidden lg:block text-sm">Config</span>
          </button>
        </nav>

        <div className="p-6 bg-black/20">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden lg:block">Server Online</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{activeTab}</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-600 rounded">
              JV
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto h-full">
            {activeTab === 'chat' && <ChatView />}
            {activeTab === 'ingestion' && <IngestionView />}
            {activeTab === 'config' && <ConfigView />}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
