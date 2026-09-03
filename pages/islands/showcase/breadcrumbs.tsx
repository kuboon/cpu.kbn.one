import { type Handle } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";
import { Breadcrumbs } from "@remix-run/ui/breadcrumbs";

import {
  DemoCard,
  Field,
  Readout,
  Segmented,
  Slider,
} from "./_lib/controls.tsx";

// Fragments rather than the upstream demo's `/components/navigation/...` paths,
// for two reasons that are both this framework rather than this component. An
// island cannot know the deploy prefix — that is what logical island ids buy —
// so a rooted path here would break under a sub-path deploy. And the static
// build crawls every real link it finds, so a path to a page that does not exist
// fails the build. These point at sections that do exist on this page.
const fullPath = [
  { href: "#", label: "Showcase" },
  { href: "#components", label: "Components" },
  { href: "#breadcrumbs", label: "Breadcrumbs" },
  { label: "Overview" },
];

const separators = [
  { value: "chevron", label: "Chevron" },
  { value: "slash", label: "/" },
  { value: "arrow", label: "›" },
  { value: "dot", label: "•" },
];

export const BreadcrumbsDemo = island(
  "showcase/breadcrumbs",
  "BreadcrumbsDemo",
  function BreadcrumbsDemo(handle: Handle) {
    let depth = 4;
    let separator = "chevron";

    return () => {
      const items = fullPath.slice(0, depth);
      // The last visible crumb is treated as current automatically.
      const separatorNode = separator === "slash"
        ? "/"
        : separator === "arrow"
        ? "›"
        : separator === "dot"
        ? "•"
        : undefined;

      return (
        <DemoCard
          id="breadcrumbs"
          title="Breadcrumbs"
          badge="remix/ui/breadcrumbs"
          tagline="Semantic breadcrumb navigation built from a list of items."
          stage={<Breadcrumbs items={items} separator={separatorNode} />}
          controls={
            <>
              <Field label="depth" hint={`${depth} items`}>
                <Slider
                  min={2}
                  max={fullPath.length}
                  value={depth}
                  onChange={(value) => {
                    depth = value;
                    void handle.update();
                  }}
                />
              </Field>
              <Field label="separator">
                <Segmented
                  options={separators}
                  value={separator}
                  onChange={(value) => {
                    separator = value;
                    void handle.update();
                  }}
                />
              </Field>
              <Readout>
                {separatorNode
                  ? `<Breadcrumbs items={items} separator="${separatorNode}" />`
                  : `<Breadcrumbs items={items} />`}
              </Readout>
            </>
          }
        />
      );
    };
  },
);
