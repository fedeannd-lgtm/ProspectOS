"use client"

import { useState, useTransition } from "react"
import { Pencil, Trash2, Check, X, ExternalLink, Building2, Code2, Copy, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateAccount, deleteAccount } from "./actions"

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

function generateScript(listName: string, companies: { sales_nav_id: string; company_name: string }[]) {
  const ids = companies.map((c) => c.sales_nav_id).filter(Boolean)
  return `(async () => {
  const listName = ${JSON.stringify(listName)};
  const companyIds = ${JSON.stringify(ids)};

  const csrf = document.cookie.split(';').map(c=>c.trim().split('=')).find(([k])=>k==='JSESSIONID')?.[1]?.replace(/"/g,'');
  const csrfToken = csrf?.startsWith('ajax:') ? csrf : \`ajax:\${csrf}\`;

  console.log('[ProspectOS] Creando lista:', listName, 'con', companyIds.length, 'empresas');

  const r = await fetch('/sales-api/salesApiLists', {
    method: 'POST', credentials: 'include',
    headers: {'Content-Type':'application/json','csrf-token':csrfToken,'x-restli-protocol-version':'2.0.0','x-requested-with':'XMLHttpRequest'},
    body: JSON.stringify({name: listName, listType: 'ACCOUNT'})
  });
  const data = await r.json();
  console.log('[ProspectOS] Respuesta creación:', r.status, data);

  let listId = data.id ?? data.listId ?? data.entityUrn ?? '';
  if (typeof listId === 'string' && listId.includes(':')) listId = listId.split(':').pop();

  for (let i = 0; i < companyIds.length; i += 50) {
    const batch = companyIds.slice(i, i + 50);
    const ar = await fetch(\`/sales-api/salesApiLists/\${listId}/listMembers\`, {
      method: 'POST', credentials: 'include',
      headers: {'Content-Type':'application/json','csrf-token':csrfToken,'x-restli-protocol-version':'2.0.0','x-requested-with':'XMLHttpRequest'},
      body: JSON.stringify({elements: batch.map(id => ({type:'ACCOUNT', account:{id}}))})
    });
    console.log(\`[ProspectOS] Batch \${Math.ceil((i+1)/50)} status:\`, ar.status);
  }

  alert(\`✅ Lista "\${listName}" creada con \${companyIds.length} empresas.\\nID: \${listId}\`);
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
  const [listName, setListName] = useState(() => {
    const today = new Date().toLocaleDateString("es-AR", { day: "numeric", month: "numeric", year: "numeric" })
    return `Empresas ${campaign.rep_name} ${campaign.industry} ${today}`
  })
  const [copied, setCopied] = useState(false)
  const [showScript, setShowScript] = useState(false)
  const [script, setScript] = useState("")

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
    const generated = generateScript(listName, companies)
    setScript(generated)
    setShowScript(true)
    setCopied(false)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(script)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div className="space-y-6">
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
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {selected.size} seleccionada{selected.size !== 1 ? "s" : ""}
                    {selectedWithId < selected.size && (
                      <span className="text-muted-foreground font-normal"> · {selected.size - selectedWithId} sin ID de Sales Nav</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">Nombre de la lista en Sales Navigator:</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Input value={listName} onChange={(e) => setListName(e.target.value)}
                  className="text-sm" placeholder="Nombre de la lista" />
                <Button onClick={handleGenerateScript} disabled={selectedWithId === 0} className="shrink-0">
                  <Code2 className="mr-2 size-4" />
                  Generar script
                </Button>
              </div>

              {showScript && (
                <div className="space-y-3">
                  <div className="relative">
                    <pre className="rounded-md bg-zinc-950 text-zinc-100 text-xs p-4 overflow-auto max-h-48 font-mono">
                      {script}
                    </pre>
                    <Button variant="secondary" size="sm"
                      className="absolute top-2 right-2 h-7 text-xs"
                      onClick={handleCopy}>
                      {copied ? <><CheckCheck className="mr-1 size-3 text-green-500" /> Copiado</> : <><Copy className="mr-1 size-3" /> Copiar</>}
                    </Button>
                  </div>
                  <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800 space-y-1">
                    <p className="font-medium">Cómo usarlo:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>Copiá el script con el botón de arriba</li>
                      <li>Abrí Sales Navigator en Chrome (<span className="font-mono">linkedin.com/sales/home</span>)</li>
                      <li>Decile a Claude: <span className="font-medium italic">"ejecutá este script en esta pestaña"</span> y pegá el código</li>
                    </ol>
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
