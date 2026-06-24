import { findEmailApollo } from "./apollo"
import { findEmailFindymail } from "./findymail"
import { findEmailProspeo } from "./prospeo"
import { findEmailHunter } from "./hunter"
import { validateEmail, isUsable, type ZBStatus } from "./zerobounce"
import { canonicalLinkedInUrl } from "./linkedin"

export type EnrichmentResult = {
  email: string | null
  provider: string | null
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
  const { first_name, last_name, company_name, company_domain } = prospect

  // Use canonical URL if already canonical, otherwise empty (Apollo will still match by name+domain)
  const initialUrl = canonicalLinkedInUrl(prospect.linkedin_url) ?? ""

  // 1. Apollo — also returns the canonical LinkedIn URL it has on file
  const apolloResult = await findEmailApollo(first_name, last_name, company_name, initialUrl, company_domain)

  // Best LinkedIn URL we have: prefer what Apollo returned (canonical), then our own if canonical
  const bestLinkedInUrl = apolloResult.canonicalLinkedInUrl ?? initialUrl

  if (apolloResult.email) {
    const { status, subStatus } = await validateEmail(apolloResult.email)
    if (isUsable(status)) {
      return { email: apolloResult.email, provider: "apollo", zbStatus: status, zbSubStatus: subStatus, enriched: true }
    }
  }

  // 2–4. FindyEmail, Prospeo, Hunter — now using canonical URL from Apollo if available
  const REST: Array<{ name: string; find: () => Promise<string | null> }> = [
    { name: "findymail", find: () => findEmailFindymail(first_name, last_name, company_domain ?? "", bestLinkedInUrl) },
    { name: "prospeo",  find: () => findEmailProspeo(first_name, last_name, company_name, bestLinkedInUrl) },
    { name: "hunter",   find: () => findEmailHunter(first_name, last_name, company_domain ?? "") },
  ]

  for (const provider of REST) {
    const email = await provider.find()
    if (!email) continue
    const { status, subStatus } = await validateEmail(email)
    if (isUsable(status)) {
      return { email, provider: provider.name, zbStatus: status, zbSubStatus: subStatus, enriched: true }
    }
  }

  return { email: null, provider: null, zbStatus: null, zbSubStatus: null, enriched: false }
}
