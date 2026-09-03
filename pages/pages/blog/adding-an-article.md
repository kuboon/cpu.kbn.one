---
title: Adding an article
date: "2026-07-20"
summary: Drop a Markdown file next to this one — the crawl does the rest.
---

Articles are Markdown files in `pages/blog/`. To add one, create a new `.md`
file there with `title`, `date`, and `summary` frontmatter, then write the body.

## How it shows up

`pages/blog/index.tsx` reads every `.md` file beside it, sorts them by date, and
links to each one at `/blog/<filename>`. That listing is not a formality: the
static build discovers pages by following links, so being listed is what makes
an article part of the site. A file nothing links to is served by the dev server
and never written to `dist/`.

## Why the generator never sees Markdown

`transforms/markdown.tsx` claims every `.md` file under `pages/` and says where
it is served. It belongs to this site, not to `@kuboon/remix-ssg` — which is
what keeps `@kuboon/md` and the frontmatter parser out of the generator, and
what lets this site swap either without asking anyone.

A `.tsx` file in `pages/` goes through a second transform instead, and that one
can place islands. Markdown pages ship no JavaScript at all.

## Authoring tips

- The frontmatter `title` is used for the page `<title>` and the index list.
- Start the body at `##`; the layout renders the `title` as the page heading.
- Any raw HTML in the Markdown is stripped during sanitization.
