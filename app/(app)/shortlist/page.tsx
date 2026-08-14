export const dynamic = "force-dynamic"

import { getShortlistedProspects } from "./actions"
import { ShortlistClient } from "./shortlist-client"

export default async function ShortlistPage() {
  const prospects = await getShortlistedProspects()
  return <ShortlistClient initialProspects={prospects} />
}
