/**
 * The document shell.
 *
 * It also carries the one thing the browser cannot work out for itself: the map from an island's
 * name to the chunk the bundler emitted, plus the scripts that load them. A page that places no
 * island gets neither, and so ships no JavaScript at all.
 *
 * It renders through `renderToStream`, and the difference from `renderToString` is not buffering:
 * `renderToString` is `renderToStream` with `stripFlushMarkers()` over the result. That marker,
 * `<!-- rmx:flush document -->`, is how the client runtime recognises a whole document. On a page
 * that has islands the runtime turns every internal `<a>` click into a frame navigation, fetches
 * the destination, and swaps the document only when the marker is there; strip it and the URL
 * changes while the page does not, with nothing logged anywhere. Keeping it is what lets a plain
 * `<a href>` navigate correctly whether or not the page it sits on has islands.
 */

import { renderToStream } from "@remix-run/ui/server";
import type { RemixNode } from "@remix-run/ui";
import { ISLAND_MAP_ELEMENT_ID } from "@kuboon/remix-ssg/client";

import { manifest } from "./lib/game/achievements.ts";

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

export const SITE_NAME = "Minimum CPU";

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

  const stream = renderToStream(
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
        {/* game-center (https://ga-cen.kbn.one) reads this; browsers ignore the type. */}
        <script type="application/gamecenter+json">
          {JSON.stringify(manifest())}
        </script>
      </head>
      <body>
        <header class="site-header">
          <a class="brand" href={home}>{SITE_NAME}</a>
          <nav class="site-nav">
            <a href={`${base}/stages`}>ステージ</a>
            <a href={`${base}/library`}>ライブラリ</a>
            <a href={`${base}/how-to-play`}>遊び方</a>
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
    {
      onError(error) {
        throw error;
      },
    },
  );
  const html = await new Response(stream).text();

  return `<!DOCTYPE html>${html}`;
}
