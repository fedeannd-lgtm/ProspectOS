export const dynamic = "force-dynamic"

import { getReplies } from "./actions"
import { InboxClient } from "./inbox-client"

export default async function InboxPage() {
  const replies = await getReplies("all")
  return <InboxClient initialReplies={replies} />
}
