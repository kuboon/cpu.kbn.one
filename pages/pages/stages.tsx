/**
 * The full stage list.
 *
 * Every stage in play order, with its interface, its par and — read from this browser — your own
 * best. The landing page introduces the game; this is the page you come back to.
 */

import type { RemixNode } from "@remix-run/ui";

import { base } from "../lib/base.ts";
import { Link } from "../lib/link.tsx";
import { STAGES } from "../lib/game/stages/index.ts";
import { par } from "../lib/game/reference.ts";
import { Progress } from "../islands/progress.tsx";

export const title = "ステージ — Minimum CPU";
export const description =
  "NOT から 8 ビット CPU まで、28 ステージ。パーと自己ベストの一覧。";

/** The progress column is the one island on the page. */
export const islands: readonly string[] = ["progress"];

function specs(pins: readonly { name: string; width: number }[]): string {
  return pins.map((p) => p.width > 1 ? `${p.name}[${p.width}]` : p.name).join(
    ", ",
  );
}

export default function Stages(): RemixNode {
  return (
    <>
      <h1>ステージ</h1>
      <p class="lead">
        上から順に、前のステージで作った部品を使って次を組む。
        ステージ名を押すとエディタが開く。進み具合はこのブラウザに保存される。
      </p>
      <p>
        ルールは<Link href={`${base}/how-to-play`}>遊び方</Link>にある。
      </p>
      <table class="stages">
        <thead>
          <tr>
            <th>#</th>
            <th>ステージ</th>
            <th>入力</th>
            <th>出力</th>
            <th>パー</th>
            <th>自己ベスト</th>
          </tr>
        </thead>
        <tbody>
          {STAGES.map((stage, i) => (
            <tr key={stage.id}>
              <td>{i + 1}</td>
              <td>
                <Link href={`${base}/play/${stage.id}`}>
                  <strong>{stage.title}</strong>
                </Link>
                <br />
                <small>{stage.description}</small>
              </td>
              <td>{specs(stage.inputs)}</td>
              <td>{specs(stage.outputs)}</td>
              <td>{par(stage.id) ?? "-"}</td>
              <td>
                <Progress stageId={stage.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
