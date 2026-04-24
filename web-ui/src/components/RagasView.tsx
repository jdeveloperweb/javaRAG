import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Play, 
  Trash2, 
  CheckCircle, 
  BarChart3, 
  Target, 
  ShieldCheck, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
  Bot,
  Database,
  Cpu
} from 'lucide-react';

interface TestCase {
  id?: number;
  question: string;
  groundTruthAnswer: string;
  tenantId: string;
  createdAt?: string;
}

interface EvaluationResult {
  id: number;
  testCase: TestCase;
  question: string;
  generatedAnswer: string;
  contextUsed: string;
  faithfulnessScore: number;
  answerRelevancyScore: number;
  contextPrecisionScore: number;
  contextRecallScore: number;
  overallScore: number;
  provider: string;
  evaluationTimeMillis: number;
  createdAt: string;
}

const RagasView: React.FC = () => {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [evaluatingId, setEvaluatingId] = useState<number | null>(null);
  
  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newGroundTruth, setNewGroundTruth] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('OPENAI');
  
  // Detail state
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  useEffect(() => {
    fetchTestCases();
    fetchResults();
  }, []);

  const fetchTestCases = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/v1/ragas/test-cases');
      const data = await response.json();
      setTestCases(data);
    } catch (error) {
      console.error('Error fetching test cases:', error);
    }
  };

  const fetchResults = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/v1/ragas/results');
      const data = await response.json();
      setResults(data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error('Error fetching results:', error);
    }
  };

  const handleAddTestCase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:8080/api/v1/ragas/test-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: newQuestion,
          groundTruthAnswer: newGroundTruth,
          tenantId: 'default'
        }),
      });
      if (response.ok) {
        setNewQuestion('');
        setNewGroundTruth('');
        setShowAddForm(false);
        fetchTestCases();
      }
    } catch (error) {
      console.error('Error adding test case:', error);
    }
  };

  const handleDeleteTestCase = async (id: number) => {
    if (!confirm('Deseja excluir este caso de teste?')) return;
    try {
      await fetch(`http://localhost:8080/api/v1/ragas/test-cases/${id}`, {
        method: 'DELETE',
      });
      fetchTestCases();
    } catch (error) {
      console.error('Error deleting test case:', error);
    }
  };

  const handleEvaluate = async (id: number) => {
    setEvaluatingId(id);
    try {
      const response = await fetch(`http://localhost:8080/api/v1/ragas/evaluate/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          tenantId: 'default'
        }),
      });
      if (response.ok) {
        fetchResults();
      }
    } catch (error) {
      console.error('Error running evaluation:', error);
    } finally {
      setEvaluatingId(null);
    }
  };

  const handleBatchEvaluate = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8080/api/v1/ragas/evaluate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          tenantId: 'default'
        }),
      });
      if (response.ok) {
        alert('Avaliação em lote iniciada! Os resultados aparecerão em instantes.');
        // Periodically refresh results for a bit
        const interval = setInterval(fetchResults, 5000);
        setTimeout(() => clearInterval(interval), 60000);
      }
    } catch (error) {
      console.error('Error running batch evaluation:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-emerald-600';
    if (score >= 0.5) return 'text-amber-600';
    return 'text-rose-600';
  };

  const getAvgScore = (metric: keyof EvaluationResult) => {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, curr) => acc + (curr[metric] as number), 0);
    return (sum / results.length) * 100;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex justify-between items-center border-b-2 border-slate-100 pb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
            RAGAS Quality Insights
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Avaliação automatizada LLM-as-a-Judge</p>
        </div>
        <div className="flex gap-4">
          <select 
            value={selectedProvider} 
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="bg-white border-2 border-slate-100 rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-600 outline-none focus:border-primary-500 transition-all"
          >
            <option value="OPENAI">OpenAI (Judge)</option>
            <option value="ANTHROPIC">Anthropic (Judge)</option>
          </select>
          <button 
            onClick={handleBatchEvaluate}
            disabled={loading || testCases.length === 0}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-100 disabled:text-slate-400 text-white px-6 py-2 rounded-lg font-black text-xs uppercase tracking-widest shadow-md active:scale-95 transition-all"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Rodar Avaliação
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Faithfulness', value: getAvgScore('faithfulnessScore'), icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-50', desc: 'Fidelidade ao contexto' },
          { label: 'Relevancy', value: getAvgScore('answerRelevancyScore'), icon: Target, color: 'text-blue-500', bg: 'bg-blue-50', desc: 'Relevância da resposta' },
          { label: 'Precision', value: getAvgScore('contextPrecisionScore'), icon: BarChart3, color: 'text-purple-500', bg: 'bg-purple-50', desc: 'Precisão do contexto' },
          { label: 'Recall', value: getAvgScore('contextRecallScore'), icon: Info, color: 'text-orange-500', bg: 'bg-orange-50', desc: 'Recall do ground truth' },
        ].map((m, idx) => (
          <div key={idx} className="bg-white border-2 border-slate-100 p-6 rounded-xl flex flex-col items-center justify-center text-center shadow-sm">
            <div className={`${m.bg} p-3 rounded-lg mb-3`}>
              <m.icon className={`w-6 h-6 ${m.color}`} />
            </div>
            <div className="text-3xl font-black text-slate-900">{(m.value).toFixed(1)}%</div>
            <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{m.label}</div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{m.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Golden Dataset Section - Left side (1/3) */}
        <section className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Golden Dataset</h3>
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="p-1.5 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {showAddForm && (
              <form onSubmit={handleAddTestCase} className="bg-white border-2 border-primary-100 p-4 rounded-xl space-y-4 shadow-lg animate-in slide-in-from-top-2">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Pergunta</label>
                  <textarea 
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    required
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg p-3 text-slate-800 text-xs focus:border-primary-500 outline-none transition-all"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Ground Truth</label>
                  <textarea 
                    value={newGroundTruth}
                    onChange={(e) => setNewGroundTruth(e.target.value)}
                    required
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-lg p-3 text-slate-800 text-xs focus:border-primary-500 outline-none transition-all"
                    rows={2}
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <button type="button" onClick={() => setShowAddForm(false)} className="text-[10px] font-black text-slate-400 uppercase hover:text-slate-600">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest shadow-sm">Salvar</button>
                </div>
              </form>
            )}

            <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
              {testCases.map((tc) => (
                <div key={tc.id} className="bg-white border-2 border-slate-100 p-4 rounded-lg hover:border-primary-200 transition-all group">
                  <p className="text-xs font-bold text-slate-800 mb-2">{tc.question}</p>
                  <div className="flex items-center justify-between border-t border-slate-50 pt-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-500" />
                      GT DEFINIDO
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => handleEvaluate(tc.id!)}
                        disabled={evaluatingId === tc.id}
                        className="p-1.5 text-primary-500 hover:bg-primary-50 rounded"
                      >
                        {evaluatingId === tc.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      </button>
                      <button 
                        onClick={() => handleDeleteTestCase(tc.id!)}
                        className="p-1.5 text-rose-400 hover:bg-rose-50 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {testCases.length === 0 && (
                <div className="text-center py-10 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dataset Vazio</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Results Section - Right side (2/3) */}
        <section className="lg:col-span-2 space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Histórico de Performance</h3>
          
          <div className="bg-white border-2 border-slate-100 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest border-b-2 border-slate-100">
                  <tr>
                    <th className="px-4 py-4">Data/Hora</th>
                    <th className="px-4 py-4">F</th>
                    <th className="px-4 py-4">R</th>
                    <th className="px-4 py-4">P</th>
                    <th className="px-4 py-4">C</th>
                    <th className="px-4 py-4 text-center">Score</th>
                    <th className="px-4 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((res) => (
                    <React.Fragment key={res.id}>
                      <tr 
                        className={`hover:bg-slate-50 cursor-pointer transition-colors ${expandedRow === res.id ? 'bg-slate-50' : ''}`}
                        onClick={() => setExpandedRow(expandedRow === res.id ? null : res.id)}
                      >
                        <td className="px-4 py-4 font-bold text-slate-400">
                          {new Date(res.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className={`px-4 py-4 font-black ${getScoreColor(res.faithfulnessScore)}`}>
                          {(res.faithfulnessScore * 100).toFixed(0)}%
                        </td>
                        <td className={`px-4 py-4 font-black ${getScoreColor(res.answerRelevancyScore)}`}>
                          {(res.answerRelevancyScore * 100).toFixed(0)}%
                        </td>
                        <td className={`px-4 py-4 font-black ${getScoreColor(res.contextPrecisionScore)}`}>
                          {(res.contextPrecisionScore * 100).toFixed(0)}%
                        </td>
                        <td className={`px-4 py-4 font-black ${getScoreColor(res.contextRecallScore)}`}>
                          {(res.contextRecallScore * 100).toFixed(0)}%
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black border-2 ${getScoreColor(res.overallScore).replace('text-', 'border-').replace('text-', 'bg-').replace('600', '500/10')}`}>
                            {(res.overallScore * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-300">
                          {expandedRow === res.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </td>
                      </tr>
                      {expandedRow === res.id && (
                        <tr className="bg-white">
                          <td colSpan={7} className="px-6 py-6 animate-in slide-in-from-top-2 border-x-2 border-slate-50">
                            <div className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Bot className="w-3 h-3 text-indigo-500" />
                                    Resposta Gerada
                                  </h4>
                                  <div className="p-4 bg-slate-50 border-2 border-slate-100 rounded-lg text-slate-800 text-xs leading-relaxed font-medium">
                                    {res.generatedAnswer}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                                    Ground Truth
                                  </h4>
                                  <div className="p-4 bg-emerald-50/20 border-2 border-emerald-100/30 rounded-lg text-slate-600 text-xs leading-relaxed italic">
                                    {res.testCase.groundTruthAnswer}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                  <Database className="w-3 h-3 text-blue-500" />
                                  Contexto Recuperado
                                </h4>
                                <div className="p-4 bg-white border-2 border-slate-100 rounded-lg space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                                  {res.contextUsed.split('\n\n---\n\n').map((block, i) => (
                                    <div key={i} className="pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Cpu className="w-3 h-3 text-primary-400" />
                                        <span className="text-[8px] font-black text-primary-500 uppercase">Chunk #{i+1}</span>
                                      </div>
                                      <p className="text-[10px] text-slate-500 font-mono leading-relaxed">{block}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="flex justify-between items-center border-t border-slate-100 pt-4 px-2">
                                <div className="flex gap-4">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-1.5">
                                    <ShieldCheck className="w-3 h-3" /> Provider: {res.provider}
                                  </span>
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter flex items-center gap-1.5">
                                    <RefreshCw className="w-3 h-3" /> Latência: {res.evaluationTimeMillis}ms
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {results.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-20 text-center text-slate-300 font-black uppercase tracking-[0.2em]">
                        Sem resultados para exibir
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default RagasView;
