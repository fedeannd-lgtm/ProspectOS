const HUNTER_API_KEY = process.env.HUNTER_API_KEY!

export async function findEmailHunter(
  firstName: string,
  lastName: string,
  domain: string
): Promise<string | null> {
  if (!domain) return null
  try {
    const params = new URLSearchParams({
      first_name: firstName,
      last_name: lastName,
      domain,
      api_key: HUNTER_API_KEY,
    })
    const res = await fetch(`https://api.hunter.io/v2/email-finder?${params}`)
    if (!res.ok) return null
    const data = await res.json()
    const email = data?.data?.email ?? null
    const score = data?.data?.score ?? 0
    // Require at least 50% confidence from Hunter
    if (!email || score < 50) return null
    return email
  } catch {
    return null
  }
}
