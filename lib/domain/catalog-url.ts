export type CatalogUrlChange = readonly [key: string, value: string | undefined];

/** Build a canonical filter URL while preserving unrelated deep-link parameters. */
export function buildCatalogFilterUrl(pathname: string, currentSearch: string, changes: readonly CatalogUrlChange[]): string {
  const params = new URLSearchParams(currentSearch);
  params.delete("page");
  for (const [key, value] of changes) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function buildCatalogPageUrl(currentSearch: string, page: number): string {
  const params = new URLSearchParams(currentSearch);
  params.set("page", String(page));
  return `?${params.toString()}`;
}
