/**
 * `.tsx` pages: a module that exports a component, rendered into the shell.
 *
 * This is how a page uses an island — import it and place it. A page names the islands it places so
 * the shell loads only those chunks.
 */

import type { RemixNode } from "@remix-run/ui";
import type { FileTransform } from "@kuboon/remix-ssg/site";

import { renderPage } from "../layout.tsx";

/** What a `pages/**\/*.tsx` module exports. */
export interface PageModule {
  /** The page body. May be async, for a page that reads content to build itself. */
  default: () => RemixNode | Promise<RemixNode>;
  title?: string;
  description?: string;
  /** Names of the islands this page places, from `islands/`. */
  islands?: readonly string[];
}

export function page(
  context: { base: string; islandUrls: Record<string, string> },
): FileTransform {
  return {
    match: (relativePath) => relativePath.endsWith(".tsx"),

    path: (relativePath) => {
      const withoutExtension = relativePath.replace(/\.tsx$/, "").replace(
        /(^|\/)index$/,
        "",
      );
      return `/${withoutExtension}`.replace(/\/$/, "") || "/";
    },

    async render(file) {
      // Cached for the life of the process; `deno serve --watch` restarts when a page changes.
      const module = await import(file.url.href) as PageModule;

      const islandUrls: Record<string, string> = {};
      for (const name of module.islands ?? []) {
        const chunk = context.islandUrls[name];
        if (chunk === undefined) {
          throw new Error(
            `"${file.path}" names an island "${name}" that does not exist.`,
          );
        }
        islandUrls[name] = chunk;
      }

      return renderPage({
        title: module.title ?? file.path,
        description: module.description,
        base: context.base,
        islandUrls,
        children: await module.default(),
      });
    },
  };
}
