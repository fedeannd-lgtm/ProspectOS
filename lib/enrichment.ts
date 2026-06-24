import { findEmailApollo } from "./apollo"
import { findEmailFindymail } from "./findymail"
import { findEmailProspeo } from "./prospeo"
import { findEmailHunter } from "./hunter"
import { validateEmail, isUsable, type ZBStatus } from "./zerobounce"
import { resolveCanonicalLinkedInUrl } from "./linkedin"

export type EnrichmentResult = {
  email: string | null
  provider: string | null   // apollo | findymail | prospeo | hunter
  zbStatus: ZBStatus | null
  zbSubStatus: string | null
  enriched: boolean
}

type ProspectInput = {
  first_name: string
  last_name: string
  company_name: string
  company_domain: string | null
  linkedin_url: string
}

export async function enrichProspect(prospect: ProspectInput): Promise<EnrichmentResult> {
  // Resolve canonical LinkedIn URL once before hitting any provider
  const canonicalUrl = await resolveCanonicalLinkedInUrl(prospect.linkedin_url)
  const p = { ...prospect, linkedin_url: canonicalUrl ?? "" }

  const PROVIDERS: Array<{ name: string; find: () => Promise<string | null> }> = [
    { name: "apollo",    find: () => findEmailApollo(p.first_name, p.last_name, p.company_name, p.linkedin_url, p.company_domain) },
    { name: "findymail", find: () => findEmailFindymail(p.first_name, p.last_name, p.company_domain ?? "", p.linkedin_url) },
    { name: "prospeo",  find: () => findEmailProspeo(p.first_name, p.last_name, p.company_name, p.linkedin_url) },
    { name: "hunter",   find: () => findEmailHunter(p.first_name, p.last_name, p.company_domain ?? "") },
  ]

  for (const provider of PROVIDERS) {
    const email = await provider.find()
    if (!email) continue

    const { status, subStatus } = await validateEmail(email)

    if (isUsable(status)) {
      return { email, provider: provider.name, zbStatus: status, zbSubStatus: subStatus, enriched: true }
    }
    // Email found but invalid — keep trying
  }

  return { email: null, provider: null, zbStatus: null, zbSubStatus: null, enriched: false }
}
