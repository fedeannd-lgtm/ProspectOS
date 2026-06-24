// Sales Navigator scrapes return encoded profile URLs like /in/ACwAABBgOrYB8-gg...
// Email finders only understand canonical slugs like /in/firstname-lastname-123/
// Return the URL only if it looks canonical, undefined otherwise.
export function canonicalLinkedInUrl(url: string): string | undefined {
  if (!url) return undefined
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/)
  if (!match) return undefined
  const slug = match[1]
  // Canonical slugs are lowercase with hyphens and optional trailing digits.
  // Encoded IDs start with uppercase letters (Base64-like: ACwAAB..., ACoAAA...)
  if (/^[A-Z]/.test(slug) || slug.length > 40) return undefined
  return url
}
