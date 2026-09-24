/**
 * IndexedDB storage for finished audio chunks to support resuming generation.
 * Keyed by a SHA-256 hash of:
 * chunk text + voice + model + style + language + accent + pace.
 */

const DB_NAME = "sm_voice_studio_chunks_db";
const STORE_NAME = "finished_chunks";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this browser"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface ChunkKeyParams {
  text: string;
  voice: string;
  model: string;
  style: string;
  language: string;
  accent: string;
  pace: string;
}

/**
 * Computes a deterministic SHA-256 hash key for a chunk and its audio parameters.
 */
export async function computeChunkHash(params: ChunkKeyParams): Promise<string> {
  const serialized = [
    params.text.trim(),
    params.voice,
    params.model,
    params.style,
    params.language,
    params.accent,
    params.pace,
  ].join("::");

  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const msgUint8 = new TextEncoder().encode(serialized);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    // fall through to fallback
  }

  // Deterministic fallback hash
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < serialized.length; i++) {
    const ch = serialized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/**
 * Retrieves a cached audio chunk from IndexedDB.
 */
export async function getCachedChunk(
  key: string
): Promise<{ pcmBytes: Uint8Array; sampleRate: number } | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const val = req.result;
        if (val && val.pcmBytes) {
          const pcmBytes =
            val.pcmBytes instanceof Uint8Array
              ? val.pcmBytes
              : new Uint8Array(val.pcmBytes);
          resolve({ pcmBytes, sampleRate: val.sampleRate || 24000 });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Stores a finished audio chunk in IndexedDB.
 */
export async function saveCachedChunk(
  key: string,
  pcmBytes: Uint8Array,
  sampleRate: number
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put({ pcmBytes, sampleRate, savedAt: Date.now() }, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore storage failure
  }
}

/**
 * Clears all cached chunks from IndexedDB.
 */
export async function clearAllCachedChunks(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}

/**
 * Returns the count of saved chunks in IndexedDB.
 */
export async function getCachedChunksCount(): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}
