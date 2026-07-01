const DATAGMA_API_KEY = process.env.DATAGMA_API_KEY

export async function findPhoneDatagma(params: {
  linkedinUrl?: string | null
  email?: string | null
  firstName: string
  lastName: string
  companyName?: string | null
}): Promise<string | null> {
  if (!DATAGMA_API_KEY) return null
  try {
    const { linkedinUrl, email, firstName, lastName, companyName } = params

    // 1. Search by LinkedIn URL and/or email (preferred — more accurate)
    if (linkedinUrl || email) {
      const url = new URL("https://gateway.datagma.net/api/ingress/v1/search")
      url.searchParams.set("apiId", DATAGMA_API_KEY)
      url.searchParams.set("minimumMatch", "1")
      if (linkedinUrl) url.searchParams.set("username", linkedinUrl)
      if (email) url.searchParams.set("email", email)

      const res = await fetch(url.toString())
      if (res.ok) {
        const data = await res.json()
        const phone = extractPhoneFromDatagma(data)
        if (phone) return phone
      }
    }

    // 2. Fallback: full name + company via /v2/full with phoneFull=true
    if (firstName && lastName) {
      const fullName = `${firstName} ${lastName}`.trim()
      const url = new URL("https://gateway.datagma.net/api/ingress/v2/full")
      url.searchParams.set("apiId", DATAGMA_API_KEY)
      url.searchParams.set("data", "MAYD")
      url.searchParams.set("phoneFull", "true")
      url.searchParams.set("fullName", fullName)
      if (companyName) url.searchParams.set("company", companyName)

      const res = await fetch(url.toString())
      if (res.ok) {
        const data = await res.json()
        const phone = extractPhoneFromDatagma(data)
        if (phone) return phone
      }
    }

    return null
  } catch {
    return null
  }
}

function looksLikePhone(s: string | null | undefined): s is string {
  if (!s || typeof s !== "string") return false
  return (s.replace(/\D/g, "").length >= 6)
}

function extractPhoneFromDatagma(data: Record<string, unknown>): string | null {
  // /v1/search response: { data: [{ phones: [...] }] } or { phones: [...] }
  // /v2/full response:   { phones: [...] } or { phone: "..." }
  if (looksLikePhone(data?.phone as string)) return data.phone as string

  const phones = (data?.phones ?? (Array.isArray(data?.data) ? (data.data as Record<string, unknown>[])[0]?.phones : null)) as unknown
  if (Array.isArray(phones) && phones.length > 0) {
    for (const first of phones) {
      if (looksLikePhone(first as string)) return first as string
      if (typeof first === "object" && first !== null) {
        const candidate =
          (first as Record<string, unknown>).phoneNumber as string
          ?? (first as Record<string, unknown>).number as string
          ?? (first as Record<string, unknown>).phone as string
        if (looksLikePhone(candidate)) return candidate
      }
    }
  }

  // Nested: data[0].phones
  if (Array.isArray(data?.data)) {
    for (const item of data.data as Record<string, unknown>[]) {
      const p = extractPhoneFromDatagma(item)
      if (p) return p
    }
  }

  return null
}

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
  if (data?.email && typeof data.email === "string" && data.email.includes("@")) return data.email

  // Most probable email (catchall, not billed) — treat as valid too
  if (data?.mostProbableEmail && typeof data.mostProbableEmail === "string" && data.mostProbableEmail.includes("@")) return data.mostProbableEmail

  return null
}
