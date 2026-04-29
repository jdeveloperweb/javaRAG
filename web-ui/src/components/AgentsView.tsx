import React, { useState, useEffect, useRef } from 'react';
import { Bot, FileText, Code, Save, Play, CheckCircle, AlertCircle, Loader2, Files, Terminal, Sparkles, Send, User, MessageCircle, Activity, Folder, File, ShieldCheck, Zap, Download, Search, Settings, ArrowRight, Gauge, Layers, History, Plus, ChevronRight, Clock, Database, MoreVertical, Trash2, Brain, Lightbulb, Wrench, FilePlus, Cpu } from 'lucide-react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface GeneratedFile {
  path: string;
  content: string;
}

interface FullCycleResponse {
  document: {
    content: string;
    filePath: string;
  };
  code: {
    files: GeneratedFile[];
    notes: string;
  };
  documentIterations: number;
  specOnly: boolean;
}

interface ProgressEvent {
  type: 'THOUGHT' | 'TOOL_START' | 'TOOL_END' | 'STEP_COMPLETE' | 'COMPLETE' | 'ERROR' | 'NEED_INFO' | 'FILE_CREATED' | 'REFLECTION' | 'USAGE' | 'PROMPT' | 'TASK_LIST' | 'TASK_DONE';
  message: string;
  data?: any;
  createdAt?: string;
  agentName?: string;
}

interface AgentSession {
  id: string;
  objective: string;
  status: string;
  createdAt: string;
  isSpecOnly: boolean;
  resultJson?: string;
}

const AGENT_API_BASE = 'http://localhost:8090/api/agents';

const AgentsView: React.FC = () => {
  const [objective, setObjective] = useState('');
  const [specOnly, setSpecOnly] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FullCycleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<'doc' | 'code'>('doc');
  const [logs, setLogs] = useState<ProgressEvent[]>([]);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [createdFiles, setCreatedFiles] = useState<string[]>([]);
  const [tokens, setTokens] = useState({ input: 0, output: 0, total: 0 });
  const [tasks, setTasks] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editableContent, setEditableContent] = useState('');
  const [showScatModal, setShowScatModal] = useState(false);
  const [scatData, setScatData] = useState({ client: '', scatNumber: '' });
  const [isScatSending, setIsScatSending] = useState(false);
  
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await axios.get(`${AGENT_API_BASE}/sessions`);
      setSessions(response.data);
    } catch (err) {
      console.error("Erro ao carregar sessoes:", err);
    }
  };

  const handleSelectSession = (session: AgentSession) => {
    setActiveSessionId(session.id);
    setObjective(session.objective);
    setSpecOnly(session.isSpecOnly);
    
    if (session.resultJson) {
      try {
        const parsed = JSON.parse(session.resultJson);
        setResult(parsed);
        setEditableContent(parsed.document.content);
      } catch (e) {
        console.error("Erro ao processar JSON da sessao:", e);
        setResult(null);
      }
    } else {
      setResult(null);
    }
    setLogs([]);
    fetchHistoricalLogs(session.id);
  };

  const exportToRTF = () => {
    const content = editableContent || result?.document.content || '';
    
    // Conversao simples de MD para RTF
    let rtf = '{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Arial;}}\n';
    rtf += '\\f0\\fs24 ';
    
    const lines = content.split('\n');
    lines.forEach(line => {
      let rtfLine = line;
      // Headings
      if (rtfLine.startsWith('# ')) rtfLine = '\\b\\fs32 ' + rtfLine.substring(2) + '\\b0\\fs24';
      else if (rtfLine.startsWith('## ')) rtfLine = '\\b\\fs28 ' + rtfLine.substring(3) + '\\b0\\fs24';
      else if (rtfLine.startsWith('### ')) rtfLine = '\\b\\fs24 ' + rtfLine.substring(4) + '\\b0';
      
      // Bold
      rtfLine = rtfLine.replace(/\*\*(.*?)\*\*/g, '\\b $1\\b0');
      
      rtf += rtfLine + '\\par\n';
    });
    
    rtf += '}';
    
    const blob = new Blob([rtf], { type: 'application/rtf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `especificacao_${activeSessionId || 'export'}.rtf`;
    a.click();
  };

  const handleSendToScat = async () => {
    setIsScatSending(true);
    // Simula persistencia
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsScatSending(false);
    setShowScatModal(false);
    alert('Analise persistida com sucesso na SCAT ' + scatData.scatNumber);
  };

  const fetchHistoricalLogs = async (sessionId: string) => {
    try {
      const response = await axios.get(`${AGENT_API_BASE}/sessions/${sessionId}/logs`);
      setLogs(response.data);
      const lastUsage = [...response.data].reverse().find(l => l.type === 'USAGE');
      if (lastUsage && lastUsage.data) {
        setTokens(lastUsage.data);
      } else {
        setTokens({ input: 0, output: 0, total: 0 });
      }
    } catch (err) {
      console.error("Erro ao carregar logs:", err);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Excluir permanentemente?')) {
      try {
        await axios.delete(`${AGENT_API_BASE}/sessions/${id}`);
        setSessions(prev => prev.filter(s => s.id !== id));
        if (activeSessionId === id) {
          setResult(null);
          setObjective('');
          setActiveSessionId(null);
        }
      } catch (err) {
        setError("Erro ao excluir do banco.");
      }
    }
  };

  const handleRunFullCycle = () => {
    if (!objective) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    setCreatedFiles([]); 
    setLogs([]);
    setTokens({ input: 0, output: 0, total: 0 });
    setTasks([]);
    setActiveSessionId(null);

    const params = new URLSearchParams({ objective, saveFiles: "true", specOnly: String(specOnly) });
    const eventSource = new EventSource(`${AGENT_API_BASE}/full-cycle-stream?${params.toString()}`);

    eventSource.addEventListener('progress', (event) => {
      const progress: ProgressEvent = JSON.parse(event.data);
      if (progress.type === 'FILE_CREATED') {
          setCreatedFiles(prev => [...prev, progress.message]);
          return; 
      }
      if (progress.type === 'USAGE' && progress.data) {
        setTokens(progress.data);
        return;
      }
      if (progress.type === 'TOOL_START') setActiveTool(progress.message);
      if (progress.type === 'TOOL_END') setActiveTool(null);
      setLogs(prev => [...prev, progress]);
      if (progress.type === 'TASK_LIST') {
        setTasks(progress.data);
      }
      if (progress.type === 'TASK_DONE' && progress.data) {
        setTasks(prev => prev.map(t => t.numero === progress.data.numero ? { ...t, concluida: true } : t));
      }

      if (progress.type === 'COMPLETE') {
        setResult(progress.data);
        setEditableContent(progress.data.document.content);
        setIsLoading(false);
        setActiveTool(null);
        fetchSessions();
        eventSource.close();
      }
    });

    eventSource.addEventListener('error', () => {
      setError('Erro na geracao ou Backend offline');
      setIsLoading(false);
      eventSource.close();
    });
  };

  const calculateProgress = () => {
    if (!isLoading) return 100;
    const lastLog = logs[logs.length - 1];
    if (!lastLog) return 5;
    
    const msg = lastLog.message.toLowerCase();
    const taskLogs = logs.filter(l => l.type === 'TASK_LIST');
    if (taskLogs.length > 0) {
      const totalTasks = taskLogs[0].data?.length || 1;
      const completedTasks = logs.filter(l => l.type === 'TASK_DONE').length;
      return Math.min(95, Math.round((completedTasks / totalTasks) * 100));
    }

    if (msg.includes('planejamento') || msg.includes('plano')) return 15;
    if (msg.includes('gerando secao')) return 30 + (logs.filter(l => l.message.includes('Gerando secao')).length * 5);
    if (msg.includes('revisao')) return 60 + (logs.filter(l => l.message.includes('revisao')).length * 10);
    if (msg.includes('incerteza') || msg.includes('confianca')) return 90;
    if (msg.includes('finalizado') || msg.includes('completo')) return 100;
    return 70; 
  };

  const getLogInfo = (type: string) => {
    switch (type) {
      case 'REFLECTION': return { icon: <Brain className="w-3 h-3" />, color: 'text-purple-400', bgColor: 'bg-purple-400/10', label: 'Reflection' };
      case 'THOUGHT': return { icon: <Lightbulb className="w-3 h-3" />, color: 'text-blue-400', bgColor: 'bg-blue-400/10', label: 'Thought' };
      case 'TOOL_START': return { icon: <Search className="w-3 h-3" />, color: 'text-amber-400', bgColor: 'bg-amber-400/10', label: 'Researching' };
      case 'TOOL_END': return { icon: <CheckCircle className="w-3 h-3" />, color: 'text-slate-400', bgColor: 'bg-slate-400/10', label: 'Wrench Complete' };
      case 'STEP_COMPLETE': return { icon: <Zap className="w-3 h-3" />, color: 'text-emerald-400', bgColor: 'bg-emerald-400/10', label: 'Phase Done' };
      case 'FILE_CREATED': return { icon: <FilePlus className="w-3 h-3" />, color: 'text-cyan-400', bgColor: 'bg-cyan-400/10', label: 'File Ready' };
      case 'ERROR': return { icon: <AlertCircle className="w-3 h-3" />, color: 'text-red-400', bgColor: 'bg-red-400/10', label: 'Error' };
      case 'COMPLETE': return { icon: <Sparkles className="w-3 h-3" />, color: 'text-indigo-400', bgColor: 'bg-indigo-400/10', label: 'Complete' };
      case 'PROMPT': return { icon: <Terminal className="w-3 h-3" />, color: 'text-flat-blue', bgColor: 'bg-flat-blue/10', label: 'Prompt Sent' };
      case 'TASK_LIST': return { icon: <Layers className="w-3 h-3" />, color: 'text-purple-400', bgColor: 'bg-purple-400/10', label: 'Task List' };
      case 'TASK_DONE': return { icon: <CheckCircle className="w-3 h-3" />, color: 'text-emerald-400', bgColor: 'bg-emerald-400/10', label: 'Task Done' };
      default: return { icon: <Cpu className="w-3 h-3" />, color: 'text-slate-300', bgColor: 'bg-slate-300/10', label: 'Processing' };
    }
  };

  return (
    <div className="h-full flex bg-white text-slate-900 overflow-hidden font-inter">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col z-20">
        <div className="p-4">
          <button 
            onClick={() => { setLogs([]); setResult(null); setObjective(''); setActiveSessionId(null); setIsLoading(false); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-slate-800 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nova Tarefa
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1 scrollbar-hide">
          <h3 className="px-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3 mt-4">Historico</h3>
          {sessions.map(session => (
            <button 
              key={session.id}
              onClick={() => handleSelectSession(session)}
              className={`w-full group relative flex flex-col p-3 rounded-xl text-left transition-all ${activeSessionId === session.id ? 'bg-white border border-slate-200 shadow-sm' : 'hover:bg-slate-200/50'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[8px] font-bold uppercase ${session.isSpecOnly ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {session.isSpecOnly ? 'Spec' : 'Code'}
                </span>
                <span className="text-[8px] text-slate-400">{session.createdAt ? new Date(session.createdAt).toLocaleDateString() : ''}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className={`text-[11px] font-bold truncate flex-1 ${activeSessionId === session.id ? 'text-flat-blue' : 'text-slate-600'}`}>
                  {session.objective}
                </p>
                <div onClick={(e) => handleDeleteSession(e, session.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all">
                  <Trash2 className="w-3 h-3" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-tight">AI Orchestrator</h2>
            </div>
            
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button onClick={() => setSpecOnly(true)} className={`px-3 py-1 text-[9px] font-bold uppercase rounded-md transition-all ${specOnly ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Doc</button>
              <button onClick={() => setSpecOnly(false)} className={`px-3 py-1 text-[9px] font-bold uppercase rounded-md transition-all ${!specOnly ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400'}`}>Full</button>
            </div>

            <div className="flex items-center gap-4 bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Tokens:</span>
              </div>
              <div className="flex gap-3">
                <span className="text-[10px] font-mono font-bold text-slate-400">In: {tokens.input}</span>
                <span className="text-[10px] font-mono font-bold text-slate-400">Out: {tokens.output}</span>
                <span className="text-[10px] font-mono font-bold text-slate-900">{tokens.total}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
          <div className="max-w-5xl mx-auto h-full flex flex-col">
            {!result && !isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in">
                <div className="mb-8 w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl border border-slate-100">
                  <Bot className="w-10 h-10 text-flat-blue" />
                </div>
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">O que vamos projetar?</h2>
                  <p className="text-slate-400 text-sm">Defina o objetivo e deixe o agente orquestrar a solucao.</p>
                </div>
                <div className="w-full max-w-xl relative">
                  <textarea 
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    placeholder="Digite o objetivo da arquitetura..."
                    className="w-full bg-white border border-slate-200 rounded-3xl p-8 text-base font-medium focus:border-flat-blue outline-none transition-all resize-none h-48 shadow-xl"
                  />
                  <button onClick={handleRunFullCycle} className="absolute bottom-6 right-6 w-14 h-14 bg-flat-blue text-white rounded-2xl flex items-center justify-center shadow-2xl hover:scale-105 transition-all">
                    <Play className="w-6 h-6 fill-white" />
                  </button>
                </div>
              </div>
            ) : isLoading ? (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-flat-blue/10 rounded-2xl text-flat-blue"><Activity className="w-6 h-6" /></div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status Atual</p>
                      <p className="text-xl font-bold text-slate-900">{logs[logs.length-1]?.message || 'Processando agentes...'}</p>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-flat-blue transition-all duration-500 ease-out" 
                      style={{width: `${calculateProgress()}%`}} 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm h-[450px] flex flex-col">
                    <div className="flex-1 flex flex-col min-h-0 mb-6">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Layers className="w-3 h-3" /> Plano de Execucao
                      </h3>
                      <div className="flex-1 space-y-2 overflow-y-auto scrollbar-hide">
                        {tasks.length > 0 ? (
                          tasks.map((task, i) => (
                            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${task.concluida ? 'bg-emerald-50 border-emerald-100 opacity-60' : 'bg-slate-50 border-slate-100'}`}>
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${task.concluida ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>
                                {task.concluida && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <span className={`text-[11px] font-bold truncate ${task.concluida ? 'text-emerald-700 line-through' : 'text-slate-600'}`}>
                                {task.numero}. {task.descricao}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl">
                            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tight">Aguardando plano...</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="h-1/3 flex flex-col min-h-0">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Files className="w-3 h-3" /> Arquivos
                      </h3>
                      <div className="flex-1 space-y-2 overflow-y-auto scrollbar-hide">
                        {createdFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <File className="w-4 h-4 text-emerald-500" />
                            <span className="text-[11px] font-bold text-slate-600 truncate">{f}</span>
                          </div>
                        ))}
                        {createdFiles.length === 0 && (
                          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl py-4">
                            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tight">Nenhum arquivo</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl h-[450px] flex flex-col border-4 border-slate-800 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-flat-blue via-purple-500 to-emerald-500 animate-pulse" />
                    
                    <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Agent Thought Stream</h3>
                      </div>
                      {isLoading && (
                        <div className="flex items-center gap-2 px-2 py-0.5 bg-flat-blue/20 rounded-full">
                          <span className="w-1.5 h-1.5 bg-flat-blue rounded-full animate-ping" />
                          <span className="text-[9px] font-bold text-flat-blue uppercase">Thinking</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide p-2 bg-black/40 rounded-2xl border border-white/5">
                      {logs.filter(l => l.type !== 'USAGE').map((log, i) => {
                        const info = getLogInfo(log.type);
                        const isLast = i === logs.filter(l => l.type !== 'USAGE').length - 1;
                        
                        return (
                          <div key={i} className={`flex flex-col gap-1 animate-in slide-in-from-left-2 duration-300 ${isLast && isLoading ? 'opacity-100' : 'opacity-70 hover:opacity-100'} transition-opacity`}>
                            <div className="flex items-center gap-2">
                              <div className={`p-1 rounded-md ${info.bgColor} ${info.color}`}>
                                {info.icon}
                              </div>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-bold uppercase tracking-wider ${info.color}`}>
                                    {info.label}
                                  </span>
                                  {log.agentName && (
                                    <span className="text-[8px] bg-white/5 text-slate-400 px-1.5 py-0.5 rounded border border-white/5 font-bold uppercase">
                                      {log.agentName}
                                    </span>
                                  )}
                                  <span className="text-[9px] text-slate-600 font-mono">
                                    {log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="pl-7 pr-4">
                              <p className={`text-[11px] leading-relaxed font-medium ${isLast && isLoading ? 'text-white' : 'text-slate-300'}`}>
                                {log.message}
                                {isLast && isLoading && <span className="inline-block w-1 h-3 bg-flat-blue ml-1 animate-pulse" />}
                              </p>
                              {log.data && (
                                <div className="mt-2 p-3 bg-black/40 rounded-xl border border-white/5 text-[10px] text-slate-400 font-mono overflow-x-auto max-h-40 scrollbar-hide">
                                  {log.type === 'TASK_LIST' && Array.isArray(log.data) ? (
                                    <div className="space-y-2">
                                      {log.data.map((task: any) => (
                                        <div key={task.numero} className="flex items-center gap-2">
                                          <div className={`w-3 h-3 rounded border flex items-center justify-center ${task.concluida ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                                            {task.concluida && <CheckCircle className="w-2 h-2 text-white" />}
                                          </div>
                                          <span className={task.concluida ? 'text-emerald-400 line-through' : 'text-slate-300'}>
                                            {task.numero}. {task.descricao}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : log.type === 'TASK_DONE' ? (
                                    null
                                  ) : (
                                    <pre className="whitespace-pre-wrap leading-relaxed">
                                      {typeof log.data === 'object' ? JSON.stringify(log.data, null, 2) : String(log.data)}
                                    </pre>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={logEndRef} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                  <div className="flex gap-2">
                    <button onClick={() => setActiveResultTab('doc')} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all rounded-lg ${activeResultTab === 'doc' ? 'bg-white text-flat-blue shadow-sm' : 'text-slate-400'}`}>Especificacao</button>
                    {!result?.specOnly && <button onClick={() => setActiveResultTab('code')} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all rounded-lg ${activeResultTab === 'code' ? 'bg-white text-flat-blue shadow-sm' : 'text-slate-400'}`}>Codigo</button>}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsEditing(!isEditing)}
                      className={`p-2 rounded-lg border transition-all ${isEditing ? 'bg-flat-blue text-white border-flat-blue' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                      title={isEditing ? "Visualizar" : "Editar"}
                    >
                      {isEditing ? <CheckCircle className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={exportToRTF}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg font-bold text-[9px] uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" /> RTF
                    </button>
                    <button 
                      onClick={() => setShowScatModal(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-[9px] uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" /> Enviar para SCAT
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-12 scrollbar-hide">
                  <div className="max-w-4xl mx-auto">
                    {isEditing && activeResultTab === 'doc' ? (
                      <textarea
                        value={editableContent}
                        onChange={(e) => setEditableContent(e.target.value)}
                        className="w-full h-[600px] bg-slate-50 border border-slate-200 rounded-xl p-6 text-slate-800 font-mono text-sm focus:border-flat-blue outline-none transition-all resize-none"
                        spellCheck={false}
                      />
                    ) : (
                      <div className="prose prose-slate max-w-none 
                                    font-inter text-slate-700 
                                    [&_h1]:text-4xl [&_h1]:font-black [&_h1]:mb-10 [&_h1]:text-slate-900 [&_h1]:tracking-tight
                                    [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:mt-14 [&_h2]:mb-6 [&_h2]:text-slate-800
                                    [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-8 [&_h3]:mb-4 [&_h3]:text-slate-800
                                    [&_p]:mb-8 [&_p]:leading-[1.8] [&_p]:text-base [&_p]:text-slate-600 [&_p]:font-medium [&_p]:text-justify
                                    [&_ul]:list-none [&_ul]:pl-4 [&_ul]:mb-8
                                    [&_ul_li]:text-slate-600 [&_ul_li]:mb-3 [&_ul_li]:pl-0
                                    [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-8 [&_ol_li]:mb-3 [&_ol_li]:pl-2
                                    [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-flat-blue [&_code]:font-mono [&_code]:text-[0.9em]
                                    [&_pre]:bg-slate-50 [&_pre]:text-slate-800 [&_pre]:p-8 [&_pre]:rounded-3xl [&_pre]:my-10 [&_pre]:border [&_pre]:border-slate-200 [&_pre]:font-mono [&_pre]:text-[0.85em] [&_pre]:leading-relaxed
                                    [&_table]:w-full [&_table]:border-collapse [&_table]:my-10 [&_table]:rounded-2xl [&_table]:overflow-hidden [&_table]:border [&_table]:border-slate-200 [&_table]:shadow-sm
                                    [&_table_thead]:bg-slate-50 [&_table_th]:p-4 [&_table_th]:text-slate-900 [&_table_th]:text-[11px] [&_table_th]:font-black [&_table_th]:uppercase [&_table_th]:tracking-wider [&_table_th]:border-b [&_table_th]:border-slate-200
                                    [&_table_td]:p-4 [&_table_td]:border-b [&_table_td]:border-slate-100 [&_table_td]:text-sm [&_table_td]:text-slate-600
                                    [&_table_tr:last-child_td]:border-b-0
                                    [&_table_tr:nth-child(even)]:bg-slate-50/50">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {activeResultTab === 'doc' ? (editableContent || result?.document.content || '') : (result?.code.notes || '')}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* SCAT MODAL */}
      {showScatModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 w-full max-w-md shadow-2xl">
             <h2 className="text-xl font-bold text-slate-900 mb-2">Integrar com SCAT</h2>
             <p className="text-slate-500 text-xs mb-6">Informe os detalhes para persistencia no sistema.</p>
             
             <div className="space-y-4">
               <div className="space-y-1.5">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Nome do Cliente</label>
                 <select 
                    value={scatData.client}
                    onChange={e => setScatData({...scatData, client: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 outline-none focus:border-flat-blue transition-all"
                 >
                    <option value="">Selecione um banco...</option>
                    <option value="Banco C6">Banco C6</option>
                    <option value="Banco Inter">Banco Inter</option>
                    <option value="Itaú Unibanco">Itaú Unibanco</option>
                    <option value="Caixa Econômica Federal">Caixa Econômica Federal</option>
                    <option value="Banco do Brasil">Banco do Brasil</option>
                    <option value="Sicoob">Sicoob</option>
                    <option value="Sicredi">Sicredi</option>
                    <option value="Bradesco">Bradesco</option>
                    <option value="Santander">Santander</option>
                 </select>
               </div>
               
               <div className="space-y-1.5">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Número da SCAT</label>
                 <input 
                    type="text" 
                    value={scatData.scatNumber}
                    onChange={e => setScatData({...scatData, scatNumber: e.target.value})}
                    placeholder="Ex: 2024-00582-AF"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 outline-none focus:border-flat-blue transition-all font-mono"
                 />
               </div>

               <div className="flex gap-3 pt-4">
                 <button 
                  onClick={() => setShowScatModal(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all"
                 >
                  Cancelar
                 </button>
                 <button 
                  onClick={handleSendToScat}
                  disabled={isScatSending || !scatData.client || !scatData.scatNumber}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                 >
                   {isScatSending ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</> : <><ShieldCheck className="w-4 h-4" /> Confirmar</>}
                 </button>
               </div>
             </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-8 right-8 p-4 bg-red-600 text-white rounded-2xl shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-4">
          <AlertCircle className="w-5 h-5" />
          <span className="text-xs font-bold">{error}</span>
          <button onClick={() => setError(null)} className="ml-4">✕</button>
        </div>
      )}
    </div>
  );
};

export default AgentsView;