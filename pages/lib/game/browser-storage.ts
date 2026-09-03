/**
 * The save file in `localStorage`. Every access is guarded: the server render has no storage, a
 * private window may refuse it, and the stored text may be from another version.
 */

import { parse, serialize, STORAGE_KEY } from "./storage.ts";
import type { SaveData } from "./storage.ts";

export function loadSave(): SaveData | undefined {
  try {
    const text = globalThis.localStorage?.getItem(STORAGE_KEY);
    return text === null || text === undefined ? undefined : parse(text);
  } catch {
    return undefined;
  }
}

export function storeSave(save: SaveData): boolean {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, serialize(save));
    return true;
  } catch {
    return false;
  }
}
