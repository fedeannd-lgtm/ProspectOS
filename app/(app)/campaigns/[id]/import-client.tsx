"use client"

import { useRef, useState, useTransition } from "react"
import { Upload, FileText, AlertCircle, CheckCircle2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { importProspectsFromCsv, type ImportRow } from "./actions"

// Column aliases accepted in the CSV header (case-insensitive)
const ALIASES: Record<keyof ImportRow, string[]> = {
  first_name:   ["first_name", "nombre", "first name", "firstname"],
  last_name:    ["last_name", "apellido", "last name", "lastname"],
  full_name:    ["full_name", "nombre completo", "name", "full name"],
  company_name: ["company_name", "empresa", "company", "organization", "organización"],
  job_title:    ["job_title", "cargo", "title", "puesto", "position"],
  email:        ["email", "correo", "mail", "e-mail"],
  linkedin_url: ["linkedin_url", "linkedin", "linkedin url", "perfil linkedin"],
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return { headers: [], rows: [] }
  const parse = (line: string) => {
    const cols: string[] = []
    let cur = ""
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQ = !inQ }
      else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = "" }
      else cur += ch
    }
    cols.push(cur.trim())
    return cols
  }
  const headers = parse(lines[0]).map((h) => h.replace(/^"|"$/g, "").toLowerCase().trim())
  const rows = lines.slice(1).map(parse)
  return { headers, rows }
}

function mapRow(headers: string[], row: string[]): ImportRow {
  const obj: Record<string, string> = {}
  headers.forEach((h, i) => { obj[h] = row[i] ?? "" })

  const get = (field: keyof ImportRow): string | undefined => {
    for (const alias of ALIASES[field]) {
      if (obj[alias] !== undefined && obj[alias] !== "") return obj[alias]
    }
    return undefined
  }

  return {
    first_name: get("first_name"),
    last_name: get("last_name"),
    full_name: get("full_name"),
    company_name: get("company_name"),
    job_title: get("job_title"),
    email: get("email"),
    linkedin_url: get("linkedin_url"),
  }
}

export function ImportClient({ campaignId }: { campaignId: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState("")
  const [parseError, setParseError] = useState("")
  const [result, setResult] = useState<{ imported: number } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [dragOver, setDragOver] = useState(false)
  const [importError, setImportError] = useState("")

  function handleFile(file: File) {
    setParseError("")
    setRows([])
    setResult(null)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers, rows: rawRows } = parseCSV(text)
      if (!headers.length) { setParseError("No se pudo leer el archivo."); return }
      const mapped = rawRows.map((r) => mapRow(headers, r)).filter((r) =>
        r.full_name || r.first_name || r.last_name || r.company_name
      )
      if (!mapped.length) { setParseError("No se encontraron filas válidas."); return }
      setRows(mapped)
    }
    reader.readAsText(file, "utf-8")
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function handleImport() {
    setImportError("")
    startTransition(async () => {
      try {
        const res = await importProspectsFromCsv(campaignId, rows)
        setResult(res)
        setRows([])
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Error al importar")
      }
    })
  }

  if (result) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-6 flex items-start gap-3">
        <CheckCircle2 className="size-5 text-green-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-sm text-green-800 dark:text-green-300">
            {result.imported} prospectos importados correctamente
          </p>
          <p className="text-xs text-green-700/70 dark:text-green-400/60 mt-0.5">
            Ahora podés ir a Enrichment para enriquecer con Apollo y validar emails.
          </p>
          <button
            className="text-xs text-green-700 dark:text-green-400 underline mt-2"
            onClick={() => setResult(null)}
          >
            Importar otra lista
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Importar lista</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Subí un CSV con los contactos de tu webinar, feria u otra fuente.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`rounded-lg border-2 border-dashed p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/40 hover:bg-muted/30"
        }`}
      >
        <Upload className="size-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">Arrastrá tu CSV o hacé click para seleccionar</p>
          <p className="text-xs text-muted-foreground mt-1">
            Columnas reconocidas: nombre, apellido, empresa, cargo, email, linkedin_url
          </p>
        </div>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
      </div>

      {parseError && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          {parseError}
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="size-4 text-muted-foreground" />
              <span className="font-medium">{fileName}</span>
              <span className="text-muted-foreground">— {rows.length} filas</span>
            </div>
            <button onClick={() => { setRows([]); setFileName("") }} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>

          {/* Preview */}
          <div className="overflow-x-auto rounded-md border">
            <table className="text-xs w-full">
              <thead className="bg-muted/50">
                <tr>
                  {["Nombre", "Empresa", "Cargo", "Email", "LinkedIn"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{r.full_name ?? [r.first_name, r.last_name].filter(Boolean).join(" ") ?? "—"}</td>
                    <td className="px-3 py-2">{r.company_name ?? "—"}</td>
                    <td className="px-3 py-2">{r.job_title ?? "—"}</td>
                    <td className="px-3 py-2">{r.email ?? "—"}</td>
                    <td className="px-3 py-2 max-w-[120px] truncate">{r.linkedin_url ?? "—"}</td>
                  </tr>
                ))}
                {rows.length > 5 && (
                  <tr className="border-t">
                    <td colSpan={5} className="px-3 py-2 text-muted-foreground italic">
                      … y {rows.length - 5} más
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Button onClick={handleImport} disabled={isPending}>
            {isPending ? "Importando..." : `Importar ${rows.length} prospectos`}
          </Button>
          {importError && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="size-4 shrink-0" />
              {importError}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
