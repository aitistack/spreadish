import type { StorageAdapter } from '@sometic/store/persistent';

const DEFAULT_DB_NAME = 'spreadsheet-engine';
const DEFAULT_STORE_NAME = 'kv';
const DB_VERSION = 1;

export type CreateIndexedDBStorageOptions = {
    readonly dbName?: string;
    readonly storeName?: string;
    /** Injected for tests; defaults to `globalThis.indexedDB`. */
    readonly indexedDB?: IDBFactory;
};

function resolveIndexedDB(explicit?: IDBFactory): IDBFactory {
    if (explicit) {
        return explicit;
    }
    const candidate = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    if (!candidate || typeof candidate.open !== 'function') {
        throw new Error(
            'IndexedDB is not available in this environment. Pass an indexedDB factory or use createMemoryStorage().',
        );
    }
    return candidate;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            reject(request.error ?? new Error('IndexedDB request failed'));
        };
    });
}

function openDatabase(
    factory: IDBFactory,
    dbName: string,
    storeName: string,
): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = factory.open(dbName, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            const names = db.objectStoreNames;
            const hasStore =
                typeof names.contains === 'function'
                    ? names.contains(storeName)
                    : Array.from(names as unknown as ArrayLike<string>).includes(storeName);
            if (!hasStore) {
                db.createObjectStore(storeName);
            }
        };
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            reject(request.error ?? new Error(`Failed to open IndexedDB "${dbName}"`));
        };
        request.onblocked = () => {
            reject(new Error(`IndexedDB open blocked for "${dbName}"`));
        };
    });
}

async function withStore<T>(
    factory: IDBFactory,
    dbName: string,
    storeName: string,
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    const db = await openDatabase(factory, dbName, storeName);
    try {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const txDone = new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => {
                resolve();
            };
            tx.onerror = () => {
                reject(tx.error ?? new Error('IndexedDB transaction failed'));
            };
            tx.onabort = () => {
                reject(tx.error ?? new Error('IndexedDB transaction aborted'));
            };
        });
        const result = await requestToPromise(run(store));
        await txDone;
        return result;
    } finally {
        db.close();
    }
}

/**
 * Custom `StorageAdapter` backed by IndexedDB.
 * Sometic does not ship an IndexedDB helper — hosts must provide this adapter.
 */
export function createIndexedDBStorageAdapter(
    options: CreateIndexedDBStorageOptions = {},
): StorageAdapter {
    const dbName = options.dbName ?? DEFAULT_DB_NAME;
    const storeName = options.storeName ?? DEFAULT_STORE_NAME;
    const factory = resolveIndexedDB(options.indexedDB);

    return {
        name: 'indexedDB',
        async getItem(key: string): Promise<string | null> {
            const value = await withStore(factory, dbName, storeName, 'readonly', (store) =>
                store.get(key),
            );
            if (value == null) {
                return null;
            }
            if (typeof value !== 'string') {
                throw new Error(`IndexedDB value for key "${key}" is not a string`);
            }
            return value;
        },
        async setItem(key: string, value: string): Promise<void> {
            await withStore(factory, dbName, storeName, 'readwrite', (store) =>
                store.put(value, key),
            );
        },
        async removeItem(key: string): Promise<void> {
            await withStore(factory, dbName, storeName, 'readwrite', (store) => store.delete(key));
        },
    };
}
