export const dynamic = "force-dynamic"

import { getCampaigns, getIcpStats, getIcpCategoryStats, getCampaignIndustries, getAutoActionMap, getScorecardData, getMeetingProspects } from "./actions"
import { DashboardClient } from "./dashboard-client"
import { getTenantReps } from "@/lib/reps-server"

export default async function DashboardPage() {
  const [campaigns, icpStats, icpCategoryStats, campaignIndustries, autoActionMap, scorecardData, meetingProspects, tenantReps] = await Promise.all([
    getCampaigns(),
    getIcpStats(),
    getIcpCategoryStats(),
    getCampaignIndustries(),
    getAutoActionMap(),
    getScorecardData(),
    getMeetingProspects(),
    getTenantReps(),
  ])
  return <DashboardClient initialCampaigns={campaigns} icpStats={icpStats} icpCategoryStats={icpCategoryStats} campaignIndustries={campaignIndustries} autoActionMap={autoActionMap} scorecardData={scorecardData} meetingProspects={meetingProspects} reps={tenantReps} />
}
