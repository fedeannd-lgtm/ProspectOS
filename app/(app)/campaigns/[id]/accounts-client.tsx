"use client"

import { useState, useTransition } from "react"
import { Pencil, Trash2, Check, X, ExternalLink, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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

function EditableCell({
  value,
  onSave,
  placeholder,
  mono = false,
}: {
  value: string
  onSave: (v: string) => Promise<void>
  placeholder?: string
  mono?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [isPending, startTransition] = useTransition()

  function start() { setDraft(value); setEditing(true) }
  function cancel() { setDraft(value); setEditing(false) }
  function save() {
    if (draft === value) { setEditing(false); return }
    startTransition(async () => {
      await onSave(draft)
      setEditing(false)
    })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel() }}
          className={`h-7 text-xs px-2 ${mono ? "font-mono" : ""}`}
          autoFocus
          disabled={isPending}
        />
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
    <button
      className={`group flex items-center gap-1 text-left text-sm hover:text-foreground ${mono ? "font-mono text-xs" : ""} ${!value ? "text-muted-foreground italic" : ""}`}
      onClick={start}
    >
      <span className="truncate max-w-[180px]">{value || placeholder}</span>
      <Pencil className="size-3 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
    </button>
  )
}

function StatusBadge({ status, onToggle }: { status: string; onToggle: () => void }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.discovered
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-70 ${cfg.class}`}
    >
      {cfg.label}
    </button>
  )
}

const STATUS_CYCLE: Record<string, string> = {
  discovered: "approved",
  approved: "rejected",
  rejected: "discovered",
}

export function AccountsClient({ campaign, initialAccounts }: { campaign: Campaign; initialAccounts: Account[] }) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleUpdate(accountId: string, updates: Partial<Account>) {
    setAccounts((prev) => prev.map((a) => (a.id === accountId ? { ...a, ...updates } : a)))
    await updateAccount(accountId, campaign.id, updates)
  }

  async function handleDelete(accountId: string) {
    setDeletingId(accountId)
    setAccounts((prev) => prev.filter((a) => a.id !== accountId))
    await deleteAccount(accountId, campaign.id)
    setDeletingId(null)
  }

  function handleStatusToggle(account: Account) {
    const next = STATUS_CYCLE[account.status] ?? "discovered"
    handleUpdate(account.id, { status: next })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <span>{campaign.rep_name}</span>
          <span>·</span>
          <span>{campaign.industry}</span>
          <span>·</span>
          <span>{campaign.week_label}</span>
        </div>
        <h1 className="text-2xl font-semibold">Empresas de la campaña</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {accounts.length} empresa{accounts.length !== 1 ? "s" : ""} · hacé click en cualquier campo para editarlo
        </p>
      </div>

      {/* Table */}
      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground border rounded-lg">
          <Building2 className="mb-2 size-8 opacity-30" />
          Sin empresas todavía — corré un Company Search primero
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
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
                <tr
                  key={account.id}
                  className={`hover:bg-muted/30 transition-colors ${deletingId === account.id ? "opacity-40" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <EditableCell
                      value={account.company_name}
                      placeholder="Sin nombre"
                      onSave={(v) => handleUpdate(account.id, { company_name: v })}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <EditableCell
                      value={account.domain ?? ""}
                      placeholder="dominio.com"
                      mono
                      onSave={(v) => handleUpdate(account.id, { domain: v })}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <EditableCell
                        value={account.sales_nav_id ?? ""}
                        placeholder="ID"
                        mono
                        onSave={(v) => handleUpdate(account.id, { sales_nav_id: v })}
                      />
                      {account.sales_nav_id && (
                        <a
                          href={`https://www.linkedin.com/sales/company/${account.sales_nav_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(account.id)}
                      disabled={deletingId === account.id}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
