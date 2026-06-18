import { getRepConfigs } from "./actions"
import { SettingsClient } from "./settings-client"

export default async function SettingsPage() {
  const configs = await getRepConfigs()
  return <SettingsClient configs={configs} />
}
