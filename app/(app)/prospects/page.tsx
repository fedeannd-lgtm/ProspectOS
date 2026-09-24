import { ProspectsClient } from "./prospects-client"
import { getTenantReps } from "@/lib/reps-server"

export const dynamic = "force-dynamic"

export default async function ProspectsPage() {
  const reps = await getTenantReps()
  return <ProspectsClient reps={reps} />
}
