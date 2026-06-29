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

async function searchPeopleAtCompany(
  firstName: string,
  lastName: string,
  companyDomain: string,
): Promise<{ email: string; linkedInUrl: string | null } | null> {
  const res = await fetch("https://api.apollo.io/v1/mixed_people/api_search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": APOLLO_API_KEY,
    },
    body: JSON.stringify({
      api_key: APOLLO_API_KEY,
      q_organization_domains_list: [companyDomain],
      per_page: 100,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const people = (data?.people ?? []) as Array<Record<string, unknown>>

  // Find by name similarity
  const firstLower = firstName.toLowerCase()
  const lastLower = lastName.split(" ")[0].toLowerCase() // first word of last name
  const match = people.find((p) => {
    const pFirst = ((p.first_name as string) ?? "").toLowerCase()
    const pLast = ((p.last_name as string) ?? "").toLowerCase()
    return pFirst.startsWith(firstLower) && pLast.startsWith(lastLower)
  })

  if (!match) return null
  const email = extractEmail(match)
  if (!email) return null
  return { email, linkedInUrl: (match.linkedin_url as string) ?? null }
}

// Returns true for standard LinkedIn slugs (/in/firstname-lastname-id)
// Returns false for encoded Sales Nav IDs (/in/ACwAABxxx...)
function isCanonicalLinkedIn(url: string): boolean {
  if (!url) return false
  const match = url.match(/linkedin\.com\/in\/([^/?]+)/)
  if (!match) return false
  const slug = match[1]
  // Encoded Sales Nav IDs start with uppercase or are very long base64-like strings
  return !(slug[0] === slug[0].toUpperCase() && slug[0] !== slug[0].toLowerCase()) && slug.length < 60
}

export async function findEmailApollo(
  firstName: string,
  lastName: string,
  companyName: string,
  linkedinUrl: string,
  companyDomain?: string | null
): Promise<ApolloResult> {
  try {
    // 1. name + company only — most flexible, avoids domain/URL confusion
    //    Apollo matches even when domain or LinkedIn URL in our DB differ from theirs
    const first = await matchPerson({
      first_name: firstName,
      last_name: lastName,
      organization_name: companyName || undefined,
    })

    let person = first?.person as Record<string, unknown> | undefined

    // 2. Canonical LinkedIn URL only (skip encoded Sales Nav IDs — they break Apollo matching)
    if (!person && linkedinUrl && isCanonicalLinkedIn(linkedinUrl)) {
      const urlOnly = await matchPerson({ linkedin_url: linkedinUrl })
      person = urlOnly?.person as Record<string, unknown> | undefined
    }

    // 3. name + domain (if domain available and previous attempts failed)
    if (!person && companyDomain) {
      const withDomain = await matchPerson({
        first_name: firstName,
        last_name: lastName,
        domain: companyDomain,
      })
      person = withDomain?.person as Record<string, unknown> | undefined
    }

    if (person) {
      const apolloLinkedIn = (person.linkedin_url as string) ?? null
      const email = extractEmail(person)
      if (email) return { email, canonicalLinkedInUrl: apolloLinkedIn }

      // Force email reveal via Apollo person ID
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
    }

    // 4. mixed_people/search by company domain + name match
    if (companyDomain) {
      const found = await searchPeopleAtCompany(firstName, lastName, companyDomain)
      if (found) return { email: found.email, canonicalLinkedInUrl: found.linkedInUrl }
    }

    return { email: null, canonicalLinkedInUrl: null }
  } catch {
    return { email: null, canonicalLinkedInUrl: null }
  }
}
