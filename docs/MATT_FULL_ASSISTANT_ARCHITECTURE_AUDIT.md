# Matt architecture and visual audit — prompt 84317

Date: 2 November 2026. Recorded **before application edits**.

## Preserved starting state

Isolated worktree: `OperionOS-matt-live-intro-2026-11-02`, detached HEAD
`c043216525424a9bdd60f3ffeb6bfce2599703b9`, empty index, no unmerged entries.
78 starting dirty files were fingerprinted in session evidence. All 41
protected preview-worktree hashes match. Five immutable recovery originals
remain separate. Native Keep remains unresolved; no forced acceptance.

## Existing architecture worth retaining

- [MattExperience](../frontend/src/routes/Matt.jsx) is shared by main, workspace,
  floating, report and Demo. Scoped in-memory conversation storage includes
  authenticated user, organization, role, mode and selected contract/flight.
- [useMattLive](../frontend/src/components/matt/useMattLive.js) owns consent,
  private-room connect, answer requests, interruption, audio and teardown.
  Authorization loss clears retained answers/reports. No alternate engine is
  needed for a layout redesign.
- SaaS server authorizes membership/contract-read and uses existing OCI
  analysis. Demo uses a separate bounded capability and fixed prepared-data
  adapter with the same router/service/provider pipeline.
- Tavus Text Echo receives exact approved answer text; Daily supplies both A/V.
  Optional approved Realtime input supplies transcripts, not autonomous answers.
  Actual providers remain unconfigured/unaccepted; no activation is authorized.
- Disconnected Demo answers are prepared, not generated AI. SaaS uses existing
  structured assistant endpoints. Account reasoning still needs approved live
  configuration. Preserve these distinctions.
- Existing approved portrait:
  [executive-office.jpg](../frontend/public/matt/executive-office.jpg), 758x503.
  Floating launcher already uses the approved image, correct crop and Ask Matt.
- Existing approved introduction:
  [reference.mp4](../frontend/public/matt/reference.mp4). Non-looping and separate
  from live media; skip/failure can advance without an artificial live session.

## Verified causes, not aesthetic guesses

Local pre-change browser at 1440x900, fresh Demo route, analytics declined:

| Element | Document viewport geometry |
|---|---|
| Video environment | x129.84, y336.55, width1237.13, height612 |
| Conversation workspace | y960.55 |
| Suggested questions | y1228.05 |

Thus suggestions require scrolling even on a realistic desktop. The browser
screenshot confirms a full-width scene with no adjacent intelligence panel.

[matt.css](../frontend/src/styles/matt.css) defines a grid, but
[mattStudio.css](../frontend/src/styles/mattStudio.css) overrides it with
`display: block`. Only after a result, `has-proposal` shrinks the stage for an
absolutely positioned 260–330px report rail. Workspace/context/suggestions stay
below the stage; an absolute composer overlays it. This is the root layout
fault, not absent question content. Responses default hidden, further hiding
the executive answer.

Mobile stacks the large stage before workspace controls. CSS orders the form
above context, but questions still follow toolbar/context/status text. Absolute
media overlays and dock-height calculations complicate keyboard responsiveness.
Compact panels have conflicting hard-coded stage/report overrides.

## Introduction gaps

[mattIntroduction](../frontend/src/components/matt/mattIntroduction.js) stores a
boolean in **sessionStorage only**, so a fresh browser session can repeat it.
Skip, completion and permanent disable are indistinguishable. There is no
explicit Watch or Do not show again control and no documented lifecycle states.
The owner/progress mechanism already prevents simultaneous playback and resumes
after a contextual remount; retain it. Storage errors already warn; retain
explicit degradation instead of claiming persistent preferences when blocked.

## Infocard audit

Existing reusable [GlassCard / EvidenceCard](../frontend/src/demo/DemoUI.jsx)
are used across contracts, obligations, risks, deadlines and Matt proposals.
They already provide native card markup; reuse rather than invent a competing
card library. Global CSS, aero overrides, spatial overrides and Globe's special
gradient/radius/shadow currently diverge. Matt's main response is an unstyled
article, while its proposal cards have a special borderless override.

## Implementation decision

1. Retain the shared intelligence, authorization and live media engines.
2. Introduce explicit persisted introduction outcomes per user/Demo, migrate the
   old completion marker, preserve ownership/progress and enable failure escape.
3. Use a genuine two-column DOM/grid: left stage and in-flow interaction
   controls; right contextual questions, scope and native response cards.
4. Mobile: bounded stage, reachable controls, compact suggestions, answer then
   expandable evidence. No absolute input dock or nested report scrolling.
5. Centralize native infocard surface tokens and apply to existing shared card,
   evidence, finding, aircraft and Matt surfaces without altering their data.
6. Measure placement and touch geometry, persist screenshots, exercise lifecycle
   transitions and rerun actual local authorization integration. No build-only
   acceptance; genuine provider/hardware acceptance remains separate.
