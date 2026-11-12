import React from 'react';
import { FileSpreadsheet, BarChart3, FileText, Layers, CheckSquare } from 'lucide-react';
import { SourceItem, DocumentResult } from '../types';

interface NavbarProps {
  activeTab: 'fontes' | 'resultados' | 'texto' | 'teste';
  setActiveTab: (tab: 'fontes' | 'resultados' | 'texto' | 'teste') => void;
  sources: SourceItem[];
  documents: DocumentResult[];
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, sources, documents }) => {
  const totalSources = sources.length;
  const reviewCount = documents.reduce((acc, doc) => {
    const hasLow = Object.values(doc.fields).some(f => f.confidence === 'baixa' || f.confidence === 'ausente' || !f.validated);
    return acc + (hasLow ? 1 : 0);
  }, 0);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-md">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight">Extrator CCT / ACT</h1>
              <p className="text-xs text-slate-400">Análise de Convenções e Acordos Coletivos (100% Client-Side + Express)</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => setActiveTab('fontes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'fontes'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Fontes ({totalSources})</span>
            </button>

            <button
              onClick={() => setActiveTab('teste')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'teste'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>Teste</span>
            </button>

            <button
              onClick={() => setActiveTab('resultados')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all relative ${
                activeTab === 'resultados'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Resultados</span>
              {reviewCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                  {reviewCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('texto')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'texto'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Texto Bruto</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
