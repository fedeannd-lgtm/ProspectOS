const BASE = "https://api.apify.com/v2"
const TOKEN = process.env.APIFY_API_TOKEN!
const SALES_NAV_ACTOR = "curious_coder~linkedin-sales-navigator-search-scraper"

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` }
}

export async function startSalesNavRun(input: object, webhookUrl: string): Promise<string> {
  const webhooksParam = Buffer.from(
    JSON.stringify([{
      eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED"],
      requestUrl: webhookUrl,
    }])
  ).toString("base64")

  const res = await fetch(`${BASE}/acts/${SALES_NAV_ACTOR}/runs?webhooks=${webhooksParam}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Apify run failed: ${await res.text()}`)
  const { data } = await res.json()
  return data.id as string
}


export async function getDatasetItems<T = Record<string, unknown>>(datasetId: string): Promise<T[]> {
  const res = await fetch(`${BASE}/datasets/${datasetId}/items?clean=true`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Apify dataset error: ${await res.text()}`)
  return res.json()
}
