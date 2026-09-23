import { useRef, useState } from "react"
import { CheckCircle2, FileText, FileUp, TriangleAlert } from "lucide-react"

export function ImportScreen() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [fileName, setFileName] = useState("")

  return (
    <main className="content">
      <div className="page-header">
        <div>
          <div className="eyebrow">Document import</div>
          <h1>Import cookbook</h1>
          <p className="subtitle">Upload a Word cookbook, review extraction issues, then publish approved recipes.</p>
        </div>
      </div>

      <button type="button" className="import-drop" onClick={() => inputRef.current?.click()}>
        <input
          ref={inputRef}
          type="file"
          accept=".doc,.docx"
          hidden
          onChange={(event) => setFileName(event.target.files?.[0]?.name || "")}
        />
        <span className="import-icon"><FileUp size={24} /></span>
        <strong>{fileName || "Choose Word cookbook"}</strong>
        <p>{fileName ? "Selected. Parser connection comes in the backend milestone." : "DOCX recipes will be extracted into a review queue before anything is published."}</p>
        <span className="fake-button">{fileName ? "Replace file" : "Select document"}</span>
      </button>

      <section className="list-panel import-review">
        <div className="panel-title">
          <div>
            <strong>Import review</strong>
            <span>Example validation states for the upcoming DOCX parser</span>
          </div>
        </div>
        <div className="validation-row">
          <span className="validation-icon ready"><CheckCircle2 size={17} /></span>
          <span><strong>Beef Pilau</strong><small>Recipe structure complete</small></span>
          <em className="ready-text">Ready</em>
        </div>
        <div className="validation-row">
          <span className="validation-icon ready"><CheckCircle2 size={17} /></span>
          <span><strong>Chicken Biryani</strong><small>Recipe structure complete</small></span>
          <em className="ready-text">Ready</em>
        </div>
        <div className="validation-row">
          <span className="validation-icon review"><TriangleAlert size={17} /></span>
          <span><strong>Maharagwe</strong><small>Missing portion yield</small></span>
          <em className="review-text">Review</em>
        </div>
      </section>

      <div className="info-card">
        <FileText size={18} />
        <div>
          <strong>No blind imports</strong>
          <p>The final importer will always show extracted recipes and errors before saving them to the cookbook.</p>
        </div>
      </div>
    </main>
  )
}
