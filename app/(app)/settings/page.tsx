import { getRepConfigs, getSavedUrls } from "./actions"
import { getProviderStatus } from "./provider-status"
import { SettingsClient } from "./settings-client"

export default async function SettingsPage() {
  const [configs, savedUrls, providerStatus] = await Promise.all([
    getRepConfigs(),
    getSavedUrls(),
    getProviderStatus(),
  ])
  return <SettingsClient configs={configs} savedUrls={savedUrls} providerStatus={providerStatus} />
}
