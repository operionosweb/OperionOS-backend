# Matt native Keep conflict remediation status

Date: 2 November 2026. **NOT RESOLVED; original copies preserved.**

The prior [exact recovery report](./MATT_RECOVERY_COPY_AND_EDITOR_CONFLICT_REPORT.md)
remains the provenance and five-copy baseline. Its historical "current" hashes
describe that earlier audit, not the new remediation files.

## Current comparison

All five originals still match their recorded SHA-256 values. All five differ
from current disk content:

| File | Additions/deletions relative to recovery | Remediation-specific change |
|---|---|---|
| services/mattDemoContext.js | 19 / 2 | None; prior scope-aware context retained |
| services/mattAnswerService.js | 13 / 8 | None; prior orchestration retained |
| frontend/src/routes/Matt.jsx | 45 / 17 | Require loaded flight ID to match requested ID |
| frontend/src/components/matt/useMattLive.js | 24 / 4 | Dispose on authorization failure |
| routes/mattDemoRoutes.js | 18 / 7 | Readiness classification and capability-expiry recheck |

Current SHA-256:

```text
mattDemoContext.js  8FEEEFE8663D7ACA6F92649A016379E15640D322709BEDCF4824D95E1A9A75C9
mattAnswerService.js D48C829617734B878AB326922FAB9F49D0210A784BAA2182C309C40DD8A6ECF9
Matt.jsx           11C595956CCAF07A3686AE71C6AD72E88D2DDF4EB6EE7884F7C8CB8BF1FE86C4
useMattLive.js     362A5A6397787C99D0F85287124C7FE6A8BE5F1034A171C36E631066A874CE5F
mattDemoRoutes.js  C0D3F5BF68C789C6C898A4DDE923F2AD68C74EDE644EFEE194638C824A0832CE
```

This compares known disk versions, **not an unsaved editor buffer**. No available
tool supplied the editor's expected acceptance version or an unsaved competing
buffer. No exact Keep error appeared in the bounded current relevant log search;
no target debug-log context was supplied. The cause cannot be established from
those absences.

## Safe human action required

1. Do not select worktree-wide Apply/Revert, Keep All, Discard or force overwrite.
2. Before saving anything, copy any unsaved conflicting buffer to a separate
   newly named location outside the application. Do not overwrite the five
   originals.
3. Expose/export the editor's competing/expected version and exact conflict
   diagnostic for each affected file. Review any diagnostic export for secrets
   before sharing.
4. Compare three inputs individually: preserved original, current disk file,
   and expected/unsaved editor content. The original copies are not proven
   editor acceptance baselines.
5. Identify genuinely unique hunks. Only then authorize an individual-file
   merge; do not silently choose the older version merely to clear the badge.
6. Rerun the affected tests before separately approving normal editor
   acceptance. If any expected version remains unavailable, leave that
   conflict unresolved.

No editor buffer was overwritten; no Keep, Discard, Apply, Revert, Undo, Redo,
checkpoint, reset, clean or stash action occurred. Native conflict resolution
cannot honestly be claimed without those missing versions.
