import { canonicalLinkedInUrl } from "./linkedin"

const DATAGMA_API_KEY = process.env.DATAGMA_API_KEY

async function datagmaRequest(params: Record<string, string>): Promise<string | null> {
  const url = new URL("https://gateway.datagma.net/api/ingress/v2/find")
  url.searchParams.set("token", DATAGMA_API_KEY!)
  url.searchParams.set("data", "EMAIL_FINDER_DATAGMA")
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString())
  if (!res.ok) return null
  const data = await res.json()
  return data?.email ?? null
}

export async function findEmailDatagma(
  firstName: string,
  lastName: string,
  companyDomain: string,
  linkedinUrl: string
): Promise<string | null> {
  if (!DATAGMA_API_KEY) return null
  try {
    // 1. LinkedIn URL (most reliable) — Datagma resolves both canonical and encoded Sales Nav URLs
    const canonical = canonicalLinkedInUrl(linkedinUrl)
    const linkedinForDatagma = canonical || (linkedinUrl?.includes("linkedin.com") ? linkedinUrl : null)
    if (linkedinForDatagma) {
      const email = await datagmaRequest({ uid: linkedinForDatagma })
      if (email) return email
    }

    if (!companyDomain) return null

    // 2. Full first name (e.g. "Maria Constanza Dristas")
    const email2 = await datagmaRequest({ fullName: `${firstName} ${lastName}`.trim(), companyDomain })
    if (email2) return email2

    // 3. Last word of first name — handles compound names like "Maria Constanza" → "Constanza"
    // People with compound first names often use the last part professionally
    const parts = firstName.trim().split(/\s+/)
    if (parts.length > 1) {
      const usualName = parts[parts.length - 1]
      const email3 = await datagmaRequest({ fullName: `${usualName} ${lastName}`.trim(), companyDomain })
      if (email3) return email3
    }

    return null
  } catch {
    return null
  }
}
