# OPERION LIVE MATT OCI PILOT READINESS REPORT

## Scope and authorization - 2 November 2026

This report covers the founder-approved **Matt visual publication only**.
The user confirmed that the outdated page was
<https://www.operionos.com/demo/matt> and explicitly approved overriding the
no-commit/no-push/no-deploy restrictions for this scoped fix. Provider spending,
identity uploads and unrelated dirty OCI work remain excluded.

## Initial architecture and defect

**VERIFIED:** the live public page served an older Matt bundle,
`Matt-DUlBmp8q.js`, with a static `executive-office.jpg` element and the
"Talking video unavailable / identity reference only" message. The redesigned
source existed only in a dirty isolated development worktree. This was an
unpublished-build mismatch, not evidence that refreshing could recover the new
visuals.

Remote main was `d32ab904f697489e6ff07f02640da55c4d960abd`. A separate clean
detached release candidate was created from that exact main revision.
The original dirty worktree was fingerprinted and left unchanged.

## Files and features in this release

| File | Scoped change |
| --- | --- |
| [Matt route](../frontend/src/routes/Matt.jsx) | Progressive findings, collapsed proposals/search, retained report, playback status and simpler controls. |
| [MattEnvironment](../frontend/src/components/matt/MattEnvironment.jsx) | Supplied identity video instead of a static image, honest media label, playback failure/retry and media-source lifecycle. |
| [Floating assistant](../frontend/src/components/demo/OperionAssistant.jsx) | Muted identity-video launcher and explicit asset error. |
| [Studio styles](../frontend/src/styles/mattStudio.css) | Light video-first desktop/mobile hierarchy, bounded findings rail, measured command dock and non-overlapping labels. |
| [Base styles](../frontend/src/styles/matt.css) | Remove animated static-portrait treatment; video/error/disclosure styling. |
| [Floating styles](../frontend/src/styles/mattFloating.css) | Video launcher and consent-aware downward-opening desktop panel. |
| [Studio tests](../frontend/tests/matt-studio.test.mjs) | Updated intentional disclosure/proposal controls, video playback and geometry regressions. |
| [Browser tests](../frontend/tests/matt-browser.test.mjs) | Reject static Matt, check playback and honest disclosures, retain permissions/cancellation checks. |
| [Unified tests](../frontend/tests/matt-unified.test.mjs) | Open intentionally collapsed review actions before report/workspace navigation. |
| This report | Scope, evidence and readiness limitations. |

The existing MP4 was already tracked on main. No new identity media was uploaded.
No backend, extraction engine, profile service, authentication component,
permission gate, Globe logic, provider adapter, dependency or configuration file
is part of this release.

## Executed candidate tests

**VERIFIED locally:** 39 focused browser checks passed on the actual clean
publication candidate:

- Studio: 20/20, including widths 320-1920 pixels, video playback, findings,
  optional text, proposals, microphone consent and layout collisions.
- Matt browser: 13/13, including production-style Vite build, real local video
  playback, authorized endpoint scope, interruption/stale-response handling,
  unauthenticated denial and failed permission lookup.
- Unified Matt: 6/6, including main/workspace/floating/report continuity and
  responsive embedded views.

The suites each build Vite and run Chromium against loopback previews. They ran
serially. Authentication and contract API responses are mocked; injected speech
recognition is not a real microphone/provider test. The supplied MP4 actually
plays locally. Screenshots were captured for visual review. These results do
not prove live-avatar operation or deployed production behaviour.

## Matt capability assessment

| Capability | Status and evidence |
| --- | --- |
| Redesigned video-first section | VERIFIED on clean local candidate; publication verification follows the push. |
| Prerecorded supplied Matt identity video | VERIFIED local playback, muted/autoplay/loop/inline, no static fallback. |
| Optional findings, source evidence and reports | VERIFIED using prepared demonstration data and mocked authorized transport. |
| Single browser audio/video stream support | IMPLEMENTED media boundary; no provider session is connected by this release. |
| Genuine answer-specific synchronized Matt video | BLOCKED: approved provider, enrolled identity, fixed voice, privacy/data flow and budget still missing. |
| Natural generated conversation and emotional responsiveness | NOT IMPLEMENTED by this visual publication. |
| Genuine live interruption end-to-end | BLOCKED; cancelling an intelligence request is not provider speech interruption. |

The interface explicitly identifies identity footage and states that live
synchronized conversation is not connected. Browser TTS does not masquerade
as talking video.

## OCI, providers and pilot acceptance

OCI is unchanged in this release. Separate local reliability work, including
deadline and evidence-link improvements, is deliberately **not published** here.
No real confidential lease upload, production corpus evaluation, tenant-isolation
audit or production persistence acceptance was performed.

The prior official-documentation comparison remains a conditional architecture
assessment, not a configured integration:

- [LiveAvatar LITE](https://docs.liveavatar.com/docs/lite-mode/overview.md):
  rendering-only streaming candidate; Operion must supply authorized speech
  audio and orchestration. Identity, voice, privacy and spending approvals remain.
- [Tavus Echo](https://docs.tavus.io/sections/conversational-video-interface/echo-mode.md):
  alternative realtime renderer; Echo is incompatible with perception and does
  not automatically provide Operion's contextual orchestration.
- [Sync generation API](https://sync.so/docs/quickstart.md):
  asynchronous lip-sync jobs are not proof of low-latency, interruptible Matt.

No new pricing validation, vendor privacy assurance, latency measurement or
security certification is claimed. No provider API call, subscription change,
secret exposure or identity upload was performed.

The mandatory unexpected-question / genuine talking answer / follow-up /
interrupt / selected-aircraft OCI scenario remains **BLOCKED**. Prerecorded
footage and mocked tests do not satisfy it.

## Security, publication and verification boundary

Existing organization/contract permission gates and backend services are
unchanged. No relaxation of tenant access is included. Only the files listed
above are intended for the authorized non-force main publication.

Production delivery uses the repository's existing hosting integration; no DNS,
hosting project, environment or infrastructure setting is changed. Main pushes
can also trigger the existing backend hosting integration, but backend source
is unchanged.

At the time this report is committed, public deployment acceptance is pending.
Completion requires re-reading the exact public URL after hosting updates:
verify a changed Matt bundle, no static portrait, playing video, redesigned
desktop/mobile layout, honest preview disclosure and usable findings.
A successful push alone must not be reported as a successful production fix.

## Recommended next phase

After verifying this scoped visual publication, obtain explicit provider,
identity, fixed-voice, data-processing and capped-budget decisions. Implement
and test the authorized live session orchestration separately. Resume OCI
reliability work from the preserved isolated worktree, not by publishing all
dirty files as a shortcut.

The desktop individual-file acceptance safety gate remains unresolved; no Kilo
Apply/Revert/Keep/Undo mechanism is used.

## Overall verdict

**NOT READY.** This release fixes delivery of the Matt visuals; it is not a
completed live-avatar integration or confidential paid-pilot acceptance.
