import { css, type Handle } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";
import button, { type ButtonTone } from "@remix-run/ui/button";

import { AddIcon, ChevronRightIcon } from "./_lib/icons.tsx";
import {
  ControlGrid,
  DemoCard,
  Field,
  Readout,
  Segmented,
  Toggle,
} from "./_lib/controls.tsx";

const tones: ReadonlyArray<{ value: string; label: string }> = [
  { value: "neutral", label: "Neutral" },
  { value: "primary", label: "Primary" },
  { value: "ghost", label: "Ghost" },
];

const sizes = [
  { value: "md", label: "md" },
  { value: "lg", label: "lg" },
];

const slotStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
});

export const ButtonsDemo = island(
  "showcase/buttons",
  "ButtonsDemo",
  function ButtonsDemo(handle: Handle) {
    let tone = "primary";
    let size = "md";
    let startIcon = true;
    let endIcon = false;
    let disabled = false;

    return () => {
      const attrs = [
        `tone: '${tone}'`,
        size === "lg" ? `size: 'lg'` : null,
      ]
        .filter(Boolean)
        .join(", ");

      return (
        <DemoCard
          id="button"
          title="Button"
          badge="remix/ui/button"
          tagline="A style mixin for pill-shaped action controls — compose it onto a native button."
          stage={
            <button
              type="button"
              disabled={disabled}
              mix={[
                button({ tone: tone as ButtonTone, size: size as "md" | "lg" }),
                slotStyle,
              ]}
            >
              {startIcon
                ? <AddIcon mix={css({ width: "18px", height: "18px" })} />
                : null}
              Create project
              {endIcon
                ? (
                  <ChevronRightIcon
                    mix={css({ width: "18px", height: "18px" })}
                  />
                )
                : null}
            </button>
          }
          controls={
            <>
              <ControlGrid columns={2}>
                <Field label="tone">
                  <Segmented
                    options={tones}
                    value={tone}
                    onChange={(value) => {
                      tone = value;
                      void handle.update();
                    }}
                  />
                </Field>
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
              </ControlGrid>
              <ControlGrid columns={3}>
                <Toggle
                  label="start icon"
                  checked={startIcon}
                  onChange={(value) => {
                    startIcon = value;
                    void handle.update();
                  }}
                />
                <Toggle
                  label="end icon"
                  checked={endIcon}
                  onChange={(value) => {
                    endIcon = value;
                    void handle.update();
                  }}
                />
                <Toggle
                  label="disabled"
                  checked={disabled}
                  onChange={(value) => {
                    disabled = value;
                    void handle.update();
                  }}
                />
              </ControlGrid>
              <Readout>
                {`<button mix={button({ ${attrs} })}>Create project</button>`}
              </Readout>
            </>
          }
        />
      );
    };
  },
);
