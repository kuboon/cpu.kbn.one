import { css, type Handle } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";
import { Tab, TabList, TabPanel, Tabs } from "@remix-run/ui/tabs";

import { theme } from "./_lib/tokens.ts";
import { DemoCard, Field, Readout, Segmented } from "./_lib/controls.tsx";

const sizes = [
  { value: "md", label: "md" },
  { value: "lg", label: "lg" },
];

const panelStyle = css({
  padding: "4px 2px",
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
});

export const TabsDemo = island(
  "showcase/tabs",
  "TabsDemo",
  function TabsDemo(handle: Handle) {
    let active = "overview";
    let size = "md";

    return () => (
      <DemoCard
        id="tabs"
        title="Tabs"
        badge="remix/ui/tabs"
        tagline="A tab control with one active tab and matching panels, controlled or self-managed."
        stage={
          <div mix={css({ width: "min(420px, 100%)" })}>
            <Tabs
              activeTab={active}
              size={size as "md" | "lg"}
              onActiveTabChange={(next) => {
                active = next;
                void handle.update();
              }}
            >
              <TabList aria-label="Project sections">
                <Tab name="overview">Overview</Tab>
                <Tab name="activity">Activity</Tab>
                <Tab name="settings">Settings</Tab>
              </TabList>
              <TabPanel name="overview">
                <p mix={panelStyle}>
                  A high-level summary of the project and its current status.
                </p>
              </TabPanel>
              <TabPanel name="activity">
                <p mix={panelStyle}>
                  Recent commits, deploys, and comments from your team.
                </p>
              </TabPanel>
              <TabPanel name="settings">
                <p mix={panelStyle}>
                  Visibility, access control, and notification preferences.
                </p>
              </TabPanel>
            </Tabs>
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
            <Readout>{`activeTab = "${active}"`}</Readout>
          </>
        }
        note="Arrow keys move between tabs; Home and End jump to the first and last."
      />
    );
  },
);
