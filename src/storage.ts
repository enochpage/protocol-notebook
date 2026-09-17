import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Workspace } from "./model";

export const native = isTauri();
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("protocol-notebook-v1", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("workspace");
      request.result.createObjectStore("assets");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function read<T>(store: string, key: string): Promise<T | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store);
    const request = tx.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
async function write(
  store: string,
  key: string,
  value: unknown,
): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => reject(tx.error);
  });
}
export async function loadWorkspace(): Promise<Workspace | null> {
  const result = native
    ? await invoke<Workspace | null>("load_workspace")
    : await read<Workspace>("workspace", "current");
  if (
    result &&
    (result.version !== 1 ||
      !Array.isArray(result.pages) ||
      !Array.isArray(result.runs) ||
      !Array.isArray(result.projects) ||
      typeof result.drafts !== "object")
  )
    throw new Error(
      "This notebook has an unsupported or damaged format. Its files have not been overwritten.",
    );
  return result || null;
}
export async function saveWorkspace(workspace: Workspace) {
  if (native) await invoke("save_workspace", { workspace });
  else await write("workspace", "current", workspace);
}
export async function saveAsset(file: File): Promise<string> {
  const formats: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  if (!formats[file.type])
    throw new Error("Choose a PNG, JPEG, WebP, or GIF image.");
  if (file.size > 12 * 1024 * 1024)
    throw new Error("Choose an image smaller than 12 MB.");
  const id = `${crypto.randomUUID()}.${formats[file.type]}`;
  if (native)
    await invoke("save_asset", {
      id,
      bytes: Array.from(new Uint8Array(await file.arrayBuffer())),
    });
  else await write("assets", id, file);
  return id;
}
export async function loadAsset(id: string): Promise<string> {
  if (native) return invoke<string>("read_asset", { id });
  const blob = await read<Blob>("assets", id);
  if (!blob) throw new Error("Image file not found");
  return URL.createObjectURL(blob);
}
