/**
 * The game-center manifest and the rules that award achievements.
 *
 * One list feeds both the manifest embedded in every page's head and the checks the editor runs
 * when a component is registered, so the two cannot drift apart.
 */

import type { SaveData } from "./storage.ts";
import { STAGES } from "./stages/index.ts";

export const GAME_CENTER_AUTHOR = "7499d00d-fcff-4630-91a0-c034893c8d08";
export const GAME_CENTER_SLUG = "cpu";
export const GAME_ID = `${GAME_CENTER_AUTHOR}/${GAME_CENTER_SLUG}`;

export interface Achievement {
  key: string;
  title: string;
  description: string;
  points: number;
  hidden: boolean;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    key: "first_clear",
    title: "はじめてのクリア",
    description: "NOT を作って部品として登録する",
    points: 10,
    hidden: false,
  },
  {
    key: "gates",
    title: "論理ゲート一式",
    description: "NOT、NAND、AND、OR、XOR をすべてクリアする",
    points: 20,
    hidden: false,
  },
  {
    key: "full_adder",
    title: "桁上がり",
    description: "全加算器をクリアする",
    points: 20,
    hidden: false,
  },
  {
    key: "flip_flop",
    title: "記憶する回路",
    description: "D フリップフロップをクリアする",
    points: 20,
    hidden: false,
  },
  {
    key: "first_bus",
    title: "8 本まとめて",
    description: "8 ビットのステージをはじめてクリアする",
    points: 10,
    hidden: false,
  },
  {
    key: "adder8",
    title: "8 ビット加算器",
    description: "8 ビットの加算器をクリアする",
    points: 30,
    hidden: false,
  },
  {
    key: "alu8",
    title: "ALU",
    description: "ALU をクリアする",
    points: 40,
    hidden: false,
  },
  {
    key: "cpu",
    title: "CPU",
    description: "CPU をクリアする。スコアは 65536 から面積を引いた値",
    points: 100,
    hidden: false,
  },
  {
    key: "on_par",
    title: "パー",
    description: "パーと同じ面積で部品を登録する",
    points: 20,
    hidden: false,
  },
  {
    key: "under_par",
    title: "パー割れ",
    description: "パーより小さい面積で部品を登録する",
    points: 50,
    hidden: true,
  },
  {
    key: "all_clear",
    title: "全ステージクリア",
    description: "すべてのステージをクリアする",
    points: 100,
    hidden: true,
  },
];

/** The manifest the hub reads from the page. */
export function manifest(): Record<string, unknown> {
  return {
    "$schema": "https://ga-cen.kbn.one/schema/gamecenter.json",
    id: GAME_CENTER_SLUG,
    author: GAME_CENTER_AUTHOR,
    title: "cpu.kbn.one",
    description:
      "リレーから CPU までを、できるだけ小さい面積で組み上げるパズル",
    achievements: ACHIEVEMENTS,
  };
}

export interface Earned {
  key: string;
  score?: number;
}

const GATES = ["not", "nand", "and", "or", "xor"];
const STAGE_KEYS: Record<string, string> = {
  not: "first_clear",
  "full-adder": "full_adder",
  dff: "flip_flop",
  add8: "adder8",
  alu8: "alu8",
  cpu8: "cpu",
};

/**
 * Achievements a registration earns, given the save after it. Already-unlocked ones are skipped.
 *
 * @param stageId The stage just cleared
 * @param area The registered component's area
 * @param par The stage's par, if it has one
 */
export function earned(
  save: SaveData,
  stageId: string,
  area: number,
  par: number | undefined,
): Earned[] {
  const have = save.achievements ?? {};
  const cleared = (id: string) => save.best[id] !== undefined;
  const candidates: Earned[] = [];

  const direct = STAGE_KEYS[stageId];
  if (direct !== undefined) {
    candidates.push(
      direct === "cpu"
        ? { key: direct, score: Math.max(0, 65536 - area) }
        : { key: direct },
    );
  }
  if (GATES.every(cleared)) candidates.push({ key: "gates" });
  if (STAGES.find((s) => s.id === stageId)?.inputs.some((p) => p.width > 1)) {
    candidates.push({ key: "first_bus" });
  }
  if (par !== undefined && area === par) candidates.push({ key: "on_par" });
  if (par !== undefined && area < par) candidates.push({ key: "under_par" });
  if (STAGES.every((s) => cleared(s.id))) candidates.push({ key: "all_clear" });

  return candidates.filter((c) => have[c.key] === undefined);
}
