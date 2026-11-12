import React, { useState } from 'react';
import { Play, Download, CheckCircle2, AlertTriangle, XCircle, Clock, ExternalLink, RefreshCw, Layers, ShieldAlert } from 'lucide-react';
import * as XLSX from 'xlsx';
import { SourceItem, ProbeResult, ScoredCandidate } from '../types';
import { saveSources } from '../utils/indexedDB';

interface TesteTabProps {
  sources: SourceItem[];
  setSources: React.Dispatch<React.SetStateAction<SourceItem[]>>;
}

const lastRequestByDomain = new Map<string, number>();

async function enforceDomainRateLimit(targetUrl: string) {
  try {
    const domain = new URL(targetUrl).hostname;
    const lastTime = lastRequestByDomain.get(domain) || 0;
    const now = Date.now();
    const elapsed = now - lastTime;
    if (elapsed < 1000) {
      await new Promise(r => setTimeout(r, 1000 - elapsed));
    }
    lastRequestByDomain.set(domain, Date.now());
  } catch {}
}

export const TesteTab: React.FC<TesteTabProps> = ({ sources, setSources }) => {
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [selectedSourceForCandidates, setSelectedSourceForCandidates] = useState<SourceItem | null>(null);

  // Summary counts
  const total = sources.length;
  const okCount = sources.filter(s => s.probe?.diagnosis === 'OK').length;
  const semLinksCount = sources.filter(s => s.probe?.diagnosis === 'SEM_LINKS').length;
  const bloqueadoCount = sources.filter(s => s.probe?.diagnosis === 'BLOQUEADO').length;
  const erroCount = sources.filter(s => s.probe?.diagnosis === 'ERRO').length;
  const okPercentage = total > 0 ? ((okCount / total) * 100).toFixed(1) : '0';

  const testSingleSource = async (source: SourceItem) => {
    setTestingIds(prev => new Set(prev).add(source.id));
    await enforceDomainRateLimit(source.url);

    try {
      const response = await fetch('/api/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: source.url, category: source.categoria })
      });
      const data: ProbeResult = await response.json();
      data.testedAt = new Date().toLocaleString('pt-BR');

      setSources(prev => {
        const next = prev.map(s => s.id === source.id ? { ...s, probe: data } : s);
        saveSources(next);
        return next;
      });
    } catch (err: any) {
      const errorProbe: ProbeResult = {
        pageStatus: 0,
        durationMs: 0,
        fileLinksCount: 0,
        candidates: [],
        bestTest: null,
        diagnosis: 'ERRO',
        message: err.message,
        testedAt: new Date().toLocaleString('pt-BR')
      };

      setSources(prev => {
        const next = prev.map(s => s.id === source.id ? { ...s, probe: errorProbe } : s);
        saveSources(next);
        return next;
      });
    } finally {
      setTestingIds(prev => {
        const next = new Set(prev);
        next.delete(source.id);
        return next;
      });
    }
  };

  const handleTestAll = async () => {
    setIsTestingAll(true);
    const CONCURRENCY_LIMIT = 2;
    let index = 0;

    const worker = async () => {
      while (index < sources.length) {
        const item = sources[index++];
        await testSingleSource(item);
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, sources.length) }, () => worker());
    await Promise.all(workers);
    setIsTestingAll(false);
  };

  const handleExportTestResults = () => {
    const rows = sources.map(s => ({
      'UF': s.uf,
      'Sindicato': s.sindicato,
      'Categoria': s.categoria,
      'URL Base': s.url,
      'Diagnóstico': s.probe?.diagnosis || 'Não testado',
      'Status HTTP': s.probe?.pageStatus || 'N/A',
      'Nº Links Arquivo': s.probe?.fileLinksCount || 0,
      'Melhor Candidato': s.probe?.candidates?.[0]?.url || 'N/A',
      'Tamanho (Bytes)': s.probe?.bestTest?.totalSize || 0,
      'Tempo (ms)': s.probe?.durationMs || 0,
      'Data Teste': s.probe?.testedAt || 'N/A',
      'Mensagem': s.probe?.message || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultados Teste');
    XLSX.writeFile(workbook, `relatorio_teste_cct_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  function formatBytes(bytes: number) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fadeIn">
      {/* Top Banner & Summary */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Painel de Teste e Diagnóstico de Links</h2>
            <p className="text-sm text-slate-600 mt-1">
              Testa a acessibilidade das páginas e pontuação de candidatos a CCT/ACT sem baixar os arquivos inteiros (Range bytes).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportTestResults}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors shadow-xs"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Exportar Resultado do Teste</span>
            </button>

            <button
              onClick={handleTestAll}
              disabled={isTestingAll || sources.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium text-sm transition-colors shadow-sm cursor-pointer"
            >
              <Play className={`w-4 h-4 ${isTestingAll ? 'animate-spin' : ''}`} />
              <span>{isTestingAll ? 'Testando (2x concorrentes)...' : 'Testar Todas'}</span>
            </button>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-2">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="text-xs text-slate-500 font-semibold uppercase">Total</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{total}</div>
          </div>
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
            <div className="text-xs text-emerald-700 font-semibold uppercase">OK</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{okCount}</div>
          </div>
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
            <div className="text-xs text-amber-700 font-semibold uppercase">Sem Links</div>
            <div className="text-2xl font-bold text-amber-700 mt-1">{semLinksCount}</div>
          </div>
          <div className="bg-rose-50 p-4 rounded-xl border border-rose-200">
            <div className="text-xs text-rose-700 font-semibold uppercase">Bloqueado</div>
            <div className="text-2xl font-bold text-rose-700 mt-1">{bloqueadoCount}</div>
          </div>
          <div className="bg-red-50 p-4 rounded-xl border border-red-200">
            <div className="text-xs text-red-700 font-semibold uppercase">Erro</div>
            <div className="text-2xl font-bold text-red-700 mt-1">{erroCount}</div>
          </div>
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
            <div className="text-xs text-indigo-700 font-semibold uppercase">% Sucesso</div>
            <div className="text-2xl font-bold text-indigo-700 mt-1">{okPercentage}%</div>
          </div>
        </div>
      </div>

      {/* Test Results Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {sources.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
              <Layers className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-slate-800 text-base">Nenhuma fonte cadastrada na aba FONTES</h4>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Cadastre fontes na aba FONTES para realizar os testes de diagnóstico.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">UF</th>
                  <th className="py-3.5 px-4">Sindicato</th>
                  <th className="py-3.5 px-4">Diagnóstico</th>
                  <th className="py-3.5 px-4">Status HTTP</th>
                  <th className="py-3.5 px-4">Links</th>
                  <th className="py-3.5 px-4">Melhor Candidato</th>
                  <th className="py-3.5 px-4">Tamanho</th>
                  <th className="py-3.5 px-4">Tempo</th>
                  <th className="py-3.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
                {sources.map(src => {
                  const probe = src.probe;
                  const isTesting = testingIds.has(src.id);

                  return (
                    <tr 
                      key={src.id} 
                      onClick={() => probe && probe.candidates?.length > 0 && setSelectedSourceForCandidates(src)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900">{src.uf}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{src.sindicato}</div>
                        <div className="text-xs text-slate-500">{src.categoria}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        {isTesting ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Testando...
                          </span>
                        ) : !probe ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                            <Clock className="w-3.5 h-3.5" /> Não testado
                          </span>
                        ) : probe.diagnosis === 'OK' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" /> OK
                          </span>
                        ) : probe.diagnosis === 'SEM_LINKS' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3.5 h-3.5" /> SEM_LINKS
                          </span>
                        ) : probe.diagnosis === 'BLOQUEADO' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <ShieldAlert className="w-3.5 h-3.5" /> BLOQUEADO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                            <XCircle className="w-3.5 h-3.5" /> ERRO
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-xs">
                        {probe ? probe.pageStatus : '-'}
                      </td>
                      <td className="py-3.5 px-4 font-semibold">
                        {probe ? probe.fileLinksCount : '-'}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate">
                        {probe?.candidates?.[0] ? (
                          <a 
                            href={probe.candidates[0].url} 
                            target="_blank" 
                            rel="noreferrer" 
                            onClick={e => e.stopPropagation()}
                            className="text-indigo-600 hover:underline text-xs flex items-center gap-1 font-mono truncate"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{probe.candidates[0].url}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Nenhum</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs">
                        {probe?.bestTest?.totalSize ? formatBytes(probe.bestTest.totalSize) : '-'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs">
                        {probe ? `${probe.durationMs}ms` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => testSingleSource(src)}
                          disabled={isTesting}
                          className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs transition-colors inline-flex items-center gap-1 border border-indigo-200 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                          <span>Testar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Candidates Modal */}
      {selectedSourceForCandidates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-6 border border-slate-200">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Top 5 Candidatos Raspados</h3>
              <p className="text-sm text-slate-600 mt-1">
                Sindicato: <span className="font-semibold text-slate-800">{selectedSourceForCandidates.sindicato} ({selectedSourceForCandidates.uf})</span>
              </p>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {selectedSourceForCandidates.probe?.candidates?.map((cand, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      Pontuação: {cand.score}
                    </span>
                  </div>
                  <div className="font-medium text-slate-900 text-sm">{cand.title || 'Link candidato'}</div>
                  <a href={cand.url} target="_blank" rel="noreferrer" className="text-indigo-600 text-xs hover:underline truncate block font-mono">
                    {cand.url}
                  </a>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedSourceForCandidates(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-sm transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
