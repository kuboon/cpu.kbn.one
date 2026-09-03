import type { RemixNode } from "@remix-run/ui";

import { base } from "../../lib/base.ts";
import { listArticles } from "../../lib/articles.ts";
import { Link } from "../../lib/link.tsx";

export const title = "Blog — remix-ssg";
export const description =
  "Articles authored in Markdown, rendered to static HTML.";

/**
 * A page that builds itself from content.
 *
 * It reads the sibling `.md` files rather than being handed a list, which is what keeps the
 * framework free of a content model — and it is also what makes every article reachable, since the
 * crawl only writes what something links to.
 */
export default async function Blog(): Promise<RemixNode> {
  const articles = await listArticles();

  return (
    <>
      <h1>Blog</h1>
      <ul class="post-list">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link href={`${base}/blog/${encodeURIComponent(article.slug)}`}>
              {article.title}
            </Link>
            {article.date
              ? <time datetime={article.date}>{article.date}</time>
              : null}
            <p>{article.summary}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
