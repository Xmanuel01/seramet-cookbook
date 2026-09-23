import mammoth from "mammoth"
import type {
  ImportIssue,
  ParsedIngredientCandidate,
  ParsedQuantity,
  ParsedRecipeCandidate,
} from "../types"

const IMPORTER_VERSION = "docx-semantic-v1"

const UNIT_ALIASES: Record<string, { code: string; label: string }> = {
  g: { code: "G", label: "g" },
  gram: { code: "G", label: "g" },
  grams: { code: "G", label: "g" },
  kg: { code: "KG", label: "kg" },
  kgs: { code: "KG", label: "kg" },
  ml: { code: "ML", label: "ml" },
  l: { code: "L", label: "L" },
  litre: { code: "L", label: "L" },
  litres: { code: "L", label: "L" },
  liter: { code: "L", label: "L" },
  liters: { code: "L", label: "L" },
  pc: { code: "PC", label: "pc" },
  pcs: { code: "PC", label: "pc" },
  piece: { code: "PC", label: "pc" },
  pieces: { code: "PC", label: "pc" },
  egg: { code: "PC", label: "pc" },
  eggs: { code: "PC", label: "pc" },
  tbsp: { code: "TBSP", label: "tbsp" },
  tablespoon: { code: "TBSP", label: "tbsp" },
  tablespoons: { code: "TBSP", label: "tbsp" },
  tsp: { code: "TSP", label: "tsp" },
  teaspoon: { code: "TSP", label: "tsp" },
  teaspoons: { code: "TSP", label: "tsp" },
  cup: { code: "CUP", label: "cup" },
  cups: { code: "CUP", label: "cup" },
  slice: { code: "SLICE", label: "slice" },
  slices: { code: "SLICE", label: "slice" },
  portion: { code: "PORTION", label: "portion" },
  portions: { code: "PORTION", label: "portion" },
  serving: { code: "PORTION", label: "portion" },
  servings: { code: "PORTION", label: "portion" },
  plate: { code: "PORTION", label: "portion" },
  plates: { code: "PORTION", label: "portion" },
  sachet: { code: "SACHET", label: "sachet" },
  sachets: { code: "SACHET", label: "sachet" },
  packet: { code: "PACKET", label: "packet" },
  packets: { code: "PACKET", label: "packet" },
  bunch: { code: "BUNCH", label: "bunch" },
  bunches: { code: "BUNCH", label: "bunch" },
  container: { code: "CONTAINER", label: "container" },
  containers: { code: "CONTAINER", label: "container" },
  leaf: { code: "LEAF", label: "leaf" },
  leaves: { code: "LEAF", label: "leaf" },
  shot: { code: "SHOT", label: "shot" },
  shots: { code: "SHOT", label: "shot" },
  bottle: { code: "BOTTLE", label: "bottle" },
  bottles: { code: "BOTTLE", label: "bottle" },
  roll: { code: "ROLL", label: "roll" },
  rolls: { code: "ROLL", label: "roll" },
}

const QUALITATIVE = [
  "as required",
  "as needed",
  "to taste",
  "for frying",
  "for deep frying",
  "pinch",
  "half",
  "optional",
  "chef confirm",
  "not specified",
]

const SKIP_CATEGORIES = new Set([
  "document control",
  "contents & coverage",
])

const unicodeFractions: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
}

function issue(code: string, message: string, severity: ImportIssue["severity"] = "review"): ImportIssue {
  return { code, message, severity }
}

function clean(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()
}

function normalizeNumericText(value: string) {
  let text = value
  for (const [symbol, decimal] of Object.entries(unicodeFractions)) {
    text = text.replace(new RegExp(`(\\d)${symbol}`, "g"), (_, whole) => String(Number(whole) + decimal))
    text = text.replaceAll(symbol, String(decimal))
  }
  text = text.replace(/(\d+)\s*\/\s*(\d+)/g, (_, numerator, denominator) => {
    const d = Number(denominator)
    return d === 0 ? "0" : String(Number(numerator) / d)
  })
  return text
}

export function parseQuantity(rawValue: string): ParsedQuantity {
  const raw = clean(rawValue)
  const issues: ImportIssue[] = []
  if (!raw) {
    return { raw, issues: [issue("EMPTY_QUANTITY", "Quantity is blank.", "blocked")] }
  }

  const lower = raw.toLowerCase()
  if (lower === "quantity") {
    return { raw, issues: [issue("HEADER_ROW", "Header row was not treated as an ingredient.", "info")] }
  }

  if (QUALITATIVE.some((term) => lower === term || lower.startsWith(term + " ") || lower.includes("chef confirm"))) {
    return {
      raw,
      issues: [issue("QUALITATIVE_QUANTITY", `Quantity “${raw}” requires kitchen confirmation.`)],
    }
  }

  const normalized = normalizeNumericText(lower.replace(/^about\s+/, "").replace(/^approx(?:imately)?\.?\s+/, ""))
  const approximate = /^about\s+/i.test(raw) || /^approx/i.test(raw) || /about|approximately/i.test(raw)

  const range = normalized.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/)
  if (range) {
    return {
      raw,
      approximate: true,
      issues: [issue("RANGE_QUANTITY", `Range “${raw}” must be confirmed as a single production quantity.`)],
    }
  }

  const numberMatch = normalized.match(/^(\d+(?:\.\d+)?)/)
  if (!numberMatch) {
    return {
      raw,
      issues: [issue("UNPARSED_QUANTITY", `Could not safely convert “${raw}” into a numeric quantity.`)],
    }
  }

  const value = Number(numberMatch[1])
  const rest = normalized.slice(numberMatch[0].length).trim()
  const tokens = rest.match(/[a-z]+/g) || []
  const unitToken = tokens.find((token) => Boolean(UNIT_ALIASES[token]))
  const unit = unitToken ? UNIT_ALIASES[unitToken] : null

  if (!unit) {
    return {
      raw,
      value,
      approximate,
      issues: [issue("UNKNOWN_UNIT", `Unit in “${raw}” is not yet mapped to a Seramet unit.`)],
    }
  }

  const unitIndex = rest.indexOf(unitToken!)
  const beforeUnit = unitIndex > 0 ? rest.slice(0, unitIndex).trim() : ""
  const afterUnit = rest.slice(unitIndex + unitToken!.length).trim()
  const notes = clean([beforeUnit, afterUnit].filter(Boolean).join(" "))

  if (/draft|validate|confirm/i.test(notes)) {
    issues.push(issue("SOURCE_REVIEW_NOTE", `Source note “${notes}” requires review.`))
  }

  return {
    raw,
    value,
    unitCode: unit.code,
    unitLabel: unit.label,
    notes: notes || undefined,
    approximate,
    issues,
  }
}

function parseYield(meta: string[]): ParsedQuantity | null {
  const preferred = meta.find((line) => /recorded yield|menu serving|recorded batch|production batch|draft batch|draft serving/i.test(line))
  if (!preferred) return null
  const colon = preferred.indexOf(":")
  let raw = colon >= 0 ? preferred.slice(colon + 1).trim() : preferred
  raw = raw
    .replace(/^about\s+/i, "about ")
    .replace(/^approximately\s+/i, "about ")
    .replace(/^final yield not specified$/i, "Not specified")
  return parseQuantity(raw)
}

function sourceStatus(meta: string[], notes: string[]) {
  const joined = [...meta, ...notes].join(" ").toLowerCase()
  if (/validate|chef confirm|chef review|unresolved|not specified/.test(joined)) return "validate" as const
  if (/draft/.test(joined)) return "draft" as const
  return "recorded" as const
}

function finalizeRecipe(recipe: ParsedRecipeCandidate) {
  const issues: ImportIssue[] = []
  if (!recipe.ingredients.length) {
    issues.push(issue("NO_INGREDIENTS", "No ingredient table was found for this recipe.", "blocked"))
  }
  if (!recipe.yield) {
    issues.push(issue("MISSING_YIELD", "The source does not state a recipe yield or serving quantity."))
  } else {
    issues.push(...recipe.yield.issues.filter((item) => item.severity !== "info"))
  }

  const unresolvedIngredients = recipe.ingredients.filter((ingredient) =>
    ingredient.quantity.issues.some((item) => item.severity !== "info"),
  )
  if (unresolvedIngredients.length) {
    issues.push(issue(
      "INGREDIENT_QUANTITY_REVIEW",
      `${unresolvedIngredients.length} ingredient quantit${unresolvedIngredients.length === 1 ? "y needs" : "ies need"} confirmation.`,
    ))
  }

  if (!recipe.method.length) {
    issues.push(issue("METHOD_NOT_RECORDED", "No preparation method is recorded in the source.", "info"))
  }

  if (recipe.sourceStatus === "draft") {
    issues.push(issue("SOURCE_DRAFT", "The source marks this recipe or serving as draft."))
  }
  if (recipe.sourceStatus === "validate") {
    issues.push(issue("SOURCE_VALIDATE", "The source explicitly requires chef or management validation."))
  }

  recipe.issues = issues
  return recipe
}

export async function parseCookbookDocx(file: File): Promise<{
  importerVersion: string
  recipes: ParsedRecipeCandidate[]
  messages: string[]
}> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Recipe Meta'] => p.recipe-meta:fresh",
        "p[style-name='Recipe Subheading'] => h3.recipe-subheading:fresh",
        "p[style-name='Recipe Note'] => p.recipe-note:fresh",
        "p[style-name='Part Label'] => p.part-label:fresh",
      ],
    },
  )

  const dom = new DOMParser().parseFromString(`<main>${result.value}</main>`, "text/html")
  if (!dom) throw new Error("The Word document could not be parsed.")

  let category = ""
  let current: ParsedRecipeCandidate | null = null
  let methodMode = false
  const recipes: ParsedRecipeCandidate[] = []

  function commit() {
    if (!current) return
    recipes.push(finalizeRecipe(current))
    current = null
    methodMode = false
  }

  for (const element of Array.from(dom.querySelector("main")?.children || [])) {
    const tag = element.tagName.toLowerCase()
    const text = clean(element.textContent || "")
    if (!text && tag !== "table") continue

    if (tag === "h1") {
      commit()
      const nextCategory = clean(text)
      category = SKIP_CATEGORIES.has(nextCategory.toLowerCase()) ? "" : nextCategory
      continue
    }

    if (tag === "h2") {
      commit()
      if (!category) continue
      current = {
        clientId: crypto.randomUUID(),
        name: text,
        category,
        meta: [],
        yield: null,
        ingredients: [],
        method: [],
        kitchenNotes: [],
        sourceStatus: "recorded",
        issues: [],
      }
      continue
    }

    if (!current) continue

    if (element.classList.contains("recipe-meta")) {
      current.meta.push(text)
      continue
    }

    if (element.classList.contains("recipe-subheading")) {
      methodMode = /^procedure$/i.test(text)
      if (!methodMode) current.kitchenNotes.push(text)
      continue
    }

    if (element.classList.contains("recipe-note")) {
      if (methodMode || /^\d+[.)]\s*/.test(text)) {
        current.method.push(text.replace(/^\d+[.)]\s*/, "").trim())
      } else {
        current.kitchenNotes.push(text)
      }
      continue
    }

    if (tag === "table") {
      const rows = Array.from(element.querySelectorAll("tr"))
      for (const [index, row] of rows.entries()) {
        const cells = Array.from(row.querySelectorAll("th,td")).map((cell) => clean(cell.textContent || ""))
        if (cells.length < 2) continue
        const [ingredientName, rawQuantity] = cells
        if (index === 0 && /ingredient|prep/i.test(ingredientName) && /quantity/i.test(rawQuantity)) continue
        if (!ingredientName || !rawQuantity || /^ingredient$/i.test(ingredientName)) continue

        const ingredient: ParsedIngredientCandidate = {
          id: crypto.randomUUID(),
          name: ingredientName,
          rawQuantity,
          quantity: parseQuantity(rawQuantity),
        }
        current.ingredients.push(ingredient)
      }
    }
  }

  commit()

  for (const recipe of recipes) {
    recipe.yield = parseYield(recipe.meta)
    recipe.sourceStatus = sourceStatus(recipe.meta, recipe.kitchenNotes)
    finalizeRecipe(recipe)
  }

  const messages = result.messages.map((message) => clean(message.message)).filter(Boolean)
  return { importerVersion: IMPORTER_VERSION, recipes, messages }
}
