const BASE = "https://api.apify.com/v2"
const TOKEN = process.env.APIFY_API_TOKEN!

export async function startActorRun(actorId: string, input: Record<string, unknown>) {
  const res = await fetch(`${BASE}/acts/${actorId}/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Apify error ${res.status}: ${await res.text()}`)
  const { data } = await res.json()
  return data as { id: string; defaultDatasetId: string; status: string }
}

export async function getRunStatus(runId: string) {
  const res = await fetch(`${BASE}/actor-runs/${runId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  if (!res.ok) throw new Error(`Apify error ${res.status}`)
  const { data } = await res.json()
  return data as { id: string; status: string; defaultDatasetId: string }
}

export async function getDatasetItems<T = Record<string, unknown>>(datasetId: string): Promise<T[]> {
  const res = await fetch(`${BASE}/datasets/${datasetId}/items?clean=true`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  if (!res.ok) throw new Error(`Apify error ${res.status}`)
  return res.json()
}
