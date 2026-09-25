import { permanentRedirect } from "next/navigation";

/**
 * Legacy /search forwards permanently to the inventory listing, which owns
 * filtering and free-text search. Every query parameter is carried over.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    for (const v of Array.isArray(value) ? value : value ? [value] : []) qs.append(key, v);
  }
  const query = qs.toString();
  permanentRedirect(query ? `/used-cars?${query}` : "/used-cars");
}
