import type { RemixNode } from "@remix-run/ui";

import { base } from "../lib/base.ts";
import { Link } from "../lib/link.tsx";
import { Counter } from "../islands/counter.tsx";
import { Total } from "../islands/total.tsx";

export const title = "remix-ssg — a static site starter";
export const description =
  "A Remix v3 static-site-generation starter for GitHub Pages.";

/** This page places two islands, so the shell loads their chunks and nothing else. */
export const islands: readonly string[] = ["counter", "total"];

export default function Home(): RemixNode {
  return (
    <>
      <h1>A static site, rendered by your own handler</h1>
      <p class="lead">
        This starter serves <a href="https://remix.run">Remix v3</a>{" "}
        pages from a handler you write in <code>router.ts</code>, and{" "}
        <a href="https://jsr.io/@kuboon/remix-ssg">@kuboon/remix-ssg</a>{" "}
        crawls that same handler into static HTML for GitHub Pages.
      </p>
      <ul class="features">
        <li>Server-rendered pages — zero client JavaScript by default.</li>
        <li>
          Content authored in Markdown, rendered with{" "}
          <a href="https://jsr.io/@kuboon/md">@kuboon/md</a>{" "}
          by a transform this site owns.
        </li>
        <li>Works at the domain root, a repo sub-path, or a PR preview URL.</li>
        <li>Opt into interactivity per page with hydrated islands.</li>
      </ul>
      <section class="demo">
        <h2>Two islands, one shared module</h2>
        <p>
          Both controls below are server-rendered like every other page, then
          hydrated in the browser — view source and you'll find them already in
          the initial HTML.
        </p>
        <p>
          They are <em>separate browser entrypoints</em>{" "}
          that never talk to each other. Each one imports the same click store,
          and the running total keeps up because the bundler emitted that store
          once, into a chunk they share. Compile the two entries independently
          and each gets a private copy — the total would sit at zero forever.
        </p>
        <div class="demo-row">
          <Counter label="Left" start={0} />
          <Counter label="Right" start={0} />
          <Total label="Shared total" />
        </div>
      </section>
      <p>
        <Link class="button" href={`${base}/blog`}>Read the blog →</Link>
      </p>
    </>
  );
}
