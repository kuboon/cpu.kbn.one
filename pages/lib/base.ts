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
