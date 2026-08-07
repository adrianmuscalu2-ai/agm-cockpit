import {
  OCR_DOCUMENT_SCHEMA_VERSION,
  type NewOcrDocument,
  type OcrDocument,
  type OcrDocumentListOptions,
  type OcrDocumentUpdate,
} from '../ocr/ocr-document.contract';

export const OCR_ARCHIVE_DATABASE_NAME = 'agm-cockpit';
export const OCR_ARCHIVE_DATABASE_VERSION = 1;
export const OCR_ARCHIVE_STORE_NAME = 'ocrDocuments';

export type OcrArchiveStore = {
  list(): Promise<OcrDocument[]>;
  get(id: string): Promise<OcrDocument | undefined>;
  put(document: OcrDocument): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
};

export type OcrArchiveRepository = ReturnType<typeof createOcrArchiveRepository>;

export function createOcrArchiveRepository(
  store: OcrArchiveStore,
  options: { now?: () => string } = {},
) {
  const now = options.now ?? (() => new Date().toISOString());

  return {
    async list(listOptions: OcrDocumentListOptions = {}): Promise<OcrDocument[]> {
      const query = listOptions.query?.trim().toLocaleLowerCase() ?? '';
      const limit = normalizeLimit(listOptions.limit);
      return (await store.list())
        .filter(isOcrDocument)
        .filter((document) => !listOptions.beforeCreatedAt || document.createdAt < listOptions.beforeCreatedAt)
        .filter((document) => {
          if (!query) return true;
          return `${document.editedText}\n${document.extractedText}\n${document.translation?.text ?? ''}`
            .toLocaleLowerCase()
            .includes(query);
        })
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, limit);
    },

    async get(id: string): Promise<OcrDocument | undefined> {
      const document = await store.get(id);
      return document && isOcrDocument(document) ? document : undefined;
    },

    async create(input: NewOcrDocument): Promise<OcrDocument> {
      if (await store.get(input.id)) {
        throw new Error(`OCR document already exists: ${input.id}`);
      }
      const timestamp = input.createdAt ?? now();
      const document: OcrDocument = {
        ...input,
        schemaVersion: OCR_DOCUMENT_SCHEMA_VERSION,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      assertOcrDocument(document);
      await store.put(document);
      return document;
    },

    async update(id: string, patch: OcrDocumentUpdate): Promise<OcrDocument> {
      const current = await store.get(id);
      if (!current || !isOcrDocument(current)) {
        throw new Error(`OCR document not found: ${id}`);
      }
      const document: OcrDocument = { ...current, ...patch, updatedAt: now() };
      assertOcrDocument(document);
      await store.put(document);
      return document;
    },

    async delete(id: string): Promise<void> {
      await store.delete(id);
    },

    async clear(): Promise<void> {
      await store.clear();
    },

    async count(): Promise<number> {
      return (await store.list()).filter(isOcrDocument).length;
    },
  };
}

export function createIndexedDbOcrArchiveStore(
  indexedDb: IDBFactory,
  databaseName = OCR_ARCHIVE_DATABASE_NAME,
): OcrArchiveStore {
  let databasePromise: Promise<IDBDatabase> | undefined;
  const database = () => databasePromise ??= openDatabase(indexedDb, databaseName);

  return {
    async list() {
      const db = await database();
      return requestResult<OcrDocument[]>(db.transaction(OCR_ARCHIVE_STORE_NAME).objectStore(OCR_ARCHIVE_STORE_NAME).getAll());
    },
    async get(id) {
      const db = await database();
      return requestResult<OcrDocument | undefined>(db.transaction(OCR_ARCHIVE_STORE_NAME).objectStore(OCR_ARCHIVE_STORE_NAME).get(id));
    },
    async put(document) {
      const db = await database();
      const transaction = db.transaction(OCR_ARCHIVE_STORE_NAME, 'readwrite');
      transaction.objectStore(OCR_ARCHIVE_STORE_NAME).put(document);
      await transactionComplete(transaction);
    },
    async delete(id) {
      const db = await database();
      const transaction = db.transaction(OCR_ARCHIVE_STORE_NAME, 'readwrite');
      transaction.objectStore(OCR_ARCHIVE_STORE_NAME).delete(id);
      await transactionComplete(transaction);
    },
    async clear() {
      const db = await database();
      const transaction = db.transaction(OCR_ARCHIVE_STORE_NAME, 'readwrite');
      transaction.objectStore(OCR_ARCHIVE_STORE_NAME).clear();
      await transactionComplete(transaction);
    },
  };
}

function openDatabase(indexedDb: IDBFactory, databaseName: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDb.open(databaseName, OCR_ARCHIVE_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OCR_ARCHIVE_STORE_NAME)) {
        const store = db.createObjectStore(OCR_ARCHIVE_STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('updatedAt', 'updatedAt');
        store.createIndex('status', 'status');
        store.createIndex('pinned', 'pinned');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open OCR archive database.'));
    request.onblocked = () => reject(new Error('OCR archive database upgrade was blocked.'));
  });
}

function requestResult<Result>(request: IDBRequest<Result>) {
  return new Promise<Result>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('OCR archive request failed.'));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('OCR archive transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('OCR archive transaction was aborted.'));
  });
}

function normalizeLimit(limit: number | undefined) {
  if (limit === undefined) return 30;
  return Math.max(1, Math.min(100, Math.trunc(limit)));
}

function isOcrDocument(value: unknown): value is OcrDocument {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<OcrDocument>;
  return item.schemaVersion === OCR_DOCUMENT_SCHEMA_VERSION
    && typeof item.id === 'string' && item.id.length > 0
    && typeof item.createdAt === 'string' && typeof item.updatedAt === 'string'
    && item.image instanceof Blob && item.thumbnail instanceof Blob
    && typeof item.extractedText === 'string' && typeof item.editedText === 'string'
    && typeof item.confidence === 'number' && Number.isFinite(item.confidence)
    && ['ro', 'de', 'en'].includes(item.sourceLanguage ?? '')
    && ['recognized', 'reviewed', 'translated'].includes(item.status ?? '')
    && typeof item.pinned === 'boolean'
    && !!item.source && ['camera', 'file'].includes(item.source.kind)
    && typeof item.source.mimeType === 'string' && typeof item.source.byteSize === 'number';
}

function assertOcrDocument(document: OcrDocument) {
  if (!isOcrDocument(document)) {
    throw new TypeError('Invalid OCR document.');
  }
}

