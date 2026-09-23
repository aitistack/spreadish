/**
 * Minimal in-memory IndexedDB fake for unit tests (Bun has no IndexedDB).
 * Kept intentionally loosely typed — only the open/get/put/delete surface is real.
 */

type StoreMap = Map<IDBValidKey, unknown>;

type DbRecord = {
    version: number;
    stores: Map<string, StoreMap>;
};

export function createFakeIndexedDB(): IDBFactory {
    const databases = new Map<string, DbRecord>();

    const open = (name: string, version?: number): IDBOpenDBRequest => {
        const targetVersion = version ?? 1;
        const request = {
            result: undefined as unknown as IDBDatabase,
            error: null as DOMException | null,
            readyState: 'pending' as IDBRequestReadyState,
            onsuccess: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
            onerror: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
            onblocked: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
            onupgradeneeded: null as
                ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown) | null,
        };

        queueMicrotask(() => {
            let record = databases.get(name);
            const isNew = !record;
            if (!record) {
                record = { version: targetVersion, stores: new Map() };
                databases.set(name, record);
            }

            const storeNames = () => [...record!.stores.keys()];

            const db = {
                name,
                version: targetVersion,
                get objectStoreNames() {
                    return storeNames() as unknown as DOMStringList;
                },
                createObjectStore(storeName: string) {
                    if (!record!.stores.has(storeName)) {
                        record!.stores.set(storeName, new Map());
                    }
                    return {} as IDBObjectStore;
                },
                transaction(storeNameOrNames: string | string[], mode?: IDBTransactionMode) {
                    const storeName = Array.isArray(storeNameOrNames)
                        ? storeNameOrNames[0]!
                        : storeNameOrNames;
                    const data = record!.stores.get(storeName) ?? new Map();
                    if (!record!.stores.has(storeName)) {
                        record!.stores.set(storeName, data);
                    }

                    const tx = {
                        error: null as DOMException | null,
                        mode: mode ?? 'readonly',
                        oncomplete: null as ((this: IDBTransaction, ev: Event) => unknown) | null,
                        onerror: null as ((this: IDBTransaction, ev: Event) => unknown) | null,
                        onabort: null as ((this: IDBTransaction, ev: Event) => unknown) | null,
                        objectStore() {
                            return {
                                get(key: IDBValidKey) {
                                    const req = makeRequest(data.get(key));
                                    return req;
                                },
                                put(value: unknown, key?: IDBValidKey) {
                                    if (key === undefined) {
                                        return makeRequestFail();
                                    }
                                    data.set(key, value);
                                    return makeRequest(key);
                                },
                                delete(key: IDBValidKey) {
                                    data.delete(key);
                                    return makeRequest(undefined);
                                },
                            } as unknown as IDBObjectStore;
                        },
                    };

                    queueMicrotask(() => {
                        queueMicrotask(() => {
                            tx.oncomplete?.call(
                                tx as unknown as IDBTransaction,
                                new Event('complete'),
                            );
                        });
                    });

                    return tx as unknown as IDBTransaction;
                },
                close() {
                    // no-op
                },
            };

            request.result = db as unknown as IDBDatabase;
            if (isNew || record.version < targetVersion) {
                record.version = targetVersion;
                request.onupgradeneeded?.call(
                    request as unknown as IDBOpenDBRequest,
                    new Event('upgradeneeded') as IDBVersionChangeEvent,
                );
            }
            request.readyState = 'done';
            request.onsuccess?.call(request as unknown as IDBOpenDBRequest, new Event('success'));
        });

        return request as unknown as IDBOpenDBRequest;
    };

    return {
        cmp: () => 0,
        databases: async () => [],
        deleteDatabase(name: string) {
            databases.delete(name);
            const request = {
                result: undefined as unknown as IDBDatabase,
                error: null,
                readyState: 'done' as IDBRequestReadyState,
                onsuccess: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
                onerror: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
                onblocked: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
                onupgradeneeded: null as
                    ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown) | null,
            };
            queueMicrotask(() => {
                request.onsuccess?.call(
                    request as unknown as IDBOpenDBRequest,
                    new Event('success'),
                );
            });
            return request as unknown as IDBOpenDBRequest;
        },
        open,
    } as IDBFactory;
}

function makeRequest<T>(value: T): IDBRequest<T> {
    const request = {
        result: undefined as unknown as T,
        error: null as DOMException | null,
        readyState: 'pending' as IDBRequestReadyState,
        onsuccess: null as ((this: IDBRequest<T>, ev: Event) => unknown) | null,
        onerror: null as ((this: IDBRequest<T>, ev: Event) => unknown) | null,
    };
    queueMicrotask(() => {
        request.result = value;
        request.readyState = 'done';
        request.onsuccess?.call(request as unknown as IDBRequest<T>, new Event('success'));
    });
    return request as unknown as IDBRequest<T>;
}

function makeRequestFail(): IDBRequest<IDBValidKey> {
    const request = {
        result: undefined as unknown as IDBValidKey,
        error: new DOMException('Key required', 'DataError'),
        readyState: 'pending' as IDBRequestReadyState,
        onsuccess: null as ((this: IDBRequest<IDBValidKey>, ev: Event) => unknown) | null,
        onerror: null as ((this: IDBRequest<IDBValidKey>, ev: Event) => unknown) | null,
    };
    queueMicrotask(() => {
        request.readyState = 'done';
        request.onerror?.call(request as unknown as IDBRequest<IDBValidKey>, new Event('error'));
    });
    return request as unknown as IDBRequest<IDBValidKey>;
}
