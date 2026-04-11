export interface DownloadLogEntry {
  videoId: string;
  title: string;
  author: string;
  platform: string;
  coverUrl: string;
  duration: number | null;
  originalUrl: string;
  downloadedAt: number;
  downloadCount?: number;
}

export interface DownloadLogRecord extends DownloadLogEntry {
  id: number;
  downloadCount: number;
}

const DB_NAME = 'omni-clip';
const DB_VERSION = 1;
const STORE_NAME = 'downloads';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
        store.createIndex('videoId', 'videoId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

export async function logDownload(entry: DownloadLogEntry): Promise<void> {
  if (!isAvailable()) return;
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const index = store.index('videoId');

  // Upsert: if videoId exists, update its timestamp
  const existing = await new Promise<DownloadLogRecord | undefined>((resolve) => {
    const req = index.get(entry.videoId);
    req.onsuccess = () => resolve(req.result as DownloadLogRecord | undefined);
    req.onerror = () => resolve(undefined);
  });

  if (existing) {
    const prevCount = existing.downloadCount || 1;
    store.put({ ...existing, ...entry, id: existing.id, downloadCount: prevCount + 1 });
  } else {
    store.add({ ...entry, downloadCount: 1 });
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getHistory(limit = 50): Promise<DownloadLogRecord[]> {
  if (!isAvailable()) return [];
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const index = store.index('downloadedAt');
  const results: DownloadLogRecord[] = [];

  return new Promise((resolve) => {
    const req = index.openCursor(null, 'prev'); // newest first
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value as DownloadLogRecord);
        cursor.continue();
      } else {
        db.close();
        resolve(results);
      }
    };
    req.onerror = () => {
      db.close();
      resolve([]);
    };
  });
}

export async function deleteEntry(id: number): Promise<void> {
  if (!isAvailable()) return;
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function cleanup(maxAgeDays: number): Promise<void> {
  if (!isAvailable()) return;
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const index = store.index('downloadedAt');
  const range = IDBKeyRange.upperBound(cutoff);

  return new Promise((resolve) => {
    const req = index.openCursor(range);
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      resolve();
    };
  });
}
