# Matt Demo intro, globe, and findings UX

**Verdict: CONDITIONALLY ACCEPTED.** The requested introduction, Demo globe/portrait, and findings/evidence overlay behaviors are implemented and focused tests pass. Production publication remains outstanding because the detached worktree contains 346 pre-existing status entries, and several task-touched files already contain unrelated changes that cannot safely be included in a scoped commit without further isolation.

## Completed

- Added an explicit **Replay introduction** control after the initial introduction. It restarts the existing video from the beginning, does not loop, and does not reclaim or overwrite the user's completed introduction state.
- Kept the floating Matt portrait launcher available while preventing the Demo assistant panel from auto-opening over the dashboard/live-tracking globe. Clicking the launcher still opens Matt; authenticated non-Demo behavior is unchanged.
- Removed the redundant Demo-only one-time/live-connection notice, changed the media label to “INTRODUCTION / NOT AN ANSWER,” and placed Demo live-connection controls behind a disclosure. Demo status copy no longer exposes raw provider error text.
- Added responsive, keyboard-focusable replay-button styling and browser assertions for the floating portrait's actual image load.
- Verified the globe after removing the first-visit Matt panel obstruction. Bundled Earth tiles returned successfully, and the textured-Earth acceptance checks passed on public and Demo pages at mobile and desktop widths with external imagery blocked.
- Added a native, responsive dialog opened by a finding or evidence card. It shows only evidence linked by evidence ID, clearly labels findings as review cues rather than conclusions, supports keyboard dismissal, and retains an explicit “Ask Matt about this finding” action.

## Native Keep boundary

The user explicitly authorized a surgical edit to the current on-disk `Matt.jsx` despite unavailable Keep-operation exports. The existing Native Keep operation itself was not accepted or reconciled. The other four files from the unresolved Keep set remain untouched:

- `frontend/src/services/mattAnswerService.js`
- `frontend/src/components/matt/useMattLive.js`
- `routes/mattDemoRoutes.js`
- `services/mattDemoContext.js`

The Native Keep follow-up documents the unresolved editor state and preservation guidance: [`docs/MATT_NATIVE_KEEP_FOLLOWUP_71483.md`](./MATT_NATIVE_KEEP_FOLLOWUP_71483.md).

## Validation

| Check | Result |
|---|---|
| `node --test frontend\tests\matt-introduction.test.mjs` | Passed, 12/12 |
| `node --test frontend\tests\globe-earth-imagery.test.mjs` | Passed, 2/2; each test covers four public/Demo routes |
| Targeted Matt Studio tests (320px, 390px, 1440px, overlay, Demo launcher) | Passed, 5/5 |
| `git diff --check` on task-touched source and test files | Passed |

No hosted or production service was accessed. The globe checks used the offline Vite build, blocked external requests, and verified bundled imagery. No migration/database command was run.

## Preservation and worktree

The implementation did not edit canonical migrations, recovery originals, or historical files. The previously verified 920-file snapshot and recovery-original/archive hashes were preserved; no stash, reset, checkout, clean, or commit was performed. The worktree remains detached at `3524cd8aaa39c8dbfcedd5b5bca3d10912bca345`; it already contained extensive unrelated local work. Some files touched here also had earlier changes, which were retained. Final status contains 346 entries versus 340 before this task, with zero staged files.

Task-touched source and test files:

- `frontend/src/components/demo/OperionAssistant.jsx`
- `frontend/src/components/matt/MattEnvironment.jsx`
- `frontend/src/routes/Matt.jsx`
- `frontend/src/styles/matt.css`
- `frontend/src/styles/mattStudio.css`
- `frontend/tests/globe-earth-imagery.test.mjs`
- `frontend/tests/matt-introduction.test.mjs`
- `frontend/tests/matt-studio.test.mjs`

The report is the only new task deliverable. GitHub Production was not updated: `origin/main` still points at the current HEAD, the checkout is detached, and the modified files include unrelated pre-existing hunks. No changes were staged or pushed to avoid publishing unrelated local work.

## Follow-up: timezone-independent globe visibility

The shared globe imagery setup previously enabled Cesium's live solar lighting and ground atmosphere. At the screenshot's nighttime UTC, this darkened the geographic surface until it blended into the dark space background. The shared globe configuration now keeps the base Earth imagery consistently illuminated, disables the ground-atmosphere shading, and removes the now-unneeded minute-by-minute solar-lighting timer. Bundled Earth tiles, aircraft routes, and existing imagery error handling remain in place. This applies to both public and Demo globe consumers.

The nighttime regression test now verifies recognizable texture at both UTC noon and midnight without waiting for unrelated aircraft-model readiness. Measured central luminance was 124.0 at noon and 123.8 at midnight.

| Follow-up check | Result |
|---|---|
| `node --test tests/globe-solar.test.mjs` | Passed, 2/2 |
| `node --test --test-concurrency=1 tests/globe-intelligence.test.mjs` | Passed, 17/17, including 320px–1920px responsive checks |
| `node --test --test-concurrency=1 tests/globe-earth-imagery.test.mjs` | Passed, 2/2; all four public/Demo routes at mobile and desktop, including the floating Matt portrait |
| `npm.cmd run build` | Passed; Vite reported its existing large-chunk advisory |
| `git diff --check` | Passed |

No Supabase, hosted or production service was accessed. The fix has not been committed or pushed. The checkout remains detached at `3524cd8aaa39c8dbfcedd5b5bca3d10912bca345` with 349 status entries and zero staged files, including a modified `.env` and unresolved Native Keep state; publishing the full worktree would risk exposing or including unrelated work. The previous report recorded 346 status entries.
