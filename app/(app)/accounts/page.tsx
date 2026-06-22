import { getAllAccounts } from "./actions"
import { AccountsClient } from "./accounts-client"

export const dynamic = "force-dynamic"

export default async function AccountsPage() {
  const accounts = await getAllAccounts()
  return <AccountsClient accounts={accounts} />
}
