/**
 * A finished design, drawn as a picture.
 *
 * The landing page shows real circuits: a reference solution goes through the same netlist and
 * simulator the game uses, so the wires that light up are the ones that actually carry a 1.
 *
 * The geometry is re-derived here rather than lifted out of the editor, because the editor's
 * renderer is entangled with dragging, ghosts and selection, and none of that applies to a
 * picture. What is *not* duplicated is the appearance: every element carries the same class the
 * editor gives it, so all the colours — and the dark theme — come from the one place in
 * `styles.css` that already defines them.
 */

import type { Handle, RemixNode } from "@remix-run/ui";

import type { Cell, Design, Library, Placement } from "./game/model.ts";
import { createLibrary, parseCellKey, pinWidth } from "./game/model.ts";
import { buildNetlist, outsideOf } from "./game/netlist.ts";
import type { Netlist } from "./game/netlist.ts";
import { Simulator } from "./game/sim.ts";
import type { EvalResult } from "./game/sim.ts";
import { footprint, pinCell, worldPins } from "./game/transform.ts";
import type { WorldPin } from "./game/transform.ts";
import { REFERENCE_COMPONENTS } from "./game/reference.ts";

const CELL = 32;

/** Top-left corner of board cell `n`, in view units. The board sits inside a one-cell margin. */
const edge = (n: number) => (n + 1) * CELL;
/** Centre of board cell `n`. */
const centre = (n: number) => (n + 1.5) * CELL;

export interface BoardArtProps {
  /** The design to draw. */
  design: Design;
  /** Input values to run it with. Anything unnamed is 0. */
  inputs?: Record<string, number>;
  /** Rendered width in CSS pixels. The drawing scales to fit; the aspect ratio is the board's. */
  width?: number;
}

/**
 * Draws a design with its signals resolved.
 *
 * @param props The design, its inputs and the width to draw it at
 * @returns An `<svg>` styled by the editor's own board rules
 */
export function BoardArt(handle: Handle<BoardArtProps>) {
  return () => {
    const props = handle.props;
    const { design, inputs = {} } = props;
    const library = createLibrary(REFERENCE_COMPONENTS);
    const netlist = buildNetlist(design, library);
    const live = netlist === undefined
      ? undefined
      : new Simulator(netlist).evaluate(inputs);

    const w = (design.width + 2) * CELL;
    const h = (design.height + 2) * CELL;
    const width = props.width ?? w;

    // The signal draws itself in from the top-left corner outward, so the fill reads as one wave
    // rather than as elements waking up at random. Every animated element gets its place in line.
    let order = 0;
    const step = () => order++;

    const ctx: Context = { design, library, netlist, live, step };

    return (
      <svg
        class="board board-art"
        viewBox={`0 0 ${w} ${h}`}
        width={width}
        height={width * h / w}
        role="img"
      >
        <rect
          class="board-bg"
          x={CELL}
          y={CELL}
          width={design.width * CELL}
          height={design.height * CELL}
        />
        <path class="grid" d={gridPath(design)} fill="none" />
        {sortedCells(design).map(([key, cell]) => renderCell(ctx, key, cell))}
        {design.placements.map((placement, index) => (
          renderPlacement(ctx, placement, index)
        ))}
        {design.pins.map((_, index) => renderPin(ctx, index))}
      </svg>
    );
  };
}

interface Context {
  design: Design;
  library: Library;
  netlist: Netlist | undefined;
  live: EvalResult | undefined;
  step: () => number;
}

/** Cells in draw order: nearest the top-left corner first, so the fill sweeps across the board. */
function sortedCells(design: Design): [string, Cell][] {
  return Object.entries(design.cells).sort(([a], [b]) => {
    const p = parseCellKey(a);
    const q = parseCellKey(b);
    return (p.x + p.y) - (q.x + q.y) || p.x - q.x;
  });
}

function gridPath(design: Design): string {
  const lines: string[] = [];
  for (let i = 0; i <= design.width; i++) {
    lines.push(`M${edge(i)} ${CELL}V${edge(design.height)}`);
  }
  for (let i = 0; i <= design.height; i++) {
    lines.push(`M${CELL} ${edge(i)}H${edge(design.width)}`);
  }
  return lines.join("");
}

/** The editor's rule: lit if any lane carries a 1. A picture never shows a short. */
function netClass(ctx: Context, lanes: number[] | undefined, base: string) {
  if (lanes === undefined || ctx.live === undefined) return base;
  const on = lanes.some((net) => ctx.live!.nets[net] === 1);
  return `${base}${lanes.length > 1 ? " bus" : ""}${on ? " on" : ""}`;
}

function renderCell(ctx: Context, key: string, cell: Cell): RemixNode {
  const { x, y } = parseCellKey(key);
  const cx = centre(x);
  const cy = centre(y);
  const half = CELL / 2;
  const nets = ctx.netlist?.cellNets[key];
  const i = ctx.step();

  if (cell.kind === "cross") {
    const ns = netClass(ctx, nets?.[0], "wire trace");
    const ew = netClass(ctx, nets?.[1], "wire trace");
    return (
      <g key={key} style={`--i:${i}`}>
        <line x1={cx} y1={cy - half} x2={cx} y2={cy + half} class={ns} />
        <line x1={cx - half} y1={cy} x2={cx - 8} y2={cy} class={ew} />
        <line x1={cx + 8} y1={cy} x2={cx + half} y2={cy} class={ew} />
      </g>
    );
  }

  const cls = netClass(
    ctx,
    nets?.[0],
    `wire${cell.bus && !nets ? " bus" : ""}`,
  );
  const ends: [boolean, number, number][] = [
    [cell.n, cx, cy - half],
    [cell.e, cx + half, cy],
    [cell.s, cx, cy + half],
    [cell.w, cx - half, cy],
  ];
  const drawn = ends.filter(([set]) => set);
  return (
    <g key={key} style={`--i:${i}`}>
      {drawn.map(([, x2, y2], n) => (
        <line key={n} x1={cx} y1={cy} x2={x2} y2={y2} class={`${cls} trace`} />
      ))}
      {drawn.length !== 2
        ? (
          <circle
            cx={cx}
            cy={cy}
            r={drawn.length === 0 ? 3 : cell.bus ? 6 : 4.5}
            class={`${cls} light`}
          />
        )
        : null}
    </g>
  );
}

function pinMark(
  ctx: Context,
  wp: WorldPin,
  lanes: number[] | undefined,
  showName: boolean,
  small: boolean,
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
    ctx,
    lanes,
    `pinmark ${wp.pin.dir}${bus && !lanes ? " bus" : ""}`,
  );
  const r = bus ? 5.5 : 3.5;
  return (
    <g key={wp.index} style={`--i:${ctx.step()}`}>
      {wp.pin.dir === "in"
        ? (
          <rect
            x={mx - r}
            y={my - r}
            width={2 * r}
            height={2 * r}
            class={`${cls} light`}
          />
        )
        : <circle cx={mx} cy={my} r={r} class={`${cls} light`} />}
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
  ctx: Context,
  placement: Placement,
  index: number,
): RemixNode {
  const def = ctx.library.get(placement.componentId);
  if (def === undefined) return null;
  const { width, height } = footprint(def, placement);
  const x = edge(placement.x);
  const y = edge(placement.y);
  const nets = ctx.netlist?.placementPinNets[index];
  const label = def.primitive === "relay-on"
    ? "on"
    : def.primitive === "relay-off"
    ? "off"
    : def.name;
  const pins = worldPins(def, placement);
  // A relay's label sits away from its control pin so the two never overlap.
  const labelOffset = def.primitive === undefined || def.primitive === "split"
    ? 4
    : pins.find((wp) => wp.pin.name === "c")?.side === "s"
    ? -6
    : 12;
  return (
    <g
      key={`p${index}`}
      class={`part${def.primitive ? ` prim-${def.primitive}` : ""}`}
    >
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
      >
        {label}
      </text>
      {pins.map((wp) =>
        pinMark(
          ctx,
          wp,
          nets?.[wp.index],
          def.primitive !== "one",
          def.primitive !== undefined,
        )
      )}
    </g>
  );
}

function renderPin(ctx: Context, index: number): RemixNode {
  const pin = ctx.design.pins[index];
  const { x, y } = outsideOf(ctx.design, pin);
  const bus = pinWidth(pin) > 1;
  const lanes = ctx.netlist?.pinNets[index];
  const value = lanes !== undefined && ctx.live !== undefined
    ? busValue(ctx, lanes)
    : 0;
  const inside = pinCell(ctx.design, pin);
  const dx = x - inside.x;
  const dy = y - inside.y;
  const cx = centre(x);
  const cy = centre(y);
  const r = bus ? 13 : 11;
  // A bus pin shows its value; its name goes to the outer corner of the margin cell.
  const [nx, ny] = pin.side === "n"
    ? [cx, cy - 13]
    : pin.side === "s"
    ? [cx, cy + 15.5]
    : pin.side === "w"
    ? [cx - 8, cy - 11]
    : [cx + 8, cy - 11];
  return (
    <g
      key={`pin${index}`}
      class={`pin ${pin.dir}${bus ? " bus" : ""}${value ? " on" : ""}`}
      style={`--i:${ctx.step()}`}
    >
      <line
        x1={cx - dx * r}
        y1={cy - dy * r}
        x2={cx - dx * (CELL / 2)}
        y2={cy - dy * (CELL / 2)}
        class={netClass(ctx, lanes, `stub${bus ? " bus" : ""} connected trace`)}
      />
      <circle cx={cx} cy={cy} r={r} class="light" />
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

/** A bus pin shows a number; a single-bit pin shows 0 or 1. Both read off the resolved nets. */
function busValue(ctx: Context, lanes: number[]): number {
  return lanes.reduce(
    (acc, net, bit) => acc + (ctx.live!.nets[net] === 1 ? 1 << bit : 0),
    0,
  );
}

/**
 * A footprint, drawn to scale — the same glyph the parts list uses on its cards.
 *
 * @param props The footprint in cells, and the size of one cell in view units
 * @returns A small `<svg>` outline of the footprint
 */
export function SizeGlyph(
  handle: Handle<{ width: number; height: number; step?: number }>,
) {
  return () => {
    const props = handle.props;
    const step = props.step ??
      Math.min(
        8,
        Math.max(3, Math.floor(30 / Math.max(props.width, props.height))),
      );
    const w = props.width * step;
    const h = props.height * step;
    return (
      <svg
        class="size-glyph"
        width={w + 2}
        height={h + 2}
        viewBox={`0 0 ${w + 2} ${h + 2}`}
        aria-hidden="true"
      >
        <rect x="1" y="1" width={w} height={h} rx="1.5" />
        {Array.from({ length: props.width - 1 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={1 + (i + 1) * step}
            y1="1"
            x2={1 + (i + 1) * step}
            y2={1 + h}
          />
        ))}
        {Array.from({ length: props.height - 1 }, (_, i) => (
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
  };
}
