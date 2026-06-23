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
    return data?.data?.email ?? null
  } catch {
    return null
  }
}
