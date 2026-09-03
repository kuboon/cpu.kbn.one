import { assert, assertEquals, assertThrows } from "@std/assert";

import { createLibrary, RELAY_ON } from "./model.ts";
import { design } from "./builder.ts";
import { buildNetlist, validateDesign } from "./netlist.ts";
import { Simulator } from "./sim.ts";
import { runSteps, verify } from "./verify.ts";
import { alu, arith, cond, findStage, logic, STAGES } from "./stages/index.ts";
import {
  compute,
  decode,
  HALT,
  harness,
  jmp,
  ldi,
  PROGRAM_LOOP,
  PROGRAM_MEMORY,
  PROGRAM_SUM,
  step,
  STORE,
} from "./cpu.ts";
import { truthTable } from "./stages/types.ts";
import { par, REFERENCE_COMPONENTS, REFERENCES } from "./reference.ts";
import { ACHIEVEMENTS, earned, manifest } from "./achievements.ts";
import type { SaveData } from "./storage.ts";
import { worldPins } from "./transform.ts";
import {
  componentFrom,
  emptySave,
  isUsed,
  parse,
  register,
  removeComponent,
  renameComponent,
  serialize,
  usedBy,
} from "./storage.ts";

const library = createLibrary(REFERENCE_COMPONENTS);

function describe(result: ReturnType<typeof verify>): string {
  const failed = result.results.filter((r) => !r.ok).map((r) =>
    `${r.step.label}: expected ${JSON.stringify(r.step.expect)} got ${
      JSON.stringify(r.actual)
    }${r.error ? ` (${r.error.kind})` : ""}`
  );
  return [...result.problems.map((p) => p.message), ...failed].join("\n");
}

Deno.test("every reference solution passes its stage", () => {
  for (const [id, d] of Object.entries(REFERENCES)) {
    const stage = findStage(id);
    assert(stage, `stage ${id} exists`);
    const result = verify(d, library, stage);
    assert(result.passed, `${id}:\n${describe(result)}`);
  }
});

Deno.test("reference areas are the pars", () => {
  assertEquals(
    Object.fromEntries(STAGES.map((s) => [s.id, par(s.id)])),
    {
      not: 2,
      nand: 6,
      and: 3,
      or: 6,
      xor: 12,
      selector: 12,
      switch: undefined,
      "half-adder": 30,
      "full-adder": undefined,
      "sr-latch": 12,
      "d-latch": 12,
      dff: 60,
      "register-bit": undefined,
      neg8: 16,
      zero8: undefined,
      selector8: undefined,
      add8: undefined,
      inc8: undefined,
      sub8: undefined,
      register8: undefined,
      counter8: undefined,
      logic8: undefined,
      arith8: undefined,
      alu8: undefined,
      cond8: undefined,
      ram4: undefined,
      control8: undefined,
      cpu8: undefined,
    },
  );
});

Deno.test("a bus carries eight lanes and a split fans them out", () => {
  // Bus straight through.
  const through = design(2, 1).input("a", "w", 0, 8).output("out", "e", 0, 8)
    .wire(0, 0, "weB").wire(1, 0, "weB").build();
  const sim = new Simulator(buildNetlist(through, library));
  assertEquals(sim.evaluate({ a: 0xa5 }).outputs, { out: 0xa5 });
  assertEquals(sim.evaluate({ a: 3 }).outputs, { out: 3 });

  // Split, swap two lanes with single wires, join again.
  const swapped = design(4, 8).input("a", "w", 0, 8).output("out", "e", 0, 8)
    .place("split", 0, 0).place("split", 3, 0, 0, true)
    .wire(1, 0, "wes").wire(2, 0, "we").wire(1, 1, "wne").wire(2, 1, "we")
    .build();
  // lane 0 -> row 0 stays; lane 1 joins lane 0 through (1,1)->(1,0): both outputs read the OR.
  const s2 = new Simulator(buildNetlist(swapped, library));
  assertEquals(s2.evaluate({ a: 0b10 }).outputs.out & 0b11, 0b11);

  // A single wire meeting a bus is a width problem, reported on both cells.
  const mismatch = design(2, 1).input("a", "w", 0, 8).output("out", "e", 0, 8)
    .wire(0, 0, "weB").wire(1, 0, "we").build();
  const problems = validateDesign(mismatch, library);
  assert(
    problems.some((p) => p.message.includes("幅")),
    JSON.stringify(problems),
  );
  // ...and so is a bus pin fed by a single wire.
  const narrow = design(1, 1).input("a", "w", 0, 8).output("out", "e", 0).wire(
    0,
    0,
    "we",
  ).build();
  assert(validateDesign(narrow, library).some((p) => p.message.includes("幅")));
});

Deno.test("verify insists on the stage's pin widths", () => {
  const result = verify(
    design(1, 1).input("a", "w", 0).output("n", "e", 0).build(),
    library,
    findStage("neg8")!,
  );
  assertEquals(result.problems.map((p) => p.message), [
    "入力ピン a は 8 ビットのバスにします",
  ]);
});

Deno.test("truth table counts up with the first input as the high bit", () => {
  const steps = truthTable(["a", "b"], ({ a }) => ({ out: a }));
  assertEquals(steps.map((s) => s.label), ["00", "01", "10", "11"]);
  assertEquals(steps[2].set, { a: 1, b: 0 });
  assertEquals(steps[2].expect, { out: 1 });
});

Deno.test("a rotated or mirrored component still works", () => {
  const not = REFERENCES.not;
  const lib = createLibrary([{
    id: "not",
    name: "NOT",
    stageId: "not",
    width: not.width,
    height: not.height,
    pins: not.pins,
    design: not,
    createdAt: "",
  }]);
  const stage = findStage("not")!;

  // NOT is 2x1 with a north and out east; a quarter turn puts a east and out south.
  const rotated = design(1, 2).input("a", "e", 1).output("out", "s", 0).place(
    "not",
    0,
    0,
    1,
  )
    .build();
  assert(
    verify(rotated, lib, stage).passed,
    describe(verify(rotated, lib, stage)),
  );

  const mirrored = design(2, 1).input("a", "n", 0).output("out", "w", 0)
    .place("not", 0, 0, 0, true).build();
  assert(
    verify(mirrored, lib, stage).passed,
    describe(verify(mirrored, lib, stage)),
  );

  const upsideDown = design(2, 1).input("a", "s", 0).output("out", "w", 0)
    .place("not", 0, 0, 2).build();
  assert(
    verify(upsideDown, lib, stage).passed,
    describe(verify(upsideDown, lib, stage)),
  );
});

Deno.test("worldPins of a relay under every orientation", () => {
  const at = (rotation: 0 | 1 | 2 | 3, mirror: boolean) =>
    worldPins(RELAY_ON, {
      componentId: "relay-on",
      x: 0,
      y: 0,
      rotation,
      mirror,
    })
      .map((p) => `${p.pin.name}:${p.side}`).join(" ");
  assertEquals(at(0, false), "c:n in:w out:e");
  assertEquals(at(1, false), "c:e in:n out:s");
  assertEquals(at(2, false), "c:s in:e out:w");
  assertEquals(at(3, false), "c:w in:s out:n");
  assertEquals(at(0, true), "c:n in:e out:w");
  assertEquals(at(2, true), "c:s in:w out:e");
});

Deno.test("pins touching directly connect without a wire", () => {
  // Two relays in series with nothing between them: AND.
  const d = design(3, 1).input("a", "n", 1).input("b", "n", 2).output(
    "out",
    "e",
    0,
  )
    .place("one", 0, 0).place("relay-off", 1, 0).place("relay-off", 2, 0)
    .build();
  assert(verify(d, library, findStage("and")!).passed);
});

Deno.test("joining two inputs is a short", () => {
  const d = design(2, 1).input("a", "w", 0).input("b", "e", 0)
    .wire(0, 0, "we").wire(1, 0, "we").build();
  const sim = new Simulator(buildNetlist(d, library));
  assertEquals(sim.evaluate({ a: 0, b: 0 }).error, undefined);
  const result = sim.evaluate({ a: 1, b: 0 });
  assertEquals(result.error?.kind, "short");
});

Deno.test("an inverter fed back to itself is unstable", () => {
  const d = design(3, 2)
    .place("one", 0, 0).place("relay-on", 1, 0, 2, true).wire(2, 0, "ws")
    .wire(1, 1, "ne").wire(2, 1, "nw").build();
  const sim = new Simulator(buildNetlist(d, library));
  assertEquals(sim.evaluate().error, { kind: "unstable" });
});

Deno.test("an unconnected input reads as 0 and a floating output as 0", () => {
  const d = design(1, 1).input("a", "n", 0).output("out", "s", 0).build();
  const sim = new Simulator(buildNetlist(d, library));
  assertEquals(sim.evaluate({ a: 1 }).outputs, { out: 0 });
});

Deno.test("an SR latch holds its state across steps", () => {
  // set through a default-off relay drives q; q holds itself through a second default-off relay
  // in series with a default-on relay opened by reset.
  const d = design(4, 3)
    .input("set", "n", 1).input("reset", "s", 2).output("q", "e", 0)
    .place("one", 0, 0).place("relay-off", 1, 0).wire(2, 0, "we").wire(
      3,
      0,
      "wes",
    )
    .wire(1, 1, "es").wire(2, 1, "we").wire(3, 1, "nsw")
    .place("one", 0, 2).place("relay-off", 1, 2).place(
      "relay-on",
      2,
      2,
      2,
      true,
    ).wire(3, 2, "wn")
    .build();
  const results = runSteps(buildNetlist(d, library), [
    { set: { set: 0, reset: 0 }, expect: { q: 0 } },
    { set: { set: 1 }, expect: { q: 1 } },
    { set: { set: 0 }, expect: { q: 1 } },
    { set: { reset: 1 }, expect: { q: 0 } },
    { set: { reset: 0 }, expect: { q: 0 } },
    { set: { set: 1 }, expect: { q: 1 } },
  ]);
  assert(
    results.every((r) => r.ok),
    results.map((r) =>
      `${JSON.stringify(r.step)} -> ${JSON.stringify(r.actual)} ${
        r.error?.kind ?? ""
      }`
    )
      .join("\n"),
  );
});

Deno.test("validateDesign reports overlaps, overflow and pin clashes", () => {
  const d = design(2, 1)
    .input("a", "n", 0).input("b", "n", 0).input("a", "e", 3)
    .place("relay-on", 1, 0).place("one", 1, 0).place("one", 2, 0)
    .wire(1, 0, "we").build();
  const messages = validateDesign(d, library).map((p) => p.message);
  assert(
    messages.some((m) => m.includes("重なっています")),
    messages.join("\n"),
  );
  assert(messages.some((m) => m.includes("はみ出して")), messages.join("\n"));
  assert(messages.some((m) => m.includes("辺の外")), messages.join("\n"));
  assert(
    messages.some((m) => m.includes("ピン名 a が重複")),
    messages.join("\n"),
  );
  assert(
    messages.some((m) => m.includes("位置が他のピン")),
    messages.join("\n"),
  );
});

Deno.test("verify reports missing stage pins instead of simulating", () => {
  const result = verify(design(1, 1).build(), library, findStage("not")!);
  assertEquals(result.passed, false);
  assertEquals(result.problems.map((p) => p.message), [
    "入力ピン a がありません",
    "出力ピン out がありません",
  ]);
  const wide = verify(
    design(1, 1).input("a", "n", 0, 8).output("out", "s", 0).build(),
    library,
    findStage("not")!,
  );
  assertEquals(wide.problems.map((p) => p.message), [
    "入力ピン a は 1 本にします",
  ]);
});

Deno.test("a component containing itself is rejected", () => {
  const self = design(1, 1).place("self", 0, 0).build();
  const lib = createLibrary([{
    id: "self",
    name: "self",
    stageId: "x",
    width: 1,
    height: 1,
    pins: [],
    design: self,
    createdAt: "",
  }]);
  assertThrows(() => buildNetlist(self, lib), Error, "自分自身");
});

Deno.test("save data round-trips and tracks the best area", () => {
  let save = emptySave();
  save = register(save, REFERENCE_COMPONENTS[0]);
  save = register(save, {
    ...REFERENCE_COMPONENTS[0],
    id: "xor-big",
    width: 5,
    height: 5,
  });
  assertEquals(save.best, { xor: 12 });
  assertEquals(parse(serialize(save)), save);
  assertEquals(isUsed(save, "xor"), false);
  save = register(save, {
    ...REFERENCE_COMPONENTS[1],
    id: "ha",
    stageId: "half-adder",
    design: REFERENCES["half-adder"],
  });
  assertEquals(isUsed(save, "xor"), true);
  assertThrows(() => parse("{}"), Error);
});

Deno.test("components can be renamed and removed only while unused", () => {
  let save = emptySave();
  const xor = componentFrom("xor", "XOR", REFERENCES.xor, "xor");
  const and = componentFrom("and", "AND", REFERENCES.and, "and");
  save = register(register(save, xor), and);
  save = register(
    save,
    componentFrom("xor", "XOR wide", { ...REFERENCES.xor, width: 5 }, "xor2"),
  );
  assertEquals(save.best, { xor: 12, and: 3 });

  save = renameComponent(save, "xor", "XOR small");
  assertEquals(save.components[0].name, "XOR small");

  const ha = componentFrom("half-adder", "HA", REFERENCES["half-adder"], "ha");
  save = register(save, ha);
  assertEquals(usedBy(save, "xor"), ["HA"]);
  assertEquals(removeComponent(save, "xor"), undefined);
  save = { ...save, drafts: { nand: REFERENCES["half-adder"] } };
  assertEquals(usedBy(save, "and"), ["HA", "nand の下書き"]);

  save = removeComponent(save, "ha")!;
  assertEquals(save.best["half-adder"], undefined);
  assertEquals(usedBy(save, "xor"), ["nand の下書き"]);
  save = { ...save, drafts: {} };
  assertEquals(usedBy(save, "xor"), []);
  save = removeComponent(save, "xor")!;
  assertEquals(save.best.xor, 15);
  assertEquals(removeComponent(save, "missing"), undefined);
});

Deno.test("the ALU function tables", () => {
  assertEquals(logic(0b1100, 0b1010, 0), 0b1000);
  assertEquals(logic(0b1100, 0b1010, 1), 0b1110);
  assertEquals(logic(0b1100, 0b1010, 2), 0b0110);
  assertEquals(logic(0b1100, 0, 3), 0b11110011);
  assertEquals(arith(255, 1, 0), 0);
  assertEquals(arith(255, 99, 1), 0);
  assertEquals(arith(0, 1, 2), 255);
  assertEquals(arith(0, 99, 3), 255);
  assertEquals(alu(5, 3, 0, 2, 0, 0), 2);
  assertEquals(alu(5, 3, 0, 2, 0, 1), 254);
  assertEquals(alu(5, 3, 0, 1, 1, 0), 1);
  assertEquals(alu(5, 3, 1, 3, 0, 1), 252);
  assertEquals(cond(0, 0, 1, 0), 1);
  assertEquals(cond(0, 1, 0, 1), 0);
  assertEquals(cond(200, 1, 0, 0), 1);
  assertEquals(cond(5, 0, 0, 1), 1);
  assertEquals(cond(5, 1, 1, 0), 0);
  // Every stage's steps agree with themselves: the expected output is a function of the inputs.
  for (const stage of STAGES) {
    assert(stage.steps.length > 0, stage.id);
    for (const step of stage.steps) {
      for (const name of Object.keys(step.set)) {
        assert(
          stage.inputs.some((p) => p.name === name),
          `${stage.id}: unknown input ${name}`,
        );
      }
      for (const name of Object.keys(step.expect)) {
        assert(
          stage.outputs.some((p) => p.name === name),
          `${stage.id}: unknown output ${name}`,
        );
      }
    }
  }
});

Deno.test("the reference CPU runs the test programs", () => {
  assertEquals(decode(ldi(5)), { ldi: 1, wa: 1, wd: 0, w: 0, jmp: 0, halt: 0 });
  assertEquals(decode(compute("AD", 0, 0, "D")), {
    ldi: 0,
    wa: 0,
    wd: 1,
    w: 0,
    jmp: 0,
    halt: 0,
  });
  assertEquals(decode(compute("DA", 1, 3, "A")), {
    ldi: 0,
    wa: 1,
    wd: 0,
    w: 0,
    jmp: 0,
    halt: 0,
  });
  assertEquals(decode(jmp(1, 1, 1)), {
    ldi: 0,
    wa: 0,
    wd: 0,
    w: 0,
    jmp: 1,
    halt: 0,
  });
  assertEquals(decode(STORE), { ldi: 0, wa: 0, wd: 0, w: 1, jmp: 0, halt: 0 });
  assertEquals(decode(HALT), { ldi: 0, wa: 0, wd: 0, w: 0, jmp: 0, halt: 1 });

  const run = (
    program: readonly number[],
    memory: Record<number, number> = {},
  ) => {
    const mem = new Map(Object.entries(memory).map(([k, v]) => [Number(k), v]));
    let state = { a: 0, d: 0, pc: 0 };
    for (let n = 0; n < 100; n++) {
      const i = program[state.pc] ?? HALT;
      const m = mem.get(state.a) ?? 0;
      if (decode(i).w) mem.set(state.a, state.d);
      const next = step(state, i, m);
      if (decode(i).halt) break;
      state = next;
    }
    return { state, mem };
  };
  const sum = run(PROGRAM_SUM);
  assertEquals(sum.mem.get(10), 7);
  const loop = run(PROGRAM_LOOP);
  assertEquals(loop.state, { a: 2, d: 0, pc: 5 });
  const memory = run(PROGRAM_MEMORY, { 3: 42 });
  assertEquals(memory.mem.get(48), 42);
  assertEquals(memory.state.pc, 255);

  // The harness ends at the halt and checks a write exactly where the program stores.
  const steps = harness(PROGRAM_SUM);
  const writes = steps.filter((s) => s.expect.w === 1);
  assertEquals(writes.length, 1);
  assertEquals(writes[0].expect.data, 7);
  assertEquals(steps.at(-1)?.expect.pc, 6);
});

Deno.test("achievements: the manifest is valid and registrations earn the right keys", () => {
  const m = manifest();
  assertEquals(m.author, "7499d00d-fcff-4630-91a0-c034893c8d08");
  assert(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(m.id as string));
  assertEquals(
    new Set(ACHIEVEMENTS.map((a) => a.key)).size,
    ACHIEVEMENTS.length,
  );
  for (const a of ACHIEVEMENTS) {
    assert(/^[a-z0-9][a-z0-9_-]{0,62}[a-z0-9]$/.test(a.key), a.key);
  }

  const keys = (e: { key: string }[]) => e.map((x) => x.key).sort();
  let save: SaveData = { ...emptySave(), best: { not: 2 } };
  assertEquals(keys(earned(save, "not", 2, 2)), ["first_clear", "on_par"]);
  assertEquals(keys(earned(save, "not", 3, 2)), ["first_clear"]);
  assertEquals(keys(earned(save, "not", 1, 2)), ["first_clear", "under_par"]);
  // Already unlocked ones are not earned again.
  save = {
    ...save,
    achievements: { first_clear: "recorded", on_par: "pending" },
  };
  assertEquals(keys(earned(save, "not", 2, 2)), []);
  // The gate set completes with XOR.
  save = { ...emptySave(), best: { not: 2, nand: 6, and: 3, or: 6, xor: 12 } };
  assertEquals(keys(earned(save, "xor", 12, 12)), ["gates", "on_par"]);
  // A bus stage earns first_bus; the CPU carries a score.
  save = { ...emptySave(), best: { neg8: 16 } };
  assertEquals(keys(earned(save, "neg8", 16, 16)), ["first_bus", "on_par"]);
  save = { ...emptySave(), best: { cpu8: 5000 } };
  assertEquals(earned(save, "cpu8", 5000, undefined), [{
    key: "cpu",
    score: 60536,
  }, { key: "first_bus" }]);
  // Everything cleared.
  const all = Object.fromEntries(STAGES.map((s) => [s.id, 1]));
  assert(
    keys(earned({ ...emptySave(), best: all }, "switch", 1, undefined))
      .includes("all_clear"),
  );
});
