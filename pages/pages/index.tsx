import type { RemixNode } from "@remix-run/ui";

import { base } from "../lib/base.ts";
import { Link } from "../lib/link.tsx";
import { STAGES } from "../lib/game/stages/index.ts";
import { par } from "../lib/game/reference.ts";
import { Progress } from "../islands/progress.tsx";

export const title = "cpu.kbn.one";
export const description =
  "リレーから CPU までを、できるだけ小さい面積で組み上げるパズルゲーム。";

/** The progress column is the one island on the page. */
export const islands: readonly string[] = ["progress"];

function specs(pins: readonly { name: string; width: number }[]): string {
  return pins.map((p) => p.width > 1 ? `${p.name}[${p.width}]` : p.name).join(
    ", ",
  );
}

export default function Home(): RemixNode {
  return (
    <>
      <h1>リレーから CPU へ、できるだけ小さく</h1>
      <p class="lead">
        マス目の盤面にリレーと配線を置いて回路を作る。
        できた回路は部品として登録でき、作ったときの大きさのまま次のステージで使える。
        スコアは盤面の面積。小さいほどよい。
      </p>
      <p>
        ルールと設計は<Link href={`${base}/plan`}>企画書</Link>にある。
        ステージ名を押すとエディタが開く。進み具合はこのブラウザに保存される。
      </p>
      <h2>ステージ</h2>
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
