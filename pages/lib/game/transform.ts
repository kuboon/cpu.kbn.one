/**
 * Placing a component: where its footprint and pins land once mirrored and rotated.
 */

import type { BorderPin, ComponentDef, Placement, Side } from "./model.ts";

const CLOCKWISE: Record<Side, Side> = { n: "e", e: "s", s: "w", w: "n" };
const MIRROR_SIDE: Record<Side, Side> = { n: "n", e: "w", s: "s", w: "e" };

/** Unit vector pointing out of a side. */
export const DELTA: Record<Side, { dx: number; dy: number }> = {
  n: { dx: 0, dy: -1 },
  e: { dx: 1, dy: 0 },
  s: { dx: 0, dy: 1 },
  w: { dx: -1, dy: 0 },
};

export const OPPOSITE: Record<Side, Side> = { n: "s", e: "w", s: "n", w: "e" };

/** Width and height of a placed component after its rotation. */
export function footprint(
  def: { width: number; height: number },
  placement: { rotation: number },
): { width: number; height: number } {
  return placement.rotation % 2 === 0
    ? { width: def.width, height: def.height }
    : { width: def.height, height: def.width };
}

/** A pin's location in board coordinates: the cell it belongs to and the side it faces. */
export interface WorldPin {
  pin: BorderPin;
  index: number;
  x: number;
  y: number;
  side: Side;
}

/** The cell a border pin belongs to, in the design's own coordinates. */
export function pinCell(
  d: { width: number; height: number },
  pin: { side: Side; index: number },
): { x: number; y: number } {
  switch (pin.side) {
    case "n":
      return { x: pin.index, y: 0 };
    case "s":
      return { x: pin.index, y: d.height - 1 };
    case "w":
      return { x: 0, y: pin.index };
    case "e":
      return { x: d.width - 1, y: pin.index };
  }
}

export function worldPins(def: ComponentDef, placement: Placement): WorldPin[] {
  return def.pins.map((pin, index) => {
    let { x, y } = pinCell(def, pin);
    let side = pin.side;
    let w = def.width;
    let h = def.height;
    if (placement.mirror) {
      x = w - 1 - x;
      side = MIRROR_SIDE[side];
    }
    for (let r = 0; r < placement.rotation; r++) {
      [x, y] = [h - 1 - y, x];
      [w, h] = [h, w];
      side = CLOCKWISE[side];
    }
    return { pin, index, x: placement.x + x, y: placement.y + y, side };
  });
}

/**
 * Whether mirroring a component changes nothing: every pin keeps its own place and facing. A
 * placement is defined by its pins alone, so for such a component the mirror flag is a no-op and
 * the editor offers no 反転 for it.
 */
export function mirrorSymmetric(def: ComponentDef): boolean {
  const at = { componentId: def.id, x: 0, y: 0, rotation: 0 as const };
  const plain = worldPins(def, { ...at, mirror: false });
  const flipped = worldPins(def, { ...at, mirror: true });
  return plain.every((p, i) =>
    p.x === flipped[i].x && p.y === flipped[i].y && p.side === flipped[i].side
  );
}

/** Every cell a placed component covers. */
export function occupiedCells(
  def: ComponentDef,
  placement: Placement,
): { x: number; y: number }[] {
  const { width, height } = footprint(def, placement);
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cells.push({ x: placement.x + x, y: placement.y + y });
    }
  }
  return cells;
}
