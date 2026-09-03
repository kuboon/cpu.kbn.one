import { assert, assertEquals } from "@std/assert";

import { createLibrary } from "./model.ts";
import { design } from "./builder.ts";
import * as edit from "./edit.ts";
import { verify } from "./verify.ts";
import { findStage } from "./stages/index.ts";

const library = createLibrary();

Deno.test("connect creates wires and extends them; crossings and parts are left alone", () => {
  let d = design(3, 1).place("relay-on", 2, 0).cross(1, 0).build();
  d = edit.connect(d, library, { x: 0, y: 0 }, { x: 1, y: 0 });
  assertEquals(d.cells["0,0"], {
    kind: "wire",
    n: false,
    e: true,
    s: false,
    w: false,
  });
  assertEquals(d.cells["1,0"], { kind: "cross" });
  d = edit.connect(d, library, { x: 1, y: 0 }, { x: 2, y: 0 });
  assertEquals(d.cells["2,0"], undefined);
  assertEquals(edit.connect(d, library, { x: 0, y: 0 }, { x: 2, y: 0 }), d);
});

Deno.test("connect towards the margin leaves a stub that reaches a border pin", () => {
  let d = design(2, 1).input("a", "w", 0).output("out", "e", 0).build();
  d = edit.connect(d, library, { x: 0, y: 0 }, { x: -1, y: 0 });
  d = edit.connect(d, library, { x: 0, y: 0 }, { x: 1, y: 0 });
  d = edit.connect(d, library, { x: 1, y: 0 }, { x: 2, y: 0 });
  assertEquals(d.cells["0,0"], {
    kind: "wire",
    n: false,
    e: true,
    s: false,
    w: true,
  });
  assertEquals(d.cells["1,0"], {
    kind: "wire",
    n: false,
    e: true,
    s: false,
    w: true,
  });
  assertEquals(d.cells["2,0"], undefined);
  // Both pins now sit on one net, so the "buffer" passes a through.
  const result = verify(d, library, {
    inputs: ["a"],
    outputs: ["out"],
    steps: [{ set: { a: 1 }, expect: { out: 1 } }, {
      set: { a: 0 },
      expect: { out: 0 },
    }],
  });
  assert(result.passed);
  // Two margin cells never connect.
  assertEquals(edit.connect(d, library, { x: -1, y: 0 }, { x: -1, y: 1 }), d);
});

Deno.test("clearCell removes a wire and the stubs pointing at it", () => {
  let d = design(3, 1).wire(0, 0, "e").wire(1, 0, "we").wire(2, 0, "w").build();
  d = edit.clearCell(d, library, { x: 1, y: 0 });
  assertEquals(d.cells["1,0"], undefined);
  assertEquals(d.cells["0,0"], {
    kind: "wire",
    n: false,
    e: false,
    s: false,
    w: false,
  });
  assertEquals(d.cells["2,0"], {
    kind: "wire",
    n: false,
    e: false,
    s: false,
    w: false,
  });
});

Deno.test("clearCell on a component removes the whole component", () => {
  const xor = {
    id: "big",
    name: "big",
    stageId: "x",
    width: 2,
    height: 2,
    pins: [],
    createdAt: "",
  };
  const lib = createLibrary([{ ...xor, design: design(2, 2).build() }]);
  let d = design(3, 3).place("big", 1, 1).build();
  d = edit.clearCell(d, lib, { x: 2, y: 2 });
  assertEquals(d.placements, []);
});

Deno.test("placements must fit and not overlap", () => {
  const d = design(2, 1).wire(0, 0, "e").build();
  const at = (x: number, y: number, rotation: 0 | 1 | 2 | 3 = 0) => ({
    componentId: "relay-on",
    x,
    y,
    rotation,
    mirror: false,
  });
  assertEquals(edit.addPlacement(d, library, at(0, 0)), undefined);
  assertEquals(edit.addPlacement(d, library, at(2, 0)), undefined);
  const placed = edit.addPlacement(d, library, at(1, 0));
  assert(placed);
  assertEquals(edit.addPlacement(placed, library, at(1, 0)), undefined);
  // A component may be re-placed onto the cells it already covers.
  assert(edit.replacePlacement(placed, library, 0, at(1, 0, 1)));
  assertEquals(edit.placementAt(placed, library, { x: 1, y: 0 }), 0);
});

Deno.test("slots map the margin to border positions and pins move between free slots", () => {
  const d = design(3, 2).input("a", "w", 0).output("out", "e", 1).build();
  assertEquals(edit.slotAt(d, { x: 1, y: -1 }), { side: "n", index: 1 });
  assertEquals(edit.slotAt(d, { x: 3, y: 1 }), { side: "e", index: 1 });
  assertEquals(edit.slotAt(d, { x: -1, y: 2 }), undefined);
  assertEquals(edit.pinAt(d, { side: "e", index: 1 }), 1);
  assertEquals(edit.movePin(d, 0, { side: "e", index: 1 }), undefined);
  const moved = edit.movePin(d, 0, { side: "n", index: 2 });
  assertEquals(moved?.pins[0], { name: "a", dir: "in", side: "n", index: 2 });
});

Deno.test("resize trims empty edges, from the far side first, else by shifting", () => {
  // Content in the bottom-right corner, pins on the right and bottom.
  const d = design(4, 3).wire(3, 2, "n").place("relay-on", 2, 2).input(
    "a",
    "e",
    2,
  ).input("b", "s", 3)
    .build();
  // Shrinking the width removes the empty left column and shifts everything left.
  const narrower = edit.resize(d, library, 3, 3)!;
  assertEquals(narrower.cells, {
    "2,2": { kind: "wire", n: true, e: false, s: false, w: false },
  });
  assertEquals(narrower.placements[0].x, 1);
  assertEquals(narrower.pins.map((p) => `${p.side}${p.index}`), ["e2", "s2"]);
  // Two columns off: both empty on the left.
  assertEquals(edit.resize(d, library, 2, 3)?.placements[0].x, 0);
  // Three columns off would cut the relay.
  assertEquals(edit.resize(d, library, 1, 3), undefined);
  // Shrinking the height removes the empty top rows and moves the east pin up.
  const shorter = edit.resize(d, library, 4, 1)!;
  assertEquals(shorter.placements[0].y, 0);
  assertEquals(shorter.pins.map((p) => `${p.side}${p.index}`), ["e0", "s3"]);
  assertEquals(edit.resize(d, library, 4, 0), undefined);

  // The far edge goes first when it is empty, so nothing shifts.
  const left = design(4, 3).wire(0, 0, "e").place("relay-on", 1, 0).input(
    "a",
    "n",
    1,
  ).build();
  const trimmed = edit.resize(left, library, 2, 1)!;
  assertEquals(trimmed.cells["0,0"]?.kind, "wire");
  assertEquals(trimmed.placements[0], {
    componentId: "relay-on",
    x: 1,
    y: 0,
    rotation: 0,
    mirror: false,
  });
  assertEquals(trimmed.pins[0].index, 1);

  // A pin on the edge keeps its column occupied.
  const pinned = design(3, 1).input("a", "n", 0).place("relay-on", 2, 0)
    .build();
  assertEquals(edit.resize(pinned, library, 2, 1), undefined);

  // Growing adds room on the right and bottom.
  assertEquals(edit.resize(d, library, 5, 4)?.cells, d.cells);
});

Deno.test("a stage's default design has its pins and is empty", () => {
  const stage = findStage("full-adder")!;
  const d = edit.defaultDesign(stage);
  assertEquals(d.pins.map((p) => `${p.dir}:${p.name}@${p.side}${p.index}`), [
    "in:a@w0",
    "in:b@w1",
    "in:ci@w2",
    "out:s@e0",
    "out:co@e1",
  ]);
  assertEquals(verify(d, library, stage).problems, []);
});
