# Matt native Keep: final resolution evidence

Date: 2 November 2026. **UNRESOLVED — competing editor version unavailable.**
Prompt 92641. No editor acceptance or file-content merge was performed.

## What exists and what is missing

The reported affected files are:

- [mattDemoContext.js](../services/mattDemoContext.js)
- [mattAnswerService.js](../services/mattAnswerService.js)
- [Matt.jsx](../frontend/src/routes/Matt.jsx)
- [useMattLive.js](../frontend/src/components/matt/useMattLive.js)
- [mattDemoRoutes.js](../routes/mattDemoRoutes.js)

Known versions are current disk files and the five original pre-extension
copies in the session recovery directory. The editor's expected acceptance
baseline and any competing unsaved buffer are **not available**. The originals
are not proven copies of that editor baseline.

Current Git evidence: detached HEAD
`c043216525424a9bdd60f3ffeb6bfce2599703b9`, empty index, no unmerged index entries,
and no conflict markers in the five current files. This is **not a demonstrated
Git merge conflict**. The original error describes native editor acceptance
rejecting changed disk files. That diagnosis does not identify which process
changed them or certify the current editor state.

The relevant current Copilot output log was 93,320 bytes, last modified
14:56:27.3624055 UTC. A bounded search found zero exact Keep-error occurrences.
No target debug-log context was supplied. Absence of the message does not
establish that the conflict cleared. No tool exposed the unsaved/expected
versions, and no buffer was saved over.

## Original integrity and provenance

All five original SHA-256 values match the prior manifests. Copies were created
2 November 2026 at 13:27:33 UTC; retained earlier last-write times are
12:58:19 UTC for the two frontend files and 12:58:20 UTC for the other three.
The [earlier detailed report](./MATT_RECOVERY_COPY_AND_EDITOR_CONFLICT_REPORT.md)
records complete provenance and original fingerprints.

| File | Current SHA-256 | Original → current diff |
|---|---|---|
| mattDemoContext.js | `8FEEEFE8663D7ACA6F92649A016379E15640D322709BEDCF4824D95E1A9A75C9` | +19 / −2 |
| mattAnswerService.js | `D48C829617734B878AB326922FAB9F49D0210A784BAA2182C309C40DD8A6ECF9` | +13 / −8 |
| Matt.jsx | `11C595956CCAF07A3686AE71C6AD72E88D2DDF4EB6EE7884F7C8CB8BF1FE86C4` | +45 / −17 |
| useMattLive.js | `362A5A6397787C99D0F85287124C7FE6A8BE5F1034A171C36E631066A874CE5F` | +24 / −4 |
| mattDemoRoutes.js | `C0D3F5BF68C789C6C898A4DDE923F2AD68C74EDE644EFEE194638C824A0832CE` | +18 / −7 |

All five differ. This execution generated and reviewed the exact
[comparison patch](../../../.copilot/session-state/b75b7ff7-0ebb-483d-8106-019b47608272/files/final92641-recovery-comparison.patch)
(SHA-256
`BF1E64ABD4408428B04057A18E20999993F0E4513AF1000DBF5D2B20548C4174`).
The patch is evidence only, not a patch to apply.

## Unique work and intended version

| File | Current-only intended work | Original-only text and disposition |
|---|---|---|
| Demo context | Account/platform modes, coverage and fixed-namespace validation | Old analysis-only signature/guard is replaced, not a separate missing feature |
| Answer service | Trusted principal, scope validation, maintained knowledge and coverage limits | Old analysis-only validation/prompt version is superseded |
| Main Matt | Question scopes, prepared guide, scoped reports, matching flight ID and visible Disconnect | Old scope/report expressions are superseded; Disconnect was relocated, not discarded |
| Live hook | Idle deadline, scoped turns and authorization-failure teardown | Previous signatures/state initialization are superseded |
| Demo routes | Mode allowlist, readiness classification and post-operation expiry check | Old analysis-only body mapping/error shape is superseded |

The current disk version is consistent with the latest documented intended
work. This is not a license to discard an unseen newer editor buffer.
No orphaned original implementation was identified in the exact comparison;
**no claim about unique unseen buffer content can be made**.

## Proposed resolution and exact manual steps

The safe proposed disposition is to retain current disk work and every original
unchanged until all three versions can be compared. A merged candidate cannot
be certified without the missing version; none was fabricated.

1. Do not select Keep All, Discard, Apply/Revert worktree, reset, clean or stash.
2. For each affected editor tab with unsaved content, first copy that content to
   a new uniquely named text file outside the application. Do not overwrite
   the original recovery directory or current disk file.
3. Capture the precise current conflict message and expose/export the expected
   or proposed editor version. Review diagnostic exports locally for secrets
   before sharing them.
4. Compare **current disk**, **original recovery**, and **expected/unsaved
   editor content** using an individual-file diff. List each unique hunk and
   explicitly decide whether it belongs in the candidate.
5. Only after all unique hunks have a documented disposition, authorize a
   separate candidate file, compare it against both competing versions, and
   validate the relevant existing tests.
6. Only then consider normal individual-file editor acceptance. If the editor
   cannot expose its expected version, keep the conflict open and obtain
   reviewed editor diagnostics/support rather than force acceptance.

No recovery overwrite, buffer overwrite, Keep/Discard, Undo/Redo, checkpoint or
Git-state change occurred in this execution. The unresolved conflict limits
acceptance confidence but has not caused observed loss or hash corruption.
