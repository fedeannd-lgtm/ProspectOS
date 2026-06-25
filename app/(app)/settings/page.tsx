import { getRepConfigs, getSavedUrls } from "./actions"
import { SettingsClient } from "./settings-client"

export default async function SettingsPage() {
  const [configs, savedUrls] = await Promise.all([getRepConfigs(), getSavedUrls()])
  return <SettingsClient configs={configs} savedUrls={savedUrls} />
}
