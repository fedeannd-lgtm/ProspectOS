const PROSPEO_API_KEY = process.env.PROSPEO_API_KEY!

export async function findEmailProspeo(
  firstName: string,
  lastName: string,
  company: string,
  linkedinUrl: string
): Promise<string | null> {
  try {
    // Prefer LinkedIn URL lookup when available
    if (linkedinUrl) {
      const res = await fetch("https://api.prospeo.io/linkedin-email-finder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-KEY": PROSPEO_API_KEY,
        },
        body: JSON.stringify({ url: linkedinUrl }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.response?.email?.value) return data.response.email.value
      }
    }

    // Fallback: name + company
    if (!firstName || !lastName || !company) return null
    const res = await fetch("https://api.prospeo.io/email-finder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-KEY": PROSPEO_API_KEY,
      },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, company }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.response?.email?.value ?? null
  } catch {
    return null
  }
}
