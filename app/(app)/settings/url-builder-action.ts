"use server"

import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

const HEADCOUNT_IDS: Record<string, string> = {
  "1-10": "A", "11-50": "B", "51-200": "D", "201-500": "E",
  "501-1000": "F", "1001-5000": "G", "5001-10000": "H", "10000+": "I",
}

const GEO_IDS: Record<string, string> = {
  "Argentina": "100446943", "Colombia": "100876405", "México": "103323778",
  "Chile": "104621616", "Perú": "102927786", "Uruguay": "100867946",
  "Paraguay": "104862589", "Bolivia": "104379514", "Ecuador": "106112024",
  "Venezuela": "101490751", "Brasil": "106057199", "América del Sur": "104514572",
  "América Latina": "104514572", "LATAM": "104514572",
  "Guatemala": "100877388", "El Salvador": "106522560", "Honduras": "101937718",
  "Nicaragua": "105517145", "Costa Rica": "101739942", "Panamá": "100808673",
  "España": "105646813",
}

const SYSTEM_PROMPT = `Sos un experto en generar URLs de búsqueda de LinkedIn Sales Navigator.
Tu tarea es generar una URL válida de Sales Navigator basándote en la descripción del usuario.

ESTRUCTURA BASE:
- Company search: https://www.linkedin.com/sales/search/company#query=QUERY_ENCODED
- People search: https://www.linkedin.com/sales/search/people#query=QUERY_ENCODED

ESTRUCTURA DE QUERY (antes de URL-encode):
query=(filters:List(FILTROS))

FILTROS DISPONIBLES:

1. COMPANY_HEADCOUNT (tamaño de empresa):
IDs disponibles: A=1-10, B=11-50, D=51-200, E=201-500, F=501-1000, G=1001-5000, H=5001-10000, I=10000+
Formato: (type:COMPANY_HEADCOUNT,values:List((id:E,text:201-500,selectionType:INCLUDED),(id:F,text:501-1000,selectionType:INCLUDED)))

2. COMPANY_HEADQUARTERS (geografía):
IDs disponibles: Argentina=100446943, Colombia=100876405, México=103323778, Chile=104621616,
Perú=102927786, Uruguay=100867946, Brasil=106057199, Venezuela=101490751,
América del Sur=104514572, Guatemala=100877388, El Salvador=106522560,
Honduras=101937718, Nicaragua=105517145, Costa Rica=101739942, Panamá=100808673, España=105646813
Formato: (type:COMPANY_HEADQUARTERS,values:List((id:100446943,text:Argentina,selectionType:INCLUDED)))

3. CURRENT_TITLE (cargo actual — solo para people search):
NO usa IDs. Usa texto libre con OR. Generá todas las variaciones relevantes del cargo en español e inglés.
Formato: (type:CURRENT_TITLE,values:List((text:"Gerente de RRHH"OR"HR Manager"OR"Director de Personas",selectionType:INCLUDED),(text:"Marketing"OR"Ventas",selectionType:EXCLUDED)))

4. INDUSTRY (industria — solo para company search):
IDs de industria comunes: Manufactura=24, Retail=27, Construcción=48, Logística=116,
Agro=1,  Tecnología=96, Salud=14, Finanzas=43, Consultoría=2374
Formato: (type:INDUSTRY,values:List((id:24,text:Manufactura,selectionType:INCLUDED)))

REGLAS:
- Generá SIEMPRE el CURRENT_TITLE con al MENOS 20 variaciones de cargos relevantes
- Incluí variaciones en español, inglés, con y sin tildes
- Si el usuario menciona exclusiones, usá selectionType:EXCLUDED
- La query final debe estar URL-encoded (reemplazá espacios con %20, : con %3A, etc.)
- Devolvé SOLO la URL completa, sin explicaciones adicionales
- Para people search siempre incluí COMPANY_HEADCOUNT mínimo

EJEMPLO de URL válida people search:
https://www.linkedin.com/sales/search/people#query=(filters%3AList((type%3ACOMPANY_HEADCOUNT%2Cvalues%3AList((id%3AE%2Ctext%3A201-500%2CselectionType%3AINCLUDED)%2C(id%3AF%2Ctext%3A501-1.000%2CselectionType%3AINCLUDED)))%2C(type%3ACURRENT_TITLE%2Cvalues%3AList((text%3A%22Gerente%20de%20RRHH%22OR%22HR%20Manager%22%2CselectionType%3AINCLUDED)))))`

export async function generateSalesNavUrl(
  type: "company" | "people",
  description: string
): Promise<{ url: string; error?: string }> {
  try {
    const userPrompt = `Tipo de búsqueda: ${type === "company" ? "Company Search" : "People Search"}

Descripción del usuario:
${description}

Generá la URL de Sales Navigator completa y lista para usar.`

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    })

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : ""
    const url = text.match(/https:\/\/www\.linkedin\.com\/sales\/search\/(company|people)[^\s]*/)?.[0] ?? text

    if (!url.startsWith("https://www.linkedin.com/sales/search/")) {
      return { url: "", error: "No se pudo generar una URL válida. Intentá con una descripción más específica." }
    }

    return { url }
  } catch (e) {
    return { url: "", error: e instanceof Error ? e.message : "Error al generar la URL" }
  }
}
