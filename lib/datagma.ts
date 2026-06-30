const DATAGMA_API_KEY = process.env.DATAGMA_API_KEY

export async function findEmailDatagma(
  firstName: string,
  lastName: string,
  companyDomain: string,
  linkedinUrl: string,
  companyName?: string,
  companyLinkedInUrl?: string
): Promise<string | null> {
  if (!DATAGMA_API_KEY) return null
  try {
    const names = buildNameVariants(firstName, lastName)

    for (const fullName of names) {
      const email = await datagmaFindEmail({ fullName, companyName, companyLinkedInUrl })
      if (email) return email
    }

    return null
  } catch {
    return null
  }
}

function buildNameVariants(firstName: string, lastName: string): string[] {
  const full = `${firstName} ${lastName}`.trim()
  const parts = firstName.trim().split(/\s+/)
  if (parts.length <= 1) return [full]
  // e.g. "Maria Constanza Dristas" → also try "Constanza Dristas"
  const usualFirst = parts[parts.length - 1]
  const short = `${usualFirst} ${lastName}`.trim()
  return [full, short]
}

async function datagmaFindEmail(params: {
  fullName: string
  companyName?: string
  companyLinkedInUrl?: string
}): Promise<string | null> {
  const { fullName, companyName, companyLinkedInUrl } = params

  const url = new URL("https://gateway.datagma.net/api/ingress/v6/findEmail")
  url.searchParams.set("apiId", DATAGMA_API_KEY!)
  url.searchParams.set("fullName", fullName)
  url.searchParams.set("findEmailV2Step", "3")
  url.searchParams.set("findEmailV2Country", "General")
  if (companyName) url.searchParams.set("company", companyName)
  if (companyLinkedInUrl) url.searchParams.set("linkedInSlug", companyLinkedInUrl)

  const res = await fetch(url.toString())
  if (!res.ok) return null
  const data = await res.json()

  // Verified email (billed) — safe to send
  if (data?.email) return data.email

  // Most probable email (catchall, not billed) — treat as valid too
  if (data?.mostProbableEmail) return data.mostProbableEmail

  return null
}
