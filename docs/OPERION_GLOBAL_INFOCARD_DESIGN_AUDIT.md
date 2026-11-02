# Operion infocard design audit and standardization — 84317

Date: 2 November 2026.

## Before

Existing reusable GlassCard/EvidenceCard already expressed the right domain
structure. However spatial CSS layered gradients/heavy shadows onto cards,
Globe used an asymmetric corner treatment, and Matt's response article had no
native surface. Matt proposals deliberately stripped the shared card styling.
This made responses, aircraft and contract findings look unrelated.

## Shared mechanism

[InfoCard](../frontend/src/demo/DemoUI.jsx) is a small semantic surface wrapper
used by the existing GlassCard, Matt response and aircraft popup. It preserves
the caller's section/article/dialog semantics and attributes. It does not own
business logic, retrieval or confidence calculation.

[infoCards.css](../frontend/src/styles/infoCards.css) defines one set of surface,
border, radius, shadow, ink and muted-color tokens:

- Light white surface and restrained pale-blue evidence surface.
- 14px controlled radius and soft single shadow.
- Refined border, readable typography and consistent content rhythm.
- Optional warning edge for an explicitly unestablished response, not an
  invented numeric confidence score.

Existing clause, obligation, deadline, risk, portfolio, financial exposure and
evidence classes consume those tokens without changing their markup/data.
Aircraft retains dialog, close animation, source disclosures and selected
flight behavior. The specific Globe surface override now consumes the same
tokens instead of redefining a gradient/asymmetric radius.

The scoped [spatial layer](../frontend/src/styles/spatial-surfaces.css) uses
these shared tokens for relevant native card surfaces rather than overwriting
them with the old spatial theme. Marketing sections, globe rendering, maps,
navigation, financial calculations and unrelated workflows were not redesigned.
Summary metrics and map controls are not falsely recast as evidence cards.

## Matt hierarchy

Substantial answer:

1. Provenance/type label and contract/context title.
2. Concise executive answer, visible by default.
3. Typed findings.
4. Recommended source-review action, explicitly not executed.
5. Evidence and optional reasoning.
6. Explicit data limitations/unknown state.
7. Expandable review proposal and links to existing source workspace/report.

Not every response invents every section. Amounts, dates and findings continue
to come from existing intelligence; no decorative metrics or fabricated scores.
No independent analysis engine was added.

## Verification

- Measured computed radius/shadow consistency between Matt response and each
  source card at six responsive sizes.
- Browser navigation through existing clause, obligation, deadline, risk,
  financial-impact and evidence views checks their computed shared tokens.
- Actual selected Globe aircraft popup checks the same radius.
- Fresh SaaS synthetic transport screenshots/checks confirm the same response
  surface, not a Demo-only mock redesign.

Individual executed results and limitations are in the
[integration acceptance report](./MATT_ASSISTANT_INTEGRATION_ACCEPTANCE_REPORT.md).
This is a scoped standardization of supported native infocards, not a claim
that every marketing tile or future screen was manually reviewed.
