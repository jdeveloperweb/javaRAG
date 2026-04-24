import React, { useState, useEffect } from 'react';
import { Activity, Coins, Zap, BarChart3, Clock, ArrowUpRight, TrendingUp } from 'lucide-react';
import axios from 'axios';

interface Stats {
  totalTokens: number;
  totalCost: number;
  avgResponseTime: number;
  totalRequests: number;
}

const ObservabilityView = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/v1/observability/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">
          Analizando métricas...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Observabilidade</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Monitoramento de Custos e Performance</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg border-2 border-emerald-100 font-bold text-[10px] uppercase tracking-widest">
          <Activity className="w-3 h-3" />
          System Health: Optimal
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Tokens Totais" 
          value={stats.totalTokens.toLocaleString()} 
          icon={<Zap className="w-5 h-5 text-amber-500" />}
          subtitle="Volume de dados processado"
        />
        <StatCard 
          title="Custo Estimado" 
          value={`$${stats.totalCost.toFixed(4)}`} 
          icon={<Coins className="w-5 h-5 text-emerald-500" />}
          subtitle="Gasto acumulado (USD)"
          trend="+2.4%"
        />
        <StatCard 
          title="Latência Média" 
          value={`${stats.avgResponseTime.toFixed(0)}ms`} 
          icon={<Clock className="w-5 h-5 text-blue-500" />}
          subtitle="Tempo médio de resposta"
        />
        <StatCard 
          title="Requisições" 
          value={stats.totalRequests.toString()} 
          icon={<BarChart3 className="w-5 h-5 text-indigo-500" />}
          subtitle="Total de interações"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border-2 border-slate-100 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Projeção de Custos
            </h3>
          </div>
          
          <div className="h-64 flex items-end gap-2 px-4">
             {/* Mock chart since we don't have time-series data yet */}
             {[40, 65, 35, 90, 55, 75, 45, 80, 60, 95].map((h, i) => (
               <div key={i} className="flex-1 bg-slate-100 rounded-t-lg relative group transition-all hover:bg-emerald-100">
                 <div 
                   className="absolute bottom-0 left-0 right-0 bg-emerald-500 rounded-t-lg transition-all" 
                   style={{ height: `${h}%` }}
                 />
                 <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[9px] font-bold py-1 px-2 rounded whitespace-nowrap">
                   Day {i + 1}: ${((h/100) * (stats.totalCost/5)).toFixed(3)}
                 </div>
               </div>
             ))}
          </div>
          <div className="flex justify-between mt-4 text-[9px] font-black text-slate-300 uppercase tracking-widest px-2">
            <span>Últimos 10 dias</span>
            <span>Hoje</span>
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-8 text-white space-y-6">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Efficiency Score</h3>
          <div className="space-y-2">
            <div className="flex items-end justify-between">
              <span className="text-4xl font-black italic">84<span className="text-lg not-italic text-slate-500 ml-1">/100</span></span>
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">EXCELLENT</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full w-[84%]" />
            </div>
          </div>
          
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Model Reuse Rate</span>
              <span className="text-xs font-bold text-white">92%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cache Hit Ratio</span>
              <span className="text-xs font-bold text-white">12.5%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Token Efficiency</span>
              <span className="text-xs font-bold text-white">0.42 t/ms</span>
            </div>
          </div>

          <button className="w-full py-3 bg-white text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors">
            Download Report
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, subtitle, trend }: any) => (
  <div className="bg-white border-2 border-slate-100 p-6 rounded-2xl shadow-sm hover:border-slate-200 transition-all group">
    <div className="flex items-start justify-between mb-4">
      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      {trend && (
        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
          {trend}
        </span>
      )}
    </div>
    <div className="space-y-1">
      <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{title}</h4>
      <p className="text-2xl font-black text-slate-900">{value}</p>
      <p className="text-[10px] font-bold text-slate-400">{subtitle}</p>
    </div>
  </div>
);

export default ObservabilityView;
