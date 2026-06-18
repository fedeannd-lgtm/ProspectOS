const BASE = "https://api.apify.com/v2"
const TOKEN = process.env.APIFY_API_TOKEN!
const SALES_NAV_ACTOR = "curious_coder~linkedin-sales-navigator-search-scraper"

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` }
}

export async function startSalesNavRun(input: object, webhookUrl: string): Promise<string> {
  const res = await fetch(`${BASE}/acts/${SALES_NAV_ACTOR}/runs`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Apify run failed: ${await res.text()}`)
  const { data } = await res.json()

  await fetch(`${BASE}/webhooks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED"],
      requestUrl: webhookUrl,
      condition: { actorRunId: data.id },
      isAdHoc: true,
    }),
  })

  return data.id as string
}

export async function getDatasetItems<T = Record<string, unknown>>(datasetId: string): Promise<T[]> {
  const res = await fetch(`${BASE}/datasets/${datasetId}/items?clean=true`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Apify dataset error: ${await res.text()}`)
  return res.json()
}
