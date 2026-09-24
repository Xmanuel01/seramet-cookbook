import { useRef, useState } from "react"
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  FileUp,
  LoaderCircle,
  PencilLine,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from "lucide-react"
import {
  parseCookbookDocx,
  parseQuantity,
  revalidateRecipeCandidate,
} from "../lib/docx-cookbook-parser"
import {
  commitCookbookImport,
  previewCookbookImport,
  type CookbookImportInput,
} from "../lib/cookbook-repository"
import type {
  CookbookImportCommitReport,
  CookbookImportPreview,
  ParsedRecipeCandidate,
  RecipeImportPreviewRow,
} from "../types"

type ResolutionDraft = {
  yieldRaw: string
  ingredientRaw: Record<string, string>
  acceptSourceStatus: boolean
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function statusIcon(status: RecipeImportPreviewRow["status"]) {
  if (status === "ready") return <CheckCircle2 size={17} />
  if (status === "blocked") return <XCircle size={17} />
  return <TriangleAlert size={17} />
}

function makeResolutionDraft(row: RecipeImportPreviewRow): ResolutionDraft {
  return {
    yieldRaw: row.yield?.raw || "",
    ingredientRaw: Object.fromEntries(row.ingredients.map((ingredient) => [ingredient.id, ingredient.rawQuantity])),
    acceptSourceStatus: row.sourceStatus === "recorded",
  }
}

function hasReviewIssue(row: RecipeImportPreviewRow, code: string) {
  return row.issues.some((issue) => issue.code === code)
}

export function ImportScreen({
  canImport = false,
  onImported,
}: {
  canImport?: boolean
  onImported?: () => Promise<void> | void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [fileName, setFileName] = useState("")
  const [input, setInput] = useState<CookbookImportInput | null>(null)
  const [preview, setPreview] = useState<CookbookImportPreview | null>(null)
  const [report, setReport] = useState<CookbookImportCommitReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [recheckingId, setRecheckingId] = useState<string | null>(null)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [parserMessages, setParserMessages] = useState<string[]>([])
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, ResolutionDraft>>({})
  const [importedClientIds, setImportedClientIds] = useState<string[]>([])

  async function handleFile(file?: File) {
    if (!file) return
    setFileName(file.name)
    setInput(null)
    setPreview(null)
    setReport(null)
    setParserMessages([])
    setResolutionDrafts({})
    setImportedClientIds([])
    setError("")
    setBusy(true)

    try {
      if (!/\.docx$/i.test(file.name)) {
        throw new Error("Please upload a .docx Word document. Legacy .doc files are not imported because their structure cannot be validated safely in the browser.")
      }
      if (file.size > 8 * 1024 * 1024) {
        throw new Error("This Word document is larger than the 8 MB cookbook import limit.")
      }

      const [parsed, fileHash] = await Promise.all([
        parseCookbookDocx(file),
        sha256(file),
      ])

      if (!parsed.recipes.length) {
        throw new Error("No recipes were found. The importer expects Word Heading 1 categories, Heading 2 recipe names and ingredient tables.")
      }

      const nextInput: CookbookImportInput = {
        fileName: file.name,
        fileHash,
        importerVersion: parsed.importerVersion,
        recipes: parsed.recipes,
      }
      const nextPreview = await previewCookbookImport(nextInput)
      setInput(nextInput)
      setPreview(nextPreview)
      setParserMessages(parsed.messages)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to analyse the cookbook.")
    } finally {
      setBusy(false)
    }
  }

  function toggleExpanded(row: RecipeImportPreviewRow) {
    const next = expanded === row.clientId ? null : row.clientId
    setExpanded(next)
    if (next && !resolutionDrafts[row.clientId]) {
      setResolutionDrafts((current) => ({
        ...current,
        [row.clientId]: makeResolutionDraft(row),
      }))
    }
  }

  function updateResolution(row: RecipeImportPreviewRow, patch: Partial<ResolutionDraft>) {
    setResolutionDrafts((current) => ({
      ...current,
      [row.clientId]: {
        ...(current[row.clientId] || makeResolutionDraft(row)),
        ...patch,
      },
    }))
  }

  function updateIngredientResolution(row: RecipeImportPreviewRow, ingredientId: string, raw: string) {
    const draft = resolutionDrafts[row.clientId] || makeResolutionDraft(row)
    updateResolution(row, {
      ingredientRaw: {
        ...draft.ingredientRaw,
        [ingredientId]: raw,
      },
    })
  }

  async function recheckRecipe(row: RecipeImportPreviewRow) {
    if (!input) return
    const draft = resolutionDrafts[row.clientId] || makeResolutionDraft(row)
    setRecheckingId(row.clientId)
    setError("")
    setReport(null)

    try {
      const recipes = input.recipes.map((recipe): ParsedRecipeCandidate => {
        if (recipe.clientId !== row.clientId) return recipe

        const ingredients = recipe.ingredients.map((ingredient) => {
          const raw = (draft.ingredientRaw[ingredient.id] ?? ingredient.rawQuantity).trim()
          return {
            ...ingredient,
            rawQuantity: raw,
            quantity: parseQuantity(raw),
          }
        })

        const yieldRaw = draft.yieldRaw.trim()
        const next: ParsedRecipeCandidate = {
          ...recipe,
          ingredients,
          yield: yieldRaw ? parseQuantity(yieldRaw) : null,
          sourceStatus: draft.acceptSourceStatus ? "recorded" : recipe.sourceStatus,
          issues: [],
        }

        return revalidateRecipeCandidate(next)
      })

      const nextInput = { ...input, recipes }
      const nextPreview = await previewCookbookImport(nextInput)
      setInput(nextInput)
      setPreview(nextPreview)

      const refreshed = nextPreview.rows.find((candidate) => candidate.clientId === row.clientId)
      if (refreshed) {
        setResolutionDrafts((current) => ({
          ...current,
          [row.clientId]: makeResolutionDraft(refreshed),
        }))
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to recheck this recipe.")
    } finally {
      setRecheckingId(null)
    }
  }

  async function commitSelected(selectedClientIds: string[]) {
    if (!input || !preview || selectedClientIds.length === 0) return
    setCommitting(true)
    setError("")
    setReport(null)

    try {
      const nextReport = await commitCookbookImport(input, selectedClientIds)
      setReport(nextReport)
      setImportedClientIds((current) => [
        ...new Set([
          ...current,
          ...nextReport.results
            .filter((item) => item.status === "imported" || item.status === "skipped")
            .map((item) => item.clientId),
        ]),
      ])
      await onImported?.()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to import the reviewed recipe.")
    } finally {
      setCommitting(false)
      setImportingId(null)
    }
  }

  async function importReadyRecipes() {
    if (!preview) return
    const readyIds = preview.rows
      .filter((row) => row.status === "ready" && !importedClientIds.includes(row.clientId))
      .map((row) => row.clientId)

    if (!readyIds.length) {
      setError("There are no unimported Ready recipes left in this review.")
      return
    }

    await commitSelected(readyIds)
  }

  async function importOne(row: RecipeImportPreviewRow) {
    if (row.status !== "ready") return
    setImportingId(row.clientId)
    await commitSelected([row.clientId])
  }

  return (
    <main className="content">
      <div className="page-header">
        <div>
          <div className="eyebrow">Document import</div>
          <h1>Import cookbook</h1>
          <p className="subtitle">Review, correct and recheck recipes individually. Only green rows can enter Seramet.</p>
        </div>
      </div>

      <button type="button" className="import-drop" disabled={busy || committing} onClick={() => inputRef.current?.click()}>
        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          hidden
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        <span className="import-icon">{busy ? <LoaderCircle className="spin" size={24} /> : <FileUp size={24} />}</span>
        <strong>{busy ? "Analysing cookbook…" : fileName || "Choose Word cookbook"}</strong>
        <p>
          {busy
            ? "Reading headings, ingredient tables, yields and recorded procedures, then matching them to Seramet."
            : "DOCX only. Previewing and editing the review never writes to Seramet until you press Import."}
        </p>
        <span className="fake-button">{fileName ? "Replace file" : "Select document"}</span>
      </button>

      {error && (
        <div className="import-alert error">
          <XCircle size={18} />
          <div><strong>Cookbook needs attention</strong><span>{error}</span></div>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error"><XCircle size={16} /></button>
        </div>
      )}

      {preview && (
        <>
          <section className="import-summary">
            <div><span>Found</span><strong>{preview.recipeCount}</strong><small>recipes</small></div>
            <div className="summary-ready"><span>Ready</span><strong>{preview.readyCount}</strong><small>safe to import</small></div>
            <div className="summary-review"><span>Review</span><strong>{preview.reviewCount}</strong><small>needs resolution</small></div>
            <div className="summary-blocked"><span>Blocked</span><strong>{preview.blockedCount}</strong><small>cannot import</small></div>
          </section>

          <section className="import-commit-card">
            <div>
              <ShieldCheck size={19} />
              <span>
                <strong>Test one recipe before bulk import</strong>
                <small>Open a green recipe and use “Import this recipe” first. Bulk import remains available after the single-recipe test succeeds.</small>
              </span>
            </div>
            <button
              type="button"
              className="secondary-button"
              disabled={!canImport || preview.readyCount === 0 || committing}
              onClick={() => void importReadyRecipes()}
            >
              {committing && !importingId && <LoaderCircle className="spin" size={16} />}
              Import all Ready
            </button>
            {!canImport && <p>Your Seramet role needs cookbook publish and Cost Control manage permission to commit authoritative recipes.</p>}
          </section>

          {report && (
            <section className="import-report">
              <div className="import-report-summary">
                <div><span>Imported</span><strong>{report.importedCount}</strong></div>
                <div><span>Skipped</span><strong>{report.skippedCount}</strong></div>
                <div><span>Failed</span><strong>{report.failedCount}</strong></div>
              </div>
              <div className="import-result-lines">
                {report.results.map((item) => (
                  <div className={"import-result-line " + item.status} key={item.clientId}>
                    {item.status === "failed" || item.verification?.verified === false
                      ? <XCircle size={14} />
                      : <CheckCircle2 size={14} />}
                    <span>
                      <strong>{item.name}</strong>
                      {item.verification
                        ? item.verification.verified
                          ? " · Seramet chain verified"
                          : " · Imported, but post-import verification needs attention"
                        : item.message
                          ? " · " + item.message
                          : ""}
                    </span>
                  </div>
                ))}
              </div>
              <p>Duplicate-safe: importing the same recipe from the same document fingerprint again returns “skipped” instead of creating another recipe.</p>
            </section>
          )}

          <section className="list-panel import-review">
            <div className="panel-title">
              <div>
                <strong>Import review</strong>
                <span>{preview.fileName} · {preview.importerVersion}</span>
              </div>
            </div>

            {preview.rows.map((row) => {
              const open = expanded === row.clientId
              const draft = resolutionDrafts[row.clientId] || makeResolutionDraft(row)
              const unresolvedIngredients = row.ingredients.filter((ingredient) =>
                ingredient.quantity.issues.some((issue) => issue.severity !== "info"),
              )
              const yieldNeedsEdit =
                !row.yield ||
                Boolean(row.yield.issues.some((issue) => issue.severity !== "info")) ||
                hasReviewIssue(row, "MISSING_YIELD")
              const sourceStatusNeedsApproval =
                hasReviewIssue(row, "SOURCE_DRAFT") ||
                hasReviewIssue(row, "SOURCE_VALIDATE")
              const hasPreparedMapping = hasReviewIssue(row, "PREPARED_COMPONENT_MAPPING_REQUIRED")
              const imported = importedClientIds.includes(row.clientId)

              return (
                <div className="import-review-item" key={row.clientId}>
                  <button
                    type="button"
                    className="validation-row import-validation-button"
                    onClick={() => toggleExpanded(row)}
                  >
                    <span className={"validation-icon " + row.status}>{statusIcon(row.status)}</span>
                    <span>
                      <strong>{row.name}</strong>
                      <small>{row.category} · {row.ingredients.length} ingredients · {row.recipeMatch === "new" ? "new Seramet recipe" : row.recipeMatch.replaceAll("-", " ")}</small>
                    </span>
                    <span className="import-row-end">
                      <em className={row.status + "-text"}>{imported ? "imported" : row.status}</em>
                      {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </span>
                  </button>

                  {open && (
                    <div className="import-row-details">
                      <div className="import-detail-grid">
                        <div><span>Source status</span><strong>{row.sourceStatus}</strong></div>
                        <div><span>Yield</span><strong>{row.yield?.raw || "Not recorded"}</strong></div>
                        <div><span>Method</span><strong>{row.method.length ? row.method.length + " steps" : "Not recorded"}</strong></div>
                        <div>
                          <span>Inventory plan</span>
                          <strong>
                            {row.ingredientMatches.filter((item) => item.match === "existing").length} existing · {row.ingredientMatches.filter((item) => item.match === "create-candidate").length} new
                          </strong>
                        </div>
                      </div>

                      {row.issues.length > 0 ? (
                        <div className="issue-list">
                          {row.issues.map((item, index) => (
                            <div className={"issue-line " + item.severity} key={item.code + index}>
                              <TriangleAlert size={14} />
                              <span>{item.message}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="issue-line ready"><CheckCircle2 size={14} /><span>All required quantities, units and yield information are structurally ready.</span></div>
                      )}

                      {(yieldNeedsEdit || unresolvedIngredients.length > 0 || sourceStatusNeedsApproval) && (
                        <section className="review-resolver">
                          <div className="review-resolver-title">
                            <PencilLine size={16} />
                            <div>
                              <strong>Resolve this recipe</strong>
                              <span>Corrections stay in this import session until the row passes recheck.</span>
                            </div>
                          </div>

                          {yieldNeedsEdit && (
                            <label className="review-field">
                              <span>Exact yield / serving</span>
                              <input
                                value={draft.yieldRaw}
                                onChange={(event) => updateResolution(row, { yieldRaw: event.target.value })}
                                placeholder="e.g. 20 portions, 5 kg, 12 pcs"
                              />
                              <small>Enter one exact quantity and supported unit. Do not use ranges or “about”.</small>
                            </label>
                          )}

                          {unresolvedIngredients.length > 0 && (
                            <div className="review-ingredient-editor">
                              <strong>Ingredient quantities needing confirmation</strong>
                              {unresolvedIngredients.map((ingredient) => (
                                <label key={ingredient.id}>
                                  <span>{ingredient.name}</span>
                                  <input
                                    value={draft.ingredientRaw[ingredient.id] ?? ingredient.rawQuantity}
                                    onChange={(event) => updateIngredientResolution(row, ingredient.id, event.target.value)}
                                    placeholder="Exact quantity + unit"
                                  />
                                </label>
                              ))}
                            </div>
                          )}

                          {sourceStatusNeedsApproval && (
                            <label className="review-approval">
                              <input
                                type="checkbox"
                                checked={draft.acceptSourceStatus}
                                onChange={(event) => updateResolution(row, { acceptSourceStatus: event.target.checked })}
                              />
                              <span>
                                <strong>Approve source status as recorded</strong>
                                <small>I have reviewed the cookbook’s draft/validation note for this recipe. This does not override unresolved quantities or prepared-component mappings.</small>
                              </span>
                            </label>
                          )}

                          <button
                            type="button"
                            className="secondary-button"
                            disabled={recheckingId === row.clientId}
                            onClick={() => void recheckRecipe(row)}
                          >
                            {recheckingId === row.clientId && <LoaderCircle className="spin" size={15} />}
                            Recheck recipe
                          </button>
                        </section>
                      )}

                      {hasPreparedMapping && (
                        <div className="review-governed-note">
                          <ShieldCheck size={16} />
                          <div>
                            <strong>Prepared component needs a sub-recipe link</strong>
                            <span>This cannot be bypassed with approval. We’ll map it to an existing/imported Seramet recipe so Cost Control consumes the prepared recipe rather than creating it as raw stock.</span>
                          </div>
                        </div>
                      )}

                      <div className="ingredient-preview">
                        {row.ingredients.slice(0, 12).map((ingredient) => (
                          <div key={ingredient.id}>
                            <span>{ingredient.name}</span>
                            <strong>{ingredient.rawQuantity}</strong>
                          </div>
                        ))}
                        {row.ingredients.length > 12 && <small>+ {row.ingredients.length - 12} more ingredients</small>}
                      </div>

                      {row.status === "ready" && (
                        <div className="single-import-bar">
                          <div>
                            <strong>{imported ? "Recipe already tested/imported" : "Ready for single-recipe test"}</strong>
                            <span>{imported ? "The source fingerprint prevents duplicates." : "This commits only this recipe, its governed version and its components."}</span>
                          </div>
                          <button
                            type="button"
                            className="primary-button"
                            disabled={!canImport || imported || committing}
                            onClick={() => void importOne(row)}
                          >
                            {importingId === row.clientId && <LoaderCircle className="spin" size={15} />}
                            {imported ? "Imported & verified" : "Import this recipe"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </section>

          <div className="info-card">
            <ShieldCheck size={18} />
            <div>
              <strong>Review rules stay enforced</strong>
              <p>Approving a draft status does not approve missing quantities, ranges, approximate measurements or prepared components. Those require an exact correction or governed sub-recipe mapping.</p>
            </div>
          </div>
        </>
      )}

      {!preview && !error && !busy && (
        <div className="info-card">
          <FileText size={18} />
          <div>
            <strong>No blind imports</strong>
            <p>The importer reads the actual Word structure and keeps missing quantities, draft notes and chef-confirmation warnings visible rather than replacing them with guessed values.</p>
          </div>
        </div>
      )}

      {parserMessages.length > 0 && (
        <details className="parser-messages">
          <summary>Word parser notes ({parserMessages.length})</summary>
          {parserMessages.map((message, index) => <p key={index}>{message}</p>)}
        </details>
      )}
    </main>
  )
}
