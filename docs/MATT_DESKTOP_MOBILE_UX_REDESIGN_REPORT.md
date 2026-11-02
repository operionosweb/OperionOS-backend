# Matt desktop/mobile UX redesign — 84317

Date: 2 November 2026. See the
[pre-edit audit](./MATT_FULL_ASSISTANT_ARCHITECTURE_AUDIT.md) for measured causes.

## Structural change

[MattExperience](../frontend/src/routes/Matt.jsx) now renders two actual regions:

1. **Left video column:** approved introduction or genuine connected A/V,
   one-time introduction controls, in-flow microphone/interruption/text form,
   connected audio/disconnect controls and expandable privacy settings.
2. **Right intelligence panel:** contextual question chips immediately at its
   top, authorized scope controls, activity/errors, native answer/findings,
   review action, expandable source evidence and details, conversation history.

The previous full-width stage, below-stage questions, conditional absolute
proposal rail, overlaid form and ResizeObserver dock-height workaround were
removed. This is a DOM/layout change, not just a color or spacing patch.
Questions occupy the right column before **and after** an answer. Results do
not move Matt or the question controls.

The executive answer is visible by default. Existing Show response text still
hides/reveals it without losing evidence, scope or history. Inspect/Close
findings remains available. No unsupported confidence metric was introduced.

## Context and action hierarchy

Suggestions reflect the active authorized mode: platform guide, account,
selected flight, selected contract or that response's follow-ups. Scope changes
do not carry a previous contract's suggestions into the platform guide.
Account suggestions do not promise established rankings or computed overdue
status.

The send/suggestion availability guard now permits platform guidance without a
selected contract. Account mode still requires approved live reasoning and
reports that limitation instead of faking a portfolio result.

The answer uses the existing normalized response, findings and source locators.
It distinguishes prepared guide, Demo, structured OCI and generated
interpretation. Review suggestions are explicitly unexecuted decision support;
no notices, liability amounts or invented mitigation claims are created.

## Deliberate mobile behavior

- Single-column bounded video, then compact controls, then questions and answers.
- Compact horizontal question strip scrolls within its own area, never widening
  the document. The first actionable question is tested above fixed navigation.
- Short mobile page heading preserves prepared/authorized provenance without
  consuming multiple screens. Supporting readiness explanation remains in the
  connection/voice regions.
- Text input remains in document flow; 16px textarea avoids mobile focus zoom
  and is tested with a 480px-high simulated keyboard viewport.
- Source evidence and review actions expand in place. No nested report
  scrollbox traps touch input.
- Touch controls retain at least 44px height; keyboard focus outlines and
  descriptive names remain. Reduced-motion mode is respected.
- Floating portrait keeps the approved crop/identity. First-entry auto-opening
  exposed a consent-banner overlap; mobile panel position now clears the
  portrait rather than intercepting its pointer.

## Acceptance method

Fresh Chromium viewports: 320x780, 390x844, 768x1024, 1024x768, 1440x900,
1920x1080, plus existing 360/430 and compact/workspace cases.

Checks measure actual video/question/control rectangles; desktop suggestions
must align beside Matt and all starter questions fit the initial viewport.
Mobile first-question **button**, not merely its heading, must fit above fixed
navigation and pass an `elementFromPoint` hit test. Answers must be in the right
panel on desktop. Evidence/answer surface tokens and touch targets are checked.

Screenshots are retained locally and indexed in the
[visual acceptance report](./MATT_DESKTOP_MOBILE_VISUAL_ACCEPTANCE_REPORT.md).
Actual hardware keyboards, Safari speech compatibility, human audibility and
genuine lip synchronization are outside this software acceptance.
