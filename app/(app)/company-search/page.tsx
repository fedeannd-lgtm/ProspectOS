import { getCampaigns, getCompanySearchJobs } from "./actions"
import { CompanySearchClient } from "./company-search-client"

export const dynamic = "force-dynamic"

export default async function CompanySearchPage() {
  const [campaigns, jobs] = await Promise.all([getCampaigns(), getCompanySearchJobs()])
  return <CompanySearchClient campaigns={campaigns} initialJobs={jobs} />
}
