import type { RemixNode } from "@remix-run/ui";

import { base } from "../lib/base.ts";
import { Library } from "../islands/library.tsx";

export const title = "ライブラリ — cpu.kbn.one";
export const description =
  "登録した部品の一覧。名前の変更、削除、エクスポートとインポート。";

export const islands: readonly string[] = ["library"];

export default function LibraryPage(): RemixNode {
  return (
    <>
      <h1>ライブラリ</h1>
      <p class="lead">
        ステージをクリアして登録した部品。以降のステージのパレットに、ここにある大きさのまま並ぶ。
        他の部品や下書きが使っている部品は削除できない。
      </p>
      <Library base={base} />
    </>
  );
}
