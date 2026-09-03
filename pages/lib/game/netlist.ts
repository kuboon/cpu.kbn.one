/**
 * From a board to a flat netlist of relays.
 *
 * Every cell face (a side of a cell) is a node in a union-find. A wire cell joins the faces it
 * connects to; a crossing joins north to south and east to west; touching faces of neighbouring
 * cells are always joined. A placed component's pins attach to the faces they sit on, and a
 * registered component is expanded in place by recursing into its design, so the result contains
 * only relays and constants.
 */

import type { ComponentDef, Design, Library, Side } from "./model.ts";
import { cellKey, parseCellKey } from "./model.ts";
import {
  DELTA,
  footprint,
  occupiedCells,
  pinCell,
  worldPins,
} from "./transform.ts";

/** A relay with its three terminals resolved to nets. */
export interface Relay {
  c: number;
  in: number;
  out: number;
  defaultOn: boolean;
  /** Where it is, for error messages: placement indices from the top level down. */
  path: string;
}

export interface Netlist {
  netCount: number;
  relays: Relay[];
  /** Nets driven by a constant 1. */
  ones: number[];
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  /** Top-level cell -> nets it carries (one for a wire, two for a crossing: north-south, east-west). */
  cellNets: Record<string, number[]>;
  /** Top-level border pin index -> net. */
  pinNets: number[];
  /** Top-level placement index -> pin index -> net. */
  placementPinNets: number[][];
}

/** A rule the design breaks, located for the editor. */
export interface Problem {
  message: string;
  cells?: { x: number; y: number }[];
  pinIndex?: number;
}

class UnionFind {
  #ids = new Map<string, number>();
  #parent: number[] = [];

  id(key: string): number {
    let id = this.#ids.get(key);
    if (id === undefined) {
      id = this.#parent.length;
      this.#ids.set(key, id);
      this.#parent.push(id);
    }
    return id;
  }

  find(key: string): number {
    let i = this.id(key);
    while (this.#parent[i] !== i) {
      this.#parent[i] = this.#parent[this.#parent[i]];
      i = this.#parent[i];
    }
    return i;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.#parent[ra] = rb;
  }
}

/** Checks a design against the placement rules. Empty means it can be simulated. */
export function validateDesign(design: Design, library: Library): Problem[] {
  const problems: Problem[] = [];
  const occupied = new Map<string, string>();

  for (const [key, cell] of Object.entries(design.cells)) {
    const { x, y } = parseCellKey(key);
    if (x < 0 || y < 0 || x >= design.width || y >= design.height) {
      problems.push({ message: "盤面の外にマスがあります", cells: [{ x, y }] });
    }
    occupied.set(key, cell.kind);
  }

  design.placements.forEach((placement, i) => {
    const def = library.get(placement.componentId);
    if (def === undefined) {
      problems.push({
        message: `部品 ${placement.componentId} がライブラリにありません`,
        cells: [{ x: placement.x, y: placement.y }],
      });
      return;
    }
    const { width, height } = footprint(def, placement);
    if (
      placement.x < 0 || placement.y < 0 ||
      placement.x + width > design.width ||
      placement.y + height > design.height
    ) {
      problems.push({
        message: `${def.name} が盤面からはみ出しています`,
        cells: [{ x: placement.x, y: placement.y }],
      });
    }
    for (const { x, y } of occupiedCells(def, placement)) {
      const key = cellKey(x, y);
      if (occupied.has(key)) {
        problems.push({
          message: `${def.name} が重なっています`,
          cells: [{ x, y }],
        });
      }
      occupied.set(key, `placement:${i}`);
    }
  });

  const slots = new Set<string>();
  const names = new Set<string>();
  design.pins.forEach((pin, i) => {
    const limit = pin.side === "n" || pin.side === "s"
      ? design.width
      : design.height;
    if (pin.index < 0 || pin.index >= limit) {
      problems.push({
        message: `ピン ${pin.name} が辺の外にあります`,
        pinIndex: i,
      });
    }
    const slot = `${pin.side}${pin.index}`;
    if (slots.has(slot)) {
      problems.push({
        message: `ピン ${pin.name} の位置が他のピンと重なっています`,
        pinIndex: i,
      });
    }
    slots.add(slot);
    if (names.has(pin.name)) {
      problems.push({
        message: `ピン名 ${pin.name} が重複しています`,
        pinIndex: i,
      });
    }
    names.add(pin.name);
  });

  return problems;
}

/**
 * Builds the netlist of a valid design.
 *
 * @throws if the design or a component it uses fails {@link validateDesign}, or if a component
 * contains itself
 */
export function buildNetlist(design: Design, library: Library): Netlist {
  const uf = new UnionFind();
  const relays: {
    c: string;
    in: string;
    out: string;
    defaultOn: boolean;
    path: string;
  }[] = [];
  const ones: string[] = [];
  const stack: string[] = [];
  const topPlacementPins: string[][] = [];

  const face = (prefix: string, x: number, y: number, side: string) =>
    `${prefix}@${x},${y}:${side}`;
  const centre = (prefix: string, x: number, y: number) =>
    `${prefix}@${x},${y}`;

  function flatten(
    d: Design,
    prefix: string,
    borderKey: (pinIndex: number) => string,
  ): void {
    const problems = validateDesign(d, library);
    if (problems.length > 0) {
      throw new Error(
        `${prefix || "top"}: ${problems.map((p) => p.message).join("; ")}`,
      );
    }

    // Touching faces of neighbouring cells.
    for (let y = 0; y < d.height; y++) {
      for (let x = 0; x < d.width; x++) {
        if (x + 1 < d.width) {
          uf.union(face(prefix, x, y, "e"), face(prefix, x + 1, y, "w"));
        }
        if (y + 1 < d.height) {
          uf.union(face(prefix, x, y, "s"), face(prefix, x, y + 1, "n"));
        }
      }
    }

    for (const [key, cell] of Object.entries(d.cells)) {
      const { x, y } = parseCellKey(key);
      if (cell.kind === "wire") {
        for (const side of ["n", "e", "s", "w"] as const) {
          if (cell[side]) {
            uf.union(centre(prefix, x, y), face(prefix, x, y, side));
          }
        }
      } else {
        uf.union(face(prefix, x, y, "n"), face(prefix, x, y, "s"));
        uf.union(face(prefix, x, y, "e"), face(prefix, x, y, "w"));
      }
    }

    d.pins.forEach((pin, i) => {
      const { x, y } = pinCell(d, pin);
      uf.union(borderKey(i), face(prefix, x, y, pin.side));
    });

    d.placements.forEach((placement, pi) => {
      const def = library.get(placement.componentId) as ComponentDef;
      const path = `${prefix}/${pi}`;
      const pinKey = (pinIndex: number) => `${path}#${pinIndex}`;
      for (const wp of worldPins(def, placement)) {
        uf.union(pinKey(wp.index), face(prefix, wp.x, wp.y, wp.side));
      }
      if (prefix === "") {
        topPlacementPins[pi] = def.pins.map((_, i) => pinKey(i));
      }
      if (def.primitive === "one") {
        ones.push(pinKey(0));
        for (let i = 1; i < def.pins.length; i++) {
          uf.union(pinKey(0), pinKey(i));
        }
      } else if (def.primitive !== undefined) {
        relays.push({
          c: pinKey(0),
          in: pinKey(1),
          out: pinKey(2),
          defaultOn: def.primitive === "relay-on",
          path,
        });
      } else if (def.design !== undefined) {
        if (stack.includes(def.id)) {
          throw new Error(`部品 ${def.name} が自分自身を含んでいます`);
        }
        stack.push(def.id);
        flatten(def.design, path, pinKey);
        stack.pop();
      } else {
        throw new Error(`部品 ${def.name} には中身がありません`);
      }
    });
  }

  flatten(design, "", (i) => `#${i}`);

  // Number the nets that matter: anything a relay, a constant, a pin or a top-level cell touches.
  const netIds = new Map<number, number>();
  const net = (key: string): number => {
    const root = uf.find(key);
    let id = netIds.get(root);
    if (id === undefined) {
      id = netIds.size;
      netIds.set(root, id);
    }
    return id;
  };

  const inputs: Record<string, number> = {};
  const outputs: Record<string, number> = {};
  const pinNets = design.pins.map((pin, i) => {
    const n = net(`#${i}`);
    (pin.dir === "in" ? inputs : outputs)[pin.name] = n;
    return n;
  });

  const cellNets: Record<string, number[]> = {};
  for (const [key, cell] of Object.entries(design.cells)) {
    const { x, y } = parseCellKey(key);
    cellNets[key] = cell.kind === "wire"
      ? [net(centre("", x, y))]
      : [net(face("", x, y, "n")), net(face("", x, y, "e"))];
  }

  return {
    relays: relays.map((r) => ({
      c: net(r.c),
      in: net(r.in),
      out: net(r.out),
      defaultOn: r.defaultOn,
      path: r.path,
    })),
    ones: ones.map(net),
    inputs,
    outputs,
    cellNets,
    pinNets,
    placementPinNets: topPlacementPins.map((keys) => keys.map(net)),
    netCount: netIds.size,
  };
}

/** The cell just outside a border pin, for drawing it. */
export function outsideOf(
  d: { width: number; height: number },
  pin: { side: Side; index: number },
): { x: number; y: number } {
  const { x, y } = pinCell(d, pin);
  return { x: x + DELTA[pin.side].dx, y: y + DELTA[pin.side].dy };
}
