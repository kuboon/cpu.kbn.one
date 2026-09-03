/**
 * Markdown documents: front-matter metadata plus the body.
 */

import { extract } from "@std/front-matter/yaml";

export interface MarkdownDocument {
  /** The file's name without its extension, which is also its URL segment. */
  slug: string;
  title: string;
  date: string;
  summary: string;
  /** The Markdown body, front-matter removed. */
  body: string;
}

/**
 * Parses one document.
 *
 * @param slug The file's name without its extension
 * @param text The file's contents
 */
export function parseDocument(slug: string, text: string): MarkdownDocument {
  const { attrs, body } = extract(text);
  const a = attrs as Record<string, unknown>;

  return {
    slug,
    title: typeof a.title === "string" ? a.title : slug,
    date: typeof a.date === "string" ? a.date : "",
    summary: typeof a.summary === "string" ? a.summary : "",
    body,
  };
}
