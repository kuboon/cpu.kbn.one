/**
 * From a board to a flat netlist of relays.
 *
 * Every cell face (a side of a cell) is a node in a union-find, once per lane: a single wire uses
 * lane 0, a bus uses all {@link BUS_WIDTH} lanes. A wire cell joins the faces it connects to; a
 * crossing joins north to south and east to west; touching faces of neighbouring cells are always
 * joined. A placed component's pins attach to the faces they sit on, and a registered component is
 * expanded in place by recursing into its design, so the result contains only relays and constants.
 */

import type { ComponentDef, Design, Library, Side } from "./model.ts";
import { BUS_WIDTH, cellKey, parseCellKey, pinWidth } from "./model.ts";
import {
  DELTA,
  footprint,
  occupiedCells,
  OPPOSITE,
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
  /** Pin name -> one net per lane. */
  inputs: Record<string, number[]>;
  outputs: Record<string, number[]>;
  /** Top-level cell -> lanes it carries: one list for a wire, two for a crossing (north-south, east-west). */
  cellNets: Record<string, number[][]>;
  /** Top-level border pin index -> lanes. */
  pinNets: number[][];
  /** Top-level placement index -> pin index -> lanes. */
  placementPinNets: number[][][];
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

const SIDES = ["n", "e", "s", "w"] as const;

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

  problems.push(...widthProblems(design, library));
  return problems;
}

/** Faces where a single wire meets a bus (or a pin of the other width). */
function widthProblems(design: Design, library: Library): Problem[] {
  // face key -> the widths declared on it, with the cell each came from
  const declared = new Map<string, { width: number; x: number; y: number }[]>();
  const declare = (x: number, y: number, side: Side, width: number) => {
    const key = `${x},${y}:${side}`;
    const list = declared.get(key) ?? [];
    list.push({ width, x, y });
    declared.set(key, list);
  };

  for (const [key, cell] of Object.entries(design.cells)) {
    const { x, y } = parseCellKey(key);
    if (cell.kind === "wire") {
      const width = cell.bus ? BUS_WIDTH : 1;
      for (const side of SIDES) if (cell[side]) declare(x, y, side, width);
    } else {
      declare(x, y, "n", cell.busNS ? BUS_WIDTH : 1);
      declare(x, y, "s", cell.busNS ? BUS_WIDTH : 1);
      declare(x, y, "e", cell.busEW ? BUS_WIDTH : 1);
      declare(x, y, "w", cell.busEW ? BUS_WIDTH : 1);
    }
  }
  for (const placement of design.placements) {
    const def = library.get(placement.componentId);
    if (def === undefined) continue;
    for (const wp of worldPins(def, placement)) {
      declare(wp.x, wp.y, wp.side, pinWidth(wp.pin));
    }
  }
  for (const pin of design.pins) {
    const { x, y } = pinCell(design, pin);
    declare(x, y, pin.side, pinWidth(pin));
  }

  const problems: Problem[] = [];
  const seen = new Set<string>();
  const report = (cells: { x: number; y: number }[]) => {
    const id = cells.map((c) => cellKey(c.x, c.y)).sort().join(";");
    if (seen.has(id)) return;
    seen.add(id);
    problems.push({ message: "配線の幅が合いません（1 本とバス）", cells });
  };

  for (const [key, list] of declared) {
    if (new Set(list.map((d) => d.width)).size > 1) report(list);
    const [cell, side] = key.split(":") as [string, Side];
    const { x, y } = parseCellKey(cell);
    const nx = x + DELTA[side].dx;
    const ny = y + DELTA[side].dy;
    const facing = declared.get(`${nx},${ny}:${OPPOSITE[side]}`);
    if (facing === undefined) continue;
    if (list.some((a) => facing.some((b) => a.width !== b.width))) {
      report([{ x, y }, { x: nx, y: ny }]);
    }
  }
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
  const topPlacementPins: string[][][] = [];

  const face = (
    prefix: string,
    x: number,
    y: number,
    side: string,
    lane: number,
  ) => `${prefix}@${x},${y}:${side}|${lane}`;
  const centre = (prefix: string, x: number, y: number, lane: number) =>
    `${prefix}@${x},${y}|${lane}`;

  function flatten(
    d: Design,
    prefix: string,
    borderKey: (pinIndex: number, lane: number) => string,
  ): void {
    const problems = validateDesign(d, library);
    if (problems.length > 0) {
      throw new Error(
        `${prefix || "top"}: ${problems.map((p) => p.message).join("; ")}`,
      );
    }

    // Touching faces of neighbouring cells, on every lane.
    for (let y = 0; y < d.height; y++) {
      for (let x = 0; x < d.width; x++) {
        for (let lane = 0; lane < BUS_WIDTH; lane++) {
          if (x + 1 < d.width) {
            uf.union(
              face(prefix, x, y, "e", lane),
              face(prefix, x + 1, y, "w", lane),
            );
          }
          if (y + 1 < d.height) {
            uf.union(
              face(prefix, x, y, "s", lane),
              face(prefix, x, y + 1, "n", lane),
            );
          }
        }
      }
    }

    for (const [key, cell] of Object.entries(d.cells)) {
      const { x, y } = parseCellKey(key);
      if (cell.kind === "wire") {
        const width = cell.bus ? BUS_WIDTH : 1;
        for (const side of SIDES) {
          if (!cell[side]) continue;
          for (let lane = 0; lane < width; lane++) {
            uf.union(
              centre(prefix, x, y, lane),
              face(prefix, x, y, side, lane),
            );
          }
        }
      } else {
        for (let lane = 0; lane < (cell.busNS ? BUS_WIDTH : 1); lane++) {
          uf.union(
            face(prefix, x, y, "n", lane),
            face(prefix, x, y, "s", lane),
          );
        }
        for (let lane = 0; lane < (cell.busEW ? BUS_WIDTH : 1); lane++) {
          uf.union(
            face(prefix, x, y, "e", lane),
            face(prefix, x, y, "w", lane),
          );
        }
      }
    }

    d.pins.forEach((pin, i) => {
      const { x, y } = pinCell(d, pin);
      for (let lane = 0; lane < pinWidth(pin); lane++) {
        uf.union(borderKey(i, lane), face(prefix, x, y, pin.side, lane));
      }
    });

    d.placements.forEach((placement, pi) => {
      const def = library.get(placement.componentId) as ComponentDef;
      const path = `${prefix}/${pi}`;
      const pinKey = (pinIndex: number, lane: number) =>
        `${path}#${pinIndex}|${lane}`;
      for (const wp of worldPins(def, placement)) {
        for (let lane = 0; lane < pinWidth(wp.pin); lane++) {
          uf.union(
            pinKey(wp.index, lane),
            face(prefix, wp.x, wp.y, wp.side, lane),
          );
        }
      }
      if (prefix === "") {
        topPlacementPins[pi] = def.pins.map((pin, i) =>
          Array.from({ length: pinWidth(pin) }, (_, lane) => pinKey(i, lane))
        );
      }
      switch (def.primitive) {
        case "one":
          ones.push(pinKey(0, 0));
          for (let i = 1; i < def.pins.length; i++) {
            uf.union(pinKey(0, 0), pinKey(i, 0));
          }
          break;
        case "relay-on":
        case "relay-off":
          relays.push({
            c: pinKey(0, 0),
            in: pinKey(1, 0),
            out: pinKey(2, 0),
            defaultOn: def.primitive === "relay-on",
            path,
          });
          break;
        case "split":
          for (let lane = 0; lane < BUS_WIDTH; lane++) {
            uf.union(pinKey(0, lane), pinKey(1 + lane, 0));
          }
          break;
        default:
          if (def.design === undefined) {
            throw new Error(`部品 ${def.name} には中身がありません`);
          }
          if (stack.includes(def.id)) {
            throw new Error(`部品 ${def.name} が自分自身を含んでいます`);
          }
          stack.push(def.id);
          flatten(def.design, path, pinKey);
          stack.pop();
      }
    });
  }

  flatten(design, "", (i, lane) => `#${i}|${lane}`);

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
  const lanesOf = (width: number, key: (lane: number) => string) =>
    Array.from({ length: width }, (_, lane) => net(key(lane)));

  const inputs: Record<string, number[]> = {};
  const outputs: Record<string, number[]> = {};
  const pinNets = design.pins.map((pin, i) => {
    const lanes = lanesOf(pinWidth(pin), (lane) => `#${i}|${lane}`);
    (pin.dir === "in" ? inputs : outputs)[pin.name] = lanes;
    return lanes;
  });

  const cellNets: Record<string, number[][]> = {};
  for (const [key, cell] of Object.entries(design.cells)) {
    const { x, y } = parseCellKey(key);
    cellNets[key] = cell.kind === "wire"
      ? [lanesOf(cell.bus ? BUS_WIDTH : 1, (lane) => centre("", x, y, lane))]
      : [
        lanesOf(
          cell.busNS ? BUS_WIDTH : 1,
          (lane) => face("", x, y, "n", lane),
        ),
        lanesOf(
          cell.busEW ? BUS_WIDTH : 1,
          (lane) => face("", x, y, "e", lane),
        ),
      ];
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
    placementPinNets: topPlacementPins.map((pins) =>
      pins.map((keys) => keys.map(net))
    ),
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
