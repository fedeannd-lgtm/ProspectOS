"use client"

import { useState, useMemo, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Users, ExternalLink, Search, Download, Trash2 } from "lucide-react"
import { deleteProspects } from "./actions"

type Prospect = {
  id: string
  first_name: string
  last_name: string
  full_name: string
  job_title: string
  company_name: string
  company_domain: string | null
  linkedin_url: string
  connection_degree: string
  location: string | null
  email: string | null
  icp_score: number
  is_premium: boolean
  status: string
  started_role_months: number | null
  highlights: string | null
  created_at: string
  campaign_id: string
  campaigns: { week_label: string; rep_name: string; industry: string } | null
}

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  scraped:   { label: "Scrapeado",   class: "bg-zinc-100 text-zinc-600" },
  enriched:  { label: "Enriquecido", class: "bg-blue-50 text-blue-700" },
  approved:  { label: "Aprobado",    class: "bg-green-50 text-green-700" },
  rejected:  { label: "Rechazado",   class: "bg-red-50 text-red-700" },
  sent:      { label: "Enviado",     class: "bg-purple-50 text-purple-700" },
}

function campaignLabel(p: Prospect) {
  if (!p.campaigns) return ""
  return `${p.campaigns.week_label} · ${p.campaigns.rep_name} · ${p.campaigns.industry}`
}

function exportCsv(rows: Prospect[]) {
  const headers = ["Nombre", "Apellido", "Nombre completo", "Cargo", "Empresa", "Dominio", "Ubicación", "Email", "LinkedIn", "Grado", "Antigüedad (mes)", "Premium", "Highlights", "ICP", "Estado", "Campaña"]
  const escape = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`
  const lines = [
    headers.join(","),
    ...rows.map((p) => [
      escape(p.first_name),
      escape(p.last_name),
      escape(p.full_name),
      escape(p.job_title),
      escape(p.company_name),
      escape(p.company_domain),
      escape(p.location),
      escape(p.email),
      escape(p.linkedin_url),
      escape(p.connection_degree),
      p.started_role_months ?? "",
      p.is_premium ? "TRUE" : "FALSE",
      escape(p.highlights),
      p.icp_score > 0 ? p.icp_score : "",
      escape(p.status),
      escape(campaignLabel(p)),
    ].join(",")),
  ]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `prospectos-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ProspectsClient({ prospects: initialProspects }: { prospects: Prospect[] }) {
  const [prospects, setProspects] = useState(initialProspects)
  const [search, setSearch] = useState("")
  const [repFilter, setRepFilter] = useState("all")
  const [industryFilter, setIndustryFilter] = useState("all")
  const [campaignFilter, setCampaignFilter] = useState("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const reps = useMemo(() => {
    const set = new Set(prospects.map((p) => p.campaigns?.rep_name).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [prospects])

  const industries = useMemo(() => {
    const set = new Set(prospects.map((p) => p.campaigns?.industry).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [prospects])

  const campaigns = useMemo(() => {
    const seen = new Map<string, string>()
    prospects.forEach((p) => {
      if (!p.campaign_id || !p.campaigns) return
      if (repFilter !== "all" && p.campaigns.rep_name !== repFilter) return
      if (industryFilter !== "all" && p.campaigns.industry !== industryFilter) return
      if (!seen.has(p.campaign_id)) seen.set(p.campaign_id, campaignLabel(p))
    })
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [prospects, repFilter, industryFilter])

  const campaignIds = useMemo(() => new Set(campaigns.map(([id]) => id)), [campaigns])

  const filtered = useMemo(() => {
    const resolvedCampaign = campaignIds.has(campaignFilter) ? campaignFilter : "all"
    const q = search.toLowerCase()
    return prospects.filter((p) => {
      if (repFilter !== "all" && p.campaigns?.rep_name !== repFilter) return false
      if (industryFilter !== "all" && p.campaigns?.industry !== industryFilter) return false
      if (resolvedCampaign !== "all" && p.campaign_id !== resolvedCampaign) return false
      if (q && !p.full_name?.toLowerCase().includes(q) &&
               !p.job_title?.toLowerCase().includes(q) &&
               !p.company_name?.toLowerCase().includes(q) &&
               !p.email?.toLowerCase().includes(q)) return false
      return true
    })
  }, [prospects, search, repFilter, industryFilter, campaignFilter, campaignIds])

  const filteredIds = useMemo(() => new Set(filtered.map((p) => p.id)), [filtered])
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id))
  const selectedInView = filtered.filter((p) => selected.has(p.id))

  function toggleAll() {
    if (allFilteredSelected) {
      setSelected((prev) => { const next = new Set(prev); filtered.forEach((p) => next.delete(p.id)); return next })
    } else {
      setSelected((prev) => { const next = new Set(prev); filtered.forEach((p) => next.add(p.id)); return next })
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function handleDelete(ids: string[]) {
    if (!ids.length) return
    setProspects((prev) => prev.filter((p) => !ids.includes(p.id)))
    setSelected((prev) => { const next = new Set(prev); ids.forEach((id) => next.delete(id)); return next })
    startTransition(() => deleteProspects(ids))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Prospectos</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Todas las personas scrapeadas — {prospects.length} en total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedInView.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDelete(selectedInView.map((p) => p.id))}
              disabled={isPending}
            >
              <Trash2 className="mr-2 size-4" />
              Eliminar {selectedInView.length} seleccionados
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
          >
            <Download className="mr-2 size-4" />
            Exportar CSV ({filtered.length})
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, cargo, empresa o email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={repFilter}
                onChange={(e) => { setRepFilter(e.target.value); setCampaignFilter("all") }}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">Todos los reps</option>
                {reps.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                value={industryFilter}
                onChange={(e) => { setIndustryFilter(e.target.value); setCampaignFilter("all") }}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">Todas las industrias</option>
                {industries.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
              <select
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">Todas las campañas</option>
                {campaigns.map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
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
                    <th className="px-3 py-2.5 w-8">
                      <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} className="rounded" />
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nombre</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Apellido</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nombre completo</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Cargo</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Empresa</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Dominio</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Ubicación</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Grado</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Mes inicio</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Highlights</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">ICP</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Estado</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Campaña</th>
                    <th className="px-3 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const statusCfg = STATUS_LABELS[p.status] ?? STATUS_LABELS.scraped
                    return (
                      <tr key={p.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${selected.has(p.id) ? "bg-blue-50/50" : ""}`}>
                        <td className="px-3 py-2.5">
                          <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} className="rounded" />
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{p.first_name || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{p.last_name || "—"}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {p.linkedin_url ? (
                              <a href={p.linkedin_url} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium">
                                {p.full_name || "—"}
                                <ExternalLink className="size-3 opacity-60" />
                              </a>
                            ) : (
                              <span className="font-medium">{p.full_name || "—"}</span>
                            )}
                            {p.is_premium && (
                              <span className="rounded px-1 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 leading-none">PRO</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{p.job_title || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{p.company_name || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{p.company_domain || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{p.location || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{p.email || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{p.connection_degree || "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{p.started_role_months ?? "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] truncate" title={p.highlights ?? ""}>{p.highlights || "—"}</td>
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
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{campaignLabel(p) || "—"}</td>
                        <td className="px-3 py-2.5">
                          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete([p.id])} disabled={isPending}>
                            <Trash2 className="size-3.5" />
                          </Button>
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
