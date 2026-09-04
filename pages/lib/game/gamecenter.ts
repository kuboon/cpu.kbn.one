/**
 * The game-center connection, browser only.
 *
 * `init` runs on every page so a launch token in the URL fragment is picked up wherever the hub
 * opens the game.
 *
 * The SDK keeps its own queue of unlocks the hub has not been told about, in `localStorage`. A
 * player who arrived through the hub has a token and is recorded there and then; anyone else — the
 * game's own URL, offline, an expired token — has their unlocks queued, and one claim link records
 * the lot. The link is never opened for them: popup blockers eat an unprompted `window.open`, and a
 * player should see what is about to be recorded before it is.
 */

import { GameCenter } from "@kuboon/game-center-sdk";

import { GAME_ID } from "./achievements.ts";

let instance: GameCenter | undefined;

export function gameCenter(): GameCenter | undefined {
  if (typeof document === "undefined") return undefined;
  instance ??= GameCenter.init({ gameId: GAME_ID });
  return instance;
}

export interface UnlockOutcome {
  key: string;
  /** True when the hub has it. False means it is waiting in the queue. */
  recorded: boolean;
}

/** Unlocks one achievement; never throws. */
export async function unlock(
  key: string,
  score?: number,
): Promise<UnlockOutcome> {
  const gc = gameCenter();
  if (gc === undefined) return { key, recorded: false };
  try {
    const result = await gc.unlock(key, score === undefined ? {} : { score });
    return { key, recorded: result.recorded };
  } catch {
    return { key, recorded: false };
  }
}

/** Everything waiting to be recorded, as one link. `undefined` when there is nothing to offer. */
export function claim(): { url: string; count: number } | undefined {
  const gc = gameCenter();
  const url = gc?.claimUrl();
  if (gc === undefined || url === null || url === undefined) return undefined;
  return { url, count: gc.pending.length };
}
