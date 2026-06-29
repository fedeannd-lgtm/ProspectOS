"use client"

import { useState } from "react"
import { Loader2, Zap, Tags, CheckCircle2, ChevronsUpDown, Check, AlertTriangle, Search, X, Download, AlertCircle } from "lucide-react"
import type { ProviderStatus } from "../settings/provider-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { getCampaigns, getProspectsForEnrichment, enrichOneProspect, classifyAllIcp } from "./actions"

type Campaign = { id: string; week_label: string; rep_name: string; industry: string; status: string; prospects_found: number | null }
type Prospect = {
  id: string; first_name: string; last_name: string; full_name: string
  job_title: string; company_name: string; company_domain: string | null
  linkedin_url: string; email: string | null; email_status: string | null
  email_provider: string | null; icp_score: number; icp_category: string | null; status: string
}

type IcpCategory = "Communication" | "Experience" | "Onboarding" | "Helpdesk" | "Genérico"

const ZB_CFG: Record<string, { label: string; cls: string }> = {
  valid:       { label: "Válido",     cls: "bg-green-50 text-green-700" },
  "catch-all": { label: "Catch-all",  cls: "bg-yellow-50 text-yellow-700" },
  invalid:     { label: "Inválido",   cls: "bg-red-50 text-red-700" },
  unknown:     { label: "Desconocido",cls: "bg-zinc-100 text-zinc-500" },
  spamtrap:    { label: "Spam trap",  cls: "bg-red-50 text-red-700" },
  abuse:       { label: "Abuso",      cls: "bg-red-50 text-red-700" },
  do_not_mail: { label: "No enviar",  cls: "bg-red-50 text-red-700" },
}

const ICP_CFG: Record<string, { cls: string }> = {
  Communication: { cls: "bg-purple-50 text-purple-700" },
  Experience:    { cls: "bg-blue-50 text-blue-700" },
  Onboarding:    { cls: "bg-cyan-50 text-cyan-700" },
  Helpdesk:      { cls: "bg-orange-50 text-orange-700" },
  "Genérico":    { cls: "bg-zinc-100 text-zinc-500" },
}

const PROVIDER_COLS: { key: string; label: string }[] = [
  { key: "apollo",    label: "Apollo"  },
  { key: "findymail", label: "Findy"   },
  { key: "prospeo",   label: "Prospeo" },
  { key: "hunter",    label: "Hunter"  },
  { key: "pattern",   label: "Patrón"  },
]

function exportCsv(prospects: Prospect[], campaignLabel: string) {
  const esc = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`
  const headers = ["Nombre", "Apellido", "Nombre completo", "Cargo", "Empresa", "Dominio", "LinkedIn", "Email", "ZB Status", ...PROVIDER_COLS.map((c) => c.label), "ICP Categoría", "ICP Score", "Estado"]
  const rows = prospects.map((p) => [
    esc(p.first_name), esc(p.last_name), esc(p.full_name),
    esc(p.job_title), esc(p.company_name), esc(p.company_domain),
    esc(p.linkedin_url), esc(p.email), esc(p.email_status),
    ...PROVIDER_COLS.map((c) => p.email_provider === c.key ? "✓" : ""),
    esc(p.icp_category),
    p.icp_score > 0 ? p.icp_score : "",
    esc(p.status),
  ].join(","))
  const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `enriquecimiento-${campaignLabel}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function hasValidEmail(p: Prospect) {
  return !!(p.email && (p.email_status === "valid" || p.email_status === "catch-all"))
}

function isClassified(p: Prospect) {
  return !!(p.icp_category)
}

export function EnrichmentClient({ campaigns, providerStatus }: { campaigns: Campaign[]; providerStatus: ProviderStatus[] }) {
  const [campaignId, setCampaignId] = useState("")
  const [comboOpen, setComboOpen] = useState(false)
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loadingProspects, setLoadingProspects] = useState(false)
  const [error, setError] = useState("")

  // ICP classification state
  const [classifying, setClassifying] = useState(false)
  const [classifyProgress, setClassifyProgress] = useState({ done: 0, total: 0 })

  // Filter state
  const [search, setSearch] = useState("")
  const [scoreFilter, setScoreFilter] = useState<"all" | "gte5" | "eq10" | "eq0">("all")
  const [categoryFilter, setCategoryFilter] = useState<"all" | IcpCategory>("all")
  const [emailFilter, setEmailFilter] = useState<"all" | "pending" | "enriched">("all")

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Enrichment state
  const [enriching, setEnriching] = useState(false)
  const [enrichProgress, setEnrichProgress] = useState({ done: 0, total: 0 })
  const [rowStatus, setRowStatus] = useState<Map<string, "enriching" | "found" | "not_found" | "error">>(new Map())

  const selectedCampaign = campaigns.find((c) => c.id === campaignId)

  async function loadProspects(id: string) {
    setLoadingProspects(true)
    setSelectedIds(new Set())
    setError("")
    try {
      const data = await getProspectsForEnrichment(id) as Prospect[]
      setProspects(data)
      const initial = new Map<string, "enriching" | "found" | "not_found" | "error">()
      for (const p of data) {
        if (p.status === "not_found") initial.set(p.id, "not_found")
        else if (p.status === "enriched" && p.email) initial.set(p.id, "found")
      }
      setRowStatus(initial)
    } catch {
      setError("Error cargando prospectos")
    } finally {
      setLoadingProspects(false)
    }
  }

  // Derived counts
  const withEmail = prospects.filter(hasValidEmail).length
  const unclassified = prospects.filter((p) => !isClassified(p)).length

  // Filtered prospects
  const filtered = prospects.filter((p) => {
    if (search) {
      const q = search.toLowerCase()
      if (
        !p.full_name?.toLowerCase().includes(q) &&
        !p.company_name?.toLowerCase().includes(q) &&
        !p.job_title?.toLowerCase().includes(q)
      ) return false
    }
    if (scoreFilter === "gte5" && (p.icp_score ?? 0) < 5) return false
    if (scoreFilter === "eq10" && p.icp_score !== 10) return false
    if (scoreFilter === "eq0" && p.icp_score !== 0) return false
    if (categoryFilter !== "all" && p.icp_category !== categoryFilter) return false
    if (emailFilter === "pending" && hasValidEmail(p)) return false
    if (emailFilter === "enriched" && !hasValidEmail(p)) return false
    return true
  })

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id))

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filtered.forEach((p) => next.delete(p.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filtered.forEach((p) => next.add(p.id))
        return next
      })
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleClassifyIcp() {
    if (!campaignId) return
    setClassifying(true)
    setClassifyProgress({ done: 0, total: prospects.length })
    try {
      // Batch classify on server — returns count
      await classifyAllIcp(campaignId)
      // Reload to get updated values
      const data = await getProspectsForEnrichment(campaignId)
      setProspects(data as Prospect[])
      setClassifyProgress({ done: prospects.length, total: prospects.length })
    } catch {
      setError("Error al clasificar ICP")
    } finally {
      setClassifying(false)
    }
  }

  async function handleEnrichSelected() {
    const toEnrich = [...selectedIds].filter((id) => {
      const p = prospects.find((x) => x.id === id)
      return p && !hasValidEmail(p)
    })
    if (!toEnrich.length) return

    setEnriching(true)
    setError("")
    setEnrichProgress({ done: 0, total: toEnrich.length })

    for (let i = 0; i < toEnrich.length; i++) {
      const id = toEnrich[i]
      setRowStatus((prev) => new Map(prev).set(id, "enriching"))
      try {
        const result = await enrichOneProspect(id)
        if (result.email) {
          setProspects((prev) =>
            prev.map((x) =>
              x.id === id
                ? { ...x, email: result.email, email_status: result.zbStatus, email_provider: result.provider, icp_category: result.icpCategory, icp_score: result.icpScore, status: "enriched" }
                : x
            )
          )
          setRowStatus((prev) => new Map(prev).set(id, "found"))
        } else {
          setRowStatus((prev) => new Map(prev).set(id, "not_found"))
        }
      } catch {
        setRowStatus((prev) => new Map(prev).set(id, "error"))
      }
      setEnrichProgress({ done: i + 1, total: toEnrich.length })
    }

    setEnriching(false)
  }

  const selectedPending = [...selectedIds].filter((id) => {
    const p = prospects.find((x) => x.id === id)
    return p && !hasValidEmail(p)
  }).length

  const problemProviders = providerStatus.filter((p) => p.status === "out" || p.status === "error")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Enriquecimiento</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Apollo → FindyEmail → Prospeo → Hunter, validado con Zerobounce.
        </p>
      </div>

      {problemProviders.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-yellow-600" />
          <div>
            <span className="font-medium">Providers con problemas: </span>
            {problemProviders.map((p) => `${p.label} (${p.detail})`).join(", ")}.
            {" "}El enriquecimiento sigue corriendo con los demás providers.
            {" "}<a href="/settings" className="underline font-medium">Ver estado completo →</a>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Left panel */}
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Campaña</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {selectedCampaign
                    ? <span className="truncate">{selectedCampaign.week_label} — {selectedCampaign.rep_name}</span>
                    : <span className="text-muted-foreground">Seleccionar campaña…</span>}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar…" />
                    <CommandList>
                      <CommandEmpty>Sin resultados.</CommandEmpty>
                      {Object.entries(
                        campaigns.reduce((g, c) => { if (!g[c.rep_name]) g[c.rep_name] = []; g[c.rep_name].push(c); return g }, {} as Record<string, Campaign[]>)
                      ).map(([rep, items]) => (
                        <CommandGroup key={rep} heading={rep}>
                          {items.map((c) => (
                            <CommandItem key={c.id} value={`${c.week_label} ${c.rep_name} ${c.industry}`}
                              onSelect={() => { setCampaignId(c.id); setComboOpen(false); loadProspects(c.id) }}>
                              <Check className={`mr-2 size-4 ${campaignId === c.id ? "opacity-100" : "opacity-0"}`} />
                              <span>{c.week_label}</span>
                              <span className="ml-2 text-muted-foreground text-xs">{c.industry}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {prospects.length > 0 && (
                <div className="rounded-lg border divide-y text-sm">
                  <div className="flex justify-between px-3 py-1.5">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-medium">{prospects.length}</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5">
                    <span className="text-muted-foreground">Con email</span>
                    <span className="font-medium text-green-700">{withEmail}</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5">
                    <span className="text-muted-foreground">Sin clasificar</span>
                    <span className="font-medium text-amber-600">{unclassified}</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5">
                    <span className="text-muted-foreground">Seleccionados</span>
                    <span className="font-medium text-primary">{selectedIds.size}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Classify ICP */}
          <Card>
            <CardContent className="pt-4 space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleClassifyIcp}
                disabled={!campaignId || loadingProspects || classifying || enriching}
              >
                {classifying
                  ? <><Loader2 className="mr-2 size-4 animate-spin" />Clasificando…</>
                  : <><Tags className="mr-2 size-4" />Clasificar ICP{unclassified > 0 ? ` (${unclassified})` : ""}</>}
              </Button>
              {classifying && (
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${classifyProgress.total ? (classifyProgress.done / classifyProgress.total) * 100 : 0}%` }} />
                  </div>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">Clasifica sin consumir créditos de email.</p>
            </CardContent>
          </Card>

          {/* Enrich selected */}
          <Card>
            <CardContent className="pt-4 space-y-2">
              <Button
                className="w-full"
                onClick={handleEnrichSelected}
                disabled={!campaignId || loadingProspects || enriching || classifying || selectedPending === 0}
              >
                {enriching
                  ? <><Loader2 className="mr-2 size-4 animate-spin" />{enrichProgress.done}/{enrichProgress.total}</>
                  : <><Zap className="mr-2 size-4" />Enriquecer seleccionados{selectedPending > 0 ? ` (${selectedPending})` : ""}</>}
              </Button>
              {enriching && (
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${enrichProgress.total ? (enrichProgress.done / enrichProgress.total) * 100 : 0}%` }} />
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">Solo prospectos seleccionados sin email válido.</p>
            </CardContent>
          </Card>

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Right panel */}
        <Card className="flex flex-col">
          {/* Filter bar */}
          <div className="border-b px-4 py-3 flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar nombre, empresa, cargo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-7 text-xs w-56"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="size-3" />
                </button>
              )}
            </div>

            <Select value={scoreFilter} onValueChange={(v) => setScoreFilter(v as typeof scoreFilter)}>
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue placeholder="Score ICP" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los scores</SelectItem>
                <SelectItem value="gte5">Score ≥ 5</SelectItem>
                <SelectItem value="eq10">Score = 10</SelectItem>
                <SelectItem value="eq0">Score = 0</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as typeof categoryFilter)}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                <SelectItem value="Communication">Communication</SelectItem>
                <SelectItem value="Experience">Experience</SelectItem>
                <SelectItem value="Onboarding">Onboarding</SelectItem>
                <SelectItem value="Helpdesk">Helpdesk</SelectItem>
                <SelectItem value="Genérico">Genérico</SelectItem>
              </SelectContent>
            </Select>

            <Select value={emailFilter} onValueChange={(v) => setEmailFilter(v as typeof emailFilter)}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue placeholder="Email" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Sin email</SelectItem>
                <SelectItem value="enriched">Con email</SelectItem>
              </SelectContent>
            </Select>

            <span className="ml-auto text-xs text-muted-foreground">{filtered.length} visibles</span>
            {filtered.length > 0 && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => exportCsv(filtered, selectedCampaign?.week_label ?? "campaña")}>
                <Download className="mr-1.5 size-3" /> Exportar CSV
              </Button>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-x-auto">
            {loadingProspects ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : prospects.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                Seleccioná una campaña para ver los prospectos
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                Ningún prospecto coincide con los filtros
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2.5 w-8">
                      <Checkbox
                        checked={allFilteredSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Seleccionar todos"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Nombre</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Cargo</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Empresa</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">ICP</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Score</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">ZB</th>
                    {PROVIDER_COLS.map((c) => (
                      <th key={c.key} className="px-2 py-2.5 text-center font-medium text-muted-foreground w-14">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const zb = p.email_status ? ZB_CFG[p.email_status] : null
                    const icp = p.icp_category ? ICP_CFG[p.icp_category] ?? ICP_CFG["Genérico"] : null
                    const valid = hasValidEmail(p)
                    return (
                      <tr
                        key={p.id}
                        className={`border-b last:border-0 hover:bg-muted/30 cursor-pointer ${selectedIds.has(p.id) ? "bg-primary/5" : ""}`}
                        onClick={() => toggleOne(p.id)}
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(p.id)}
                            onCheckedChange={() => toggleOne(p.id)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            {valid
                              ? <CheckCircle2 className="size-3 text-green-600 shrink-0" />
                              : <div className="size-3 rounded-full border border-muted-foreground/30 shrink-0" />}
                            <span className="truncate max-w-[130px]">{p.full_name || "—"}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[140px] truncate">{p.job_title || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{p.company_name || "—"}</td>
                        <td className="px-3 py-2">
                          {icp ? (
                            <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${icp.cls}`}>
                              {p.icp_category}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2 font-medium text-center">
                          {p.icp_score > 0 ? p.icp_score : p.icp_category ? "0" : "—"}
                        </td>
                        <td className="px-3 py-2 max-w-[160px]">
                          {rowStatus.get(p.id) === "enriching" ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Loader2 className="size-3 animate-spin" /> Buscando…
                            </span>
                          ) : rowStatus.get(p.id) === "not_found" ? (
                            <span className="inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-500">No encontrado</span>
                          ) : rowStatus.get(p.id) === "error" ? (
                            <span className="inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-red-50 text-red-600">Error</span>
                          ) : p.email ? (
                            <span className="font-mono text-[10px] text-muted-foreground truncate block">{p.email}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {zb ? (
                            <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${zb.cls}`}>
                              {zb.label}
                            </span>
                          ) : "—"}
                        </td>
                        {PROVIDER_COLS.map((c) => (
                          <td key={c.key} className="px-2 py-2 text-center">
                            {p.email_provider === c.key ? (
                              <span className="inline-flex items-center justify-center size-5 rounded-full bg-green-100 text-green-700">
                                <Check className="size-3" />
                              </span>
                            ) : rowStatus.get(p.id) === "enriching" ? (
                              <span className="text-muted-foreground/30 text-[10px]">·</span>
                            ) : (
                              <span className="text-muted-foreground/30 text-[10px]">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
