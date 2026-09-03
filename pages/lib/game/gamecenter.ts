/**
 * The game-center connection, browser only.
 *
 * `init` runs on every page so a launch token in the URL fragment is picked up wherever the hub
 * opens the game. Unlocks that the hub could not record come back as claim URLs; the caller shows
 * them as links, never opens them.
 */

import { GameCenter } from "@kuboon/game-center-sdk";
import type { UnlockResult } from "@kuboon/game-center-sdk";

import { GAME_ID } from "./achievements.ts";

let instance: GameCenter | undefined;

export function gameCenter(): GameCenter | undefined {
  if (typeof document === "undefined") return undefined;
  instance ??= GameCenter.init({ gameId: GAME_ID });
  return instance;
}

export interface UnlockOutcome {
  key: string;
  recorded: boolean;
  claimUrl: string;
}

/** Unlocks one achievement; never throws. */
export async function unlock(
  key: string,
  score?: number,
): Promise<UnlockOutcome> {
  const gc = gameCenter();
  const options = score === undefined ? {} : { score };
  const claimUrl = gc?.claimUrl(key, options) ??
    `https://ga-cen.kbn.one/claim/@${GAME_ID}/${key}`;
  if (gc === undefined) return { key, recorded: false, claimUrl };
  let result: UnlockResult;
  try {
    result = await gc.unlock(key, options);
  } catch {
    return { key, recorded: false, claimUrl };
  }
  return {
    key,
    recorded: result.recorded,
    claimUrl: result.claimUrl ?? claimUrl,
  };
}
