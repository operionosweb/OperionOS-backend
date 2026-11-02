# Matt Stitch integration: controlled local preview

Historical preview record. The later authorized
[unified Matt release](unified-matt-global-globe-release-2026-11-01.md) removes the
studio-only publication gate, unifies assistant entry points and supersedes this
record's local-only status. Real talking video remains blocked, not simulated.

## Phase A: design and architecture audit

The desktop and mobile HTML references were inspected. They are visual prototypes,
not working video engines: both use background photographs, manually selected
states and invented reports/telemetry. Desktop simulates request completion with
a 1,400 ms timer. Mobile initializes a microphone indicator as active without
capturing audio. None of that behavior will be copied into Operion.

### Design-to-code mapping

| Stitch element | Operion adaptation |
|---|---|
| Dominant cinematic viewport | Large identity-preserving scene using supplied prerecorded Matt video, clearly distinguished from live synchronized avatar output |
| Identity/status HUD | Matt identity and real reducer phase; no fake optics, compliance, latency, quality or synchronization |
| Floating control island | Real consent-gated recognition, interrupt, optional text input and response text |
| Desktop intelligence drawer | Existing evidence-backed report, secondary to scene, controlled disclosure |
| Mobile portrait and sheet | Independent mobile framing; portrait above controls and collapsible evidence sheet |
| State rail | Read-only actual current state, not buttons pretending to generate human states |
| Invented liability/playbook | Existing findings/evidence only; no invented amounts, waived liabilities, notices or action execution |
| Prototype navigation | Keep Operion's existing shell/routes; no additional dashboard, archive or avionics menus |
| Fonts/CDN/scripts | Existing Operion typography/CSS/Lucide; no remote Tailwind/font/image dependency |

### Reuse and expected changes

Reuse `MattExperience`'s existing assistant/catalog/organization gate, cancellation,
reducer, in-memory conversation and native recognition adapter. Add a build-gated,
query-selected studio preview in the existing Matt route and a scoped stylesheet.
Adapt `MattEnvironment` only for an explicit unavailable-video preview variant.
Add browser acceptance coverage; retain published Matt behavior and tests.

### Technology gate

Previous [MCVE investigation](../../OperionOS-mcve-investigation-2026-11-01/docs/matt-cinematic-video-engine-audit-2026-11-01.md)
remains applicable: no approved provider credential, custom Matt identity or
fixed audio-producing TTS service has been established. Process provider names
were rechecked; none available. Current main is still
`cdadd1f8d3eb55502738db0c5b012a5e93e89213`. No new provider access is inferred.

LiveAvatar LITE remains conditional first choice; Tavus Echo and asynchronous
Sync are alternatives with the previously documented latency/cost tradeoffs.
No paid generation, asset upload, identity creation or subscription is authorized.
Phase C therefore remains **blocked**. No fake provider interface or independent
TTS over generic footage will be added to the studio.

### Safe increment

Implement Phase B visual integration as an **explicit local preview**, not a
complete video-first experience. Optional response-text visibility can be reviewed
without deleting conversation or findings, but text-hidden voice/video acceptance
cannot pass while renderer output is missing. Keep a persistent actionable
blocked-video notice even when response text is hidden.

The preview is enabled only in development or the dedicated
`matt-studio-preview` build mode, and only with `?studio=1` on the existing route.
Normal production builds ignore the query and retain the published experience.
No production push/deploy is authorized.

### Additional controller reference

The subsequently supplied 280-line controller was inspected read-only.
It contains unresolved `{{DATA:IMAGE:...}}` substitutions, fixed fictional
answers/latencies/camera metrics and `Math.random()` waveform scaling.
Its microphone and interrupt merely call `renderState`; it does not create
recognition, audio, video rendering or an authorized assistant request.
Its Three.js script is unused and the required stage DOM is absent.
Do not treat it as a working engine or import its simulated data into Operion.

## Development report

### 1. Desktop adaptation

**Partially implemented / local preview.** The cinematic region spans the page,
with a compact identity pill, real interaction status, primary control island
inside the scene, and a secondary dismissible evidence drawer. Optional keyboard
input shares the same controls. Contract context and prepared question shortcuts
remain below the scene. No prototype navigation, dashboards or invented telemetry.
Real streaming video is not implemented.

### 2. Mobile adaptation

**Partially implemented / local preview.** Portrait framing, a small identity chip
outside the face, prominent microphone/interrupt/keyboard controls immediately
below the scene, and a collapsible findings sheet replace the desktop drawer.
Existing Operion mobile navigation remains intact.

### 3. Architecture

**Fully implemented for the preview boundary.** Existing `/demo/matt` and
authenticated `/app/matt` remain the only routes. The studio variant requires
`?studio=1` plus development or `matt-studio-preview` build mode.
The normal production-style build is tested to ignore that query.

The same reducer, request IDs, AbortSignal handling, scoped catalog, document
analysis resolution, search and evidence-backed assistant are used. No new backend,
route, authority, database, extraction, gateway provider or paid analysis is added.
Changing organization/experience remounts scoped state.

### 4. Provider integration

**Blocked.** No video provider is connected. No account, token, custom identity,
TTS pipeline or service endpoint was created. Local configuration/process names
contain no recognized video/TTS provider entry. Previous dashboard findings are
historical evidence, not a new remote account/credential verification.

### 5. Actual talking-video demonstration

**Not implemented / blocked.** No dynamically generated spoken video response was
demonstrated. The approved supplied portrait is clearly marked as a reference.
No prerecorded clip, random waveform, parallax, fake phoneme animation or
success timer is used by the studio.

### 6. Audio/video synchronization

**Blocked.** No audio/video stream exists, so lip synchronization, natural face,
gaze, head/body/hands, response-specific video and playback continuity have not
passed acceptance. Independent browser speech output is disabled in the studio.
Legacy published-candidate speech behavior remains unchanged outside the preview.

### 7. Voice

**Partially implemented.** Existing browser recognition remains opt-in under the
visit-specific speech-service consent. A transcript opens keyboard review; it is
not automatically sent. Interruption aborts capture/request state.
Recognition availability is not successful real microphone/network acceptance:
browser tests inject synthetic recognition events. Consistent branded spoken
output, voice-only discussion and real microphone/provider acceptance are blocked.

### 8. Text visibility

**Fully implemented as a local UI control; end-to-end requirement blocked.**
Answer text and conversation transcript are hidden by default. The discreet
checkbox reveals/removes both without deleting results, selected scope, evidence
or follow-up memory. Keyboard input is separately disclosed. Source evidence and
findings can be inspected independently; the unavailable-video notice remains.

This does **not** demonstrate continuing video/audio with text hidden. Text-free
video/voice conversation cannot work without a provider and is not accepted.

### 9. Responsive and accessibility testing

**Fully implemented for the tested layout.** Chromium checks at 320, 390, 768,
1024, 1440 and 1920 px establish no page overflow, scene width at least 95% of its
layout, scene height at least 360 px, visible buttons/summaries at least 44 px,
desktop controls inside the scene and mobile controls within 60 px below it.
The mobile quick-question strip scrolls internally rather than overflowing.
Portrait animation is absent, including reduced-motion preference.

Desktop/mobile screenshots were inspected; identity overlays do not cover the
face. Fixed shell navigation in full-page captures is not part of the media.
Keyboard activation uses native buttons/checkboxes/details; existing focus-visible
styles remain. Actual streaming performance is not measured.

- [Desktop local preview](../../../.copilot/session-state/4c2513af-b11c-48a4-b2d2-dc65cef88c91/files/matt-studio-1440.png)
- [Mobile local preview](../../../.copilot/session-state/4c2513af-b11c-48a4-b2d2-dc65cef88c91/files/matt-studio-390.png)

### 10. Character consistency

**Demo-only reference identity.** Only the already supplied Matt office portrait
is used. No alternate person, remote placeholder, cockpit/lounge asset or generic
stock avatar is substituted. Consistency of a generated human identity/voice
cannot be verified before custom-avatar trials.

### 11. Security and privacy

**Existing boundaries preserved; provider privacy blocked.**
Demo tests make no customer API, external host or video download requests.
Unauthorized studio access redirects to existing login. Existing authenticated
Matt tests cover tenant scoping, role verification failure, denied permissions,
invalid responses, missing analysis and stale-response cancellation.

No credential values were read into reports or application changes. A pattern
scan of all six changed/new files found no key/private-key/token patterns; this
is a limited heuristic, not a comprehensive historical secret audit.
Manifests/lockfiles, backend, migrations, OCI authority and TLS code are unchanged.
No production data operation, migration or identity upload was performed.

`npm audit` on the unchanged frontend lockfile reports four vulnerable packages:
DOMPurify (critical, transitive), Vite (high, direct), source-map-js (high,
transitive), esbuild (moderate, transitive). These are registry advisory ratings,
not verified application exploits. No dependency was upgraded or audit fix run.
Keep development serving local-only; review these inherited advisories separately
before a release. Provider DPA, retention/region, likeness/voice permissions and
customer-data transmission approval remain unresolved.

### 12. Cost and latency

**Not measured for audio/video.** No billable provider call, subscription, training
or generation occurred. Previous MCVE estimates are not account quotes or
Operion latency results. No invented milliseconds, audio frequency, frame rate or
cost-per-conversation are displayed. Trial approval must include a hard budget,
custom-avatar entitlement, idle/active billing and cancellation behavior.

### 13. Outstanding blockers / authorized next gate

1. Approved server-side LiveAvatar LITE or alternative account access.
2. Explicit permission to upload/train Matt identity, with valid likeness/voice
   consent. The supplied 32.58-second clip does not meet the previously documented
   two-minute video-avatar requirement; an approved image-avatar trial is an
   alternative only if actual human quality passes acceptance.
3. Approved fixed TTS voice producing the renderer's required audio, not browser
   speech synthesis.
4. Privacy/DPA/retention/region and customer evidence transmission approval.
5. Trial quota, spend cap and sustainable serving budget.
6. Real generated-response, synchronization, human-motion, voice-only/text-hidden,
   interruption, continuity and measured-latency acceptance.
7. Explicit acceptance before any GitHub production publication.

Stop at Phase C until these are resolved. Do not infer permissions from a supplied
image or from existing text-intelligence credits.

### 14. Files changed

Created:
- [Studio stylesheet](../frontend/src/styles/mattStudio.css)
- [Studio browser tests](../frontend/tests/matt-studio.test.mjs)
- This development report.

Modified:
- [Existing Matt route/presentation](../frontend/src/routes/Matt.jsx)
- [Existing scene component](../frontend/src/components/matt/MattEnvironment.jsx)
- [Existing browser suite](../frontend/tests/matt-browser.test.mjs), adding a
  production-build guard regression.

No manifests, lockfiles, supplied assets, auth middleware or intelligence service
were modified. Dependencies were restored only in the new worktree after the
initial build failed because Vite was missing, using existing
`npm ci --ignore-scripts`.

### 15. Validation results

| Command / gate | Result |
|---|---|
| `node --test tests/matt-studio.test.mjs` | 9/9, final dock/text/consent/layout variant |
| `node --test tests/matt-unit.test.mjs tests/matt-browser.test.mjs` | 24/24, including new production-build guard |
| `node --test tests/oci.test.mjs` | 36/36; OCI/customer/recovery/Globe regressions |
| `node --test test/contract-assistant-service.test.js` (repository root) | 4/4, actual reused evidence service |
| Public frontend production-style build | Passed inside existing Matt and OCI browser runners, synthetic offline environment |
| OCI production-style build | Passed inside existing OCI runner, synthetic offline environment |
| Studio preview build | Passed inside final studio runner |
| `git diff --check` | Passed |
| Manifest/lockfile comparison | Unchanged |
| Changed/new-file credential-pattern scan | No matches |
| `npm audit --json` | Nonzero: inherited four-package advisories, above |

The first studio auth test expected `/auth/login` while Operion actually redirects
to `/login`; the test expectation was corrected, not authentication. All nine
then passed. Existing full-backend historical baseline remains 518/519 with the
known homepage source-heading assertion; that full suite was **not rerun** and
is not claimed green. No real database, mic service or provider acceptance tested.
Test-owned local servers and browsers close automatically; no service is left
running.

### 16. Production readiness / final verdict

**LOCAL DESIGN PREVIEW VERIFIED — REAL TALKING VIDEO BLOCKED.**

Phases B/D are a reviewable partial visual increment, not completion of Matt's
video-first mission. No production-ready, dynamically talking, text-free Matt
experience is claimed.

New isolated detached worktree:
`OperionOS-matt-stitch-preview-2026-11-01`, based on
`cdadd1f8d3eb55502738db0c5b012a5e93e89213`.
No commit, push, merge or deployment was performed. Independent `ls-remote`
still returns the same GitHub main SHA. Previously existing worktree heads were
rechecked unchanged; no writes were made to their project files.

For local review only, from the new worktree's frontend use existing `npm run dev`
bound to `127.0.0.1`, then `/demo/matt?studio=1`. It is not enabled in an ordinary
production build. Offline build/test artifacts used synthetic configuration and
are not deployment candidates. Await identity/provider/privacy/budget approval
and subsequent real-video acceptance before release.

## Latest increment: ONLY Matt Visual and Proposal

This section supersedes the earlier layout/test inventory where changed. The
existing isolated preview changes were preserved, not reset or recreated.

### 1. Exact extraction boundaries

Read-only source: attachment `a31fb142-f51f-4e98-bde6-be6a1ca52b30`,
`Pasted text #1.txt`, 520 lines.

- **Matt Visual:** opening section at line **180** through closing section at
  **234**, introduced by the left-stage comment at 179. Contains background frame,
  vignette, identity HUD, transcript pill (208-209), spacer, quick prompts and
  unified glass input/interrupt/microphone/send dock (212-233).
- **Proposal:** there is no literal Proposal heading in this source. The only
  corresponding document interface is the right intelligence dossier:
  opening aside **236** through closing aside **376**, introduced at 235.
  Header 236-253; notice status 255-269; particulars, exhibit schedule and
  assessment 271-352; document-action binder 354-376.
- **Excluded:** head/runtime/CDN configuration and global body locks (1-107),
  navigation/profile/manual state buttons (108-176), and fake state engine
  (378-518). No rest-of-Stitch application was imported.

Visual styling was adapted rather than copying runtime Tailwind or global CSS.
The source has no genuine video engine or mobile implementation: mobile behavior
was created within the existing Matt component, not inferred from its fixed
380/420-pixel rail. Prototype remote portraits, fake waveform/audio metrics,
simulation timers and alternate identities were excluded.

### 2. Files and components

Latest changes:
- Created [MattProposal](../frontend/src/components/matt/MattProposal.jsx).
- Updated [Matt](../frontend/src/routes/Matt.jsx) to expose Proposal in the same
  evidence panel and pass actual result/context and existing compose callback.
- Updated [studio CSS](../frontend/src/styles/mattStudio.css) with side-by-side
  desktop rail, document cards and height-bounded mobile sheet.
- Expanded [studio tests](../frontend/tests/matt-studio.test.mjs) to cover Proposal
  interaction at all six widths, bounded sheet and dominant scene geometry.
- Updated this report.

Previous local changes to the scene and normal-build guard remain preserved.
No additional dependency, asset, navigation, authentication, router/backend/data
model or production configuration changed in this increment.

### 3. Matt Visual integration

**Completed local visual increment, not completed video interaction.**
Reuse approved office identity, light Operion colors, scene framing, compact HUD,
glass input dock and native controls. Open Proposal reduces scene width to
approximately 68%, reserving approximately 32% for the rail instead of overlaying
it on Matt's face. Closing restores the full scene.

Desktop dock height now anchors upward from the stage bottom, so wrapped controls
at tablet/compact desktop widths remain inside the scene. The first 1024-pixel
test caught overflowing fixed-height dock assumptions; the CSS was corrected
and final tests pass.

### 4. Functional Proposal integration

**Completed evidence/review interface; recommendation generation and execution
remain unavailable.** Header/status banner, distinct document-style cards and
action binder take only the authorised rail presentation.

The actual assistant returns `established`, `answer`, typed `findings` and source
`evidence`; it does not return a recommendation, notice draft or execution status.
Accordingly:

- Existing findings and supporting source excerpts remain available.
- Returned `risk` findings are separated; no returned risk does not mean risk-free.
- Recommendations card explicitly reports no generated mitigation proposal.
- Review suggestions are labeled Operion review suggestions, not AI-generated
  or approved actions.
- Clarify-first-finding fills the existing assistant composer with the selected
  result's finding; sending uses existing scoped intelligence.
- Review-contract-evidence navigates to the existing contract workspace.
- Assumptions/missing data are distinct from evidence and risks.
- Notice transmission, PDF notice export, DocuSign/escrow and notary verification
  are explicitly unavailable; there are no fake execution buttons.
- No GECAS notice, certification, zero penalty, neutralized deficit or savings
  claim is copied. No action or record is approved or changed by this interface.

### 5–7. Desktop, mobile and viewport results

Desktop 1024/1440/1920: scene remains at least 65% of layout with Proposal open;
controls inside scene; bounded independently scrollable rail.
Mobile/tablet 320/390/768: full-width portrait, primary controls immediately below,
touch-friendly controls and collapsible Proposal sheet capped at 75 viewport-height
percent (maximum 680 px), avoiding an unlimited document wall.
Source evidence details remain separately expandable inside the sheet.

All six widths tested: no page horizontal overflow, scene minimum height 360 px,
buttons/summaries minimum height 44 px, no portrait animation and no reference
video download. Proposal is readable/usable through its own vertical scroll.
Desktop/mobile screenshots were inspected; full-page browser captures can place
existing fixed shell navigation over offscreen content, not an application
layout regression.

### 8. Executed tests

| Gate | Actual result |
|---|---|
| Final studio/Proposal browser suite | **15/15** |
| Existing Matt unit/browser tests, including production-build guard | **24/24** |
| Existing OCI/customer/recovery/Globe browser regressions | **36/36** |
| Reused backend assistant service tests | **4/4** |
| Studio build | Passed within final studio runner |
| Public and OCI production-style builds | Passed within regression runners |
| Patch whitespace and protected-surface comparison | Passed |

Total **79 distinct tests passed**, not counting repeated runs. Proposal tests
exercise opening before a result, honest limitations, first-finding follow-up,
evidence navigation, retained proposal with response text off, hiding/reopening,
all six widths and bounded mobile presentation.
The final local-only CSS sheet cap was followed by another complete 15-test studio
run. Existing production regressions preceded that preview-scoped cap.

Voice tests use injected recognition events and existing unit cancellation tests:
real microphone/vendor acceptance is not claimed. Response text/history and
keyboard input can be hidden separately without clearing scope or results.
That does not demonstrate a working text-free video conversation.

No full-backend-suite rerun; earlier documented 518/519 baseline remains historical.
No new dependency audit fixes; inherited advisories from the previous scan remain.

### 9–10. Remaining limitations and real-video verdict

**REAL SYNCHRONIZED TALKING VIDEO STILL BLOCKED.**
The studio continuously plays supplied prerecorded Matt footage; it is not
generated per answer and is not synchronized to response audio. No generated
response video, matching audio, lip sync, fixed voice or text-hidden audio/video
continuation was demonstrated. Provider access, approved custom identity/rights,
fixed audio configuration, privacy approval and trial budget remain necessary.
No provider upload, purchase or billable provider call occurred.

The two authorised visual sections are integrated locally; the full video-first
product is not complete or ready for production.

### 11. Production and GitHub safety

Work restricted to existing isolated `OperionOS-matt-stitch-preview-2026-11-01`.
No commit, push, merge, deploy, DNS/hosting change or production data operation.
GitHub main independently rechecked at
`cdadd1f8d3eb55502738db0c5b012a5e93e89213`.
Existing worktree heads and prior local modifications were preserved.
Source attachments remain untouched. Await explicit acceptance/provider approval.

## Demo design-system alignment increment

Latest attachments `356d0ea3...` and `aa93dfce...` are byte-identical
655-line sources containing both desktop and mobile designs. The mobile reference
adds a portrait feed, compact controls, optional transcript and accordion dossier;
its simulated certification, signatures, zero exposure, financial transfer,
audio telemetry and provider states are not imported. The third source is the
previously inspected 280-line simulated controller, not an operational renderer.

The authorised Matt/Proposal visuals now reuse Demo's actual `PageHeader`,
`DemoBadge`, `GlassCard` and `EvidenceCard` components. Shared Demo Joby typography,
light-blue spatial surfaces, borders and shadow variables are used instead of
Stitch's fonts, beige palette or CDN. No navigation, shell or other page changed.
The supplied Matt portrait remains the only identity.

**Exact mobile margins:** Demo's existing
`spatial-surfaces.css` mobile `.od-main { padding-inline: 2px; }` is reused without
changing it. Matt's redundant page/container padding is removed. Notice, stage,
control widget, Proposal sheet, Proposal info cards/status and source-evidence
widgets are measured at **2px left and right** at 320, 360, 390, 430 and 768 px.
Nested sheet/card padding no longer accumulates extra outer gutters. Readable
internal text padding remains. The height-bounded Proposal sheet retains internal
scroll; the page does not overflow horizontally.

Executed validation:
- Final studio/Proposal suite **19/19**, at eight widths:
  320, 360, 390, 430, 768, 1024, 1440, 1920.
- Existing Matt unit/browser suite **24/24**.
- OCI/customer/recovery/Globe browser suite **36/36**.
- Public, OCI and studio builds passed inside these runners.
- Desktop 1440 and mobile 390 screenshots inspected.

The first legacy Matt run exposed an asynchronous test assertion: supporting
evidence was rendered before the `details` toggle's review state had committed.
The test now waits for the actual `SUCCESS` state; production state logic was
not changed. The subsequent entire Matt suite passed.

Latest files changed: Matt route, MattEnvironment, MattProposal, studio CSS,
studio tests, legacy browser test wait and this report. No manifests, lockfiles,
backend, authority, assets, shared Demo styling or hosting settings changed.

**Visual alignment verified locally; synchronized video remains blocked.**
No real video/voice-only acceptance claimed, asset upload, provider cost, commit,
push or deployment. GitHub main remains at the previously verified SHA.
Inherited dependency advisories and previous full-backend baseline remain as
documented; no new full-suite or real-service success is claimed.
