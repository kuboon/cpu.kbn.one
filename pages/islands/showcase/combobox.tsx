import { css, type Handle } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";
import { Combobox, ComboboxOption } from "@remix-run/ui/combobox";
import { onComboboxChange } from "@remix-run/ui/combobox/primitives";

import { DemoCard, Field, Readout, Toggle } from "./_lib/controls.tsx";

const airports = [
  {
    value: "LAX",
    label: "Los Angeles International",
    searchValue: ["lax", "los angeles"],
  },
  {
    value: "JFK",
    label: "John F. Kennedy International",
    searchValue: ["jfk", "new york"],
  },
  {
    value: "SFO",
    label: "San Francisco International",
    searchValue: ["sfo", "san francisco"],
  },
  {
    value: "ORD",
    label: "O'Hare International",
    searchValue: ["ord", "chicago"],
  },
  {
    value: "SEA",
    label: "Seattle–Tacoma International",
    searchValue: ["sea", "seattle"],
  },
  {
    value: "HND",
    label: "Tokyo Haneda",
    searchValue: ["hnd", "tokyo", "haneda"],
  },
];

export const ComboboxDemo = island(
  "showcase/combobox",
  "ComboboxDemo",
  function ComboboxDemo(handle: Handle) {
    let value = "(none)";
    let label = "(none)";
    let disabled = false;

    return () => (
      <DemoCard
        id="combobox"
        title="Combobox"
        badge="remix/ui/combobox"
        tagline="An input-first picker: type to filter aliases, commit one stable value."
        stage={
          <div mix={css({ width: "min(360px, 100%)" })}>
            <Combobox
              key={disabled ? "disabled" : "enabled"}
              inputId="airport"
              name="airport"
              placeholder="Search airports or codes"
              disabled={disabled}
              mix={onComboboxChange((event) => {
                value = event.value ?? "(none)";
                label = event.label ?? "(none)";
                void handle.update();
              })}
            >
              {airports.map((airport) => (
                <ComboboxOption
                  key={airport.value}
                  value={airport.value}
                  label={airport.label}
                  searchValue={airport.searchValue}
                />
              ))}
            </Combobox>
          </div>
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
        note='Try typing a code like "hnd" or a city like "tokyo" — searchValue aliases match both.'
      />
    );
  },
);
