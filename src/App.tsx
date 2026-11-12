import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { FontesTab } from './components/FontesTab';
import { TesteTab } from './components/TesteTab';
import { ResultadosTab } from './components/ResultadosTab';
import { TextoTab } from './components/TextoTab';
import { SourceItem, DocumentResult } from './types';
import { getAllSources, getAllDocuments, saveSources } from './utils/indexedDB';

const INITIAL_DEMO_SOURCES: SourceItem[] = [
  {
    id: 'demo_1',
    uf: 'SP',
    sindicato: 'Sindicato dos Trabalhadores em TI de São Paulo (Sindpd)',
    categoria: 'Tecnologia da Informação',
    tipo: 'CCT',
    url: 'https://www.sindpd.org.br/sindpd/upload/arquivos/cct_2024.pdf',
    observacao: 'Exemplo demonstrativo pré-cadastrado',
    status: 'pendente'
  },
  {
    id: 'demo_2',
    uf: 'RJ',
    sindicato: 'Sindicato dos Comerciários do Rio de Janeiro',
    categoria: 'Comércio Varejista',
    tipo: 'ACT',
    url: 'https://www.comerciariosrj.org.br/acordo2025.pdf',
    observacao: 'Exemplo demonstrativo empresa varejista',
    status: 'pendente'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'fontes' | 'resultados' | 'texto' | 'teste'>('fontes');
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [documents, setDocuments] = useState<DocumentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const loadedSources = await getAllSources();
        const loadedDocs = await getAllDocuments();

        if (loadedSources.length === 0) {
          setSources(INITIAL_DEMO_SOURCES);
          await saveSources(INITIAL_DEMO_SOURCES);
        } else {
          setSources(loadedSources);
        }

        setDocuments(loadedDocs);
      } catch (err) {
        console.error('Erro ao carregar dados do IndexedDB:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <div className="text-sm font-medium text-slate-300">Carregando Extrator CCT / ACT...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 antialiased selection:bg-indigo-500 selection:text-white">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        sources={sources} 
        documents={documents} 
      />

      <main className="flex-1 pb-16">
        {activeTab === 'fontes' && (
          <FontesTab
            sources={sources}
            setSources={setSources}
            documents={documents}
            setDocuments={setDocuments}
            onRefresh={() => {}}
          />
        )}

        {activeTab === 'teste' && (
          <TesteTab
            sources={sources}
            setSources={setSources}
          />
        )}

        {activeTab === 'resultados' && (
          <ResultadosTab
            sources={sources}
            documents={documents}
            setDocuments={setDocuments}
          />
        )}

        {activeTab === 'texto' && (
          <TextoTab
            sources={sources}
            documents={documents}
          />
        )}
      </main>
    </div>
  );
}
