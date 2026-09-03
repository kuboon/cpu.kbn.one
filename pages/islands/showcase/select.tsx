import { type Handle } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";
import { Option, Select } from "@remix-run/ui/select";
import { onSelectChange } from "@remix-run/ui/select/primitives";

import { DemoCard, Field, Readout, Toggle } from "./_lib/controls.tsx";

const frameworks = [
  { value: "remix", label: "Remix" },
  { value: "react-router", label: "React Router", disabled: true },
  { value: "react", label: "React" },
  { value: "preact", label: "Preact" },
  { value: "solid", label: "Solid" },
];

export const SelectDemo = island(
  "showcase/select",
  "SelectDemo",
  function SelectDemo(handle: Handle) {
    let value = "(none)";
    let label = "(none)";
    let disabled = false;

    return () => (
      <DemoCard
        id="select"
        title="Select"
        badge="remix/ui/select"
        tagline="A button-triggered popup value picker backed by listbox and popover."
        stage={
          <Select
            key={disabled ? "disabled" : "enabled"}
            defaultLabel="Select a framework"
            name="framework"
            disabled={disabled}
            mix={onSelectChange((event) => {
              value = event.value ?? "(none)";
              label = event.label ?? "(none)";
              void handle.update();
            })}
          >
            {frameworks.map((framework) => (
              <Option
                key={framework.value}
                value={framework.value}
                label={framework.label}
                disabled={framework.disabled}
              >
                {framework.label}
              </Option>
            ))}
          </Select>
        }
        controls={
          <>
            <Field label="state">
              <Toggle
                label="disabled"
                checked={disabled}
                onChange={(next) => {
                  disabled = next;
                  void handle.update();
                }}
              />
            </Field>
            <Readout>{`value = "${value}"\nlabel = "${label}"`}</Readout>
          </>
        }
        note="React Router is a disabled option — keyboard and pointer selection skip it."
      />
    );
  },
);
