// HubSpot API client (Service Key auth)

const BASE = "https://api.hubapi.com"

function hs_headers(apiKey?: string) {
  return {
    Authorization: `Bearer ${apiKey ?? process.env.HUBSPOT_API_KEY}`,
    "Content-Type": "application/json",
  }
}

// ── Sequences ────────────────────────────────────────────────────────────────

export type HubspotSequence = { id: string; name: string }

export async function getSequences(apiKey: string): Promise<HubspotSequence[]> {
  const sequences: HubspotSequence[] = []
  let after: string | undefined
  do {
    const params = new URLSearchParams({ limit: "100", properties: "name" })
    if (after) params.set("after", after)
    const res = await fetch(`${BASE}/crm/v3/objects/sequences?${params}`, {
      headers: hs_headers(apiKey),
      cache: "no-store",
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`HubSpot sequences ${res.status}: ${body.slice(0, 300)}`)
    }
    const json = await res.json()
    for (const s of json.results ?? []) {
      if (s.properties?.name) sequences.push({ id: s.id, name: s.properties.name })
    }
    after = json.paging?.next?.after
  } while (after)
  return sequences
}

export type HubspotOwner = { id: string; email: string; name: string }

export async function getOwners(apiKey: string): Promise<HubspotOwner[]> {
  const res = await fetch(`${BASE}/crm/v3/owners?limit=100`, {
    headers: hs_headers(apiKey),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HubSpot owners ${res.status}: ${body.slice(0, 300)}`)
  }
  const json = await res.json()
  return (json.results ?? []).map((o: { id: string; email: string; firstName?: string; lastName?: string }) => ({
    id: o.id,
    email: o.email ?? "",
    name: [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email,
  }))
}

export async function findContactByEmail(apiKey: string, email: string): Promise<string | null> {
  const res = await fetch(`${BASE}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: hs_headers(apiKey),
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      properties: ["email"],
      limit: 1,
    }),
    cache: "no-store",
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.results?.[0]?.id ?? null
}

export async function createContact(apiKey: string, props: {
  email: string
  firstName?: string
  lastName?: string
  company?: string
  jobtitle?: string
  linkedinbio?: string
}): Promise<string> {
  const properties: Record<string, string> = { email: props.email }
  if (props.firstName) properties.firstname = props.firstName
  if (props.lastName) properties.lastname = props.lastName
  if (props.company) properties.company = props.company
  if (props.jobtitle) properties.jobtitle = props.jobtitle
  if (props.linkedinbio) properties.linkedinbio = props.linkedinbio
  const res = await fetch(`${BASE}/crm/v3/objects/contacts`, {
    method: "POST",
    headers: hs_headers(apiKey),
    body: JSON.stringify({ properties }),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HubSpot create contact ${res.status}: ${body.slice(0, 300)}`)
  }
  const json = await res.json()
  return json.id
}

export async function enrollInSequence(
  apiKey: string,
  sequenceId: string,
  contactId: string,
  ownerId: string
): Promise<void> {
  const res = await fetch(`${BASE}/automation/v4/sequences/${sequenceId}/enrollments`, {
    method: "POST",
    headers: hs_headers(apiKey),
    body: JSON.stringify({ contactId, userId: ownerId }),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HubSpot enroll ${res.status}: ${body.slice(0, 300)}`)
  }
}

export type HubspotDeal = {
  id: string
  dealname: string | null
  dealstage: string | null
  associatedContacts: string[]
  associatedCompanies: string[]
}

export type HubspotCompany = {
  id: string
  name: string | null
  domain: string | null
}

export type HubspotPipelineStage = {
  id: string
  label: string
}

// ── Pipelines ────────────────────────────────────────────────────────────────

export async function getDealPipelineStages(): Promise<HubspotPipelineStage[]> {
  const res = await fetch(`${BASE}/crm/v3/pipelines/deals`, {
    headers: hs_headers(),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HubSpot pipelines ${res.status}: ${body.slice(0, 200)}`)
  }
  const json = await res.json()
  const stages: HubspotPipelineStage[] = []
  for (const pipeline of json.results ?? []) {
    for (const stage of pipeline.stages ?? []) {
      stages.push({ id: stage.id, label: stage.label })
    }
  }
  return stages
}

// ── Deals ────────────────────────────────────────────────────────────────────

export async function getAllDeals(): Promise<HubspotDeal[]> {
  const deals: HubspotDeal[] = []
  let after: string | undefined

  do {
    const params = new URLSearchParams({
      limit: "100",
      properties: "dealname,dealstage",
      associations: "contacts,companies",
    })
    if (after) params.set("after", after)

    const res = await fetch(`${BASE}/crm/v3/objects/deals?${params}`, {
      headers: hs_headers(),
      cache: "no-store",
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`HubSpot deals ${res.status}: ${body.slice(0, 200)}`)
    }
    const json = await res.json()

    for (const deal of json.results ?? []) {
      const contactIds = (deal.associations?.contacts?.results ?? []).map((c: { id: string }) => c.id)
      const companyIds = (deal.associations?.companies?.results ?? []).map((c: { id: string }) => c.id)
      deals.push({
        id: deal.id,
        dealname: deal.properties?.dealname ?? null,
        dealstage: deal.properties?.dealstage ?? null,
        associatedContacts: contactIds,
        associatedCompanies: companyIds,
      })
    }

    after = json.paging?.next?.after
  } while (after)

  return deals
}

// ── Companies ────────────────────────────────────────────────────────────────

export async function getCompanyInfo(companyIds: string[]): Promise<Map<string, HubspotCompany>> {
  const map = new Map<string, HubspotCompany>()
  if (companyIds.length === 0) return map

  for (let i = 0; i < companyIds.length; i += 100) {
    const batch = companyIds.slice(i, i + 100)
    const res = await fetch(`${BASE}/crm/v3/objects/companies/batch/read`, {
      method: "POST",
      headers: hs_headers(),
      body: JSON.stringify({ inputs: batch.map((id) => ({ id })), properties: ["name", "domain"] }),
      cache: "no-store",
    })
    if (!res.ok) continue
    const json = await res.json()
    for (const company of json.results ?? []) {
      map.set(company.id, {
        id: company.id,
        name: company.properties?.name ?? null,
        domain: company.properties?.domain ?? null,
      })
    }
  }

  return map
}

// ── Contact Lists ─────────────────────────────────────────────────────────────

export type HubspotList = {
  listId: string
  name: string
  listType: "STATIC" | "DYNAMIC"
  size: number
}

export async function getContactLists(apiKey: string): Promise<HubspotList[]> {
  const lists: HubspotList[] = []
  let offset = 0
  const count = 250

  do {
    const params = new URLSearchParams({
      objectTypeId: "0-1",
      count: String(count),
      offset: String(offset),
    })
    const res = await fetch(`${BASE}/crm/v3/lists?${params}`, {
      headers: hs_headers(apiKey),
      cache: "no-store",
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`HubSpot lists ${res.status}: ${body.slice(0, 200)}`)
    }
    const json = await res.json()
    for (const l of json.lists ?? []) {
      lists.push({
        listId: String(l.listId ?? l.id),
        name: l.name ?? "",
        listType: l.listType ?? "STATIC",
        size: l.additionalProperties?.hs_list_size ?? l.memberCount ?? 0,
      })
    }
    if (!json.hasMore) break
    offset += count
  } while (true)

  return lists.sort((a, b) => a.name.localeCompare(b.name))
}

export type HubspotContactRow = {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  jobTitle: string | null
  company: string | null
  domain: string | null
  phone: string | null
  linkedinUrl: string | null
}

export async function getContactsFromList(apiKey: string, listId: string): Promise<HubspotContactRow[]> {
  // Step 1: get member IDs (paginated)
  const memberIds: string[] = []
  let after: string | undefined

  do {
    const params = new URLSearchParams({ limit: "250" })
    if (after) params.set("after", after)
    const res = await fetch(`${BASE}/crm/v3/lists/${listId}/memberships/join-order?${params}`, {
      headers: hs_headers(apiKey),
      cache: "no-store",
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`HubSpot list members ${res.status}: ${body.slice(0, 200)}`)
    }
    const json = await res.json()
    for (const m of json.results ?? []) memberIds.push(String(m.recordId))
    after = json.paging?.next?.after
  } while (after)

  if (memberIds.length === 0) return []

  // Step 2: batch-read contact properties
  const contacts: HubspotContactRow[] = []
  const PROPS = ["firstname", "lastname", "email", "jobtitle", "company", "hs_email_domain", "phone", "linkedinbio"]

  for (let i = 0; i < memberIds.length; i += 100) {
    const batch = memberIds.slice(i, i + 100)
    const res = await fetch(`${BASE}/crm/v3/objects/contacts/batch/read`, {
      method: "POST",
      headers: hs_headers(apiKey),
      body: JSON.stringify({ inputs: batch.map((id) => ({ id })), properties: PROPS }),
      cache: "no-store",
    })
    if (!res.ok) continue
    const json = await res.json()
    for (const c of json.results ?? []) {
      const p = c.properties ?? {}
      const email: string | null = p.email ?? null
      const domain: string | null = p.hs_email_domain ?? (email ? email.split("@")[1] ?? null : null)
      contacts.push({
        id: c.id,
        firstName: p.firstname ?? null,
        lastName: p.lastname ?? null,
        email,
        jobTitle: p.jobtitle ?? null,
        company: p.company ?? null,
        domain,
        phone: p.phone ?? null,
        linkedinUrl: p.linkedinbio ?? null,
      })
    }
  }

  return contacts
}

// ── Contacts ─────────────────────────────────────────────────────────────────

export async function getContactEmails(contactIds: string[]): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>()
  if (contactIds.length === 0) return emailMap

  for (let i = 0; i < contactIds.length; i += 100) {
    const batch = contactIds.slice(i, i + 100)
    const res = await fetch(`${BASE}/crm/v3/objects/contacts/batch/read`, {
      method: "POST",
      headers: hs_headers(),
      body: JSON.stringify({ inputs: batch.map((id) => ({ id })), properties: ["email"] }),
      cache: "no-store",
    })
    if (!res.ok) continue
    const json = await res.json()
    for (const contact of json.results ?? []) {
      const email: string | null = contact.properties?.email ?? null
      if (email) emailMap.set(contact.id, email.toLowerCase())
    }
  }

  return emailMap
}
