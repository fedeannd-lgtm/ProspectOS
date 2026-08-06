export const dynamic = "force-dynamic"

import { getRepConfigs, getSavedUrls, getProviderUsage, getCampaignIndustries } from "./actions"
import { getProviderStatus } from "./provider-status"
import { SettingsClient } from "./settings-client"
import { getInboxConfig } from "../inbox/actions"

export default async function SettingsPage() {
  const [configs, savedUrls, providerStatus, providerUsage, inboxConfig, campaignIndustries] = await Promise.all([
    getRepConfigs(),
    getSavedUrls(),
    getProviderStatus(),
    getProviderUsage(),
    getInboxConfig(),
    getCampaignIndustries(),
  ])
  return <SettingsClient configs={configs} savedUrls={savedUrls} providerStatus={providerStatus} providerUsage={providerUsage} inboxConfig={inboxConfig} campaignIndustries={campaignIndustries} />
}
