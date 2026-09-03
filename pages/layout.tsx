/**
 * The document shell.
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

export const SITE_NAME = "cpu.kbn.one";

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
    <html lang="ja">
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
          <Link class="brand" href={home}>{SITE_NAME}</Link>
          <nav class="site-nav">
            <Link href={home}>ステージ</Link>
            <Link href={`${base}/library`}>ライブラリ</Link>
            <Link href={`${base}/plan`}>企画書</Link>
          </nav>
        </header>
        <main class="site-main">{props.children}</main>
        <footer class="site-footer">
          <p>
            <a href="https://github.com/kuboon/cpu.kbn.one">GitHub</a>
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
