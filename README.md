# cpu.kbn.one

リレーから CPU までを、できるだけ小さい面積で組み上げる 1 人用パズルゲーム。
[nandgame](https://nandgame.com/) と同じ順でステージが進むが、回路はマス目に置き、作った回路は「作ったときの大きさ」のまま次のステージの部品になる。

ルールと設計は [企画書](./pages/pages/plan.md) にある。

## 構成

- `pages/lib/game/`：DOM に依存しないエンジン。データモデル、ネットリスト抽出、シミュレータ、ステージ定義、参照解、保存形式。
- `pages/islands/`：ブラウザで動く部分（エディタ。準備中）。
- `pages/pages/`：サイトのページ。

サイトは [Remix v3](https://remix.run) と [`@kuboon/remix-ssg`](https://jsr.io/@kuboon/remix-ssg) で静的に生成し、GitHub Pages に置く。
サーバーは持たず、プレイヤーの状態はブラウザに保存する。

## 開発

[Deno](https://deno.com) 2.x が必要。

```sh
cd pages
deno task dev     # http://localhost:8000
deno task test    # エンジンのテスト
deno task check   # 型チェック、lint、フォーマット
deno task build   # pages/dist に静的サイトを生成
```

## デプロイ

`.github/workflows/pages.yml` が `kuboon/workflows` の再利用ワークフローを呼び、`main` をルートに、各 PR をサブパスに GitHub Pages へ配置する。
リポジトリの Settings → Pages → Build and deployment → Source を「GitHub Actions」にしておく必要がある。
