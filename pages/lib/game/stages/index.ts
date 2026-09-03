/**
 * The stages, in play order: single-bit gates and arithmetic, single-bit sequential parts, then
 * the 8-bit stages built with bus wires. The ALU, memory and CPU stages come next.
 */

import type { Bit } from "../model.ts";
import type { Stage } from "./types.ts";
import { bus, pins, sequence, truthTable, vectors } from "./types.ts";
import {
  decode,
  harness,
  PROGRAM_LOOP,
  PROGRAM_MEMORY,
  PROGRAM_SUM,
} from "../cpu.ts";

export type { PinSpec, Stage } from "./types.ts";

const SMALL = { width: 16, height: 16 };

const bit = (b: boolean): Bit => (b ? 1 : 0);

export const STAGES: readonly Stage[] = [
  {
    id: "not",
    title: "NOT",
    description: "入力を反転する。定数 1 と relay (default on) で作れる。",
    inputs: pins("a"),
    outputs: pins("out"),
    steps: truthTable(["a"], ({ a }) => ({ out: bit(!a) })),
    maxSize: SMALL,
  },
  {
    id: "nand",
    title: "NAND",
    description:
      "両方が 1 のときだけ 0。relay (default on) を 2 個並列にして出力をつなぐ。",
    inputs: pins("a", "b"),
    outputs: pins("out"),
    steps: truthTable(["a", "b"], ({ a, b }) => ({ out: bit(!(a && b)) })),
    maxSize: SMALL,
  },
  {
    id: "and",
    title: "AND",
    description: "両方が 1 のときだけ 1。",
    inputs: pins("a", "b"),
    outputs: pins("out"),
    steps: truthTable(["a", "b"], ({ a, b }) => ({ out: bit(!!(a && b)) })),
    maxSize: SMALL,
  },
  {
    id: "or",
    title: "OR",
    description: "どちらかが 1 なら 1。入力ピン同士を直結すると短絡になる。",
    inputs: pins("a", "b"),
    outputs: pins("out"),
    steps: truthTable(["a", "b"], ({ a, b }) => ({ out: bit(!!(a || b)) })),
    maxSize: SMALL,
  },
  {
    id: "xor",
    title: "XOR",
    description:
      "片方だけが 1 のとき 1。リレーの in に入力信号そのものを流すと小さく作れる。",
    inputs: pins("a", "b"),
    outputs: pins("out"),
    steps: truthTable(["a", "b"], ({ a, b }) => ({ out: bit(a !== b) })),
    maxSize: SMALL,
  },
  {
    id: "selector",
    title: "Selector",
    description: "s が 0 なら a を、1 なら b を出力する。",
    inputs: pins("s", "a", "b"),
    outputs: pins("out"),
    steps: truthTable(["s", "a", "b"], ({ s, a, b }) => ({ out: s ? b : a })),
    maxSize: SMALL,
  },
  {
    id: "switch",
    title: "Switch",
    description: "s が 0 なら in を a に、1 なら b に流す。流れない側は 0。",
    inputs: pins("s", "in"),
    outputs: pins("a", "b"),
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
    inputs: pins("a", "b"),
    outputs: pins("s", "c"),
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
    inputs: pins("a", "b", "ci"),
    outputs: pins("s", "co"),
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
    inputs: pins("s", "r"),
    outputs: pins("q"),
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
    inputs: pins("d", "st"),
    outputs: pins("q"),
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
    inputs: pins("d", "clk"),
    outputs: pins("q"),
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
    inputs: pins("d", "st", "clk"),
    outputs: pins("q"),
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
  {
    id: "neg8",
    title: "Negative (8-bit)",
    description:
      "8 ビットの a を 2 の補数と見て、負なら n を 1 にする。バスを Bus split でばらすと、最上位ビットが取り出せる。",
    inputs: [bus("a")],
    outputs: pins("n"),
    steps: vectors(({ a }) => ({ n: a >= 128 ? 1 : 0 }), [
      { a: 0 },
      { a: 1 },
      { a: 127 },
      { a: 128 },
      { a: 200 },
      { a: 255 },
    ]),
    maxSize: { width: 16, height: 16 },
  },
  {
    id: "zero8",
    title: "Zero (8-bit)",
    description: "8 ビットの a がすべて 0 なら z を 1 にする。",
    inputs: [bus("a")],
    outputs: pins("z"),
    steps: vectors(({ a }) => ({ z: a === 0 ? 1 : 0 }), [
      { a: 0 },
      { a: 1 },
      { a: 2 },
      { a: 128 },
      { a: 85 },
      { a: 255 },
      { a: 0 },
    ]),
    maxSize: { width: 24, height: 24 },
  },
  {
    id: "selector8",
    title: "Selector (8-bit)",
    description:
      "s が 0 なら a を、1 なら b を出力する。8 本まとめて切り替える。",
    inputs: [{ name: "s", width: 1 }, bus("a"), bus("b")],
    outputs: [bus("out")],
    steps: vectors(({ s, a, b }) => ({ out: s ? b : a }), [
      { s: 0, a: 0, b: 255 },
      { s: 1, a: 0, b: 255 },
      { s: 0, a: 170, b: 85 },
      { s: 1, a: 170, b: 85 },
      { s: 0, a: 1, b: 2 },
      { s: 1, a: 1, b: 2 },
    ]),
    maxSize: { width: 32, height: 32 },
  },
  {
    id: "add8",
    title: "Adder (8-bit)",
    description:
      "8 ビットの a と b と桁上がり入力 ci を足す。s が和の下 8 ビット、co が桁上がり。全加算器を 8 個つなぐ。",
    inputs: [bus("a"), bus("b"), { name: "ci", width: 1 }],
    outputs: [bus("s"), { name: "co", width: 1 }],
    steps: vectors(
      ({ a, b, ci }) => ({
        s: (a + b + ci) & 255,
        co: a + b + ci > 255 ? 1 : 0,
      }),
      [
        { a: 0, b: 0, ci: 0 },
        { a: 0, b: 0, ci: 1 },
        { a: 1, b: 1, ci: 0 },
        { a: 255, b: 1, ci: 0 },
        { a: 255, b: 255, ci: 1 },
        { a: 85, b: 170, ci: 0 },
        { a: 15, b: 1, ci: 0 },
        { a: 127, b: 1, ci: 0 },
        { a: 200, b: 100, ci: 0 },
        { a: 37, b: 91, ci: 1 },
      ],
    ),
    maxSize: { width: 48, height: 48 },
  },
  {
    id: "inc8",
    title: "Increment (8-bit)",
    description: "a に 1 を足す。255 の次は 0。",
    inputs: [bus("a")],
    outputs: [bus("out")],
    steps: vectors(({ a }) => ({ out: (a + 1) & 255 }), [
      { a: 0 },
      { a: 1 },
      { a: 15 },
      { a: 127 },
      { a: 254 },
      { a: 255 },
    ]),
    maxSize: { width: 48, height: 48 },
  },
  {
    id: "sub8",
    title: "Subtract (8-bit)",
    description:
      "a から b を引く。結果は 2 の補数の 8 ビット。b を反転して 1 を足したものを加える。",
    inputs: [bus("a"), bus("b")],
    outputs: [bus("out")],
    steps: vectors(({ a, b }) => ({ out: (a - b) & 255 }), [
      { a: 0, b: 0 },
      { a: 5, b: 3 },
      { a: 3, b: 5 },
      { a: 255, b: 255 },
      { a: 0, b: 1 },
      { a: 128, b: 1 },
      { a: 200, b: 100 },
    ]),
    maxSize: { width: 48, height: 48 },
  },
  {
    id: "register8",
    title: "Register (8-bit)",
    description:
      "clk の立ち上がりで、st が 1 なら d を取り込み、0 なら保つ。1 ビットレジスタを 8 個並べる。",
    inputs: [bus("d"), { name: "st", width: 1 }, { name: "clk", width: 1 }],
    outputs: [bus("q")],
    steps: sequence(
      [{ d: 0, st: 0, clk: 0 }, { q: 0 }],
      [{ d: 170 }, { q: 0 }],
      [{ clk: 1 }, { q: 0 }],
      [{ clk: 0 }, { q: 0 }],
      [{ st: 1 }, { q: 0 }],
      [{ clk: 1 }, { q: 170 }],
      [{ clk: 0 }, { q: 170 }],
      [{ d: 85, st: 0 }, { q: 170 }],
      [{ clk: 1 }, { q: 170 }],
      [{ clk: 0 }, { q: 170 }],
      [{ st: 1 }, { q: 170 }],
      [{ clk: 1 }, { q: 85 }],
      [{ clk: 0, d: 255 }, { q: 85 }],
      [{ clk: 1 }, { q: 255 }],
    ),
    maxSize: { width: 48, height: 48 },
  },
  {
    id: "counter8",
    title: "Counter (8-bit)",
    description:
      "clk の立ち上がりごとに 1 増える。st が 1 の立ち上がりでは代わりに in を取り込む。レジスタとインクリメントとセレクタで作る。",
    inputs: [bus("in"), { name: "st", width: 1 }, { name: "clk", width: 1 }],
    outputs: [bus("out")],
    steps: sequence(
      [{ in: 0, st: 1, clk: 0 }, { out: 0 }],
      [{ clk: 1 }, { out: 0 }],
      [{ clk: 0, st: 0 }, { out: 0 }],
      [{ clk: 1 }, { out: 1 }],
      [{ clk: 0 }, { out: 1 }],
      [{ clk: 1 }, { out: 2 }],
      [{ clk: 0 }, { out: 2 }],
      [{ clk: 1 }, { out: 3 }],
      [{ clk: 0, in: 254, st: 1 }, { out: 3 }],
      [{ clk: 1 }, { out: 254 }],
      [{ clk: 0, st: 0 }, { out: 254 }],
      [{ clk: 1 }, { out: 255 }],
      [{ clk: 0 }, { out: 255 }],
      [{ clk: 1 }, { out: 0 }],
    ),
    maxSize: { width: 64, height: 64 },
  },
  {
    id: "logic8",
    title: "Logic unit (8-bit)",
    description:
      "op1 op0 で演算を選ぶ。00: x AND y、01: x OR y、10: x XOR y、11: NOT x。ビットごとに同じ回路を 8 個並べ、セレクタで選ぶ。",
    inputs: [bus("x"), bus("y"), { name: "op1", width: 1 }, {
      name: "op0",
      width: 1,
    }],
    outputs: [bus("out")],
    steps: vectors(
      ({ x, y, op1, op0 }) => ({ out: logic(x, y, op1 * 2 + op0) }),
      [
        { x: 0b11001100, y: 0b10101010, op1: 0, op0: 0 },
        { x: 0b11001100, y: 0b10101010, op1: 0, op0: 1 },
        { x: 0b11001100, y: 0b10101010, op1: 1, op0: 0 },
        { x: 0b11001100, y: 0b10101010, op1: 1, op0: 1 },
        { x: 0, y: 255, op1: 0, op0: 0 },
        { x: 0, y: 255, op1: 0, op0: 1 },
        { x: 0, y: 255, op1: 1, op0: 0 },
        { x: 0, y: 255, op1: 1, op0: 1 },
        { x: 15, y: 15, op1: 1, op0: 0 },
      ],
    ),
    maxSize: { width: 64, height: 64 },
  },
  {
    id: "arith8",
    title: "Arithmetic unit (8-bit)",
    description:
      "op1 op0 で演算を選ぶ。00: x + y、01: x + 1、10: x - y、11: x - 1。結果は下 8 ビット。加算器 1 個に、y の反転と定数の切り替えを前置して作れる。",
    inputs: [bus("x"), bus("y"), { name: "op1", width: 1 }, {
      name: "op0",
      width: 1,
    }],
    outputs: [bus("out")],
    steps: vectors(
      ({ x, y, op1, op0 }) => ({ out: arith(x, y, op1 * 2 + op0) }),
      [
        { x: 5, y: 3, op1: 0, op0: 0 },
        { x: 5, y: 3, op1: 0, op0: 1 },
        { x: 5, y: 3, op1: 1, op0: 0 },
        { x: 5, y: 3, op1: 1, op0: 1 },
        { x: 255, y: 1, op1: 0, op0: 0 },
        { x: 255, y: 0, op1: 0, op0: 1 },
        { x: 0, y: 1, op1: 1, op0: 0 },
        { x: 0, y: 0, op1: 1, op0: 1 },
        { x: 200, y: 100, op1: 0, op0: 0 },
        { x: 100, y: 200, op1: 1, op0: 0 },
      ],
    ),
    maxSize: { width: 64, height: 64 },
  },
  {
    id: "alu8",
    title: "ALU (8-bit)",
    description:
      "u が 0 なら算術ユニット、1 なら論理ユニットの結果を出す。zx が 1 なら x を 0 に置き換え、sw が 1 なら x と y を入れ替えてから渡す。",
    inputs: [
      bus("x"),
      bus("y"),
      { name: "u", width: 1 },
      { name: "op1", width: 1 },
      { name: "op0", width: 1 },
      { name: "zx", width: 1 },
      { name: "sw", width: 1 },
    ],
    outputs: [bus("out")],
    steps: vectors(
      ({ x, y, u, op1, op0, zx, sw }) => ({
        out: alu(x, y, u, op1 * 2 + op0, zx, sw),
      }),
      [
        { x: 5, y: 3, u: 0, op1: 0, op0: 0, zx: 0, sw: 0 },
        { x: 5, y: 3, u: 0, op1: 1, op0: 0, zx: 0, sw: 0 },
        { x: 5, y: 3, u: 0, op1: 1, op0: 0, zx: 0, sw: 1 },
        { x: 5, y: 3, u: 0, op1: 0, op0: 1, zx: 1, sw: 0 },
        { x: 5, y: 3, u: 0, op1: 1, op0: 0, zx: 1, sw: 0 },
        { x: 0b11001100, y: 0b10101010, u: 1, op1: 0, op0: 0, zx: 0, sw: 0 },
        { x: 0b11001100, y: 0b10101010, u: 1, op1: 1, op0: 1, zx: 0, sw: 0 },
        { x: 0b11001100, y: 0b10101010, u: 1, op1: 1, op0: 1, zx: 0, sw: 1 },
        { x: 0b11001100, y: 0b10101010, u: 1, op1: 1, op0: 1, zx: 1, sw: 0 },
        { x: 0b11001100, y: 0b10101010, u: 1, op1: 0, op0: 1, zx: 1, sw: 1 },
        { x: 255, y: 1, u: 0, op1: 0, op0: 0, zx: 0, sw: 0 },
      ],
    ),
    maxSize: { width: 64, height: 64 },
  },
  {
    id: "cond8",
    title: "Condition (8-bit)",
    description:
      "x を 2 の補数と見て、負なら lt、ゼロなら eq、正なら gt を見る。該当する条件が 1 なら out を 1 にする。",
    inputs: [bus("x"), { name: "lt", width: 1 }, { name: "eq", width: 1 }, {
      name: "gt",
      width: 1,
    }],
    outputs: pins("out"),
    steps: vectors(({ x, lt, eq, gt }) => ({ out: cond(x, lt, eq, gt) }), [
      { x: 0, lt: 0, eq: 0, gt: 0 },
      { x: 0, lt: 0, eq: 1, gt: 0 },
      { x: 0, lt: 1, eq: 0, gt: 1 },
      { x: 5, lt: 0, eq: 0, gt: 1 },
      { x: 5, lt: 1, eq: 1, gt: 0 },
      { x: 200, lt: 1, eq: 0, gt: 0 },
      { x: 200, lt: 0, eq: 1, gt: 1 },
      { x: 128, lt: 1, eq: 0, gt: 0 },
      { x: 127, lt: 0, eq: 0, gt: 1 },
      { x: 255, lt: 1, eq: 1, gt: 1 },
    ]),
    maxSize: { width: 32, height: 32 },
  },
  {
    id: "ram4",
    title: "RAM (4 words)",
    description:
      "a1 a0 で選んだ番地に、clk の立ち上がりで st が 1 なら in を書き、out にはいつも選んだ番地の値を出す。レジスタ 4 個とセレクタで作る。",
    inputs: [bus("in"), { name: "a1", width: 1 }, { name: "a0", width: 1 }, {
      name: "st",
      width: 1,
    }, {
      name: "clk",
      width: 1,
    }],
    outputs: [bus("out")],
    steps: sequence(
      [{ in: 11, a1: 0, a0: 0, st: 1, clk: 0 }, { out: 0 }],
      [{ clk: 1 }, { out: 11 }],
      [{ clk: 0, a1: 0, a0: 1, in: 22 }, { out: 0 }],
      [{ clk: 1 }, { out: 22 }],
      [{ clk: 0, a1: 1, a0: 0, in: 33 }, { out: 0 }],
      [{ clk: 1 }, { out: 33 }],
      [{ clk: 0, a1: 1, a0: 1, in: 44 }, { out: 0 }],
      [{ clk: 1 }, { out: 44 }],
      [{ clk: 0, st: 0, a1: 0, a0: 0, in: 99 }, { out: 11 }],
      [{ clk: 1 }, { out: 11 }],
      [{ clk: 0, a1: 0, a0: 1 }, { out: 22 }],
      [{ a1: 1, a0: 0 }, { out: 33 }],
      [{ a1: 1, a0: 1 }, { out: 44 }],
      [{ st: 1, in: 55 }, { out: 44 }],
      [{ clk: 1 }, { out: 55 }],
      [{ clk: 0, a1: 0, a0: 0 }, { out: 11 }],
    ),
    maxSize: { width: 96, height: 96 },
  },
  {
    id: "control8",
    title: "Control unit",
    description:
      "命令 i を読んで制御線を出す。ldi は即値、wa と wd は A と D への書き込み、w はメモリ書き込み、jmp は分岐、halt は停止。命令の形式は企画書の 11 章。",
    inputs: [bus("i")],
    outputs: pins("ldi", "wa", "wd", "w", "jmp", "halt"),
    steps: vectors(({ i }) => ({ ...decode(i) }), [
      { i: 0b00000000 },
      { i: 0b01111111 },
      { i: 0b10000000 },
      { i: 0b10000001 },
      { i: 0b10111110 },
      { i: 0b10111111 },
      { i: 0b11000000 },
      { i: 0b11011111 },
      { i: 0b11100000 },
      { i: 0b11101111 },
      { i: 0b11110000 },
      { i: 0b11111111 },
    ]),
    maxSize: { width: 32, height: 32 },
  },
  {
    id: "cpu8",
    title: "CPU",
    description:
      "命令 i とメモリの値 m を受け取り、pc と addr（A レジスタ）、メモリ書き込み w とその値 data を出す。レジスタ A、D、PC と ALU、条件判定、制御ユニットで作る。3 本のプログラムがそのまま動けば合格。",
    inputs: [bus("i"), bus("m"), { name: "clk", width: 1 }],
    outputs: [bus("pc"), bus("addr"), { name: "w", width: 1 }, bus("data")],
    steps: [
      ...harness(PROGRAM_SUM),
      ...harness(PROGRAM_LOOP),
      ...harness(PROGRAM_MEMORY, { 3: 42 }),
    ],
    maxSize: { width: 128, height: 128 },
  },
];

/** The logic unit's function table. */
export function logic(x: number, y: number, op: number): number {
  switch (op) {
    case 0:
      return x & y;
    case 1:
      return x | y;
    case 2:
      return x ^ y;
    default:
      return ~x & 255;
  }
}

/** The arithmetic unit's function table, modulo 256. */
export function arith(x: number, y: number, op: number): number {
  switch (op) {
    case 0:
      return (x + y) & 255;
    case 1:
      return (x + 1) & 255;
    case 2:
      return (x - y) & 255;
    default:
      return (x - 1) & 255;
  }
}

export function alu(
  x: number,
  y: number,
  u: number,
  op: number,
  zx: number,
  sw: number,
): number {
  let a = zx ? 0 : x;
  let b = y;
  if (sw) [a, b] = [b, a];
  return u ? logic(a, b, op) : arith(a, b, op);
}

export function cond(x: number, lt: number, eq: number, gt: number): number {
  const negative = x >= 128;
  const zero = x === 0;
  return (negative && lt) || (zero && eq) || (!negative && !zero && gt) ? 1 : 0;
}

export function findStage(id: string): Stage | undefined {
  return STAGES.find((s) => s.id === id);
}
