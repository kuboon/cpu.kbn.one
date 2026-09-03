import { css, type Handle } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";
import radio from "@remix-run/ui/radio";

import { theme } from "./_lib/tokens.ts";
import { DemoCard, Field, Readout, Segmented } from "./_lib/controls.tsx";

const sizes = [
  { value: "md", label: "md" },
  { value: "lg", label: "lg" },
];

const speeds = [
  { value: "standard", label: "Standard", note: "5–7 business days" },
  { value: "express", label: "Express", note: "2–3 business days" },
  { value: "overnight", label: "Overnight", note: "Next business day" },
];

const optionStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.primary,
});

export const RadioDemo = island(
  "showcase/radio",
  "RadioDemo",
  function RadioDemo(handle: Handle) {
    let size = "md";

    return () => (
      <DemoCard
        id="radio"
        title="Radio"
        badge="remix/ui/radio"
        tagline="A style mixin for native radio inputs grouped by name."
        stage={
          <fieldset
            mix={css({
              display: "grid",
              gap: "12px",
              width: "min(320px, 100%)",
              border: "none",
              margin: 0,
              padding: 0,
            })}
          >
            {speeds.map((speed, index) => (
              <label key={speed.value} mix={optionStyle}>
                <input
                  mix={radio({ size: size as "md" | "lg" })}
                  name="shipping-speed"
                  value={speed.value}
                  defaultChecked={index === 0}
                />
                <span mix={css({ display: "grid" })}>
                  <span mix={css({ fontWeight: theme.fontWeight.medium })}>
                    {speed.label}
                  </span>
                  <span
                    mix={css({
                      fontSize: theme.fontSize.xs,
                      color: theme.colors.text.muted,
                    })}
                  >
                    {speed.note}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
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
            <Readout>
              {`<input mix={radio({ size: '${size}' })} name="shipping-speed" />`}
            </Readout>
          </>
        }
      />
    );
  },
);
