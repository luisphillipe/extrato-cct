import React, { useState, useMemo } from 'react';
import { FileText, Search, Copy, Check, BookOpen } from 'lucide-react';
import { SourceItem, DocumentResult } from '../types';

interface TextoTabProps {
  sources: SourceItem[];
  documents: DocumentResult[];
}

export const TextoTab: React.FC<TextoTabProps> = ({ sources, documents }) => {
  const [selectedSourceId, setSelectedSourceId] = useState<string>(sources[0]?.id || '');
  const [textSearch, setTextSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const docMap = useMemo(() => new Map(documents.map(d => [d.sourceId, d])), [documents]);
  const currentDoc = docMap.get(selectedSourceId);
  const currentSource = sources.find(s => s.id === selectedSourceId);

  const handleCopy = () => {
    if (!currentDoc) return;
    navigator.clipboard.writeText(currentDoc.rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fadeIn">
      {/* Header & Selector */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Visualizador de Texto Bruto</h2>
          <p className="text-sm text-slate-600 mt-1">
            Inspecione o texto completo extraído dos documentos via PDF / OCR / DOCX.
          </p>
        </div>

        <div className="w-full md:w-80">
          <select
            value={selectedSourceId}
            onChange={(e) => setSelectedSourceId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {sources.length === 0 ? (
              <option value="">Nenhuma fonte disponível</option>
            ) : (
              sources.map(src => (
                <option key={src.id} value={src.id}>
                  [{src.uf}] {src.sindicato} ({src.tipo})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Text Content Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[70vh]">
        {/* Subheader with Search & Copy */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold text-slate-800 text-sm">
              {currentSource ? `${currentSource.sindicato} (${currentSource.uf})` : 'Selecione um documento'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar no texto..."
                value={textSearch}
                onChange={(e) => setTextSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>

            <button
              onClick={handleCopy}
              disabled={!currentDoc}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs transition-colors border border-indigo-200 cursor-pointer disabled:opacity-50"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>
          </div>
        </div>

        {/* Raw Text Area */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-slate-800 bg-slate-900 text-slate-100 leading-relaxed whitespace-pre-wrap select-text">
          {currentDoc ? currentDoc.rawText : 'Nenhum texto extraído para este documento. Processe o documento na aba Fontes.'}
        </div>
      </div>
    </div>
  );
};
