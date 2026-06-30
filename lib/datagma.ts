import { canonicalLinkedInUrl } from "./linkedin"

const DATAGMA_API_KEY = process.env.DATAGMA_API_KEY

export async function findEmailDatagma(
  firstName: string,
  lastName: string,
  companyDomain: string,
  linkedinUrl: string
): Promise<string | null> {
  if (!DATAGMA_API_KEY) return null
  try {
    const canonical = canonicalLinkedInUrl(linkedinUrl)

    // Prefer LinkedIn URL lookup
    if (canonical) {
      const url = new URL("https://gateway.datagma.net/api/ingress/v2/find")
      url.searchParams.set("token", DATAGMA_API_KEY)
      url.searchParams.set("uid", canonical)
      url.searchParams.set("data", "EMAIL_FINDER_DATAGMA")
      const res = await fetch(url.toString())
      if (res.ok) {
        const data = await res.json()
        if (data?.email) return data.email
      }
    }

    // Fallback: name + domain
    if (!companyDomain) return null
    const url = new URL("https://gateway.datagma.net/api/ingress/v2/find")
    url.searchParams.set("token", DATAGMA_API_KEY)
    url.searchParams.set("fullName", `${firstName} ${lastName}`.trim())
    url.searchParams.set("companyDomain", companyDomain)
    url.searchParams.set("data", "EMAIL_FINDER_DATAGMA")
    const res = await fetch(url.toString())
    if (!res.ok) return null
    const data = await res.json()
    return data?.email ?? null
  } catch {
    return null
  }
}
