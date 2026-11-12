import React, { useState, useMemo } from 'react';
import { Search, Filter, Download, CheckCircle, AlertTriangle, HelpCircle, ArrowUpDown, ChevronRight } from 'lucide-react';
import { SourceItem, DocumentResult, FieldDefinition, ExtractedFieldData } from '../types';
import { FIELD_DEFINITIONS } from '../utils/extractionRules';
import { exportResultsToExcel } from '../utils/excel';
import { CellDetailModal } from './CellDetailModal';
import { saveDocumentResult } from '../utils/indexedDB';

interface ResultadosTabProps {
  sources: SourceItem[];
  documents: DocumentResult[];
  setDocuments: React.Dispatch<React.SetStateAction<DocumentResult[]>>;
}

export const ResultadosTab: React.FC<ResultadosTabProps> = ({ sources, documents, setDocuments }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUf, setSelectedUf] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Geral');
  const [modalState, setModalState] = useState<{ source: SourceItem; fieldDef: FieldDefinition } | null>(null);
  const [sortField, setSortField] = useState<string>('uf');
  const [sortAsc, setSortAsc] = useState(true);

  const docMap = useMemo(() => new Map(documents.map(d => [d.sourceId, d])), [documents]);

  // Unique UFs for filter
  const ufs = useMemo(() => Array.from(new Set(sources.map(s => s.uf))).sort(), [sources]);

  // Filter fields by category
  const activeFields = useMemo(() => {
    if (selectedCategory === 'Todas') return FIELD_DEFINITIONS;
    return FIELD_DEFINITIONS.filter(f => f.category === selectedCategory);
  }, [selectedCategory]);

  // Filtered and sorted sources
  const filteredSources = useMemo(() => {
    return sources.filter(src => {
      const matchesUf = !selectedUf || src.uf === selectedUf;
      const doc = docMap.get(src.id);
      
      if (!searchTerm) return matchesUf;

      const term = searchTerm.toLowerCase();
      const matchesMeta = src.sindicato.toLowerCase().includes(term) || 
                          src.uf.toLowerCase().includes(term) || 
                          src.categoria.toLowerCase().includes(term);

      if (matchesMeta) return matchesUf;

      // Check fields
      if (doc) {
        for (const field of FIELD_DEFINITIONS) {
          const val = doc.fields[field.key]?.manualOverride || doc.fields[field.key]?.value || '';
          if (val.toLowerCase().includes(term)) return matchesUf;
        }
      }

      return false;
    }).sort((a, b) => {
      let valA = (a as any)[sortField] || '';
      let valB = (b as any)[sortField] || '';
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [sources, docMap, selectedUf, searchTerm, sortField, sortAsc]);

  const handleSaveOverride = async (sourceId: string, fieldKey: string, newValue: string, validated: boolean) => {
    const doc = docMap.get(sourceId);
    if (!doc) return;

    const updatedFields = {
      ...doc.fields,
      [fieldKey]: {
        ...(doc.fields[fieldKey] || { sourceSnippet: '', confidence: 'ausente' }),
        value: doc.fields[fieldKey]?.value || newValue,
        manualOverride: newValue,
        validated
      }
    };

    const updatedDoc: DocumentResult = {
      ...doc,
      fields: updatedFields,
      updatedAt: new Date().toISOString()
    };

    await saveDocumentResult(updatedDoc);
    setDocuments(prev => [...prev.filter(d => d.sourceId === sourceId ? false : true), updatedDoc]);
  };

  const categories = ['Geral', 'Remuneração', 'Benefícios', 'Jornada/Outros', 'Todas'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fadeIn">
      {/* Header & Export */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Resultados da Extração de CCT/ACT</h2>
          <p className="text-sm text-slate-600 mt-1">
            Explore os campos extraídos por IA/Regex, clique em qualquer célula para ver a cláusula de origem e valide as informações.
          </p>
        </div>

        <button
          onClick={() => exportResultsToExcel(sources, documents)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors shadow-sm cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Exportar Resultados (Excel)</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Buscar sindicato, UF ou valor extraído..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
          {/* UF Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">UF:</span>
            <select
              value={selectedUf}
              onChange={(e) => setSelectedUf(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todas as UFs</option>
              {ufs.map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  selectedCategory === cat ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredSources.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
              <Filter className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-slate-800 text-base">Nenhum resultado encontrado</h4>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Processe documentos na aba Fontes ou ajuste os filtros de busca.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4 sticky left-0 bg-slate-50 z-10 shadow-r">Fonte / Sindicato</th>
                  {activeFields.map(field => (
                    <th key={field.key} className="py-3.5 px-4 min-w-[180px]">{field.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
                {filteredSources.map(src => {
                  const doc = docMap.get(src.id);
                  const hasLowConfidence = doc ? Object.values(doc.fields).some(f => f.confidence === 'baixa' || f.confidence === 'ausente' || !f.validated) : true;

                  return (
                    <tr key={src.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 sticky left-0 bg-white z-10 shadow-r font-medium">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">{src.uf}</span>
                          <span className="truncate max-w-[200px]" title={src.sindicato}>{src.sindicato}</span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{src.tipo}</span>
                          {hasLowConfidence && (
                            <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-200">
                              Revisar
                            </span>
                          )}
                        </div>
                      </td>

                      {activeFields.map(field => {
                        const fieldData = doc?.fields[field.key];
                        const displayVal = fieldData?.manualOverride || fieldData?.value || 'Não processado';
                        const confidence = fieldData?.confidence || 'ausente';

                        return (
                          <td 
                            key={field.key} 
                            onClick={() => setModalState({ source: src, fieldDef: field })}
                            className="py-3.5 px-4 cursor-pointer hover:bg-indigo-50/50 transition-colors group relative"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`truncate font-medium ${displayVal === 'Não processado' || displayVal === 'Não encontrado' ? 'text-slate-400 italic text-xs' : 'text-slate-800'}`}>
                                {displayVal}
                              </span>
                              
                              <div className="flex items-center gap-1 shrink-0">
                                {confidence === 'alta' && <span title="Alta confiança"><CheckCircle className="w-3.5 h-3.5 text-emerald-600" /></span>}
                                {confidence === 'media' && <span title="Média confiança"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /></span>}
                                {(confidence === 'baixa' || confidence === 'ausente') && <span title="Revisar"><HelpCircle className="w-3.5 h-3.5 text-rose-500" /></span>}
                                
                                {fieldData?.validated && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Validado" />
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {modalState && (
        <CellDetailModal
          isOpen={!!modalState}
          onClose={() => setModalState(null)}
          source={modalState.source}
          fieldDef={modalState.fieldDef}
          fieldData={docMap.get(modalState.source.id)?.fields[modalState.fieldDef.key]}
          onSaveOverride={handleSaveOverride}
        />
      )}
    </div>
  );
};
