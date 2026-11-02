# Matt introduction lifecycle — 84317

Date: 2 November 2026.

## Implemented lifecycle

[mattIntroduction](../frontend/src/components/matt/mattIntroduction.js) now
tracks explicit states rather than a single tab-only boolean:

| State/outcome | Trigger | Result |
|---|---|---|
| `intro_not_seen` | No preference for this identity | Approved introduction available; muted non-looping preview can start |
| `intro_playing` | Actual video `playing` event | Retain progress; Watch introduction enables original video audio |
| `intro_completed` | Actual `ended`, or deliberate escape after media failure | Persist outcome and remove recorded source |
| `intro_skipped` | Skip introduction | Persist outcome and immediately allow assistant use |
| `intro_disabled` | Do not show introduction again | Persist explicit disable and immediately allow assistant use |
| `assistant_ready` | Any terminal outcome | Conversation controls and approved live connection available; **not** a claim that a provider connected |

`data-intro-state` exposes playing/ready state; `data-intro-outcome` retains the
specific outcome. Invalid terminal values throw rather than silently default.

## Identity, storage and ownership

- SaaS preference key contains authenticated user ID. Demo uses a separate
  prepared-Demo key. It contains only an introduction preference, no contract,
  organization evidence or conversation.
- Terminal outcomes use **localStorage**, surviving tab/browser sessions in
  the same browser profile. This is not a cross-device account preference.
- Old `sessionStorage` completion markers migrate to the persistent outcome.
  Progress remains in visit storage. Storage denial warns explicitly and uses
  in-memory continuity; persistence cannot be promised when storage is blocked
  or cleared.
- Cross-tab storage events dismiss an introduction completed/disabled elsewhere.
- A single owner claims playback. Progress resumes on contextual remount.
  State notification no longer restarts a playing owner's effect: ownership
  availability, not every revision, governs media acquisition.
- Existing first-entry inline Matt remains available in workspace. On other
  supported platform pages without an inline Matt, the nonmodal floating
  assistant offers the introduction automatically once. Closing never blocks
  navigation. Skip/disable/completion suppress future automatic offers.

## Media and controls

[MattEnvironment](../frontend/src/components/matt/MattEnvironment.jsx) retains
the exact approved same-origin `/matt/reference.mp4`, with `loop=false`.
Watch introduction enables its own soundtrack; browser TTS is not used.
The three minimal controls are Watch introduction, Skip introduction and
Do not show again (accessible name: Do not show introduction again).

Controls follow the video in normal document flow, outside the clipped media
surface. No forced complete-view gate, repeated loop or disruptive onboarding
wizard. Actual media failure reports the error and advances; hidden-tab
autoplay suspension can resume when visible. Finite duration is checked before
restoring time.

A genuine remote A/V stream replaces the recorded `<source>`. When disconnected,
the original footage is not reinstated as an answer. Missing configuration
continues to show an honest connection status and preserves available text
intelligence.

## Test evidence

The final integration report records each fresh test individually. Coverage
includes real local decoding/non-looping playback, stable contextual rerender,
progress remount, skip/reload, actual ended event, persistence in a fresh
browser context without session storage, explicit disable, Watch audio,
cross-tab synchronization, blocked storage warning, separate user identity,
video failure escape and synthetic live-source replacement.

The initial implementation exposed a playback-effect loop when `playing`
notified the store. That failed run was stopped and retained; the owner-based
dependency fix was then tested. It is not counted as a pass.

Real provider speech/video, physical-device playback and cross-device
preference synchronization are not established by these tests.
