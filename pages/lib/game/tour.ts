/**
 * The play screen's guided tour.
 *
 * The editor is five regions that only make sense together — a board, a dock of tools, the parts
 * it can place, a test bar, and the ? it can be reopened from — and reading about them is not the
 * same as being shown them. This is the ground the ? panel used to cover in four paragraphs of
 * text, except each sentence is now said while the thing it is about is lit up.
 *
 * Every step names one `data-tour` attribute, and the kit resolves each to the first *rendered*
 * element that matches: the phone's test bar and the wide layout's result pill carry the same
 * name, and only one of them is ever on screen. So the tour is the same five steps and the same
 * progress counter in either layout, and only the side the tooltip sits on has to be chosen here.
 */

import type { TourScenario } from "@kuboon/onboarding-kit";

/**
 * Bump this when the steps change enough that someone who finished the old tour should be shown
 * the new one. Rewording is not that; a step about a region that did not exist before is.
 */
const VERSION = 1;

/** The tour's name, which is also the key its completion is stored under. */
export const PLAY_TOUR = "cpu-play";

/**
 * The tour for the play screen.
 *
 * @param wide Whether the wide layout is up: tools down a left rail rather than along the bottom,
 * and the test result in the app bar rather than in a bar above the dock
 * @returns A scenario, ready to hand to an `<onboarding-tour>`
 */
export function playTour(wide: boolean): TourScenario {
  /** Where the tooltip sits next to anything in the tool dock, which moves with the layout. */
  const dock = wide ? "right" : "top";

  return {
    name: PLAY_TOUR,
    version: VERSION,
    labels: {
      next: "次へ",
      back: "戻る",
      skip: "とばす",
      done: "はじめる",
      progress: "{index} / {total}",
    },
    steps: [
      {
        id: "welcome",
        title: "ようこそ",
        body:
          "部品をつないで、指定どおりに動く回路を作るゲームです。まず画面の使い方をひととおり見ていきます。",
      },
      {
        id: "board",
        target: '[data-tour="board"]',
        title: "盤面",
        body:
          "ここに部品を置き、線でつないで回路にします。外周のピンが入力と出力で、入力ピンはクリックで on/off が切り替わります。",
        placement: "right",
        // The board is drawn by the island after it hydrates, and the tour opens in the same
        // breath, so this is the one step that can arrive before its target does.
        whenMissing: "wait",
      },
      {
        id: "tools",
        target: '[data-tour="tools"]',
        title: "道具",
        body:
          "配線・バス・交差・消去、それに選択。盤面をドラッグすると、選んだ道具で線が引けます。キーボードなら w b x e v です。",
        placement: dock,
      },
      {
        id: "parts",
        target: '[data-tour="parts-button"]',
        title: "部品",
        body:
          "置ける部品はここから。選んでから盤面をクリックすると置け、r で回転、f で反転します。",
        placement: dock,
      },
      {
        id: "tests",
        target: '[data-tour="tests"]',
        title: "テスト",
        body:
          "ステージが求める入出力を、作った回路がそのとおりに満たせているか。すべて合格すると、その回路を部品として登録して次のステージで使えます。",
        placement: wide ? "bottom" : "top",
      },
      {
        id: "help",
        target: '[data-tour="help"]',
        title: "困ったら",
        body:
          "この案内は ? からいつでも見直せます。ステージごとの説明は隣の ⓘ に、詳しいルールは「遊び方」のページにあります。",
        placement: "bottom",
      },
    ],
  };
}
