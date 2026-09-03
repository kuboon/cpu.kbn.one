# pages

The site: [Remix v3](https://remix.run) for rendering, [`@kuboon/remix-ssg`](https://jsr.io/@kuboon/remix-ssg) for everything around it. The output is plain HTML that deploys to GitHub Pages, with opt-in interactivity through hydrated islands.

## Commands

```sh
deno task dev     # local dev server at http://localhost:8000
deno task test    # engine tests (lib/game)
deno task check   # type-check, lint, and format-check
deno task build   # generate the static site into dist/
```

## Layout

```
pages/
  deno.json          # tasks, imports, permission sets, compiler + JSX options
  router.ts          # the wiring — three directories into one handler
  layout.tsx         # the HTML document shell
  transforms/
    markdown.tsx     # .md  → a document page
    page.tsx         # .tsx → a page module
  lib/
    base.ts          # the deploy prefix, computed once
    document.ts      # front-matter for Markdown pages
    markdown.ts      # Markdown → a Remix UI tree (@kuboon/md)
    link.tsx         # internal <Link> (full-document navigation)
    game/            # the engine — no DOM, tested with `deno test`
      model.ts       # designs, cells, placements, components
      transform.ts   # where a placed component's pins land
      netlist.ts     # board → flat netlist of relays
      sim.ts         # fixed-point evaluation
      verify.ts      # running a stage's test steps
      stages/        # stage definitions
      reference.ts   # hand-built reference solutions (pars)
      storage.ts     # save data
      builder.ts     # terse design construction for references and tests
  pages/
    index.tsx        # home — the stage list
    plan.md          # the design document
  islands/           # hydrated client components (the editor will live here)
  static/            # files served under /static/*
```

`router.ts` composes those directories into one handler. `deno serve router.ts` runs it as the dev server; the build drives the same object with `fetch()`, writes each response to disk, and follows the links it finds. What is reachable from `entryPoints` is what gets generated.

## Pages

- A `.md` file under `pages/` becomes a document at its path, rendered by `transforms/markdown.tsx` with `title`, `date` and `summary` front-matter.
- A `.tsx` file exports a component (and optionally `title`, `description`, and the `islands` it places), rendered by `transforms/page.tsx`.

## Islands

Write a client component in `islands/` with `island('name', 'Export', …)` from `@kuboon/remix-ssg/client`, import it into a page, and name it in that page's `islands` export. Every island is compiled in one code-split bundle, so modules two islands share are emitted once.

## Base paths

A GitHub Pages project site is served under a sub-path, and per-PR previews add a further segment. `lib/base.ts` turns the `BASE_URL` the deploy workflow sets into that prefix. Locally it is unset and the site is served from `/`.
