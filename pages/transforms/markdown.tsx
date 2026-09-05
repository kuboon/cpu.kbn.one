/**
 * `.md` pages: a Markdown document with YAML front-matter, rendered into the shell.
 */

import type { FileTransform } from "@kuboon/remix-ssg/site";

import { parseDocument } from "../lib/document.ts";
import { renderMarkdown } from "../lib/markdown.ts";
import { renderPage, SITE_NAME } from "../layout.tsx";

export function markdown(context: { base: string }): FileTransform {
  return {
    match: (relativePath) => relativePath.endsWith(".md"),

    path: (relativePath) => {
      const withoutExtension = relativePath.replace(/\.md$/, "").replace(
        /(^|\/)index$/,
        "",
      );
      return `/${withoutExtension}`.replace(/\/$/, "") || "/";
    },

    async render(file) {
      const slug = file.path.replace(/\.md$/, "").split("/").pop() ?? file.path;
      const doc = parseDocument(slug, await Deno.readTextFile(file.url));
      const body = await renderMarkdown(doc.body);

      return renderPage({
        title: `${doc.title} — ${SITE_NAME}`,
        description: doc.summary,
        base: context.base,
        islandUrls: {},
        children: (
          <article class="post">
            <h1>{doc.title}</h1>
            {doc.date ? <time datetime={doc.date}>{doc.date}</time> : null}
            {body}
          </article>
        ),
      });
    },
  };
}
