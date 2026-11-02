# Matt native Keep conflict status

Prompt 73196. Date: 2 November 2026. **UNRESOLVED — no forced acceptance.**

## Available versions

Five affected paths:

- [mattDemoContext.js](../services/mattDemoContext.js)
- [mattAnswerService.js](../services/mattAnswerService.js)
- [Matt.jsx](../frontend/src/routes/Matt.jsx)
- [useMattLive.js](../frontend/src/components/matt/useMattLive.js)
- [mattDemoRoutes.js](../routes/mattDemoRoutes.js)

Current disk versions and the five immutable recovery originals are available.
The expected/proposed editor version and competing unsaved buffers are not.
The originals are not proven copies of the editor's expected acceptance base.

The exact missing information was explicitly requested in this task. The user
responded:

> Unavailable; leave native Keep unresolved and continue the other local work.

Accordingly no candidate merge was fabricated and no Keep, Discard, Apply,
Revert, Undo, Redo or checkpoint action was performed.

## Evidence and preservation

- Same detached HEAD and empty index; no unmerged index entries.
- Bounded relevant Copilot-log search: zero exact Keep-error occurrences.
  Absence of the message does not prove the editor conflict resolved.
- All five original SHA-256 values match the previously recorded originals;
  recovery directory and timestamps remain untouched.
- Exact original/current content comparison was retained as
  `73196-recovery-comparison.patch` in session evidence, separate from all
  original copies. It is not a patch to apply.
- Four affected current files were untouched by this task.
  The hook's only new change integrates authorization/expiry-driven browser
  session clearing into the existing logic; none of its earlier Demo,
  microphone, provider or cleanup work was discarded.
- The [prior complete comparison](./MATT_KEEP_FINAL_RESOLUTION_REPORT.md)
  remains unchanged as historical evidence, not overwritten with new hashes.

## What is needed for a safe resolution

For **each** affected file provide, using uniquely named exports outside the
application:

1. The unsaved editor buffer, if any.
2. The exact expected/proposed native acceptance version or exposed diff base.
3. The current exact Keep error and the intended hunk dispositions.

Then compare disk, expected/proposed/unsaved content and the original recovery
copy individually. Preserve every unique hunk before proposing a separate
merged candidate and relevant validation. Do not select either side just because
its timestamp is newer.

No bulk worktree acceptance, reset, clean, stash or recovery overwrite is a
substitute. The conflict remains open at the user's explicit direction.
