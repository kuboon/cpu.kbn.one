/**
 * The site, wired by hand.
 *
 * Three directories become one handler: `islands/` compiled as a single code-split bundle,
 * `pages/` served through this site's own transforms, `static/` served verbatim.
 *
 * `deno serve router.ts` runs it as the dev server; the build crawls the same object. Nothing here
 * is a framework convention — the directory names, the transforms and the deploy rules are all
 * stated below.
 */

import {
  compose,
  createFileTree,
  createIslands,
  githubPages,
  serveAsHost,
} from "@kuboon/remix-ssg/site";
import type { FileServerBehavior } from "@kuboon/remix-ssg/site";

import { base } from "./lib/base.ts";
import { markdown } from "./transforms/markdown.tsx";
import { page } from "./transforms/page.tsx";
import { stagePages } from "./lib/stage-pages.tsx";

/** Deploy path prefix. The build strips it back off when writing, so output lands at the root. */
export { base };

/**
 * Where the crawl starts.
 *
 * Everything else is reached by following links.
 */
export const entryPoints: readonly string[] = ["/"];

/** Where this deploys. The build writes the file this rule would serve. */
export const fileServer: FileServerBehavior = githubPages();

const islands = await createIslands({
  rootDir: "islands",
  basePath: `${base}/assets`,
  // Source maps would double the file count of a static deploy for no gain; the sources are on
  // GitHub.
  bundle: { sourcemap: "none" },
});

export default serveAsHost(
  compose(
    await createFileTree({
      rootDir: "pages",
      basePath: base,
      transforms: [
        markdown({ base }),
        page({ base, islandUrls: islands.urls }),
      ],
    }),
    stagePages({ base, islandUrls: islands.urls }),
    await createFileTree({
      rootDir: "static",
      basePath: `${base}/static`,
      cacheControl: "public, max-age=3600",
    }),
    islands,
  ),
  { behavior: fileServer, base },
);
