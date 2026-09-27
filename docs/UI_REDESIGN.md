# Seramet mobile companion redesign

## Reference baseline and mapping (before implementation)

Inspected latest main clones on 2026-09-26. Cookbook: `fb3e5ccb556d2056f639cec2daca4c5bbf80542d`. POS: `7df0d60aa2586ddc6923cffc3678cbfcf1c10274`. POS is read-only. Implementation branch: `ui/seramet-mobile-redesign`.

| Authentic POS source | Cookbook adaptation |
| --- | --- |
| `src/styles.css` root/dark tokens | Separate shared token stylesheet; exact colors, Plus Jakarta Sans, radius and shadow |
| `src/components/app/Logo.tsx`, `public/brand/seramet-mark-{light,dark}.png` | Brand uses actual marks and uppercase SERAMET wordmark |
| `src/components/app/ui.tsx` Panel, PanelHead, Status | Bordered card surfaces, 14px-radius panels, semantic status colors, consistent headings |
| `src/components/ui/button.tsx` | Existing semantic button classes use POS rounded-md styling and focus treatment; 44px minimum mobile targets |
| `src/components/auth/AuthShell.tsx` | Simple background/card, compact heading, readable form labels and inputs |
| `src/components/app/AppShell.tsx`, `public/theme-init.js` | Active navigation treatment, persisted light/dark preference; mobile bottom navigation retained |

## Screen audit and planned changes

There is no separate dashboard or modal screen. The recipe library is home. Existing screens are sign-in/forgot password, reset password, recipes, recipe detail, four-step editor, categories, import and More.

- All screens: 8–12px text, inconsistent radii, missing keyboard focus, no dark palette. Consolidate tokens and readable typography, improve touch targets and narrow-screen wrapping.
- Shell: letter S substitute for actual logo, long branch name overflow, floating navigation overlaps content. Use authentic marks, bounded workspace label and safe-area navigation.
- Library: filter action is inert; names truncate; tablet cards squeeze into three columns beside sidebar. Make category filter disclosure functional and improve responsive grid.
- Categories: rows do not navigate. Connect to filtered library.
- Detail: no production scaling exists in baseline. Add explicitly requested temporary scaling by yield or a selected ingredient, keeping original recipe data intact. Keep nonnumeric quantities visible and flagged for chef review.
- Editor: narrow ingredient columns, unlabeled inputs and lost recipeVersionId on save. Stack ingredient fields on phones, label controls, retain existing metadata.
- Import: tiny review text, nested file control, no expanded/status semantics. Improve layout and feedback without altering parser, matching or commit validation.
- More: informational rows look like links but do nothing; technical staging copy. Use static information rows and add supported theme preference.
- Auth/recovery: oversized decoration with small form text; errors lack alert semantics. Match POS auth treatment and preserve credential workflows.

## Verification boundary

Only `.env.example` exists in this clone, but `src/lib/supabase.ts` supplies the existing shared staging URL and publishable key by default. Live authentication, remote persistence and authoritative import require an authorized test account; unit checks must not be described as live backend verification. No migrations or Supabase configuration changes are planned.


## Current implementation and verification (incomplete)

- `src/tokens.css`: exact POS root/dark palettes, shadows and radius tokens. `src/styles.css`: shared mobile typography, form controls, safe-area navigation, responsive cards/editor/import panels and focus/reduced-motion rules.
- `Brand.tsx`, `public/brand/*`, `public/theme-init.js`, `index.html`: actual POS light/dark logo assets and theme initialization.
- `AppShell.tsx`, `App.tsx`: active navigation semantics, category navigation and detail state isolation; remove automatic smooth scrolling.
- `RecipesScreen.tsx`, `CategoriesScreen.tsx`: functional category disclosure and category-to-library navigation.
- `RecipeDetailScreen.tsx`, `ProductionScaler.tsx`, `recipe-scaling.ts`: temporary production calculations by yield or selected ingredient. Decimal quantities scale in their original units; ambiguous quantities remain unchanged and require confirmation. Calculation persists when switching detail sections.
- `RecipeEditorScreen.tsx`: preserve remote version metadata; name ingredient/method inputs for assistive technology; disable unavailable steps.
- `AuthScreen.tsx`, `ResetPasswordScreen.tsx`: shared auth styling and announced feedback.
- `ImportScreen.tsx`: announced errors/results, expanded state and same-file reselection; file input moved outside the upload button.
- `MoreScreen.tsx`: informational rows are no longer dead buttons; persistent light/dark selection.
- No dependencies added. No changes to Supabase configuration, parser, repository service, database or stored recipe fixtures.

Earlier verification (2026-09-26, before the final cleanup): direct TypeScript check (`node node_modules/typescript/bin/tsc --noEmit`) exited 0. Four Node scaling tests passed (`node --experimental-strip-types --test src/lib/recipe-scaling.test.mjs`), covering the 4 kg to 2 kg requirement, multiple units, invalid inputs, ambiguity and source immutability. `git diff --check` passed.

Previous environment failure (resolved disk space on 2026-09-27): C: had approximately 20 MB free. `npm ci` failed with an npm exit-handler error and inability to write logs. A command also failed explicitly with Windows error 112 (not enough disk space). `npm run build` then failed because the incomplete install lacks `node_modules/vite/package.json`.

Pending merge gates: complete production build/typecheck; browser inspection at 320/390/430/768/1280 widths in both themes; keyboard/safe-area checks; recipe creation/edit persistence; authentication/recovery; actual DOCX preview/commit with an authorized account. No browser or live backend success is claimed. Keep the PR in draft until these checks are complete.

## 2026-09-27 continuation

- Confirmed GitHub main is still the baseline above using the connected GitHub service; current POS brand tokens match the reference.
- Disk space restored (1.38 GB initially free). Online installation is blocked by session network restrictions; offline installation reports `ENOTCACHED` for xmlbuilder. The user was asked to run `npm ci` in their terminal.
- Isolated UI browser harness could not bundle: the native bundler reports `Cannot read directory ../../..: Access is denied`. This is an environment failure, not a successful UI test. Harness and logs are excluded via `.verification/`.
- Removed 76 superseded CSS declarations and formatted modified source. Preserved library search/category when returning from detail, retained zero-minute prep/cook values on edit, prevented keyboard interaction with the editor during save, and rendered existing recipe image URLs correctly.
- Remote yield values are labeled as yield units rather than assumed to be portions; selecting a standardized ingredient supplies its explicit unit for production scaling.
- Added `npm test` and the scaling test step to existing CI. Current local result: **4 tests passed**, `git diff --check` passed. No dependencies added; lockfile unchanged.
- Existing issues addressed: inert filter/category controls, fabricated letter logo, no dark theme, tiny touch targets/text, inaccessible editor fields, dropped remote version metadata, zero-duration edits changing to defaults, image URLs supplied as invalid CSS backgrounds, missing production scaling.
- Outstanding existing service constraint: remote recipe creation is governed by Import/Cost Control. Supabase auth, import parser, permissions, endpoints and schema remain unchanged.

## Delivery limitation

The connected GitHub service can read the repository, but its first write (`create_blob`) was rejected: `MCP tool call requires approval, but approval policy is never`. No GitHub objects, branch or PR were created. Terminal GitHub access is also unavailable. The local branch and PR description are prepared; publish them from a session with GitHub write approval after completing the verification gates.
