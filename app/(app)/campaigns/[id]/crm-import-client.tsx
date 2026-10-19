"use client"

import { useState, useTransition, useEffect } from "react"
import { Building2, Users, Download, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getHubspotLists, importFromHubspotList } from "./actions"
import type { HubspotList } from "@/lib/hubspot"

export function CrmImportClient({ campaignId }: { campaignId: string }) {
  const [lists, setLists] = useState<HubspotList[]>([])
  const [loadError, setLoadError] = useState("")
  const [selectedListId, setSelectedListId] = useState("")
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null)
  const [importError, setImportError] = useState("")
  const [isLoadingLists, setIsLoadingLists] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getHubspotLists().then((res) => {
      if ("error" in res) {
        setLoadError(res.error)
      } else {
        setLists(res.lists)
        if (res.lists.length > 0) setSelectedListId(res.lists[0].listId)
      }
      setIsLoadingLists(false)
    })
  }, [])

  function handleImport() {
    if (!selectedListId) return
    setImportError("")
    setImportResult(null)
    startTransition(async () => {
      const res = await importFromHubspotList(campaignId, selectedListId)
      if ("error" in res) {
        setImportError(res.error)
      } else {
        setImportResult({ imported: res.imported })
      }
    })
  }

  const selectedList = lists.find((l) => l.listId === selectedListId)

  if (importResult) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4">
        <CheckCircle2 className="size-5 text-green-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-sm text-green-800 dark:text-green-300">
            {importResult.imported} contactos importados desde HubSpot
          </p>
          <p className="text-xs text-green-700/70 dark:text-green-400/60 mt-0.5">
            Ahora podés ir a Enrichment para enriquecer sus emails.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="size-4 text-blue-500" />
        <h2 className="text-lg font-semibold">Importar desde HubSpot</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Elegí una lista de contactos de HubSpot para importar como prospectos en esta campaña.
      </p>

      {isLoadingLists ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
          <RefreshCw className="size-4 animate-spin" />
          Cargando listas de HubSpot…
        </div>
      ) : loadError ? (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          {loadError}
        </div>
      ) : lists.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay listas de contactos en HubSpot.</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Lista de contactos</label>
            <select
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {lists.map((l) => (
                <option key={l.listId} value={l.listId}>
                  {l.name} {l.size > 0 ? `(${l.size} contactos)` : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedList && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              <span>
                {selectedList.listType === "DYNAMIC" ? "Lista dinámica" : "Lista estática"} ·{" "}
                {selectedList.size > 0 ? `${selectedList.size} contactos` : "tamaño desconocido"}
              </span>
            </div>
          )}

          {importError && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="size-4 shrink-0" />
              {importError}
            </div>
          )}

          <Button onClick={handleImport} disabled={isPending || !selectedListId} className="gap-2">
            <Download className="size-4" />
            {isPending ? "Importando…" : "Importar contactos"}
          </Button>
        </div>
      )}
    </div>
  )
}
