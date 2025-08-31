import type { UploadedFile } from '../types';

const DB_NAME = 'GeminiCloudCLI_DB';
const DB_VERSION = 1;
const STORE_NAME = 'workspaces';

export interface Workspace {
  name: string;
  files: UploadedFile[];
}

let db: IDBDatabase;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject('Error opening IndexedDB.');
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };
  });
}

export async function checkStoragePersistence(): Promise<'persistent' | 'transient' | 'unknown'> {
    if (navigator.storage && navigator.storage.persisted) {
        try {
            const isPersisted = await navigator.storage.persisted();
            if (isPersisted) {
                return 'persistent';
            }
            // If not persisted, try to request it. This is a one-time request.
            if (navigator.storage.persist) {
                const permissionGranted = await navigator.storage.persist();
                return permissionGranted ? 'persistent' : 'transient';
            }
            return 'transient';
        } catch (error) {
            console.error("Error checking or requesting storage persistence:", error);
            return 'unknown';
        }
    }
    return 'unknown';
}

export async function saveWorkspace(name: string, files: UploadedFile[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const workspace: Workspace = { name, files };
    const request = store.put(workspace);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('Error saving workspace:', request.error);
      reject('Failed to save workspace.');
    };
  });
}

export async function getWorkspace(name: string): Promise<Workspace | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(name);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.error('Error getting workspace:', request.error);
      reject('Failed to get workspace.');
    };
  });
}

export async function getAllWorkspaceNames(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAllKeys();

    request.onsuccess = () => {
        resolve(request.result as string[]);
    };
    request.onerror = () => {
        console.error('Error getting all workspace names:', request.error);
        reject('Failed to get workspace names.');
    };
  });
}

export async function deleteWorkspace(name: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        
        // Listen to transaction events, which are more reliable than request events,
        // to prevent the operation from hanging silently.
        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = (event) => {
            const error = (event.target as IDBTransaction)?.error ?? 'Unknown transaction error';
            console.error(`Transaction error deleting workspace "${name}":`, error);
            reject('Failed to delete workspace due to a transaction error.');
        };
        
        transaction.onabort = (event) => {
            const error = (event.target as IDBTransaction)?.error ?? 'Transaction aborted';
            console.error(`Transaction aborted for workspace "${name}":`, error);
            reject('Workspace deletion was aborted.');
        };

        const store = transaction.objectStore(STORE_NAME);
        store.delete(name);
    });
}