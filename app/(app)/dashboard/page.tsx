export const dynamic = "force-dynamic"

import { getCampaigns, getIcpStats, getIcpCategoryStats, getCampaignIndustries } from "./actions"
import { DashboardClient } from "./dashboard-client"

export default async function DashboardPage() {
  const [campaigns, icpStats, icpCategoryStats, campaignIndustries] = await Promise.all([
    getCampaigns(),
    getIcpStats(),
    getIcpCategoryStats(),
    getCampaignIndustries(),
  ])
  return <DashboardClient initialCampaigns={campaigns} icpStats={icpStats} icpCategoryStats={icpCategoryStats} campaignIndustries={campaignIndustries} />
}
