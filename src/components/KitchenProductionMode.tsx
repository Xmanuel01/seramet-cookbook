import { useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock3, Pause, Play, RotateCcw } from "lucide-react";
import type { Recipe } from "../types";
import { scaleQuantity } from "../lib/recipe-scaling";
import { clearKitchenDraft, saveKitchenDraft, type KitchenDraft } from "../lib/kitchen-draft";

type Phase = "prep" | "cook" | "complete";

export function KitchenProductionMode({
  recipe, factor, batchLabel, onExit, draftKey, fingerprint, basis, target, unit, initialDraft,
}: {
  recipe: Recipe;
  factor: number;
  batchLabel: string;
  onExit: () => void;
  /** Omitted in sample/demo mode, which never writes persistent data. */
  draftKey?: string;
  fingerprint: string;
  basis: string;
  target: string;
  unit: string;
  initialDraft?: KitchenDraft | null;
}) {
  const maxSeconds = Math.max(0, Math.round(recipe.cookMinutes * 60));
  const [checked, setChecked] = useState<string[]>(initialDraft?.checked ?? []);
  const [reviewed, setReviewed] = useState<string[]>(initialDraft?.verified ?? []);
  const [phase, setPhase] = useState<Phase>(initialDraft?.phase ?? "prep");
  const [stepIndex, setStepIndex] = useState(initialDraft?.stepIndex ?? 0);
  const [completedSteps, setCompletedSteps] = useState<number[]>(initialDraft?.completedSteps ?? []);
  const [secondsLeft, setSecondsLeft] = useState(() => initialDraft?.deadline != null
    ? Math.max(0, Math.ceil((initialDraft.deadline - Date.now()) / 1000))
    : initialDraft?.secondsLeft ?? maxSeconds);
  const [deadline, setDeadline] = useState<number | null>(() =>
    initialDraft?.deadline != null && initialDraft.deadline > Date.now() ? initialDraft.deadline : null);
  const [timerDone, setTimerDone] = useState(() => Boolean(initialDraft?.deadline && initialDraft.deadline <= Date.now()));
  const [saveFailed, setSaveFailed] = useState(false);

  // Clock deadline, not interval counters: switching tabs does not make the timer drift.
  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) { setDeadline(null); setTimerDone(true); }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [deadline]);

  // Checkpoints are scoped to authenticated tenant/user/recipe and invalidated if
  // recipe ingredients, directions or version change. Not an official batch log.
  useEffect(() => {
    if (!draftKey) return;
    if (phase === "complete") { clearKitchenDraft(draftKey); return; }
    const draft: KitchenDraft = {
      schema: 1, recipeId: recipe.id, recipeVersion: recipe.recipeVersionId ?? "local",
      fingerprint, basis, target, unit, checked, verified: reviewed, phase,
      completedSteps, stepIndex, secondsLeft, deadline, savedAt: Date.now(),
    };
    if (!saveKitchenDraft(draftKey, draft)) setSaveFailed(true);
  }, [draftKey, recipe.id, recipe.recipeVersionId, fingerprint, basis, target, unit,
    checked, reviewed, phase, completedSteps, stepIndex, secondsLeft, deadline]);

  const ambiguous = recipe.ingredients.filter((item) => scaleQuantity(item.quantity, factor) === null);
  const ready = recipe.ingredients.length > 0 && checked.length === recipe.ingredients.length &&
    ambiguous.every((item) => reviewed.includes(item.id));
  const steps = recipe.method;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  function toggle(id: string) {
    setChecked((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }
  function resetTimer() {
    setDeadline(null);
    setSecondsLeft(maxSeconds);
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
  function finish() {
    setDeadline(null);
    setPhase("complete");
    if (draftKey) clearKitchenDraft(draftKey);
  }
  function startOver() {
    if (!window.confirm("Discard this unfinished kitchen checklist and start again?")) return;
    setDeadline(null);
    setSecondsLeft(maxSeconds);
    setTimerDone(false);
    setChecked([]);
    setReviewed([]);
    setCompletedSteps([]);
    setStepIndex(0);
    setPhase("prep");
    if (draftKey) clearKitchenDraft(draftKey);
  }

  return (
    <section className="kitchen-mode" aria-label="Guided kitchen production">
      <header className="kitchen-mode-top">
        <button type="button" className="back-button" onClick={onExit}><ArrowLeft size={17}/> Batch calculator</button>
        <span className="kitchen-phase-badge">
          {phase === "prep" ? "1 · Prepare" : phase === "cook" ? "2 · Cook" : "3 · Done"}
        </span>
      </header>
      <div className="kitchen-mode-title">
        <span className="eyebrow">Guided cooking · Not an official production record</span>
        <h2>{recipe.name}</h2>
        <p>{batchLabel}</p>
        {draftKey && <small className="kitchen-draft-note">Progress saved on this browser for up to 24 hours.</small>}
        {saveFailed && <p className="batch-caution" role="alert">Your browser could not save progress. Keep this page open until you finish.</p>}
      </div>

      {phase === "prep" && (
        <>
          <div className="kitchen-progress">
            <div><strong>Measure ingredients</strong><span>{checked.length}/{recipe.ingredients.length} ready</span></div>
            <progress max={Math.max(1, recipe.ingredients.length)} value={checked.length}>
              {checked.length} of {recipe.ingredients.length}
            </progress>
          </div>
          <div className="kitchen-checklist">
            {recipe.ingredients.map((item) => {
              const calculated = scaleQuantity(item.quantity, factor);
              const uncertain = calculated === null;
              return (
                <div className="kitchen-check-row" key={item.id}>
                  <label>
                    <input type="checkbox" checked={checked.includes(item.id)} onChange={() => toggle(item.id)}/>
                    <span className="kitchen-check-content">
                      <strong>{item.name}</strong>
                      <small>{calculated ?? item.quantity}{uncertain ? " · Manual quantity review" : ""}</small>
                    </span>
                  </label>
                  {uncertain && <label className="kitchen-review">
                    <input
                      type="checkbox"
                      checked={reviewed.includes(item.id)}
                      onChange={() => setReviewed((current) => current.includes(item.id)
                        ? current.filter((value) => value !== item.id) : [...current, item.id])}
                    />
                    Quantity manually confirmed
                  </label>}
                </div>
              );
            })}
          </div>
          {!ready && <p className="kitchen-hint">Measure every ingredient{ambiguous.length > 0 ? " and confirm uncertain amounts" : ""} to continue.</p>}
          <button type="button" className="primary-button kitchen-main-action"
            disabled={!ready || steps.length === 0} onClick={() => setPhase("cook")}>
            Start cooking <ChevronRight size={19}/>
          </button>
          <button type="button" className="kitchen-discard" onClick={startOver}>Reset checklist</button>
        </>
      )}

      {phase === "cook" && (
        <>
          <div className="kitchen-timer">
            <div className="kitchen-timer-heading"><Clock3 size={18}/> Optional total cook timer</div>
            <strong role="timer" aria-live="off">{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</strong>
            <div className="kitchen-timer-actions">
              <button type="button" className="secondary-button" onClick={toggleTimer} disabled={secondsLeft === 0}>
                {deadline !== null ? <Pause size={17}/> : <Play size={17}/>}
                {deadline !== null ? "Pause" : "Start timer"}
              </button>
              <button type="button" className="secondary-button" onClick={resetTimer}><RotateCcw size={16}/> Reset</button>
            </div>
            {timerDone && <p role="status">Timer finished. Verify food safety and doneness before serving.</p>}
            <small>A timer is a reminder, not a food safety or cooking-temperature check.</small>
          </div>
          {steps.length > 0 && <div className="kitchen-step">
            <div className="kitchen-step-meta">Step {stepIndex + 1} of {steps.length}</div>
            <progress value={completedSteps.length} max={steps.length}/>
            <p>{steps[stepIndex]}</p>
            <label className="kitchen-step-done">
              <input type="checkbox" checked={completedSteps.includes(stepIndex)}
                onChange={() => setCompletedSteps((current) => current.includes(stepIndex)
                  ? current.filter((index) => index !== stepIndex) : [...current, stepIndex])}/>
              Step complete
            </label>
            <div className="kitchen-step-actions">
              <button type="button" className="secondary-button"
                disabled={stepIndex === 0} onClick={() => setStepIndex((current) => current - 1)}>
                <ChevronLeft size={18}/> Previous
              </button>
              {stepIndex < steps.length - 1 ? (
                <button type="button" className="primary-button"
                  disabled={!completedSteps.includes(stepIndex)} onClick={() => setStepIndex((current) => current + 1)}>
                  Next <ChevronRight size={18}/>
                </button>
              ) : (
                <button type="button" className="primary-button"
                  disabled={completedSteps.length !== steps.length} onClick={finish}>
                  <Check size={18}/> Complete steps
                </button>
              )}
            </div>
          </div>}
          {recipe.notes && <details className="kitchen-notes"><summary>Chef notes</summary><p>{recipe.notes}</p></details>}
          <button type="button" className="kitchen-discard" onClick={startOver}>Discard progress and restart</button>
        </>
      )}

      {phase === "complete" && (
        <div className="kitchen-complete">
          <Check size={38} aria-hidden="true"/>
          <h2>Instructions completed</h2>
          <p>Checklist complete on this device. A supervisor must still confirm production,
            food safety and any official inventory updates in Seramet.</p>
          <button type="button" className="primary-button kitchen-main-action" onClick={onExit}>Back to recipe</button>
        </div>
      )}
    </section>
  );
}
