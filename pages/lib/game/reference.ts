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

/**
 * SR latch: `s` drives q through a default-off relay; q holds itself through a second default-off
 * relay in series with a default-on relay that `r` opens.
 */
export const SR_LATCH: Design = design(4, 3)
  .input("s", "n", 1).input("r", "s", 2).output("q", "e", 0)
  .place("one", 0, 0).place("relay-off", 1, 0).wire(2, 0, "we").wire(
    3,
    0,
    "wes",
  )
  .wire(1, 1, "es").wire(2, 1, "we").wire(3, 1, "nsw")
  .place("one", 0, 2).place("relay-off", 1, 2).place("relay-on", 2, 2, 2, true)
  .wire(3, 2, "wn")
  .build();

/**
 * D latch: while `st` is 1 a default-off relay passes `d` to q; while it is 0 a default-on relay
 * feeds q back into itself through a loop of wire, so q keeps its value.
 */
export const D_LATCH: Design = design(4, 3)
  .input("d", "s", 3).input("st", "s", 1).output("q", "e", 1)
  .wire(0, 0, "es").wire(1, 0, "we").wire(2, 0, "ws")
  .wire(0, 1, "ne").place("relay-on", 1, 1, 2, true).wire(2, 1, "wne").wire(
    3,
    1,
    "wse",
  )
  .wire(1, 2, "sne").wire(2, 2, "we").place("relay-off", 3, 2, 3)
  .build();

/** Registered forms of the designs above, for building the composite references. */
export const NOT_COMPONENT: ComponentDef = component(
  "not",
  "NOT 2×1",
  "not",
  NOT,
);
export const D_LATCH_COMPONENT: ComponentDef = component(
  "dl",
  "D latch 4×3",
  "d-latch",
  D_LATCH,
);
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

/**
 * D flip-flop, master-slave: the master latch (rotated, right) stores while clk is 0 through a
 * NOT, the slave (left) stores while clk is 1, so q takes the master's value on the rising edge.
 */
export const DFF: Design = design(10, 6)
  .input("d", "n", 5).input("clk", "s", 1).output("q", "n", 4)
  .place("dl", 0, 1).place("dl", 5, 2, 2).place("not", 7, 0, 1)
  .wire(5, 0, "ns").wire(5, 1, "ns")
  .wire(4, 0, "ns").wire(4, 1, "ns").wire(4, 2, "wn")
  .wire(4, 3, "es").wire(4, 4, "nw").wire(3, 4, "en")
  .wire(1, 5, "sne").wire(1, 4, "sn")
  .wire(2, 5, "we").wire(3, 5, "we").wire(4, 5, "we").wire(5, 5, "we").wire(
    6,
    5,
    "we",
  )
  .wire(7, 5, "we").wire(8, 5, "we").wire(9, 5, "wn")
  .wire(9, 4, "ns").wire(9, 3, "ns").wire(9, 2, "ns").wire(9, 1, "sw").wire(
    8,
    1,
    "ew",
  )
  .build();

/** Negative: split the bus and bring the top lane out. */
export const NEG8: Design = design(2, 8)
  .input("a", "w", 0, 8).output("n", "e", 7)
  .place("split", 0, 0).wire(1, 7, "we")
  .build();

export const REFERENCES: Readonly<Record<string, Design>> = {
  not: NOT,
  nand: NAND,
  and: AND,
  or: OR,
  xor: XOR,
  selector: SELECTOR,
  "half-adder": HALF_ADDER,
  "sr-latch": SR_LATCH,
  "d-latch": D_LATCH,
  dff: DFF,
  neg8: NEG8,
};

/** Components the composite references need. */
export const REFERENCE_COMPONENTS: readonly ComponentDef[] = [
  XOR_COMPONENT,
  AND_COMPONENT,
  NOT_COMPONENT,
  D_LATCH_COMPONENT,
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
