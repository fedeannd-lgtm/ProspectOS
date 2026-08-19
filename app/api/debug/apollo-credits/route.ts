import { NextResponse } from "next/server"

export async function GET() {
  const key = process.env.APOLLO_API_KEY
  if (!key) return NextResponse.json({ error: "No APOLLO_API_KEY" })

  const endpoints = [
    "https://api.apollo.io/api/v1/usage_stats/credit_usage_stats",
    "https://api.apollo.io/api/v1/usage_stats/api_usage_stats",
  ]

  const results: Record<string, unknown> = {}

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "x-api-key": key },
      })
      const text = await res.text()
      let body: unknown
      try { body = JSON.parse(text) } catch { body = text }
      results[url] = { status: res.status, body }
    } catch (e) {
      results[url] = { error: String(e) }
    }
  }

  return NextResponse.json(results)
}
