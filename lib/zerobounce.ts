export type ZBStatus = "valid" | "invalid" | "catch-all" | "unknown" | "spamtrap" | "abuse" | "do_not_mail"

export async function validateEmail(email: string, apiKey?: string | null): Promise<{ status: ZBStatus; subStatus: string }> {
  const key = apiKey || process.env.ZEROBOUNCE_API_KEY || ""
  try {
    const params = new URLSearchParams({ apikey: key, email, ip_address: "" })
    const res = await fetch(`https://api.zerobounce.net/v2/validate?${params}`)
    if (!res.ok) return { status: "unknown", subStatus: "" }
    const data = await res.json()
    return {
      status: (data.status ?? "unknown") as ZBStatus,
      subStatus: data.sub_status ?? "",
    }
  } catch {
    return { status: "unknown", subStatus: "" }
  }
}

export function isUsable(status: ZBStatus): boolean {
  return status === "valid" || status === "catch-all"
}
