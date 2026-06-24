import { canonicalLinkedInUrl } from "./linkedin"

const APOLLO_API_KEY = process.env.APOLLO_API_KEY!

export type ApolloResult = {
  email: string | null
  canonicalLinkedInUrl: string | null
}

export async function findEmailApollo(
  firstName: string,
  lastName: string,
  companyName: string,
  linkedinUrl: string,
  companyDomain?: string | null
): Promise<ApolloResult> {
  try {
    const res = await fetch("https://api.apollo.io/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": APOLLO_API_KEY,
      },
      body: JSON.stringify({
        api_key: APOLLO_API_KEY,
        first_name: firstName,
        last_name: lastName,
        organization_name: companyName || undefined,
        domain: companyDomain || undefined,
        linkedin_url: canonicalLinkedInUrl(linkedinUrl),
        reveal_personal_emails: true,
      }),
    })
    if (!res.ok) return { email: null, canonicalLinkedInUrl: null }
    const data = await res.json()
    const person = data?.person

    // Extract canonical LinkedIn URL Apollo has on file
    const apolloLinkedIn: string | null = person?.linkedin_url ?? null

    const email = person?.email
    if (email && email !== "email_not_unlocked@domain.com" && email.includes("@")) {
      return { email, canonicalLinkedInUrl: apolloLinkedIn }
    }

    const contacts: Array<{ email?: string }> = person?.contact_emails ?? []
    const contactEmail = contacts.find((c) => c.email && c.email.includes("@"))?.email
    if (contactEmail) return { email: contactEmail, canonicalLinkedInUrl: apolloLinkedIn }

    return { email: null, canonicalLinkedInUrl: apolloLinkedIn }
  } catch {
    return { email: null, canonicalLinkedInUrl: null }
  }
}
