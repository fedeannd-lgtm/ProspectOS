export async function POST(req: Request) {
  const body = await req.json()
  const { first_name, last_name, company_name, linkedin_url } = body

  const res = await fetch("https://api.apollo.io/v1/people/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": process.env.APOLLO_API_KEY!,
    },
    body: JSON.stringify({
      api_key: process.env.APOLLO_API_KEY,
      first_name,
      last_name,
      organization_name: company_name,
      linkedin_url: linkedin_url || undefined,
      reveal_personal_emails: true,
    }),
  })

  const data = await res.json()
  return Response.json({ status: res.status, data })
}
