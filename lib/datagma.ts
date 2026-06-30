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
  linkedinUrl: string,
  companyName?: string
): Promise<string | null> {
  if (!DATAGMA_API_KEY) return null
  try {
    // 1. LinkedIn URL (most reliable) — normalize to www.linkedin.com before sending
    // Country subdomains like ar.linkedin.com, br.linkedin.com are not recognized by Datagma
    const canonical = canonicalLinkedInUrl(linkedinUrl)
    const rawForDatagma = linkedinUrl?.includes("linkedin.com") ? linkedinUrl : null
    const linkedinForDatagma = (canonical ?? rawForDatagma)
      ?.replace(/https?:\/\/[a-z]{2}\.linkedin\.com/, "https://www.linkedin.com")
    if (linkedinForDatagma) {
      const email = await datagmaRequest({ uid: linkedinForDatagma })
      if (email) return email
    }

    if (!companyDomain) return null

    // 2. Full first name + domain
    const fullName = `${firstName} ${lastName}`.trim()
    const email2 = await datagmaRequest({ fullName, companyDomain })
    if (email2) return email2

    // 3. Full first name + domain + company name
    if (companyName) {
      const email3 = await datagmaRequest({ fullName, companyDomain, companyName })
      if (email3) return email3
    }

    // 4. Last word of first name — handles compound names like "Maria Constanza" → "Constanza"
    const parts = firstName.trim().split(/\s+/)
    if (parts.length > 1) {
      const usualName = parts[parts.length - 1]
      const shortName = `${usualName} ${lastName}`.trim()
      const email4 = await datagmaRequest({ fullName: shortName, companyDomain })
      if (email4) return email4
      if (companyName) {
        const email5 = await datagmaRequest({ fullName: shortName, companyDomain, companyName })
        if (email5) return email5
      }
    }

    return null
  } catch {
    return null
  }
}
