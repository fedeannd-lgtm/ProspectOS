export const dynamic = "force-dynamic"

import { getCampaigns, getIcpStats, getIcpCategoryStats, getCampaignIndustries, getAutoActionMap, getScorecardData } from "./actions"
import { DashboardClient } from "./dashboard-client"

export default async function DashboardPage() {
  const [campaigns, icpStats, icpCategoryStats, campaignIndustries, autoActionMap, scorecardData] = await Promise.all([
    getCampaigns(),
    getIcpStats(),
    getIcpCategoryStats(),
    getCampaignIndustries(),
    getAutoActionMap(),
    getScorecardData(),
  ])
  return <DashboardClient initialCampaigns={campaigns} icpStats={icpStats} icpCategoryStats={icpCategoryStats} campaignIndustries={campaignIndustries} autoActionMap={autoActionMap} scorecardData={scorecardData} />
}
