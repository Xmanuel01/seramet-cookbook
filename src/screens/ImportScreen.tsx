import { useRef, useState } from "react"
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  FileUp,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from "lucide-react"
import { parseCookbookDocx } from "../lib/docx-cookbook-parser"
import {
  commitCookbookImport,
  previewCookbookImport,
  type CookbookImportInput,
} from "../lib/cookbook-repository"
import type {
  CookbookImportCommitReport,
  CookbookImportPreview,
  RecipeImportPreviewRow,
} from "../types"

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function statusIcon(status: RecipeImportPreviewRow["status"]) {
  if (status === "ready") return <CheckCircle2 size={17} />
  if (status === "blocked") return <XCircle size={17} />
  return <TriangleAlert size={17} />
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
  const [error, setError] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [parserMessages, setParserMessages] = useState<string[]>([])

  async function handleFile(file?: File) {
    if (!file) return
    setFileName(file.name)
    setInput(null)
    setPreview(null)
    setReport(null)
    setParserMessages([])
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

  async function importReadyRecipes() {
    if (!input || !preview) return
    const readyIds = preview.rows
      .filter((row) => row.status === "ready")
      .map((row) => row.clientId)

    if (!readyIds.length) {
      setError("There are no fully validated recipes ready to import yet.")
      return
    }

    setCommitting(true)
    setError("")
    setReport(null)

    try {
      const nextReport = await commitCookbookImport(input, readyIds)
      setReport(nextReport)
      await onImported?.()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to import the reviewed recipes.")
    } finally {
      setCommitting(false)
    }
  }

  return (
    <main className="content">
      <div className="page-header">
        <div>
          <div className="eyebrow">Document import</div>
          <h1>Import cookbook</h1>
          <p className="subtitle">Upload the Word cookbook, validate every recipe against Seramet, then import only rows that pass the review gate.</p>
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
            : "DOCX only. Previewing never writes to recipes, inventory, menu or costing."}
        </p>
        <span className="fake-button">{fileName ? "Replace file" : "Select document"}</span>
      </button>

      {error && (
        <div className="import-alert error">
          <XCircle size={18} />
          <div><strong>Cookbook needs attention</strong><span>{error}</span></div>
          <button type="button" onClick={() => inputRef.current?.click()} aria-label="Choose another file"><RefreshCw size={16} /></button>
        </div>
      )}

      {preview && (
        <>
          <section className="import-summary">
            <div><span>Found</span><strong>{preview.recipeCount}</strong><small>recipes</small></div>
            <div className="summary-ready"><span>Ready</span><strong>{preview.readyCount}</strong><small>safe to import</small></div>
            <div className="summary-review"><span>Review</span><strong>{preview.reviewCount}</strong><small>chef confirmation</small></div>
            <div className="summary-blocked"><span>Blocked</span><strong>{preview.blockedCount}</strong><small>cannot import</small></div>
          </section>

          <section className="import-commit-card">
            <div>
              <ShieldCheck size={19} />
              <span>
                <strong>{preview.readyCount} recipe{preview.readyCount === 1 ? "" : "s"} ready</strong>
                <small>Ready rows are committed atomically. Review and blocked rows remain untouched.</small>
              </span>
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={!canImport || preview.readyCount === 0 || committing}
              onClick={() => void importReadyRecipes()}
            >
              {committing && <LoaderCircle className="spin" size={16} />}
              {committing ? "Importing…" : `Import ${preview.readyCount} ready`}
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
              {report.results.some((item) => item.status === "failed") && (
                <div className="issue-list">
                  {report.results.filter((item) => item.status === "failed").map((item) => (
                    <div className="issue-line blocked" key={item.clientId}>
                      <XCircle size={14} />
                      <span>{item.name}: {item.message || "Import failed."}</span>
                    </div>
                  ))}
                </div>
              )}
              <p>Duplicate-safe: uploading the same reviewed document again will skip recipes already committed from the same source fingerprint.</p>
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
              return (
                <div className="import-review-item" key={row.clientId}>
                  <button
                    type="button"
                    className="validation-row import-validation-button"
                    onClick={() => setExpanded(open ? null : row.clientId)}
                  >
                    <span className={"validation-icon " + row.status}>{statusIcon(row.status)}</span>
                    <span>
                      <strong>{row.name}</strong>
                      <small>{row.category} · {row.ingredients.length} ingredients · {row.recipeMatch === "new" ? "new Seramet recipe" : row.recipeMatch.replaceAll("-", " ")}</small>
                    </span>
                    <span className="import-row-end">
                      <em className={row.status + "-text"}>{row.status}</em>
                      {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </span>
                  </button>

                  {open && (
                    <div className="import-row-details">
                      <div className="import-detail-grid">
                        <div><span>Source status</span><strong>{row.sourceStatus}</strong></div>
                        <div><span>Yield</span><strong>{row.yield?.raw || "Not recorded"}</strong></div>
                        <div><span>Method</span><strong>{row.method.length ? row.method.length + " steps" : "Not recorded"}</strong></div>
                        <div><span>Inventory matches</span><strong>{row.ingredientMatches.filter((item) => item.match === "existing").length}/{row.ingredientMatches.length}</strong></div>
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

                      <div className="ingredient-preview">
                        {row.ingredients.slice(0, 10).map((ingredient) => (
                          <div key={ingredient.id}>
                            <span>{ingredient.name}</span>
                            <strong>{ingredient.rawQuantity}</strong>
                          </div>
                        ))}
                        {row.ingredients.length > 10 && <small>+ {row.ingredients.length - 10} more ingredients</small>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </section>

          <div className="info-card">
            <ShieldCheck size={18} />
            <div>
              <strong>Authoritative import boundary</strong>
              <p>Ready rows create or match Seramet inventory items, non-sellable cookbook menu placeholders, governed recipe versions and cookbook content. Draft, approximate, ranged, missing or unknown quantities remain in review.</p>
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
