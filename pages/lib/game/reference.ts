/**
 * Reference solutions: one design per stage, built by hand.
 *
 * They set each stage's par (the area to beat) and double as the engine's regression tests.
 * A relay is 1x1 with `c` north, `in` west and `out` east; "vflip" below means mirror + 180°,
 * which puts `c` south and keeps `in` west.
 */

import type { ComponentDef, Design } from "./model.ts";
import { area } from "./model.ts";
import { design } from "./builder.ts";

/** NOT: a source feeding a default-on relay. */
export const NOT: Design = design(2, 1)
  .input("a", "n", 1).output("out", "e", 0)
  .place("one", 0, 0)
  .place("relay-on", 1, 0)
  .build();

/** NAND: two default-on relays in parallel, outputs wired together. */
export const NAND: Design = design(3, 2)
  .input("a", "n", 1).input("b", "s", 1).output("out", "e", 0)
  .place("one", 0, 0).place("relay-on", 1, 0).wire(2, 0, "wse")
  .place("one", 0, 1).place("relay-on", 1, 1, 2, true).wire(2, 1, "wn")
  .build();

/** AND: two default-off relays in series. */
export const AND: Design = design(3, 1)
  .input("a", "n", 1).input("b", "n", 2).output("out", "e", 0)
  .place("one", 0, 0).place("relay-off", 1, 0).place("relay-off", 2, 0)
  .build();

/** OR: two default-off relays in parallel. */
export const OR: Design = design(3, 2)
  .input("a", "n", 1).input("b", "s", 1).output("out", "e", 0)
  .place("one", 0, 0).place("relay-off", 1, 0).wire(2, 0, "wse")
  .place("one", 0, 1).place("relay-off", 1, 1, 2, true).wire(2, 1, "wn")
  .build();

/**
 * XOR with two relays and no source: `b` through a default-on relay controlled by `a`, in
 * parallel with `a` through a default-on relay controlled by `b`. Each input is used twice, so a
 * crossing distributes them.
 */
export const XOR: Design = design(4, 3)
  .input("a", "w", 1).input("b", "n", 1).output("out", "e", 0)
  .wire(1, 0, "nse").place("relay-on", 2, 0, 2, true).wire(3, 0, "wse")
  .wire(0, 1, "wes").cross(1, 1).wire(2, 1, "wn").wire(3, 1, "ns")
  .wire(0, 2, "ne").place("relay-on", 1, 2).wire(2, 2, "we").wire(3, 2, "wn")
  .build();

/** Selector: `a` through a default-on relay and `b` through a default-off one, both controlled by `s`. */
export const SELECTOR: Design = design(4, 3)
  .input("s", "n", 1).input("a", "w", 1).input("b", "s", 3).output(
    "out",
    "e",
    1,
  )
  .wire(0, 0, "es").wire(1, 0, "nwe").wire(2, 0, "ws")
  .cross(0, 1).wire(1, 1, "we").place("relay-on", 2, 1).wire(3, 1, "wse")
  .wire(0, 2, "ne").wire(1, 2, "we").wire(2, 2, "we").place(
    "relay-off",
    3,
    2,
    3,
  )
  .build();

/** Registered forms of the gates above, for building the composite references. */
export const XOR_COMPONENT: ComponentDef = component(
  "xor",
  "XOR 4×3",
  "xor",
  XOR,
);
export const AND_COMPONENT: ComponentDef = component(
  "and",
  "AND 3×1",
  "and",
  AND,
);

/**
 * Half adder from the registered XOR (rotated) and AND (rotated the other way). Both inputs are
 * needed by both parts, so a row of wires and a crossing fan them out.
 */
export const HALF_ADDER: Design = design(6, 5)
  .input("a", "w", 0).input("b", "n", 4).output("s", "s", 2).output("c", "n", 5)
  .wire(0, 0, "we").wire(1, 0, "wse").wire(2, 0, "we").wire(3, 0, "ws").wire(
    4,
    0,
    "nes",
  )
  .place("xor", 0, 1, 1).wire(3, 1, "ne").cross(4, 1).place("and", 5, 0, 3)
  .wire(3, 2, "we").wire(4, 2, "nw")
  .build();

export const REFERENCES: Readonly<Record<string, Design>> = {
  not: NOT,
  nand: NAND,
  and: AND,
  or: OR,
  xor: XOR,
  selector: SELECTOR,
  "half-adder": HALF_ADDER,
};

/** Components the composite references need. */
export const REFERENCE_COMPONENTS: readonly ComponentDef[] = [
  XOR_COMPONENT,
  AND_COMPONENT,
];

/** The area to beat, where a reference exists. */
export function par(stageId: string): number | undefined {
  const d = REFERENCES[stageId];
  return d === undefined ? undefined : area(d);
}

function component(
  id: string,
  name: string,
  stageId: string,
  d: Design,
): ComponentDef {
  return {
    id,
    name,
    stageId,
    width: d.width,
    height: d.height,
    pins: d.pins,
    design: d,
    createdAt: "",
  };
}
