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
  /** Game-center achievements: recorded by the hub, or pending the player's confirmation. */
  achievements?: Record<string, "recorded" | "pending">;
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
    ...(isRecord(raw.achievements)
      ? {
        achievements: raw.achievements as Record<
          string,
          "recorded" | "pending"
        >,
      }
      : {}),
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

/** Names of the registered components and stage drafts that place this component. */
export function usedBy(save: SaveData, id: string): string[] {
  const uses = (d: Design | undefined) =>
    d?.placements.some((p) => p.componentId === id) ?? false;
  return [
    ...save.components.filter((c) => uses(c.design)).map((c) => c.name),
    ...Object.entries(save.drafts).filter(([, d]) => uses(d)).map(([stage]) =>
      `${stage} の下書き`
    ),
  ];
}

/** Whether another registered component or a draft places this one. */
export function isUsed(save: SaveData, id: string): boolean {
  return usedBy(save, id).length > 0;
}

/** Removes a component and recomputes the stage's best area. Refused while something uses it. */
export function removeComponent(
  save: SaveData,
  id: string,
): SaveData | undefined {
  const component = save.components.find((c) => c.id === id);
  if (component === undefined || isUsed(save, id)) return undefined;
  const components = save.components.filter((c) => c.id !== id);
  const remaining = components.filter((c) => c.stageId === component.stageId);
  const best = { ...save.best };
  if (remaining.length === 0) delete best[component.stageId];
  else {best[component.stageId] = Math.min(...remaining.map((c) =>
      c.width * c.height
    ));}
  return { ...save, components, best };
}

export function renameComponent(
  save: SaveData,
  id: string,
  name: string,
): SaveData {
  return {
    ...save,
    components: save.components.map((c) => c.id === id ? { ...c, name } : c),
  };
}

/** A registered component made from a passing design. */
export function componentFrom(
  stageId: string,
  name: string,
  design: Design,
  id: string = crypto.randomUUID(),
): ComponentDef {
  return {
    id,
    name,
    stageId,
    width: design.width,
    height: design.height,
    pins: design.pins,
    design,
    createdAt: new Date().toISOString(),
  };
}
