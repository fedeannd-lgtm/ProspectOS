"use client"

import { useState, useTransition } from "react"
import { Loader2, Star, Trash2, Copy, Check, ExternalLink, Mail, Linkedin, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import type { ShortlistedProspect } from "./actions"
import { removeFromShortlist, generateAndSaveSequences } from "./actions"
import type { EmailStep, LinkedinStep, Sequences } from "@/lib/ai-sequences"

// ── helpers ────────────────────────────────────────────────────────────────────

function prospectLabel(p: ShortlistedProspect): string {
  return p.full_name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Sin nombre"
}

const ICP_COLORS: Record<string, string> = {
  Experience:    "bg-blue-50 text-blue-700",
  Helpdesk:      "bg-emerald-50 text-emerald-700",
  Onboarding:    "bg-amber-50 text-amber-700",
  Communication: "bg-violet-50 text-violet-700",
  Genérico:      "bg-zinc-100 text-zinc-600",
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

function EmailStepCard({ step }: { step: EmailStep }) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Paso {step.step}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Asunto</p>
          <CopyButton text={step.subject} />
        </div>
        <p className="text-sm font-medium">{step.subject}</p>
      </div>
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Cuerpo</p>
          <CopyButton text={step.body} />
        </div>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{step.body}</p>
      </div>
    </div>
  )
}

// ── linkedin step card ─────────────────────────────────────────────────────────

function LinkedinStepCard({ step }: { step: LinkedinStep }) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Paso {step.step}
        </span>
        <CopyButton text={step.message} />
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{step.message}</p>
      <p className="text-xs text-muted-foreground">{step.message.length} caracteres</p>
    </div>
  )
}

// ── prospect card (left panel) ─────────────────────────────────────────────────

function ProspectCard({
  prospect,
  selected,
  onClick,
}: {
  prospect: ShortlistedProspect
  selected: boolean
  onClick: () => void
}) {
  const icpCls = prospect.icp_category ? (ICP_COLORS[prospect.icp_category] ?? "bg-zinc-100 text-zinc-600") : ""
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-3 transition-colors space-y-1 ${
        selected ? "bg-muted border-foreground/20" : "hover:bg-muted/50"
      }`}
    >
      <p className="text-sm font-medium truncate">{prospectLabel(prospect)}</p>
      <p className="text-xs text-muted-foreground truncate">{prospect.job_title}</p>
      <p className="text-xs text-muted-foreground truncate">{prospect.company_name}</p>
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        {prospect.icp_category && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${icpCls}`}>
            {prospect.icp_category}
          </span>
        )}
        {prospect.icp_score != null && (
          <span className="text-[10px] text-muted-foreground">ICP {prospect.icp_score}</span>
        )}
        {prospect.latest_sequences && (
          <span className="text-[10px] text-green-600 flex items-center gap-0.5">
            <Check className="size-2.5" /> Generado
          </span>
        )}
      </div>
    </button>
  )
}

// ── main component ─────────────────────────────────────────────────────────────

export function ShortlistClient({ initialProspects }: { initialProspects: ShortlistedProspect[] }) {
  const [prospects, setProspects] = useState<ShortlistedProspect[]>(initialProspects)
  const [selected, setSelected] = useState<ShortlistedProspect | null>(initialProspects[0] ?? null)
  const [research, setResearch] = useState<string>(selected?.latest_sequences?.research_context ?? "")
  const [sequences, setSequences] = useState<Sequences | null>(
    selected?.latest_sequences?.sequences ?? null
  )
  const [generating, startGenerate] = useTransition()
  const [removing, startRemove] = useTransition()
  const [error, setError] = useState("")

  function handleSelect(p: ShortlistedProspect) {
    setSelected(p)
    setResearch(p.latest_sequences?.research_context ?? "")
    setSequences(p.latest_sequences?.sequences ?? null)
    setError("")
  }

  function handleRemove() {
    if (!selected) return
    startRemove(async () => {
      await removeFromShortlist(selected.id)
      const updated = prospects.filter((p) => p.id !== selected.id)
      setProspects(updated)
      setSelected(updated[0] ?? null)
      setResearch(updated[0]?.latest_sequences?.research_context ?? "")
      setSequences(updated[0]?.latest_sequences?.sequences ?? null)
    })
  }

  function handleGenerate() {
    if (!selected) return
    setError("")
    startGenerate(async () => {
      const result = await generateAndSaveSequences(selected.id, research)
      if ("error" in result) {
        setError(result.error)
        return
      }
      setSequences(result.sequences)
      // Update prospect in list to mark as generated
      setProspects((prev) =>
        prev.map((p) =>
          p.id === selected.id
            ? { ...p, latest_sequences: { id: "", research_context: research, sequences: result.sequences, generated_at: new Date().toISOString() } }
            : p
        )
      )
    })
  }

  const icpCls = selected?.icp_category
    ? (ICP_COLORS[selected.icp_category] ?? "bg-zinc-100 text-zinc-600")
    : ""

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-3rem)] -m-6">
      {/* Top bar */}
      <div className="border-b px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <Star className="size-4 text-amber-500" />
          <h1 className="text-lg font-semibold">Shortlist</h1>
          {prospects.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {prospects.length}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — prospect list */}
        <div className="w-72 shrink-0 border-r flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {prospects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Star className="size-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Sin prospectos en Shortlist</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Seleccioná prospectos en Enrichment y agregálos con el botón Shortlist
                </p>
              </div>
            ) : (
              prospects.map((p) => (
                <ProspectCard
                  key={p.id}
                  prospect={p}
                  selected={selected?.id === p.id}
                  onClick={() => handleSelect(p)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right panel — detail + sequences */}
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Seleccioná un prospecto para generar secuencias
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Prospect header */}
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
                  {selected.icp_score != null && (
                    <span className="text-xs text-muted-foreground">ICP {selected.icp_score}</span>
                  )}
                  {selected.os_score != null && (
                    <span className="text-xs text-muted-foreground">OS {selected.os_score}</span>
                  )}
                  {selected.accounts?.industry && (
                    <Badge variant="outline" className="text-xs font-normal">{selected.accounts.industry}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 pt-1">
                  {selected.linkedin_url && (
                    <a href={selected.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <Linkedin className="size-3" /> LinkedIn
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                  {selected.email && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="size-3" /> {selected.email}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive shrink-0"
                onClick={handleRemove}
                disabled={removing}
              >
                {removing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                <span className="ml-1.5">Quitar</span>
              </Button>
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
                placeholder="Ej: Trabaja en empresa de retail con 500+ empleados. Mencionó en LinkedIn que están expandiendo el equipo de CS. Buscan mejorar la retención..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
              />
              <div className="flex items-center gap-3">
                <Button onClick={handleGenerate} disabled={generating}>
                  {generating ? (
                    <><Loader2 className="mr-2 size-4 animate-spin" /> Generando…</>
                  ) : sequences ? (
                    <><RefreshCw className="mr-2 size-4" /> Regenerar secuencias</>
                  ) : (
                    <><Star className="mr-2 size-4" /> Generar secuencias</>
                  )}
                </Button>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            </div>

            {/* Sequences */}
            {sequences && (
              <div className="space-y-4">
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-4">Secuencias generadas</h3>
                  <Tabs defaultValue="email">
                    <TabsList>
                      <TabsTrigger value="email" className="gap-1.5">
                        <Mail className="size-3.5" /> Email (5 pasos)
                      </TabsTrigger>
                      <TabsTrigger value="linkedin" className="gap-1.5">
                        <Linkedin className="size-3.5" /> LinkedIn (5 pasos)
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="email" className="space-y-3 mt-4">
                      {sequences.email.map((step) => (
                        <EmailStepCard key={step.step} step={step} />
                      ))}
                    </TabsContent>
                    <TabsContent value="linkedin" className="space-y-3 mt-4">
                      {sequences.linkedin.map((step) => (
                        <LinkedinStepCard key={step.step} step={step} />
                      ))}
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
