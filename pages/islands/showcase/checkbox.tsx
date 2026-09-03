import { css, type Handle, on } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";
import checkbox from "@remix-run/ui/checkbox";

import { theme } from "./_lib/tokens.ts";
import { DemoCard, Field, Readout, Segmented } from "./_lib/controls.tsx";

const sizes = [
  { value: "md", label: "md" },
  { value: "lg", label: "lg" },
];

const children = ["Comments", "Mentions", "Deploys"];

const rowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.primary,
});

export const CheckboxDemo = island(
  "showcase/checkbox",
  "CheckboxDemo",
  function CheckboxDemo(handle: Handle) {
    let size = "md";
    let checkedChildren = [true, false, false];

    return () => {
      const checkedCount = checkedChildren.filter(Boolean).length;
      const parentState: "checked" | "mixed" | "unchecked" = checkedCount === 0
        ? "unchecked"
        : checkedCount === children.length
        ? "checked"
        : "mixed";

      function setAll(next: boolean) {
        checkedChildren = children.map(() => next);
        void handle.update();
      }

      return (
        <DemoCard
          id="checkbox"
          title="Checkbox"
          badge="remix/ui/checkbox"
          tagline="A style mixin for native checkboxes, including app-owned mixed (indeterminate) state."
          stage={
            <div
              mix={css({
                display: "grid",
                gap: "12px",
                width: "min(280px, 100%)",
              })}
            >
              <label
                mix={[rowStyle, css({ fontWeight: theme.fontWeight.semibold })]}
              >
                <input
                  type="checkbox"
                  checked={parentState === "checked"}
                  indeterminate={parentState === "mixed"}
                  mix={[
                    checkbox({ size: size as "md" | "lg", state: parentState }),
                    on<HTMLInputElement>(
                      "change",
                      () => setAll(parentState !== "checked"),
                    ),
                  ]}
                />
                Notifications
              </label>
              <div
                mix={css({
                  display: "grid",
                  gap: "10px",
                  paddingInlineStart: "22px",
                })}
              >
                {children.map((label, index) => (
                  <label key={label} mix={rowStyle}>
                    <input
                      type="checkbox"
                      checked={checkedChildren[index]}
                      mix={[
                        checkbox({ size: size as "md" | "lg" }),
                        on<HTMLInputElement>("change", (event) => {
                          checkedChildren = checkedChildren.map((value, i) =>
                            i === index ? event.currentTarget.checked : value
                          );
                          void handle.update();
                        }),
                      ]}
                    />
                    {label}
                  </label>
                ))}
              </div>
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
              <Readout>
                {`parent state = "${parentState}" (${checkedCount}/${children.length})`}
              </Readout>
            </>
          }
          note="The parent checkbox shows mixed state via the native indeterminate property plus checkbox({ state })."
        />
      );
    };
  },
);
