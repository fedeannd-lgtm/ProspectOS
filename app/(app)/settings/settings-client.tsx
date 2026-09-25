"use client"

import { useState, useTransition, useMemo } from "react"
import { CheckCircle2, XCircle, Loader2, Plus, Trash2, Copy, Check, Link2, AlertTriangle, AlertCircle, MinusCircle, Activity, ChevronsUpDown, Users, ExternalLink, Download } from "lucide-react"
import type { ProviderStatus } from "./provider-status"
import type { ProviderUsage } from "./actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { createSavedUrl, deleteSavedUrl, saveClientCompanies, updateClientCompanyLinkedinUrl, syncHubspotDeals, saveTenantApiKeys, getTenantReps, addTenantRep, deleteTenantRep, addTenantNiche, deleteTenantNiche, saveIcpRules, saveOsScoreRules, type SavedUrl, type ClientCompany, type TenantApiKeys } from "./actions"
import type { IcpRule, OsScoreRule } from "@/lib/classification-rules"
import { getProviderStatus } from "./provider-status"
import { REPS } from "@/lib/reps"
import { getInboxConfig, saveInboxConfig, type InboxConfig } from "../inbox/actions"
import type { LinkedinSequenceConfig, EmailSequenceConfig } from "@/lib/sequence-configs"
import { DEFAULT_LINKEDIN_CONFIG, DEFAULT_EMAIL_CONFIG } from "@/lib/sequence-configs"
const URL_TYPE_LABELS: Record<string, string> = {
  company_search: "Company Search",
  people_search: "People Search",
}

// ─── Saved URL row ────────────────────────────────────────────────────────────

function UrlRow({ url, onDelete }: { url: SavedUrl; onDelete: () => void }) {
  const [copied, setCopied] = useState(false)
  const [deleting, startDelete] = useTransition()

  function handleCopy() {
    navigator.clipboard.writeText(url.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDelete() {
    startDelete(async () => {
      await deleteSavedUrl(url.id)
      onDelete()
    })
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <Link2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{url.rep_name}</span>
          <Badge variant="outline" className="text-xs font-normal">{url.industry}</Badge>
          <Badge
            variant="secondary"
            className={`text-xs font-normal ${url.url_type === "company_search" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}
          >
            {URL_TYPE_LABELS[url.url_type]}
          </Badge>
          {url.label && <span className="text-xs text-muted-foreground">— {url.label}</span>}
          {url.url_type === "people_search" && url.times_used > 0 && (
            <span className="text-xs text-muted-foreground">· {url.times_used}× usada</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground font-mono truncate">{url.url}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy}>
          {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        </Button>
      </div>
    </div>
  )
}

// ─── Add URL form ─────────────────────────────────────────────────────────────

type NewUrlForm = {
  rep_name: string
  industry: string
  url_type: "company_search" | "people_search" | ""
  url: string
  label: string
}

const EMPTY_URL_FORM: NewUrlForm = { rep_name: "", industry: "", url_type: "", url: "", label: "" }

function AddUrlForm({ onAdded, allIndustries }: { onAdded: (url: SavedUrl) => void; allIndustries: string[] }) {
  const [form, setForm] = useState<NewUrlForm>(EMPTY_URL_FORM)
  const [industryOpen, setIndustryOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")

  const isValid = form.rep_name && form.industry && form.url_type && form.url.trim()

  function handleSubmit() {
    if (!isValid) return
    setError("")
    startTransition(async () => {
      try {
        const created = await createSavedUrl({
          rep_name: form.rep_name,
          industry: form.industry,
          url_type: form.url_type as "company_search" | "people_search",
          url: form.url.trim(),
          label: form.label.trim() || null,
        })
        setForm(EMPTY_URL_FORM)
        onAdded(created)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error guardando URL")
      }
    })
  }

  return (
    <div className="rounded-lg border border-dashed p-4 space-y-3 bg-muted/30">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nueva URL</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select value={form.rep_name} onValueChange={(v) => { if (v) setForm((f) => ({ ...f, rep_name: v })) }}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="SDR" />
          </SelectTrigger>
          <SelectContent>
            {REPS.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Industry combobox with free-text support */}
        <Popover open={industryOpen} onOpenChange={setIndustryOpen}>
          <PopoverTrigger className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-2 text-xs hover:bg-accent hover:text-accent-foreground">
            <span className={form.industry ? "" : "text-muted-foreground"}>
              {form.industry || "Nicho"}
            </span>
            <ChevronsUpDown className="size-3 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent className="w-52 p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Buscar o escribir…"
                value={form.industry}
                onValueChange={(v) => setForm((f) => ({ ...f, industry: v }))}
                className="h-8 text-xs"
              />
              <CommandList>
                <CommandEmpty>
                  <button
                    className="w-full px-3 py-2 text-left text-xs hover:bg-muted/50"
                    onClick={() => setIndustryOpen(false)}
                  >
                    Usar &quot;{form.industry}&quot;
                  </button>
                </CommandEmpty>
                <CommandGroup>
                  {allIndustries.map((i) => (
                    <CommandItem
                      key={i}
                      value={i}
                      className="text-xs"
                      onSelect={() => { setForm((f) => ({ ...f, industry: i })); setIndustryOpen(false) }}
                    >
                      <Check className={`mr-2 size-3 ${form.industry === i ? "opacity-100" : "opacity-0"}`} />
                      {i}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Select value={form.url_type} onValueChange={(v) => { if (v) setForm((f) => ({ ...f, url_type: v as NewUrlForm["url_type"] })) }}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="company_search" className="text-xs">Company Search</SelectItem>
            <SelectItem value="people_search" className="text-xs">People Search</SelectItem>
          </SelectContent>
        </Select>

        <Input
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          placeholder="Etiqueta (opcional)"
          className="h-8 text-xs"
        />
      </div>

      <div className="flex gap-2">
        <Input
          value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          placeholder="https://www.linkedin.com/sales/search/..."
          className="h-8 text-xs font-mono flex-1"
        />
        <Button
          size="sm"
          className="h-8 shrink-0"
          onClick={handleSubmit}
          disabled={!isValid || isPending}
        >
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <><Plus className="size-3.5 mr-1" />Guardar</>}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ─── Saved URLs card ──────────────────────────────────────────────────────────

function SavedUrlsCard({ initialUrls, allIndustries }: { initialUrls: SavedUrl[]; allIndustries: string[] }) {
  const [urls, setUrls] = useState<SavedUrl[]>(initialUrls)
  const [showAdd, setShowAdd] = useState(false)
  const [filterRep, setFilterRep] = useState("all")
  const [filterIndustry, setFilterIndustry] = useState("all")
  const [filterType, setFilterType] = useState("all")

  const filtered = useMemo(() => {
    return urls.filter((u) => {
      if (filterRep !== "all" && u.rep_name !== filterRep) return false
      if (filterIndustry !== "all" && u.industry !== filterIndustry) return false
      if (filterType !== "all" && u.url_type !== filterType) return false
      return true
    })
  }, [urls, filterRep, filterIndustry, filterType])

  function handleDelete(id: string) {
    setUrls((prev) => prev.filter((u) => u.id !== id))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Repositorio de URLs</CardTitle>
            <CardDescription>
              URLs de Company Search y People Search guardadas por SDR e industria.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setShowAdd((v) => !v)}
          >
            {showAdd ? "Cancelar" : <><Plus className="size-3.5 mr-1" />Agregar URL</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAdd && (
          <AddUrlForm allIndustries={allIndustries} onAdded={(newUrl) => {
            setUrls((prev) => [...prev, newUrl])
            setShowAdd(false)
          }} />
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={filterRep} onValueChange={(v) => { if (v) setFilterRep(v) }}>
            <SelectTrigger className="h-7 w-[110px] text-xs">
              <SelectValue placeholder="SDR" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos los SDR</SelectItem>
              {REPS.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterIndustry} onValueChange={(v) => { if (v) setFilterIndustry(v) }}>
            <SelectTrigger className="h-7 w-[160px] text-xs">
              <SelectValue placeholder="Industria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos los nichos</SelectItem>
              {allIndustries.map((i) => <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={(v) => { if (v) setFilterType(v) }}>
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos los tipos</SelectItem>
              <SelectItem value="company_search" className="text-xs">Company Search</SelectItem>
              <SelectItem value="people_search" className="text-xs">People Search</SelectItem>
            </SelectContent>
          </Select>

          {(filterRep !== "all" || filterIndustry !== "all" || filterType !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => { setFilterRep("all"); setFilterIndustry("all"); setFilterType("all") }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>

        {/* URL list */}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {urls.length === 0 ? "No hay URLs guardadas todavía." : "Ninguna URL coincide con los filtros."}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((u) => (
              <UrlRow key={u.id} url={u} onDelete={() => handleDelete(u.id)} />
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {filtered.length} URL{filtered.length !== 1 ? "s" : ""}
            {urls.length !== filtered.length ? ` de ${urls.length}` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

const STATUS_CFG = {
  ok:           { icon: CheckCircle2, cls: "text-green-600",  bg: "bg-green-50",  label: "OK" },
  low:          { icon: AlertTriangle, cls: "text-yellow-600", bg: "bg-yellow-50", label: "Pocos créditos" },
  out:          { icon: AlertCircle,   cls: "text-red-600",    bg: "bg-red-50",    label: "Sin créditos" },
  unconfigured: { icon: MinusCircle,   cls: "text-zinc-400",   bg: "bg-zinc-50",   label: "No configurado" },
  error:        { icon: XCircle,       cls: "text-red-600",    bg: "bg-red-50",    label: "Error" },
}

function ProviderRow({ p }: { p: ProviderStatus }) {
  const cfg = STATUS_CFG[p.status]
  const Icon = cfg.icon
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Icon className={`size-4 ${cfg.cls}`} />
        <span className="text-sm font-medium">{p.label}</span>
      </div>
      <div className="flex items-center gap-2">
        {p.credits != null && (
          <span className="text-xs text-muted-foreground">{p.credits.toLocaleString()} créditos</span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.cls}`}>
          {p.detail}
        </span>
      </div>
    </div>
  )
}

// ── Client list card ──────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://prospect-os-nine.vercel.app"

function ClientListCard({
  initialCompanies,
  initialExclude,
  initialExcludePrevious,
}: {
  initialCompanies: ClientCompany[]
  initialExclude: boolean
  initialExcludePrevious: boolean
}) {
  const [companies, setCompanies] = useState<ClientCompany[]>(initialCompanies)
  const [excludeClients, setExcludeClients] = useState(initialExclude)
  const [excludePrevious, setExcludePrevious] = useState(initialExcludePrevious)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  // Parse textarea: "Nombre" or "Nombre, linkedin_url" or "Nombre, linkedin_url, dominio.com"
  const [raw, setRaw] = useState(() =>
    initialCompanies
      .map((c) => {
        const parts = [c.company_name]
        if (c.linkedin_url) parts.push(c.linkedin_url)
        if (c.domain) parts.push(c.domain)
        return parts.join(", ")
      })
      .join("\n")
  )

  function parseRaw(text: string): { company_name: string; linkedin_url: string | null; domain: string | null }[] {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(",").map((p) => p.trim())
        const company_name = parts[0] ?? ""
        const second = parts[1] ?? ""
        const third = parts[2] ?? ""
        const linkedin_url = second.includes("linkedin.com/company/") ? second : null
        // domain: third field, or second if it doesn't look like a LinkedIn URL
        const rawDomain = third || (!second.includes("linkedin.com") && second ? second : "")
        const domain = rawDomain && /\.[a-z]{2,}/.test(rawDomain) ? rawDomain.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] : null
        return { company_name, linkedin_url, domain }
      })
      .filter((e) => e.company_name)
  }

  function handleSave() {
    setError("")
    const entries = parseRaw(raw)
    if (!entries.length) { setError("Ingresá al menos una empresa"); return }
    startTransition(async () => {
      await saveClientCompanies(entries)
      // Optimistic update
      setCompanies(entries.map((e, i) => ({ id: String(i), ...e, sales_nav_id: null, domain: e.domain ?? null })))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  function handleToggleExclude() {
    const next = !excludeClients
    setExcludeClients(next)
    startTransition(async () => {
      const { saveInboxConfig, getInboxConfig } = await import("../inbox/actions")
      const current = await getInboxConfig()
      await saveInboxConfig({ ...current, exclude_clients: next })
    })
  }

  function handleToggleExcludePrevious() {
    const next = !excludePrevious
    setExcludePrevious(next)
    startTransition(async () => {
      const { saveInboxConfig, getInboxConfig } = await import("../inbox/actions")
      const current = await getInboxConfig()
      await saveInboxConfig({ ...current, exclude_previous: next })
    })
  }

  function buildTriggerUrl() {
    const cb = encodeURIComponent(APP_URL)
    return `https://www.linkedin.com/sales/lists/people?prospectOS=create_client_list&_cb=${cb}`
  }

  const resolved = companies.filter((c) => c.sales_nav_id).length
  const total = companies.length
  // Companies the extension couldn't find (only meaningful once some ARE found)
  const notFound = companies.filter((c) => !c.sales_nav_id)
  const showNotFound = notFound.length > 0 && resolved > 0

  // Inline LinkedIn URL edits for unfound companies
  const [urlEdits, setUrlEdits] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  async function handleSaveUrl(company: ClientCompany) {
    const url = (urlEdits[company.id] ?? company.linkedin_url ?? "").trim() || null
    setSavingId(company.id)
    await updateClientCompanyLinkedinUrl(company.id, url)
    setCompanies((prev) =>
      prev.map((c) => (c.id === company.id ? { ...c, linkedin_url: url } : c))
    )
    // Also update raw textarea so it stays in sync
    setRaw((prev) => {
      const lines = prev.split("\n").map((line) => {
        const parts = line.split(",").map((p) => p.trim())
        if ((parts[0] ?? "") === company.company_name) {
          const newParts = [company.company_name]
          if (url) newParts.push(url)
          if (parts[2]) newParts.push(parts[2])
          return newParts.join(", ")
        }
        return line
      })
      return lines.join("\n")
    })
    setSavingId(null)
    setUrlEdits((prev) => { const next = { ...prev }; delete next[company.id]; return next })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4" /> Lista de clientes
            </CardTitle>
            <CardDescription>
              Empresas que ya son clientes. La extensión crea la lista en Sales Navigator y pueden excluirse de búsquedas futuras.
            </CardDescription>
          </div>
          {total > 0 && (
            <span className="text-xs text-muted-foreground shrink-0 pt-0.5">
              {resolved}/{total} en Sales Nav
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Empresas <span className="normal-case font-normal">(una por línea — LinkedIn URL y dominio son opcionales)</span>
          </label>
          <textarea
            rows={8}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"Ransa\nCencosud, https://www.linkedin.com/company/cencosud/, cencosud.com\nFalabella, https://www.linkedin.com/company/falabella/\nWalmex, , walmex.mx"}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono leading-relaxed resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Formato: <code className="bg-muted px-1 rounded">Nombre</code> o <code className="bg-muted px-1 rounded">Nombre, linkedin_url, dominio.com</code> — cada campo separado por coma
          </p>
        </div>

        {/* Company list preview */}
        {companies.length > 0 && (
          <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
            {companies.map((c, i) => (
              <div key={c.id ?? i} className="flex items-center gap-2 px-3 py-2">
                <span className="text-sm flex-1 truncate">{c.company_name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {c.linkedin_url && (
                    <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground">
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                  {c.sales_nav_id ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">En Sales Nav</span>
                  ) : c.linkedin_url ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">Con LinkedIn</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Solo nombre</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Not-found section — appears after extension has run (some found, some not) */}
        {showNotFound && (
          <div className="rounded-md border border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20 overflow-hidden">
            <div className="px-3 py-2 border-b border-amber-200 dark:border-amber-900 flex items-center gap-2">
              <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />
              <span className="text-xs font-medium text-amber-800 dark:text-amber-300 flex-1">
                No encontradas en Sales Nav ({notFound.length})
              </span>
              <span className="text-[10px] text-amber-700 dark:text-amber-400">
                Agregá la URL de LinkedIn para mejorar la búsqueda
              </span>
            </div>
            <div className="divide-y divide-amber-100 dark:divide-amber-900">
              {notFound.map((c) => {
                const currentUrl = urlEdits[c.id] ?? c.linkedin_url ?? ""
                const dirty = c.id in urlEdits && urlEdits[c.id] !== (c.linkedin_url ?? "")
                return (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="text-sm flex-1 min-w-0 truncate text-amber-900 dark:text-amber-200">
                      {c.company_name}
                    </span>
                    <input
                      type="url"
                      value={currentUrl}
                      onChange={(e) => setUrlEdits((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      placeholder="https://linkedin.com/company/..."
                      className="text-xs border border-amber-200 dark:border-amber-800 rounded px-2 py-1 w-60 bg-white dark:bg-amber-950/50 focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder:text-amber-400"
                    />
                    <button
                      onClick={() => handleSaveUrl(c)}
                      disabled={savingId === c.id || !dirty}
                      className={`text-[10px] px-2 py-1 rounded font-medium transition-colors ${
                        dirty
                          ? "bg-amber-600 text-white hover:bg-amber-700"
                          : "bg-amber-100 text-amber-400 dark:bg-amber-900 dark:text-amber-600 cursor-not-allowed"
                      }`}
                    >
                      {savingId === c.id ? "…" : "Guardar"}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-3 flex-wrap">
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
            Guardar lista
          </Button>
          {companies.length > 0 && (
            <>
              <a href={buildTriggerUrl()} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" type="button">
                  <ExternalLink className="mr-1.5 size-3.5" /> Crear en Sales Navigator
                </Button>
              </a>
              <Button size="sm" variant="outline" type="button" onClick={() => {
                const header = "Empresa,LinkedIn URL,Dominio,Sales Nav ID"
                const rows = companies.map((c) =>
                  [c.company_name, c.linkedin_url ?? "", c.domain ?? "", c.sales_nav_id ?? ""]
                    .map((v) => `"${v.replace(/"/g, '""')}"`)
                    .join(",")
                )
                const csv = [header, ...rows].join("\n")
                const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = "clientes.csv"
                a.click()
                URL.revokeObjectURL(url)
              }}>
                <Download className="mr-1.5 size-3.5" /> Exportar CSV
              </Button>
            </>
          )}
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs text-green-700">
              <CheckCircle2 className="size-3" /> Guardado
            </span>
          )}
        </div>

        {/* Exclusion toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Excluir de company search</p>
            <p className="text-xs text-muted-foreground">
              Las empresas de esta lista no se guardarán en búsquedas futuras
            </p>
          </div>
          <button
            role="switch"
            aria-checked={excludeClients}
            onClick={handleToggleExclude}
            disabled={isPending}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              excludeClients ? "bg-primary" : "bg-input"
            }`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg transform transition-transform ${excludeClients ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </div>

        {/* Toggle: exclude previous campaigns */}
        <div className="flex items-center justify-between gap-4 pt-3 border-t">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Excluir empresas de campañas anteriores</p>
            <p className="text-xs text-muted-foreground">
              Si una empresa ya fue scraped en otra campaña, no se vuelve a agregar
            </p>
          </div>
          <button
            role="switch"
            aria-checked={excludePrevious}
            onClick={handleToggleExcludePrevious}
            disabled={isPending}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              excludePrevious ? "bg-primary" : "bg-input"
            }`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg transform transition-transform ${excludePrevious ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Toggle helper ────────────────────────────────────────────────────────────

function Toggle({ checked, onToggle, disabled }: { checked: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${checked ? "bg-primary" : "bg-input"}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg transform transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  )
}

// ─── NumInput helper ──────────────────────────────────────────────────────────

function NumInput({ value, onChange, min, max, label }: { value: number; onChange: (v: number) => void; min: number; max: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground w-40 shrink-0">{label}</label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value)
          if (!isNaN(n) && n >= min && n <= max) onChange(n)
        }}
        className="h-7 w-20 text-sm text-right"
      />
    </div>
  )
}

// ─── LinkedinSequenceCard ─────────────────────────────────────────────────────

function LinkedinSequenceCard({ initialConfig }: { initialConfig: LinkedinSequenceConfig | null }) {
  const init = initialConfig ?? DEFAULT_LINKEDIN_CONFIG
  const [cfg, setCfg] = useState<LinkedinSequenceConfig>(init)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function update(partial: Partial<LinkedinSequenceConfig>) {
    setCfg((c) => ({ ...c, ...partial }))
  }

  function handleSave() {
    startTransition(async () => {
      const current = await getInboxConfig()
      await saveInboxConfig({ ...current, linkedin_sequence_config: cfg })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mensajes de LinkedIn</CardTitle>
        <CardDescription>
          Configuración para los mensajes de LinkedIn generados en Shortlist.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Numeric settings */}
        <div className="space-y-2.5">
          <NumInput label="Cantidad de mensajes" value={cfg.step_count} onChange={(v) => update({ step_count: v })} min={1} max={10} />
          <NumInput label="Caracteres paso 1 (conexión)" value={cfg.step1_chars} onChange={(v) => update({ step1_chars: v })} min={50} max={500} />
          {cfg.step_count > 1 && (
            <NumInput label="Caracteres follow-ups" value={cfg.followup_chars} onChange={(v) => update({ followup_chars: v })} min={50} max={500} />
          )}
        </div>

        {/* Prompt mode toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Instrucción por paso</p>
            <p className="text-xs text-muted-foreground">
              {cfg.prompt_mode === "per_step" ? "Instrucción distinta para cada paso" : "Una instrucción general para todos los pasos"}
            </p>
          </div>
          <Toggle checked={cfg.prompt_mode === "per_step"} onToggle={() => update({ prompt_mode: cfg.prompt_mode === "per_step" ? "general" : "per_step" })} />
        </div>

        {/* Prompt textarea(s) */}
        {cfg.prompt_mode === "general" ? (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Instrucción general</label>
            <textarea
              value={cfg.general_prompt}
              onChange={(e) => update({ general_prompt: e.target.value })}
              rows={4}
              placeholder="ej: Tono conversacional, sin buzzwords. Siempre mencioná algo concreto del perfil del prospecto. Nunca uses 'solución' ni 'sinergias'."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Instrucciones por paso</label>
            {Array.from({ length: cfg.step_count }, (_, i) => {
              const stepNum = String(i + 1)
              const isFirst = i === 0
              return (
                <div key={stepNum} className="flex gap-3 items-start">
                  <span className="text-xs font-medium text-muted-foreground mt-2 w-14 shrink-0">
                    Paso {stepNum}{isFirst ? " (conexión)" : ""}
                  </span>
                  <textarea
                    value={cfg.step_prompts[stepNum] ?? ""}
                    onChange={(e) => update({ step_prompts: { ...cfg.step_prompts, [stepNum]: e.target.value } })}
                    rows={2}
                    placeholder={isFirst ? "Solicitud de conexión breve y personalizada…" : "Follow-up paso " + stepNum + "…"}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
                  />
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
            Guardar
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs text-green-700">
              <CheckCircle2 className="size-3" /> Guardado
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── EmailSequenceCard ────────────────────────────────────────────────────────

function EmailSequenceCard({ initialConfig }: { initialConfig: EmailSequenceConfig | null }) {
  const init = initialConfig ?? DEFAULT_EMAIL_CONFIG
  const [cfg, setCfg] = useState<EmailSequenceConfig>(init)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function update(partial: Partial<EmailSequenceConfig>) {
    setCfg((c) => ({ ...c, ...partial }))
  }

  function handleSave() {
    startTransition(async () => {
      const current = await getInboxConfig()
      await saveInboxConfig({ ...current, email_sequence_config: cfg })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cold Emails</CardTitle>
        <CardDescription>
          Configuración para la secuencia de emails generada en Shortlist.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Numeric settings */}
        <div className="space-y-2.5">
          <NumInput label="Cantidad de pasos" value={cfg.step_count} onChange={(v) => update({ step_count: v })} min={1} max={10} />
        </div>

        {/* Prompt mode toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Instrucción por paso</p>
            <p className="text-xs text-muted-foreground">
              {cfg.prompt_mode === "per_step" ? "Instrucción distinta para cada paso" : "Una instrucción general para todos los pasos"}
            </p>
          </div>
          <Toggle checked={cfg.prompt_mode === "per_step"} onToggle={() => update({ prompt_mode: cfg.prompt_mode === "per_step" ? "general" : "per_step" })} />
        </div>

        {/* Prompt textarea(s) */}
        {cfg.prompt_mode === "general" ? (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Instrucción general</label>
            <textarea
              value={cfg.general_prompt}
              onChange={(e) => update({ general_prompt: e.target.value })}
              rows={4}
              placeholder="ej: Emails cortos y directos. Primer email enfocado en un pain concreto de la industria. Follow-ups con ángulos diferentes."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Instrucciones por paso</label>
            {Array.from({ length: cfg.step_count }, (_, i) => {
              const stepNum = String(i + 1)
              const isFirst = i === 0
              return (
                <div key={stepNum} className="flex gap-3 items-start">
                  <span className="text-xs font-medium text-muted-foreground mt-2 w-14 shrink-0">
                    Paso {stepNum}{isFirst ? " (email 1)" : ""}
                  </span>
                  <textarea
                    value={cfg.step_prompts[stepNum] ?? ""}
                    onChange={(e) => update({ step_prompts: { ...cfg.step_prompts, [stepNum]: e.target.value } })}
                    rows={2}
                    placeholder={isFirst ? "Primer contacto: hook + propuesta de valor…" : "Follow-up paso " + stepNum + "…"}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
                  />
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
            Guardar
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs text-green-700">
              <CheckCircle2 className="size-3" /> Guardado
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── InboxSettingsCard ────────────────────────────────────────────────────────

function InboxSettingsCard({ initialConfig }: { initialConfig: InboxConfig }) {
  const [productContext, setProductContext] = useState(initialConfig.product_context ?? "")
  const [calendlyLink, setCalendlyLink] = useState(initialConfig.calendly_link ?? "")
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function handleSave() {
    startTransition(async () => {
      const current = await getInboxConfig()
      await saveInboxConfig({ ...current, product_context: productContext || null, calendly_link: calendlyLink || null })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Inbox IA</CardTitle>
        <CardDescription>
          Contexto del producto y link de Calendly que usa la IA para generar borradores de respuesta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Link de Calendly</label>
          <Input
            value={calendlyLink}
            onChange={(e) => setCalendlyLink(e.target.value)}
            placeholder="https://calendly.com/tu-link"
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contexto del producto</label>
          <textarea
            value={productContext}
            onChange={(e) => setProductContext(e.target.value)}
            rows={10}
            placeholder="Describí las features del producto, casos de uso por industria, y los pain points que resuelve. La IA usará este texto para generar secuencias y respuestas personalizadas."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Incluí features por industria, objeciones comunes y cómo responderlas, y el tono de voz del equipo.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
            Guardar
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs text-green-700">
              <CheckCircle2 className="size-3" /> Guardado
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function SettingsClient({ savedUrls, providerStatus: initialProviderStatus, providerUsage, inboxConfig, campaignIndustries, clientCompanies, tenantApiKeys, tenantReps: initialReps, tenantNiches, icpRules: initialIcpRules, osScoreRules: initialOsScoreRules, osScore2Rules: initialOsScore2Rules }: {
  savedUrls: SavedUrl[]
  providerStatus: ProviderStatus[]
  providerUsage: ProviderUsage[]
  inboxConfig: InboxConfig
  campaignIndustries: string[]
  clientCompanies: ClientCompany[]
  tenantApiKeys: TenantApiKeys
  tenantReps: string[]
  tenantNiches: string[]
  icpRules: IcpRule[]
  osScoreRules: OsScoreRule[]
  osScore2Rules: OsScoreRule[]
}) {
  const allIndustries = useMemo(() => {
    const merged = [...new Set([...tenantNiches, ...campaignIndustries])]
    return merged.sort()
  }, [tenantNiches, campaignIndustries])
  const [providerStatus, setProviderStatus] = useState<ProviderStatus[]>(initialProviderStatus)
  const [refreshing, startRefresh] = useTransition()

  function handleRefreshProviders() {
    startRefresh(async () => {
      const fresh = await getProviderStatus()
      setProviderStatus(fresh)
    })
  }

  const checklistItems = [
    { label: "Reps", ok: initialReps.length > 0 },
    { label: "Nichos", ok: tenantNiches.length > 0 },
    { label: "Lista de clientes", ok: clientCompanies.length > 0 },
    { label: "Extensión de Chrome", ok: false, manual: true },
    { label: "ICP rules", ok: initialIcpRules.length > 0 },
    { label: "OS Score", ok: initialOsScoreRules.length > 0 },
    { label: "Contexto del producto", ok: !!(inboxConfig.product_context?.trim()) },
    { label: "API Keys", ok: !!(tenantApiKeys.apollo_api_key) },
    { label: "Calendly", ok: !!(inboxConfig.calendly_link?.trim()) },
  ]
  const doneCount = checklistItems.filter((i) => i.ok).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Configuración por organización.</p>
      </div>

      {/* ── Checklist de onboarding ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Setup</CardTitle>
            <span className="text-sm text-muted-foreground tabular-nums">{doneCount}/{checklistItems.length} configurados</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {checklistItems.map((item) => (
              <div key={item.label} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${item.ok ? "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300" : "bg-muted/50 text-muted-foreground"}`}>
                {item.ok
                  ? <CheckCircle2 className="size-3.5 shrink-0 text-green-600" />
                  : item.manual
                    ? <AlertCircle className="size-3.5 shrink-0 text-amber-500" />
                    : <MinusCircle className="size-3.5 shrink-0" />
                }
                <span className="text-xs font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Sección 1: Listas de prospección ── */}
      <SectionHeader title="Listas de prospección" subtitle="Setup inicial para poder buscar y organizar prospectos." />
      <RepsCard initialReps={initialReps} />
      <NichosCard initialNiches={tenantNiches} />
      <ClientListCard
        initialCompanies={clientCompanies}
        initialExclude={inboxConfig.exclude_clients ?? false}
        initialExcludePrevious={inboxConfig.exclude_previous ?? false}
      />
      <SavedUrlsCard initialUrls={savedUrls} allIndustries={allIndustries} />
      <ChromeExtensionCard />

      {/* ── Sección 2: Enriquecimiento ── */}
      <SectionHeader title="Enriquecimiento" subtitle="Configurá cómo se clasifican y puntúan los prospectos." />
      <IcpRulesCard initialRules={initialIcpRules} />
      <OsScoreRulesCard title="OS Score" description="Segmentos por job title para categorización primaria." initialRules={initialOsScoreRules} dimension={1} />
      <OsScoreRulesCard title="OS Score 2" description="Segunda dimensión de categorización (opcional)." initialRules={initialOsScore2Rules} dimension={2} />
      <InboxSettingsCard initialConfig={inboxConfig} />
      <TenantApiKeysCard initialKeys={tenantApiKeys} />

      {/* ── Sección 3: Integraciones y secuencias ── */}
      <SectionHeader title="Integraciones y secuencias" subtitle="Configuraciones avanzadas de distribución y automatización." />
      <HubspotSyncCard />
      <EmailSequenceCard initialConfig={inboxConfig.email_sequence_config ?? null} />
      <LinkedinSequenceCard initialConfig={inboxConfig.linkedin_sequence_config ?? null} />

      {/* ── Monitoreo ── */}
      <SectionHeader title="Monitoreo" subtitle="Estado de créditos y consumo por servicio de enriquecimiento." />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Estado de providers</CardTitle>
            <CardDescription>Créditos disponibles por servicio.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefreshProviders} disabled={refreshing}>
            {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : <Activity className="size-3.5" />}
            <span className="ml-1.5">{refreshing ? "Actualizando…" : "Actualizar"}</span>
          </Button>
        </CardHeader>
        <CardContent className="divide-y">
          {providerStatus.map((p) => <ProviderRow key={p.name} p={p} />)}
        </CardContent>
      </Card>

      {providerUsage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4" /> Consumo por provider
            </CardTitle>
            <CardDescription>Emails encontrados exitosamente por cada servicio.</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="pb-2 text-left font-medium">Provider</th>
                  <th className="pb-2 text-right font-medium">Hoy</th>
                  <th className="pb-2 text-right font-medium">7 días</th>
                  <th className="pb-2 text-right font-medium">Este mes</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {providerUsage.map((u) => (
                  <tr key={u.provider}>
                    <td className="py-2 font-medium">{u.label}</td>
                    <td className="py-2 text-right tabular-nums">{u.today || "—"}</td>
                    <td className="py-2 text-right tabular-nums">{u.week || "—"}</td>
                    <td className="py-2 text-right tabular-nums">{u.month || "—"}</td>
                    <td className="py-2 text-right tabular-nums font-medium">{u.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="pt-2 border-t">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  )
}

// ── Reps card ─────────────────────────────────────────────────────────────────

function RepsCard({ initialReps }: { initialReps: string[] }) {
  const [reps, setReps] = useState<string[]>(initialReps)
  const [newRep, setNewRep] = useState("")
  const [adding, startAdd] = useTransition()
  const [deletingRep, setDeletingRep] = useState<string | null>(null)

  function handleAdd() {
    const name = newRep.trim()
    if (!name) return
    startAdd(async () => {
      await addTenantRep(name)
      setReps(await getTenantReps())
      setNewRep("")
    })
  }

  function handleDelete(name: string) {
    setDeletingRep(name)
    deleteTenantRep(name).then(async () => {
      setReps(await getTenantReps())
      setDeletingRep(null)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Users className="size-4" /> Reps</CardTitle>
        <CardDescription>Miembros del equipo de ventas. Cada rep tiene sus propias campañas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {reps.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {reps.map((rep) => (
              <div key={rep} className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-sm">
                <span>{rep}</span>
                <button
                  onClick={() => handleDelete(rep)}
                  disabled={deletingRep === rep}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  {deletingRep === rep ? <Loader2 className="size-3 animate-spin" /> : <XCircle className="size-3.5" />}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No hay reps configurados todavía.</p>
        )}
        <div className="flex gap-2">
          <Input
            value={newRep}
            onChange={(e) => setNewRep(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
            placeholder="Nombre del rep"
            className="text-sm max-w-xs"
          />
          <Button size="sm" onClick={handleAdd} disabled={adding || !newRep.trim()}>
            {adding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            <span className="ml-1">Agregar</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Niches card ───────────────────────────────────────────────────────────────

function NichosCard({ initialNiches }: { initialNiches: string[] }) {
  const [niches, setNiches] = useState<string[]>(initialNiches)
  const [newNiche, setNewNiche] = useState("")
  const [adding, startAdd] = useTransition()
  const [deleting, setDeleting] = useState<string | null>(null)

  function handleAdd() {
    const name = newNiche.trim()
    if (!name) return
    startAdd(async () => {
      await addTenantNiche(name)
      const { getTenantNiches } = await import("./actions")
      setNiches(await getTenantNiches())
      setNewNiche("")
    })
  }

  function handleDelete(name: string) {
    setDeleting(name)
    deleteTenantNiche(name).then(async () => {
      const { getTenantNiches } = await import("./actions")
      setNiches(await getTenantNiches())
      setDeleting(null)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Users className="size-4" /> Nichos</CardTitle>
        <CardDescription>Segmentos de mercado o industrias que prospectás. Reemplaza la lista de industrias fija.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {niches.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {niches.map((n) => (
              <div key={n} className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-sm">
                <span>{n}</span>
                <button
                  onClick={() => handleDelete(n)}
                  disabled={deleting === n}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  {deleting === n ? <Loader2 className="size-3 animate-spin" /> : <XCircle className="size-3.5" />}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No hay nichos configurados todavía.</p>
        )}
        <div className="flex gap-2">
          <Input
            value={newNiche}
            onChange={(e) => setNewNiche(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
            placeholder="Ej: Retail, SaaS, Manufactura"
            className="text-sm max-w-xs"
          />
          <Button size="sm" onClick={handleAdd} disabled={adding || !newNiche.trim()}>
            {adding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            <span className="ml-1">Agregar</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── ICP rules card ────────────────────────────────────────────────────────────

function IcpRulesCard({ initialRules }: { initialRules: IcpRule[] }) {
  const [rules, setRules] = useState<Omit<IcpRule, "id">[]>(
    initialRules.map(({ label, score, keywords, priority }) => ({ label, score, keywords, priority }))
  )
  const [saving, startSave] = useTransition()
  const [saved, setSaved] = useState(false)

  function addRow() {
    setRules((prev) => [...prev, { label: "", score: 5, keywords: [], priority: prev.length }])
  }

  function updateRow(i: number, field: keyof Omit<IcpRule, "id">, value: string | number | string[]) {
    setRules((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  function removeRow(i: number) {
    setRules((prev) => prev.filter((_, idx) => idx !== i))
  }

  function handleSave() {
    startSave(async () => {
      await saveIcpRules(rules)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">ICP Rules</CardTitle>
        <CardDescription>Niveles de seniority con su score. El primer match gana.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rules.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay reglas configuradas. Agregá la primera.</p>
        )}
        {rules.map((rule, i) => (
          <div key={i} className="flex gap-2 items-start">
            <Input
              value={rule.label}
              onChange={(e) => updateRow(i, "label", e.target.value)}
              placeholder="Ej: C-Level / VP"
              className="text-sm flex-1 min-w-0"
            />
            <select
              value={rule.score}
              onChange={(e) => updateRow(i, "score", Number(e.target.value))}
              className="text-sm border border-input rounded-md px-2 py-1.5 bg-background w-20 shrink-0"
            >
              <option value={10}>10</option>
              <option value={5}>5</option>
              <option value={0}>0</option>
            </select>
            <Input
              value={rule.keywords.join(", ")}
              onChange={(e) => updateRow(i, "keywords", e.target.value.split(",").map((k) => k.trim()).filter(Boolean))}
              placeholder="Keywords separadas por coma"
              className="text-sm flex-[2] min-w-0"
            />
            <button onClick={() => removeRow(i)} className="text-muted-foreground hover:text-destructive mt-1.5 shrink-0">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="size-3.5 mr-1" /> Agregar nivel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null}
            Guardar
          </Button>
          {saved && <span className="inline-flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="size-3" /> Guardado</span>}
        </div>
      </CardContent>
    </Card>
  )
}

// ── OS Score rules card ───────────────────────────────────────────────────────

function OsScoreRulesCard({ title, description, initialRules, dimension }: {
  title: string
  description: string
  initialRules: OsScoreRule[]
  dimension: 1 | 2
}) {
  const [rules, setRules] = useState<Omit<OsScoreRule, "id">[]>(
    initialRules.map(({ segment, keywords, priority }) => ({ segment, keywords, priority }))
  )
  const [saving, startSave] = useTransition()
  const [saved, setSaved] = useState(false)

  function addRow() {
    setRules((prev) => [...prev, { segment: "", keywords: [], priority: prev.length }])
  }

  function updateRow(i: number, field: "segment" | "keywords", value: string | string[]) {
    setRules((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  function removeRow(i: number) {
    setRules((prev) => prev.filter((_, idx) => idx !== i))
  }

  function handleSave() {
    startSave(async () => {
      await saveOsScoreRules(rules, dimension)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rules.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay segmentos configurados.</p>
        )}
        {rules.map((rule, i) => (
          <div key={i} className="flex gap-2 items-start">
            <Input
              value={rule.segment}
              onChange={(e) => updateRow(i, "segment", e.target.value)}
              placeholder="Ej: Helpdesk"
              className="text-sm w-40 shrink-0"
            />
            <Input
              value={rule.keywords.join(", ")}
              onChange={(e) => updateRow(i, "keywords", e.target.value.split(",").map((k) => k.trim()).filter(Boolean))}
              placeholder="Keywords separadas por coma"
              className="text-sm flex-1 min-w-0"
            />
            <button onClick={() => removeRow(i)} className="text-muted-foreground hover:text-destructive mt-1.5 shrink-0">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="size-3.5 mr-1" /> Agregar segmento
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null}
            Guardar
          </Button>
          {saved && <span className="inline-flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="size-3" /> Guardado</span>}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Chrome extension card ─────────────────────────────────────────────────────

function ChromeExtensionCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Extensión de Chrome</CardTitle>
          <CardDescription>Descargá los archivos e instalá la extensión en modo desarrollador.</CardDescription>
        </div>
        <a
          href="https://github.com/fedeannd-lgtm/ProspectOS/releases/tag/V1.0.0"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm">
            <Download className="size-3.5 mr-1.5" />
            Descargar
          </Button>
        </a>
      </CardHeader>
    </Card>
  )
}

// ── Tenant API keys card ──────────────────────────────────────────────────────

const COLD_EMAIL_TOOLS = ["Smartlead", "HeyReach", "Instantly", "Lemlist", "Otro"]
const LINKEDIN_TOOLS = ["HeyReach", "Expandi", "LinkedHelper", "Dripify", "Otro"]

function ApiKeyField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-1.5">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "sk-..."}
          className="text-xs font-mono h-8 flex-1"
        />
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 text-muted-foreground" onClick={() => setShow((v) => !v)}>
          {show ? "🙈" : "👁"}
        </Button>
      </div>
    </div>
  )
}

function TenantApiKeysCard({ initialKeys }: { initialKeys: TenantApiKeys }) {
  const [keys, setKeys] = useState<TenantApiKeys>(initialKeys)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function update(field: keyof TenantApiKeys, value: string | null) {
    setKeys((k) => ({ ...k, [field]: value || null }))
  }

  function handleSave() {
    startTransition(async () => {
      await saveTenantApiKeys(keys)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">API Keys del workspace</CardTitle>
        <CardDescription>
          Claves de integración para este cliente. Se almacenan encriptadas y son independientes por workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        <div className="grid gap-3 sm:grid-cols-2">
          <ApiKeyField label="Anthropic" value={keys.anthropic_api_key ?? ""} onChange={(v) => update("anthropic_api_key", v)} placeholder="sk-ant-..." />
          <ApiKeyField label="Apollo" value={keys.apollo_api_key ?? ""} onChange={(v) => update("apollo_api_key", v)} />
          <ApiKeyField label="ZeroBounce" value={keys.zerobounce_api_key ?? ""} onChange={(v) => update("zerobounce_api_key", v)} />
          <ApiKeyField label="FindyMail" value={keys.findymail_api_key ?? ""} onChange={(v) => update("findymail_api_key", v)} />
          <ApiKeyField label="Prospeo" value={keys.prospeo_api_key ?? ""} onChange={(v) => update("prospeo_api_key", v)} />
          <ApiKeyField label="Datagma" value={keys.datagma_api_key ?? ""} onChange={(v) => update("datagma_api_key", v)} />
          <ApiKeyField label="HubSpot" value={keys.hubspot_api_key ?? ""} onChange={(v) => update("hubspot_api_key", v)} />
        </div>

        <div className="border-t pt-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Herramienta de cold email</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Herramienta</label>
              <Select value={keys.cold_email_tool ?? undefined} onValueChange={(v) => update("cold_email_tool", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {COLD_EMAIL_TOOLS.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <ApiKeyField label="API Key" value={keys.cold_email_api_key ?? ""} onChange={(v) => update("cold_email_api_key", v)} />
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Herramienta de LinkedIn</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Herramienta</label>
              <Select value={keys.linkedin_tool ?? undefined} onValueChange={(v) => update("linkedin_tool", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {LINKEDIN_TOOLS.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <ApiKeyField label="API Key" value={keys.linkedin_api_key ?? ""} onChange={(v) => update("linkedin_api_key", v)} />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
            Guardar
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs text-green-700">
              <CheckCircle2 className="size-3" /> Guardado
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── HubSpot sync card ─────────────────────────────────────────────────────────

function HubspotSyncCard() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ updated: number; error?: string } | null>(null)

  function handleSync() {
    setResult(null)
    startTransition(async () => {
      const res = await syncHubspotDeals()
      setResult(res)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="size-4" /> HubSpot — Sincronizar reuniones
        </CardTitle>
        <CardDescription>
          Sincroniza el estado de reuniones desde HubSpot contra toda la base de prospectos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <Button onClick={handleSync} disabled={isPending} size="sm">
          {isPending ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
          {isPending ? "Sincronizando…" : "Sincronizar ahora"}
        </Button>
        {result && !result.error && (
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-green-500 shrink-0" />
            {result.updated > 0
              ? `${result.updated} prospecto${result.updated !== 1 ? "s" : ""} actualizado${result.updated !== 1 ? "s" : ""}`
              : "Sin cambios (todos ya estaban al día)"}
          </p>
        )}
        {result?.error && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <XCircle className="size-4 shrink-0" />
            {result.error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
