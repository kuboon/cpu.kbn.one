/**
 * The landing page.
 *
 * It has one job: say what the game is, in the game's own terms, to someone who has never opened
 * it. So every picture on it is a real circuit — the reference solutions, run through the same
 * netlist and simulator the editor uses — and every number is read off the same data the game
 * plays from. Nothing here is a placeholder that could drift away from the game.
 *
 * The full stage list, with your own bests, lives at `/stages`.
 */

import { css } from "@remix-run/ui";
import type { Handle, RemixNode } from "@remix-run/ui";

import { base } from "../lib/base.ts";
import { Link } from "../lib/link.tsx";
import { BoardArt, SizeGlyph } from "../lib/board-art.tsx";
import { REFERENCES } from "../lib/game/reference.ts";
import { par } from "../lib/game/reference.ts";
import { area } from "../lib/game/model.ts";
import { STAGES } from "../lib/game/stages/index.ts";

export const title = "Minimum CPU";
export const description =
  "リレーから CPU までを、できるだけ小さい面積で組み上げるパズルゲーム。";

/* ---- motion ------------------------------------------------------------------------------- *
 *
 * The page is about current running through a board, so the one thing that moves on its own is
 * the current. It fills each board once on arrival and then breathes. Two animations per element:
 * the first is staggered from the top-left corner outward so the fill reads as a wave, the second
 * is shared and unstaggered so the board breathes as one piece instead of shimmering. Anyone who
 * asks their system for less motion gets the page at rest, fully lit.
 */

const flows = css({
  "@keyframes board-trace": {
    from: { strokeDashoffset: 220 },
    to: { strokeDashoffset: 0 },
  },
  "@keyframes board-light": {
    "0%": { opacity: 0, transform: "scale(0.5)" },
    "60%": { opacity: 1, transform: "scale(1.18)" },
    "100%": { opacity: 1, transform: "scale(1)" },
  },
  "@keyframes board-breathe": {
    "0%, 100%": { opacity: 1 },
    "50%": { opacity: 0.7 },
  },
  "@media (prefers-reduced-motion: no-preference)": {
    "& .trace": {
      strokeDasharray: 220,
      animation:
        "board-trace 900ms ease-out calc(var(--i) * 55ms) both, board-breathe 3.2s ease-in-out 2.2s infinite",
    },
    "& .light": {
      transformBox: "fill-box",
      transformOrigin: "center",
      animation:
        "board-light 520ms cubic-bezier(0.22, 1.4, 0.4, 1) calc(var(--i) * 55ms) both, board-breathe 3.2s ease-in-out 2.2s infinite",
    },
  },
});

/** A charge running the arrow between two steps. */
const charge = css({
  position: "absolute",
  left: "50%",
  top: "50%",
  width: 7,
  height: 7,
  margin: "-3.5px 0 0 -3.5px",
  borderRadius: 999,
  background: "#16a34a",
  opacity: 0,
  "@keyframes charge-flow": {
    "0%, 100%": { transform: "translateX(-9px)", opacity: 0 },
    "25%": { opacity: 1 },
    "70%": { transform: "translateX(9px)", opacity: 0 },
  },
  "@media (prefers-reduced-motion: no-preference)": {
    animation: "charge-flow 3.2s ease-in-out infinite",
    "&.second": { animationDelay: "0.6s" },
  },
});

/** Same area, three shapes: each takes its turn as the one you would reach for. */
const takesTurns = css({
  border: "1px solid transparent",
  borderRadius: "0.4rem",
  padding: "0.35rem 0.5rem",
  "@keyframes shape-turn": {
    "0%, 22%, 100%": { borderColor: "transparent", background: "transparent" },
    "8%": {
      borderColor: "var(--accent)",
      background: "color-mix(in srgb, var(--accent) 10%, transparent)",
    },
  },
  "@media (prefers-reduced-motion: no-preference)": {
    animation: "shape-turn 4.5s ease-in-out calc(var(--d) * 1.5s) infinite",
  },
});

/* ---- layout ------------------------------------------------------------------------------- */

/** Every section is full-bleed; this holds its contents to the width of the header above them. */
const shell = css({
  maxWidth: "68rem",
  marginInline: "auto",
  paddingInline: "1.25rem",
});

const section = css({
  paddingBlock: "4rem",
  borderTop: "1px solid var(--border)",
  "@media (max-width: 40rem)": { paddingBlock: "2.75rem" },
});

const tinted = css({ background: "var(--card)" });

const heading = css({
  margin: 0,
  fontSize: "2rem",
  lineHeight: 1.25,
  letterSpacing: "-0.01em",
  "@media (max-width: 40rem)": { fontSize: "1.5rem" },
});

const subheading = css({
  margin: "0.75rem 0 0",
  fontSize: "1.05rem",
  color: "var(--muted)",
  maxWidth: "40rem",
  textWrap: "pretty",
});

const hero = css({
  display: "flex",
  gap: "4rem",
  alignItems: "center",
  paddingBlock: "4rem",
  "@media (max-width: 60rem)": {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "2.5rem",
    paddingBlock: "2.5rem",
  },
});

const heroText = css({
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "1.5rem",
  "& h1": {
    margin: 0,
    fontSize: "3rem",
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
    "@media (max-width: 40rem)": { fontSize: "2rem" },
  },
  "& p": { margin: 0 },
});

const eyebrow = css({
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "var(--accent)",
  letterSpacing: "0.04em",
});

const lead = css({
  fontSize: "1.2rem",
  lineHeight: 1.65,
  maxWidth: "30rem",
  textWrap: "pretty",
});

const fine = css({ fontSize: "0.85rem", color: "var(--muted)" });

const actions = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "0.75rem",
  "@media (max-width: 40rem)": {
    flexDirection: "column",
    alignItems: "stretch",
    width: "100%",
  },
});

/** A board and the sentence that says what you are looking at. */
const plate = css({
  flex: "none",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.75rem",
  maxWidth: "100%",
  "& .frame": {
    padding: "1.5rem",
    border: "1px solid var(--border)",
    borderRadius: "0.75rem",
    background: "var(--bg)",
    maxWidth: "100%",
  },
  "& svg": { maxWidth: "100%", height: "auto" },
  "& figcaption": {
    fontSize: "0.8rem",
    color: "var(--muted)",
    fontVariantNumeric: "tabular-nums",
    textAlign: "center",
  },
});

const steps = css({
  display: "flex",
  gap: "1.5rem",
  alignItems: "stretch",
  marginTop: "2.5rem",
  "@media (max-width: 60rem)": {
    flexDirection: "column",
    gap: "1rem",
  },
});

const step = css({
  flex: "none",
  // Each step is as wide as its picture needs; `--w` carries that from the markup so the widths
  // stay next to the pictures they belong to, and so this rule can drop them when they stack.
  width: "var(--w)",
  minWidth: 0,
  maxWidth: "100%",
  display: "flex",
  flexDirection: "column",
  gap: "0.9rem",
  "& .title": { display: "flex", alignItems: "baseline", gap: "0.6rem" },
  "& .n": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "none",
    width: "1.6rem",
    height: "1.6rem",
    borderRadius: 999,
    background: "var(--fg)",
    color: "var(--bg)",
    fontSize: "0.8rem",
    fontWeight: 700,
  },
  "& h3": { margin: 0, fontSize: "1.15rem" },
  "& .frame": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "17rem",
    padding: "0.5rem",
    border: "1px solid var(--border)",
    borderRadius: "0.6rem",
    background: "var(--bg)",
    overflow: "hidden",
  },
  "& .frame svg": { maxWidth: "100%", height: "auto" },
  "& p": { margin: 0, fontSize: "0.95rem", textWrap: "pretty" },
  // Stacked, the pictures set the height; a fixed frame would leave a column of empty boxes.
  "@media (max-width: 60rem)": {
    width: "auto",
    "& .frame": { height: "auto", padding: "1rem" },
  },
});

/** The arrow between two steps. It lies down when the steps stack. */
const arrow = css({
  flex: "none",
  alignSelf: "center",
  position: "relative",
  display: "inline-flex",
  color: "var(--muted)",
  "@media (max-width: 60rem)": { transform: "rotate(90deg)" },
});

const twoUp = css({
  display: "flex",
  gap: "5rem",
  alignItems: "flex-start",
  "@media (max-width: 60rem)": { flexDirection: "column", gap: "2.5rem" },
});

const shapes = css({
  marginTop: "1.75rem",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  gap: "1.75rem",
  "@media (max-width: 40rem)": { gap: "0.75rem 1rem" },
  "& figure": {
    margin: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.5rem",
  },
  "& .slot": { display: "flex", alignItems: "center", height: "3.6rem" },
  "& figcaption": {
    fontSize: "0.8rem",
    color: "var(--muted)",
    fontVariantNumeric: "tabular-nums",
  },
});

const parTable = css({
  flex: "none",
  width: "22rem",
  maxWidth: "100%",
  "& .head": {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "var(--muted)",
    paddingBottom: "0.4rem",
    borderBottom: "1px solid var(--fg)",
  },
  "& .row": {
    display: "flex",
    alignItems: "baseline",
    gap: "0.75rem",
    padding: "0.55rem 0",
    borderBottom: "1px solid var(--border)",
  },
  "& .row span:first-child": { flex: 1, fontSize: "0.95rem" },
  "& .row .n": {
    fontSize: "1.05rem",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
});

const groups = css({
  marginTop: "2rem",
  maxWidth: "52rem",
  "& .row": {
    display: "flex",
    alignItems: "baseline",
    gap: "1.25rem",
    padding: "0.7rem 0",
    borderBottom: "1px solid var(--border)",
  },
  "& .row .label": { flex: "none", width: "6rem", fontWeight: 600 },
  "& .row .members": { flex: 1, fontSize: "0.95rem", color: "var(--muted)" },
  "& .row .n": {
    flex: "none",
    fontSize: "0.85rem",
    color: "var(--muted)",
    fontVariantNumeric: "tabular-nums",
  },
  "@media (max-width: 40rem)": {
    "& .row": { flexWrap: "wrap", gap: "0.25rem 0.75rem" },
    "& .row .members": { flexBasis: "100%" },
  },
});

const facts = css({
  display: "flex",
  gap: "3rem",
  "& > div": { flex: 1, minWidth: 0 },
  "& h3": { margin: 0, fontSize: "1rem" },
  "& p": {
    margin: "0.4rem 0 0",
    fontSize: "0.95rem",
    color: "var(--muted)",
    textWrap: "pretty",
  },
  "@media (max-width: 60rem)": {
    flexDirection: "column",
    gap: "1.75rem",
  },
});

const closing = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "1.25rem",
  textAlign: "center",
  "& p": {
    margin: 0,
    fontSize: "1.05rem",
    color: "var(--muted)",
    maxWidth: "34rem",
    textWrap: "pretty",
  },
});

/* ---- content ------------------------------------------------------------------------------ */

/**
 * The stages, grouped in play order. The counts are the slice lengths, so a stage added to
 * `STAGES` shows up here rather than quietly falling out of the total.
 */
const GROUPS: readonly { label: string; count: number }[] = [
  { label: "論理", count: 7 },
  { label: "加算", count: 2 },
  { label: "記憶", count: 4 },
  { label: "8 ビット", count: 8 },
  { label: "演算", count: 4 },
  { label: "CPU", count: 3 },
];

/** The pars worth quoting: the shape of the curve, from 2 up to 60. */
const PAR_ROWS: readonly string[] = [
  "not",
  "and",
  "nand",
  "or",
  "xor",
  "sr-latch",
  "neg8",
  "half-adder",
  "dff",
];

const titleOf = (id: string) => STAGES.find((s) => s.id === id)?.title ?? id;

function Arrow(handle: Handle<{ second?: boolean }>) {
  return () => (
    <span mix={[arrow]}>
      <svg width="34" height="12" viewBox="0 0 34 12" aria-hidden="true">
        <path
          d="M0 6h27M23 2l5 4-5 4"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        />
      </svg>
      <span
        class={handle.props.second ? "second" : undefined}
        mix={[charge]}
      >
      </span>
    </span>
  );
}

export default function Home(): RemixNode {
  let at = 0;
  const grouped = GROUPS.map((g) => {
    const members = STAGES.slice(at, at + g.count);
    at += g.count;
    return { ...g, members };
  });

  return (
    <div class="landing" mix={[flows]}>
      <section mix={[shell, hero]}>
        <div mix={[heroText]}>
          <span mix={[eyebrow]}>ブラウザで遊べる 1 人用パズル</span>
          <h1>
            リレーから CPU へ、<br />できるだけ小さく
          </h1>
          <p mix={[lead]}>
            マス目の盤面にリレーと配線を置いて回路を作る。できた回路は部品として登録でき、作ったときの大きさのまま次のステージで使える。スコアは盤面の面積。小さいほどよい。
          </p>
          <div mix={[actions]}>
            <Link href={`${base}/play/not`} class="button">NOT から始める</Link>
            <Link href={`${base}/how-to-play`} class="button ghost">
              遊び方を読む
            </Link>
          </div>
          <p mix={[fine]}>
            {STAGES.length}{" "}
            ステージ・インストール不要・進み具合はこのブラウザに保存
          </p>
        </div>
        <figure mix={[plate]}>
          <div class="frame">
            <BoardArt
              design={REFERENCES.xor}
              inputs={{ a: 0, b: 1 }}
              width={320}
            />
          </div>
          <figcaption>
            XOR ／ 4×3、面積 {par("xor")}（パー{" "}
            {par("xor")}）。a=0 b=1 のとき out=1
          </figcaption>
        </figure>
      </section>

      <section mix={[section]}>
        <div mix={[shell]}>
          <h2 mix={[heading]}>作る、登録する、次で使う</h2>
          <p mix={[subheading]}>
            回路パズルとしては、リレー 2 種類から始まるところは nandgame
            と同じ。違うのは、作った部品の<strong>
              大きさ
            </strong>が次のステージにそのまま効くこと。
          </p>
          <div mix={[steps]}>
            <div style="--w:19rem" mix={[step]}>
              <div class="title">
                <span class="n">1</span>
                <h3>作る</h3>
              </div>
              <div class="frame">
                <BoardArt
                  design={REFERENCES["d-latch"]}
                  inputs={{ d: 1, st: 1 }}
                  width={280}
                />
              </div>
              <p>
                盤面にリレーと配線を置いて、テストを全部通す。この D latch は
                4×3、面積 {par("d-latch")}。
              </p>
            </div>

            <Arrow />

            <div style="--w:16rem" mix={[step]}>
              <div class="title">
                <span class="n">2</span>
                <h3>登録する</h3>
              </div>
              <div class="frame">
                <span class="part-card" style="width:15rem;cursor:default">
                  <SizeGlyph width={4} height={3} />
                  <span class="text">
                    <span class="name">D latch 4×3</span>
                    <small>4×3 ・ 面積 {par("d-latch")}</small>
                  </span>
                </span>
              </div>
              <p>
                通ったら部品として登録できる。大きさは作ったときのまま。名前は自分で付ける。
              </p>
            </div>

            <Arrow second />

            <div style="--w:26rem" mix={[step]}>
              <div class="title">
                <span class="n">3</span>
                <h3>次で使う</h3>
              </div>
              <div class="frame">
                <BoardArt
                  design={REFERENCES.dff}
                  inputs={{ d: 1, clk: 0 }}
                  width={380}
                />
              </div>
              <p>
                次のステージで置ける。この D flip-flop は D latch 2 個と NOT 1
                個、10×6 で面積 {par("dff")}。
              </p>
            </div>
          </div>
          <p style="margin:2rem 0 0;max-width:46rem;color:var(--muted);font-size:0.95rem;text-wrap:pretty">
            同じ機能でも大きさ違いを何個でも登録できる。あとで狭いところに入れたくなったら、小さい版を作りに戻ればいい。置くときは回転も反転もできる。
          </p>
        </div>
      </section>

      <section mix={[section, tinted]}>
        <div mix={[shell, twoUp]}>
          <div style="flex:1;min-width:0">
            <h2 mix={[heading]}>スコアは面積</h2>
            <p style="margin:0.9rem 0 0;font-size:1.15rem;text-wrap:pretty">
              幅かける高さ。それだけ。速さも部品の数も数えない。
            </p>
            <p style="margin:1.2rem 0 0;max-width:26rem;color:var(--muted);text-wrap:pretty">
              同じ回路でも、端子の向きを変えれば入るところが変わる。配線を 1
              本引き回すのをやめれば 1
              列詰められる。パーは参考解の面積で、下回ると実績が付く。
            </p>
            <div mix={[shapes]}>
              {[[4, 3], [6, 2], [12, 1]].map(([w, h], i) => (
                <figure key={`${w}x${h}`}>
                  <span class="slot" style={`--d:${i}`} mix={[takesTurns]}>
                    <SizeGlyph width={w} height={h} step={12} />
                  </span>
                  <figcaption>{w}×{h}</figcaption>
                </figure>
              ))}
            </div>
            <p style="margin:0.9rem 0 0;max-width:26rem;color:var(--muted);font-size:0.9rem;text-wrap:pretty">
              どれも面積 12。入る場所が違うので、同じ XOR
              を何通りも作って持っておける。
            </p>
            <p style="margin:1.25rem 0 0;max-width:26rem;color:var(--muted);font-size:0.9rem;text-wrap:pretty">
              盤面を縮めると、空いている行や列から削られる。次に消える行と列は赤く出る。
            </p>
          </div>
          <div mix={[parTable]}>
            <p class="head">
              <span>ステージ</span>
              <span>パー</span>
            </p>
            {PAR_ROWS.map((id) => (
              <p key={id} class="row">
                <span>{titleOf(id)}</span>
                <span class="n">{par(id)}</span>
              </p>
            ))}
          </div>
        </div>
      </section>

      <section mix={[section]}>
        <div mix={[shell]}>
          <h2 mix={[heading]}>
            NOT から 8 ビット CPU まで、{STAGES.length} ステージ
          </h2>
          <p mix={[subheading]}>
            最後の 3 つで、命令を読んで動く 8 ビット CPU になる。テストは 3
            本のプログラムが最後まで正しく走ること。
          </p>
          <div mix={[groups]}>
            {grouped.map((g) => (
              <p key={g.label} class="row">
                <span class="label">{g.label}</span>
                <span class="members">
                  {g.members.map((s) => s.title).join("・")}
                </span>
                <span class="n">{g.members.length}</span>
              </p>
            ))}
          </div>
          <p style="margin:1.5rem 0 0">
            <Link href={`${base}/stages`}>ステージ一覧と自己ベスト</Link>
          </p>
        </div>
      </section>

      <section mix={[section, tinted]}>
        <div mix={[shell, facts]}>
          <div>
            <h3>要るのはブラウザだけ</h3>
            <p>インストールも登録もない。開いたら遊べる。</p>
          </div>
          <div>
            <h3>保存はこのブラウザの中</h3>
            <p>
              進み具合と作った部品はブラウザに残る。JSON
              で書き出して別のブラウザへ移せる。
            </p>
          </div>
          <div>
            <h3>実績は任意</h3>
            <p>
              game-center に記録できる。記録するかどうかは押すまで起こらない。
            </p>
          </div>
          <div>
            <h3>ソースは公開</h3>
            <p>エンジンもステージも GitHub にある。</p>
          </div>
        </div>
      </section>

      <section mix={[section]}>
        <div mix={[shell, closing]}>
          <h2 mix={[heading]}>最初のステージは NOT</h2>
          <p>
            定数 1 とリレー 1 個。面積 {area(REFERENCES.not)} で作れる。ここから
            {" "}
            {STAGES.length} 段のぼると CPU になる。
          </p>
          <Link href={`${base}/play/not`} class="button">NOT から始める</Link>
        </div>
      </section>
    </div>
  );
}
