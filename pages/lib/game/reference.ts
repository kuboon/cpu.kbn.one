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
import { REGISTER8 } from "./reference-register8.ts";

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

/** The flip-flop and the selector as parts, for the register the next stage needs. */
export const DFF_COMPONENT: ComponentDef = component(
  "dff",
  "D flip-flop 10×6",
  "dff",
  DFF,
);
export const SELECTOR_COMPONENT: ComponentDef = component(
  "sel",
  "Selector 4×3",
  "selector",
  SELECTOR,
);

/**
 * 1-bit register: a selector in front of the flip-flop, which is what the stage's own hint says.
 *
 * The shape is forced by what the next stage does with it. Eight of these go on one board there,
 * in two columns facing a single corridor, so every pin is on one edge — the left column is simply
 * turned round — and every column of this board costs two of the forty-eight there.
 *
 * The selector picks d while st is 1 and the flip-flop's own q while it is 0, so a 0 holds. The
 * obvious cheaper circuit, a D latch gated by st AND NOT clk, does not work: a latch holds through
 * a loop that needs its own output to stay up, and this stage's eighth step drops st and d in the
 * same breath, which settles the loop to 0. Going through the selector keeps the value driven.
 */
export const REGISTER_BIT: Design = design(14, 11)
  .input("clk", "w", 2).input("st", "w", 9).input("d", "w", 4).output(
    "q",
    "w",
    1,
  )
  .place("dff", 7, 1, 3)
  .place("sel", 1, 6, 3)
  .wire(6, 0, "es").wire(7, 0, "ew").wire(8, 0, "ew").wire(9, 0, "ew").wire(
    10,
    0,
    "ew",
  )
  .wire(11, 0, "ew").wire(12, 0, "ew").wire(13, 0, "sw")
  .wire(0, 1, "ew").wire(1, 1, "ew").wire(2, 1, "ew").wire(3, 1, "ew").wire(
    4,
    1,
    "ew",
  )
  .wire(5, 1, "sw").wire(6, 1, "ns").wire(13, 1, "ns")
  .wire(0, 2, "ew").wire(1, 2, "ew").wire(2, 2, "ew").wire(3, 2, "ew").wire(
    4,
    2,
    "ew",
  )
  .cross(5, 2).wire(6, 2, "nw").wire(13, 2, "ns")
  .wire(5, 3, "ns").wire(13, 3, "ns")
  .wire(0, 4, "ew").wire(1, 4, "ew").wire(2, 4, "ew").wire(3, 4, "ew").wire(
    4,
    4,
    "sw",
  )
  .wire(5, 4, "ns").wire(13, 4, "ns")
  .wire(2, 5, "es").wire(3, 5, "ew").cross(4, 5).cross(5, 5).wire(6, 5, "ew")
  .wire(13, 5, "ns")
  .wire(4, 6, "nw").wire(5, 6, "nes").wire(6, 6, "ew").wire(13, 6, "ns")
  .wire(4, 7, "es").wire(5, 7, "nw").wire(13, 7, "ns")
  .wire(0, 8, "es").wire(4, 8, "ns").wire(13, 8, "ns")
  .wire(0, 9, "nw").wire(4, 9, "ns").wire(13, 9, "nw")
  .wire(2, 10, "ne").wire(3, 10, "ew").wire(4, 10, "nw")
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
  "register-bit": REGISTER_BIT,
  register8: REGISTER8,
};

/** Components the composite references need. */
/** The 1-bit register as a part: Register (8-bit) places eight of them. */
export const REGISTER_BIT_COMPONENT: ComponentDef = component(
  "reg",
  "1-bit register 14×11",
  "register-bit",
  REGISTER_BIT,
);

export const REFERENCE_COMPONENTS: readonly ComponentDef[] = [
  XOR_COMPONENT,
  AND_COMPONENT,
  NOT_COMPONENT,
  D_LATCH_COMPONENT,
  DFF_COMPONENT,
  SELECTOR_COMPONENT,
  REGISTER_BIT_COMPONENT,
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
