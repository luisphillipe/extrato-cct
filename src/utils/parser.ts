import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import { ScoredCandidate } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export async function computeFileHash(arrayBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function parsePdfBuffer(arrayBuffer: ArrayBuffer, onProgress?: (status: string) => void): Promise<string> {
  if (onProgress) onProgress('Carregando documento PDF...');
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  let fullText = '';

  for (let i = 1; i <= numPages; i++) {
    if (onProgress) onProgress(`Lendo página ${i} de ${numPages}...`);
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += `\n--- Página ${i} ---\n` + pageText;
  }

  if (fullText.trim().length < 50) {
    if (onProgress) onProgress('Texto digital insuficiente detectado. Iniciando OCR (Tesseract)...');
    let ocrText = '';
    const worker = await createWorker('por');

    for (let i = 1; i <= Math.min(numPages, 10); i++) {
      if (onProgress) onProgress(`Executando OCR na página ${i} de ${Math.min(numPages, 10)}...`);
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        await page.render({ canvasContext: context, viewport }).promise;
        const imageUrl = canvas.toDataURL('image/png');
        const { data: { text } } = await worker.recognize(imageUrl);
        ocrText += `\n--- Página ${i} (OCR) ---\n` + text;
      }
    }

    await worker.terminate();
    fullText = ocrText;
  }

  return fullText;
}

export async function parseDocxBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export async function parseHtmlOrText(textOrHtml: string): Promise<string> {
  const doc = new DOMParser().parseFromString(textOrHtml, 'text/html');
  return doc.body.textContent || textOrHtml;
}

export interface FetchResult {
  rawText: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  chosenUrl: string;
  dataCaptura: string;
  candidates: ScoredCandidate[];
}

export async function fetchAndExtractDocument(
  url: string,
  manualFile?: File,
  onProgress?: (status: string) => void
): Promise<FetchResult> {
  let arrayBuffer: ArrayBuffer;
  let fileName = '';
  let fileSize = 0;
  let chosenUrl = url;
  let candidates: ScoredCandidate[] = [];
  const dataCaptura = new Date().toLocaleString('pt-BR');

  if (manualFile) {
    fileName = manualFile.name;
    fileSize = manualFile.size;
    arrayBuffer = await manualFile.arrayBuffer();
  } else {
    if (onProgress) onProgress('Solicitando ao servidor /api/fetch...');
    const response = await fetch('/api/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      if (data.error === 'requer_navegacao' || data.message) {
        throw new Error(`REQUER_NAVEGACAO: ${data.message || 'Bloqueado por captcha/JS. Envie o arquivo manualmente.'}`);
      }
      throw new Error(data.message || 'Erro ao conectar ao servidor de busca.');
    }

    fileName = data.fileName || 'documento.pdf';
    chosenUrl = data.chosenUrl || url;
    candidates = data.candidates || [];

    // Convert base64 to arrayBuffer
    const binaryString = atob(data.dataBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    arrayBuffer = bytes.buffer;
    fileSize = arrayBuffer.byteLength;
  }

  const fileHash = await computeFileHash(arrayBuffer);
  let rawText = '';

  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.pdf') || (manualFile && manualFile.type === 'application/pdf')) {
    rawText = await parsePdfBuffer(arrayBuffer, onProgress);
  } else if (lowerName.endsWith('.docx')) {
    if (onProgress) onProgress('Extraindo texto de arquivo DOCX...');
    rawText = await parseDocxBuffer(arrayBuffer);
  } else if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
    if (onProgress) onProgress('Lendo arquivo HTML...');
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(arrayBuffer);
    rawText = await parseHtmlOrText(text);
  } else {
    try {
      rawText = await parsePdfBuffer(arrayBuffer, onProgress);
    } catch {
      const decoder = new TextDecoder('utf-8');
      rawText = decoder.decode(arrayBuffer);
    }
  }

  return { rawText, fileName, fileSize, fileHash, chosenUrl, dataCaptura, candidates };
}
