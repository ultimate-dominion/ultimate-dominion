// Dev tools previously used @latticexyz/dev-tools which depends on RECS.
// With the custom indexer + Zustand store, RECS is no longer available.
// This is a no-op stub to preserve the import site.
export function DevTools(): null {
  return null;
}
