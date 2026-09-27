import { useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock3, Pause, Play, RotateCcw } from "lucide-react";
import type { Recipe } from "../types";
import { scaleQuantity } from "../lib/recipe-scaling";

type Phase = "prep" | "cook" | "complete";

/**
 * Client-only guided cooking session. Nothing is posted to Seramet or inventory.
 * The parent remounts this component for each approved batch calculation.
 */
export function KitchenProductionMode({
  recipe,
  factor,
  batchLabel,
  onExit,
}: {
  recipe: Recipe;
  factor: number;
  batchLabel: string;
  onExit: () => void;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("prep");
  const [stepIndex, setStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(Math.max(0, Math.round(recipe.cookMinutes * 60)));
  const [deadline, setDeadline] = useState<number | null>(null);
  const [timerDone, setTimerDone] = useState(false);

  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setDeadline(null);
        setTimerDone(true);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [deadline]);

  const ambiguous = recipe.ingredients.filter((item) => scaleQuantity(item.quantity, factor) === null);
  const count = recipe.ingredients.length;
  const ready = checked.length === count && ambiguous.every((item) => reviewed.includes(item.id));
  const progress = count > 0 ? Math.round((checked.length / count) * 100) : 100;
  const steps = recipe.method;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  function toggle(id: string) {
    setChecked((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function resetTimer() {
    setDeadline(null);
    setSecondsLeft(Math.max(0, Math.round(recipe.cookMinutes * 60)));
    setTimerDone(false);
  }

  function toggleTimer() {
    if (deadline !== null) {
      setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
      setDeadline(null);
    } else if (secondsLeft > 0) {
      setDeadline(Date.now() + secondsLeft * 1000);
      setTimerDone(false);
    }
  }

  return (
    <section className="kitchen-mode" aria-label="Guided kitchen production">
      <header className="kitchen-mode-top">
        <button type="button" className="back-button" onClick={onExit}>
          <ArrowLeft size={17} /> Batch calculator
        </button>
        <span className="kitchen-phase-badge">{phase === "prep" ? "1 · Prepare" : phase === "cook" ? "2 · Cook" : "3 · Done"}</span>
      </header>
      <div className="kitchen-mode-title">
        <span className="eyebrow">Kitchen production · This device only</span>
        <h2>{recipe.name}</h2>
        <p>{batchLabel}</p>
      </div>

      {phase === "prep" && (
        <>
          <div className="kitchen-progress" aria-label={`Ingredients measured: ${checked.length} of ${count}`}>
            <div><strong>Measure ingredients</strong><span>{checked.length}/{count} ready</span></div>
            <progress max={Math.max(1, count)} value={checked.length}>{progress}%</progress>
          </div>
          <div className="kitchen-checklist">
            {recipe.ingredients.map((item) => {
              const scaled = scaleQuantity(item.quantity, factor);
              const uncertain = scaled === null;
              return (
                <div className="kitchen-check-row" key={item.id}>
                  <label>
                    <input type="checkbox" checked={checked.includes(item.id)} onChange={() => toggle(item.id)} />
                    <span className="kitchen-check-content">
                      <strong>{item.name}</strong>
                      <small>{scaled ?? item.quantity}{uncertain ? " · Verify quantity" : ""}</small>
                    </span>
                  </label>
                  {uncertain && (
                    <label className="kitchen-review">
                      <input
                        type="checkbox"
                        checked={reviewed.includes(item.id)}
                        onChange={() => setReviewed((current) => current.includes(item.id) ? current.filter((value) => value !== item.id) : [...current, item.id])}
                      />
                      Chef verified
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          {!ready && <p className="kitchen-hint">Check all measured ingredients{ambiguous.length ? " and verify any uncertain quantities" : ""} before starting.</p>}
          <button type="button" className="primary-button kitchen-main-action" disabled={!ready} onClick={() => setPhase("cook")}>
            Start cooking <ChevronRight size={19} />
          </button>
        </>
      )}

      {phase === "cook" && (
        <>
          <div className="kitchen-timer">
            <div className="kitchen-timer-heading"><Clock3 size={18} /> Optional total cook timer</div>
            <strong role="timer" aria-live="off">{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</strong>
            <div className="kitchen-timer-actions">
              <button type="button" className="secondary-button" onClick={toggleTimer} disabled={secondsLeft === 0}>
                {deadline !== null ? <Pause size={17} /> : <Play size={17} />}
                {deadline !== null ? "Pause" : "Start timer"}
              </button>
              <button type="button" className="secondary-button" onClick={resetTimer}><RotateCcw size={16} /> Reset</button>
            </div>
            {timerDone && <p role="status">Timer finished. Confirm cooking is complete before serving.</p>}
            <small>Uses the recipe's total cook time, not estimated timings for individual steps.</small>
          </div>
          {steps.length ? (
            <div className="kitchen-step">
              <div className="kitchen-step-meta">Step {stepIndex + 1} of {steps.length}</div>
              <progress value={completedSteps.length} max={steps.length}>{completedSteps.length}/{steps.length}</progress>
              <p>{steps[stepIndex]}</p>
              <label className="kitchen-step-done">
                <input type="checkbox" checked={completedSteps.includes(stepIndex)} onChange={() => setCompletedSteps((current) => current.includes(stepIndex) ? current.filter((value) => value !== stepIndex) : [...current, stepIndex])} />
                Step complete
              </label>
              <div className="kitchen-step-actions">
                <button type="button" className="secondary-button" onClick={() => setStepIndex((current) => Math.max(0, current - 1))} disabled={stepIndex === 0}><ChevronLeft size={18} /> Previous</button>
                {stepIndex < steps.length - 1 ? (
                  <button type="button" className="primary-button" onClick={() => setStepIndex((current) => current + 1)} disabled={!completedSteps.includes(stepIndex)}>Next <ChevronRight size={18} /></button>
                ) : (
                  <button type="button" className="primary-button" disabled={completedSteps.length !== steps.length} onClick={() => { setDeadline(null); setPhase("complete"); }}><Check size={18} /> Finish</button>
                )}
              </div>
            </div>
          ) : (
            <div className="kitchen-step">
              <p>No verified cooking steps are recorded for this recipe. Ask your kitchen supervisor for the approved method.</p>
              <button type="button" className="secondary-button" onClick={onExit}>Return to recipe</button>
            </div>
          )}
          {recipe.notes && <details className="kitchen-notes"><summary>Chef notes</summary><p>{recipe.notes}</p></details>}
        </>
      )}

      {phase === "complete" && (
        <div className="kitchen-complete">
          <Check size={38} aria-hidden="true" />
          <h2>Steps completed</h2>
          <p>Measured ingredients and cooking steps are checked on this device. This is not an official production or inventory record.</p>
          <button type="button" className="primary-button kitchen-main-action" onClick={onExit}>Back to recipe</button>
        </div>
      )}
    </section>
  );
}
