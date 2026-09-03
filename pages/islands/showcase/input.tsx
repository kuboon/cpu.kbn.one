import { css, type Handle } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";
import input from "@remix-run/ui/input";

import { SearchIcon } from "./_lib/icons.tsx";
import { theme } from "./_lib/tokens.ts";
import {
  DemoCard,
  Field,
  Readout,
  Segmented,
  Toggle,
} from "./_lib/controls.tsx";

const sizes = [
  { value: "md", label: "md" },
  { value: "lg", label: "lg" },
];

const labelStyle = css({
  display: "grid",
  gap: "6px",
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.secondary,
});

export const InputDemo = island(
  "showcase/input",
  "InputDemo",
  function InputDemo(handle: Handle) {
    let size = "md";
    let withIcon = true;

    return () => (
      <DemoCard
        id="input"
        title="Input"
        badge="remix/ui/input"
        tagline="A style mixin for text inputs, standalone or framed with inline icons via input.root()."
        stage={
          <div
            mix={css({
              display: "grid",
              gap: "16px",
              width: "min(340px, 100%)",
            })}
          >
            <label mix={labelStyle}>
              Project name
              <input
                mix={input({ size: size as "md" | "lg" })}
                placeholder="Remix 3 UI Showcase"
              />
            </label>
            <label mix={labelStyle}>
              Search
              {withIcon
                ? (
                  <div mix={input.root()}>
                    <SearchIcon />
                    <input
                      mix={input.field()}
                      placeholder="Search components"
                    />
                  </div>
                )
                : (
                  <input
                    mix={input({ size: size as "md" | "lg" })}
                    placeholder="Search components"
                  />
                )}
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
            <Toggle
              label="inline search icon (input.root)"
              checked={withIcon}
              onChange={(value) => {
                withIcon = value;
                void handle.update();
              }}
            />
            <Readout>
              {withIcon
                ? `<div mix={input.root()}><SearchIcon /><input mix={input.field()} /></div>`
                : `<input mix={input({ size: '${size}' })} />`}
            </Readout>
          </>
        }
      />
    );
  },
);
