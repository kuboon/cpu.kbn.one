/**
 * The game's 8-bit CPU: instruction encoding, a reference interpreter, and the test harness that
 * turns a program into stage steps.
 *
 * The CPU stage is a test bench, as in nandgame: the stage feeds the instruction at `pc` and the
 * memory word at `addr` in, and checks `pc`, `addr`, the write flag and the written data. Memory
 * itself lives in the harness.
 *
 * Encoding (bit 7 first):
 *
 *     0 vvvvvvv          A <- v (0..127)
 *     1 0 s1 s0 u o1 o0 d  compute: r = ALU(x, y); d=0: A <- r, d=1: D <- r
 *                          s1 s0 picks the operands: 00 x=A y=D; 01 x=A y=M; 10 x=D y=A; 11 x=0 y=M
 *                          u o1 o0 is the ALU function (see stages: u=0 arithmetic, u=1 logic)
 *     1 1 0 lt eq gt c _   jump: if cond(c ? M : D) then PC <- A
 *     1 1 1 0 ____         store: M[A] <- D
 *     1 1 1 1 ____         halt: PC stays
 *
 * M is the memory word at address A.
 */

import { alu, cond } from "./stages/index.ts";
import type { Step } from "./verify.ts";

export type Operands = "AD" | "AM" | "DA" | "ZM";
const OPERANDS: Record<Operands, number> = { AD: 0, AM: 1, DA: 2, ZM: 3 };

export const ldi = (v: number): number => v & 127;
export const compute = (
  s: Operands,
  u: number,
  op: number,
  dest: "A" | "D",
): number =>
  0x80 | (OPERANDS[s] << 4) | (u << 3) | ((op & 3) << 1) |
  (dest === "D" ? 1 : 0);
export const jmp = (
  lt: number,
  eq: number,
  gt: number,
  onMemory = false,
): number => 0xc0 | (lt << 4) | (eq << 3) | (gt << 2) | (onMemory ? 2 : 0);
export const STORE = 0xe0;
export const HALT = 0xf0;

/** What the control unit derives from an instruction. */
export interface Control {
  ldi: number;
  /** Write A (an immediate, or a compute with d=0). */
  wa: number;
  /** Write D. */
  wd: number;
  /** Write memory. */
  w: number;
  jmp: number;
  halt: number;
}

export function decode(i: number): Control {
  const bit = (n: number) => (i >> n) & 1;
  const isCompute = bit(7) && !bit(6);
  const isJump = bit(7) && bit(6) && !bit(5);
  const isStore = bit(7) && bit(6) && bit(5) && !bit(4);
  const isHalt = bit(7) && bit(6) && bit(5) && bit(4);
  return {
    ldi: bit(7) ? 0 : 1,
    wa: !bit(7) || (isCompute && !bit(0)) ? 1 : 0,
    wd: isCompute && bit(0) ? 1 : 0,
    w: isStore ? 1 : 0,
    jmp: isJump ? 1 : 0,
    halt: isHalt ? 1 : 0,
  };
}

export interface CpuState {
  a: number;
  d: number;
  pc: number;
}

/** Combinational outputs for the current state, instruction and memory word. */
export function outputs(
  state: CpuState,
  _i: number,
): { addr: number; w: number; data: number } {
  return { addr: state.a, w: decode(_i).w, data: state.d };
}

/** The state after one clock edge. */
export function step(state: CpuState, i: number, m: number): CpuState {
  const c = decode(i);
  const bit = (n: number) => (i >> n) & 1;
  let { a, d, pc } = state;
  const next = (pc + 1) & 255;
  if (c.ldi) return { a: i & 127, d, pc: next };
  if (c.halt) return state;
  if (c.jmp) {
    const value = bit(1) ? m : d;
    return { a, d, pc: cond(value, bit(4), bit(3), bit(2)) ? a : next };
  }
  if (c.w) return { a, d, pc: next };
  // compute
  const s = (i >> 4) & 3;
  const [x, y] = s === 0
    ? [a, d]
    : s === 1
    ? [a, m]
    : s === 2
    ? [d, a]
    : [0, m];
  const r = alu(x, y, bit(3), (i >> 1) & 3, 0, 0);
  if (bit(0)) d = r;
  else a = r;
  return { a, d, pc: next };
}

/**
 * Runs a program on the reference interpreter and records the stage steps a CPU must reproduce:
 * per cycle, the instruction and memory word go in and the write flag (and data, when writing) is
 * checked; then the clock rises and pc and addr are checked; then the clock falls.
 */
export function harness(
  program: readonly number[],
  memory: Record<number, number> = {},
  maxCycles = 64,
): Step[] {
  const mem = new Map<number, number>(
    Object.entries(memory).map(([k, v]) => [Number(k), v]),
  );
  let state: CpuState = { a: 0, d: 0, pc: 0 };
  const steps: Step[] = [{
    set: { clk: 0, i: 0, m: 0 },
    expect: { pc: 0, addr: 0 },
  }];
  for (let cycle = 0; cycle < maxCycles; cycle++) {
    const i = program[state.pc] ?? HALT;
    const m = mem.get(state.a) ?? 0;
    const out = outputs(state, i);
    steps.push({
      set: { i, m },
      expect: out.w ? { w: 1, data: out.data } : { w: 0 },
      label: `${cycle}: i=${i.toString(2).padStart(8, "0")} m=${m}`,
    });
    if (out.w) mem.set(state.a, out.data);
    const before = state;
    state = step(state, i, m);
    steps.push({
      set: { clk: 1 },
      expect: { pc: state.pc, addr: state.a },
      label: `${cycle}: clk↑`,
    });
    steps.push({
      set: { clk: 0 },
      expect: { pc: state.pc, addr: state.a },
      label: `${cycle}: clk↓`,
    });
    if (decode(i).halt && before.pc === state.pc) break;
  }
  return steps;
}

/** D = 3 + 4, stored at address 10. */
export const PROGRAM_SUM: readonly number[] = [
  ldi(3),
  compute("AD", 0, 0, "D"), // D = A + D = 3
  ldi(4),
  compute("AD", 0, 0, "D"), // D = 4 + 3 = 7
  ldi(10),
  STORE, // M[10] = 7
  HALT,
];

/** Counts D down from 3 to 0 with a conditional jump. */
export const PROGRAM_LOOP: readonly number[] = [
  ldi(3),
  compute("AD", 0, 0, "D"), // D = 3
  compute("DA", 0, 3, "D"), // D = D - 1          <- loop start (address 2)
  ldi(2),
  jmp(1, 0, 1), // if D != 0 goto 2
  HALT,
];

/** Reads M[3] (42) into D, adds 6 into A, stores D there: M[48] = 42. */
export const PROGRAM_MEMORY: readonly number[] = [
  ldi(3),
  compute("ZM", 0, 0, "D"), // D = 0 + M[3] = 42
  ldi(6),
  compute("AD", 0, 0, "A"), // A = 6 + 42 = 48
  STORE, // M[48] = 42
  ldi(0),
  compute("AM", 1, 3, "A"), // A = NOT A = 255
  jmp(0, 1, 0, true), // if M[255] == 0 goto 255 (it is 0): jumps to A = 255
  HALT,
];
