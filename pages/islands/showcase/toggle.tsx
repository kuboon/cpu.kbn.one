import { css, type Handle } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";
import toggle from "@remix-run/ui/toggle";

import { theme } from "./_lib/tokens.ts";
import { DemoCard, Field, Readout, Segmented } from "./_lib/controls.tsx";

const sizes = [
  { value: "md", label: "md" },
  { value: "lg", label: "lg" },
];

const rowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.primary,
});

export const ToggleDemo = island(
  "showcase/toggle",
  "ToggleDemo",
  function ToggleDemo(handle: Handle) {
    let size = "md";

    return () => (
      <DemoCard
        id="toggle"
        title="Toggle"
        badge="remix/ui/toggle"
        tagline="A style mixin that renders a native checkbox as an accessible switch."
        stage={
          <div mix={css({ display: "grid", gap: "14px" })}>
            <label mix={rowStyle}>
              <input
                mix={toggle({ size: size as "md" | "lg" })}
                defaultChecked
              />
              Email notifications
            </label>
            <label mix={rowStyle}>
              <input mix={toggle({ size: size as "md" | "lg" })} />
              Weekly digest
            </label>
            <label mix={rowStyle}>
              <input mix={toggle({ size: size as "md" | "lg" })} disabled />
              SMS alerts (disabled)
            </label>
          </div>
        }
        controls={
          <>
            <Field label="size">
              <Segmented
                options={sizes}
                value={size}
                onChange={(value) => {
                  size = value;
                  void handle.update();
                }}
              />
            </Field>
            <Readout>{`<input mix={toggle({ size: '${size}' })} />`}</Readout>
          </>
        }
        note="State is native — the switch uses the checkbox's own checked value."
      />
    );
  },
);
