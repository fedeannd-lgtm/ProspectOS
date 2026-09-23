"use server"

import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

// Known LinkedIn GeoIDs for LATAM
const GEO_IDS: Record<string, { id: string; text: string }> = {
  argentina:        { id: "100446943", text: "Argentina" },
  colombia:         { id: "100876405", text: "Colombia" },
  mexico:           { id: "103323778", text: "Mexico" },
  méxico:           { id: "103323778", text: "Mexico" },
  chile:            { id: "104621616", text: "Chile" },
  peru:             { id: "102927786", text: "Peru" },
  perú:             { id: "102927786", text: "Peru" },
  uruguay:          { id: "100867946", text: "Uruguay" },
  paraguay:         { id: "104862589", text: "Paraguay" },
  bolivia:          { id: "104379514", text: "Bolivia" },
  ecuador:          { id: "106112024", text: "Ecuador" },
  venezuela:        { id: "101490751", text: "Venezuela" },
  brasil:           { id: "106057199", text: "Brazil" },
  brazil:           { id: "106057199", text: "Brazil" },
  "america del sur": { id: "104514572", text: "South America" },
  latam:            { id: "104514572", text: "South America" },
  "america latina": { id: "104514572", text: "South America" },
  guatemala:        { id: "100877388", text: "Guatemala" },
  "el salvador":    { id: "106522560", text: "El Salvador" },
  honduras:         { id: "101937718", text: "Honduras" },
  nicaragua:        { id: "105517145", text: "Nicaragua" },
  "costa rica":     { id: "101739942", text: "Costa Rica" },
  panama:           { id: "100808673", text: "Panama" },
  panamá:           { id: "100808673", text: "Panama" },
  españa:           { id: "105646813", text: "Spain" },
  spain:            { id: "105646813", text: "Spain" },
}

// Known LinkedIn industry IDs
const INDUSTRY_IDS: Record<string, { id: string; text: string }> = {
  // Tech
  "tecnologia":                        { id: "96",   text: "Information Technology and Services" },
  "tecnología":                        { id: "96",   text: "Information Technology and Services" },
  "it":                                { id: "96",   text: "Information Technology and Services" },
  "software":                          { id: "4",    text: "Computer Software" },
  "internet":                          { id: "6",    text: "Internet" },
  "telecomunicaciones":                { id: "8",    text: "Telecommunications" },
  "telco":                             { id: "8",    text: "Telecommunications" },
  // Finance
  "finanzas":                          { id: "43",   text: "Financial Services" },
  "financial services":                { id: "43",   text: "Financial Services" },
  "banco":                             { id: "41",   text: "Banking" },
  "banking":                           { id: "41",   text: "Banking" },
  "seguros":                           { id: "44",   text: "Insurance" },
  "insurance":                         { id: "44",   text: "Insurance" },
  // Manufacturing/Industry
  "manufactura":                       { id: "24",   text: "Machinery" },
  "manufacturing":                     { id: "24",   text: "Machinery" },
  "industrial":                        { id: "24",   text: "Machinery" },
  "automotriz":                        { id: "23",   text: "Automotive" },
  "automotive":                        { id: "23",   text: "Automotive" },
  "quimica":                           { id: "30",   text: "Chemicals" },
  "química":                           { id: "30",   text: "Chemicals" },
  "plasticos":                         { id: "50",   text: "Plastics" },
  // Retail / Commerce
  "retail":                            { id: "27",   text: "Retail" },
  "comercio":                          { id: "27",   text: "Retail" },
  "supermercado":                      { id: "27",   text: "Retail" },
  "fmcg":                              { id: "16",   text: "Food & Beverages" },
  "alimentos":                         { id: "16",   text: "Food & Beverages" },
  "food":                              { id: "16",   text: "Food & Beverages" },
  // Construction / Real Estate
  "construccion":                      { id: "48",   text: "Construction" },
  "construcción":                      { id: "48",   text: "Construction" },
  "construction":                      { id: "48",   text: "Construction" },
  "inmobiliaria":                      { id: "49",   text: "Real Estate" },
  "real estate":                       { id: "49",   text: "Real Estate" },
  // Health
  "salud":                             { id: "14",   text: "Hospital & Health Care" },
  "health":                            { id: "14",   text: "Hospital & Health Care" },
  "farmaceutica":                      { id: "13",   text: "Pharmaceuticals" },
  "farma":                             { id: "13",   text: "Pharmaceuticals" },
  // Logistics / Transport
  "logistica":                         { id: "116",  text: "Logistics and Supply Chain" },
  "logística":                         { id: "116",  text: "Logistics and Supply Chain" },
  "transporte":                        { id: "113",  text: "Transportation/Trucking/Railroad" },
  "supply chain":                      { id: "116",  text: "Logistics and Supply Chain" },
  // Agro / Energy
  "agro":                              { id: "1",    text: "Agriculture" },
  "agricultura":                       { id: "1",    text: "Agriculture" },
  "energia":                           { id: "109",  text: "Oil & Energy" },
  "energía":                           { id: "109",  text: "Oil & Energy" },
  "petroleo":                          { id: "109",  text: "Oil & Energy" },
  "petróleo":                          { id: "109",  text: "Oil & Energy" },
  "mineria":                           { id: "21",   text: "Mining & Metals" },
  "minería":                           { id: "21",   text: "Mining & Metals" },
  // Services / Consulting / BPO
  "consultoria":                       { id: "2374", text: "Management Consulting" },
  "consultoría":                       { id: "2374", text: "Management Consulting" },
  "consulting":                        { id: "2374", text: "Management Consulting" },
  "servicios profesionales":           { id: "69",   text: "Professional Training & Coaching" },
  "bpo":                               { id: "78",   text: "Outsourcing/Offshoring" },
  "outsourcing":                       { id: "78",   text: "Outsourcing/Offshoring" },
  "rrhh":                              { id: "78",   text: "Outsourcing/Offshoring" },
  "staffing":                          { id: "137",  text: "Staffing and Recruiting" },
  "recruiting":                        { id: "137",  text: "Staffing and Recruiting" },
  // Education / Entertainment
  "educacion":                         { id: "69",   text: "E-Learning" },
  "educación":                         { id: "69",   text: "E-Learning" },
  "entretenimiento":                   { id: "17",   text: "Entertainment" },
  "media":                             { id: "38",   text: "Media Production" },
}

const HEADCOUNT_CODES: Record<string, { id: string; text: string }> = {
  "1-10":      { id: "A", text: "1-10" },
  "11-50":     { id: "B", text: "11-50" },
  "51-200":    { id: "D", text: "51-200" },
  "201-500":   { id: "E", text: "201-500" },
  "501-1000":  { id: "F", text: "501-1,000" },
  "1001-5000": { id: "G", text: "1,001-5,000" },
  "5001-10000":{ id: "H", text: "5,001-10,000" },
  "10000+":    { id: "I", text: "10,000+" },
}

type FilterParams = {
  headcount: string[]           // e.g. ["E", "F", "G"]
  geography: string[]           // lowercase keys from GEO_IDS
  industries: string[]          // lowercase keys from INDUSTRY_IDS
  titles: string[]              // free-text job title variations
  titleExclusions: string[]     // titles to exclude
}

function buildSalesNavUrl(type: "company" | "people", filters: FilterParams): string {
  const parts: string[] = []

  // Headcount
  if (filters.headcount.length > 0) {
    const vals = filters.headcount
      .map((code) => {
        const entry = Object.values(HEADCOUNT_CODES).find((h) => h.id === code)
        if (!entry) return null
        return `(id:${entry.id},text:${entry.text},selectionType:INCLUDED)`
      })
      .filter(Boolean)
    if (vals.length > 0) {
      parts.push(`(type:COMPANY_HEADCOUNT,values:List(${vals.join(",")}))`)
    }
  }

  // Geography
  const geoEntries = filters.geography
    .map((key) => GEO_IDS[key.toLowerCase()])
    .filter(Boolean)
  if (geoEntries.length > 0) {
    const vals = geoEntries.map((g) => `(id:${g!.id},text:${g!.text},selectionType:INCLUDED)`)
    parts.push(`(type:COMPANY_HEADQUARTERS,values:List(${vals.join(",")}))`)
  }

  // Industry (company search only)
  if (type === "company" && filters.industries.length > 0) {
    const indEntries = filters.industries
      .map((key) => INDUSTRY_IDS[key.toLowerCase()])
      .filter(Boolean)
    if (indEntries.length > 0) {
      const vals = indEntries.map((i) => `(id:${i!.id},text:${i!.text},selectionType:INCLUDED)`)
      parts.push(`(type:INDUSTRY,values:List(${vals.join(",")}))`)
    }
  }

  // Job titles (people search only)
  if (type === "people" && filters.titles.length > 0) {
    const titleText = filters.titles.map((t) => `"${t}"`).join("OR")
    const inclVal = `(text:${titleText},selectionType:INCLUDED)`

    const vals = [inclVal]
    if (filters.titleExclusions.length > 0) {
      const exclText = filters.titleExclusions.map((t) => `"${t}"`).join("OR")
      vals.push(`(text:${exclText},selectionType:EXCLUDED)`)
    }
    parts.push(`(type:CURRENT_TITLE,values:List(${vals.join(",")}))`)
  }

  const query = `(filters:List(${parts.join(",")}))`
  const base = type === "company"
    ? "https://www.linkedin.com/sales/search/company"
    : "https://www.linkedin.com/sales/search/people"

  return `${base}#query=${encodeURIComponent(query)}`
}

const GEO_KEYS = Object.keys(GEO_IDS).join(", ")
const INDUSTRY_KEYS = Object.keys(INDUSTRY_IDS).join(", ")

const SYSTEM_PROMPT = `Sos un asistente que convierte descripciones de búsqueda de prospectos B2B en parámetros de filtro estructurados para LinkedIn Sales Navigator.

Devolvé ÚNICAMENTE un JSON válido con esta estructura exacta (sin texto adicional, sin markdown):
{
  "headcount": [],
  "geography": [],
  "industries": [],
  "titles": [],
  "titleExclusions": []
}

REGLAS:

**headcount** — array de códigos: A=1-10, B=11-50, D=51-200, E=201-500, F=501-1000, G=1001-5000, H=5001-10000, I=10000+
Si el usuario menciona "mediana empresa" → ["E","F"]. "Grande" → ["G","H","I"]. "PyME" → ["D","E","F"].

**geography** — array de claves EXACTAS de esta lista (en minúsculas):
${GEO_KEYS}
Si el usuario dice "LATAM" → ["latam"]. Si dice países específicos → listarlos uno por uno.

**industries** — array de claves EXACTAS de esta lista (en minúsculas). Solo para company search:
${INDUSTRY_KEYS}
Mapear lo que describe el usuario a las claves más cercanas.

**titles** — array de variaciones de cargo para people search. Generá al menos 20 variaciones en español e inglés, con y sin tildes:
["Gerente de RRHH","Gerentes de RRHH","HR Manager","HR Director","Director de RRHH",...]

**titleExclusions** — cargos a excluir si el usuario los menciona, vacío si no hay.

Si es company search: titles y titleExclusions quedan vacíos [].
Si es people search: industries queda vacío [].`

export async function generateSalesNavUrl(
  type: "company" | "people",
  description: string
): Promise<{ url: string; error?: string }> {
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Tipo: ${type === "company" ? "Company Search" : "People Search"}\n\nDescripción: ${description}`,
      }],
    })

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : ""
    const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()

    let filters: FilterParams
    try {
      filters = JSON.parse(jsonStr)
    } catch {
      return { url: "", error: "No se pudo interpretar la respuesta. Intentá con una descripción más específica." }
    }

    const url = buildSalesNavUrl(type, filters)
    return { url }
  } catch (e) {
    return { url: "", error: e instanceof Error ? e.message : "Error al generar la URL" }
  }
}
