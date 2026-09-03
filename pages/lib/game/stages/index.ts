/**
 * The stages, in play order. Single-bit stages only for now; the multi-bit, memory and CPU
 * stages follow once bus wires exist.
 */

import type { Bit } from "../model.ts";
import type { Stage } from "./types.ts";
import { truthTable } from "./types.ts";

export type { Stage } from "./types.ts";

const SMALL = { width: 16, height: 16 };

const bit = (b: boolean): Bit => (b ? 1 : 0);

export const STAGES: readonly Stage[] = [
  {
    id: "not",
    title: "NOT",
    description: "入力を反転する。定数 1 と relay (default on) で作れる。",
    inputs: ["a"],
    outputs: ["out"],
    steps: truthTable(["a"], ({ a }) => ({ out: bit(!a) })),
    maxSize: SMALL,
  },
  {
    id: "nand",
    title: "NAND",
    description:
      "両方が 1 のときだけ 0。relay (default on) を 2 個並列にして出力をつなぐ。",
    inputs: ["a", "b"],
    outputs: ["out"],
    steps: truthTable(["a", "b"], ({ a, b }) => ({ out: bit(!(a && b)) })),
    maxSize: SMALL,
  },
  {
    id: "and",
    title: "AND",
    description: "両方が 1 のときだけ 1。",
    inputs: ["a", "b"],
    outputs: ["out"],
    steps: truthTable(["a", "b"], ({ a, b }) => ({ out: bit(!!(a && b)) })),
    maxSize: SMALL,
  },
  {
    id: "or",
    title: "OR",
    description: "どちらかが 1 なら 1。入力ピン同士を直結すると短絡になる。",
    inputs: ["a", "b"],
    outputs: ["out"],
    steps: truthTable(["a", "b"], ({ a, b }) => ({ out: bit(!!(a || b)) })),
    maxSize: SMALL,
  },
  {
    id: "xor",
    title: "XOR",
    description:
      "片方だけが 1 のとき 1。リレーの in に入力信号そのものを流すと小さく作れる。",
    inputs: ["a", "b"],
    outputs: ["out"],
    steps: truthTable(["a", "b"], ({ a, b }) => ({ out: bit(a !== b) })),
    maxSize: SMALL,
  },
  {
    id: "selector",
    title: "Selector",
    description: "s が 0 なら a を、1 なら b を出力する。",
    inputs: ["s", "a", "b"],
    outputs: ["out"],
    steps: truthTable(["s", "a", "b"], ({ s, a, b }) => ({ out: s ? b : a })),
    maxSize: SMALL,
  },
  {
    id: "switch",
    title: "Switch",
    description: "s が 0 なら in を a に、1 なら b に流す。流れない側は 0。",
    inputs: ["s", "in"],
    outputs: ["a", "b"],
    steps: truthTable(
      ["s", "in"],
      ({ s, in: v }) => ({ a: s ? 0 : v, b: s ? v : 0 }),
    ),
    maxSize: SMALL,
  },
  {
    id: "half-adder",
    title: "Half adder",
    description: "1 ビット同士を足す。s が和、c が桁上がり。",
    inputs: ["a", "b"],
    outputs: ["s", "c"],
    steps: truthTable(
      ["a", "b"],
      ({ a, b }) => ({ s: bit(a !== b), c: bit(!!(a && b)) }),
    ),
    maxSize: SMALL,
  },
  {
    id: "full-adder",
    title: "Full adder",
    description: "下の桁からの桁上がり ci も含めて足す。",
    inputs: ["a", "b", "ci"],
    outputs: ["s", "co"],
    steps: truthTable(["a", "b", "ci"], ({ a, b, ci }) => {
      const sum = a + b + ci;
      return { s: (sum & 1) as Bit, co: bit(sum >= 2) };
    }),
    maxSize: { width: 24, height: 24 },
  },
];

export function findStage(id: string): Stage | undefined {
  return STAGES.find((s) => s.id === id);
}
