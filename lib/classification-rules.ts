import { supabaseAdmin } from "./supabase"
import { classifyIcp } from "./icp"

export type IcpRule = {
  id: string
  label: string
  score: number
  keywords: string[]
  priority: number
}

export type OsScoreRule = {
  id: string
  segment: string
  keywords: string[]
  priority: number
}

export type ClassificationRules = {
  icp: IcpRule[]
  osScore: OsScoreRule[]
  osScore2: OsScoreRule[]
}

export async function getClassificationRules(tenantId: string): Promise<ClassificationRules> {
  const [icp, os1, os2] = await Promise.all([
    supabaseAdmin.from("icp_rules").select("id, label, score, keywords, priority").eq("tenant_id", tenantId).order("priority"),
    supabaseAdmin.from("os_score_rules").select("id, segment, keywords, priority").eq("tenant_id", tenantId).order("priority"),
    supabaseAdmin.from("os_score2_rules").select("id, segment, keywords, priority").eq("tenant_id", tenantId).order("priority"),
  ])
  return {
    icp: (icp.data ?? []) as IcpRule[],
    osScore: (os1.data ?? []) as OsScoreRule[],
    osScore2: (os2.data ?? []) as OsScoreRule[],
  }
}

function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[áàäâã]/g, "a").replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i").replace(/[óòöôõ]/g, "o")
    .replace(/[úùüû]/g, "u").replace(/ñ/g, "n")
}

export function applyIcpRules(
  jobTitle: string,
  rules: IcpRule[]
): { category: string; score: number } {
  if (!rules.length) {
    return classifyIcp(jobTitle)
  }
  const t = normalize(jobTitle)
  for (const rule of rules) {
    if (rule.keywords.some((kw) => t.includes(normalize(kw)))) {
      return { category: rule.label, score: rule.score }
    }
  }
  // No match → lowest score rule or 0
  const lowest = rules.reduce((a, b) => (a.score <= b.score ? a : b), rules[0])
  return { category: lowest.label, score: lowest.score }
}

export function applyOsScoreRules(
  jobTitle: string,
  rules: OsScoreRule[]
): string | null {
  if (!rules.length) return null
  const t = normalize(jobTitle)
  for (const rule of rules) {
    if (rule.keywords.some((kw) => t.includes(normalize(kw)))) {
      return rule.segment
    }
  }
  return null
}
