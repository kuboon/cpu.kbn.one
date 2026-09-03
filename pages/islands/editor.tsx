import { on } from "@remix-run/ui";
import type { Handle, RemixNode } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";

import type {
  Bit,
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
  cellKey,
  createLibrary,
  parseCellKey,
  PRIMITIVES,
} from "../lib/game/model.ts";
import { footprint, pinCell, worldPins } from "../lib/game/transform.ts";
import type { WorldPin } from "../lib/game/transform.ts";
import { outsideOf } from "../lib/game/netlist.ts";
import type { Netlist, Problem } from "../lib/game/netlist.ts";
import { Simulator } from "../lib/game/sim.ts";
import type { EvalResult } from "../lib/game/sim.ts";
import { verify } from "../lib/game/verify.ts";
import type { Step, StepResult } from "../lib/game/verify.ts";
import { findStage } from "../lib/game/stages/index.ts";
import type { Stage } from "../lib/game/stages/index.ts";
import { par } from "../lib/game/reference.ts";
import * as edit from "../lib/game/edit.ts";
import type { Point, Slot } from "../lib/game/edit.ts";
import { loadSave, storeSave } from "../lib/game/browser-storage.ts";
import { emptySave } from "../lib/game/storage.ts";
import type { SaveData } from "../lib/game/storage.ts";

/** Pixels per cell in the SVG's own coordinates; the drawing scales to its container. */
const CELL = 32;

type Tool =
  | { kind: "select" }
  | { kind: "wire" }
  | { kind: "cross" }
  | { kind: "erase" }
  | { kind: "place"; componentId: string };

type Drag =
  | { kind: "wire"; last: Point }
  | { kind: "erase" }
  | { kind: "move"; index: number; offset: Point; to?: Point; moved: boolean }
  | { kind: "pin"; index: number; to?: Slot; moved: boolean }
  | { kind: "idle" };

const KEY_TOOLS: Record<string, Tool> = {
  v: { kind: "select" },
  w: { kind: "wire" },
  x: { kind: "cross" },
  e: { kind: "erase" },
};

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
    let inputs: Record<string, Bit> = {};
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

    /** Applies an edit: `undefined` means it was refused, and `why` is shown instead. */
    function commit(next: Design | undefined, why?: string): void {
      if (next === undefined) {
        message = why;
      } else if (next !== design) {
        history = [...history.slice(-99), design];
        design = next;
        message = undefined;
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

    function setInputs(next: Record<string, Bit>): void {
      inputs = next;
      live = sim?.evaluate(inputs);
      handle.update();
    }

    /** Replays the test steps up to `index` on the live simulator, so a latch shows its real state. */
    function showStep(index: number): void {
      if (stage === undefined || sim === undefined) return;
      sim.reset();
      inputs = {};
      for (let i = 0; i <= index; i++) {
        inputs = { ...inputs, ...stage.steps[i].set };
        live = sim.evaluate(stage.steps[i].set);
      }
      handle.update();
    }

    function init(): void {
      stage = findStage(handle.props.stageId);
      if (stage === undefined) {
        missing = handle.props.stageId;
        handle.update();
        return;
      }
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
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
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
          drag = { kind: "wire", last: p };
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
        case "wire": {
          // Walk one cell at a time so a fast drag still leaves a continuous wire.
          let next = design;
          let last = drag.last;
          while (last.x !== p.x || last.y !== p.y) {
            const step = last.x !== p.x
              ? { x: last.x + Math.sign(p.x - last.x), y: last.y }
              : { x: last.x, y: last.y + Math.sign(p.y - last.y) };
            next = edit.connect(next, library, last, step);
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
          if (tool.kind === "wire" && p.x === inside.x && p.y === inside.y) {
            drag = { kind: "wire", last: p };
            commit(edit.connect(design, library, outsideOf(design, pin), p));
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
              setInputs({ ...inputs, [pin.name]: inputs[pin.name] ? 0 : 1 });
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

    function netClass(net: number | undefined, base: string): string {
      if (net === undefined || live === undefined) return base;
      const value = live.nets[net];
      const short = live.error?.kind === "short" &&
        live.error.nets.includes(net);
      return `${base}${value === 1 ? " on" : ""}${short ? " short" : ""}`;
    }

    function renderCell(key: string, cell: Cell): RemixNode {
      const { x, y } = parseCellKey(key);
      const cx = centre(x);
      const cy = centre(y);
      const h = CELL / 2;
      const nets = netlist?.cellNets[key];
      if (cell.kind === "cross") {
        return (
          <g key={key}>
            <line
              x1={cx}
              y1={cy - h}
              x2={cx}
              y2={cy + h}
              class={netClass(nets?.[0], "wire")}
            />
            <line
              x1={cx - h}
              y1={cy}
              x2={cx - 7}
              y2={cy}
              class={netClass(nets?.[1], "wire")}
            />
            <line
              x1={cx + 7}
              y1={cy}
              x2={cx + h}
              y2={cy}
              class={netClass(nets?.[1], "wire")}
            />
          </g>
        );
      }
      const cls = netClass(nets?.[0], "wire");
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
            ? <circle cx={cx} cy={cy} r={count === 0 ? 3 : 4.5} class={cls} />
            : null}
        </g>
      );
    }

    function pinMark(
      wp: WorldPin,
      net: number | undefined,
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
      const cls = netClass(net, `pinmark ${wp.pin.dir}`);
      return (
        <g key={wp.index}>
          {wp.pin.dir === "in"
            ? (
              <rect
                x={mx - 3.5}
                y={my - 3.5}
                width={7}
                height={7}
                class={cls}
              />
            )
            : <circle cx={mx} cy={my} r={3.5} class={cls} />}
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
      const labelOffset = def.primitive === undefined
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
            class={def.primitive ? "label small" : "label"}
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

    function renderBorderPin(index: number): RemixNode {
      const pin = design.pins[index];
      const at =
        drag?.kind === "pin" && drag.index === index && drag.to !== undefined
          ? drag.to
          : pin;
      const { x, y } = outsideOf(design, at);
      const value = pin.dir === "in"
        ? inputs[pin.name] ?? 0
        : live?.outputs[pin.name] ?? 0;
      const net = netlist?.pinNets[index];
      const short = net !== undefined && live?.error?.kind === "short" &&
        live.error.nets.includes(net);
      // The stub between the pin and the board edge: solid once something inside faces the pin.
      const inside = pinCell(design, at);
      const dx = x - inside.x;
      const dy = y - inside.y;
      const stub = `stub${pinConnected(at) ? " connected" : ""}`;
      return (
        <g
          key={`pin${index}`}
          class={`pin ${pin.dir}${value ? " on" : ""}${short ? " short" : ""}`}
        >
          <line
            x1={centre(x) - dx * 11}
            y1={centre(y) - dy * 11}
            x2={centre(x) - dx * (CELL / 2)}
            y2={centre(y) - dy * (CELL / 2)}
            class={netClass(net, stub)}
          />
          <circle cx={centre(x)} cy={centre(y)} r={11} />
          <text x={centre(x)} y={centre(y) + 3.5}>{pin.name}</text>
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

    function renderBoard(): RemixNode {
      const w = (design.width + 2) * CELL;
      const h = (design.height + 2) * CELL;
      const problemCells = new Set(
        problems.flatMap((p) => p.cells ?? []).map((c) => cellKey(c.x, c.y)),
      );
      const ghost =
        tool.kind === "place" && hover !== undefined && drag === undefined &&
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

    function paletteEntry(def: ComponentDef): RemixNode {
      return toolButton(
        { kind: "place", componentId: def.id },
        def.primitive ? def.name : `${def.name} (${def.width}×${def.height})`,
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

    function fmt(bits: Record<string, Bit>): string {
      return Object.entries(bits).map(([k, v]) => `${k}=${v}`).join(" ");
    }

    function renderTests(): RemixNode {
      const passed = tests.filter((t) => t.ok).length;
      const allPassed = problems.length === 0 && tests.length > 0 &&
        passed === tests.length;
      return (
        <section class="tests">
          <h3>
            テスト {problems.length === 0 ? `${passed} / ${tests.length}` : ""}
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
            ? <p class="pass">すべて合格。面積 {area(design)}。</p>
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
                      class={r.ok ? "ok" : "ng"}
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

    function renderStep(step: Step): string {
      return fmt(step.set);
    }
    void renderStep;

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
      const registered = [...library.values()].filter((c) =>
        c.primitive === undefined
      );
      const target = par(stage.id);
      return (
        <div class="editor">
          <header class="stage-head">
            <h1>{stage.title}</h1>
            <p>{stage.description}</p>
            <p class="meta">
              <span>
                面積 <strong>{area(design)}</strong>
              </span>
              {target !== undefined ? <span>パー {target}</span> : null}
              {save.best[stage.id] !== undefined
                ? <span>自己ベスト {save.best[stage.id]}</span>
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
                  {toolButton({ kind: "cross" }, "交差 (x)")}
                  {toolButton({ kind: "erase" }, "消去 (e)")}
                </div>
                <div class="group">
                  {PRIMITIVES.map(paletteEntry)}
                </div>
                {registered.length > 0
                  ? <div class="group">{registered.map(paletteEntry)}</div>
                  : null}
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
                      commit(edit.defaultDesign(stage!));
                    })]}
                  >
                    盤面を空にする
                  </button>
                </div>
                {message ? <p class="message">{message}</p> : null}
                <p class="hint">
                  配線ツールで盤面をドラッグすると線が引ける。端のマスから外のピンへ向かってドラッグすると、ピンにつながる。
                  部品の端子（小さな四角が入力、丸が出力）へも同じように引く。端子同士を隣接させれば配線なしでつながる。
                </p>
                <p class="hint">
                  入力ピンはクリックで
                  on/off。ピンは外周をドラッグで移動。部品は選択してドラッグで移動、Delete
                  で削除。
                </p>
              </div>
              {renderTests()}
            </aside>
          </div>
        </div>
      );
    };
  },
);
