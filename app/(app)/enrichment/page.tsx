export const dynamic = "force-dynamic"

import { getCampaigns } from "./actions"
import { getProviderStatus } from "../settings/provider-status"
import { getOsScoreRules } from "../settings/actions"
import { EnrichmentClient } from "./enrichment-client"

export default async function EnrichmentPage() {
  const [campaigns, providerStatus, osScore2Rules] = await Promise.all([getCampaigns(), getProviderStatus(), getOsScoreRules(2)])
  const osScore2Segments = osScore2Rules.map((r) => r.segment)
  return <EnrichmentClient campaigns={campaigns} providerStatus={providerStatus} osScore2Segments={osScore2Segments} />
}
