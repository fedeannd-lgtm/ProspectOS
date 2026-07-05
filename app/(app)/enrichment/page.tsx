export const dynamic = "force-dynamic"

import { getCampaigns } from "./actions"
import { getProviderStatus } from "../settings/provider-status"
import { EnrichmentClient } from "./enrichment-client"

export default async function EnrichmentPage() {
  const [campaigns, providerStatus] = await Promise.all([getCampaigns(), getProviderStatus()])
  return <EnrichmentClient campaigns={campaigns} providerStatus={providerStatus} />
}
