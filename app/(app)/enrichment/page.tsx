import { getCampaigns, getProspectsForEnrichment } from "./actions"
import { EnrichmentClient } from "./enrichment-client"

export default async function EnrichmentPage() {
  const campaigns = await getCampaigns()
  return <EnrichmentClient campaigns={campaigns} />
}
