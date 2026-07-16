import { getTemplates, getCampaignsForDistribution } from "./actions"
import { DistributionClient } from "./distribution-client"

export default async function DistributionPage() {
  const [templates, campaigns] = await Promise.all([
    getTemplates(),
    getCampaignsForDistribution(),
  ])

  return <DistributionClient templates={templates} campaigns={campaigns} />
}
