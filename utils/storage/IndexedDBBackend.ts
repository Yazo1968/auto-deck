
import { InsightsDocument } from '../../types';
import {
  StorageBackend,
  AppSessionState,
  StoredFile,
  StoredHeading,
  StoredImage,
  StoredInsightsSession,
  StoredNugget,
  StoredNuggetDocument,
  StoredProject,
} from './StorageBackend';

const DB_NAME = 'infonugget-db';
const DB_VERSION = 4;

// Store names — v1
const STORE_APP_STATE = 'appState';
const STORE_FILES = 'files';
const STORE_HEADINGS = 'headings';
const STORE_IMAGES = 'images';
const STORE_INSIGHTS_SESSION = 'insightsSession';
const STORE_INSIGHTS_DOCS = 'insightsDocs';
const STORE_INSIGHTS_HEADINGS = 'insightsHeadings';
const STORE_INSIGHTS_IMAGES = 'insightsImages';

// Store names — v2 (nuggets)
const STORE_DOCUMENTS = 'documents'; // v2 legacy — kept for migration reads
const STORE_NUGGETS = 'nuggets';
const STORE_NUGGET_HEADINGS = 'nuggetHeadings';
const STORE_NUGGET_IMAGES = 'nuggetImages';

// Store names — v3 (per-nugget owned documents)
const STORE_NUGGET_DOCUMENTS = 'nuggetDocuments';

// Store names — v4 (projects)
const STORE_PROJECTS = 'projects';

const ALL_STORES = [
  STORE_APP_STATE, STORE_FILES, STORE_HEADINGS, STORE_IMAGES,
  STORE_INSIGHTS_SESSION, STORE_INSIGHTS_DOCS, STORE_INSIGHTS_HEADINGS, STORE_INSIGHTS_IMAGES,
  STORE_DOCUMENTS, STORE_NUGGETS, STORE_NUGGET_HEADINGS, STORE_NUGGET_IMAGES,
  STORE_NUGGET_DOCUMENTS, STORE_PROJECTS,
];

// ── Helpers ──

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

async function blobUrlToDataUrl(url: string): Promise<string> {
  if (!url.startsWith('blob:')) return url;
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function convertImageBlobUrls(image: StoredImage): Promise<StoredImage> {
  const cardUrl = await blobUrlToDataUrl(image.cardUrl);
  const imageHistory = await Promise.all(
    image.imageHistory.map(async (v) => ({
      ...v,
      imageUrl: await blobUrlToDataUrl(v.imageUrl),
    }))
  );
  return { ...image, cardUrl, imageHistory };
}

// ── Implementation ──

export class IndexedDBBackend implements StorageBackend {
  private db: IDBDatabase | null = null;
  private ready = false;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;
        if (oldVersion < 1) this.createStoresV1(db);
        if (oldVersion < 2) this.createStoresV2(db);
        if (oldVersion < 3) this.createStoresV3(db);
        if (oldVersion < 4) this.createStoresV4(db);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.ready = true;
        resolve();
      };

      request.onerror = () => {
        console.error('IndexedDB init failed:', request.error);
        reject(request.error);
      };
    });
  }

  private createStoresV1(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(STORE_APP_STATE)) {
      db.createObjectStore(STORE_APP_STATE);
    }
    if (!db.objectStoreNames.contains(STORE_FILES)) {
      db.createObjectStore(STORE_FILES, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(STORE_HEADINGS)) {
      const store = db.createObjectStore(STORE_HEADINGS, { keyPath: ['fileId', 'headingId'] });
      store.createIndex('byFile', 'fileId', { unique: false });
    }
    if (!db.objectStoreNames.contains(STORE_IMAGES)) {
      const store = db.createObjectStore(STORE_IMAGES, { keyPath: ['fileId', 'headingId', 'level'] });
      store.createIndex('byFile', 'fileId', { unique: false });
    }
    if (!db.objectStoreNames.contains(STORE_INSIGHTS_SESSION)) {
      db.createObjectStore(STORE_INSIGHTS_SESSION);
    }
    if (!db.objectStoreNames.contains(STORE_INSIGHTS_DOCS)) {
      db.createObjectStore(STORE_INSIGHTS_DOCS, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(STORE_INSIGHTS_HEADINGS)) {
      db.createObjectStore(STORE_INSIGHTS_HEADINGS, { keyPath: 'headingId' });
    }
    if (!db.objectStoreNames.contains(STORE_INSIGHTS_IMAGES)) {
      db.createObjectStore(STORE_INSIGHTS_IMAGES, { keyPath: ['headingId', 'level'] });
    }
  }

  private createStoresV2(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(STORE_DOCUMENTS)) {
      db.createObjectStore(STORE_DOCUMENTS, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(STORE_NUGGETS)) {
      db.createObjectStore(STORE_NUGGETS, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(STORE_NUGGET_HEADINGS)) {
      const store = db.createObjectStore(STORE_NUGGET_HEADINGS, { keyPath: ['fileId', 'headingId'] });
      store.createIndex('byNugget', 'fileId', { unique: false });
    }
    if (!db.objectStoreNames.contains(STORE_NUGGET_IMAGES)) {
      const store = db.createObjectStore(STORE_NUGGET_IMAGES, { keyPath: ['fileId', 'headingId', 'level'] });
      store.createIndex('byNugget', 'fileId', { unique: false });
    }
  }

  private createStoresV3(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(STORE_NUGGET_DOCUMENTS)) {
      const store = db.createObjectStore(STORE_NUGGET_DOCUMENTS, { keyPath: ['nuggetId', 'docId'] });
      store.createIndex('byNugget', 'nuggetId', { unique: false });
    }
  }

  private createStoresV4(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
      db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  private getDB(): IDBDatabase {
    if (!this.db) throw new Error('IndexedDB not initialized. Call init() first.');
    return this.db;
  }

  // ── App state ──

  async saveAppState(state: AppSessionState): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_APP_STATE, 'readwrite');
    tx.objectStore(STORE_APP_STATE).put(state, 'current');
    await promisifyTransaction(tx);
  }

  async loadAppState(): Promise<AppSessionState | null> {
    const db = this.getDB();
    const tx = db.transaction(STORE_APP_STATE, 'readonly');
    const result = await promisifyRequest(tx.objectStore(STORE_APP_STATE).get('current'));
    return result ?? null;
  }

  // ── Files ──

  async saveFile(file: StoredFile): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_FILES, 'readwrite');
    tx.objectStore(STORE_FILES).put(file);
    await promisifyTransaction(tx);
  }

  async loadFiles(): Promise<StoredFile[]> {
    const db = this.getDB();
    const tx = db.transaction(STORE_FILES, 'readonly');
    return await promisifyRequest(tx.objectStore(STORE_FILES).getAll());
  }

  async deleteFile(fileId: string): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_FILES, 'readwrite');
    tx.objectStore(STORE_FILES).delete(fileId);
    await promisifyTransaction(tx);
  }

  // ── Headings ──

  async saveHeadings(fileId: string, headings: StoredHeading[]): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_HEADINGS, 'readwrite');
    const store = tx.objectStore(STORE_HEADINGS);
    const index = store.index('byFile');

    // Delete existing headings for this file
    const existingKeys = await promisifyRequest(index.getAllKeys(fileId));
    for (const key of existingKeys) {
      store.delete(key);
    }

    // Write new headings
    for (const h of headings) {
      store.put(h);
    }

    await promisifyTransaction(tx);
  }

  async loadHeadings(fileId: string): Promise<StoredHeading[]> {
    const db = this.getDB();
    const tx = db.transaction(STORE_HEADINGS, 'readonly');
    const index = tx.objectStore(STORE_HEADINGS).index('byFile');
    return await promisifyRequest(index.getAll(fileId));
  }

  async deleteHeadings(fileId: string): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_HEADINGS, 'readwrite');
    const store = tx.objectStore(STORE_HEADINGS);
    const index = store.index('byFile');
    const keys = await promisifyRequest(index.getAllKeys(fileId));
    for (const key of keys) {
      store.delete(key);
    }
    await promisifyTransaction(tx);
  }

  // ── Images ──

  async saveImage(image: StoredImage): Promise<void> {
    const converted = await convertImageBlobUrls(image);
    const db = this.getDB();
    const tx = db.transaction(STORE_IMAGES, 'readwrite');
    tx.objectStore(STORE_IMAGES).put(converted);
    await promisifyTransaction(tx);
  }

  async loadImages(fileId: string): Promise<StoredImage[]> {
    const db = this.getDB();
    const tx = db.transaction(STORE_IMAGES, 'readonly');
    const index = tx.objectStore(STORE_IMAGES).index('byFile');
    return await promisifyRequest(index.getAll(fileId));
  }

  async deleteImages(fileId: string): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_IMAGES, 'readwrite');
    const store = tx.objectStore(STORE_IMAGES);
    const index = store.index('byFile');
    const keys = await promisifyRequest(index.getAllKeys(fileId));
    for (const key of keys) {
      store.delete(key);
    }
    await promisifyTransaction(tx);
  }

  // ── Insights session ──

  async saveInsightsSession(session: StoredInsightsSession): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_INSIGHTS_SESSION, 'readwrite');
    tx.objectStore(STORE_INSIGHTS_SESSION).put(session, 'current');
    await promisifyTransaction(tx);
  }

  async loadInsightsSession(): Promise<StoredInsightsSession | null> {
    const db = this.getDB();
    const tx = db.transaction(STORE_INSIGHTS_SESSION, 'readonly');
    const result = await promisifyRequest(tx.objectStore(STORE_INSIGHTS_SESSION).get('current'));
    return result ?? null;
  }

  async deleteInsightsSession(): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_INSIGHTS_SESSION, 'readwrite');
    tx.objectStore(STORE_INSIGHTS_SESSION).delete('current');
    await promisifyTransaction(tx);
  }

  // ── Insights documents ──

  async saveInsightsDoc(doc: InsightsDocument): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_INSIGHTS_DOCS, 'readwrite');
    tx.objectStore(STORE_INSIGHTS_DOCS).put(doc);
    await promisifyTransaction(tx);
  }

  async loadInsightsDocs(): Promise<InsightsDocument[]> {
    const db = this.getDB();
    const tx = db.transaction(STORE_INSIGHTS_DOCS, 'readonly');
    return await promisifyRequest(tx.objectStore(STORE_INSIGHTS_DOCS).getAll());
  }

  async deleteInsightsDoc(docId: string): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_INSIGHTS_DOCS, 'readwrite');
    tx.objectStore(STORE_INSIGHTS_DOCS).delete(docId);
    await promisifyTransaction(tx);
  }

  // ── Insights headings ──

  async saveInsightsHeadings(headings: StoredHeading[]): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_INSIGHTS_HEADINGS, 'readwrite');
    const store = tx.objectStore(STORE_INSIGHTS_HEADINGS);

    // Clear all existing
    await promisifyRequest(store.clear());

    // Write new
    for (const h of headings) {
      store.put(h);
    }

    await promisifyTransaction(tx);
  }

  async loadInsightsHeadings(): Promise<StoredHeading[]> {
    const db = this.getDB();
    const tx = db.transaction(STORE_INSIGHTS_HEADINGS, 'readonly');
    return await promisifyRequest(tx.objectStore(STORE_INSIGHTS_HEADINGS).getAll());
  }

  async deleteInsightsHeadings(): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_INSIGHTS_HEADINGS, 'readwrite');
    await promisifyRequest(tx.objectStore(STORE_INSIGHTS_HEADINGS).clear());
  }

  // ── Insights images ──

  async saveInsightsImage(image: StoredImage): Promise<void> {
    const converted = await convertImageBlobUrls(image);
    const db = this.getDB();
    const tx = db.transaction(STORE_INSIGHTS_IMAGES, 'readwrite');
    tx.objectStore(STORE_INSIGHTS_IMAGES).put(converted);
    await promisifyTransaction(tx);
  }

  async loadInsightsImages(): Promise<StoredImage[]> {
    const db = this.getDB();
    const tx = db.transaction(STORE_INSIGHTS_IMAGES, 'readonly');
    return await promisifyRequest(tx.objectStore(STORE_INSIGHTS_IMAGES).getAll());
  }

  async deleteInsightsImages(): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_INSIGHTS_IMAGES, 'readwrite');
    await promisifyRequest(tx.objectStore(STORE_INSIGHTS_IMAGES).clear());
  }

  // ── Nugget documents (per-nugget owned) ──

  async saveNuggetDocument(doc: StoredNuggetDocument): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_NUGGET_DOCUMENTS, 'readwrite');
    tx.objectStore(STORE_NUGGET_DOCUMENTS).put(doc);
    await promisifyTransaction(tx);
  }

  async loadNuggetDocuments(nuggetId: string): Promise<StoredNuggetDocument[]> {
    const db = this.getDB();
    const tx = db.transaction(STORE_NUGGET_DOCUMENTS, 'readonly');
    const index = tx.objectStore(STORE_NUGGET_DOCUMENTS).index('byNugget');
    return await promisifyRequest(index.getAll(nuggetId));
  }

  async deleteNuggetDocument(nuggetId: string, docId: string): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_NUGGET_DOCUMENTS, 'readwrite');
    tx.objectStore(STORE_NUGGET_DOCUMENTS).delete([nuggetId, docId]);
    await promisifyTransaction(tx);
  }

  async deleteNuggetDocuments(nuggetId: string): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_NUGGET_DOCUMENTS, 'readwrite');
    const store = tx.objectStore(STORE_NUGGET_DOCUMENTS);
    const index = store.index('byNugget');
    const keys = await promisifyRequest(index.getAllKeys(nuggetId));
    for (const key of keys) {
      store.delete(key);
    }
    await promisifyTransaction(tx);
  }

  // ── Documents (v2 legacy — migration reads only) ──

  async loadDocuments(): Promise<StoredFile[]> {
    const db = this.getDB();
    if (!db.objectStoreNames.contains(STORE_DOCUMENTS)) return [];
    const tx = db.transaction(STORE_DOCUMENTS, 'readonly');
    return await promisifyRequest(tx.objectStore(STORE_DOCUMENTS).getAll());
  }

  // ── Nuggets ──

  async saveNugget(nugget: StoredNugget): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_NUGGETS, 'readwrite');
    tx.objectStore(STORE_NUGGETS).put(nugget);
    await promisifyTransaction(tx);
  }

  async loadNuggets(): Promise<StoredNugget[]> {
    const db = this.getDB();
    const tx = db.transaction(STORE_NUGGETS, 'readonly');
    return await promisifyRequest(tx.objectStore(STORE_NUGGETS).getAll());
  }

  async deleteNugget(nuggetId: string): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_NUGGETS, 'readwrite');
    tx.objectStore(STORE_NUGGETS).delete(nuggetId);
    await promisifyTransaction(tx);
  }

  // ── Nugget headings ──

  async saveNuggetHeadings(nuggetId: string, headings: StoredHeading[]): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_NUGGET_HEADINGS, 'readwrite');
    const store = tx.objectStore(STORE_NUGGET_HEADINGS);
    const index = store.index('byNugget');

    // Delete existing headings for this nugget
    const existingKeys = await promisifyRequest(index.getAllKeys(nuggetId));
    for (const key of existingKeys) {
      store.delete(key);
    }

    // Write new headings
    for (const h of headings) {
      store.put(h);
    }

    await promisifyTransaction(tx);
  }

  async loadNuggetHeadings(nuggetId: string): Promise<StoredHeading[]> {
    const db = this.getDB();
    const tx = db.transaction(STORE_NUGGET_HEADINGS, 'readonly');
    const index = tx.objectStore(STORE_NUGGET_HEADINGS).index('byNugget');
    return await promisifyRequest(index.getAll(nuggetId));
  }

  async deleteNuggetHeadings(nuggetId: string): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_NUGGET_HEADINGS, 'readwrite');
    const store = tx.objectStore(STORE_NUGGET_HEADINGS);
    const index = store.index('byNugget');
    const keys = await promisifyRequest(index.getAllKeys(nuggetId));
    for (const key of keys) {
      store.delete(key);
    }
    await promisifyTransaction(tx);
  }

  // ── Nugget images ──

  async saveNuggetImage(image: StoredImage): Promise<void> {
    const converted = await convertImageBlobUrls(image);
    const db = this.getDB();
    const tx = db.transaction(STORE_NUGGET_IMAGES, 'readwrite');
    tx.objectStore(STORE_NUGGET_IMAGES).put(converted);
    await promisifyTransaction(tx);
  }

  async loadNuggetImages(nuggetId: string): Promise<StoredImage[]> {
    const db = this.getDB();
    const tx = db.transaction(STORE_NUGGET_IMAGES, 'readonly');
    const index = tx.objectStore(STORE_NUGGET_IMAGES).index('byNugget');
    return await promisifyRequest(index.getAll(nuggetId));
  }

  async deleteNuggetImages(nuggetId: string): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_NUGGET_IMAGES, 'readwrite');
    const store = tx.objectStore(STORE_NUGGET_IMAGES);
    const index = store.index('byNugget');
    const keys = await promisifyRequest(index.getAllKeys(nuggetId));
    for (const key of keys) {
      store.delete(key);
    }
    await promisifyTransaction(tx);
  }

  // ── Projects ──

  async saveProject(project: StoredProject): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    tx.objectStore(STORE_PROJECTS).put(project);
    await promisifyTransaction(tx);
  }

  async loadProjects(): Promise<StoredProject[]> {
    const db = this.getDB();
    const tx = db.transaction(STORE_PROJECTS, 'readonly');
    return await promisifyRequest(tx.objectStore(STORE_PROJECTS).getAll());
  }

  async deleteProject(projectId: string): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    tx.objectStore(STORE_PROJECTS).delete(projectId);
    await promisifyTransaction(tx);
  }

  // ── Clear all ──

  async clearAll(): Promise<void> {
    const db = this.getDB();
    const tx = db.transaction(ALL_STORES, 'readwrite');
    for (const storeName of ALL_STORES) {
      tx.objectStore(storeName).clear();
    }
    await promisifyTransaction(tx);
  }
}
