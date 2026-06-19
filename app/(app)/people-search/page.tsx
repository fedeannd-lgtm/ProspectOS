import { getCampaigns, getPeopleSearchJobs } from "./actions"
import { PeopleSearchClient } from "./people-search-client"

export const dynamic = "force-dynamic"

export default async function PeopleSearchPage() {
  const [campaigns, jobs] = await Promise.all([getCampaigns(), getPeopleSearchJobs()])
  return <PeopleSearchClient campaigns={campaigns} initialJobs={jobs} />
}
