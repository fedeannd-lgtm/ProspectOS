import { getCampaigns } from "./actions"
import { DashboardClient } from "./dashboard-client"

export default async function DashboardPage() {
  const campaigns = await getCampaigns()
  return <DashboardClient initialCampaigns={campaigns} />
}
