import { getCampaigns, getIcpStats } from "./actions"
import { DashboardClient } from "./dashboard-client"

export default async function DashboardPage() {
  const [campaigns, icpStats] = await Promise.all([getCampaigns(), getIcpStats()])
  return <DashboardClient initialCampaigns={campaigns} icpStats={icpStats} />
}
