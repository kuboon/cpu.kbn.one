import { markdownToHast } from "@kuboon/md";
import { hastToRemix } from "@kuboon/md/hast_to_remix.ts";
import type { RemixNode } from "@remix-run/ui";

/**
 * Renders a Markdown string to a Remix UI node tree, ready to place inside a page.
 *
 * `@kuboon/md` parses GitHub-flavored Markdown into a sanitized hast tree (heading anchors,
 * Shiki-highlighted code, tables, task lists) and `hastToRemix` converts it to `@remix-run/ui`
 * elements. That converter is its own entry point, so importing `@kuboon/md` does not put a UI
 * framework in the graph of anyone who only wants HTML out.
 */
export async function renderMarkdown(markdown: string): Promise<RemixNode> {
  const hast = await markdownToHast(markdown);
  return hastToRemix(hast) as RemixNode;
}
