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
import { previewCookbookImport } from "../lib/cookbook-repository"
import type { CookbookImportPreview, RecipeImportPreviewRow } from "../types"

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function statusIcon(status: RecipeImportPreviewRow["status"]) {
  if (status === "ready") return <CheckCircle2 size={17} />
  if (status === "blocked") return <XCircle size={17} />
  return <TriangleAlert size={17} />
}

export function ImportScreen() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [fileName, setFileName] = useState("")
  const [preview, setPreview] = useState<CookbookImportPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [parserMessages, setParserMessages] = useState<string[]>([])

  async function handleFile(file?: File) {
    if (!file) return
    setFileName(file.name)
    setPreview(null)
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

      const nextPreview = await previewCookbookImport({
        fileName: file.name,
        fileHash,
        importerVersion: parsed.importerVersion,
        recipes: parsed.recipes,
      })
      setPreview(nextPreview)
      setParserMessages(parsed.messages)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to analyse the cookbook.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="content">
      <div className="page-header">
        <div>
          <div className="eyebrow">Document import</div>
          <h1>Import cookbook</h1>
          <p className="subtitle">Upload the Word cookbook, validate every recipe against Seramet, then resolve review items before any authoritative recipe is created.</p>
        </div>
      </div>

      <button type="button" className="import-drop" disabled={busy} onClick={() => inputRef.current?.click()}>
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
            : "DOCX only. Nothing is written to recipes, inventory or costing during this review step."}
        </p>
        <span className="fake-button">{fileName ? "Replace file" : "Select document"}</span>
      </button>

      {error && (
        <div className="import-alert error">
          <XCircle size={18} />
          <div><strong>Import could not be reviewed</strong><span>{error}</span></div>
          <button type="button" onClick={() => inputRef.current?.click()} aria-label="Choose another file"><RefreshCw size={16} /></button>
        </div>
      )}

      {preview && (
        <>
          <section className="import-summary">
            <div><span>Found</span><strong>{preview.recipeCount}</strong><small>recipes</small></div>
            <div className="summary-ready"><span>Ready</span><strong>{preview.readyCount}</strong><small>structured</small></div>
            <div className="summary-review"><span>Review</span><strong>{preview.reviewCount}</strong><small>needs confirmation</small></div>
            <div className="summary-blocked"><span>Blocked</span><strong>{preview.blockedCount}</strong><small>cannot commit</small></div>
          </section>

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
                        <div className="issue-line ready"><CheckCircle2 size={14} /><span>Structure is complete enough for the next commit/mapping stage.</span></div>
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
              <strong>Review gate is active</strong>
              <p>Ready means the Word structure is usable. Review/blocked rows are not written to Seramet. The next commit stage will also require unit and inventory mapping before recipes become authoritative.</p>
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
