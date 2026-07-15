/** Simple ASCII slugify — lowercase, non-alphanumeric runs collapsed to a single hyphen. */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

/** Slugify then disambiguate against a checker function until unique. */
export async function uniqueSlug(base, exists) {
  const root = slugify(base);
  let candidate = root;
  let n = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${n++}`;
  }
  return candidate;
}
