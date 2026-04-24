import React, { useState, useEffect } from 'react';
import { Key, Shield, Save, CheckCircle2, Cpu, Sparkles, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

const ConfigView = () => {
  const [selectedProvider, setSelectedProvider] = useState('OPENAI');
  const [configs, setConfigs] = useState<Record<string, { apiKey: string, defaultModel: string, active: boolean }>>({
    OPENAI: { apiKey: '', defaultModel: 'gpt-4o', active: false },
    ANTHROPIC: { apiKey: '', defaultModel: 'claude-3-5-sonnet-latest', active: false },
    COHERE: { apiKey: '', defaultModel: 'rerank-multilingual-v3.0', active: false },
  });
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const response = await axios.get('/api/v1/config');
      const backendConfigs = response.data;
      
      setConfigs(prev => {
        const newConfigs = { ...prev };
        backendConfigs.forEach((c: any) => {
          if (newConfigs[c.providerName]) {
            newConfigs[c.providerName] = {
              apiKey: c.apiKey,
              defaultModel: c.defaultModelName,
              active: c.active
            };
          }
        });
        return newConfigs;
      });
    } catch (error) {
      console.error('Failed to fetch configs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (provider: string) => {
    try {
      const config = configs[provider];
      await axios.post('/api/v1/config/provider', {
        provider,
        apiKey: config.apiKey,
        defaultModel: config.defaultModel,
        active: config.active,
      });
      setStatus(`${provider} atualizado!`);
      // Refresh to ensure 'active' status is synced across providers
      fetchConfigs();
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      console.error('Config failed:', error);
    }
  };

  const providers = [
    { id: 'OPENAI', name: 'OpenAI', icon: Sparkles },
    { id: 'ANTHROPIC', name: 'Anthropic', icon: Shield },
    { id: 'COHERE', name: 'Cohere', icon: Cpu },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-flat-blue border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full space-y-8">
      <div className="flex items-center gap-4 mb-10 border-b-4 border-flat-blue pb-6">
        <div className="w-12 h-12 bg-flat-dark text-white flex items-center justify-center rounded">
          <Key className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">AI Settings</h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Gerencie seus modelos e chaves de acesso</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Provider Selection Sidebar */}
        <div className="md:col-span-1 space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Selecione o Provedor</label>
          {providers.map((p) => {
            const Icon = p.icon;
            const isConfigured = configs[p.id]?.apiKey?.length > 0;
            const isActive = configs[p.id]?.active;
            
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProvider(p.id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${
                  selectedProvider === p.id 
                    ? 'bg-flat-blue text-white shadow-lg translate-x-2' 
                    : 'bg-white text-slate-600 hover:bg-slate-50 border-2 border-transparent hover:border-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${selectedProvider === p.id ? 'text-white' : 'text-slate-400'}`} />
                  <span className="font-bold text-sm tracking-tight">{p.name}</span>
                </div>
                {isActive && (
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Configuration Form */}
        <div className="md:col-span-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedProvider}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-flat-gray p-8 rounded-2xl border-2 border-white shadow-sm"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h4 className="font-black text-xl text-slate-900 uppercase tracking-tight">{selectedProvider}</h4>
                  {configs[selectedProvider].active && (
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded uppercase tracking-widest">Ativo no Sistema</span>
                  )}
                </div>
                {!configs[selectedProvider].apiKey && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Não configurado</span>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Chave de API</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={configs[selectedProvider].apiKey}
                      onChange={(e) => setConfigs(prev => ({
                        ...prev,
                        [selectedProvider]: { ...prev[selectedProvider], apiKey: e.target.value }
                      }))}
                      placeholder="••••••••••••••••"
                      className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-4 text-slate-800 focus:outline-none focus:border-flat-blue transition-all font-mono text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Modelo Padrão</label>
                  <input
                    type="text"
                    value={configs[selectedProvider].defaultModel}
                    onChange={(e) => setConfigs(prev => ({
                      ...prev,
                      [selectedProvider]: { ...prev[selectedProvider], defaultModel: e.target.value }
                    }))}
                    className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-4 text-slate-800 focus:outline-none focus:border-flat-blue transition-all font-bold text-sm"
                  />
                </div>

                <div className="flex items-center gap-3 p-4 bg-white/50 rounded-xl border-2 border-slate-100">
                  <label className="flex items-center gap-4 cursor-pointer w-full">
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">Definir como Padrão</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Usar este provedor por padrão no chat</p>
                    </div>
                    <div 
                      onClick={() => setConfigs(prev => ({
                        ...prev,
                        [selectedProvider]: { ...prev[selectedProvider], active: !prev[selectedProvider].active }
                      }))}
                      className={`w-12 h-7 rounded-full relative transition-all ${configs[selectedProvider].active ? 'bg-emerald-500 shadow-inner' : 'bg-slate-200'}`}
                    >
                      <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${configs[selectedProvider].active ? 'translate-x-5' : ''}`} />
                    </div>
                  </label>
                </div>

                <button
                  onClick={() => handleSave(selectedProvider)}
                  className="w-full flex items-center justify-center gap-3 bg-flat-dark hover:bg-slate-900 text-white font-black py-5 rounded-xl transition-all active:scale-[0.98] uppercase text-xs tracking-[0.2em] shadow-xl shadow-slate-200"
                >
                  <Save className="w-5 h-5" />
                  Salvar Configuração
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {status && (
        <div className="fixed bottom-8 right-8 flex items-center gap-3 bg-slate-900 text-white px-6 py-4 rounded-xl shadow-2xl animate-fade-in border-b-4 border-emerald-500">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <span className="text-xs font-bold uppercase tracking-widest">{status}</span>
        </div>
      )}
    </div>
  );
};

export default ConfigView;
