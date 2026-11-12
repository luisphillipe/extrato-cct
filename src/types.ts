export type ProcessingStatus = 'pendente' | 'baixando' | 'extraindo' | 'ocr' | 'concluido' | 'erro' | 'requer_navegacao';

export interface ScoredCandidate {
  url: string;
  title: string;
  score: number;
}

export type ProbeDiagnosis = 'OK' | 'SEM_LINKS' | 'BLOQUEADO' | 'ERRO';

export interface ProbeResult {
  pageStatus: number;
  durationMs: number;
  fileLinksCount: number;
  candidates: ScoredCandidate[];
  bestTest: {
    status: number;
    contentType: string;
    totalSize: number;
  } | null;
  diagnosis: ProbeDiagnosis;
  message?: string;
  testedAt?: string;
}

export interface SourceItem {
  id: string;
  uf: string;
  sindicato: string;
  categoria: string;
  tipo: 'CCT' | 'ACT';
  url: string;
  observacao: string;
  status: ProcessingStatus;
  errorMessage?: string;
  fileName?: string;
  fileSize?: number;
  fileHash?: string;
  lastProcessed?: string;
  chosenUrl?: string;
  dataCaptura?: string;
  candidates?: ScoredCandidate[];
  probe?: ProbeResult;
}

export type ConfidenceLevel = 'alta' | 'media' | 'baixa' | 'ausente';

export interface ExtractedFieldData {
  value: string;
  sourceSnippet: string;
  confidence: ConfidenceLevel;
  manualOverride?: string;
  validated?: boolean;
}

export interface DocumentResult {
  sourceId: string;
  rawText: string;
  fields: Record<string, ExtractedFieldData>;
  updatedAt: string;
}

export interface FieldDefinition {
  key: string;
  label: string;
  category: 'Geral' | 'Remuneração' | 'Benefícios' | 'Jornada/Outros';
  keywords: string[];
  unit?: string;
}
