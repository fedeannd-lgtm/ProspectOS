import { canonicalLinkedInUrl } from "./linkedin"

const FINDYMAIL_API_KEY = process.env.FINDYMAIL_API_KEY!

export async function findEmailFindymail(
  firstName: string,
  lastName: string,
  domain: string,
  linkedinUrl: string
): Promise<string | null> {
  try {
    const canonical = canonicalLinkedInUrl(linkedinUrl)
    // Prefer LinkedIn URL lookup when available
    if (canonical) {
      const res = await fetch("https://app.findymail.com/api/search/linkedin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${FINDYMAIL_API_KEY}`,
        },
        body: JSON.stringify({ linkedin_url: canonical }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.contact?.email) return data.contact.email
      }
    }

    // Fallback: name + domain
    if (!domain) return null
    const res = await fetch("https://app.findymail.com/api/search/name", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${FINDYMAIL_API_KEY}`,
      },
      body: JSON.stringify({ name: `${firstName} ${lastName}`.trim(), domain }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.contact?.email ?? null
  } catch {
    return null
  }
}
