/**
 * Running a stage's tests against a design.
 */

import type { Design, Library } from "./model.ts";
import { pinWidth } from "./model.ts";
import { buildNetlist, validateDesign } from "./netlist.ts";
import type { Netlist, Problem } from "./netlist.ts";
import { Simulator } from "./sim.ts";
import type { SimError } from "./sim.ts";

/** A stage's pin: name and how many lanes. */
export interface PinSpec {
  name: string;
  width: number;
}

/** One test step: change some inputs, then check some outputs. Values are numbers; a bus pin takes 0..255. */
export interface Step {
  set: Record<string, number>;
  expect: Record<string, number>;
  label?: string;
}

export interface StepResult {
  step: Step;
  ok: boolean;
  actual: Record<string, number>;
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
    inputs: readonly PinSpec[];
    outputs: readonly PinSpec[];
    steps: readonly Step[];
  },
): VerifyResult {
  const problems = validateDesign(design, library);
  const check = (
    dir: "in" | "out",
    label: string,
    specs: readonly PinSpec[],
  ) => {
    for (const spec of specs) {
      const pin = design.pins.find((p) =>
        p.dir === dir && p.name === spec.name
      );
      if (pin === undefined) {
        problems.push({ message: `${label}ピン ${spec.name} がありません` });
      } else if (pinWidth(pin) !== spec.width) {
        const want = spec.width === 1 ? "1 本" : `${spec.width} ビットのバス`;
        problems.push({
          message: `${label}ピン ${spec.name} は ${want}にします`,
        });
      }
    }
  };
  check("in", "入力", stage.inputs);
  check("out", "出力", stage.outputs);
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
