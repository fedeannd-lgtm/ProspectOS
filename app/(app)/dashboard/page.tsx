import { getCampaigns, getIcpStats, getIcpCategoryStats } from "./actions"
import { DashboardClient } from "./dashboard-client"

export default async function DashboardPage() {
  const [campaigns, icpStats, icpCategoryStats] = await Promise.all([
    getCampaigns(),
    getIcpStats(),
    getIcpCategoryStats(),
  ])
  return <DashboardClient initialCampaigns={campaigns} icpStats={icpStats} icpCategoryStats={icpCategoryStats} />
}
