import React, { useState, useEffect } from 'react';
import { Upload, FileText, Trash2, Database, Loader2, ChevronDown, ChevronUp, Cpu } from 'lucide-react';
import axios from 'axios';

interface Document {
  id: number;
  title: string;
  status: 'RECEIVED' | 'EXTRACTING' | 'CHUNKING' | 'EMBEDDING' | 'INDEXED' | 'FAILED';
  createdAt: string;
  chunkCount: number;
  progress?: number;
}

interface Chunk {
  id: number;
  text: string;
  ordinal: number;
  pageNumber: number;
  chunkExternalId: string;
}

const IngestionView = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [expandedDocId, setExpandedDocId] = useState<number | null>(null);
  const [expandedChunks, setExpandedChunks] = useState<Chunk[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get('/api/v1/documents');
      setDocuments(response.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  useEffect(() => {
    fetchDocuments();
    const interval = setInterval(fetchDocuments, 2000); // Poll more frequently for real-time feel
    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('Uploading...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('tenantId', 'default');
    formData.append('collectionId', 'main');

    try {
      await axios.post('/api/v1/ingestion/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchDocuments();
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadStatus('Erro no upload. Verifique o console ou configurações de API.');
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadStatus(null), 3000);
    }
  };

  const handleProcess = async (id: number) => {
    try {
      // Optimistic update
      setDocuments(docs => docs.map(d => 
        d.id === id ? { ...d, status: 'EXTRACTING', progress: 5 } : d
      ));
      await axios.post(`/api/v1/ingestion/process/${id}`);
      fetchDocuments();
    } catch (error) {
      console.error('Processing failed:', error);
      fetchDocuments(); // Revert on failure
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/v1/documents/${id}`);
      fetchDocuments();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Tem certeza que deseja apagar TODO o acervo técnico? Esta ação é irreversível.')) {
      try {
        await axios.delete('/api/v1/documents/all');
        fetchDocuments();
      } catch (error) {
        console.error('Error clearing library:', error);
      }
    }
  };

  const toggleExpand = async (docId: number) => {
    if (expandedDocId === docId) {
      setExpandedDocId(null);
      setExpandedChunks([]);
      return;
    }

    setExpandedDocId(docId);
    setIsLoadingChunks(true);
    try {
      const response = await axios.get(`/api/v1/documents/${docId}/chunks`);
      setExpandedChunks(response.data);
    } catch (error) {
      console.error('Error fetching chunks:', error);
    } finally {
      setIsLoadingChunks(false);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const config = {
      RECEIVED: { label: 'Recebido', color: 'bg-slate-100 text-slate-500' },
      EXTRACTING: { label: 'Extraindo Texto', color: 'bg-blue-50 text-blue-600 animate-pulse' },
      CHUNKING: { label: 'Quebrando em Chunks', color: 'bg-amber-50 text-amber-600 animate-pulse' },
      EMBEDDING: { label: 'Gerando Vetores', color: 'bg-indigo-50 text-indigo-600 animate-pulse' },
      INDEXED: { label: 'Pronto p/ RAG', color: 'bg-emerald-50 text-emerald-600' },
      FAILED: { label: 'Erro no Pipeline', color: 'bg-rose-50 text-rose-600' },
    }[status] || { label: status, color: 'bg-slate-100 text-slate-500' };

    return (
      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded ${config.color}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="max-w-5xl mx-auto w-full space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Library Manager</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Gerencie seu conhecimento técnico</p>
        </div>
        <button
          onClick={handleClearAll}
          className="flex items-center gap-2 px-6 py-2 bg-rose-50 text-rose-600 border-2 border-rose-100 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all active:scale-95"
        >
          <Trash2 className="w-4 h-4" />
          Limpar Acervo
        </button>
      </div>

      {/* Upload Zone */}
      <div className="bg-flat-gray p-12 rounded-lg border-2 border-dashed border-slate-300 hover:border-flat-blue transition-all text-center relative group">
        <input
          type="file"
          onChange={handleFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          disabled={isUploading}
        />
        <div className="space-y-4">
          <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center mx-auto border-2 border-slate-200 shadow-sm">
            {isUploading ? (
              <Loader2 className="w-8 h-8 text-flat-blue animate-spin" />
            ) : (
              <Upload className="w-8 h-8 text-flat-blue" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight">
              {isUploading ? 'Enviando Arquivo...' : 'Adicionar ao Acervo'}
            </h3>
            <p className="text-slate-500 mt-2 text-sm">PDF, TXT ou Markdown são bem-vindos</p>
          </div>
          {isUploading && (
            <div className="max-w-xs mx-auto space-y-2">
              <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-flat-blue animate-pulse" style={{ width: '100%' }} />
              </div>
              <p className="text-[10px] font-black text-flat-blue uppercase tracking-[0.2em] animate-pulse">
                Fazendo upload e extraindo texto...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Document List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Documentos Ativos ({documents.length})</h3>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {documents.map((doc) => (
            <div key={doc.id} className="space-y-1">
              <div 
                className={`bg-white border-2 p-4 rounded-lg flex items-center justify-between transition-all cursor-pointer ${expandedDocId === doc.id ? 'border-flat-blue ring-1 ring-flat-blue' : 'border-flat-gray hover:border-slate-300'}`}
                onClick={() => toggleExpand(doc.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-flat-gray rounded flex items-center justify-center text-slate-400 border border-slate-200">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{doc.title}</h4>
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-[10px] text-slate-400 uppercase font-black">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                      {doc.chunkCount > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-flat-blue font-black uppercase bg-blue-50 px-2 py-0.5 rounded">
                          <Database className="w-2.5 h-2.5" />
                          {doc.chunkCount} Chunks
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 flex-1 justify-end">
                  {doc.status !== 'INDEXED' && doc.status !== 'FAILED' && doc.status !== 'RECEIVED' && (
                    <div className="w-32 space-y-1">
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-flat-blue transition-all duration-500" 
                          style={{ width: `${doc.progress || 0}%` }} 
                        />
                      </div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter text-right">
                        {doc.progress || 0}%
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {doc.status === 'RECEIVED' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProcess(doc.id);
                        }}
                        className="px-4 py-1.5 bg-flat-blue text-white rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all active:scale-95 flex items-center gap-2 shadow-sm"
                      >
                        <Cpu className="w-3 h-3" />
                        Incorporar
                      </button>
                    )}
                    <StatusBadge status={doc.status} />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(doc.id);
                      }}
                      className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="p-1 text-slate-400">
                      {expandedDocId === doc.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Chunks Display */}
              {expandedDocId === doc.id && (
                <div className="ml-12 mr-2 bg-slate-50 border-x-2 border-b-2 border-slate-200 rounded-b-lg p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conteúdo Vetorial ({expandedChunks.length})</h5>
                    {isLoadingChunks && <Loader2 className="w-3 h-3 animate-spin text-flat-blue" />}
                  </div>
                  
                  <div className="space-y-3">
                    {expandedChunks.map((chunk, index) => (
                      <div key={chunk.id} className="bg-white border border-slate-200 rounded p-3 text-xs shadow-sm">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[9px] font-bold">#{index + 1}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Pág. {chunk.pageNumber || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Cpu className="w-3 h-3 text-indigo-400" />
                            <span className="text-[9px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">ID: {chunk.chunkExternalId || 'pending...'}</span>
                          </div>
                        </div>
                        <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                          {chunk.text}
                        </p>
                      </div>
                    ))}
                    {!isLoadingChunks && expandedChunks.length === 0 && (
                      <p className="text-center py-4 text-[10px] font-bold text-slate-400 uppercase italic">Nenhum chunk disponível para este documento.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {documents.length === 0 && (
            <div className="text-center py-20 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] bg-flat-gray rounded-lg border-2 border-dashed border-slate-200">
              O acervo está vazio.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IngestionView;
