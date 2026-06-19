"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Users, ExternalLink, Search } from "lucide-react"

type Prospect = {
  id: string
  full_name: string
  job_title: string
  company_name: string
  linkedin_url: string
  connection_degree: string
  email: string | null
  icp_score: number
  status: string
  created_at: string
  campaign_id: string
  campaigns: { week_label: string; rep_name: string; industry: string } | null
}

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  scraped:   { label: "Scrapeado",  class: "bg-zinc-100 text-zinc-600" },
  enriched:  { label: "Enriquecido", class: "bg-blue-50 text-blue-700" },
  approved:  { label: "Aprobado",   class: "bg-green-50 text-green-700" },
  rejected:  { label: "Rechazado",  class: "bg-red-50 text-red-700" },
  sent:      { label: "Enviado",    class: "bg-purple-50 text-purple-700" },
}

export function ProspectsClient({ prospects }: { prospects: Prospect[] }) {
  const [search, setSearch] = useState("")
  const [repFilter, setRepFilter] = useState("all")
  const [industryFilter, setIndustryFilter] = useState("all")

  const reps = useMemo(() => {
    const set = new Set(prospects.map((p) => p.campaigns?.rep_name).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [prospects])

  const industries = useMemo(() => {
    const set = new Set(prospects.map((p) => p.campaigns?.industry).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [prospects])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return prospects.filter((p) => {
      if (repFilter !== "all" && p.campaigns?.rep_name !== repFilter) return false
      if (industryFilter !== "all" && p.campaigns?.industry !== industryFilter) return false
      if (q && !p.full_name?.toLowerCase().includes(q) &&
               !p.job_title?.toLowerCase().includes(q) &&
               !p.company_name?.toLowerCase().includes(q) &&
               !p.email?.toLowerCase().includes(q)) return false
      return true
    })
  }, [prospects, search, repFilter, industryFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Prospectos</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Todas las personas scrapeadas — {prospects.length} en total
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, cargo, empresa o email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={repFilter}
                onChange={(e) => setRepFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">Todos los reps</option>
                {reps.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                value={industryFilter}
                onChange={(e) => setIndustryFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">Todas las industrias</option>
                {industries.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
          <CardDescription className="mt-1">{filtered.length} resultados</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
              <Users className="mb-2 size-8 opacity-30" />
              Sin prospectos todavía
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nombre</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Cargo</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Empresa</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Grado</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">ICP</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Estado</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Campaña</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const statusCfg = STATUS_LABELS[p.status] ?? STATUS_LABELS.scraped
                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5">
                          {p.linkedin_url ? (
                            <a
                              href={p.linkedin_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
                            >
                              {p.full_name || "—"}
                              <ExternalLink className="size-3 opacity-60" />
                            </a>
                          ) : (
                            <span className="font-medium">{p.full_name || "—"}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{p.job_title || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{p.company_name || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{p.email || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{p.connection_degree || "—"}</td>
                        <td className="px-4 py-2.5">
                          {p.icp_score > 0 ? (
                            <span className={`font-medium ${p.icp_score >= 10 ? "text-green-700" : p.icp_score >= 5 ? "text-amber-600" : "text-muted-foreground"}`}>
                              {p.icp_score}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.class}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {p.campaigns ? `${p.campaigns.week_label} · ${p.campaigns.rep_name} · ${p.campaigns.industry}` : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
