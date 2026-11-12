import * as XLSX from 'xlsx';
import { SourceItem, DocumentResult } from '../types';
import { FIELD_DEFINITIONS } from './extractionRules';

export function downloadSpreadsheetTemplate() {
  const templateData = [
    {
      UF: 'SP',
      Sindicato: 'Sindicato dos Trabalhadores em TI de SP',
      Categoria: 'Tecnologia da Informação',
      Tipo: 'CCT',
      URL: 'https://www.sindpd.org.br/sindpd/upload/arquivos/cct_2024.pdf',
      Observação: 'Exemplo de CCT 2025/2026'
    },
    {
      UF: 'RJ',
      Sindicato: 'Sindicato dos Comerciários do RJ',
      Categoria: 'Comércio Varejista',
      Tipo: 'ACT',
      URL: 'https://www.comerciariosrj.org.br/acordo2025.pdf',
      Observação: 'Acordo Coletivo Empresa X'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Fontes CCT_ACT');

  worksheet['!cols'] = [
    { wch: 6 },  // UF
    { wch: 35 }, // Sindicato
    { wch: 25 }, // Categoria
    { wch: 10 }, // Tipo
    { wch: 45 }, // URL
    { wch: 25 }  // Observação
  ];

  XLSX.writeFile(workbook, 'modelo_fontes_cct_act.xlsx');
}

export function exportResultsToExcel(sources: SourceItem[], documents: DocumentResult[]) {
  const docMap = new Map(documents.map(d => [d.sourceId, d]));

  const rows = sources.map(src => {
    const doc = docMap.get(src.id);
    const rowData: Record<string, any> = {
      'ID': src.id,
      'UF': src.uf,
      'Sindicato': src.sindicato,
      'Categoria': src.categoria,
      'Tipo': src.tipo,
      'URL Original': src.url,
      'URL Documento Baixado': src.chosenUrl || src.url || 'N/A',
      'Data de Captura': src.dataCaptura || src.lastProcessed || 'N/A',
      'Status': src.status,
      'Observação': src.observacao
    };

    FIELD_DEFINITIONS.forEach(field => {
      const fieldData = doc?.fields[field.key];
      rowData[field.label] = fieldData ? (fieldData.manualOverride || fieldData.value) : 'Não processado';
      rowData[`${field.label} (Confiança)`] = fieldData ? fieldData.confidence : 'ausente';
    });

    return rowData;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultados CCT_ACT');

  XLSX.writeFile(workbook, `resultados_cct_act_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
