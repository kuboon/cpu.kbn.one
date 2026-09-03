import type { Handle } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";

import { loadSave } from "../lib/game/browser-storage.ts";
import { gameCenter } from "../lib/game/gamecenter.ts";

/**
 * The player's best area on one stage, read from the browser's save data.
 *
 * The first render matches the server's (a dash, since the build has no save); the real number
 * comes in right after hydration so the markup never mismatches.
 */
export const Progress = island(
  "progress",
  "Progress",
  function Progress(handle: Handle<{ stageId: string }>) {
    let best: number | undefined;
    setTimeout(() => {
      // Picks up a game-center launch token when the hub opens the stage list.
      gameCenter();
      best = loadSave()?.best[handle.props.stageId];
      if (best !== undefined) handle.update();
    }, 0);
    return () => (
      <span class={best === undefined ? "progress" : "progress cleared"}>
        {best === undefined ? "-" : `✓ ${best}`}
      </span>
    );
  },
);
