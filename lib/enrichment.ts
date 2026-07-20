import { findEmailApollo } from "./apollo"
import { findEmailFindymail } from "./findymail"
import { findEmailProspeo } from "./prospeo"
import { findEmailHunter } from "./hunter"
import { findEmailDatagma } from "./datagma"
import { validateEmail, isUsable, type ZBStatus } from "./zerobounce"
import { canonicalLinkedInUrl } from "./linkedin"

export type EnrichmentResult = {
  email: string | null
  provider: string | null
  zbStatus: ZBStatus | null
  zbSubStatus: string | null
  enriched: boolean
  apolloId: string | null
  apolloLinkedInUrl: string | null
}

type ProspectInput = {
  first_name: string
  last_name: string
  full_name?: string | null
  company_name: string
  company_domain: string | null
  linkedin_url: string
  company_linkedin_url?: string | null
}

export async function enrichProspect(prospect: ProspectInput): Promise<EnrichmentResult> {
  const { first_name, last_name, full_name, company_name, company_domain, company_linkedin_url } = prospect

  const rawUrl = prospect.linkedin_url ?? ""
  const canonicalUrl = canonicalLinkedInUrl(rawUrl) ?? ""

  // Apollo works best with just the first word of first_name (e.g. "Cesar", not "Cesar Leopoldo")
  const apolloFirstName = first_name.split(" ")[0]
  const apolloFullName = full_name || `${first_name} ${last_name}`.trim()

  // 1. Apollo — replicate Clay's setup: first_name + last_name + full_name + domain
  const apolloResult = await findEmailApollo(apolloFirstName, last_name, apolloFullName, company_name, rawUrl, company_domain)

  // Best LinkedIn URL we have: prefer what Apollo returned (canonical), then our own canonical
  const bestLinkedInUrl = apolloResult.canonicalLinkedInUrl ?? canonicalUrl

  if (apolloResult.email) {
    const { status, subStatus } = await validateEmail(apolloResult.email)
    // If ZeroBounce fails (unknown = key missing/no credits/network error),
    // fall back to Apollo's own email_status. Apollo marks emails as "verified"
    // after their own validation pipeline.
    const effectiveStatus: ZBStatus =
      status !== "unknown"
        ? status
        : apolloResult.apolloEmailStatus === "verified"
          ? "valid"
          : "unknown"
    if (isUsable(effectiveStatus)) {
      return { email: apolloResult.email, provider: "apollo", zbStatus: effectiveStatus, zbSubStatus: subStatus, enriched: true, apolloId: apolloResult.apolloId, apolloLinkedInUrl: apolloResult.canonicalLinkedInUrl ?? null }
    }
  }

  // 2–5. FindyEmail, Prospeo, Hunter, Datagma
  // bestLinkedInUrl = canonical URL from Apollo (if found) or our own canonical URL
  // For Datagma we also pass rawUrl as fallback — Datagma resolves encoded Sales Nav URLs
  const datagmaLinkedIn = bestLinkedInUrl || rawUrl
  const REST: Array<{ name: string; selfVerified?: boolean; find: () => Promise<string | null> }> = [
    { name: "findymail", find: () => findEmailFindymail(first_name, last_name, company_domain ?? "", bestLinkedInUrl) },
    { name: "prospeo",   find: () => findEmailProspeo(first_name, last_name, company_name, bestLinkedInUrl) },
    { name: "hunter",    find: () => findEmailHunter(first_name, last_name, company_domain ?? "") },
    // Datagma verifies all emails internally — skip ZeroBounce to avoid wasting credits
    { name: "datagma", selfVerified: true, find: () => findEmailDatagma(first_name, last_name, company_domain ?? "", datagmaLinkedIn, company_name, company_linkedin_url ?? undefined) },
  ]

  for (const provider of REST) {
    const email = await provider.find()
    if (!email) continue

    if (provider.selfVerified) {
      return { email, provider: provider.name, zbStatus: "valid", zbSubStatus: "", enriched: true, apolloId: apolloResult.apolloId, apolloLinkedInUrl: apolloResult.canonicalLinkedInUrl ?? null }
    }

    const { status, subStatus } = await validateEmail(email)
    // Accept if ZeroBounce confirms valid/catch-all, OR if ZB returned "unknown" (no credits/key error).
    // "unknown" means ZeroBounce couldn't verify — not that the email is invalid.
    if (isUsable(status) || status === "unknown") {
      return { email, provider: provider.name, zbStatus: status, zbSubStatus: subStatus, enriched: true, apolloId: apolloResult.apolloId, apolloLinkedInUrl: apolloResult.canonicalLinkedInUrl ?? null }
    }
  }

  return { email: null, provider: null, zbStatus: null, zbSubStatus: null, enriched: false, apolloId: apolloResult.apolloId, apolloLinkedInUrl: apolloResult.canonicalLinkedInUrl ?? null }
}
