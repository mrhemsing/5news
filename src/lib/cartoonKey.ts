// Shared normalization for cartoon cache keys.
// IMPORTANT: This must stay in sync anywhere we read/write cartoon_cache.headline.

export function cleanForCartoon(title: unknown): string {
  return String(title ?? '')
    .replace(/\s*\([^)]*\)\s*/g, ' ') // remove parenthetical
    .replace(/\s*-\s*.*$/, '') // remove " - Source" suffix
    .replace(/["']/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
