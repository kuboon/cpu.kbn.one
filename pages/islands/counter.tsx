import { on } from "@remix-run/ui";
import type { Handle } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";

import { clicks } from "./store.ts";

/**
 * A client component ("island"): server-rendered to HTML like everything else, then hydrated in the
 * browser so it becomes interactive.
 *
 * `island(name, exportName, component)` marks it for hydration. The name is this file's path under
 * `islands/`, and the runtime resolves it to the chunk the bundler emitted — so nothing here has to
 * know the deploy prefix or predict an output filename.
 *
 * Every click also lands in the {@link clicks} store, which `total.tsx` — a *separate* entrypoint —
 * reads. That the two agree is the visible proof that the shared module was emitted once.
 */
export const Counter = island(
  "counter",
  "Counter",
  function Counter(handle: Handle<{ label: string; start?: number }>) {
    let count = handle.props.start ?? 0;

    return () => (
      <button
        type="button"
        class="counter"
        mix={[on("click", () => {
          count++;
          clicks.bump();
          handle.update();
        })]}
      >
        {handle.props.label}: {count}
      </button>
    );
  },
);
