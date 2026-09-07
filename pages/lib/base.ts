/**
 * The deploy prefix, computed once.
 *
 * The Pages workflow passes the full public URL in `BASE_URL`; locally it is unset and the site is
 * served from the root. Everything that emits a URL — the shell, the pages, the router — reads it
 * from here.
 *
 * This is server-only now. Islands used to need it too, because a `clientEntry()` id was a URL they
 * built themselves; they name themselves logically instead, so the browser never sees this value.
 */

import { normalizeBase } from "@kuboon/remix-ssg/site";

/** URL path prefix the site is mounted under, without a trailing slash (e.g. `''` or `/repo`). */
export const base: string = normalizeBase(Deno.env.get("BASE_URL"));

/**
 * Scheme and host, for the handful of tags a relative URL is no use to.
 *
 * Open Graph is read by a crawler that never saw the page's address, so `og:image` has to be
 * absolute or it is simply dropped. `base` cannot supply that — it is a path — so the origin is
 * taken from the same `BASE_URL` the workflow already sets, which on a preview build is the
 * preview's own URL under the same host. Locally `BASE_URL` is unset and the live address stands
 * in, so a card assembled during `deno task dev` still points at something that exists.
 *
 * It is the origin alone rather than the whole prefix because the shell is handed its `base` and
 * has no business reading the environment; it joins the two itself.
 *
 * The literal is the second place the domain is written down; the first is the re-register step in
 * `.github/workflows/pages.yml`, which needs it before any of this code runs. Changing the custom
 * domain means changing both.
 */
export const origin: string =
  new URL(Deno.env.get("BASE_URL") ?? "https://cpu.kbn.one/").origin;
