import React, { useState, useEffect } from 'react';
import { History, Search, Clock, Cpu, ChevronDown, ChevronUp, Activity } from 'lucide-react';
import axios from 'axios';

interface AuditLog {
  id: number;
  tenantId: string;
  userId: string;
  userQuery: string;
  aiResponse: string;
  modelUsed: string;
  responseTimeMillis: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  createdAt: string;
}

const AuditLogView = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  const fetchLogs = async () => {
    try {
      const response = await axios.get('/api/v1/audit');
      setLogs(response.data);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const toggleExpand = (id: number) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  return (
    <div className="max-w-5xl mx-auto w-full space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Audit Log</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Histórico de interações e performance</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-500 rounded-lg border-2 border-slate-100 font-bold text-[10px] uppercase tracking-widest">
          <Activity className="w-3 h-3 text-emerald-500" />
          Real-time Monitoring
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-20 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] bg-flat-gray rounded-lg border-2 border-dashed border-slate-200">
            Carregando logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] bg-flat-gray rounded-lg border-2 border-dashed border-slate-200">
            Nenhum registro de auditoria encontrado.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {logs.map((log) => (
              <div key={log.id} className="space-y-1">
                <div 
                  className={`bg-white border-2 p-4 rounded-lg flex items-center justify-between transition-all cursor-pointer ${expandedLogId === log.id ? 'border-flat-blue ring-1 ring-flat-blue' : 'border-flat-gray hover:border-slate-300'}`}
                  onClick={() => toggleExpand(log.id)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 bg-flat-gray rounded flex items-center justify-center text-slate-400 border border-slate-200 shrink-0">
                      <History className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-bold rounded uppercase flex items-center gap-1">
                          <Cpu className="w-2.5 h-2.5" />
                          {log.modelUsed}
                        </span>
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-bold rounded uppercase flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {log.responseTimeMillis}ms
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm truncate pr-4">
                        {log.userQuery}
                      </h4>
                    </div>
                  </div>

                  <div className="p-1 text-slate-400 shrink-0">
                    {expandedLogId === log.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>

                {expandedLogId === log.id && (
                  <div className="ml-10 mr-2 bg-slate-50 border-x-2 border-b-2 border-slate-200 rounded-b-lg p-6 space-y-6 animate-in slide-in-from-top-2 duration-200">
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Search className="w-3 h-3" />
                        Pergunta do Usuário
                      </h5>
                      <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-700 font-medium leading-relaxed shadow-sm">
                        {log.userQuery}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Cpu className="w-3 h-3" />
                        Resposta da IA
                      </h5>
                      <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-700 font-medium leading-relaxed shadow-sm border-l-4 border-l-flat-blue">
                        {log.aiResponse}
                      </div>
                    </div>

                    <div className="flex items-center gap-8 pt-2 border-t border-slate-200">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Response Time</p>
                        <p className="text-xs font-bold text-slate-700">{log.responseTimeMillis}ms</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Model ID</p>
                        <p className="text-xs font-bold text-slate-700">{log.modelUsed}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">User ID</p>
                        <p className="text-xs font-bold text-slate-700">{log.userId || 'anonymous'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Tokens (I/O/T)</p>
                        <p className="text-xs font-bold text-slate-700">
                          {log.promptTokens || 0} / {log.completionTokens || 0} / {log.totalTokens || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Est. Cost</p>
                        <p className="text-xs font-bold text-emerald-600">${log.estimatedCost?.toFixed(4) || '0.0000'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogView;
