const DEFAULT_REPS = ["Alu", "Fede", "Guido", "Suva", "Jess"]
const DEFAULT_INDUSTRIES = [
  "Retail & Comercio", "Manufactura", "Finance & Insurance", "Agro & Energy",
  "Construcción", "BPO & Professional Services", "Health & Entertainment", "Consulting & Telco",
]

export const REPS: string[] = process.env.NEXT_PUBLIC_REPS
  ? process.env.NEXT_PUBLIC_REPS.split(",").map((r) => r.trim()).filter(Boolean)
  : DEFAULT_REPS

export const INDUSTRIES: string[] = process.env.NEXT_PUBLIC_INDUSTRIES
  ? process.env.NEXT_PUBLIC_INDUSTRIES.split(",").map((i) => i.trim()).filter(Boolean)
  : DEFAULT_INDUSTRIES
