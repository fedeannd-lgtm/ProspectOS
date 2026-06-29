function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "")
}

export function generateEmailCandidates(firstName: string, lastName: string, domain: string): string[] {
  const f = normalize(firstName)
  const l = normalize(lastName)
  const lFirst = normalize(lastName.split(/\s+/)[0]) // first word of last name
  const d = domain.toLowerCase().trim()

  if (!f || !l || !d) return []

  const candidates = [
    `${f}.${l}@${d}`,
    `${f[0]}.${l}@${d}`,
    `${f}.${lFirst}@${d}`,
    `${f[0]}.${lFirst}@${d}`,
    `${f}${l}@${d}`,
    `${f}@${d}`,
  ]

  return [...new Set(candidates)]
}
