/**
 * The data model: what a design on the grid is, and what a component is.
 *
 * Everything in this module is plain data so it can be serialized as-is. The rules (how cells
 * connect, how relays behave) live in `netlist.ts` and `sim.ts`.
 */

/** A logic level. */
export type Bit = 0 | 1;

/** How many lanes a bus carries. The game's word is 8 bits. */
export const BUS_WIDTH = 8;

/** A side of a cell or of the board, clockwise from north. */
export type Side = "n" | "e" | "s" | "w";

export const SIDES: readonly Side[] = ["n", "e", "s", "w"];

/** A pin on the border of a design, which becomes a pin of the component made from it. */
export interface BorderPin {
  name: string;
  dir: "in" | "out";
  side: Side;
  /** Position along that side, counted from the north-west corner clockwise-independent: x for n/s, y for e/w. */
  index: number;
  /** Lanes carried: 1 (default) or {@link BUS_WIDTH}. */
  width?: number;
}

/** A wire cell: which of its four sides it connects to. Three or four make a junction. */
export interface WireCell {
  kind: "wire";
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
  /** A bus: {@link BUS_WIDTH} lanes in one cell. */
  bus?: boolean;
}

/** A crossing: north-south and east-west pass through without touching. */
export interface CrossCell {
  kind: "cross";
  busNS?: boolean;
  busEW?: boolean;
}

export type Cell = WireCell | CrossCell;

/** Quarter turns clockwise. */
export type Rotation = 0 | 1 | 2 | 3;

/** A component placed on the board, by the north-west corner of its (transformed) footprint. */
export interface Placement {
  componentId: string;
  x: number;
  y: number;
  rotation: Rotation;
  /** Horizontal flip, applied before the rotation. */
  mirror: boolean;
}

/** A board: cells, placed components and border pins. */
export interface Design {
  width: number;
  height: number;
  /** Keyed by {@link cellKey}. */
  cells: Record<string, Cell>;
  placements: Placement[];
  pins: BorderPin[];
}

export type PrimitiveKind = "relay-on" | "relay-off" | "one" | "split";

/** A component available in the palette: a primitive, or a registered design. */
export interface ComponentDef {
  id: string;
  name: string;
  /** The stage the component solves, or `"primitive"`. */
  stageId: string;
  width: number;
  height: number;
  pins: BorderPin[];
  /** The board it was built from. Absent for primitives. */
  design?: Design;
  primitive?: PrimitiveKind;
  createdAt: string;
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseCellKey(key: string): { x: number; y: number } {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

/** The score of a design: its whole footprint, empty cells included. */
export function area(d: { width: number; height: number }): number {
  return d.width * d.height;
}

const relayPins: BorderPin[] = [
  { name: "c", dir: "in", side: "n", index: 0 },
  { name: "in", dir: "in", side: "w", index: 0 },
  { name: "out", dir: "out", side: "e", index: 0 },
];

/** Closed while `c` is 0. */
export const RELAY_ON: ComponentDef = {
  id: "relay-on",
  name: "Relay (default on)",
  stageId: "primitive",
  width: 1,
  height: 1,
  pins: relayPins,
  primitive: "relay-on",
  createdAt: "",
};

/** Closed while `c` is 1. */
export const RELAY_OFF: ComponentDef = {
  id: "relay-off",
  name: "Relay (default off)",
  stageId: "primitive",
  width: 1,
  height: 1,
  pins: relayPins,
  primitive: "relay-off",
  createdAt: "",
};

/** Drives 1 on all four sides. Its pins share a name; primitives are identified by pin index. */
export const ONE: ComponentDef = {
  id: "one",
  name: "1",
  stageId: "primitive",
  width: 1,
  height: 1,
  pins: SIDES.map((side) => ({ name: "1", dir: "out", side, index: 0 })),
  primitive: "one",
  createdAt: "",
};

/**
 * Fans a bus out into its lanes (or gathers lanes into a bus; it is only wiring). The bus pin is
 * on the west of the top cell, lane i on the east of cell i.
 */
export const SPLIT: ComponentDef = {
  id: "split",
  name: "Bus split",
  stageId: "primitive",
  width: 1,
  height: BUS_WIDTH,
  pins: [
    { name: "bus", dir: "in", side: "w", index: 0, width: BUS_WIDTH },
    ...Array.from({ length: BUS_WIDTH }, (_, i) => ({
      name: `b${i}`,
      dir: "in" as const,
      side: "e" as const,
      index: i,
    })),
  ],
  primitive: "split",
  createdAt: "",
};

export const PRIMITIVES: readonly ComponentDef[] = [
  RELAY_ON,
  RELAY_OFF,
  ONE,
  SPLIT,
];

export function pinWidth(pin: { width?: number }): number {
  return pin.width ?? 1;
}

/** Components by id. Always includes the primitives. */
export type Library = Map<string, ComponentDef>;

export function createLibrary(
  components: readonly ComponentDef[] = [],
): Library {
  return new Map([...PRIMITIVES, ...components].map((c) => [c.id, c]));
}

export function emptyDesign(width: number, height: number): Design {
  return { width, height, cells: {}, placements: [], pins: [] };
}
