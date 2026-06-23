export type IcpCategory = "Communication" | "Experience" | "Onboarding" | "Helpdesk" | "Genérico"

const RULES: Array<{ category: IcpCategory; keywords: string[] }> = [
  // Communication has highest priority — checked first
  {
    category: "Communication",
    keywords: ["comunicación", "comunicaciones", "communication"],
  },
  {
    category: "Experience",
    keywords: [
      "cultura", "culture", "hrbp", "experience", "people", "bienestar",
      "desarrollo organizacional", "talento", "experiencia del colaborador",
    ],
  },
  {
    category: "Onboarding",
    keywords: [
      "atracción de talento", "selección", "atracción", "talent acquisition",
      "acquisition", "capacitación", "formación",
    ],
  },
  {
    category: "Helpdesk",
    keywords: ["compensaciones", "compensations", "payroll", "servicios", "nómina", "nomina"],
  },
]

const SENIOR_KEYWORDS = ["c-level", "ceo", "coo", "cfo", "cto", "chro", "vp ", " vp", "vice president", "director", "gerente general"]
const MID_KEYWORDS = ["manager", "jefe", "líder", "lider", "lead", "head of", "coordinador", "coordinator"]

export function classifyIcp(jobTitle: string): { category: IcpCategory; score: number } {
  const lower = jobTitle.toLowerCase()

  // Category
  let category: IcpCategory = "Genérico"
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      category = rule.category
      break
    }
  }

  // Score based on seniority
  let score = 0
  if (SENIOR_KEYWORDS.some((kw) => lower.includes(kw))) {
    score = 10
  } else if (MID_KEYWORDS.some((kw) => lower.includes(kw))) {
    score = 5
  }

  return { category, score }
}
