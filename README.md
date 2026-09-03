# remix3-ssg-gh-pages

A [Remix v3](https://remix.run) static-site starter built on
[`@kuboon/remix-ssg`](https://jsr.io/@kuboon/remix-ssg) and deployed to GitHub
Pages with per-PR previews.

The site is content and one `router.ts` that wires three directories into a
handler. `deno serve router.ts` is the dev server; the build crawls the same
handler straight from JSR, so there is no build script in this repository.
Islands are code-split out of one graph, so a module two of them share is
emitted once — and the home page shows what that buys.

The site lives in [`pages/`](./pages) — see [`pages/README.md`](./pages/README.md)
for how it works and how to develop it.

```sh
cd pages
deno task dev     # local dev server
deno task build   # generate the static site into pages/dist
```

## Using this as a template

This repository is a GitHub template. The demo content in it exists to show the
framework working, not because your site needs it — **delete it in a new
repository**:

| Delete | What it is |
| --- | --- |
| `pages/pages/showcase.tsx` | The `@remix-run/ui` component showcase page |
| `pages/islands/showcase/` | Its 18 demo islands and their shared helpers |
| the `UI showcase` link in `pages/layout.tsx` | The nav entry pointing at it |
| the `@remix-run/ui/*` subpath entries in `pages/deno.json` | Only the showcase imports those components |
| `pages/pages/blog/*.md`, `pages/pages/about.tsx` | Placeholder content |

`pages/pages/index.tsx` and `pages/islands/{counter,total,store}` are the
two-islands-one-store demo. Delete those too once you have read the home page;
the point they make is in this README's opening paragraph.

What you keep is `pages/router.ts`, `pages/layout.tsx`, `pages/transforms/`,
`pages/lib/`, `pages/static/`, and the workflows.

After deleting, `deno task check && deno task build` should still pass — if it
does not, something you kept was linking to something you removed, which is the
build telling you the same thing it tells you about any dead link.

## Deployment

`.github/workflows/pages.yml` calls the reusable
`kuboon/workflows/.github/workflows/github-page-with-preview.yaml` workflow. It
builds `main` at the Pages root and each pull request under a preview sub-path,
deploys both to GitHub Pages, and comments the preview URL on the PR. The build
runs via [`mise`](https://mise.jdx.dev) (`mise.toml`), which installs Deno and
runs `deno task build` with the correct `BASE_URL`.

To enable it: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
