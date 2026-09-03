/**
 * The `@remix-run/ui` component showcase — a port of
 * https://github.com/kuboon/remix3-ui-showcase onto this framework.
 *
 * DELETE ME in a repository made from this template: this page, the
 * `islands/showcase/` directory it imports, the nav link in `layout.tsx`, and
 * the `@remix-run/ui/*` subpath entries in `deno.json`. See the root README.
 *
 * It stays here because it is the honest stress test of the island pipeline:
 * 18 entrypoints compiled as one graph, sharing the component library through
 * code-split chunks instead of carrying 18 copies of it.
 */

import { css, type RemixNode } from "@remix-run/ui";

import { AccordionDemo } from "../islands/showcase/accordion.tsx";
import { EntranceExitDemo } from "../islands/showcase/anim-entrance.tsx";
import { LayoutDemo } from "../islands/showcase/anim-layout.tsx";
import { SpringDemo } from "../islands/showcase/anim-spring.tsx";
import { TweenDemo } from "../islands/showcase/anim-tween.tsx";
import { AnchorDemo } from "../islands/showcase/anchor.tsx";
import { BreadcrumbsDemo } from "../islands/showcase/breadcrumbs.tsx";
import { ButtonsDemo } from "../islands/showcase/buttons.tsx";
import { CheckboxDemo } from "../islands/showcase/checkbox.tsx";
import { ComboboxDemo } from "../islands/showcase/combobox.tsx";
import { InputDemo } from "../islands/showcase/input.tsx";
import { ListboxDemo } from "../islands/showcase/listbox.tsx";
import { MenuDemo } from "../islands/showcase/menu.tsx";
import { PopoverDemo } from "../islands/showcase/popover.tsx";
import { RadioDemo } from "../islands/showcase/radio.tsx";
import { SelectDemo } from "../islands/showcase/select.tsx";
import { TabsDemo } from "../islands/showcase/tabs.tsx";
import { ToggleDemo } from "../islands/showcase/toggle.tsx";
import { brandTint, fontSans, theme } from "../islands/showcase/_lib/tokens.ts";

export const title = "UI showcase — remix-ssg";
export const description =
  "Every first-party @remix-run/ui component and the animation primitives, " +
  "each one a hydrated island whose parameters you can change live.";

/** Every demo on this page. The layout loads exactly these chunks. */
export const islands: readonly string[] = [
  "showcase/accordion",
  "showcase/anchor",
  "showcase/anim-entrance",
  "showcase/anim-layout",
  "showcase/anim-spring",
  "showcase/anim-tween",
  "showcase/breadcrumbs",
  "showcase/buttons",
  "showcase/checkbox",
  "showcase/combobox",
  "showcase/input",
  "showcase/listbox",
  "showcase/menu",
  "showcase/popover",
  "showcase/radio",
  "showcase/select",
  "showcase/tabs",
  "showcase/toggle",
];

const componentLinks = [
  { id: "button", label: "Button" },
  { id: "input", label: "Input" },
  { id: "checkbox", label: "Checkbox" },
  { id: "radio", label: "Radio" },
  { id: "toggle", label: "Toggle" },
  { id: "breadcrumbs", label: "Breadcrumbs" },
  { id: "tabs", label: "Tabs" },
  { id: "accordion", label: "Accordion" },
  { id: "menu", label: "Menu" },
  { id: "select", label: "Select" },
  { id: "combobox", label: "Combobox" },
  { id: "listbox", label: "Listbox" },
  { id: "popover", label: "Popover" },
  { id: "anchor", label: "Anchor" },
];

const animationLinks = [
  { id: "animation-spring", label: "Spring" },
  { id: "animation-tween", label: "Tween" },
  { id: "animation-entrance", label: "Entrance & exit" },
  { id: "animation-layout", label: "Layout" },
];

// The badges read this site's own import map, so they never drift from what the
// build actually resolves. Reading a file here is fine: pages render on the
// server at build time, and the build's permission set already grants `read`.
function resolvedVersion(specifier: string): string {
  try {
    const config = JSON.parse(
      Deno.readTextFileSync(new URL("../deno.json", import.meta.url)),
    );
    const entry = (config.imports ?? {})[specifier];
    return typeof entry === "string"
      ? entry.replace(/^[a-z]+:.*@\^?/, "")
      : "—";
  } catch {
    return "—";
  }
}

const versions: ReadonlyArray<{ label: string; value: string }> = [
  { label: "@remix-run/ui", value: resolvedVersion("@remix-run/ui") },
  { label: "@kuboon/remix-ssg", value: resolvedVersion("@kuboon/remix-ssg") },
  { label: "Deno", value: Deno.version.deno },
];

export default function ShowcasePage(): RemixNode {
  return (
    <div mix={pageStyle}>
      <div mix={containerStyle}>
        {Hero()}

        {Section({
          id: "components",
          eyebrow: "Components",
          title: "Every first-party component in remix/ui",
          description:
            "Each card renders a real component from remix/ui. Use the controls below each preview to change its parameters live — the previews are hydrated Remix UI islands.",
          children: (
            <div mix={gridStyle}>
              <ButtonsDemo />
              <InputDemo />
              <CheckboxDemo />
              <RadioDemo />
              <ToggleDemo />
              <BreadcrumbsDemo />
              <TabsDemo />
              <AccordionDemo />
              <MenuDemo />
              <SelectDemo />
              <ComboboxDemo />
              <ListboxDemo />
              <PopoverDemo />
              <AnchorDemo />
            </div>
          ),
        })}

        {Section({
          id: "animation",
          eyebrow: "Animation",
          title: "The animation primitives, parameterised",
          description:
            "Spring, tween, entrance/exit, and layout helpers from remix/ui/animation. Tune the presets and curves and replay the motion in place.",
          children: (
            <div mix={gridStyle}>
              <SpringDemo />
              <TweenDemo />
              <EntranceExitDemo />
              <LayoutDemo />
            </div>
          ),
        })}

        {Footer()}
      </div>
    </div>
  );
}

function Hero() {
  return (
    <header mix={heroStyle}>
      <div mix={css({ display: "grid", gap: "18px" })}>
        <span mix={eyebrowChipStyle}>Remix 3 · remix/ui</span>
        <h1 mix={heroTitleStyle}>Interactive UI &amp; animation showcase</h1>
        <p mix={heroLeadStyle}>
          A living catalogue of every component in{" "}
          <code mix={codeStyle}>remix/ui</code> plus the{" "}
          <code mix={codeStyle}>remix/ui/animation</code>{" "}
          primitives. Every preview is a server-rendered, client-hydrated Remix
          island whose parameters you can change on the fly.
        </p>
        <nav
          aria-label="Jump to a demo"
          mix={css({ display: "grid", gap: "12px" })}
        >
          {LinkRow("Components", componentLinks)}
          {LinkRow("Animation", animationLinks)}
        </nav>
        {VersionStrip()}
      </div>
    </header>
  );
}

function VersionStrip() {
  return (
    <dl aria-label="Package versions" mix={versionStripStyle}>
      {versions.map((entry) => (
        <div key={entry.label} mix={versionPillStyle}>
          <dt mix={versionLabelStyle}>{entry.label}</dt>
          <dd mix={versionValueStyle}>{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function LinkRow(
  label: string,
  links: ReadonlyArray<{ id: string; label: string }>,
) {
  return (
    <div
      mix={css({
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        alignItems: "center",
      })}
    >
      <span
        mix={css({
          fontSize: theme.fontSize.xxs,
          fontWeight: theme.fontWeight.bold,
          textTransform: "uppercase",
          letterSpacing: theme.letterSpacing.wide,
          color: theme.colors.text.muted,
          minWidth: "92px",
        })}
      >
        {label}
      </span>
      {links.map((link) => (
        <a key={link.id} href={`#${link.id}`} mix={chipLinkStyle}>
          {link.label}
        </a>
      ))}
    </div>
  );
}

function Section(props: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: RemixNode;
}) {
  return (
    <section id={props.id} mix={css({ display: "grid", gap: "22px" })}>
      <header mix={css({ display: "grid", gap: "8px" })}>
        <span
          mix={css({
            color: theme.colors.action.primary.background,
            fontSize: theme.fontSize.xs,
            fontWeight: theme.fontWeight.bold,
            textTransform: "uppercase",
            letterSpacing: theme.letterSpacing.wide,
          })}
        >
          {props.eyebrow}
        </span>
        <h2 mix={sectionTitleStyle}>{props.title}</h2>
        <p
          mix={css({
            margin: 0,
            maxWidth: "72ch",
            color: theme.colors.text.secondary,
          })}
        >
          {props.description}
        </p>
      </header>
      {props.children}
    </section>
  );
}

function Footer() {
  return (
    <footer mix={footerStyle}>
      <p mix={css({ margin: 0 })}>
        Built with the Remix 3 template shape — server-rendered,
        client-hydrated, and deployable to GitHub Pages.
      </p>
      <a
        href="https://github.com/remix-run/remix/tree/main/packages/ui"
        mix={footerLinkStyle}
      >
        remix/ui source ↗
      </a>
    </footer>
  );
}

// --- styles -----------------------------------------------------------------

const pageStyle = css({
  "& *, & *::before, & *::after": { boxSizing: "border-box" },
  minHeight: "100vh",
  margin: 0,
  padding: "40px 18px 90px",
  fontFamily: fontSans,
  color: theme.colors.text.primary,
  background: `radial-gradient(1200px 600px at 50% -10%, ${
    brandTint(10)
  }, transparent), ${theme.surface.lvl2}`,
  lineHeight: theme.lineHeight.normal,
  "@media (min-width: 768px)": { padding: "64px 32px 110px" },
});

const containerStyle = css({
  width: "min(1120px, 100%)",
  margin: "0 auto",
  display: "grid",
  gap: "48px",
});

const heroStyle = css({
  display: "grid",
  gap: "24px",
  padding: "32px",
  borderRadius: theme.radius.xl,
  background: theme.surface.lvl0,
  border: `1px solid ${theme.colors.border.subtle}`,
  boxShadow: theme.shadow.lg,
  "@media (min-width: 768px)": { padding: "44px" },
});

const eyebrowChipStyle = css({
  justifySelf: "start",
  padding: "6px 12px",
  borderRadius: theme.radius.full,
  background: brandTint(12),
  color: theme.colors.action.primary.background,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.bold,
  letterSpacing: theme.letterSpacing.wide,
  textTransform: "uppercase",
});

const heroTitleStyle = css({
  margin: 0,
  fontSize: "clamp(2.1rem, 4.6vw, 3.6rem)",
  lineHeight: 1.05,
  letterSpacing: theme.letterSpacing.tight,
  fontWeight: theme.fontWeight.bold,
});

const heroLeadStyle = css({
  margin: 0,
  maxWidth: "70ch",
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.lg,
});

const codeStyle = css({
  fontFamily: theme.fontFamily.mono,
  fontSize: "0.9em",
  padding: "1px 6px",
  borderRadius: theme.radius.sm,
  background: theme.surface.lvl2,
  color: theme.colors.text.primary,
});

const versionStripStyle = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  margin: 0,
  marginTop: "4px",
});

const versionPillStyle = css({
  display: "inline-flex",
  alignItems: "baseline",
  gap: "6px",
  padding: "5px 11px",
  borderRadius: theme.radius.full,
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.subtle}`,
});

const versionLabelStyle = css({
  margin: 0,
  fontSize: theme.fontSize.xxs,
  fontWeight: theme.fontWeight.bold,
  textTransform: "uppercase",
  letterSpacing: theme.letterSpacing.wide,
  color: theme.colors.text.muted,
});

const versionValueStyle = css({
  margin: 0,
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
});

const chipLinkStyle = css({
  padding: "5px 11px",
  borderRadius: theme.radius.full,
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.subtle}`,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  textDecoration: "none",
  "&:hover": {
    background: theme.colors.action.primary.background,
    color: theme.colors.action.primary.foreground,
    borderColor: theme.colors.action.primary.background,
  },
});

const sectionTitleStyle = css({
  margin: 0,
  fontSize: "clamp(1.6rem, 3vw, 2.3rem)",
  lineHeight: 1.1,
  letterSpacing: theme.letterSpacing.tight,
  fontWeight: theme.fontWeight.bold,
});

const gridStyle = css({
  display: "grid",
  gap: "22px",
  gridTemplateColumns: "1fr",
  "@media (min-width: 900px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
});

const footerStyle = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "10px 18px",
  alignItems: "center",
  justifyContent: "space-between",
  paddingTop: "16px",
  borderTop: `1px solid ${theme.colors.border.subtle}`,
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.sm,
});

const footerLinkStyle = css({
  color: theme.colors.text.link,
  fontWeight: theme.fontWeight.semibold,
  textDecoration: "none",
});
