import type { StudentAnswerValue } from '@/types/exam';

const DB_NAME = 'webquiz-exam-drafts';
const DB_VERSION = 1;
const STORE_NAME = 'attemptDrafts';
const FALLBACK_PREFIX = 'webquiz-exam-draft:';
const DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

export interface AttemptDraft {
  attemptId: number;
  answers: Record<string, StudentAnswerValue>;
  updatedAt: number;
  expiresAt: number;
}

function isExpired(draft: AttemptDraft) {
  return draft.expiresAt <= Date.now();
}

function fallbackKey(attemptId: number) {
  return `${FALLBACK_PREFIX}${attemptId}`;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'attemptId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openDatabase();
  try {
    return await requestToPromise(action(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)));
  } finally {
    db.close();
  }
}

function saveFallback(draft: AttemptDraft) {
  localStorage.setItem(fallbackKey(draft.attemptId), JSON.stringify(draft));
}

function loadFallback(attemptId: number): AttemptDraft | null {
  const raw = localStorage.getItem(fallbackKey(attemptId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AttemptDraft;
  } catch {
    localStorage.removeItem(fallbackKey(attemptId));
    return null;
  }
}

function clearFallback(attemptId: number) {
  localStorage.removeItem(fallbackKey(attemptId));
}

export async function saveAttemptDraft(
  attemptId: number,
  answers: Record<string, StudentAnswerValue>,
) {
  const now = Date.now();
  const draft: AttemptDraft = {
    attemptId,
    answers,
    updatedAt: now,
    expiresAt: now + DRAFT_TTL_MS,
  };

  try {
    await withStore('readwrite', (store) => store.put(draft));
  } catch {
    saveFallback(draft);
  }
}

export async function loadAttemptDraft(attemptId: number): Promise<AttemptDraft | null> {
  let draft: AttemptDraft | null = null;

  try {
    draft = (await withStore('readonly', (store) => store.get(attemptId))) ?? null;
  } catch {
    draft = loadFallback(attemptId);
  }

  if (draft && isExpired(draft)) {
    await clearAttemptDraft(attemptId);
    return null;
  }

  return draft;
}

export async function clearAttemptDraft(attemptId: number) {
  try {
    await withStore('readwrite', (store) => store.delete(attemptId));
  } catch {
    clearFallback(attemptId);
  }
  clearFallback(attemptId);
}
