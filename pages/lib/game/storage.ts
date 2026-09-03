/**
 * What the browser keeps: registered components, the draft on each stage, and the best area.
 *
 * The site has no server, so this is the whole persistence layer. `parse` is defensive because
 * the JSON may come from an older version or from a file the player edited.
 */

import type { ComponentDef, Design } from "./model.ts";

export interface SaveData {
  version: 1;
  components: ComponentDef[];
  /** Work in progress, by stage id. */
  drafts: Record<string, Design>;
  /** Smallest registered area, by stage id. */
  best: Record<string, number>;
}

export const STORAGE_KEY = "cpu.kbn.one/save";

export function emptySave(): SaveData {
  return { version: 1, components: [], drafts: {}, best: {} };
}

export function serialize(save: SaveData): string {
  return JSON.stringify(save);
}

/** @throws on JSON that is not a save file */
export function parse(json: string): SaveData {
  const raw = JSON.parse(json);
  if (typeof raw !== "object" || raw === null || raw.version !== 1) {
    throw new Error("セーブデータの形式が違います");
  }
  return {
    version: 1,
    components: Array.isArray(raw.components) ? raw.components : [],
    drafts: isRecord(raw.drafts) ? raw.drafts as Record<string, Design> : {},
    best: isRecord(raw.best) ? raw.best as Record<string, number> : {},
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Records a registered component and updates the stage's best area. */
export function register(save: SaveData, component: ComponentDef): SaveData {
  const areaOf = component.width * component.height;
  const best = save.best[component.stageId];
  return {
    ...save,
    components: [...save.components, component],
    best: {
      ...save.best,
      [component.stageId]: best === undefined ? areaOf : Math.min(best, areaOf),
    },
  };
}

/** Whether another registered component places this one. */
export function isUsed(save: SaveData, id: string): boolean {
  return save.components.some((c) =>
    c.design?.placements.some((p) => p.componentId === id)
  );
}
