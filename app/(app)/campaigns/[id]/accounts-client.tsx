"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Pencil, Trash2, Check, X, ExternalLink, Building2, Code2, Copy, CheckCheck, RefreshCw, Search, List, Users, CheckCircle2, Circle, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateAccount, deleteAccount, saveCampaignList, createAccountList } from "./actions"

type Account = {
  id: string
  company_name: string
  domain: string | null
  sales_nav_id: string | null
  headcount_range: string | null
  status: string
  created_at: string
}

type Campaign = {
  id: string
  week_label: string
  rep_name: string
  industry: string
  status: string
  accounts_found: number
  prospects_found: number
  list_id: string | null
  list_name: string | null
}

function CampaignFlow({ campaign }: { campaign: Campaign }) {
  const steps = [
    {
      id: 1,
      label: "Campaña creada",
      description: "Rep, industria y semana configurados",
      icon: CheckCircle2,
      done: true,
      href: null,
    },
    {
      id: 2,
      label: "Company Search",
      description: campaign.accounts_found > 0
        ? `${campaign.accounts_found} empresas scrapeadas`
        : "Scrapear empresas de Sales Navigator",
      icon: Search,
      done: campaign.accounts_found > 0,
      href: "/company-search",
    },
    {
      id: 3,
      label: "Lista de cuentas",
      description: campaign.list_name
        ? `"${campaign.list_name}" creada`
        : "Crear lista en Sales Navigator con el script",
      icon: List,
      done: !!campaign.list_id,
      href: null,
    },
    {
      id: 4,
      label: "People Search",
      description: campaign.prospects_found > 0
        ? `${campaign.prospects_found} personas scrapeadas`
        : "Scrapear personas de la lista de cuentas",
      icon: Users,
      done: campaign.prospects_found > 0,
      href: "/people-search",
    },
    {
      id: 5,
      label: "Base lista",
      description: campaign.prospects_found > 0
        ? `${campaign.prospects_found} prospectos disponibles`
        : "Enriquecer y distribuir",
      icon: CheckCircle2,
      done: campaign.prospects_found > 0,
      href: "/prospects",
    },
  ]

  const currentStep = steps.findIndex((s) => !s.done)
  const activeIdx = currentStep === -1 ? steps.length - 1 : currentStep

  return (
    <div className="rounded-xl border bg-card p-4 mb-6">
      <p className="text-xs font-medium text-muted-foreground mb-3">Progreso de la campaña</p>
      <div className="flex items-start gap-1">
        {steps.map((step, idx) => {
          const isActive = idx === activeIdx
          const isDone = step.done
          const Icon = step.icon
          const content = (
            <div className={`flex flex-col items-center text-center flex-1 min-w-0 ${isActive ? "" : isDone ? "opacity-80" : "opacity-40"}`}>
              <div className={`flex items-center justify-center size-8 rounded-full border-2 mb-1.5 transition-colors ${
                isDone
                  ? "border-green-500 bg-green-50 text-green-600"
                  : isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-muted-foreground/30 bg-background text-muted-foreground"
              }`}>
                {isDone && idx !== 4
                  ? <Check className="size-3.5" />
                  : isDone
                    ? <CheckCircle2 className="size-3.5" />
                    : isActive
                      ? <Icon className="size-3.5" />
                      : <Circle className="size-3.5" />}
              </div>
              <p className={`text-xs font-medium leading-tight ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                {step.label}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 max-w-[90px] hidden sm:block">
                {step.description}
              </p>
            </div>
          )

          return (
            <div key={step.id} className="flex items-start flex-1 min-w-0">
              {step.href && !isDone
                ? <Link href={step.href} className="flex-1 min-w-0 hover:opacity-70 transition-opacity">{content}</Link>
                : <div className="flex-1 min-w-0">{content}</div>
              }
              {idx < steps.length - 1 && (
                <div className="flex items-center justify-center w-4 shrink-0 mt-3.5">
                  <ArrowRight className={`size-3 ${idx < activeIdx ? "text-green-500" : "text-muted-foreground/30"}`} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const STATUS_CONFIG = {
  discovered: { label: "Descubierta", class: "bg-zinc-100 text-zinc-700" },
  approved:   { label: "Aprobada",    class: "bg-green-100 text-green-700" },
  rejected:   { label: "Rechazada",   class: "bg-red-100 text-red-700" },
  scraping:   { label: "Scrapeando",  class: "bg-blue-100 text-blue-700" },
  done:       { label: "Listo",       class: "bg-violet-100 text-violet-700" },
}

const STATUS_CYCLE: Record<string, string> = {
  discovered: "approved",
  approved: "rejected",
  rejected: "discovered",
}

function generateScript(listId: string, companies: { sales_nav_id: string; company_name: string }[], repName: string, industry: string) {
  const ids = companies.map((c) => c.sales_nav_id).filter(Boolean)
  // Always extract just the numeric ID, whether user pasted URL or raw ID
  const cleanId = listId.match(/\d{10,}/)?.[0] ?? listId.trim()
  listId = cleanId
  return `// ProspectOS — ejecutar en el Sales Navigator de ${repName} (${industry})
// Asegurate de estar logueado como ${repName} antes de correr esto.
(async () => {
  const listId = ${JSON.stringify(listId)};
  const companyIds = ${JSON.stringify(ids)};

  const csrf = document.cookie.split(';').map(c=>c.trim().split('=')).find(([k])=>k==='JSESSIONID')?.[1]?.replace(/"/g,'');
  const csrfToken = csrf?.startsWith('ajax:') ? csrf : \`ajax:\${csrf}\`;

  let ok = 0, fail = 0;
  for (const id of companyIds) {
    const r = await fetch('/sales-api/salesApiListEntities?action=edit', {
      method: 'POST', credentials: 'include',
      headers: {'Content-Type':'application/json','csrf-token':csrfToken,'x-restli-protocol-version':'2.0.0','x-requested-with':'XMLHttpRequest'},
      body: JSON.stringify({entity:\`urn:li:fs_salesCompany:\${id}\`,addToLists:[listId],removeFromLists:[]})
    });
    if (r.ok) ok++; else { fail++; console.warn(\`[ProspectOS] Falló \${id}:\`, r.status); }
  }

  alert(\`✅ \${ok}/\${companyIds.length} empresas agregadas a la lista.\${fail > 0 ? '\\n⚠️ ' + fail + ' fallaron — revisá la consola.' : ''}\`);
})();`
}

function EditableCell({ value, onSave, placeholder, mono = false }: {
  value: string; onSave: (v: string) => Promise<void>; placeholder?: string; mono?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [isPending, startTransition] = useTransition()

  function start() { setDraft(value); setEditing(true) }
  function cancel() { setDraft(value); setEditing(false) }
  function save() {
    if (draft === value) { setEditing(false); return }
    startTransition(async () => { await onSave(draft); setEditing(false) })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel() }}
          className={`h-7 text-xs px-2 ${mono ? "font-mono" : ""}`} autoFocus disabled={isPending} />
        <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={save} disabled={isPending}>
          <Check className="size-3 text-green-600" />
        </Button>
        <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={cancel}>
          <X className="size-3" />
        </Button>
      </div>
    )
  }

  return (
    <button className={`group flex items-center gap-1 text-left text-sm hover:text-foreground ${mono ? "font-mono text-xs" : ""} ${!value ? "text-muted-foreground italic" : ""}`} onClick={start}>
      <span className="truncate max-w-[180px]">{value || placeholder}</span>
      <Pencil className="size-3 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
    </button>
  )
}

function StatusBadge({ status, onToggle }: { status: string; onToggle: () => void }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.discovered
  return (
    <button onClick={onToggle} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-70 ${cfg.class}`}>
      {cfg.label}
    </button>
  )
}

export function AccountsClient({ campaign, initialAccounts }: { campaign: Campaign; initialAccounts: Account[] }) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [listId, setListId] = useState(campaign.list_id ?? "")
  const [listName, setListName] = useState(() => {
    if (campaign.list_name) return campaign.list_name
    const today = new Date().toLocaleDateString("es-AR", { day: "numeric", month: "numeric", year: "numeric" })
    return `Empresas ${campaign.rep_name} ${campaign.industry} ${today}`
  })
  const [savedListId, setSavedListId] = useState(campaign.list_id)
  const [savedListName, setSavedListName] = useState(campaign.list_name)
  const [copied, setCopied] = useState(false)
  const [showScript, setShowScript] = useState(false)
  const [script, setScript] = useState("")
  const [peopleSearchStatus, setPeopleSearchStatus] = useState<"idle" | "loading" | "done" | "error" | "warning">("idle")
  const [peopleSearchMsg, setPeopleSearchMsg] = useState("")
  const [listActorStatus, setListActorStatus] = useState<"idle" | "loading" | "sent" | "error">("idle")
  const [listActorError, setListActorError] = useState("")

  const allIds = accounts.map((a) => a.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))
  const selectedAccounts = accounts.filter((a) => selected.has(a.id) && a.sales_nav_id)
  const selectedWithId = selectedAccounts.length

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(allIds))
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleUpdate(accountId: string, updates: Partial<Account>) {
    setAccounts((prev) => prev.map((a) => (a.id === accountId ? { ...a, ...updates } : a)))
    await updateAccount(accountId, campaign.id, updates)
  }

  async function handleDelete(accountId: string) {
    setDeletingId(accountId)
    setAccounts((prev) => prev.filter((a) => a.id !== accountId))
    setSelected((prev) => { const next = new Set(prev); next.delete(accountId); return next })
    await deleteAccount(accountId, campaign.id)
    setDeletingId(null)
  }

  function handleStatusToggle(account: Account) {
    const next = STATUS_CYCLE[account.status] ?? "discovered"
    handleUpdate(account.id, { status: next })
  }

  function handleGenerateScript() {
    const companies = selectedAccounts.map((a) => ({ sales_nav_id: a.sales_nav_id!, company_name: a.company_name }))
    const generated = generateScript(listId.trim(), companies, campaign.rep_name, campaign.industry)
    setScript(generated)
    setShowScript(true)
    setCopied(false)
  }

  async function handleCreateList() {
    setListActorStatus("loading")
    setListActorError("")
    const ids = selectedAccounts.map((a) => a.sales_nav_id!)
    const result = await createAccountList(campaign.id, campaign.rep_name, campaign.industry, ids, listName)
    if ("error" in result) {
      setListActorError(result.error)
      setListActorStatus("error")
    } else {
      setListActorStatus("sent")
    }
  }

  async function handleUpdatePeopleSearch() {
    setPeopleSearchStatus("loading")
    try {
      const cleanId = listId.match(/\d{10,}/)?.[0] ?? listId.trim()
      const result = await saveCampaignList(campaign.id, campaign.rep_name, campaign.industry, cleanId, listName)
      setSavedListId(cleanId)
      setSavedListName(listName)
      if (result.warning) {
        setPeopleSearchMsg(result.warning)
        setPeopleSearchStatus("warning")
      } else {
        setPeopleSearchMsg("Lista guardada en la campaña y URL de People Search actualizada")
        setPeopleSearchStatus("done")
      }
    } catch (e) {
      setPeopleSearchMsg(e instanceof Error ? e.message : "Error desconocido")
      setPeopleSearchStatus("error")
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(script)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Flow tracker */}
      <CampaignFlow campaign={campaign} />

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <span>{campaign.rep_name}</span><span>·</span>
          <span>{campaign.industry}</span><span>·</span>
          <span>{campaign.week_label}</span>
        </div>
        <h1 className="text-2xl font-semibold">Empresas de la campaña</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {accounts.length} empresa{accounts.length !== 1 ? "s" : ""} · click en cualquier campo para editar
        </p>
      </div>

      {/* Lista de cuentas guardada */}
      {savedListName && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm">
          <CheckCheck className="size-4 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-green-800">Lista guardada: </span>
            <span className="text-green-700">{savedListName}</span>
            {savedListId && <span className="ml-2 font-mono text-xs text-green-600">{savedListId}</span>}
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground border rounded-lg">
          <Building2 className="mb-2 size-8 opacity-30" />
          Sin empresas todavía — corré un Company Search primero
        </div>
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-3 py-2.5 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Empresa</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Dominio</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">ID Sales Nav</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Estado</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {accounts.map((account) => (
                  <tr key={account.id}
                    className={`hover:bg-muted/30 transition-colors ${deletingId === account.id ? "opacity-40" : ""} ${selected.has(account.id) ? "bg-blue-50/50" : ""}`}
                  >
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={selected.has(account.id)} onChange={() => toggleOne(account.id)} className="rounded" />
                    </td>
                    <td className="px-4 py-2.5">
                      <EditableCell value={account.company_name} placeholder="Sin nombre"
                        onSave={(v) => handleUpdate(account.id, { company_name: v })} />
                    </td>
                    <td className="px-4 py-2.5">
                      <EditableCell value={account.domain ?? ""} placeholder="dominio.com" mono
                        onSave={(v) => handleUpdate(account.id, { domain: v })} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <EditableCell value={account.sales_nav_id ?? ""} placeholder="ID" mono
                          onSave={(v) => handleUpdate(account.id, { sales_nav_id: v })} />
                        {account.sales_nav_id && (
                          <a href={`https://www.linkedin.com/sales/company/${account.sales_nav_id}`}
                            target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={account.status} onToggle={() => handleStatusToggle(account)} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(account.created_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(account.id)} disabled={deletingId === account.id}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Script generator panel */}
          {selected.size > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <div>
                <p className="text-sm font-medium">
                  {selected.size} seleccionada{selected.size !== 1 ? "s" : ""}
                  {selectedWithId < selected.size && (
                    <span className="text-muted-foreground font-normal"> · {selected.size - selectedWithId} sin ID de Sales Nav</span>
                  )}
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Nombre de la lista en Sales Navigator
                  </label>
                  <Input
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    className="text-sm"
                    placeholder="Empresas Fede Manufactura 19-6-2026"
                  />
                </div>

                {/* Crear lista automáticamente */}
                <div className="rounded-md border border-dashed p-3 space-y-2">
                  <p className="text-xs font-medium">Crear lista en Sales Navigator automáticamente</p>
                  <Button
                    onClick={handleCreateList}
                    disabled={selectedWithId === 0 || listActorStatus === "loading" || listActorStatus === "sent"}
                    size="sm"
                  >
                    {listActorStatus === "loading"
                      ? <><Loader2 className="mr-2 size-3.5 animate-spin" /> Iniciando…</>
                      : listActorStatus === "sent"
                        ? <><CheckCheck className="mr-2 size-3.5 text-green-500" /> Iniciado — esperá el resultado</>
                        : <><List className="mr-2 size-3.5" /> Crear Account List ({selectedWithId} empresas)</>}
                  </Button>
                  {listActorStatus === "sent" && (
                    <p className="text-xs text-muted-foreground">El actor está corriendo. Cuando termine, el ID de la lista se va a guardar automáticamente en esta campaña.</p>
                  )}
                  {listActorStatus === "error" && (
                    <p className="text-xs text-destructive">{listActorError}</p>
                  )}
                </div>

                {/* O pegá el ID manualmente */}
                <details className="group">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground list-none flex items-center gap-1">
                    <span className="group-open:hidden">▶</span>
                    <span className="hidden group-open:inline">▼</span>
                    O pegá el ID manualmente (si ya creaste la lista)
                  </summary>
                  <div className="mt-2 space-y-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        ID de la lista (URL: <span className="font-mono">/sales/lists/company/<strong>7473723596...</strong></span>)
                      </label>
                      <Input
                        value={listId}
                        onChange={(e) => {
                          const val = e.target.value
                          const match = val.match(/\/lists\/(?:company|account)\/(\d+)/)
                          setListId(match ? match[1] : val)
                        }}
                        className="font-mono text-sm"
                        placeholder="7473723596373360642 o pegá la URL completa"
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button onClick={handleGenerateScript} disabled={selectedWithId === 0 || !listId.trim()} variant="outline" size="sm">
                        <Code2 className="mr-2 size-3.5" />
                        Generar script para Claude
                      </Button>
                      <Button onClick={handleUpdatePeopleSearch} disabled={!listId.trim() || peopleSearchStatus === "loading"} size="sm">
                        <RefreshCw className={`mr-2 size-3.5 ${peopleSearchStatus === "loading" ? "animate-spin" : ""}`} />
                        Guardar lista
                      </Button>
                    </div>
                    {peopleSearchStatus === "done" && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCheck className="size-3" /> {peopleSearchMsg}
                      </p>
                    )}
                    {peopleSearchStatus === "warning" && (
                      <p className="text-xs text-amber-600">{peopleSearchMsg}</p>
                    )}
                    {peopleSearchStatus === "error" && (
                      <p className="text-xs text-destructive">{peopleSearchMsg}</p>
                    )}
                  </div>
                </details>
              </div>

              {showScript && (
                <div className="space-y-3">
                  <div className="relative">
                    <pre className="rounded-md bg-zinc-950 text-zinc-100 text-xs p-4 overflow-auto max-h-48 font-mono">
                      {script}
                    </pre>
                    <Button variant="secondary" size="sm" className="absolute top-2 right-2 h-7 text-xs" onClick={handleCopy}>
                      {copied ? <><CheckCheck className="mr-1 size-3 text-green-500" /> Copiado</> : <><Copy className="mr-1 size-3" /> Copiar</>}
                    </Button>
                  </div>
                  <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs text-blue-800 space-y-1">
                    <p className="font-medium">Decile esto a Claude (con el script pegado):</p>
                    <p className="italic font-mono bg-blue-100 rounded px-2 py-1 select-all">
                      ejecutá este script en la pestaña de Sales Navigator
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
