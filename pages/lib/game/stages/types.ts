import type { Bit } from "../model.ts";
import { BUS_WIDTH } from "../model.ts";
import type { PinSpec, Step } from "../verify.ts";

export type { PinSpec };

export interface Stage {
  id: string;
  title: string;
  /** Markdown-free prose shown in the editor. */
  description: string;
  inputs: readonly PinSpec[];
  outputs: readonly PinSpec[];
  steps: readonly Step[];
  maxSize: { width: number; height: number };
  /** The board a player starts with; they resize from there. */
  initialSize: { width: number; height: number };
}

/** Single-bit pins. */
export function pins(...names: string[]): PinSpec[] {
  return names.map((name) => ({ name, width: 1 }));
}

/** A bus pin. */
export function bus(name: string): PinSpec {
  return { name, width: BUS_WIDTH };
}

/** Hand-picked input vectors run through a function; the label lists the inputs. */
export function vectors(
  fn: (input: Record<string, number>) => Record<string, number>,
  samples: readonly Record<string, number>[],
): Step[] {
  return samples.map((set) => ({
    set,
    expect: fn(set),
    label: Object.entries(set).map(([k, v]) => `${k}=${v}`).join(" "),
  }));
}

/** Every input combination, in counting order, for a combinational function. */
export function truthTable(
  inputs: readonly string[],
  fn: (input: Record<string, Bit>) => Record<string, Bit>,
): Step[] {
  const steps: Step[] = [];
  const count = 1 << inputs.length;
  for (let pattern = 0; pattern < count; pattern++) {
    const set: Record<string, Bit> = {};
    inputs.forEach((name, i) => {
      set[name] = ((pattern >> (inputs.length - 1 - i)) & 1) as Bit;
    });
    steps.push({
      set,
      expect: fn(set),
      label: inputs.map((n) => set[n]).join(""),
    });
  }
  return steps;
}

/** A hand-written sequence: each entry changes some inputs, then checks some outputs. */
export function sequence(
  ...entries: [set: Record<string, number>, expect: Record<string, number>][]
): Step[] {
  return entries.map(([set, expect], i) => ({
    set,
    expect,
    label: `${i + 1}: ${
      Object.entries(set).map(([k, v]) => `${k}=${v}`).join(" ")
    }`,
  }));
}
