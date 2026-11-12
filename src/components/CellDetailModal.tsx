import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, HelpCircle, Edit3 } from 'lucide-react';
import { ExtractedFieldData, FieldDefinition, SourceItem } from '../types';

interface CellDetailModalProps {
  source: SourceItem;
  fieldDef: FieldDefinition;
  fieldData?: ExtractedFieldData;
  isOpen: boolean;
  onClose: () => void;
  onSaveOverride: (sourceId: string, fieldKey: string, newValue: string, validated: boolean) => void;
}

export const CellDetailModal: React.FC<CellDetailModalProps> = ({
  source,
  fieldDef,
  fieldData,
  isOpen,
  onClose,
  onSaveOverride
}) => {
  if (!isOpen) return null;

  const [editValue, setEditValue] = useState(fieldData?.manualOverride || fieldData?.value || '');
  const [isValidated, setIsValidated] = useState(fieldData?.validated || false);

  const confidence = fieldData?.confidence || 'ausente';

  const handleSave = () => {
    onSaveOverride(source.id, fieldDef.key, editValue, isValidated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-indigo-400 font-semibold">{fieldDef.category}</span>
            <h3 className="text-lg font-bold">{fieldDef.label}</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Document context */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-1">
            <div className="text-xs text-slate-500 font-medium">DOCUMENTO FONTE</div>
            <div className="font-semibold text-slate-800">{source.sindicato} ({source.uf} - {source.tipo})</div>
            <div className="text-xs text-slate-600">Categoria: {source.categoria}</div>
            {source.fileName && <div className="text-xs text-indigo-600 font-mono mt-1">Arquivo: {source.fileName}</div>}
          </div>

          {/* Confidence Badge */}
          <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
            <div>
              <div className="text-xs text-slate-500 font-medium">NÍVEL DE CONFIANÇA</div>
              <div className="text-sm font-semibold capitalize flex items-center gap-2 mt-1">
                {confidence === 'alta' && <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-200"><CheckCircle className="w-3.5 h-3.5" /> Alta (Padrão claro)</span>}
                {confidence === 'media' && <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full text-xs font-bold border border-amber-200"><AlertTriangle className="w-3.5 h-3.5" /> Média (Palavra-chave encontrada)</span>}
                {(confidence === 'baixa' || confidence === 'ausente') && <span className="flex items-center gap-1.5 text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full text-xs font-bold border border-rose-200"><HelpCircle className="w-3.5 h-3.5" /> Revisar Necessário</span>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="validated-check"
                checked={isValidated}
                onChange={(e) => setIsValidated(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <label htmlFor="validated-check" className="text-sm font-medium text-slate-700 cursor-pointer">
                Marcar como Validado
              </label>
            </div>
          </div>

          {/* Source Snippet */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-500 tracking-wider">TRECHO DE ORIGEM (CLÁUSULA)</div>
            <div className="bg-amber-50/60 border border-amber-200/80 p-4 rounded-lg text-slate-800 text-sm font-mono leading-relaxed max-h-40 overflow-y-auto">
              "{fieldData?.sourceSnippet || 'Nenhum trecho de origem capturado.'}"
            </div>
          </div>

          {/* Manual Edit Value */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5 text-indigo-600" /> VALOR EXTRAÍDO / EDITAR MANUALMENTE
            </label>
            <input 
              type="text" 
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-medium"
              placeholder="Digite o valor corrigido..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-xs transition-colors flex items-center gap-2"
          >
            Salvar Alteração
          </button>
        </div>
      </div>
    </div>
  );
};
