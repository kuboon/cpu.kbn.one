/**
 * The stages, in play order. Single-bit combinational and sequential stages; the multi-bit,
 * memory and CPU stages follow once bus wires exist.
 */

import type { Bit } from "../model.ts";
import type { Stage } from "./types.ts";
import { sequence, truthTable } from "./types.ts";

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
  {
    id: "sr-latch",
    title: "SR latch",
    description:
      "s を 1 にすると q が 1 になり、s を 0 に戻しても保つ。r を 1 にすると q が 0 になる。出力を自分の入力へ戻すと状態を保てる。",
    inputs: ["s", "r"],
    outputs: ["q"],
    steps: sequence(
      [{ s: 0, r: 0 }, { q: 0 }],
      [{ s: 1 }, { q: 1 }],
      [{ s: 0 }, { q: 1 }],
      [{ r: 1 }, { q: 0 }],
      [{ r: 0 }, { q: 0 }],
      [{ s: 1 }, { q: 1 }],
      [{ s: 0 }, { q: 1 }],
      [{ r: 1 }, { q: 0 }],
      [{ r: 0 }, { q: 0 }],
    ),
    maxSize: SMALL,
  },
  {
    id: "d-latch",
    title: "D latch",
    description:
      "st が 1 の間は q が d に従い、st が 0 になるとその時の値を保つ。",
    inputs: ["d", "st"],
    outputs: ["q"],
    steps: sequence(
      [{ d: 0, st: 0 }, { q: 0 }],
      [{ st: 1 }, { q: 0 }],
      [{ d: 1 }, { q: 1 }],
      [{ d: 0 }, { q: 0 }],
      [{ d: 1 }, { q: 1 }],
      [{ st: 0 }, { q: 1 }],
      [{ d: 0 }, { q: 1 }],
      [{ d: 1 }, { q: 1 }],
      [{ st: 1 }, { q: 1 }],
      [{ d: 0 }, { q: 0 }],
      [{ st: 0 }, { q: 0 }],
      [{ d: 1 }, { q: 0 }],
      [{ st: 1 }, { q: 1 }],
      [{ st: 0 }, { q: 1 }],
    ),
    maxSize: SMALL,
  },
  {
    id: "dff",
    title: "D flip-flop",
    description:
      "clk が 0 から 1 になった瞬間の d を q に取り込み、次の立ち上がりまで保つ。D ラッチを 2 個つなぎ、片方を clk の反転で動かす。",
    inputs: ["d", "clk"],
    outputs: ["q"],
    steps: sequence(
      [{ d: 0, clk: 0 }, { q: 0 }],
      [{ d: 1 }, { q: 0 }],
      [{ clk: 1 }, { q: 1 }],
      [{ d: 0 }, { q: 1 }],
      [{ clk: 0 }, { q: 1 }],
      [{ d: 1 }, { q: 1 }],
      [{ d: 0 }, { q: 1 }],
      [{ clk: 1 }, { q: 0 }],
      [{ d: 1 }, { q: 0 }],
      [{ clk: 0 }, { q: 0 }],
      [{ clk: 1 }, { q: 1 }],
      [{ clk: 0 }, { q: 1 }],
      [{ d: 0 }, { q: 1 }],
      [{ clk: 1 }, { q: 0 }],
    ),
    maxSize: { width: 24, height: 24 },
  },
  {
    id: "register-bit",
    title: "1-bit register",
    description:
      "clk の立ち上がりで、st が 1 なら d を取り込み、0 なら今の値を保つ。フリップフロップの前にセレクタを置く。",
    inputs: ["d", "st", "clk"],
    outputs: ["q"],
    steps: sequence(
      [{ d: 0, st: 0, clk: 0 }, { q: 0 }],
      [{ d: 1 }, { q: 0 }],
      [{ clk: 1 }, { q: 0 }],
      [{ clk: 0 }, { q: 0 }],
      [{ st: 1 }, { q: 0 }],
      [{ clk: 1 }, { q: 1 }],
      [{ clk: 0 }, { q: 1 }],
      [{ st: 0, d: 0 }, { q: 1 }],
      [{ clk: 1 }, { q: 1 }],
      [{ clk: 0 }, { q: 1 }],
      [{ st: 1 }, { q: 1 }],
      [{ clk: 1 }, { q: 0 }],
      [{ clk: 0 }, { q: 0 }],
      [{ d: 1, st: 0 }, { q: 0 }],
      [{ clk: 1 }, { q: 0 }],
    ),
    maxSize: { width: 32, height: 24 },
  },
];

export function findStage(id: string): Stage | undefined {
  return STAGES.find((s) => s.id === id);
}
