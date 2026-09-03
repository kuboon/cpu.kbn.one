import type { Handle, RemixNode } from "@remix-run/ui";

/**
 * Internal site link.
 *
 * Renders a normal `<a>`, but marks it `data-rmx-document` so that on pages where the client runtime is
 * active (i.e. pages with hydrated islands), clicks still perform a full document navigation
 * instead of client-side SPA navigation. That keeps this statically generated multi-page site
 * predictable on any host.
 *
 * Use it for links within the site; use a plain `<a>` for external links.
 */
export function Link(
  handle: Handle<{ href: string; class?: string; children: RemixNode }>,
) {
  return () => {
    const { href, class: className, children } = handle.props;
    // `data-rmx-document` is the runtime's opt-out attribute, not in the JSX prop
    // types. The name matters: @remix-run/ui 0.8.0 renamed it from `rmx-document`,
    // and the runtime simply ignores an attribute it does not recognise — so the
    // old spelling turned every link into a frame navigation with no error.
    const attrs = { "data-rmx-document": "" } as Record<string, string>;
    return (
      <a href={href} class={className} {...attrs}>
        {children}
      </a>
    );
  };
}
