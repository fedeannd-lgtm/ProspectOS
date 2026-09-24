import { canonicalLinkedInUrl } from "./linkedin"

export async function findPhoneProspeo(params: {
  linkedinUrl?: string | null
  email?: string | null
  firstName?: string
  lastName?: string
  companyDomain?: string | null
}, apiKey?: string | null): Promise<string | null> {
  const key = apiKey || process.env.PROSPEO_API_KEY || ""
  if (!key) return null
  try {
    const { linkedinUrl, email, firstName, lastName, companyDomain } = params
    const canonical = linkedinUrl ? canonicalLinkedInUrl(linkedinUrl) : null

    const data: Record<string, unknown> = {}
    if (canonical) data.linkedin_url = canonical
    else if (email) data.email = email
    else if (firstName && lastName && companyDomain) {
      data.first_name = firstName
      data.last_name = lastName
      data.company_website = companyDomain
    } else return null

    const res = await fetch("https://api.prospeo.io/enrich-person", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-KEY": key },
      body: JSON.stringify({ enrich_mobile: true, data }),
    })
    if (!res.ok) return null
    const json = await res.json()
    if (json?.error) return null
    const person = json?.person
    const mobileObj = person?.mobile
    if (!mobileObj || mobileObj.revealed === false) return null
    const phone = mobileObj.mobile_international ?? mobileObj.mobile ?? null
    if (!phone || typeof phone !== "string" || phone.replace(/\D/g, "").length < 7) return null
    return phone
  } catch {
    return null
  }
}

export async function findEmailProspeo(
  firstName: string,
  lastName: string,
  company: string,
  linkedinUrl: string,
  apiKey?: string | null
): Promise<string | null> {
  const key = apiKey || process.env.PROSPEO_API_KEY || ""
  try {
    const canonical = canonicalLinkedInUrl(linkedinUrl)
    if (canonical) {
      const res = await fetch("https://api.prospeo.io/linkedin-email-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-KEY": key },
        body: JSON.stringify({ url: canonical }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.response?.email?.value) return data.response.email.value
      }
    }

    if (!firstName || !lastName || !company) return null
    const res = await fetch("https://api.prospeo.io/email-finder", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-KEY": key },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, company }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.response?.email?.value ?? null
  } catch {
    return null
  }
}
