/**
 * One editor page per stage, at `/play/<stage id>`.
 *
 * The stages are data, not files, so this is a middleware of its own rather than a page module:
 * it answers the stage URLs and lists them for the build.
 */

import type { SiteMiddleware } from "@kuboon/remix-ssg/site";
import { joinBase } from "@kuboon/remix-ssg/site";

import { renderPage, SITE_NAME } from "../layout.tsx";
import { Editor } from "../islands/editor.tsx";
import { Link } from "./link.tsx";
import { STAGES } from "./game/stages/index.ts";

export function stagePages(
  context: { base: string; islandUrls: Record<string, string> },
): SiteMiddleware {
  const { base } = context;
  const pathOf = (id: string) => joinBase(base, `/play/${id}`);
  const editorUrl = context.islandUrls.editor;
  if (editorUrl === undefined) {
    throw new Error('The "editor" island is missing.');
  }

  /** Links to the neighbouring stages and the list. */
  function stageNav(index: number) {
    const previous = STAGES[index - 1];
    const next = STAGES[index + 1];
    return (
      <nav class="stage-nav">
        <span>
          {previous
            ? (
              <Link href={pathOf(previous.id)}>
                ← {index}. {previous.title}
              </Link>
            )
            : null}
        </span>
        <Link href={base === "" ? "/" : base}>ステージ一覧</Link>
        <span>
          {next
            ? <Link href={pathOf(next.id)}>{index + 2}. {next.title} →</Link>
            : null}
        </span>
      </nav>
    );
  }

  return {
    basePath: joinBase(base, "/play"),

    async fetch(request: Request): Promise<Response> {
      const pathname = decodeURIComponent(new URL(request.url).pathname);
      const index = STAGES.findIndex((s) => pathOf(s.id) === pathname);
      const stage = STAGES[index];
      if (stage === undefined) {
        return new Response("Not Found", {
          status: 404,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
      const body = await renderPage({
        title: `${stage.title} — ${SITE_NAME}`,
        description: stage.description,
        base,
        islandUrls: { editor: editorUrl },
        children: (
          <>
            {stageNav(index)}
            <Editor base={base} stageId={stage.id} />
            {stageNav(index)}
          </>
        ),
      });
      return new Response(body, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },

    *paths(): Iterable<string> {
      for (const stage of STAGES) yield pathOf(stage.id);
    },

    reload(): Promise<void> {
      return Promise.resolve();
    },
  };
}
