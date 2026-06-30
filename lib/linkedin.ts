// Sales Navigator scrapes return encoded profile URLs like /in/ACwAABBgOrYB8-gg...
// Email finders only understand canonical slugs like /in/firstname-lastname-123/

export function canonicalLinkedInUrl(url: string): string | undefined {
  if (!url) return undefined
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/)
  if (!match) return undefined
  const slug = match[1]
  // Canonical slugs are lowercase with hyphens and optional trailing digits.
  // Encoded IDs start with uppercase letters (Base64-like: ACwAAB..., ACoAAA...)
  if (/^[A-Z]/.test(slug) || slug.length > 40) return undefined
  // Normalize country subdomains (ar.linkedin.com, br.linkedin.com) to www.linkedin.com
  return url.replace(/https?:\/\/[a-z]{2}\.linkedin\.com/, "https://www.linkedin.com")
}

// Attempt to resolve an encoded Sales Nav URL to the canonical LinkedIn profile URL
// by following the HTTP redirect. Returns undefined if blocked or unresolvable.
export async function resolveCanonicalLinkedInUrl(url: string): Promise<string | undefined> {
  // Already canonical — nothing to resolve
  if (canonicalLinkedInUrl(url)) return url
  if (!url) return undefined

  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; bot)",
      },
    })
    const finalUrl = res.url
    if (finalUrl && finalUrl !== url && canonicalLinkedInUrl(finalUrl)) {
      return finalUrl
    }
    return undefined
  } catch {
    return undefined
  }
}
