import { css, type Handle } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";
import { Menu, MenuItem, Submenu } from "@remix-run/ui/menu";
import { onMenuSelect } from "@remix-run/ui/menu/primitives";

import { theme } from "./_lib/tokens.ts";
import { ControlGrid, DemoCard, Readout, Toggle } from "./_lib/controls.tsx";

const separatorStyle = css({
  border: 0,
  borderBlockStart: `1px solid ${theme.colors.border.subtle}`,
  marginBlock: "4px",
});

export const MenuDemo = island(
  "showcase/menu",
  "MenuDemo",
  function MenuDemo(handle: Handle) {
    let wordWrap = true;
    let density = "comfortable";
    let lastAction = "(none)";
    let includeSubmenu = true;
    let disableMinimap = false;

    return () => (
      <DemoCard
        id="menu"
        title="Menu"
        badge="remix/ui/menu"
        tagline="A button-triggered menu with checkbox, radio, and nested submenu items."
        stage={
          <Menu
            label="View"
            mix={onMenuSelect((event) => {
              const item = event.item;
              if (item.name === "wordWrap") {
                wordWrap = item.checked ?? false;
              } else if (item.name === "density" && item.value) {
                density = item.value;
              }
              lastAction = `${item.name}${item.value ? `=${item.value}` : ""}${
                item.type === "checkbox"
                  ? ` (${item.checked ? "on" : "off"})`
                  : ""
              }`;
              void handle.update();
            })}
          >
            <MenuItem checked={wordWrap} name="wordWrap" type="checkbox">
              Word wrap
            </MenuItem>
            <MenuItem disabled={disableMinimap} name="minimap">
              Minimap
            </MenuItem>
            <hr mix={separatorStyle} />
            <MenuItem
              checked={density === "compact"}
              name="density"
              type="radio"
              value="compact"
            >
              Compact
            </MenuItem>
            <MenuItem
              checked={density === "comfortable"}
              name="density"
              type="radio"
              value="comfortable"
            >
              Comfortable
            </MenuItem>
            {includeSubmenu
              ? (
                <Submenu label="Zoom">
                  <MenuItem name="zoom" value="in">
                    Zoom in
                  </MenuItem>
                  <MenuItem name="zoom" value="out">
                    Zoom out
                  </MenuItem>
                </Submenu>
              )
              : null}
          </Menu>
        }
        controls={
          <>
            <ControlGrid columns={2}>
              <Toggle
                label="include submenu"
                checked={includeSubmenu}
                onChange={(value) => {
                  includeSubmenu = value;
                  void handle.update();
                }}
              />
              <Toggle
                label="disable minimap"
                checked={disableMinimap}
                onChange={(value) => {
                  disableMinimap = value;
                  void handle.update();
                }}
              />
            </ControlGrid>
            <Readout>
              {`wordWrap = ${wordWrap}\ndensity  = "${density}"\nlast     = ${lastAction}`}
            </Readout>
          </>
        }
        note="Open the menu and select items — arrow keys, typeahead, and submenu hover all work."
      />
    );
  },
);
