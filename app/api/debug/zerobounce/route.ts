export async function GET() {
  const apiKey = process.env.ZEROBOUNCE_API_KEY
  if (!apiKey) return Response.json({ error: "ZEROBOUNCE_API_KEY no configurada" }, { status: 400 })

  // Check credits
  const creditsRes = await fetch(`https://api.zerobounce.net/v2/getcredits?apikey=${apiKey}`)
  const credits = await creditsRes.json()

  // Validate a known-good email as smoke test
  const testRes = await fetch(
    `https://api.zerobounce.net/v2/validate?apikey=${apiKey}&email=support@gmail.com&ip_address=`
  )
  const testResult = await testRes.json()

  return Response.json({
    key_prefix: apiKey.slice(0, 6) + "...",
    credits,
    smoke_test: {
      email: "support@gmail.com",
      status: testResult.status,
      sub_status: testResult.sub_status,
    },
  })
}
