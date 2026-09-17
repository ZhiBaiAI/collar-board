// 项目注册表：把目录句柄存入 IndexedDB，实现「下次打开仍在列表里」。
//
// 授权现实（Chrome）：关闭标签页即失去访问权，句柄可以保存，
// 但重新打开后需要用户再点一次确认。因此这里的读取一律配合
// queryPermission/requestPermission，界面必须把这次点击讲清楚。

const DB_NAME = 'collar-board';
const DB_VERSION = 1;
const STORE = 'projects';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const result = fn(store);
      tx.oncomplete = () => resolve(result.value);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function listProjects() {
  const all = await withStore('readonly', (store) => {
    const box = { value: [] };
    const req = store.getAll();
    req.onsuccess = () => {
      box.value = req.result || [];
    };
    return box;
  });
  return all.sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0));
}

export async function getProject(id) {
  return withStore('readonly', (store) => {
    const box = { value: null };
    const req = store.get(id);
    req.onsuccess = () => {
      box.value = req.result || null;
    };
    return box;
  });
}

export async function saveProject(record) {
  await withStore('readwrite', (store) => {
    store.put(record);
    return { value: null };
  });
  return record;
}

export async function removeProject(id) {
  await withStore('readwrite', (store) => {
    store.delete(id);
    return { value: null };
  });
}

/** 目录句柄以字符串作主键，避免句柄对象在列表里被重复序列化。 */
export function projectIdFor(name) {
  return `dir:${name}`;
}

/**
 * 权限三态：granted / prompt / denied。
 * 恢复已保存的项目时返回 prompt，界面据此提示「需要再确认一次」。
 */
export async function checkPermission(handle, { request = false } = {}) {
  if (!handle) return 'denied';
  const opts = { mode: 'read' };
  try {
    if (typeof handle.queryPermission === 'function') {
      const state = await handle.queryPermission(opts);
      if (state === 'granted' || !request) return state;
    }
    if (typeof handle.requestPermission === 'function') {
      return await handle.requestPermission(opts);
    }
    return 'granted';
  } catch {
    return 'denied';
  }
}

export const _internal = { DB_NAME, STORE };
