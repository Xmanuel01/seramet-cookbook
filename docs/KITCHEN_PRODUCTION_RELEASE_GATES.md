# Guided kitchen mode: release and integration gates

## Implemented client safeguards
- Quantity calculations remain display-only; recipe standards are never overwritten.
- Kitchen checklists use per-ingredient IDs, track ambiguous measurements separately, and cannot advance until reviewed.
- Multi-step mode requires explicit completion of every cooking step.
- Countdown uses an absolute browser-clock deadline to survive tab backgrounding and recover after reload.
- Authenticated users can resume locally stored drafts on the same browser. Draft keys are scoped by tenant ID, user ID and recipe ID; the stored draft is revalidated against recipe version, ingredient quantities, instructions, and revision.
- Corrupt, tampered and idle-over-24-hour drafts are rejected. Starting another batch or finishing clears the relevant local draft.
- External-tab changes stop editing to avoid silent last-writer-wins conflicts.
- Demo mode is memory-only and does not write persistent kitchen drafts.
- UI reports when browser storage is unavailable.

## Important boundaries
This UI is a recoverable **guided preparation tool**, not an authoritative production or food-safety ledger. Browser state can be tampered with, is device-local, can be lost and is not protected by database transactions. The timer is a reminder; it does not replace safe-temperature checks or supervisor verification. Do not deduct inventory, publish completed production, generate costs or show auditable staff performance from these browser checklists.

## Gates before turning on official production
1. Confirm the active Seramet production schema and choose its canonical recipe-production batch service; do not create a competing recipe or inventory source of truth.
2. Deploy an authenticated server workflow with tenant/user/branch authorization on every request, immutable recipe version snapshot and correctly converted base units.
3. Store authoritative batch transitions and ingredient checks server-side with optimistic concurrency, idempotency keys, audit timestamps, actor IDs and server-side validation of allowed transitions. Prevent double submission and cross-branch access.
4. Reconcile actual ingredients and waste through Seramet inventory/production services transactionally; do not deduct from the UI and do not infer stock or waste from checkbox completion.
5. Require verified recipe standards and approval of any estimated yields/ambiguous measures before enabling official production completion.
6. Configure food-safety temperature checks and retention requirements with restaurant operations.
7. Run schema migrations, permission tests, tenant-isolation tests, transaction/retry and offline-reconnection tests against the *authorized* staging environment, then perform a supervised production pilot.

The Supabase management connection exposed no accessible projects during this update, so these server deployment gates are deliberately **not** marked completed.
