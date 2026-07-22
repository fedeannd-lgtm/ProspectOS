export const dynamic = "force-dynamic"

import { getRepConfigs, getSavedUrls, getProviderUsage } from "./actions"
import { getProviderStatus } from "./provider-status"
import { SettingsClient } from "./settings-client"
import { getInboxConfig } from "../inbox/actions"

export default async function SettingsPage() {
  const [configs, savedUrls, providerStatus, providerUsage, inboxConfig] = await Promise.all([
    getRepConfigs(),
    getSavedUrls(),
    getProviderStatus(),
    getProviderUsage(),
    getInboxConfig(),
  ])
  return <SettingsClient configs={configs} savedUrls={savedUrls} providerStatus={providerStatus} providerUsage={providerUsage} inboxConfig={inboxConfig} />
}
