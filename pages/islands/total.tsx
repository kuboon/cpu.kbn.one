import type { Handle } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";

import { clicks } from "./store.ts";

/**
 * A second island, and a second browser entrypoint, that shares module state with `Counter`.
 *
 * It never talks to the counter directly — it subscribes to the {@link clicks} store both islands
 * import. The number below only moves because the two entrypoints resolved that import to the
 * *same* module instance, which is what compiling them as one code-split graph buys.
 */
export const Total = island(
  "total",
  "Total",
  function Total(handle: Handle<{ label: string }>) {
    // Server-rendered as 0; the subscription only exists in the browser.
    let total = clicks.total;

    clicks.subscribe(() => {
      total = clicks.total;
      handle.update();
    });

    return () => (
      <output class="total">
        {handle.props.label}: <strong>{total}</strong>
      </output>
    );
  },
);
