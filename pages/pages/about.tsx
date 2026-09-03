import type { RemixNode } from "@remix-run/ui";

import { base } from "../lib/base.ts";
import { Link } from "../lib/link.tsx";

export const title = "About — remix-ssg";
export const description = "What this starter is and how it works.";

export default function About(): RemixNode {
  return (
    <>
      <h1>About</h1>
      <p>
        <code>router.ts</code> composes three directories into one handler:{" "}
        <code>islands/</code> compiled as a single code-split bundle,{" "}
        <code>pages/</code> served through this site's own transforms, and{" "}
        <code>static/</code> served verbatim.
      </p>
      <p>
        <code>deno serve router.ts</code>{" "}
        runs that handler as the dev server. The build drives the very same
        object with{" "}
        <code>fetch()</code>, writes each response to disk, and follows the
        links it finds — so going from a static deploy to a live server would be
        a change of deploy target rather than of code.
      </p>
      <p>
        Only what is reachable gets generated. A page nothing links to belongs
        in <code>entryPoints</code>, or it is not part of the site.
      </p>
      <p>
        Articles are Markdown files under <code>pages/blog/</code>; see the{" "}
        <Link href={`${base}/blog`}>blog</Link>.
      </p>
      <p>
        <Link href={base === "" ? "/" : base}>← Back home</Link>
      </p>
    </>
  );
}
