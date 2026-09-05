# Financial Impact Architecture

## Purpose

Financial Impact translates evidence-linked Contract Intelligence into a deterministic explanation of current contractual exposure, event-driven potential exposure, and explicitly supported mitigation value. It is not a generic financial dashboard, a forecast, or a scenario engine.

## IMPLEMENTED NOW

### Model

`financial-impact.v1` is a read-only derivation over an authoritative analysis run. It reads persisted clauses, obligations, deadlines, risks, evidence links, and profile recommendations. It creates no parallel financial record system.

Only a risk with `financial_exposure.type === "quantified"`, a finite non-negative amount, and a currency contributes to totals. Unquantified findings remain visible with an unavailable amount. Severity never becomes money.

### Exposure classes

- `current_contractual`: the risk has no stated future condition and the contractual terms currently apply.
- `event_driven`: the risk contains a condition that must occur before the exposure becomes relevant.

Event-driven exposure is not a prediction that the event will happen.

### Categories

The deterministic category rules cover service-level penalties, late payment, delay costs, grounding or downtime, minimum payments, termination, escalation or indexation, maintenance, supplier failure, operational disruption, penalties, and an explicit fallback category.

Categories classify the explanation only. They do not alter the amount.

### Currency treatment

Amounts are aggregated by currency. There is no exchange-rate conversion and no mixed-currency grand total.

### Potential protected value

Potential protected value is calculated only when an explicit post-mitigation amount exists and is no greater than the evidence-backed base amount:

$$
\text{Potential protected value} = \text{Base exposure} - \text{Explicit post-mitigation exposure}
$$

It is labelled as an estimate and never as guaranteed savings. If the post-mitigation value is missing, the product displays `Not quantified`.

### Provenance

Each impact retains links to its source risk, clause, obligations, deadlines, and evidence. The Financial Impact Tree presents:

1. Event
2. Contract condition
3. Clause
4. Financial consequence
5. Mitigation action, when available
6. Remaining exposure
7. Potential protected value

### Assumptions and uncertainty

Production does not add financial assumptions. Missing monetary values, post-mitigation values, probabilities, and event timing are reported as missing inputs. Probability is displayed only when supplied; it is not applied to totals in version 1.

The public demo uses a dedicated fixture whose rates, durations, and amounts are repeatedly labelled as synthetic assumptions. Demo figures are not read from customer records.

### API and tenancy

`GET /api/analysis-runs/:id/financial-impact` uses the same authentication, organization membership, and `contract:read` authorization chain as other analysis-run reads. The authoritative run is resolved with the organization ID before downstream readers execute. A missing or foreign run returns `404`.

No Financial Impact data is emitted into public metadata, sitemap entries, or structured data. Only the prepared synthetic demo route is public and indexable.

### User experience

The authenticated Contract Workspace and prepared contract demo provide:

- Four currency-aware summary measures.
- Impact records with event, clause, action, and value context.
- A WHY drawer containing calculation, assumptions, provenance, and an interactive exposure path.
- Source evidence access.
- Recommendation before/after/protected-value context when explicit inputs exist.
- Honest empty, partial, unquantified, unavailable, and loading states.

## FUTURE PREDICTIVE / SCENARIO CAPABILITIES

Future engines may provide explicit versioned inputs for event probabilities, time horizons, amount ranges, scenario parameters, stochastic simulations, exchange-rate policies, and alternative mitigation outcomes. They must remain separate from `financial-impact.v1` and preserve source, model version, timestamp, confidence, and assumption provenance.

A future interface can extend an impact with fields such as:

```json
{
  "scenarioId": "scenario-id",
  "modelVersion": "predictive-risk.v1",
  "probability": 0.2,
  "timeHorizon": "12 months",
  "amountRange": { "minimum": 500000, "maximum": 1500000, "currency": "EUR" },
  "assumptions": [],
  "sourceImpactId": "financial-impact:risk-id"
}
```

Predictive or scenario outputs must never silently replace contractual amounts. The UI must identify the engine, scenario, horizon, assumptions, and uncertainty and allow users to return to the underlying deterministic contract evidence.

## Non-goals

- No inferred currency conversion.
- No severity-to-money conversion.
- No invented post-mitigation values.
- No claim of guaranteed savings.
- No public customer financial API.
- No cross-tenant aggregation.
- No predictive event likelihood or simulation in version 1.
