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
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
      body: JSON.stringify({
        api_key: APOLLO_API_KEY,
        first_name: firstName,
        last_name: lastName,
        organization_name: companyName,
        linkedin_url: linkedinUrl || undefined,
        reveal_personal_emails: false,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const email = data?.person?.email
    return email && email !== "email_not_unlocked@domain.com" ? email : null
  } catch {
    return null
  }
}
