/**
 * Blog articles: the Markdown files under `pages/blog/`.
 *
 * The framework has no content model — it serves files through the transforms this site provides —
 * so what an article *is* lives here. The transform renders one; the blog index lists them all.
 */

import { extract } from "@std/front-matter/yaml";
import { join } from "@std/path";

/** Directory holding the articles. */
export const ARTICLES_DIR: string =
  new URL("../pages/blog/", import.meta.url).pathname;

/** A Markdown article: front-matter metadata plus the Markdown body. */
export interface Article {
  /** The file's name without its extension, which is also its URL segment. */
  slug: string;
  title: string;
  date: string;
  summary: string;
  /** The Markdown body, front-matter removed. */
  body: string;
}

/**
 * Parses one article.
 *
 * @param slug The file's name without its extension
 * @param text The file's contents
 * @returns The article
 */
export function parseArticle(slug: string, text: string): Article {
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

/**
 * Reads every article, newest first.
 *
 * @returns The articles
 */
export async function listArticles(): Promise<Article[]> {
  const articles: Article[] = [];

  for await (const entry of Deno.readDir(ARTICLES_DIR)) {
    if (!entry.isFile || !entry.name.endsWith(".md")) continue;
    articles.push(
      parseArticle(
        entry.name.replace(/\.md$/, ""),
        await Deno.readTextFile(join(ARTICLES_DIR, entry.name)),
      ),
    );
  }

  return articles.sort((a, b) => b.date.localeCompare(a.date));
}
