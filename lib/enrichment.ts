import { findEmailApollo } from "./apollo"
import { findEmailFindymail } from "./findymail"
import { findEmailProspeo } from "./prospeo"
import { findEmailHunter } from "./hunter"
import { validateEmail, isUsable, type ZBStatus } from "./zerobounce"

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

const PROVIDERS: Array<{
  name: string
  find: (p: ProspectInput) => Promise<string | null>
}> = [
  {
    name: "apollo",
    find: (p) => findEmailApollo(p.first_name, p.last_name, p.company_name, p.linkedin_url),
  },
  {
    name: "findymail",
    find: (p) => findEmailFindymail(p.first_name, p.last_name, p.company_domain ?? "", p.linkedin_url),
  },
  {
    name: "prospeo",
    find: (p) => findEmailProspeo(p.first_name, p.last_name, p.company_name, p.linkedin_url),
  },
  {
    name: "hunter",
    find: (p) => findEmailHunter(p.first_name, p.last_name, p.company_domain ?? ""),
  },
]

export async function enrichProspect(prospect: ProspectInput): Promise<EnrichmentResult> {
  for (const provider of PROVIDERS) {
    const email = await provider.find(prospect)
    if (!email) continue

    const { status, subStatus } = await validateEmail(email)

    if (isUsable(status)) {
      return { email, provider: provider.name, zbStatus: status, zbSubStatus: subStatus, enriched: true }
    }

    // Email found but invalid — keep trying other providers
  }

  return { email: null, provider: null, zbStatus: null, zbSubStatus: null, enriched: false }
}
