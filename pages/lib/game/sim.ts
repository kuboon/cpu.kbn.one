/**
 * Evaluating a netlist.
 *
 * Every net takes the value its drivers give it: 1 if any drives 1, else 0 if any drives 0,
 * else Z; 1 against 0 is a short. A relay's contact passes its `in` net (Z included) to `out`
 * while closed and drives nothing while open. Values are recomputed until nothing changes, from
 * the previous stable state, so feedback (a latch) keeps its state and a loop that never settles
 * is reported as unstable.
 */

import type { Bit } from "./model.ts";
import type { Netlist } from "./netlist.ts";

export type NetValue = Bit | "z";

export type SimError =
  | { kind: "short"; nets: number[] }
  | { kind: "unstable" };

export interface EvalResult {
  /** Output pin name -> value; a bus pin's lanes assembled as a number, lane 0 the low bit. */
  outputs: Record<string, number>;
  /** Every net's value; Z where nothing drives it. */
  nets: NetValue[];
  error?: SimError;
}

export class Simulator {
  readonly netlist: Netlist;
  #values: NetValue[];
  #inputs: Record<string, number> = {};

  constructor(netlist: Netlist) {
    this.netlist = netlist;
    this.#values = new Array(netlist.netCount).fill("z");
  }

  /** Current input values; unset inputs are 0. */
  get inputs(): Readonly<Record<string, number>> {
    return this.#inputs;
  }

  /** Forget all state, as if power-cycled. */
  reset(): void {
    this.#values.fill("z");
    this.#inputs = {};
  }

  /**
   * Applies input changes and settles the circuit.
   *
   * @param set Inputs to change; the others keep their level
   */
  evaluate(set: Record<string, number> = {}): EvalResult {
    this.#inputs = { ...this.#inputs, ...set };
    const nl = this.netlist;
    const n = nl.netCount;
    const has1 = new Uint8Array(n);
    const has0 = new Uint8Array(n);
    const limit = 2 * nl.relays.length + 32;

    let values = this.#values;
    for (let iteration = 0; iteration < limit; iteration++) {
      has1.fill(0);
      has0.fill(0);
      for (const net of nl.ones) has1[net] = 1;
      for (const [name, lanes] of Object.entries(nl.inputs)) {
        const value = this.#inputs[name] ?? 0;
        lanes.forEach((net, lane) => {
          if ((value >> lane) & 1) has1[net] = 1;
          else has0[net] = 1;
        });
      }
      for (const relay of nl.relays) {
        const control = values[relay.c] === 1 ? 1 : 0;
        const closed = relay.defaultOn ? control === 0 : control === 1;
        if (!closed) continue;
        const v = values[relay.in];
        if (v === 1) has1[relay.out] = 1;
        else if (v === 0) has0[relay.out] = 1;
      }

      const next: NetValue[] = new Array(n);
      const shorts: number[] = [];
      let changed = false;
      for (let i = 0; i < n; i++) {
        if (has1[i] && has0[i]) shorts.push(i);
        const v: NetValue = has1[i] ? 1 : has0[i] ? 0 : "z";
        next[i] = v;
        if (v !== values[i]) changed = true;
      }
      if (shorts.length > 0) {
        return {
          outputs: this.#readOutputs(next),
          nets: next,
          error: { kind: "short", nets: shorts },
        };
      }
      values = next;
      if (!changed) {
        this.#values = values;
        return { outputs: this.#readOutputs(values), nets: values };
      }
    }
    return {
      outputs: this.#readOutputs(values),
      nets: values,
      error: { kind: "unstable" },
    };
  }

  #readOutputs(values: NetValue[]): Record<string, number> {
    const outputs: Record<string, number> = {};
    for (const [name, lanes] of Object.entries(this.netlist.outputs)) {
      outputs[name] = lanes.reduce(
        (acc, net, lane) => acc | ((values[net] === 1 ? 1 : 0) << lane),
        0,
      );
    }
    return outputs;
  }
}
