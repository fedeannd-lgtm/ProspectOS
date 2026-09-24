export const dynamic = "force-dynamic"

import { getSavedUrls, getProviderUsage, getCampaignIndustries, getClientCompanies, getTenantApiKeys, getTenantReps, getIcpRules, getOsScoreRules } from "./actions"
import { getProviderStatus } from "./provider-status"
import { SettingsClient } from "./settings-client"
import { getInboxConfig } from "../inbox/actions"

export default async function SettingsPage() {
  const [savedUrls, providerStatus, providerUsage, inboxConfig, campaignIndustries, clientCompanies, tenantApiKeys, tenantReps, icpRules, osScoreRules, osScore2Rules] = await Promise.all([
    getSavedUrls(),
    getProviderStatus(),
    getProviderUsage(),
    getInboxConfig(),
    getCampaignIndustries(),
    getClientCompanies(),
    getTenantApiKeys(),
    getTenantReps(),
    getIcpRules(),
    getOsScoreRules(1),
    getOsScoreRules(2),
  ])
  return (
    <SettingsClient
      savedUrls={savedUrls}
      providerStatus={providerStatus}
      providerUsage={providerUsage}
      inboxConfig={inboxConfig}
      campaignIndustries={campaignIndustries}
      clientCompanies={clientCompanies}
      tenantApiKeys={tenantApiKeys}
      tenantReps={tenantReps}
      icpRules={icpRules}
      osScoreRules={osScoreRules}
      osScore2Rules={osScore2Rules}
    />
  )
}
