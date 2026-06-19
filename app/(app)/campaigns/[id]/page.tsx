import { getCampaignWithAccounts } from "./actions"
import { AccountsClient } from "./accounts-client"
import { notFound } from "next/navigation"

export default async function CampaignPage({ params }: { params: { id: string } }) {
  const { id } = await Promise.resolve(params)

  let data
  try {
    data = await getCampaignWithAccounts(id)
  } catch {
    notFound()
  }

  if (!data.campaign) notFound()

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <AccountsClient campaign={data.campaign} initialAccounts={data.accounts} />
    </div>
  )
}
