export const dynamic = "force-dynamic"

import { getCampaigns, getIcpStats, getIcpCategoryStats, getAutoActionMap, getScorecardData, getMeetingProspects } from "./actions"
import { DashboardClient } from "./dashboard-client"
import { getTenantReps, getTenantNiches } from "@/lib/reps-server"

export default async function DashboardPage() {
  const [campaigns, icpStats, icpCategoryStats, autoActionMap, scorecardData, meetingProspects, tenantReps, tenantNiches] = await Promise.all([
    getCampaigns(),
    getIcpStats(),
    getIcpCategoryStats(),
    getAutoActionMap(),
    getScorecardData(),
    getMeetingProspects(),
    getTenantReps(),
    getTenantNiches(),
  ])
  return <DashboardClient initialCampaigns={campaigns} icpStats={icpStats} icpCategoryStats={icpCategoryStats} niches={tenantNiches} autoActionMap={autoActionMap} scorecardData={scorecardData} meetingProspects={meetingProspects} reps={tenantReps} />
}
