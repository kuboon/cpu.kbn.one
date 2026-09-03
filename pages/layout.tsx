/**
 * The document shell — this site's, not the framework's.
 *
 * It also carries the one thing the browser cannot work out for itself: the map from an island's
 * name to the chunk the bundler emitted, plus the scripts that load them. A page that places no
 * island gets neither, and so ships no JavaScript at all.
 */

import { renderToString } from "@remix-run/ui/server";
import type { RemixNode } from "@remix-run/ui";
import { ISLAND_MAP_ELEMENT_ID } from "@kuboon/remix-ssg/client";

import { Link } from "./lib/link.tsx";

/** What every page hands the shell. */
export interface LayoutProps {
  title: string;
  description?: string;
  /** Deploy path prefix, so every URL in the shell carries it. */
  base: string;
  /** Name -> chunk URL for the islands this page places. Empty on a page with none. */
  islandUrls: Record<string, string>;
  children: RemixNode;
}

/**
 * Renders a page inside the document shell.
 *
 * @param props The page's title, prefix, islands and body
 * @returns The complete HTML document
 */
export async function renderPage(props: LayoutProps): Promise<string> {
  const { base, islandUrls } = props;
  const chunks = [...new Set(Object.values(islandUrls))];
  const home = base === "" ? "/" : base;

  const html = await renderToString(
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
        {props.description
          ? <meta name="description" content={props.description} />
          : null}
        <link rel="icon" href={`${base}/static/favicon.svg`} />
        <link rel="stylesheet" href={`${base}/static/styles.css`} />
      </head>
      <body>
        <header class="site-header">
          <Link class="brand" href={home}>remix-ssg</Link>
          <nav class="site-nav">
            <Link href={home}>Home</Link>
            <Link href={`${base}/about`}>About</Link>
            <Link href={`${base}/blog`}>Blog</Link>
            {/* Showcase: delete this link when you delete the showcase — see README. */}
            <Link href={`${base}/showcase`}>UI showcase</Link>
          </nav>
        </header>
        <main class="site-main">{props.children}</main>
        <footer class="site-footer">
          <p>
            Built with{" "}
            <a href="https://jsr.io/@kuboon/remix-ssg">@kuboon/remix-ssg</a> and
            {" "}
            <a href="https://remix.run">Remix v3</a>.
          </p>
        </footer>
        {chunks.length > 0
          ? (
            <>
              <script type="application/json" id={ISLAND_MAP_ELEMENT_ID}>
                {JSON.stringify(islandUrls)}
              </script>
              {chunks.map((src) => (
                <script key={src} type="module" src={src}></script>
              ))}
            </>
          )
          : null}
      </body>
    </html>,
  );

  return `<!DOCTYPE html>${html}`;
}
