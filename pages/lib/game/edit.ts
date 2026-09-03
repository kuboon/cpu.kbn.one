/**
 * Editing operations on a design. Every function returns a new design (or `undefined` when the
 * edit is not allowed) and leaves its input untouched, which is what makes undo a stack of old
 * designs.
 */

import type {
  Cell,
  Design,
  Library,
  Placement,
  Side,
  WireCell,
} from "./model.ts";
import { cellKey, parseCellKey } from "./model.ts";
import { DELTA, footprint, occupiedCells, OPPOSITE } from "./transform.ts";

export interface Point {
  x: number;
  y: number;
}

/** A position on the border. */
export interface Slot {
  side: Side;
  index: number;
}

export function inBoard(
  d: { width: number; height: number },
  p: Point,
): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < d.width && p.y < d.height;
}

/** The side of `a` that faces `b`, when they are neighbours. */
export function sideBetween(a: Point, b: Point): Side | undefined {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 1 && dy === 0) return "e";
  if (dx === -1 && dy === 0) return "w";
  if (dx === 0 && dy === 1) return "s";
  if (dx === 0 && dy === -1) return "n";
  return undefined;
}

/** Index of the placement covering a cell. */
export function placementAt(
  design: Design,
  library: Library,
  p: Point,
): number | undefined {
  for (let i = design.placements.length - 1; i >= 0; i--) {
    const placement = design.placements[i];
    const def = library.get(placement.componentId);
    if (def === undefined) continue;
    const { width, height } = footprint(def, placement);
    if (
      p.x >= placement.x && p.x < placement.x + width &&
      p.y >= placement.y && p.y < placement.y + height
    ) return i;
  }
  return undefined;
}

/**
 * Joins two neighbouring cells with wire. An empty cell becomes a wire; a wire gains the side; a
 * crossing or a component is left alone (its face is already whatever it is). One of the two may
 * lie just outside the board: the cell inside then gets a stub towards the border, which is how
 * a wire reaches a border pin.
 */
export function connect(
  design: Design,
  library: Library,
  a: Point,
  b: Point,
): Design {
  const side = sideBetween(a, b);
  if (side === undefined || (!inBoard(design, a) && !inBoard(design, b))) {
    return design;
  }
  const cells = { ...design.cells };
  if (inBoard(design, a)) extend(design, library, cells, a, side);
  if (inBoard(design, b)) extend(design, library, cells, b, OPPOSITE[side]);
  return { ...design, cells };
}

function extend(
  design: Design,
  library: Library,
  cells: Record<string, Cell>,
  p: Point,
  side: Side,
): void {
  if (placementAt(design, library, p) !== undefined) return;
  const key = cellKey(p.x, p.y);
  const existing = cells[key];
  if (existing?.kind === "cross") return;
  const wire: WireCell = existing ??
    { kind: "wire", n: false, e: false, s: false, w: false };
  cells[key] = { ...wire, [side]: true };
}

/** Removes whatever is at a cell: a wire (and the neighbours' stubs towards it), a crossing, or a component. */
export function clearCell(design: Design, library: Library, p: Point): Design {
  const index = placementAt(design, library, p);
  if (index !== undefined) return removePlacement(design, index);
  const key = cellKey(p.x, p.y);
  if (design.cells[key] === undefined) return design;
  const cells = { ...design.cells };
  delete cells[key];
  for (const side of ["n", "e", "s", "w"] as const) {
    const nKey = cellKey(p.x + DELTA[side].dx, p.y + DELTA[side].dy);
    const neighbour = cells[nKey];
    if (neighbour?.kind === "wire" && neighbour[OPPOSITE[side]]) {
      cells[nKey] = { ...neighbour, [OPPOSITE[side]]: false };
    }
  }
  return { ...design, cells };
}

/** Makes a cell a crossing. A component's cell is left alone. */
export function setCross(design: Design, library: Library, p: Point): Design {
  if (!inBoard(design, p) || placementAt(design, library, p) !== undefined) {
    return design;
  }
  return {
    ...design,
    cells: { ...design.cells, [cellKey(p.x, p.y)]: { kind: "cross" } },
  };
}

/** Whether a placement fits: inside the board, on empty cells, clear of other components. */
export function canPlace(
  design: Design,
  library: Library,
  placement: Placement,
  ignoreIndex?: number,
): boolean {
  const def = library.get(placement.componentId);
  if (def === undefined) return false;
  const { width, height } = footprint(def, placement);
  if (
    placement.x < 0 || placement.y < 0 ||
    placement.x + width > design.width || placement.y + height > design.height
  ) return false;
  for (const cell of occupiedCells(def, placement)) {
    if (design.cells[cellKey(cell.x, cell.y)] !== undefined) return false;
    const other = placementAt(design, library, cell);
    if (other !== undefined && other !== ignoreIndex) return false;
  }
  return true;
}

export function addPlacement(
  design: Design,
  library: Library,
  placement: Placement,
): Design | undefined {
  if (!canPlace(design, library, placement)) return undefined;
  return { ...design, placements: [...design.placements, placement] };
}

export function replacePlacement(
  design: Design,
  library: Library,
  index: number,
  placement: Placement,
): Design | undefined {
  if (!canPlace(design, library, placement, index)) return undefined;
  const placements = design.placements.slice();
  placements[index] = placement;
  return { ...design, placements };
}

export function removePlacement(design: Design, index: number): Design {
  return {
    ...design,
    placements: design.placements.filter((_, i) => i !== index),
  };
}

/** The border slot a point in the one-cell margin around the board corresponds to. */
export function slotAt(
  d: { width: number; height: number },
  p: Point,
): Slot | undefined {
  if (p.y === -1 && p.x >= 0 && p.x < d.width) return { side: "n", index: p.x };
  if (p.y === d.height && p.x >= 0 && p.x < d.width) {
    return { side: "s", index: p.x };
  }
  if (p.x === -1 && p.y >= 0 && p.y < d.height) {
    return { side: "w", index: p.y };
  }
  if (p.x === d.width && p.y >= 0 && p.y < d.height) {
    return { side: "e", index: p.y };
  }
  return undefined;
}

export function pinAt(design: Design, slot: Slot): number | undefined {
  const i = design.pins.findIndex((p) =>
    p.side === slot.side && p.index === slot.index
  );
  return i === -1 ? undefined : i;
}

/** Moves a pin to a free slot. */
export function movePin(
  design: Design,
  pinIndex: number,
  slot: Slot,
): Design | undefined {
  const taken = pinAt(design, slot);
  if (taken !== undefined && taken !== pinIndex) return undefined;
  const pins = design.pins.slice();
  pins[pinIndex] = { ...pins[pinIndex], ...slot };
  return { ...design, pins };
}

/** Changes the board size. Fails if anything would fall outside. */
export function resize(
  design: Design,
  library: Library,
  width: number,
  height: number,
): Design | undefined {
  if (
    !Number.isInteger(width) || !Number.isInteger(height) || width < 1 ||
    height < 1
  ) {
    return undefined;
  }
  const next = { ...design, width, height };
  for (const key of Object.keys(design.cells)) {
    if (!inBoard(next, parseCellKey(key))) return undefined;
  }
  for (const placement of design.placements) {
    const def = library.get(placement.componentId);
    if (def === undefined) return undefined;
    const fp = footprint(def, placement);
    if (placement.x + fp.width > width || placement.y + fp.height > height) {
      return undefined;
    }
  }
  for (const pin of design.pins) {
    const limit = pin.side === "n" || pin.side === "s" ? width : height;
    if (pin.index >= limit) return undefined;
  }
  return next;
}

/** A fresh board for a stage: inputs down the west side, outputs down the east side. */
export function defaultDesign(
  stage: { inputs: readonly string[]; outputs: readonly string[] },
): Design {
  const height = Math.max(3, stage.inputs.length, stage.outputs.length);
  return {
    width: 6,
    height,
    cells: {},
    placements: [],
    pins: [
      ...stage.inputs.map((name, i) => ({
        name,
        dir: "in" as const,
        side: "w" as const,
        index: i,
      })),
      ...stage.outputs.map((name, i) => ({
        name,
        dir: "out" as const,
        side: "e" as const,
        index: i,
      })),
    ],
  };
}
