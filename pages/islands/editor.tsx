import { on } from "@remix-run/ui";
import type { Handle, RemixNode } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";

import type {
  Cell,
  ComponentDef,
  Design,
  Library,
  Placement,
  Rotation,
  Side,
} from "../lib/game/model.ts";
import {
  area,
  BUS_WIDTH,
  cellKey,
  createLibrary,
  parseCellKey,
  pinWidth,
  PRIMITIVES,
} from "../lib/game/model.ts";
import { footprint, pinCell, worldPins } from "../lib/game/transform.ts";
import type { WorldPin } from "../lib/game/transform.ts";
import { outsideOf } from "../lib/game/netlist.ts";
import type { Netlist, Problem } from "../lib/game/netlist.ts";
import { Simulator } from "../lib/game/sim.ts";
import type { EvalResult } from "../lib/game/sim.ts";
import { verify } from "../lib/game/verify.ts";
import type { PinSpec, StepResult } from "../lib/game/verify.ts";
import { findStage, STAGES } from "../lib/game/stages/index.ts";
import type { Stage } from "../lib/game/stages/index.ts";
import { par } from "../lib/game/reference.ts";
import * as edit from "../lib/game/edit.ts";
import type { Point, Slot } from "../lib/game/edit.ts";
import { loadSave, storeSave } from "../lib/game/browser-storage.ts";
import { componentFrom, emptySave, register } from "../lib/game/storage.ts";
import type { SaveData } from "../lib/game/storage.ts";
import { ACHIEVEMENTS, earned } from "../lib/game/achievements.ts";
import { gameCenter, unlock } from "../lib/game/gamecenter.ts";
import type { UnlockOutcome } from "../lib/game/gamecenter.ts";

/** Pixels per cell in the SVG's own coordinates; the drawing scales to its container. */
const CELL = 32;

type Tool =
  | { kind: "select" }
  | { kind: "wire" }
  | { kind: "bus" }
  | { kind: "cross" }
  | { kind: "erase" }
  | { kind: "place"; componentId: string };

type Drag =
  | { kind: "wire"; last: Point; bus: boolean }
  | { kind: "erase" }
  | { kind: "move"; index: number; offset: Point; to?: Point; moved: boolean }
  | { kind: "pin"; index: number; to?: Slot; moved: boolean }
  /** A touch with the place tool: the ghost follows the finger and the part lands on release. */
  | { kind: "placing"; componentId: string }
  | { kind: "idle" };

const KEY_TOOLS: Record<string, Tool> = {
  v: { kind: "select" },
  w: { kind: "wire" },
  b: { kind: "bus" },
  x: { kind: "cross" },
  e: { kind: "erase" },
};

const MAX_BUS = (1 << BUS_WIDTH) - 1;

/**
 * The stage editor: a board, a palette, live simulation and the stage's tests.
 *
 * The server render is a placeholder: the draft and the registered components live in the
 * browser's storage, so the real editor appears right after hydration.
 */
export const Editor = island(
  "editor",
  "Editor",
  function Editor(handle: Handle<{ base: string; stageId: string }>) {
    let stage: Stage | undefined;
    let save: SaveData = emptySave();
    let library: Library = createLibrary();
    let design: Design = edit.defaultDesign({ inputs: [], outputs: [] });
    let history: Design[] = [];
    let inputs: Record<string, number> = {};
    let tool: Tool = { kind: "wire" };
    let orientation: { rotation: Rotation; mirror: boolean } = {
      rotation: 0,
      mirror: false,
    };
    let selected: number | undefined;
    let hover: Point | undefined;
    let drag: Drag | undefined;
    let message: string | undefined;
    let missing: string | undefined;
    /** Name of the component just registered, for the confirmation. */
    let registered: string | undefined;
    /** The test step the live simulator currently shows, if any. */
    let shown: number | undefined;
    let playing: number | undefined;

    // Simulation state, rebuilt after every edit.
    let problems: Problem[] = [];
    let netlist: Netlist | undefined;
    let sim: Simulator | undefined;
    let live: EvalResult | undefined;
    let tests: StepResult[] = [];

    function rebuild(): void {
      if (stage === undefined) return;
      const result = verify(design, library, stage);
      problems = result.problems;
      tests = result.results;
      netlist = result.netlist;
      sim = netlist === undefined ? undefined : new Simulator(netlist);
      live = sim?.evaluate(inputs);
    }

    function saveDraft(): void {
      if (stage === undefined) return;
      save = { ...save, drafts: { ...save.drafts, [stage.id]: design } };
      storeSave(save);
    }

    /** Achievements unlocked by the latest registration, with claim links where needed. */
    let unlocked: UnlockOutcome[] = [];

    /** Registers the current board as a component of this stage. */
    function registerComponent(name: string): void {
      if (stage === undefined) return;
      const trimmed = name.trim() ||
        `${stage.title} ${design.width}×${design.height}`;
      const component = componentFrom(stage.id, trimmed, design);
      save = register(save, component);
      library = createLibrary(save.components);
      storeSave(save);
      registered = trimmed;
      unlocked = [];
      handle.update();
      awardAchievements(stage.id, area(design));
    }

    async function awardAchievements(
      stageId: string,
      cellArea: number,
    ): Promise<void> {
      const wins = earned(save, stageId, cellArea, par(stageId));
      for (const win of wins) {
        const outcome = await unlock(win.key, win.score);
        unlocked = [...unlocked, outcome];
        save = {
          ...save,
          achievements: {
            ...save.achievements,
            [win.key]: outcome.recorded ? "recorded" : "pending",
          },
        };
        storeSave(save);
        handle.update();
      }
    }

    function markClaimed(key: string): void {
      save = {
        ...save,
        achievements: { ...save.achievements, [key]: "recorded" },
      };
      storeSave(save);
      unlocked = unlocked.map((u) =>
        u.key === key ? { ...u, recorded: true } : u
      );
      handle.update();
    }

    /** Claim links for achievements the hub has not recorded yet, this stage's and older ones. */
    function renderAchievements(): RemixNode {
      const pending = Object.entries(save.achievements ?? {})
        .filter(([, state]) => state === "pending")
        .map(([key]) => key);
      const fresh = unlocked.filter((u) => u.recorded);
      if (pending.length === 0 && fresh.length === 0) return null;
      const gc = gameCenter();
      const titleOf = (key: string) =>
        ACHIEVEMENTS.find((a) => a.key === key)?.title ?? key;
      return (
        <section class="achievements">
          <h3>実績</h3>
          {fresh.map((u) => (
            <p key={u.key} class="recorded">
              🏆 {titleOf(u.key)} を記録しました
            </p>
          ))}
          {pending.length > 0
            ? (
              <>
                <p class="hint">
                  記録にはあなたの確認が要ります。リンクを押すと game-center
                  で記録されます。
                </p>
                <ul>
                  {pending.map((key) => (
                    <li key={key}>
                      🏆 {titleOf(key)}{" "}
                      <a
                        href={unlocked.find((u) => u.key === key)?.claimUrl ??
                          gc?.claimUrl(key) ?? "#"}
                        target="_blank"
                        rel="noopener"
                        mix={[on("click", () => markClaimed(key))]}
                      >
                        記録する
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )
            : null}
        </section>
      );
    }

    /** Applies an edit: `undefined` means it was refused, and `why` is shown instead. */
    function commit(next: Design | undefined, why?: string): void {
      if (next === undefined) {
        message = why;
      } else if (next !== design) {
        history = [...history.slice(-99), design];
        design = next;
        message = undefined;
        registered = undefined;
        shown = undefined;
        rebuild();
        saveDraft();
      }
      handle.update();
    }

    function undo(): void {
      const previous = history.pop();
      if (previous === undefined) return;
      design = previous;
      selected = undefined;
      rebuild();
      saveDraft();
      handle.update();
    }

    function setInputs(next: Record<string, number>): void {
      inputs = next;
      shown = undefined;
      live = sim?.evaluate(inputs);
      handle.update();
    }

    /** Replays the test steps up to `index` on the live simulator, so a latch shows its real state. */
    function showStep(index: number): void {
      if (stage === undefined || sim === undefined) return;
      shown = index;
      sim.reset();
      inputs = {};
      for (let i = 0; i <= index; i++) {
        inputs = { ...inputs, ...stage.steps[i].set };
        live = sim.evaluate(stage.steps[i].set);
      }
      handle.update();
    }

    /** Steps through the tests on the live simulator, one every 600 ms. */
    function play(): void {
      if (playing !== undefined) {
        clearTimeout(playing);
        playing = undefined;
        handle.update();
        return;
      }
      let index = 0;
      const tick = () => {
        if (stage === undefined || index >= stage.steps.length) {
          playing = undefined;
          handle.update();
          return;
        }
        showStep(index);
        index++;
        playing = setTimeout(tick, 600);
      };
      tick();
    }

    function init(): void {
      stage = findStage(handle.props.stageId);
      if (stage === undefined) {
        missing = handle.props.stageId;
        handle.update();
        return;
      }
      gameCenter();
      save = loadSave() ?? emptySave();
      library = createLibrary(save.components);
      design = save.drafts[stage.id] ?? edit.defaultDesign(stage);
      rebuild();
      handle.update();
    }

    // Only in the browser: the server render is the placeholder below.
    if (typeof document !== "undefined") {
      setTimeout(init, 0);
      globalThis.addEventListener("keydown", onKey, { signal: handle.signal });
    }

    function onKey(event: KeyboardEvent): void {
      if (stage === undefined) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if ((event.ctrlKey || event.metaKey) && event.key === "z") {
        event.preventDefault();
        undo();
        return;
      }
      const key = event.key.toLowerCase();
      if (KEY_TOOLS[key]) {
        tool = KEY_TOOLS[key];
        handle.update();
      } else if (key === "r" || key === "f") {
        transform(key === "r" ? "rotate" : "mirror");
      } else if (event.key === "Delete" || event.key === "Backspace") {
        if (selected !== undefined) {
          const index = selected;
          selected = undefined;
          commit(edit.removePlacement(design, index));
        }
      } else if (event.key === "Escape") {
        tool = { kind: "select" };
        selected = undefined;
        handle.update();
      }
    }

    function transform(how: "rotate" | "mirror"): void {
      const apply = (o: { rotation: Rotation; mirror: boolean }) =>
        how === "rotate"
          ? { ...o, rotation: ((o.rotation + 1) % 4) as Rotation }
          : { ...o, mirror: !o.mirror };
      if (selected !== undefined && tool.kind === "select") {
        const p = design.placements[selected];
        commit(
          edit.replacePlacement(design, library, selected, {
            ...p,
            ...apply(p),
          }),
          "回転するとぶつかります",
        );
      } else {
        orientation = apply(orientation);
        handle.update();
      }
    }

    // ---- pointer handling ---------------------------------------------------------------------

    function cellOf(event: PointerEvent): Point {
      const svg = event.currentTarget as SVGSVGElement;
      const rect = svg.getBoundingClientRect();
      const scale = (design.width + 2) * CELL / rect.width;
      return {
        x: Math.floor((event.clientX - rect.left) * scale / CELL) - 1,
        y: Math.floor((event.clientY - rect.top) * scale / CELL) - 1,
      };
    }

    function pointerDown(event: PointerEvent): void {
      if (stage === undefined || event.button !== 0) return;
      try {
        (event.currentTarget as Element).setPointerCapture(event.pointerId);
      } catch {
        // Synthetic events carry no capturable pointer; nothing depends on the capture.
      }
      const p = cellOf(event);
      message = undefined;

      const slot = edit.slotAt(design, p);
      if (slot !== undefined) {
        const pin = edit.pinAt(design, slot);
        drag = pin === undefined
          ? { kind: "idle" }
          : { kind: "pin", index: pin, moved: false };
        handle.update();
        return;
      }
      if (!edit.inBoard(design, p)) {
        drag = { kind: "idle" };
        return;
      }

      switch (tool.kind) {
        case "wire":
        case "bus":
          drag = { kind: "wire", last: p, bus: tool.kind === "bus" };
          break;
        case "erase":
          drag = { kind: "erase" };
          commit(edit.clearCell(design, library, p));
          break;
        case "cross":
          drag = { kind: "idle" };
          commit(edit.setCross(design, library, p));
          break;
        case "place":
          if (event.pointerType === "touch") {
            // A finger hides the cell under it, so show the ghost first and place on release.
            drag = { kind: "placing", componentId: tool.componentId };
            hover = p;
            handle.update();
            break;
          }
          drag = { kind: "idle" };
          commit(
            edit.addPlacement(design, library, {
              componentId: tool.componentId,
              ...p,
              ...orientation,
            }),
            "そこには置けません",
          );
          break;
        case "select": {
          const index = edit.placementAt(design, library, p);
          selected = index;
          if (index === undefined) {
            drag = { kind: "idle" };
          } else {
            const placement = design.placements[index];
            drag = {
              kind: "move",
              index,
              offset: { x: p.x - placement.x, y: p.y - placement.y },
              moved: false,
            };
          }
          handle.update();
        }
      }
    }

    function pointerMove(event: PointerEvent): void {
      if (stage === undefined) return;
      const p = cellOf(event);
      const changedCell = hover === undefined || hover.x !== p.x ||
        hover.y !== p.y;
      hover = p;
      if (drag === undefined) {
        if (changedCell && tool.kind === "place") handle.update();
        return;
      }
      if (!changedCell) return;
      switch (drag.kind) {
        case "placing":
          handle.update();
          break;
        case "wire": {
          // Walk one cell at a time so a fast drag still leaves a continuous wire.
          let next = design;
          let last = drag.last;
          while (last.x !== p.x || last.y !== p.y) {
            const step = last.x !== p.x
              ? { x: last.x + Math.sign(p.x - last.x), y: last.y }
              : { x: last.x, y: last.y + Math.sign(p.y - last.y) };
            next = edit.connect(next, library, last, step, drag.bus);
            last = step;
          }
          drag.last = edit.inBoard(design, p) ? p : drag.last;
          commit(next);
          break;
        }
        case "erase":
          if (edit.inBoard(design, p)) {
            commit(edit.clearCell(design, library, p));
          }
          break;
        case "move":
          drag.moved = true;
          drag.to = { x: p.x - drag.offset.x, y: p.y - drag.offset.y };
          handle.update();
          break;
        case "pin": {
          // Dragging from a pin into the board draws a wire from it instead of moving it.
          const pin = design.pins[drag.index];
          const inside = pinCell(design, pin);
          if (
            (tool.kind === "wire" || tool.kind === "bus") && p.x === inside.x &&
            p.y === inside.y
          ) {
            const bus = pinWidth(pin) > 1;
            drag = { kind: "wire", last: p, bus };
            commit(
              edit.connect(design, library, outsideOf(design, pin), p, bus),
            );
            break;
          }
          drag.moved = true;
          drag.to = edit.slotAt(design, p);
          handle.update();
          break;
        }
      }
    }

    function pointerUp(): void {
      if (drag === undefined) return;
      const finished = drag;
      drag = undefined;
      switch (finished.kind) {
        case "placing":
          if (hover !== undefined && edit.inBoard(design, hover)) {
            commit(
              edit.addPlacement(design, library, {
                componentId: finished.componentId,
                ...hover,
                ...orientation,
              }),
              "そこには置けません",
            );
          }
          break;
        case "move":
          if (finished.moved && finished.to !== undefined) {
            const placement = design.placements[finished.index];
            commit(
              edit.replacePlacement(design, library, finished.index, {
                ...placement,
                ...finished.to,
              }),
              "そこには置けません",
            );
          }
          break;
        case "pin": {
          const pin = design.pins[finished.index];
          if (!finished.moved) {
            if (pin.dir === "in") {
              const width = pinWidth(pin);
              const current = inputs[pin.name] ?? 0;
              const next = width === 1
                ? (current ? 0 : 1)
                : (current + 1) & MAX_BUS;
              setInputs({ ...inputs, [pin.name]: next });
            }
          } else if (finished.to !== undefined) {
            commit(
              edit.movePin(design, finished.index, finished.to),
              "そこには別のピンがあります",
            );
          }
          break;
        }
      }
      handle.update();
    }

    function pointerLeave(): void {
      hover = undefined;
      if (drag !== undefined) pointerUp();
      else handle.update();
    }

    // ---- rendering ----------------------------------------------------------------------------

    const px = (x: number) => (x + 1) * CELL;
    const centre = (x: number) => (x + 1.5) * CELL;

    /** CSS classes for something on `lanes`: lit if any lane is 1, red if any is shorted. */
    function netClass(lanes: number[] | undefined, base: string): string {
      if (lanes === undefined || live === undefined) return base;
      const values = live.nets;
      const on = lanes.some((net) => values[net] === 1);
      const error = live.error;
      const short = error?.kind === "short" &&
        lanes.some((net) => error.nets.includes(net));
      return `${base}${lanes.length > 1 ? " bus" : ""}${on ? " on" : ""}${
        short ? " short" : ""
      }`;
    }

    function renderCell(key: string, cell: Cell): RemixNode {
      const { x, y } = parseCellKey(key);
      const cx = centre(x);
      const cy = centre(y);
      const h = CELL / 2;
      const nets = netlist?.cellNets[key];
      if (cell.kind === "cross") {
        const ns = netClass(
          nets?.[0],
          `wire${cell.busNS && !nets ? " bus" : ""}`,
        );
        const ew = netClass(
          nets?.[1],
          `wire${cell.busEW && !nets ? " bus" : ""}`,
        );
        return (
          <g key={key}>
            <line x1={cx} y1={cy - h} x2={cx} y2={cy + h} class={ns} />
            <line x1={cx - h} y1={cy} x2={cx - 8} y2={cy} class={ew} />
            <line x1={cx + 8} y1={cy} x2={cx + h} y2={cy} class={ew} />
          </g>
        );
      }
      const cls = netClass(nets?.[0], `wire${cell.bus && !nets ? " bus" : ""}`);
      const ends: [boolean, number, number][] = [
        [cell.n, cx, cy - h],
        [cell.e, cx + h, cy],
        [cell.s, cx, cy + h],
        [cell.w, cx - h, cy],
      ];
      const count = ends.filter(([set]) => set).length;
      return (
        <g key={key}>
          {ends.filter(([set]) => set).map(([, x2, y2], i) => (
            <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} class={cls} />
          ))}
          {count !== 2
            ? (
              <circle
                cx={cx}
                cy={cy}
                r={count === 0 ? 3 : cell.bus ? 6 : 4.5}
                class={cls}
              />
            )
            : null}
        </g>
      );
    }

    function pinMark(
      wp: WorldPin,
      lanes: number[] | undefined,
      showName: boolean,
      small = false,
    ): RemixNode {
      const cx = centre(wp.x);
      const cy = centre(wp.y);
      const d = CELL / 2 - 4;
      const [mx, my] = wp.side === "n"
        ? [cx, cy - d]
        : wp.side === "s"
        ? [cx, cy + d]
        : wp.side === "w"
        ? [cx - d, cy]
        : [cx + d, cy];
      const [tx, ty] = wp.side === "n"
        ? [cx, cy - d + 11]
        : wp.side === "s"
        ? [cx, cy + d - 5]
        : wp.side === "w"
        ? [cx - d + 8, cy + 3]
        : [cx + d - 8, cy + 3];
      const bus = pinWidth(wp.pin) > 1;
      const cls = netClass(
        lanes,
        `pinmark ${wp.pin.dir}${bus && !lanes ? " bus" : ""}`,
      );
      const r = bus ? 5.5 : 3.5;
      return (
        <g key={wp.index}>
          {wp.pin.dir === "in"
            ? (
              <rect
                x={mx - r}
                y={my - r}
                width={2 * r}
                height={2 * r}
                class={cls}
              />
            )
            : <circle cx={mx} cy={my} r={r} class={cls} />}
          {showName
            ? (
              <text x={tx} y={ty} class={small ? "pinname small" : "pinname"}>
                {wp.pin.name}
              </text>
            )
            : null}
        </g>
      );
    }

    function renderPlacement(
      placement: Placement,
      index: number,
      ghost = false,
    ): RemixNode {
      const def = library.get(placement.componentId);
      if (def === undefined) return null;
      const { width, height } = footprint(def, placement);
      const x = px(placement.x);
      const y = px(placement.y);
      const nets = ghost ? undefined : netlist?.placementPinNets[index];
      const label = def.primitive === "relay-on"
        ? "on"
        : def.primitive === "relay-off"
        ? "off"
        : def.name;
      const pins = worldPins(def, placement);
      // A relay's label sits away from its control pin so the two never overlap.
      const labelOffset =
        def.primitive === undefined || def.primitive === "split"
          ? 4
          : pins.find((wp) => wp.pin.name === "c")?.side === "s"
          ? -6
          : 12;
      const cls = `part${def.primitive ? ` prim-${def.primitive}` : ""}${
        selected === index && !ghost ? " selected" : ""
      }${
        ghost
          ? (edit.canPlace(design, library, placement)
            ? " ghost"
            : " ghost bad")
          : ""
      }`;
      const vertical = def.primitive === "split" && height > width;
      return (
        <g key={ghost ? "ghost" : `p${index}`} class={cls}>
          <rect
            x={x + 2}
            y={y + 2}
            width={width * CELL - 4}
            height={height * CELL - 4}
            rx={4}
          />
          <text
            x={x + width * CELL / 2}
            y={y + height * CELL / 2 + labelOffset}
            class={def.primitive && def.primitive !== "split"
              ? "label small"
              : "label"}
            transform={vertical
              ? `rotate(-90 ${x + width * CELL / 2} ${y + height * CELL / 2})`
              : undefined}
          >
            {label}
          </text>
          {pins.map((wp) =>
            pinMark(
              wp,
              nets?.[wp.index],
              def.primitive !== "one",
              def.primitive !== undefined,
            )
          )}
        </g>
      );
    }

    /** Whether a wire or a component pin inside the board faces this border slot. */
    function pinConnected(slot: { side: Side; index: number }): boolean {
      const cell = pinCell(design, slot);
      const here = design.cells[cellKey(cell.x, cell.y)];
      if (here?.kind === "wire" && here[slot.side]) return true;
      if (here?.kind === "cross") return true;
      return design.placements.some((p, i) => {
        const def = library.get(p.componentId);
        if (
          def === undefined || edit.placementAt(design, library, cell) !== i
        ) return false;
        return worldPins(def, p).some((wp) =>
          wp.x === cell.x && wp.y === cell.y && wp.side === slot.side
        );
      });
    }

    function renderBorderPin(index: number): RemixNode {
      const pin = design.pins[index];
      const at =
        drag?.kind === "pin" && drag.index === index && drag.to !== undefined
          ? drag.to
          : pin;
      const { x, y } = outsideOf(design, at);
      const bus = pinWidth(pin) > 1;
      const value = pin.dir === "in"
        ? inputs[pin.name] ?? 0
        : live?.outputs[pin.name] ?? 0;
      const lanes = netlist?.pinNets[index];
      const error = live?.error;
      const short = lanes !== undefined && error?.kind === "short" &&
        lanes.some((net) => error.nets.includes(net));
      // The stub between the pin and the board edge: solid once something inside faces the pin.
      const inside = pinCell(design, at);
      const dx = x - inside.x;
      const dy = y - inside.y;
      const stub = `stub${bus ? " bus" : ""}${
        pinConnected(at) ? " connected" : ""
      }`;
      const cx = centre(x);
      const cy = centre(y);
      const r = bus ? 13 : 11;
      // A bus pin shows its value; its name goes to the outer corner of the margin cell.
      const [nx, ny] = at.side === "n"
        ? [cx, cy - 13]
        : at.side === "s"
        ? [cx, cy + 15.5]
        : at.side === "w"
        ? [cx - 8, cy - 11]
        : [cx + 8, cy - 11];
      return (
        <g
          key={`pin${index}`}
          class={`pin ${pin.dir}${bus ? " bus" : ""}${value ? " on" : ""}${
            short ? " short" : ""
          }`}
        >
          <line
            x1={cx - dx * r}
            y1={cy - dy * r}
            x2={cx - dx * (CELL / 2)}
            y2={cy - dy * (CELL / 2)}
            class={netClass(lanes, stub)}
          />
          <circle cx={cx} cy={cy} r={r} />
          {bus
            ? (
              <>
                <text x={cx} y={cy + 3.5}>{value}</text>
                <text x={nx} y={ny} class="busname">{pin.name}</text>
              </>
            )
            : <text x={cx} y={cy + 3.5}>{pin.name}</text>}
        </g>
      );
    }

    function renderBoard(): RemixNode {
      const w = (design.width + 2) * CELL;
      const h = (design.height + 2) * CELL;
      const problemCells = new Set(
        problems.flatMap((p) => p.cells ?? []).map((c) => cellKey(c.x, c.y)),
      );
      const ghost = tool.kind === "place" && hover !== undefined &&
          (drag === undefined || drag.kind === "placing") &&
          edit.inBoard(design, hover)
        ? { componentId: tool.componentId, ...hover, ...orientation }
        : drag?.kind === "move" && drag.to !== undefined
        ? { ...design.placements[drag.index], ...drag.to }
        : undefined;
      return (
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width={w}
          height={h}
          style={`max-width:${w * 2}px`}
          class={`board tool-${tool.kind}`}
          mix={[
            on("pointerdown", (event) => pointerDown(event as PointerEvent)),
            on("pointermove", (event) => pointerMove(event as PointerEvent)),
            on("pointerup", pointerUp),
            on("pointerleave", pointerLeave),
          ]}
        >
          <rect
            x={CELL}
            y={CELL}
            width={design.width * CELL}
            height={design.height * CELL}
            class="board-bg"
          />
          {Array.from({ length: design.width + 1 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={px(i)}
              y1={CELL}
              x2={px(i)}
              y2={CELL + design.height * CELL}
              class="grid"
            />
          ))}
          {Array.from({ length: design.height + 1 }, (_, i) => (
            <line
              key={`h${i}`}
              x1={CELL}
              y1={px(i)}
              x2={CELL + design.width * CELL}
              y2={px(i)}
              class="grid"
            />
          ))}
          {[...problemCells].map((key) => {
            const { x, y } = parseCellKey(key);
            return (
              <rect
                key={`bad${key}`}
                x={px(x)}
                y={px(y)}
                width={CELL}
                height={CELL}
                class="problem"
              />
            );
          })}
          {Object.entries(design.cells).map(([key, cell]) =>
            renderCell(key, cell)
          )}
          {design.placements.map((p, i) => renderPlacement(p, i))}
          {ghost ? renderPlacement(ghost, -1, true) : null}
          {design.pins.map((_, i) => renderBorderPin(i))}
        </svg>
      );
    }

    function toolButton(t: Tool, label: string): RemixNode {
      const active = t.kind === tool.kind &&
        (t.kind !== "place" ||
          (tool.kind === "place" && tool.componentId === t.componentId));
      return (
        <button
          type="button"
          class={active ? "active" : ""}
          mix={[on("click", () => {
            tool = t;
            if (t.kind !== "select") selected = undefined;
            handle.update();
          })]}
        >
          {label}
        </button>
      );
    }

    function partButton(def: ComponentDef): RemixNode {
      return toolButton(
        { kind: "place", componentId: def.id },
        def.primitive && def.primitive !== "split"
          ? def.name
          : `${def.name} (${def.width}×${def.height})`,
      );
    }

    function sizeInput(which: "width" | "height"): RemixNode {
      const max = stage?.maxSize[which] ?? 64;
      return (
        <input
          key={`${which}-${design[which]}`}
          type="number"
          min={1}
          max={max}
          defaultValue={String(design[which])}
          mix={[on("change", (event) => {
            const input = event.currentTarget as HTMLInputElement;
            const value = Math.min(max, Number(input.value));
            const next = which === "width"
              ? edit.resize(design, library, value, design.height)
              : edit.resize(design, library, design.width, value);
            if (next === undefined) input.value = String(design[which]);
            commit(
              next,
              "空いている行や列がありません。端の配線や部品、ピンをどかしてください",
            );
          })]}
        />
      );
    }

    /** Number fields for the bus inputs; single inputs are toggled on the board. */
    function renderBusInputs(): RemixNode {
      const buses = stage?.inputs.filter((p) => p.width > 1) ?? [];
      if (buses.length === 0) return null;
      return (
        <div class="group bus-inputs">
          {buses.map((spec) => (
            <label key={spec.name}>
              {spec.name}
              <input
                key={`${spec.name}-${inputs[spec.name] ?? 0}`}
                type="number"
                min={0}
                max={MAX_BUS}
                defaultValue={String(inputs[spec.name] ?? 0)}
                mix={[on("change", (event) => {
                  const input = event.currentTarget as HTMLInputElement;
                  const value = Math.max(
                    0,
                    Math.min(MAX_BUS, Math.floor(Number(input.value)) || 0),
                  );
                  setInputs({ ...inputs, [spec.name]: value });
                })]}
              />
            </label>
          ))}
        </div>
      );
    }

    function fmt(values: Record<string, number>): string {
      return Object.entries(values).map(([k, v]) => `${k}=${v}`).join(" ");
    }

    function specList(specs: readonly PinSpec[]): string {
      return specs.map((p) => p.width > 1 ? `${p.name}[${p.width}]` : p.name)
        .join(", ");
    }

    function renderTests(): RemixNode {
      const passed = tests.filter((t) => t.ok).length;
      const allPassed = problems.length === 0 && tests.length > 0 &&
        passed === tests.length;
      return (
        <section class="tests">
          <h3>
            テスト {problems.length === 0 ? `${passed} / ${tests.length}` : ""}
            {tests.length > 0
              ? (
                <button type="button" class="play" mix={[on("click", play)]}>
                  {playing === undefined ? "▶ 再生" : "■ 停止"}
                </button>
              )
              : null}
          </h3>
          {problems.length > 0
            ? (
              <ul class="problems">
                {problems.map((p, i) => <li key={i}>{p.message}</li>)}
              </ul>
            )
            : null}
          {live?.error
            ? (
              <p class="sim-error">
                {live.error.kind === "short"
                  ? "短絡しています（赤いネット）"
                  : "発振しています"}
              </p>
            )
            : null}
          {allPassed
            ? (
              <div class="register">
                <p class="pass">すべて合格。面積 {area(design)}。</p>
                {registered !== undefined
                  ? (
                    <p>
                      「{registered}」をライブラリに登録しました。左の部品一覧から置けます。
                    </p>
                  )
                  : (
                    <form
                      mix={[on("submit", (event) => {
                        event.preventDefault();
                        const form = event.currentTarget as HTMLFormElement;
                        const input = form.elements.namedItem(
                          "name",
                        ) as HTMLInputElement;
                        registerComponent(input.value);
                      })]}
                    >
                      <input
                        key={`name-${design.width}x${design.height}`}
                        name="name"
                        type="text"
                        defaultValue={`${
                          stage!.title
                        } ${design.width}×${design.height}`}
                      />
                      <button type="submit">部品として登録</button>
                    </form>
                  )}
              </div>
            )
            : null}
          {tests.length > 0
            ? (
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>入力</th>
                    <th>期待</th>
                    <th>結果</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((r, i) => (
                    <tr
                      key={i}
                      class={`${r.ok ? "ok" : "ng"}${
                        shown === i ? " shown" : ""
                      }`}
                      mix={[on("click", () => showStep(i))]}
                    >
                      <td>{r.ok ? "✓" : "✗"}</td>
                      <td>{fmt(r.step.set)}</td>
                      <td>{fmt(r.step.expect)}</td>
                      <td>{r.error ? r.error.kind : fmt(r.actual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
            : null}
        </section>
      );
    }

    return () => {
      if (missing !== undefined) {
        return (
          <p>
            ステージ「{missing}」はありません。<a
              href={handle.props.base || "/"}
            >
              ステージ一覧へ
            </a>
          </p>
        );
      }
      if (stage === undefined) return <p>読み込み中…</p>;
      const current = stage;
      const byStage = STAGES
        .map((s) => ({
          stage: s,
          components: save.components.filter((c) => c.stageId === s.id),
        }))
        .filter((g) => g.components.length > 0);
      const target = par(current.id);
      return (
        <div class="editor">
          <header class="stage-head">
            <h1>{current.title}</h1>
            <p>{current.description}</p>
            <p class="meta">
              <span>入力 {specList(current.inputs)}</span>
              <span>出力 {specList(current.outputs)}</span>
            </p>
            <p class="meta">
              <span>
                面積 <strong>{area(design)}</strong>
              </span>
              {target !== undefined ? <span>パー {target}</span> : null}
              {save.best[current.id] !== undefined
                ? <span>自己ベスト {save.best[current.id]}</span>
                : null}
            </p>
          </header>
          <div class="workspace">
            <div class="board-wrap">{renderBoard()}</div>
            <aside class="side">
              <div class="toolbar">
                <div class="group">
                  {toolButton({ kind: "select" }, "選択 (v)")}
                  {toolButton({ kind: "wire" }, "配線 (w)")}
                  {toolButton({ kind: "bus" }, "バス (b)")}
                  {toolButton({ kind: "cross" }, "交差 (x)")}
                  {toolButton({ kind: "erase" }, "消去 (e)")}
                </div>
                <div class="group">
                  <span class="group-title">素子</span>
                  {PRIMITIVES.map(partButton)}
                </div>
                {byStage.length > 0
                  ? <span class="group-title">ライブラリ</span>
                  : null}
                {byStage.map((g) => (
                  <div class="group" key={g.stage.id}>
                    <span class="group-title sub">{g.stage.title}</span>
                    {g.components.map(partButton)}
                  </div>
                ))}
                <div class="group">
                  <button
                    type="button"
                    mix={[on("click", () => transform("rotate"))]}
                  >
                    回転 (r)
                  </button>
                  <button
                    type="button"
                    mix={[on("click", () => transform("mirror"))]}
                  >
                    反転 (f)
                  </button>
                  <span class="hint">
                    {orientation.rotation * 90}°{orientation.mirror
                      ? " 反転"
                      : ""}
                  </span>
                </div>
                <div class="group">
                  <label>幅 {sizeInput("width")}</label>
                  <label>高さ {sizeInput("height")}</label>
                </div>
                <div class="group">
                  <button
                    type="button"
                    disabled={history.length === 0}
                    mix={[on("click", undo)]}
                  >
                    元に戻す (Ctrl+Z)
                  </button>
                  <button
                    type="button"
                    mix={[on("click", () => {
                      selected = undefined;
                      commit(edit.defaultDesign(current));
                    })]}
                  >
                    盤面を空にする
                  </button>
                </div>
                {renderBusInputs()}
                {message ? <p class="message">{message}</p> : null}
                <p class="hint">
                  配線ツールで盤面をドラッグすると線が引ける。端のマスから外のピンへ向かってドラッグすると、ピンにつながる。
                  部品の端子（小さな四角が入力、丸が出力）へも同じように引く。端子同士を隣接させれば配線なしでつながる。
                </p>
                <p class="hint">
                  バスは 8 本をまとめた配線で、太く描かれる。1
                  本の配線とは直接つながらず、Bus split でばらす。
                  バスの入力ピンはクリックで 1
                  ずつ増え、上の欄で値を直接入れられる。
                </p>
                <p class="hint">
                  入力ピンはクリックで
                  on/off。ピンは外周をドラッグで移動。部品は選択してドラッグで移動、Delete
                  で削除。
                </p>
              </div>
              {renderTests()}
              {renderAchievements()}
            </aside>
          </div>
        </div>
      );
    };
  },
);
