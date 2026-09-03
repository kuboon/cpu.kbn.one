/**
 * Running a stage's tests against a design.
 */

import type { Bit, Design, Library } from "./model.ts";
import { buildNetlist, validateDesign } from "./netlist.ts";
import type { Netlist, Problem } from "./netlist.ts";
import { Simulator } from "./sim.ts";
import type { SimError } from "./sim.ts";

/** One test step: change some inputs, then check some outputs. */
export interface Step {
  set: Record<string, Bit>;
  expect: Record<string, Bit>;
  label?: string;
}

export interface StepResult {
  step: Step;
  ok: boolean;
  actual: Record<string, Bit>;
  error?: SimError;
}

export interface VerifyResult {
  passed: boolean;
  /** Placement rules the design breaks; when non-empty nothing was simulated. */
  problems: Problem[];
  results: StepResult[];
  netlist?: Netlist;
}

/** Runs the steps in order on one simulator, so state carries over between them. */
export function runSteps(
  netlist: Netlist,
  steps: readonly Step[],
): StepResult[] {
  const sim = new Simulator(netlist);
  return steps.map((step) => {
    const { outputs, error } = sim.evaluate(step.set);
    const ok = error === undefined &&
      Object.entries(step.expect).every(([name, bit]) => outputs[name] === bit);
    return { step, ok, actual: outputs, error };
  });
}

export function verify(
  design: Design,
  library: Library,
  stage: {
    inputs: readonly string[];
    outputs: readonly string[];
    steps: readonly Step[];
  },
): VerifyResult {
  const problems = validateDesign(design, library);
  const pinNames = new Set(design.pins.map((p) => `${p.dir}:${p.name}`));
  for (const name of stage.inputs) {
    if (!pinNames.has(`in:${name}`)) {
      problems.push({ message: `入力ピン ${name} がありません` });
    }
  }
  for (const name of stage.outputs) {
    if (!pinNames.has(`out:${name}`)) {
      problems.push({ message: `出力ピン ${name} がありません` });
    }
  }
  if (problems.length > 0) return { passed: false, problems, results: [] };

  let netlist: Netlist;
  try {
    netlist = buildNetlist(design, library);
  } catch (e) {
    return {
      passed: false,
      problems: [{ message: (e as Error).message }],
      results: [],
    };
  }
  const results = runSteps(netlist, stage.steps);
  return { passed: results.every((r) => r.ok), problems, results, netlist };
}
