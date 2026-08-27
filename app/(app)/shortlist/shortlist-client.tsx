"use client"

import { useState, useTransition } from "react"
import { Loader2, Star, Trash2, Copy, Check, ExternalLink, Mail, RefreshCw, Sparkles, Plus, Send, Phone, Type } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { ShortlistedProspect, ManualProspectInput } from "./actions"
import { removeFromShortlist, generateAndSaveSequences, updateShortlistStatus, addManualProspect, saveEditedSequences, pushToSmartlead, fetchSmartleadCampaigns, enrichEmailForShortlist, enrichPhoneForShortlist, normalizeNameForShortlist } from "./actions"
import type { EmailStep, LinkedinStep, Sequences } from "@/lib/ai-sequences"

// ── constants ──────────────────────────────────────────────────────────────────

const STATUSES = ["Pendiente", "Enviado", "Reunión Agendada", "Sin respuesta"] as const
type ShortlistStatus = typeof STATUSES[number]

const STATUS_CFG: Record<ShortlistStatus, { cls: string }> = {
  "Pendiente":          { cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" },
  "Enviado":            { cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  "Reunión Agendada":   { cls: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  "Sin respuesta":      { cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
}

const ICP_COLORS: Record<string, string> = {
  Experience:    "bg-blue-50 text-blue-700",
  Helpdesk:      "bg-emerald-50 text-emerald-700",
  Onboarding:    "bg-amber-50 text-amber-700",
  Communication: "bg-violet-50 text-violet-700",
  "Genérico":    "bg-zinc-100 text-zinc-600",
}

// ── helpers ────────────────────────────────────────────────────────────────────

function prospectLabel(p: ShortlistedProspect): string {
  return (p.full_name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()) || "Sin nombre"
}

// ── copy button ────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
    </button>
  )
}

// ── email step card ────────────────────────────────────────────────────────────

function EmailStepCard({ step, onChange }: { step: EmailStep; onChange: (updated: EmailStep) => void }) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paso {step.step}</span>
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Asunto</p>
          <CopyButton text={step.subject} />
        </div>
        <input
          value={step.subject}
          onChange={(e) => onChange({ ...step, subject: e.target.value })}
          className="w-full text-sm font-medium bg-transparent border-0 border-b border-transparent hover:border-input focus:border-input focus:outline-none transition-colors py-0.5"
        />
      </div>
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Cuerpo</p>
          <CopyButton text={step.body} />
        </div>
        <textarea
          value={step.body}
          onChange={(e) => onChange({ ...step, body: e.target.value })}
          rows={Math.max(4, step.body.split("\n").length + 1)}
          className="w-full text-sm leading-relaxed bg-transparent border-0 border-b border-transparent hover:border-input focus:border-input focus:outline-none resize-none transition-colors py-0.5"
        />
      </div>
    </div>
  )
}

// ── linkedin step card ─────────────────────────────────────────────────────────

function LinkedinStepCard({ step, onChange }: { step: LinkedinStep; onChange: (updated: LinkedinStep) => void }) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paso {step.step}</span>
        <CopyButton text={step.message} />
      </div>
      <textarea
        value={step.message}
        onChange={(e) => onChange({ ...step, message: e.target.value })}
        rows={Math.max(3, step.message.split("\n").length + 1)}
        className="w-full text-sm leading-relaxed bg-transparent border-0 border-b border-transparent hover:border-input focus:border-input focus:outline-none resize-none transition-colors py-0.5"
      />
      <p className="text-xs text-muted-foreground">{step.message.length} caracteres</p>
    </div>
  )
}

// ── status badge / selector ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "Pendiente") as ShortlistStatus
  const cfg = STATUS_CFG[s] ?? STATUS_CFG["Pendiente"]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.cls}`}>
      {s}
    </span>
  )
}

// ── prospect card (left panel) ─────────────────────────────────────────────────

function ProspectCard({ prospect, selected, onClick }: { prospect: ShortlistedProspect; selected: boolean; onClick: () => void }) {
  const icpCls = prospect.icp_category ? (ICP_COLORS[prospect.icp_category] ?? "bg-zinc-100 text-zinc-600") : ""
  const rep = prospect.campaigns?.rep_name
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-3 transition-colors space-y-1.5 ${
        selected ? "bg-muted border-foreground/20" : "hover:bg-muted/50"
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-sm font-medium truncate">{prospectLabel(prospect)}</p>
        {rep && <span className="text-[10px] text-muted-foreground shrink-0 bg-muted rounded px-1 py-0.5">{rep}</span>}
      </div>
      <p className="text-xs text-muted-foreground truncate">{prospect.job_title}</p>
      <p className="text-xs text-muted-foreground truncate">{prospect.company_name}</p>
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        <StatusBadge status={prospect.shortlist_status} />
        {prospect.icp_category && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${icpCls}`}>
            {prospect.icp_category}
          </span>
        )}
        {prospect.latest_sequences && (
          <span className="text-[10px] text-green-600 flex items-center gap-0.5">
            <Check className="size-2.5" /> Sec.
          </span>
        )}
      </div>
    </button>
  )
}

// ── main component ─────────────────────────────────────────────────────────────

export function ShortlistClient({ initialProspects }: { initialProspects: ShortlistedProspect[] }) {
  const [prospects, setProspects] = useState<ShortlistedProspect[]>(initialProspects)
  const [repFilter, setRepFilter] = useState("all")
  const [weekFilter, setWeekFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selected, setSelected] = useState<ShortlistedProspect | null>(initialProspects[0] ?? null)
  const [research, setResearch] = useState(selected?.latest_sequences?.research_context ?? "")
  const [sequences, setSequences] = useState<Sequences | null>(selected?.latest_sequences?.sequences ?? null)
  const [generating, startGenerate] = useTransition()
  const [removing, startRemove] = useTransition()
  const [updatingStatus, startUpdateStatus] = useTransition()
  const [adding, startAdd] = useTransition()
  const [saving, startSave] = useTransition()
  const [savedOk, setSavedOk] = useState(false)
  const [enrichingEmail, startEnrichEmail] = useTransition()
  const [enrichingPhone, startEnrichPhone] = useTransition()
  const [normalizing, startNormalize] = useTransition()
  const [pushing, startPush] = useTransition()
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[] | null>(null)
  const [selectedCampaign, setSelectedCampaign] = useState("")
  const [pushResult, setPushResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [error, setError] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [addError, setAddError] = useState("")
  const emptyForm = (): ManualProspectInput => ({ full_name: "", job_title: "", company_name: "", company_domain: "", email: "", linkedin_url: "", phone: "", location: "", notes: "" })
  const [form, setForm] = useState<ManualProspectInput>(emptyForm)

  // Derived filter options
  const allReps = Array.from(new Set(prospects.map((p) => p.campaigns?.rep_name).filter(Boolean) as string[])).sort()
  const allWeeks = Array.from(new Set(prospects.map((p) => p.campaigns?.week_label).filter(Boolean) as string[])).sort().reverse()

  const filtered = prospects.filter((p) => {
    if (repFilter !== "all" && p.campaigns?.rep_name !== repFilter) return false
    if (weekFilter !== "all" && p.campaigns?.week_label !== weekFilter) return false
    if (statusFilter !== "all" && (p.shortlist_status ?? "Pendiente") !== statusFilter) return false
    return true
  })

  function handleSelect(p: ShortlistedProspect) {
    setSelected(p)
    setResearch(p.latest_sequences?.research_context ?? "")
    setSequences(p.latest_sequences?.sequences ?? null)
    setError("")
    setSavedOk(false)
    setPushResult(null)
  }

  function handleLoadCampaigns() {
    if (campaigns !== null) return
    fetchSmartleadCampaigns().then((list) => {
      setCampaigns(list)
      if (list.length > 0) setSelectedCampaign(list[0].id)
    })
  }

  function handlePush() {
    if (!selected || !selectedCampaign) return
    setPushResult(null)
    startPush(async () => {
      const result = await pushToSmartlead(selected.id, selectedCampaign)
      setPushResult(result)
      if (result.ok) {
        setProspects((prev) => prev.map((p) => p.id === selected.id ? { ...p, shortlist_status: "Enviado" } : p))
        setSelected((prev) => prev ? { ...prev, shortlist_status: "Enviado" } : prev)
      }
    })
  }

  function handleSequenceChange(updated: Sequences) {
    setSequences(updated)
    setSavedOk(false)
  }

  function handleSaveEdits() {
    if (!selected || !sequences) return
    startSave(async () => {
      await saveEditedSequences(selected.id, sequences)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 3000)
    })
  }

  function handleRemove() {
    if (!selected) return
    startRemove(async () => {
      await removeFromShortlist(selected.id)
      const updated = prospects.filter((p) => p.id !== selected.id)
      setProspects(updated)
      const next = filtered.find((p) => p.id !== selected.id) ?? null
      setSelected(next)
      setResearch(next?.latest_sequences?.research_context ?? "")
      setSequences(next?.latest_sequences?.sequences ?? null)
    })
  }

  function handleGenerate() {
    if (!selected) return
    setError("")
    startGenerate(async () => {
      const result = await generateAndSaveSequences(selected.id, research)
      if ("error" in result) { setError(result.error); return }
      setSequences(result.sequences)
      setProspects((prev) =>
        prev.map((p) =>
          p.id === selected.id
            ? { ...p, latest_sequences: { id: "", research_context: research, sequences: result.sequences, generated_at: new Date().toISOString() } }
            : p
        )
      )
    })
  }

  function handleAdd() {
    if (!form.full_name.trim()) { setAddError("El nombre es obligatorio"); return }
    if (!form.linkedin_url?.trim()) { setAddError("El LinkedIn URL es obligatorio"); return }
    setAddError("")
    startAdd(async () => {
      const result = await addManualProspect(form)
      if ("error" in result) { setAddError(result.error); return }
      // Build a minimal ShortlistedProspect so it appears immediately in the list
      const parts = form.full_name.trim().split(/\s+/)
      const newProspect: ShortlistedProspect = {
        id: result.id,
        first_name: parts[0] ?? null,
        last_name: parts.slice(1).join(" ") || null,
        full_name: form.full_name.trim(),
        job_title: form.job_title || null,
        company_name: form.company_name || null,
        company_domain: form.company_domain || null,
        email: form.email || null,
        linkedin_url: form.linkedin_url || null,
        phone: form.phone || null,
        location: form.location || null,
        highlights: form.notes || null,
        icp_score: null, icp_category: null, os_score: null, apollo_id: null,
        accounts: null, campaigns: null,
        shortlist_status: "Pendiente",
        latest_sequences: null,
      }
      setProspects((prev) => [newProspect, ...prev])
      setSelected(newProspect)
      setResearch("")
      setSequences(null)
      setForm(emptyForm())
      setAddOpen(false)
    })
  }

  function handleStatusChange(newStatus: string) {
    if (!selected) return
    startUpdateStatus(async () => {
      await updateShortlistStatus(selected.id, newStatus)
      setProspects((prev) => prev.map((p) => p.id === selected.id ? { ...p, shortlist_status: newStatus } : p))
      setSelected((prev) => prev ? { ...prev, shortlist_status: newStatus } : prev)
    })
  }

  function handleEnrichEmail() {
    if (!selected) return
    startEnrichEmail(async () => {
      const result = await enrichEmailForShortlist(selected.id)
      if (result.email) {
        setSelected((prev) => prev ? { ...prev, email: result.email } : prev)
        setProspects((prev) => prev.map((p) => p.id === selected.id ? { ...p, email: result.email } : p))
      }
    })
  }

  function handleEnrichPhone() {
    if (!selected) return
    startEnrichPhone(async () => {
      const phone = await enrichPhoneForShortlist(selected.id)
      if (phone) {
        setSelected((prev) => prev ? { ...prev, phone } : prev)
        setProspects((prev) => prev.map((p) => p.id === selected.id ? { ...p, phone } : p))
      }
    })
  }

  function handleNormalize() {
    if (!selected) return
    startNormalize(async () => {
      const result = await normalizeNameForShortlist(selected.id)
      if (result) {
        setSelected((prev) => prev ? { ...prev, ...result } : prev)
        setProspects((prev) => prev.map((p) => p.id === selected.id ? { ...p, ...result } : p))
      }
    })
  }

  const icpCls = selected?.icp_category ? (ICP_COLORS[selected.icp_category] ?? "bg-zinc-100 text-zinc-600") : ""

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-3rem)] -m-6">
      {/* Top bar */}
      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 mr-auto">
          <Star className="size-4 text-amber-500" />
          <h1 className="text-lg font-semibold">Shortlist</h1>
          {filtered.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {filtered.length}
            </span>
          )}
        </div>

        {/* Filters */}
        {allWeeks.length > 1 && (
          <select value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="all">Todas las semanas</option>
            {allWeeks.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        )}
        {allReps.length > 1 && (
          <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="all">Todos los SDR</option>
            {allReps.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <option value="all">Todos los estados</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-72 shrink-0 border-r flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b flex items-center justify-between shrink-0">
            <span className="text-xs font-medium text-muted-foreground">{filtered.length} prospecto{filtered.length !== 1 ? "s" : ""}</span>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => { setForm(emptyForm()); setAddError(""); setAddOpen(true) }}>
              <Plus className="size-3.5" /> Agregar
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Star className="size-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Sin prospectos en Shortlist</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Seleccioná prospectos en Enrichment y agregálos con el botón Shortlist
                </p>
              </div>
            ) : (
              filtered.map((p) => (
                <ProspectCard key={p.id} prospect={p} selected={selected?.id === p.id} onClick={() => handleSelect(p)} />
              ))
            )}
          </div>
        </div>

        {/* Right panel */}
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Seleccioná un prospecto para generar secuencias
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">{prospectLabel(selected)}</h2>
                <p className="text-sm text-muted-foreground">
                  {selected.job_title}{selected.company_name ? ` · ${selected.company_name}` : ""}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {selected.icp_category && (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${icpCls}`}>
                      {selected.icp_category}
                    </span>
                  )}
                  {selected.icp_score != null && <span className="text-xs text-muted-foreground">ICP {selected.icp_score}</span>}
                  {selected.os_score != null && <span className="text-xs text-muted-foreground">OS {selected.os_score}</span>}
                  {selected.accounts?.industry && <Badge variant="outline" className="text-xs font-normal">{selected.accounts.industry}</Badge>}
                  {selected.campaigns?.week_label && <Badge variant="outline" className="text-xs font-normal">{selected.campaigns.week_label}</Badge>}
                </div>
                <div className="flex items-center gap-3 pt-1">
                  {selected.linkedin_url && (
                    <a href={selected.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      LinkedIn <ExternalLink className="size-3" />
                    </a>
                  )}
                  {selected.apollo_id && (
                    <a href={`https://app.apollo.io/#/people/${selected.apollo_id}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-400 transition-colors">
                      Apollo <ExternalLink className="size-3" />
                    </a>
                  )}
                  {selected.email && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="size-3" /> {selected.email}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="sm" onClick={handleEnrichEmail} disabled={enrichingEmail}
                  title="Buscar email">
                  {enrichingEmail ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
                </Button>
                <Button variant="outline" size="sm" onClick={handleEnrichPhone} disabled={enrichingPhone}
                  title="Buscar teléfono">
                  {enrichingPhone ? <Loader2 className="size-3.5 animate-spin" /> : <Phone className="size-3.5" />}
                </Button>
                <Button variant="outline" size="sm" onClick={handleNormalize} disabled={normalizing}
                  title="Normalizar nombre">
                  {normalizing ? <Loader2 className="size-3.5 animate-spin" /> : <Type className="size-3.5" />}
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                  onClick={handleRemove} disabled={removing}>
                  {removing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  <span className="ml-1.5">Quitar</span>
                </Button>
              </div>
            </div>

            {/* Status selector */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Estado</p>
              <div className="flex items-center gap-2 flex-wrap">
                {STATUSES.map((s) => {
                  const active = (selected.shortlist_status ?? "Pendiente") === s
                  const cfg = STATUS_CFG[s]
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={updatingStatus}
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                        active
                          ? `${cfg.cls} border-transparent ring-2 ring-offset-1 ring-current`
                          : "bg-background text-muted-foreground border-input hover:bg-muted"
                      }`}
                    >
                      {updatingStatus && active ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Research context */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Research adicional</label>
              <p className="text-xs text-muted-foreground">
                Agregá notas sobre este prospecto: su situación actual, pain points detectados, contexto de LinkedIn, etc.
              </p>
              <textarea
                value={research}
                onChange={(e) => setResearch(e.target.value)}
                rows={5}
                placeholder="Ej: Trabaja en empresa de retail con 500+ empleados. Mencionó en LinkedIn que están expandiendo el equipo de CS..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
              />
              <div className="flex items-center gap-3">
                <Button onClick={handleGenerate} disabled={generating}>
                  {generating ? (
                    <><Loader2 className="mr-2 size-4 animate-spin" /> Generando…</>
                  ) : sequences ? (
                    <><RefreshCw className="mr-2 size-4" /> Regenerar secuencias</>
                  ) : (
                    <><Sparkles className="mr-2 size-4" /> Generar secuencias</>
                  )}
                </Button>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            </div>

            {/* Push to Smartlead */}
            {sequences && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Send className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Enviar a Smartlead</p>
                </div>
                {!selected.email && (
                  <p className="text-xs text-amber-600">Este prospecto no tiene email — no se puede enviar a Smartlead.</p>
                )}
                {selected.email && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={selectedCampaign}
                      onChange={(e) => setSelectedCampaign(e.target.value)}
                      onFocus={handleLoadCampaigns}
                      className="h-8 flex-1 min-w-0 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {campaigns === null && <option value="">Click para cargar campañas…</option>}
                      {campaigns?.length === 0 && <option value="">Sin campañas en Smartlead</option>}
                      {campaigns?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Button size="sm" onClick={handlePush} disabled={pushing || !selectedCampaign}>
                      {pushing ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Send className="mr-1.5 size-3.5" />}
                      Enviar
                    </Button>
                  </div>
                )}
                {pushResult?.ok && (
                  <p className="text-xs text-green-600 flex items-center gap-1"><Check className="size-3" /> Lead enviado correctamente</p>
                )}
                {pushResult?.error && (
                  <p className="text-xs text-destructive">{pushResult.error}</p>
                )}
              </div>
            )}

            {/* Sequences */}
            {sequences && (
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Secuencias generadas</h3>
                  <div className="flex items-center gap-2">
                    {savedOk && <span className="text-xs text-green-600 flex items-center gap-1"><Check className="size-3" /> Guardado</span>}
                    <Button size="sm" variant="outline" onClick={handleSaveEdits} disabled={saving}>
                      {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                      Guardar ediciones
                    </Button>
                  </div>
                </div>
                <Tabs defaultValue="email">
                  <TabsList>
                    <TabsTrigger value="email" className="gap-1.5">
                      <Mail className="size-3.5" /> Email (5 pasos)
                    </TabsTrigger>
                    <TabsTrigger value="linkedin">LinkedIn (5 pasos)</TabsTrigger>
                  </TabsList>
                  <TabsContent value="email" className="space-y-3 mt-4">
                    {sequences.email.map((step, i) => (
                      <EmailStepCard
                        key={step.step}
                        step={step}
                        onChange={(updated) => handleSequenceChange({
                          ...sequences,
                          email: sequences.email.map((s, j) => j === i ? updated : s),
                        })}
                      />
                    ))}
                  </TabsContent>
                  <TabsContent value="linkedin" className="space-y-3 mt-4">
                    {sequences.linkedin.map((step, i) => (
                      <LinkedinStepCard
                        key={step.step}
                        step={step}
                        onChange={(updated) => handleSequenceChange({
                          ...sequences,
                          linkedin: sequences.linkedin.map((s, j) => j === i ? updated : s),
                        })}
                      />
                    ))}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add prospect dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar prospecto manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nombre completo *</label>
              <Input placeholder="María García" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Cargo</label>
                <Input placeholder="HR Manager" value={form.job_title} onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Empresa</label>
                <Input placeholder="Acme Corp" value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Dominio</label>
                <Input placeholder="acme.com" value={form.company_domain} onChange={(e) => setForm((f) => ({ ...f, company_domain: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input placeholder="maria@acme.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">LinkedIn URL *</label>
              <Input placeholder="https://linkedin.com/in/..." value={form.linkedin_url} onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Teléfono</label>
                <Input placeholder="+54 9 11 ..." value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Ubicación</label>
                <Input placeholder="Buenos Aires" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Notas</label>
              <textarea
                rows={3}
                placeholder="Contexto adicional sobre este prospecto..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
              />
            </div>
            {addError && <p className="text-sm text-destructive">{addError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setAddOpen(false)} disabled={adding}>Cancelar</Button>
              <Button size="sm" onClick={handleAdd} disabled={adding}>
                {adding ? <><Loader2 className="mr-1.5 size-3.5 animate-spin" /> Guardando…</> : "Agregar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
