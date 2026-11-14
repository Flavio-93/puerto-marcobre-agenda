import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Tarea, SyncQueueItem } from '../types';

interface PuertoDB extends DBSchema {
  tareas: {
    key: string;
    value: Tarea;
  };
  sync_queue: {
    key: string;
    value: SyncQueueItem;
  };
  meta: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'marcobre_puerto_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PuertoDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<PuertoDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tareas')) {
          db.createObjectStore('tareas', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      },
    });
  }
  return dbPromise;
}

// Guardar tareas en caché local
export async function cacheTareas(tareas: Tarea[]) {
  const db = await getDB();
  const tx = db.transaction('tareas', 'readwrite');
  await tx.objectStore('tareas').clear();
  for (const t of tareas) {
    await tx.objectStore('tareas').put(t);
  }
  await tx.done;
}

// Obtener tareas cacheadas
export async function getCachedTareas(): Promise<Tarea[]> {
  const db = await getDB();
  return await db.getAll('tareas');
}

// Guardar acción pendiente offline
export async function enqueueOfflineSync(item: SyncQueueItem) {
  const db = await getDB();
  await db.put('sync_queue', item);
}

// Obtener acciones pendientes
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return await db.getAll('sync_queue');
}

// Remover elemento de sync completado
export async function removePendingSyncItem(id: string) {
  const db = await getDB();
  await db.delete('sync_queue', id);
}

// Limpiar cola de sincronización una vez enviada
export async function clearSyncQueue() {
  const db = await getDB();
  await db.clear('sync_queue');
}

