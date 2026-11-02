# Matt recovery copies and editor conflict

Date: 2 November 2026. **Preserved; native editor conflict NOT RESOLVED.**

No recovery file or application source was changed in this assurance pass.
No Keep, Apply, Revert, Undo, Redo, checkpoint, stash, reset or clean action was
performed. A comparison is not authorization to overwrite either version.

## 1. Scope and provenance

The [previous acceptance report](./MATT_PLATFORM_WIDE_INTELLIGENCE_AND_SECURITY_ACCEPTANCE_REPORT.md)
records five copies made before the platform/account extension. They reside in
the session's [recovery directory](../../../.copilot/session-state/b75b7ff7-0ebb-483d-8106-019b47608272/files/platform-keep-recovery/).
Their hashes match the pre-extension `platform-matt-initial-hashes.csv`
fingerprints, independently checked again in this pass.

All five copies have creation time **2026-11-02 13:27:33 UTC**. Their last-write
times retain the earlier source times below. Filesystem timestamps alone would
not prove origin; the matching initial hashes and recorded prior copy operation
are the additional evidence. These are copies of then-current disk files,
NOT proven copies of the editor's expected version, unsaved buffer or internal
acceptance baseline.

| File | Recovery bytes | Recovery last-write UTC | Current bytes | Current last-write UTC |
|---|---:|---|---:|---|
| [mattDemoContext.js](../services/mattDemoContext.js) | 3,368 | 12:58:20 | 4,884 | 13:37:34 |
| [mattAnswerService.js](../services/mattAnswerService.js) | 4,697 | 12:58:20 | 5,867 | 13:33:40 |
| [Matt.jsx](../frontend/src/routes/Matt.jsx) | 37,911 | 12:58:19 | 41,689 | 13:43:13 |
| [useMattLive.js](../frontend/src/components/matt/useMattLive.js) | 11,658 | 12:58:19 | 12,440 | 13:33:40 |
| [mattDemoRoutes.js](../routes/mattDemoRoutes.js) | 10,303 | 12:58:20 | 10,394 | 13:28:53 |

All times are 2 November 2026. The copies are **not duplicates of current
files**: every comparison differs.

## 2. Exact fingerprints

SHA-256 values, without abbreviation:

| File | Recovery SHA-256 | Current SHA-256 |
|---|---|---|
| mattDemoContext.js | `E7CC63EC3C0D72FB1AD7BA45D751502AABD37B052ABC8967C1DC96F0A52EFAFD` | `8FEEEFE8663D7ACA6F92649A016379E15640D322709BEDCF4824D95E1A9A75C9` |
| mattAnswerService.js | `DEF171D896C7D96419AEF94C1A7170FF4ABB54C489B86145224EFCA27673C7CF` | `D48C829617734B878AB326922FAB9F49D0210A784BAA2182C309C40DD8A6ECF9` |
| Matt.jsx | `1182AA125C02E33ED7125C9258B396772C1E88D39E226C986E9E361BDFCEB458` | `F44FF34A1518EE7EFA22D29F5348D574B5D8787BCB975E82D77A56AA9C85F113` |
| useMattLive.js | `409BA1BD9DA6F4D3CC13E1D61613882998AEDACEE5B2E825426D3DC9707F2004` | `18DC1597D2141F8C814A6C5FCBD039977001AB066EC1FA399EDCD84F9553A19B` |
| mattDemoRoutes.js | `15FCE665CF425D275BF7D63EF1948116D3D6CD80A6B26482723DD8857D9EAAEC` | `CDFF3900619B2627A3F7F05A99545A9D899CB048A36EA4A4680D9A13137C10F3` |

## 3. Exact differences and unique content

A generated, persistent [full five-file comparison](../../../.copilot/session-state/b75b7ff7-0ebb-483d-8106-019b47608272/files/matt-recovery-comparison.patch)
contains every removed/added line and its context: 364 lines, 25 hunks,
97 additions and 32 deletions. Its SHA-256 is
`0564369E7902F7A92D97A00B29708F0EBBC164206AA7664DB12E60BE983E4654`.
It is a comparison artifact, not a merge instruction; do not apply it blindly.
It was generated using read-only `git diff --no-index --unified=3`.
Exit 1 from this command means differences, not a failed comparison.

### Prepared Demo context: 19 added / 2 removed; two hunks

Recovery contents: the fixed Demo organization, server-only alias/context
maps, prepared contract and twenty-flight registration, known-alias resolution
and cloned selected-analysis reader.

- New line 3 imports the pure scope validator.
- Old lines 54-55 accepted only organization/run and combined both checks.
- Current lines 55 onward add mode/page parameters, preserve the fixed
  organization check, validate scope, then retain the selected-analysis map
  check and clone.
- Account mode adds the four-entry prepared catalog, one representative
  sample lease analysis, explicit reuse/independent-analysis coverage, catalog
  evidence and no-double-counting limitation.
- Platform mode returns no contract sources.

Unique current work: account/guide modes and their explicit coverage.
Recovery-only text is the older function signature/check; no separate lost
alias dataset or reader implementation was identified. Reverting would remove
the new modes, not recover another independent prepared dataset.

### Answer service: 13 added / 8 removed; two hunks

Recovery contents: selected-analysis UUID validation, authorized read,
budgeted gateway call, cancellation, bounded JSON answer and evidence-ID
validation, Demo warnings and human-review limitations.

- The old direct UUID assertion is replaced by the pure mode-aware validator.
- The reader receives user, mode, page and trusted account context.
- Reviewed platform facts/evidence are added separately to authorized context.
- Input includes user principal and mode; the old three-field input does not.
- Prompt version changes from `matt-live-evidence-v1` to the versioned platform
  prompt. Existing non-invention and evidence rules remain; status and
  navigation limitations are added.
- Demo wording distinguishes fictional account/contract/flight data from
  actual product documentation.
- Adapter limitations are carried into the returned answer.

Unique current work: platform documentation, owner-sensitive input and
context limitations. The recovery-only UUID call has a current analysis-mode
equivalent in the extracted validator, not an orphaned feature. Do not copy
back the old input construction or erase the new scope validation.

### Matt coordinator: 44 added / 16 removed; thirteen hunks

Recovery contents: once-only introduction and platform presence; shared
contract/flight assistant; browser/live speech lifecycle; capture/interrupt
controls; selected-analysis reasoning; retained findings, sources and reports.

The comparison identifies changes at old-line starts
`16, 51, 60, 77, 256, 274, 292, 306, 327, 347, 368, 376, 410`:

1. Import reviewed scope/page lists and the prepared guide.
2. Add prepared-guide form/state for platform-only presence.
3. Extend shared component props for initial mode/scope notifications.
4. Add organization role and mode to local scope identity; account/guide use
   an account-level key rather than whichever contract happened to be selected.
5. Require a selected contract only for analysis questions.
6. Route account/platform live questions through the same live hook; disconnected
   platform questions use explicitly prepared text and account questions fail
   explicitly without an approved connection.
7. Carry mode/page on all selected live branches.
8. Label account/guide results without claiming a selected contract/flight.
9. Preserve mode/page in report and return queries.
10. Add a question-scope selector and truthful scope explanation.
11. Move the same Disconnect handler from closed Voice settings to visible
    audio controls.
12. Label prepared guidance separately from generated/contractual evidence.
13. Remove the old hidden Disconnect location, not the termination behavior.

Unique current work is substantive, not whitespace. Recovery-only branches
describe the older analysis-only workflow. No separate old microphone engine,
evidence renderer or unique function was found removed by these hunks. The
move of Disconnect is explicitly accounted for; it must not be duplicated.

### Live browser hook: 19 added / 4 removed; six hunks

Recovery contents: separate Demo/SaaS request selection, deliberate connection,
audio playback and mute handling, interrupted/stale media suppression, cleanup,
speech negotiation and exact validated answer delivery to Text Echo.

- Clear the new idle timer on disposal.
- Add `markActivity`, bounded by the room's absolute expiry.
- Retain idle timeout and expiry metadata when a room is created; arm the timer.
- Include the activity callback in hook dependencies.
- Record approved speech negotiation and answer attempts as activity.
- Extend `ask` with scope/page context and pass it in the request body.

Unique current work: visible idle/expiry lifecycle and scope transport.
Recovery-only object/signature lines are predecessors of these extensions,
not independent adapters requiring a second implementation.

### Demo router: 2 added / 2 removed; two hunks

Recovery contents: exact-origin access, hashed one-use capabilities, peer/process
quotas, fixed namespace, strict query/body allowlists, alias resolution,
session binding, shared-router injection and code-only rejection logging.

- Turn allowlist adds only `contextMode` and `pageId`.
- Analysis alias resolution is conditional on analysis/default mode.
  Account/platform turns are validated by the reader rather than forced
  through the old analysis-only alias resolver.

No quota, origin restriction or customer-data adapter was removed in the
comparison. Recovery-only unconditional alias resolution is intentionally
superseded, not unique work to restore alongside the new branch.

## 4. Editor evidence and limits

The reported error says each file changed before its pending changes could be
kept. That establishes an observed version mismatch, not which process edited
which file or the contents of the editor's expected version.

Current targeted evidence:

- No supplied current-session debug-log location is available.
- The available current Copilot Chat output log is 91,865 bytes, last written
  14:12:04 UTC; a targeted search for the error and five filenames found
  **zero matches**.
- The only discovered primary debug log is 264 bytes dated 24 July 2026, not
  this task. Its unrelated contents were not read.
- All five disk versions existed and match their captured current hashes.

Therefore the exact editor-internal cause, expected baseline and unsaved
version remain UNKNOWN. The two available disk versions do not provide a
three-way merge base for the editor transaction.

The [official Copilot issue guidance](https://github.com/microsoft/vscode/wiki/Copilot-Issues)
was consulted on this date. It advises relevant Window/Copilot output and
reviewed debug exports; it does not prescribe a safe automatic fix for this
specific Keep mismatch. No editor configuration was changed to collect more
logs, and no private source/debug export was uploaded.

## 5. Proposed resolution strategy and human decision

**No content merge was applied.** No orphaned unique recovery implementation
was identified in the compared hunks, but this does not prove that an unseen
unsaved/expected editor version lacks additional work.

1. Keep all recovery snapshots and current files as separate immutable inputs.
2. Inspect the complete comparison; prefer neither version merely because its
   timestamp is newer. Security findings in the separate audit take precedence
   over assumptions that current code is accepted.
3. Obtain a read-only export or view of the exact pending/unsaved editor diff
   and expected baseline. Do not invoke Keep again just to gather evidence.
4. Compare all three versions. If unique buffer work exists, record it as
   proposed individual hunks; do not replace an entire file from a snapshot.
5. Obtain approval for each conflicting hunk and a fresh individual-file review.
   Never use bulk worktree Apply/Revert as an acceptance substitute.
6. Only after a reviewed, lossless merge is possible, rerun affected tests and
   verify protected hashes, current index and detached HEAD. Native editor
   acceptance must be observed separately; source persistence is not proof.

Human approval is needed for editor recovery/review actions and any choice
between genuinely conflicting unseen content. Merely producing these reports
does not grant that approval.

## 6. Preservation and full working-tree inventory

At assurance start: **23 tracked modified files + 28 untracked files = 51
existing changed files**. The previously named 19 implementation/documentation
paths exclude the prior acceptance report itself; they are not the complete
dirty-worktree count.

The full inventory and hashes are preserved in
`matt-assurance-start-hashes.csv` in the session files directory. No source,
environment or dependency file in that 51-entry inventory was changed by this
assurance pass. The only repository additions are the five requested reports.

Protected preview: **41/41 hashes match**. Recovery copies: **5/5 initial hashes
match**. Detached HEAD:
`c043216525424a9bdd60f3ffeb6bfce2599703b9`; staged diff empty.
The [final summary](./MATT_FINAL_ACCEPTANCE_SUMMARY.md) records the closing
verification. No clean-looking editor or Git state was manufactured.
