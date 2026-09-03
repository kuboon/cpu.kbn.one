# pages

A static-site starter built with [Remix v3](https://remix.run) — `remix/ui` for
rendering — and [`@kuboon/remix-ssg`](https://jsr.io/@kuboon/remix-ssg) for
everything around it. The output is plain HTML that deploys to GitHub Pages:
zero client-side JavaScript by default, with opt-in interactivity through
hydrated islands.

## How it works

`router.ts` composes three directories into one handler:

|            |                                           |
| ---------- | ----------------------------------------- |
| `islands/` | compiled as a single code-split bundle    |
| `pages/`   | served through this site's own transforms |
| `static/`  | served verbatim                           |

`deno serve router.ts` runs that handler as the dev server. The build drives the
very same object with `fetch()`, writes each response to disk, and follows the
links it finds — so what you see locally is what gets generated, and moving to a
live server would be a change of deploy target rather than of code.

There is no build script in this repository. `deno task build` runs the
generator straight from JSR.

## Requirements

[Deno](https://deno.com) 2.x.

## Commands

```sh
deno task dev     # local dev server at http://localhost:8000
deno task build   # generate the static site into dist/
deno task check   # type-check, lint, and format-check
```

Neither task passes `-A` or `--unstable-bundle`. `deno.json` carries a
permission set for each (`-P=dev`, `-P=build`) and the `"unstable": ["bundle"]`
the bundler needs — which is also why `deno task build` names `-c deno.json`: a
remote main module reads a project's config only when it is told to.

## Project layout

```
pages/
  deno.json          # tasks, imports, permission sets, compiler + JSX options
  deno.lock          # pinned dependency versions (committed)
  router.ts          # the wiring — three directories into one handler
  layout.tsx         # the HTML document shell
  transforms/
    markdown.tsx     # .md  → an article page
    page.tsx         # .tsx → a page module
  lib/
    base.ts          # the deploy prefix, computed once
    articles.ts      # front-matter for the blog
    markdown.ts      # Markdown → a Remix UI tree (@kuboon/md)
    link.tsx         # internal <Link> (full-document navigation)
  pages/
    index.tsx        # home — places both islands
    about.tsx
    blog/
      index.tsx      # lists the articles beside it
      *.md           # the articles
  islands/
    counter.tsx      # a hydrated island, and its own browser entrypoint
    total.tsx        # a second island/entrypoint, sharing state with it
    store.ts         # the module both islands import — the shared singleton
  static/            # files served under /static/* (favicon, CSS, images…)
```

## The UI showcase (delete me)

`pages/showcase.tsx` and `islands/showcase/` are a port of
[remix3-ui-showcase](https://github.com/kuboon/remix3-ui-showcase): every
first-party `@remix-run/ui` component and the animation primitives, each an
island whose parameters you can change live. It is here to demonstrate the
framework, and the root README lists it first among the things to delete in a
repository made from this template.

It is also the largest thing the island pipeline is asked to do here — 18
entrypoints compiled as one graph, sharing `@remix-run/ui` and the demo chrome
through code-split chunks rather than 18 copies.

Helpers the demos share live in `islands/showcase/_lib/`. The leading underscore
matters: it is how the island scanner is told a `.tsx` file under `islands/` is
a helper rather than an entrypoint.

## Adding a page

Drop a file in `pages/` and link to it.

- A `.md` file becomes an article at its path, rendered by
  `transforms/markdown.tsx`.
- A `.tsx` file exports a component (and optionally `title`, `description`, and
  the `islands` it places), rendered by `transforms/page.tsx`.

The crawl starts at `entryPoints` in `router.ts` and follows links, so **what is
reachable is what gets generated**. A page nothing links to belongs in
`entryPoints`, or it is not part of the site.

That is also why `pages/blog/index.tsx` reads the `.md` files beside it: listing
them is what makes them reachable.

## Markdown content

Each article is a `.md` file under `pages/blog/` with `title`, `date`, and
`summary` front-matter:

```markdown
---
title: Hello, remix-ssg
date: "2026-07-21"
summary: How this site is rendered to static HTML at build time.
---

Body starts here…
```

`transforms/markdown.tsx` turns it into a page: front-matter via
`@std/front-matter`, the body via [`@kuboon/md`](https://jsr.io/@kuboon/md) —
GitHub-flavored, sanitized, with heading anchors and Shiki-highlighted code. The
generator never sees Markdown; that transform and its dependencies are this
site's, which is what keeps them out of the generator.

## Interactive islands (client components)

Most of the site is static HTML. When you need interactivity, use an **island**:
a component that is server-rendered like everything else, then hydrated in the
browser. See `islands/counter.tsx`.

To add one:

1. Write it in `islands/` with `island('name', 'Export', …)` from
   `@kuboon/remix-ssg/client`, where the name is the file's path under
   `islands/` without the extension. Call `handle.update()` after changing
   state.
2. Import it into a `.tsx` page and place it.
3. Name it in that page's `islands` export, so the shell loads its chunk.

A page that names no island ships no `<script>` at all — the article pages have
none.

### How the client code is compiled

Every island is a browser entrypoint, and all of them go into a _single_
`Deno.bundle({ codeSplitting: true })` call. A module more than one of them
imports comes out **once**, in a chunk they share:

```
islands/counter.js ─┬─→ chunk-…   the Remix UI runtime, the ssg client runtime, store.ts
islands/total.js  ──┘
```

The home page demonstrates why that matters. `counter.tsx` and `total.tsx` are
separate entrypoints that never reference each other; both import
`islands/store.ts`, and the running total tracks the buttons only because that
store was emitted once. Compile the entries independently — one bundler call
each — and each gets a private copy, so the total would sit at zero.

There is no client runtime entrypoint to declare: the runtime rides in the chunk
the islands share and starts itself. An island's id is a logical name
(`island:counter#Counter`) rather than a URL, because that expression is
evaluated in the browser too, where predicting the bundler's output naming —
which shifts with the set of entrypoints — would be guesswork. The shell embeds
the name→chunk map the bundler produced and the runtime resolves against it.

Internal links use the `<Link>` component (`lib/link.tsx`), which marks them for
full-document navigation so pages with an active client runtime still navigate
like a normal static site.

## Base paths and GitHub Pages

A GitHub Pages _project_ site is served under a sub-path
(`https://<user>.github.io/<repo>/`), and per-PR previews add a further segment.
`lib/base.ts` turns the `BASE_URL` the deploy workflow sets into that prefix;
the shell, the pages and the router all read it from there, and the build strips
it back off when writing so the output always lands at `dist/`'s root.

Locally `BASE_URL` is unset and the site is served from `/`. To preview a
sub-path deployment:

```sh
BASE_URL=http://localhost:8000/remix3-ssg-gh-pages deno task dev
```

`deno serve` prints the root URL, but with `BASE_URL` set the site lives under
the prefix — open <http://localhost:8000/remix3-ssg-gh-pages>.

### Which file answers which URL

GitHub Pages serves `/about` from `about.html`, and 404s `/about/` when only
that file exists. `router.ts` states that rule as `fileServer = githubPages()`,
and the same object does two jobs: the build writes the file that rule would
reach for, and `serveAsHost` makes the dev server resolve requests the way the
deploy will — so a trailing slash that 404s in production 404s locally too.

Deploying somewhere with different rules is a matter of passing a different
behavior.

Deployment is wired up in `.github/workflows/pages.yml` at the repository root.
