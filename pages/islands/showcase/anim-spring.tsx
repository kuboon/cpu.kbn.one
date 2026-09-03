import { css, type Handle, on } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";
import button from "@remix-run/ui/button";
import { spring, type SpringPreset } from "@remix-run/ui/animation";

import { iconButtonStyle, PlayIcon } from "./_lib/icons.tsx";
import { theme } from "./_lib/tokens.ts";

import { springPresets } from "./_lib/anim.ts";
import {
  ControlGrid,
  DemoCard,
  Field,
  Readout,
  Segmented,
  Slider,
} from "./_lib/controls.tsx";

export const SpringDemo = island(
  "showcase/anim-spring",
  "SpringDemo",
  function SpringDemo(handle: Handle) {
    let mode = "bouncy";
    let duration = 400;
    let bounce = 0.3;
    let moved = false;

    return () => {
      const custom = mode === "custom";
      // Animate `left` (not `transform`): a transform percentage resolves against
      // the box's own 56px width, so it would never travel across the track.
      const transition = custom
        ? spring.transition("left", { duration, bounce })
        : spring.transition("left", mode as SpringPreset);
      const easing = custom
        ? spring({ duration, bounce }).easing
        : spring(mode as SpringPreset).easing;

      return (
        <DemoCard
          id="animation-spring"
          title="Spring"
          badge="animation · spring"
          tagline="SwiftUI-style spring physics, stringified into a CSS linear() transition."
          stage={
            <div
              mix={css({
                width: "100%",
                display: "grid",
                gap: "20px",
                placeItems: "center",
              })}
            >
              <div
                mix={css({
                  position: "relative",
                  width: "min(320px, 100%)",
                  height: "56px",
                })}
              >
                <div
                  style={{
                    left: moved ? "calc(100% - 56px)" : "0px",
                    transition,
                  }}
                  mix={css({
                    position: "absolute",
                    top: 0,
                    width: "56px",
                    height: "56px",
                    borderRadius: theme.radius.lg,
                    background: theme.colors.action.primary.background,
                    boxShadow: theme.shadow.lg,
                  })}
                />
              </div>
              <button
                type="button"
                mix={[
                  button({ tone: "neutral" }),
                  iconButtonStyle,
                  on<HTMLElement>("click", () => {
                    moved = !moved;
                    void handle.update();
                  }),
                ]}
              >
                <PlayIcon mix={css({ width: "16px", height: "16px" })} />
                {moved ? "Send back" : "Animate"}
              </button>
            </div>
          }
          controls={
            <>
              <Field label="preset">
                <Segmented
                  options={[...springPresets, {
                    value: "custom",
                    label: "custom",
                  }]}
                  value={mode}
                  onChange={(value) => {
                    mode = value;
                    void handle.update();
                  }}
                />
              </Field>
              {custom
                ? (
                  <ControlGrid columns={2}>
                    <Field label="duration" hint={`${duration}ms`}>
                      <Slider
                        min={150}
                        max={1200}
                        step={50}
                        value={duration}
                        onChange={(value) => {
                          duration = value;
                          void handle.update();
                        }}
                      />
                    </Field>
                    <Field label="bounce" hint={bounce.toFixed(2)}>
                      <Slider
                        min={-0.5}
                        max={0.7}
                        step={0.05}
                        value={bounce}
                        onChange={(value) => {
                          bounce = value;
                          void handle.update();
                        }}
                      />
                    </Field>
                  </ControlGrid>
                )
                : null}
              <Readout>{`transition: left ${easing}`}</Readout>
            </>
          }
        />
      );
    };
  },
);
