import type { Bit } from "../model.ts";
import type { Step } from "../verify.ts";

export interface Stage {
  id: string;
  title: string;
  /** Markdown-free prose shown in the editor. */
  description: string;
  inputs: readonly string[];
  outputs: readonly string[];
  steps: readonly Step[];
  maxSize: { width: number; height: number };
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
