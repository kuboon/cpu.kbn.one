import { css, type Handle, ref } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";
import { anchor, type AnchorPlacement } from "@remix-run/ui/anchor";
import { theme } from "./_lib/tokens.ts";

import {
  ControlGrid,
  DemoCard,
  Field,
  Readout,
  Segmented,
  Slider,
  Toggle,
} from "./_lib/controls.tsx";

const placements = [
  { value: "bottom", label: "bottom" },
  { value: "top", label: "top" },
  { value: "left", label: "left" },
  { value: "right", label: "right" },
  { value: "bottom-start", label: "bottom-start" },
  { value: "bottom-end", label: "bottom-end" },
];

export const AnchorDemo = island(
  "showcase/anchor",
  "AnchorDemo",
  function AnchorDemo(handle: Handle) {
    let anchorEl: HTMLElement | null = null;
    let floatEl: HTMLElement | null = null;
    let cleanup: (() => void) | null = null;

    let placement = "bottom";
    let offset = 10;
    let inset = false;

    function reposition() {
      cleanup?.();
      cleanup = null;
      if (anchorEl && floatEl) {
        cleanup = anchor(floatEl, anchorEl, {
          placement: placement as AnchorPlacement,
          offset,
          inset,
        });
      }
    }

    handle.signal.addEventListener("abort", () => cleanup?.());

    return () => {
      // Re-run positioning after each render so parameter changes take effect.
      handle.queueTask(() => reposition());

      return (
        <DemoCard
          id="anchor"
          title="Anchor"
          badge="remix/ui/anchor"
          tagline="The positioning engine that keeps a floating element pinned to an anchor."
          stage={
            <div
              mix={css({
                position: "relative",
                display: "grid",
                placeItems: "center",
                minHeight: "120px",
                width: "100%",
              })}
            >
              <div
                mix={[
                  ref((node) => {
                    anchorEl = node as HTMLElement;
                  }),
                  css({
                    padding: "12px 18px",
                    borderRadius: theme.radius.md,
                    background: theme.colors.action.secondary.background,
                    border: `1px solid ${theme.colors.border.default}`,
                    fontSize: theme.fontSize.sm,
                    fontWeight: theme.fontWeight.semibold,
                    color: theme.colors.text.primary,
                  }),
                ]}
              >
                Anchor element
              </div>
              <div
                mix={[
                  ref((node) => {
                    floatEl = node as HTMLElement;
                  }),
                  css({
                    position: "fixed",
                    top: 0,
                    left: 0,
                    padding: "8px 12px",
                    borderRadius: theme.radius.md,
                    background: theme.colors.action.primary.background,
                    color: theme.colors.action.primary.foreground,
                    fontSize: theme.fontSize.xs,
                    fontWeight: theme.fontWeight.semibold,
                    boxShadow: theme.shadow.lg,
                    pointerEvents: "none",
                    zIndex: 5,
                  }),
                ]}
              >
                Floating
              </div>
            </div>
          }
          controls={
            <>
              <Field label="placement">
                <Segmented
                  options={placements}
                  value={placement}
                  onChange={(value) => {
                    placement = value;
                    void handle.update();
                  }}
                />
              </Field>
              <ControlGrid columns={2}>
                <Field label="offset" hint={`${offset}px`}>
                  <Slider
                    min={0}
                    max={32}
                    value={offset}
                    onChange={(value) => {
                      offset = value;
                      void handle.update();
                    }}
                  />
                </Field>
                <Toggle
                  label="inset"
                  checked={inset}
                  onChange={(value) => {
                    inset = value;
                    void handle.update();
                  }}
                />
              </ControlGrid>
              <Readout>
                {`anchor(floating, target, {\n  placement: "${placement}",\n  offset: ${offset},\n  inset: ${inset},\n})`}
              </Readout>
            </>
          }
        />
      );
    };
  },
);
