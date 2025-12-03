/**
 * Generate a URL-friendly slug from a title
 * @param {string} title - The title to slugify
 * @returns {string} - A URL-friendly slug with a random suffix
 */
export function generateSlug(title) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')         // Replace spaces with hyphens
    .replace(/-+/g, '-')          // Replace multiple hyphens with single
    .replace(/^-|-$/g, '')        // Remove leading/trailing hyphens
    .trim();

  // Add a random suffix for uniqueness
  const suffix = Math.random().toString(36).substring(2, 6);
  return base ? `${base}-${suffix}` : suffix;
}

/**
 * Ensure a slug is unique by checking against existing slugs
 * @param {string} baseSlug - The base slug to make unique
 * @param {function} existsCheck - Function that returns true if slug exists
 * @returns {string} - A unique slug
 */
export function ensureUniqueSlug(baseSlug, existsCheck) {
  let slug = baseSlug;
  let counter = 1;

  while (existsCheck(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
