import { ProspectsClient } from "./prospects-client"
import { getTenantReps, getTenantNiches } from "@/lib/reps-server"

export const dynamic = "force-dynamic"

export default async function ProspectsPage() {
  const [reps, niches] = await Promise.all([getTenantReps(), getTenantNiches()])
  return <ProspectsClient reps={reps} niches={niches} />
}
