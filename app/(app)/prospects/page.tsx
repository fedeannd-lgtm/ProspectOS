import { getAllProspects } from "./actions"
import { ProspectsClient } from "./prospects-client"

export const dynamic = "force-dynamic"

export default async function ProspectsPage() {
  const prospects = await getAllProspects()
  return <ProspectsClient prospects={prospects} />
}
