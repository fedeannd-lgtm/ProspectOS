export const dynamic = "force-dynamic"

import { getTemplates, getCampaignsForDistribution } from "./actions"
import { DistributionClient } from "./distribution-client"
import { getTenantId } from "@/lib/tenant"
import { getTenantConfig } from "@/lib/tenant-config"

export default async function DistributionPage() {
  const tenantId = await getTenantId()
  const [templates, campaigns, tenantCfg] = await Promise.all([
    getTemplates(),
    getCampaignsForDistribution(),
    getTenantConfig(tenantId),
  ])

  const linkedinTool = tenantCfg?.linkedin_tool ?? "HeyReach"

  return <DistributionClient templates={templates} campaigns={campaigns} linkedinTool={linkedinTool} />
}
