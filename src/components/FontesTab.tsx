import React, { useState, useRef } from 'react';
import { Download, Upload, Play, RefreshCw, AlertCircle, CheckCircle2, Clock, Trash2, FileUp, ExternalLink, ListFilter, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { SourceItem, DocumentResult, ProcessingStatus, ScoredCandidate } from '../types';
import { downloadSpreadsheetTemplate } from '../utils/excel';
import { fetchAndExtractDocument } from '../utils/parser';
import { extractFieldsFromText } from '../utils/extractionRules';
import { saveSources, saveDocumentResult } from '../utils/indexedDB';

interface FontesTabProps {
  sources: SourceItem[];
  setSources: React.Dispatch<React.SetStateAction<SourceItem[]>>;
  documents: DocumentResult[];
  setDocuments: React.Dispatch<React.SetStateAction<DocumentResult[]>>;
  onRefresh: () => void;
}

// Domain throttling tracker
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
  } catch {
    // ignore
  }
}

export const FontesTab: React.FC<FontesTabProps> = ({
  sources,
  setSources,
  documents,
  setDocuments
}) => {
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [manualUploadSource, setManualUploadSource] = useState<SourceItem | null>(null);
  const [viewCandidatesSource, setViewCandidatesSource] = useState<SourceItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualFileInputRef = useRef<HTMLInputElement>(null);

  const handleSpreadsheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);

        const newSources: SourceItem[] = json.map((row, idx) => ({
          id: `src_${Date.now()}_${idx}`,
          uf: String(row['UF'] || row['uf'] || 'SP').toUpperCase().trim(),
          sindicato: String(row['Sindicato'] || row['sindicato'] || 'Sindicato Não Informado').trim(),
          categoria: String(row['Categoria'] || row['categoria'] || 'Geral').trim(),
          tipo: (String(row['Tipo'] || row['tipo'] || 'CCT').toUpperCase() === 'ACT' ? 'ACT' : 'CCT'),
          url: String(row['URL'] || row['url'] || '').trim(),
          observacao: String(row['Observação'] || row['observacao'] || '').trim(),
          status: 'pendente'
        }));

        const updated = [...sources, ...newSources];
        setSources(updated);
        await saveSources(updated);
      } catch (err: any) {
        alert(`Erro ao ler planilha Excel: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Process single source
  const processSourceItem = async (source: SourceItem, manualFile?: File, overrideUrl?: string) => {
    setProcessingIds(prev => new Set(prev).add(source.id));

    const targetUrl = overrideUrl || source.url;

    const updateStatus = async (status: ProcessingStatus, errorMsg?: string, extra?: Partial<SourceItem>) => {
      setSources(prev => {
        const next = prev.map(s => s.id === source.id ? { ...s, status, errorMessage: errorMsg, ...extra } : s);
        saveSources(next);
        return next;
      });
    };

    try {
      await updateStatus('baixando');
      if (!manualFile) {
        await enforceDomainRateLimit(targetUrl);
      }

      const result = await fetchAndExtractDocument(targetUrl, manualFile, (msg) => {
        if (msg.includes('OCR')) updateStatus('ocr');
        else if (msg.includes('Extraindo') || msg.includes('Lendo')) updateStatus('extraindo');
      });

      const fields = extractFieldsFromText(result.rawText);

      const docResult: DocumentResult = {
        sourceId: source.id,
        rawText: result.rawText,
        fields,
        updatedAt: new Date().toISOString()
      };

      await saveDocumentResult(docResult);
      setDocuments(prev => [...prev.filter(d => d.sourceId !== source.id), docResult]);

      await updateStatus('concluido', undefined, {
        fileName: result.fileName,
        fileSize: result.fileSize,
        fileHash: result.fileHash,
        chosenUrl: result.chosenUrl,
        dataCaptura: result.dataCaptura,
        candidates: result.candidates,
        lastProcessed: new Date().toISOString(),
        errorMessage: undefined
      });
    } catch (err: any) {
      const msg = err.message || 'Erro desconhecido';
      if (msg.includes('REQUER_NAVEGACAO')) {
        await updateStatus('requer_navegacao', msg.replace('REQUER_NAVEGACAO: ', ''));
      } else {
        await updateStatus('erro', msg);
      }
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(source.id);
        return next;
      });
    }
  };

  // Concurrent Queue (Max 2 downloads simultaneously)
  const handleProcessAll = async () => {
    setIsProcessingAll(true);
    const targets = sources.filter(s => s.status === 'pendente' || s.status === 'erro' || s.status === 'requer_navegacao');

    const CONCURRENCY_LIMIT = 2;
    let index = 0;

    const worker = async () => {
      while (index < targets.length) {
        const item = targets[index++];
        await processSourceItem(item);
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, targets.length) }, () => worker());
    await Promise.all(workers);

    setIsProcessingAll(false);
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm('Deseja realmente remover esta fonte?')) return;
    const updated = sources.filter(s => s.id !== id);
    setSources(updated);
    await saveSources(updated);
  };

  const handleManualFileUploadSubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !manualUploadSource) return;
    await processSourceItem(manualUploadSource, file);
    setManualUploadSource(null);
    if (manualFileInputRef.current) manualFileInputRef.current.value = '';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Top Banner & Actions */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Fontes de Convenções e Acordos Coletivos (CCT/ACT)</h2>
          <p className="text-sm text-slate-600 mt-1">
            Servidor Express com raspador inteligente e ranking de links por palavras-chave e anos.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={downloadSpreadsheetTemplate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors shadow-xs"
          >
            <Download className="w-4 h-4 text-indigo-600" />
            <span>Baixar Modelo Excel</span>
          </button>

          <label className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors shadow-sm cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Importar Planilha</span>
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              ref={fileInputRef} 
              onChange={handleSpreadsheetUpload} 
              className="hidden" 
            />
          </label>

          {sources.length > 0 && (
            <button
              onClick={handleProcessAll}
              disabled={isProcessingAll}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium text-sm transition-colors shadow-sm cursor-pointer"
            >
              <Play className={`w-4 h-4 ${isProcessingAll ? 'animate-spin' : ''}`} />
              <span>{isProcessingAll ? 'Processando Fila (2x)...' : 'Processar Todos'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sources Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Lista de Fontes Cadastradas ({sources.length})</h3>
          <div className="text-xs text-slate-500 font-medium">
            Concluídos: {sources.filter(s => s.status === 'concluido').length} / {sources.length}
          </div>
        </div>

        {sources.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-4">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-base">Nenhuma fonte cadastrada</h4>
              <p className="text-slate-500 text-sm max-w-md mx-auto mt-1">
                Baixe o modelo de planilha, adicione as URLs dos documentos CCT/ACT e faça o upload para começar.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">UF</th>
                  <th className="py-3 px-4">Sindicato</th>
                  <th className="py-3 px-4">Link Escolhido / Captura</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
                {sources.map((src) => (
                  <tr key={src.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{src.uf}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">{src.sindicato}</div>
                      <div className="text-xs text-slate-500">{src.categoria} ({src.tipo})</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      {src.chosenUrl ? (
                        <div className="space-y-1">
                          <a 
                            href={src.chosenUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-indigo-600 hover:underline text-xs flex items-center gap-1 font-mono truncate"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{src.chosenUrl}</span>
                          </a>
                          {src.dataCaptura && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> Capturado em: {src.dataCaptura}
                            </div>
                          )}
                        </div>
                      ) : (
                        <a 
                          href={src.url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-slate-600 hover:underline text-xs flex items-center gap-1 truncate"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
                          <span className="truncate">{src.url}</span>
                        </a>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {src.status === 'pendente' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          <Clock className="w-3.5 h-3.5" /> Pendente
                        </span>
                      )}
                      {(src.status === 'baixando' || src.status === 'extraindo' || src.status === 'ocr') && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {src.status}
                        </span>
                      )}
                      {src.status === 'concluido' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Concluído
                        </span>
                      )}
                      {src.status === 'requer_navegacao' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200" title={src.errorMessage}>
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Requer Navegação
                        </span>
                      )}
                      {src.status === 'erro' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200" title={src.errorMessage}>
                          <AlertCircle className="w-3.5 h-3.5" /> Erro
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => processSourceItem(src)}
                        disabled={processingIds.has(src.id)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs transition-colors inline-flex items-center gap-1 border border-indigo-200 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${processingIds.has(src.id) ? 'animate-spin' : ''}`} />
                        <span>Processar</span>
                      </button>

                      {src.candidates && src.candidates.length > 0 && (
                        <button
                          onClick={() => setViewCandidatesSource(src)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs transition-colors inline-flex items-center gap-1 border border-slate-300 cursor-pointer"
                        >
                          <ListFilter className="w-3.5 h-3.5 text-slate-600" />
                          <span>Candidatos ({src.candidates.length})</span>
                        </button>
                      )}

                      {/* Manual upload as Plan B when status is requer_navegacao or manually requested */}
                      {src.status === 'requer_navegacao' && (
                        <button
                          onClick={() => setManualUploadSource(src)}
                          className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-medium text-xs transition-colors inline-flex items-center gap-1 border border-amber-300 cursor-pointer"
                        >
                          <FileUp className="w-3.5 h-3.5 text-amber-600" />
                          <span>Upload Manual</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteSource(src.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Candidate Links Modal */}
      {viewCandidatesSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-6 border border-slate-200">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Top 5 Links Candidatos</h3>
              <p className="text-sm text-slate-600 mt-1">
                Sindicato: <span className="font-semibold text-slate-800">{viewCandidatesSource.sindicato} ({viewCandidatesSource.uf})</span>
              </p>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {viewCandidatesSource.candidates?.map((cand, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-medium text-slate-900 text-sm truncate">{cand.title || 'Link candidato'}</div>
                    <a href={cand.url} target="_blank" rel="noreferrer" className="text-indigo-600 text-xs hover:underline truncate block font-mono">
                      {cand.url}
                    </a>
                    <div className="text-[11px] text-slate-500 font-semibold">
                      Pontuação do Raspador: <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">{cand.score}</span>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      const src = viewCandidatesSource;
                      setViewCandidatesSource(null);
                      await processSourceItem(src, undefined, cand.url);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-xs transition-colors shrink-0"
                  >
                    Usar este
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setViewCandidatesSource(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-sm transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual File Upload Modal (Plan B) */}
      {manualUploadSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6 border border-slate-200">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Upload Manual (Plano B)</h3>
              <p className="text-sm text-slate-600 mt-1">
                O site de <span className="font-semibold text-slate-800">{manualUploadSource.sindicato}</span> ({manualUploadSource.uf}) requer navegação manual/captcha. Envie o arquivo PDF/DOCX diretamente.
              </p>
            </div>

            <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-8 text-center bg-slate-50 cursor-pointer transition-colors">
              <input 
                type="file" 
                accept=".pdf, .docx, .html, .htm, .png, .jpg, .jpeg"
                ref={manualFileInputRef}
                onChange={handleManualFileUploadSubmit}
                className="hidden" 
                id="manual-file-input"
              />
              <label htmlFor="manual-file-input" className="cursor-pointer space-y-2 block">
                <FileUp className="w-10 h-10 text-indigo-600 mx-auto" />
                <div className="font-semibold text-slate-800 text-sm">Clique para selecionar o arquivo</div>
                <div className="text-xs text-slate-500">PDF, DOCX, HTML ou Imagem</div>
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setManualUploadSource(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
