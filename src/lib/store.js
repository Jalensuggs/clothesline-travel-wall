/** 极简 IndexedDB 封装：保存用户上传的照片和每张卡片的游记。数据只在本机浏览器里。 */
const DB_NAME = "clothesline-travel";
let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore("photos", { keyPath: "id" });
        db.createObjectStore("notes");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const store = {
  async allPhotos() {
    try {
      const list = (await run("photos", "readonly", (s) => s.getAll())) || [];
      return list.sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.added - b.added);
    } catch {
      return [];
    }
  },
  putPhoto: (p) => run("photos", "readwrite", (s) => s.put(p)).catch(() => {}),
  deletePhoto: (id) => run("photos", "readwrite", (s) => s.delete(id)).catch(() => {}),
  async allNotes() {
    try {
      const db = await open();
      return await new Promise((resolve) => {
        const out = {};
        const req = db.transaction("notes").objectStore("notes").openCursor();
        req.onsuccess = () => {
          const cur = req.result;
          if (!cur) return resolve(out);
          out[cur.key] = cur.value;
          cur.continue();
        };
        req.onerror = () => resolve(out);
      });
    } catch {
      return {};
    }
  },
  setNote: (id, text) => run("notes", "readwrite", (s) => s.put(text, id)).catch(() => {}),
};
