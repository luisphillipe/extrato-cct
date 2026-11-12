import { SourceItem, DocumentResult } from '../types';

const DB_NAME = 'CCT_ACT_DB';
const DB_VERSION = 1;

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('sources')) {
        db.createObjectStore('sources', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'sourceId' });
      }
    };
  });
}

export async function saveSources(sources: SourceItem[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('sources', 'readwrite');
    const store = transaction.objectStore('sources');
    
    sources.forEach(src => {
      store.put(src);
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAllSources(): Promise<SourceItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('sources', 'readonly');
    const store = transaction.objectStore('sources');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDocumentResult(doc: DocumentResult): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('documents', 'readwrite');
    const store = transaction.objectStore('documents');
    store.put(doc);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getDocumentResult(sourceId: string): Promise<DocumentResult | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('documents', 'readonly');
    const store = transaction.objectStore('documents');
    const request = store.get(sourceId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllDocuments(): Promise<DocumentResult[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('documents', 'readonly');
    const store = transaction.objectStore('documents');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
