import { FieldDefinition, ExtractedFieldData, ConfidenceLevel } from '../types';

export const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    key: 'database',
    label: 'Data-base',
    category: 'Geral',
    keywords: ['data-base', 'data base', 'mês de correção', 'correção salarial em']
  },
  {
    key: 'vigenciainicio',
    label: 'Vigência Início',
    category: 'Geral',
    keywords: ['vigência', 'início da vigência', 'vigor a partir de', 'validade a partir de']
  },
  {
    key: 'vigenciafim',
    label: 'Vigência Fim',
    category: 'Geral',
    keywords: ['término da vigência', 'validade até', 'vigência até', 'fins de vigência']
  },
  {
    key: 'abrangenciaterritorial',
    label: 'Abrangência Territorial',
    category: 'Geral',
    keywords: ['abrangência', 'base territorial', 'territorialidade', 'âmbito de aplicação']
  },
  {
    key: 'categoriaprofissional',
    label: 'Categoria Profissional',
    category: 'Geral',
    keywords: ['categoria', 'trabalhadores', 'empregados no âmbito', 'filiados', 'profissionais']
  },
  {
    key: 'pisosalarial',
    label: 'Piso Salarial',
    category: 'Remuneração',
    keywords: ['piso salarial', 'salário normativo', 'menor salário', 'piso da categoria', 'salário base']
  },
  {
    key: 'percentualreajuste',
    label: 'Percentual de Reajuste',
    category: 'Remuneração',
    keywords: ['reajuste salarial', 'correção salarial', 'percentual de reajuste', 'reposição salarial', 'indice de reajuste']
  },
  {
    key: 'jornadasemanal',
    label: 'Jornada Semanal',
    category: 'Jornada/Outros',
    keywords: ['jornada semanal', 'horas semanais', 'duração do trabalho', 'carga horária semanal']
  },
  {
    key: 'adicionalnoturno',
    label: 'Adicional Noturno',
    category: 'Remuneração',
    keywords: ['adicional noturno', 'trabalho noturno', 'hora noturna']
  },
  {
    key: 'horaextra',
    label: 'Hora Extra (%)',
    category: 'Remuneração',
    keywords: ['horas extras', 'hora extra', 'prorrogação de jornada', 'adicional de horas extras']
  },
  {
    key: 'valealimentacao',
    label: 'Vale-Alimentação/Refeição',
    category: 'Benefícios',
    keywords: ['vale-alimentação', 'vale alimentação', 'auxílio-alimentação', 'auxílio refeição', 'vale-refeição', 'ticket']
  },
  {
    key: 'planosaude',
    label: 'Plano de Saúde',
    category: 'Benefícios',
    keywords: ['plano de saúde', 'assistência médica', 'convênio médico', 'assistência hospitalar']
  },
  {
    key: 'auxiliocreche',
    label: 'Auxílio-Creche',
    category: 'Benefícios',
    keywords: ['auxílio-creche', 'auxilio creche', 'reembolso creche', 'assistência creche']
  },
  {
    key: 'contribuicaoassistencial',
    label: 'Contribuição Assistencial',
    category: 'Jornada/Outros',
    keywords: ['contribuição assistencial', 'taxa assistencial', 'contribuição negocial', 'desconto assistencial']
  },
  {
    key: 'estabilidade',
    label: 'Estabilidade',
    category: 'Jornada/Outros',
    keywords: ['estabilidade', 'garantia de emprego', 'acidente de trabalho', 'pré-aposentadoria', 'gestante']
  },
  {
    key: 'plr',
    label: 'PLR',
    category: 'Remuneração',
    keywords: ['participação nos lucros', 'plr', 'ppr', 'participação nos resultados']
  }
];

export function extractFieldsFromText(text: string): Record<string, ExtractedFieldData> {
  const results: Record<string, ExtractedFieldData> = {};
  const lowerText = text.toLowerCase();

  FIELD_DEFINITIONS.forEach(def => {
    let foundValue = '';
    let foundSnippet = '';
    let confidence: ConfidenceLevel = 'ausente';

    // Search for keywords
    let bestKeywordIndex = -1;
    let matchedKeyword = '';

    for (const kw of def.keywords) {
      const idx = lowerText.indexOf(kw.toLowerCase());
      if (idx !== -1) {
        bestKeywordIndex = idx;
        matchedKeyword = kw;
        break;
      }
    }

    if (bestKeywordIndex !== -1) {
      // Extract snippet around keyword (up to 300 chars)
      const start = Math.max(0, bestKeywordIndex - 50);
      const end = Math.min(text.length, bestKeywordIndex + 250);
      foundSnippet = text.substring(start, end).replace(/\s+/g, ' ').trim();

      // Attempt regex or pattern extraction based on field type
      const snippetWindow = text.substring(bestKeywordIndex, bestKeywordIndex + 300);

      if (def.key === 'pisosalarial' || def.key === 'valealimentacao' || def.key === 'auxiliocreche') {
        // Look for currency pattern R$ ... or numbers
        const moneyMatch = snippetWindow.match(/r\$\s*([\d.,]+)/i) || snippetWindow.match(/([\d]{1,3}(?:\.[\d]{3})*,\d{2})/);
        if (moneyMatch) {
          foundValue = `R$ ${moneyMatch[1]}`;
          confidence = 'alta';
        } else {
          foundValue = snippetWindow.substring(0, 50).trim() + '...';
          confidence = 'media';
        }
      } else if (def.key === 'percentualreajuste' || def.key === 'horaextra' || def.key === 'adicionalnoturno') {
        const pctMatch = snippetWindow.match(/(\d+(?:[.,]\d+)?)\s*%/);
        if (pctMatch) {
          foundValue = `${pctMatch[1]}%`;
          confidence = 'alta';
        } else {
          foundValue = snippetWindow.substring(0, 50).trim() + '...';
          confidence = 'media';
        }
      } else if (def.key === 'database' || def.key === 'vigenciainicio' || def.key === 'vigenciafim') {
        const dateMatch = snippetWindow.match(/(\d{2}\/\d{2}\/\d{4})/);
        const monthMatch = snippetWindow.match(/(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/i);
        if (dateMatch) {
          foundValue = dateMatch[1];
          confidence = 'alta';
        } else if (monthMatch) {
          foundValue = monthMatch[1];
          confidence = 'alta';
        } else {
          foundValue = snippetWindow.substring(0, 60).trim() + '...';
          confidence = 'media';
        }
      } else if (def.key === 'jornadasemanal') {
        const hourMatch = snippetWindow.match(/(\d{1,2})\s*(?:horas|h|hs)/i);
        if (hourMatch) {
          foundValue = `${hourMatch[1]}h semanais`;
          confidence = 'alta';
        } else {
          foundValue = snippetWindow.substring(0, 50).trim() + '...';
          confidence = 'media';
        }
      } else {
        // General text extraction
        foundValue = snippetWindow.substring(0, 80).trim().replace(/\n/g, ' ') + (snippetWindow.length > 80 ? '...' : '');
        confidence = 'media';
      }
    } else {
      foundValue = 'Não encontrado';
      foundSnippet = 'Nenhum trecho correspondente encontrado no documento.';
      confidence = 'ausente';
    }

    results[def.key] = {
      value: foundValue,
      sourceSnippet: foundSnippet,
      confidence
    };
  });

  return results;
}
