export const dynamic = "force-dynamic"

import { getRepConfigs, getSavedUrls, getProviderUsage } from "./actions"
import { getProviderStatus } from "./provider-status"
import { SettingsClient } from "./settings-client"

export default async function SettingsPage() {
  const [configs, savedUrls, providerStatus, providerUsage] = await Promise.all([
    getRepConfigs(),
    getSavedUrls(),
    getProviderStatus(),
    getProviderUsage(),
  ])
  return <SettingsClient configs={configs} savedUrls={savedUrls} providerStatus={providerStatus} providerUsage={providerUsage} />
}
