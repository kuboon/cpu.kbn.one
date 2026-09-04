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
import {
  footprint,
  mirrorSymmetric,
  pinCell,
  worldPins,
} from "../lib/game/transform.ts";
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

/** Zoom bounds, in screen pixels per cell. The low end is for a whole CPU on a phone. */
const MIN_ZOOM = 10;
const MAX_ZOOM = 72;
/** The zoom ladder the + and − buttons step along. */
const ZOOM_STEP = 1.25;
/** At or above this width the side panel opens with the page; below it, it starts as a sheet. */
const WIDE = 1100;

type Tab = "parts" | "tests" | "board";

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

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
    /** Screen pixels per cell; undefined until the viewport has been measured. */
    let zoom: number | undefined;
    /** Once the player zooms, a window resize stops refitting the board for them. */
    let zoomedByHand = false;
    let panelOpen = false;
    let tab: Tab = "parts";
    let infoOpen = false;
    /** The parts placed most recently, newest first; the shortcut row at the top of 部品. */
    let recent: string[] = [];
    let sortBy: "area" | "new" = "area";
    let search = "";
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

    function viewport(): HTMLElement | null {
      return document.querySelector<HTMLElement>(".viewport");
    }

    /** The zoom that would show the whole board, margin included, inside the viewport. */
    function fitZoom(): number {
      const el = viewport();
      if (el === null) return 32;
      const wide = el.clientWidth / (design.width + 2);
      const tall = el.clientHeight / (design.height + 2);
      return clamp(Math.min(wide, tall), MIN_ZOOM, MAX_ZOOM);
    }

    function fit(): void {
      zoom = fitZoom();
      zoomedByHand = false;
      handle.update();
      requestAnimationFrame(centreView);
    }

    function setZoom(next: number): void {
      const el = viewport();
      const before = el === null ? undefined : {
        x: (el.scrollLeft + el.clientWidth / 2) / (zoom ?? 32),
        y: (el.scrollTop + el.clientHeight / 2) / (zoom ?? 32),
      };
      zoom = clamp(next, MIN_ZOOM, MAX_ZOOM);
      zoomedByHand = true;
      handle.update();
      // Keep whatever was in the middle of the viewport in the middle of it.
      if (el !== null && before !== undefined) {
        requestAnimationFrame(() => {
          el.scrollLeft = before.x * zoom! - el.clientWidth / 2;
          el.scrollTop = before.y * zoom! - el.clientHeight / 2;
        });
      }
    }

    function centreView(): void {
      const el = viewport();
      if (el === null) return;
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
      el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
    }

    function openPanel(next: Tab): void {
      tab = next;
      panelOpen = true;
      handle.update();
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

    /** Moves a part to the front of the shortcut row, keeping the four most recent. */
    function remember(componentId: string): void {
      recent = [componentId, ...recent.filter((id) => id !== componentId)]
        .slice(0, 4);
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
      panelOpen = globalThis.matchMedia(`(min-width: ${WIDE}px)`).matches;
      rebuild();
      handle.update();
      requestAnimationFrame(fit);
    }

    /** A resize changes what fits, so refit — unless the player has set the zoom themselves. */
    function onResize(): void {
      if (zoomedByHand) return;
      fit();
    }

    // Only in the browser: the server render is the placeholder below.
    if (typeof document !== "undefined") {
      setTimeout(init, 0);
      globalThis.addEventListener("keydown", onKey, { signal: handle.signal });
      globalThis.addEventListener("resize", onResize, {
        signal: handle.signal,
      });
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

    /**
     * What 回転 and 反転 would turn: the selected part, else the one about to be placed. Both
     * the bar over the board and the r / f keys work on it.
     */
    function orientTarget():
      | { def: ComponentDef; placement: Placement; index?: number }
      | undefined {
      if (selected !== undefined && tool.kind === "select") {
        const placement = design.placements[selected];
        const def = library.get(placement.componentId);
        return def === undefined
          ? undefined
          : { def, placement, index: selected };
      }
      if (tool.kind === "place") {
        const def = library.get(tool.componentId);
        return def === undefined ? undefined : {
          def,
          placement: {
            componentId: tool.componentId,
            x: 0,
            y: 0,
            ...orientation,
          },
        };
      }
      return undefined;
    }

    function transform(how: "rotate" | "mirror"): void {
      // Mirroring a part whose pins map onto themselves changes nothing, so it is not offered.
      const target = orientTarget();
      if (
        how === "mirror" && target !== undefined && mirrorSymmetric(target.def)
      ) {
        return;
      }
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
          remember(tool.componentId);
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
            remember(finished.componentId);
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
      const scale = (zoom ?? 32) / CELL;
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
          width={Math.round(w * scale)}
          height={Math.round(h * scale)}
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

    /**
     * The part's footprint, drawn to scale. Area is the score, so what a card most needs to say
     * is its shape and its size — XOR 4×3 and XOR 6×2 are one word apart and nothing alike.
     */
    function sizeGlyph(def: ComponentDef): RemixNode {
      const step = clamp(
        Math.floor(30 / Math.max(def.width, def.height)),
        3,
        8,
      );
      const w = def.width * step;
      const h = def.height * step;
      return (
        <svg
          class="size-glyph"
          width={w + 2}
          height={h + 2}
          viewBox={`0 0 ${w + 2} ${h + 2}`}
          aria-hidden="true"
        >
          <rect x="1" y="1" width={w} height={h} rx="1.5" />
          {Array.from({ length: def.width - 1 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={1 + (i + 1) * step}
              y1="1"
              x2={1 + (i + 1) * step}
              y2={1 + h}
            />
          ))}
          {Array.from({ length: def.height - 1 }, (_, i) => (
            <line
              key={`h${i}`}
              x1="1"
              y1={1 + (i + 1) * step}
              x2={1 + w}
              y2={1 + (i + 1) * step}
            />
          ))}
        </svg>
      );
    }

    /** `smallest` marks the tightest build of a function, which is the one worth reaching for. */
    function partButton(def: ComponentDef, smallest = false): RemixNode {
      const active = tool.kind === "place" && tool.componentId === def.id;
      return (
        <button
          key={def.id}
          type="button"
          class={`part-card${active ? " active" : ""}`}
          mix={[on("click", () => {
            tool = { kind: "place", componentId: def.id };
            selected = undefined;
            handle.update();
          })]}
        >
          {sizeGlyph(def)}
          <span class="text">
            <span class="name">
              {def.name}
              {smallest ? <em>最小</em> : null}
            </span>
            <small>
              {def.width}×{def.height} ・ 面積 {def.width * def.height}
            </small>
          </span>
        </button>
      );
    }

    /** Area first, so the cheapest build of a function is the one at the top. */
    function sorted(components: ComponentDef[]): ComponentDef[] {
      return [...components].sort((a, b) =>
        sortBy === "new"
          ? b.createdAt.localeCompare(a.createdAt)
          : a.width * a.height - b.width * b.height ||
            a.name.localeCompare(b.name)
      );
    }

    function matches(def: ComponentDef): boolean {
      const q = search.trim().toLowerCase();
      return q === "" || def.name.toLowerCase().includes(q);
    }

    function renderParts(): RemixNode {
      const groups = STAGES
        .map((s) => {
          const components = sorted(
            save.components.filter((c) => c.stageId === s.id && matches(c)),
          );
          return {
            stage: s,
            components,
            smallest: Math.min(
              ...components.map((c) => c.width * c.height),
            ),
          };
        })
        .filter((g) => g.components.length > 0);
      const shortcuts = recent
        .map((id) => library.get(id))
        .filter((d): d is ComponentDef => d !== undefined);
      const many = save.components.length > 6;
      return (
        <div class="parts">
          {many
            ? (
              <div class="part-search">
                <input
                  key="part-search"
                  type="text"
                  placeholder="名前で探す"
                  defaultValue={search}
                  mix={[on("input", (event) => {
                    search = (event.currentTarget as HTMLInputElement).value;
                    handle.update();
                  })]}
                />
                <div class="sort">
                  <span>並び</span>
                  {(["area", "new"] as const).map((how) => (
                    <button
                      key={how}
                      type="button"
                      class={sortBy === how ? "active" : ""}
                      mix={[on("click", () => {
                        sortBy = how;
                        handle.update();
                      })]}
                    >
                      {how === "area" ? "面積の小さい順" : "登録が新しい順"}
                    </button>
                  ))}
                </div>
              </div>
            )
            : null}
          {shortcuts.length > 0
            ? (
              <>
                <span class="group-title">よく使う</span>
                <div class="part-grid">
                  {shortcuts.map((def) => partButton(def))}
                </div>
              </>
            )
            : null}
          <span class="group-title">素子</span>
          <div class="part-grid">
            {PRIMITIVES.filter(matches).map((def) => partButton(def))}
          </div>
          {groups.length > 0
            ? <span class="group-title">ライブラリ</span>
            : null}
          {groups.map((g) => (
            <div key={g.stage.id}>
              <span class="group-title sub">{g.stage.title}</span>
              <div class="part-grid">
                {g.components.map((def) => (
                  partButton(
                    def,
                    g.components.length > 1 &&
                      def.width * def.height === g.smallest,
                  )
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && search.trim() !== ""
            ? <p class="hint">その名前の部品はありません。</p>
            : null}
        </div>
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

    /** The stage's own explanation, folded away behind the ⓘ in the bar. */
    function renderInfo(current: Stage): RemixNode {
      if (!infoOpen) return null;
      return (
        <div class="info-panel">
          <p>{current.description}</p>
          <p class="meta">
            <span>入力 {specList(current.inputs)}</span>
            <span>出力 {specList(current.outputs)}</span>
          </p>
          <p class="hint">
            配線ツールで盤面をドラッグすると線が引けます。端のマスから外のピンへ向かってドラッグすると、ピンにつながります。
            部品の端子（小さな四角が入力、丸が出力）へも同じように引きます。端子同士を隣接させれば配線なしでつながります。
          </p>
          <p class="hint">
            バスは 8 本をまとめた配線で、太く描かれます。1
            本の配線とは直接つながらず、Bus split でばらします。
            バスの入力ピンはクリックで 1
            ずつ増え、テストのタブで値を直接入れられます。
          </p>
          <p class="hint">
            入力ピンはクリックで
            on/off。ピンは外周をドラッグで移動。部品は選択してドラッグで移動、Delete
            で削除。キーは v 選択 / w 配線 / b バス / x 交差 / e 消去 / r 回転 /
            f 反転。
          </p>
        </div>
      );
    }

    /** One tool, in the dock on a phone and in the rail on a wide screen — the same element. */
    function dockButton(t: Tool, label: string, icon: RemixNode): RemixNode {
      const active = t.kind === tool.kind &&
        (t.kind !== "place" ||
          (tool.kind === "place" && tool.componentId === t.componentId));
      return (
        <button
          type="button"
          class={`dock-button${active ? " active" : ""}`}
          mix={[on("click", () => {
            tool = t;
            if (t.kind !== "select") selected = undefined;
            handle.update();
          })]}
        >
          {icon}
          <span>{label}</span>
        </button>
      );
    }

    function icon(path: RemixNode, width = 2): RemixNode {
      return (
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width={String(width)}
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          {path}
        </svg>
      );
    }

    function renderTools(): RemixNode {
      return (
        <div class="tools">
          {dockButton(
            { kind: "select" },
            "選択",
            icon(<path d="M5 3l14 8-6 1.6L9.6 19z" />, 1.8),
          )}
          {dockButton(
            { kind: "wire" },
            "配線",
            icon(<path d="M3 18h7V6h11" />),
          )}
          {dockButton(
            { kind: "bus" },
            "バス",
            icon(<path d="M3 18h7V6h11" />, 4.5),
          )}
          {dockButton(
            { kind: "cross" },
            "交差",
            icon(
              <>
                <path d="M3 12h18" />
                <path d="M12 3v5" />
                <path d="M12 16v5" />
              </>,
            ),
          )}
          {dockButton(
            { kind: "erase" },
            "消去",
            icon(
              <>
                <path d="M6 16l7-7 5 5-4 4H8z" />
                <path d="M3 20h18" />
              </>,
              1.8,
            ),
          )}
          <button
            type="button"
            class={`dock-button${tool.kind === "place" ? " active" : ""}`}
            mix={[on("click", () => openPanel("parts"))]}
          >
            {icon(
              <>
                <rect x="7" y="7" width="10" height="10" rx="2" />
                <path d="M12 3v4" />
                <path d="M12 17v4" />
                <path d="M3 12h4" />
                <path d="M17 12h4" />
              </>,
              1.8,
            )}
            <span>部品</span>
          </button>
          <button
            type="button"
            class="dock-button undo"
            disabled={history.length === 0}
            mix={[on("click", undo)]}
          >
            {icon(
              <>
                <path d="M9 7L4 12l5 5" />
                <path d="M4 12h11a5 5 0 0 1 0 10h-3" />
              </>,
            )}
            <span>取消</span>
          </button>
        </div>
      );
    }

    /**
     * The bar over the board while a part is in hand or selected: which way it is facing, and the
     * two controls that change it. The glyph is the real footprint with the first pin marked, so
     * a rotation is visible as a rotation rather than as the word "90°".
     */
    function renderOrientBar(): RemixNode {
      const target = orientTarget();
      if (target === undefined) return null;
      const { def, placement } = target;
      const shape = footprint(def, placement);
      const first = worldPins(def, { ...placement, x: 0, y: 0 })[0];
      const step = clamp(
        Math.floor(26 / Math.max(shape.width, shape.height)),
        4,
        9,
      );
      const symmetric = mirrorSymmetric(def);
      return (
        <div class="orient">
          <svg
            class="size-glyph"
            width={shape.width * step + 2}
            height={shape.height * step + 2}
            aria-hidden="true"
          >
            {first !== undefined
              ? (
                <rect
                  class="pin-cell"
                  x={1 + first.x * step}
                  y={1 + first.y * step}
                  width={step}
                  height={step}
                />
              )
              : null}
            <rect
              x="1"
              y="1"
              width={shape.width * step}
              height={shape.height * step}
              rx="1.5"
            />
            {Array.from({ length: shape.width - 1 }, (_, i) => (
              <line
                key={`v${i}`}
                x1={1 + (i + 1) * step}
                y1="1"
                x2={1 + (i + 1) * step}
                y2={1 + shape.height * step}
              />
            ))}
            {Array.from({ length: shape.height - 1 }, (_, i) => (
              <line
                key={`h${i}`}
                x1="1"
                y1={1 + (i + 1) * step}
                x2={1 + shape.width * step}
                y2={1 + (i + 1) * step}
              />
            ))}
          </svg>
          <span class="text">
            <span class="name">{def.name}</span>
            <small>
              {shape.width}×{shape.height} ・ {placement.rotation * 90}°
              {placement.mirror && !symmetric ? " 反転" : ""}
            </small>
          </span>
          <button
            type="button"
            title="回転 (r)"
            mix={[on("click", () => transform("rotate"))]}
          >
            {icon(
              <>
                <path d="M20 11a8 8 0 1 0-2.3 6.1" />
                <path d="M20 4v7h-7" />
              </>,
            )}
          </button>
          {symmetric ? <span class="symmetric">左右対称</span> : (
            <button
              type="button"
              class={placement.mirror ? "active" : ""}
              title="反転 (f)"
              mix={[on("click", () => transform("mirror"))]}
            >
              {icon(
                <>
                  <path d="M12 3v18" />
                  <path d="M8 7L3 12l5 5" />
                  <path d="M16 7l5 5-5 5" />
                </>,
              )}
            </button>
          )}
        </div>
      );
    }

    function renderPanel(current: Stage): RemixNode {
      const tabButton = (id: Tab, label: string) => (
        <button
          type="button"
          class={tab === id ? "active" : ""}
          mix={[on("click", () => {
            tab = id;
            handle.update();
          })]}
        >
          {label}
        </button>
      );
      return (
        <aside class="panel">
          <div class="grabber" />
          <div class="tabs">
            {tabButton("parts", "部品")}
            {tabButton("tests", "テスト")}
            {tabButton("board", "盤面")}
            <button
              type="button"
              class="collapse"
              title="パネルを畳む"
              mix={[on("click", () => {
                panelOpen = false;
                handle.update();
              })]}
            >
              {icon(<path d="M9 5l7 7-7 7" />)}
            </button>
          </div>
          <div class="panel-body">
            {tab === "parts" ? renderParts() : null}
            {tab === "tests"
              ? (
                <div class="toolbar">
                  {renderBusInputs()}
                  {renderTests()}
                  {renderAchievements()}
                </div>
              )
              : null}
            {tab === "board"
              ? (
                <div class="toolbar">
                  <div class="group">
                    <label>幅 {sizeInput("width")}</label>
                    <label>高さ {sizeInput("height")}</label>
                  </div>
                  <p class="hint">
                    面積 {area(design)}{" "}
                    がそのままスコアです。縮めるときは、空いている行や列から削られます。
                  </p>
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
                </div>
              )
              : null}
          </div>
        </aside>
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
      const index = STAGES.findIndex((s) => s.id === current.id);
      const target = par(current.id);
      const passed = tests.filter((t) => t.ok).length;
      const allPassed = problems.length === 0 && tests.length > 0 &&
        passed === tests.length;
      const base = handle.props.base;
      const stageHref = (s: Stage) => `${base}/play/${s.id}`;
      return (
        <div class={`editor${panelOpen ? " panel-open" : ""}`}>
          <header class="app-bar">
            <a class="back" href={base || "/"}>
              {icon(<path d="M15 5l-7 7 7 7" />)}
              <span>ステージ一覧</span>
            </a>
            <div class="who">
              <h1>{current.title}</h1>
              <span>{index + 1} / {STAGES.length}</span>
            </div>
            <button
              type="button"
              class={`info${infoOpen ? " active" : ""}`}
              title="このステージの説明"
              mix={[on("click", () => {
                infoOpen = !infoOpen;
                handle.update();
              })]}
            >
              {icon(
                <>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v5" />
                  <path d="M12 7.6v.1" />
                </>,
              )}
            </button>
            <span class="spacer" />
            <span class={`pill result${allPassed ? " pass" : ""}`}>
              テスト {passed} / {tests.length}
            </span>
            <span class="pill">
              面積 <strong>{area(design)}</strong>
              {target !== undefined ? <em>/ パー {target}</em> : null}
            </span>
            <nav class="stage-jump">
              {index > 0
                ? (
                  <a href={stageHref(STAGES[index - 1])}>
                    ← {STAGES[index - 1].title}
                  </a>
                )
                : null}
              {index < STAGES.length - 1
                ? (
                  <a href={stageHref(STAGES[index + 1])}>
                    {STAGES[index + 1].title} →
                  </a>
                )
                : null}
            </nav>
          </header>
          {renderInfo(current)}
          <div class="app-body">
            {renderTools()}
            <div class="board-col">
              <div class="stage">
                <div class="viewport">
                  {renderBoard()}
                </div>
                <div class="zoom">
                  <button
                    type="button"
                    title="拡大"
                    mix={[on("click", () => setZoom((zoom ?? 32) * ZOOM_STEP))]}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    title="縮小"
                    mix={[on("click", () => setZoom((zoom ?? 32) / ZOOM_STEP))]}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    title="全体を表示"
                    mix={[on("click", fit)]}
                  >
                    {icon(
                      <>
                        <path d="M4 9V4h5" />
                        <path d="M20 9V4h-5" />
                        <path d="M4 15v5h5" />
                        <path d="M20 15v5h-5" />
                      </>,
                    )}
                  </button>
                </div>
                {renderOrientBar()}
                {message ? <p class="message">{message}</p> : null}
              </div>
              <div class="status">
                <span>{design.width} × {design.height} マス</span>
                <span>1マス {Math.round(zoom ?? 32)}px</span>
              </div>
              <button
                type="button"
                class={`test-bar${allPassed ? " pass" : ""}`}
                mix={[on("click", () => openPanel("tests"))]}
              >
                <span class="mark">{allPassed ? "✓" : "…"}</span>
                <span class="count">テスト {passed} / {tests.length}</span>
                <span class="note">
                  {problems.length > 0
                    ? problems[0].message
                    : allPassed
                    ? "すべて合格"
                    : ""}
                </span>
                <span class="spacer" />
                {icon(<path d="M6 15l6-6 6 6" />)}
              </button>
            </div>
            {renderPanel(current)}
          </div>
          {panelOpen
            ? (
              <div
                class="scrim"
                mix={[on("click", () => {
                  panelOpen = false;
                  handle.update();
                })]}
              />
            )
            : null}
        </div>
      );
    };
  },
);
