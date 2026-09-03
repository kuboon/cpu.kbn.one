/**
 * A terse way to write a design by hand, for reference solutions and tests.
 */

import type { BorderPin, Design, Rotation, Side, WireCell } from "./model.ts";
import { cellKey } from "./model.ts";

export class DesignBuilder {
  #design: Design;

  constructor(width: number, height: number) {
    this.#design = { width, height, cells: {}, placements: [], pins: [] };
  }

  pin(
    name: string,
    dir: BorderPin["dir"],
    side: Side,
    index: number,
    width = 1,
  ): this {
    this.#design.pins.push({
      name,
      dir,
      side,
      index,
      ...(width === 1 ? {} : { width }),
    });
    return this;
  }

  input(name: string, side: Side, index: number, width = 1): this {
    return this.pin(name, "in", side, index, width);
  }

  output(name: string, side: Side, index: number, width = 1): this {
    return this.pin(name, "out", side, index, width);
  }

  /** @param sides Any of the letters n, e, s, w; a capital B makes it a bus */
  wire(x: number, y: number, sides: string): this {
    const cell: WireCell = {
      kind: "wire",
      n: sides.includes("n"),
      e: sides.includes("e"),
      s: sides.includes("s"),
      w: sides.includes("w"),
      ...(sides.includes("B") ? { bus: true } : {}),
    };
    this.#design.cells[cellKey(x, y)] = cell;
    return this;
  }

  cross(x: number, y: number): this {
    this.#design.cells[cellKey(x, y)] = { kind: "cross" };
    return this;
  }

  place(
    componentId: string,
    x: number,
    y: number,
    rotation: Rotation = 0,
    mirror = false,
  ): this {
    this.#design.placements.push({ componentId, x, y, rotation, mirror });
    return this;
  }

  build(): Design {
    return this.#design;
  }
}

export function design(width: number, height: number): DesignBuilder {
  return new DesignBuilder(width, height);
}
