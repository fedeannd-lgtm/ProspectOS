import { canonicalLinkedInUrl } from "./linkedin"

const APOLLO_API_KEY = process.env.APOLLO_API_KEY!

export async function findEmailApollo(
  firstName: string,
  lastName: string,
  companyName: string,
  linkedinUrl: string
): Promise<string | null> {
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
        organization_name: companyName,
        linkedin_url: canonicalLinkedInUrl(linkedinUrl),
        reveal_personal_emails: true,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()

    const email = data?.person?.email
    if (email && email !== "email_not_unlocked@domain.com" && email.includes("@")) {
      return email
    }

    const contacts: Array<{ email?: string }> = data?.person?.contact_emails ?? []
    const contactEmail = contacts.find((c) => c.email && c.email.includes("@"))?.email
    if (contactEmail) return contactEmail

    return null
  } catch {
    return null
  }
}
