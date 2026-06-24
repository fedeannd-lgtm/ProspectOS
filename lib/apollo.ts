import { canonicalLinkedInUrl } from "./linkedin"

const APOLLO_API_KEY = process.env.APOLLO_API_KEY!

export type ApolloResult = {
  email: string | null
  canonicalLinkedInUrl: string | null
}

async function matchPerson(payload: Record<string, unknown>): Promise<{ person: Record<string, unknown> } | null> {
  const res = await fetch("https://api.apollo.io/v1/people/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": APOLLO_API_KEY,
    },
    body: JSON.stringify({ api_key: APOLLO_API_KEY, reveal_personal_emails: true, ...payload }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data?.person ? data : null
}

function extractEmail(person: Record<string, unknown>): string | null {
  const email = person?.email as string | undefined
  if (email && email !== "email_not_unlocked@domain.com" && email.includes("@")) return email
  const contacts = (person?.contact_emails ?? []) as Array<{ email?: string }>
  return contacts.find((c) => c.email?.includes("@"))?.email ?? null
}

export async function findEmailApollo(
  firstName: string,
  lastName: string,
  companyName: string,
  linkedinUrl: string,
  companyDomain?: string | null
): Promise<ApolloResult> {
  try {
    // First call: match by name + domain
    const first = await matchPerson({
      first_name: firstName,
      last_name: lastName,
      organization_name: companyName || undefined,
      domain: companyDomain || undefined,
      linkedin_url: canonicalLinkedInUrl(linkedinUrl),
    })

    const person = first?.person as Record<string, unknown> | undefined
    if (!person) return { email: null, canonicalLinkedInUrl: null }

    const apolloLinkedIn = (person.linkedin_url as string) ?? null
    const email = extractEmail(person)
    if (email) return { email, canonicalLinkedInUrl: apolloLinkedIn }

    // Second call: if we have the Apollo person ID, match by ID to force email reveal
    const apolloId = person.id as string | undefined
    if (apolloId) {
      const second = await matchPerson({ id: apolloId })
      const p2 = second?.person as Record<string, unknown> | undefined
      if (p2) {
        const email2 = extractEmail(p2)
        const linkedin2 = (p2.linkedin_url as string) ?? apolloLinkedIn
        if (email2) return { email: email2, canonicalLinkedInUrl: linkedin2 }
        return { email: null, canonicalLinkedInUrl: linkedin2 }
      }
    }

    return { email: null, canonicalLinkedInUrl: apolloLinkedIn }
  } catch {
    return { email: null, canonicalLinkedInUrl: null }
  }
}
