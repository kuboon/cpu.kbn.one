import { css, type Handle } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@remix-run/ui/accordion";
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

const types = [
  { value: "single", label: "Single" },
  { value: "multiple", label: "Multiple" },
];

const contentStyle = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
});

export const AccordionDemo = island(
  "showcase/accordion",
  "AccordionDemo",
  function AccordionDemo(handle: Handle) {
    let type = "single";
    let collapsible = true;
    let headingLevel = 3;
    let disableItem = false;

    return () => {
      const multiple = type === "multiple";
      // Remount when the mode changes — single/multiple use different value shapes.
      const body = (
        <>
          <AccordionItem value="account">
            <AccordionTrigger>Account</AccordionTrigger>
            <AccordionContent>
              <p mix={contentStyle}>
                Manage profile, email, and password preferences.
              </p>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="billing" disabled={disableItem}>
            <AccordionTrigger>
              Billing {disableItem ? "(disabled)" : ""}
            </AccordionTrigger>
            <AccordionContent>
              <p mix={contentStyle}>
                Review invoices and update the payment method.
              </p>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="notifications">
            <AccordionTrigger>Notifications</AccordionTrigger>
            <AccordionContent>
              <p mix={contentStyle}>
                Choose which events send email and in-app alerts.
              </p>
            </AccordionContent>
          </AccordionItem>
        </>
      );

      return (
        <DemoCard
          id="accordion"
          title="Accordion"
          badge="remix/ui/accordion"
          tagline="A disclosure set with single or multiple expandable items."
          stage={
            <div mix={css({ width: "min(420px, 100%)" })}>
              {multiple
                ? (
                  <Accordion
                    key="multiple"
                    type="multiple"
                    defaultValue={["account"]}
                    headingLevel={headingLevel as 1 | 2 | 3 | 4 | 5 | 6}
                  >
                    {body}
                  </Accordion>
                )
                : (
                  <Accordion
                    key="single"
                    type="single"
                    defaultValue="account"
                    collapsible={collapsible}
                    headingLevel={headingLevel as 1 | 2 | 3 | 4 | 5 | 6}
                  >
                    {body}
                  </Accordion>
                )}
            </div>
          }
          controls={
            <>
              <Field label="type">
                <Segmented
                  options={types}
                  value={type}
                  onChange={(value) => {
                    type = value;
                    void handle.update();
                  }}
                />
              </Field>
              <Field label="headingLevel" hint={`h${headingLevel}`}>
                <Slider
                  min={2}
                  max={5}
                  value={headingLevel}
                  onChange={(value) => {
                    headingLevel = value;
                    void handle.update();
                  }}
                />
              </Field>
              <ControlGrid columns={2}>
                <Toggle
                  label="collapsible"
                  checked={collapsible}
                  onChange={(value) => {
                    collapsible = value;
                    void handle.update();
                  }}
                />
                <Toggle
                  label="disable billing"
                  checked={disableItem}
                  onChange={(value) => {
                    disableItem = value;
                    void handle.update();
                  }}
                />
              </ControlGrid>
              <Readout>
                {multiple
                  ? `<Accordion type="multiple" defaultValue={['account']} headingLevel={${headingLevel}}>`
                  : `<Accordion defaultValue="account" collapsible={${collapsible}} headingLevel={${headingLevel}}>`}
              </Readout>
            </>
          }
          note={collapsible || multiple
            ? undefined
            : "With collapsible=false in single mode, the open item stays locked open."}
        />
      );
    };
  },
);
