import { revalidateTag, updateTag } from "next/cache";

/**
 * Cache-tag invalidation helpers for Next 16.
 *
 * Next 16 split the old single-argument `revalidateTag(tag)` into:
 *  - `updateTag(tag)`           — expire now; the *current* Server Action's
 *                                 response already sees fresh data
 *                                 (read-your-own-writes). Server Actions only.
 *  - `revalidateTag(tag, 'max')` — mark stale; the next request regenerates
 *                                 (stale-while-revalidate). Works anywhere,
 *                                 including route handlers.
 *
 * The codebase previously cast `revalidateTag` to its old one-argument shape in
 * six places; these helpers replace that cast with the intended semantics.
 */

/** From a Server Action after a write: the caller's next render sees the new data. */
export function updateTags(...tags: string[]): void {
  for (const tag of tags) updateTag(tag);
}

/** From a route handler (or anywhere outside a Server Action): schedule regeneration. */
export function revalidateTags(...tags: string[]): void {
  for (const tag of tags) revalidateTag(tag, "max");
}
