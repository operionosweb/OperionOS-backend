# Operion Step 1C Legacy Behaviour Audit

Date: 2026-08-26

## Scope and evidence

The working tree was compared with `HEAD` (the pre-Step 1B state) using `git status`, `git log`, `git diff`, `git show`, and historical file-size comparisons. `HEAD` is the comparison point because Step 1B changes are currently uncommitted. The audit did not start Step 2 or add upload/ingestion behavior.

## Classification

| File | Previous role | Current role | Business logic preserved? | Action |
|---|---|---|---|---|
| `aiEngine.js` | Provider selection and contract-analysis prompt | Gateway compatibility entry point | Yes, as AI orchestration; provider calls intentionally removed | Keep gateway facade; tenant context is now required |
| `aircraftTransitionEngine.js` | Aviation transition prompt and structured AI response | Gateway operation adapter | Yes, no deterministic calculations existed in history | Keep operation behind gateway; verify provider schema at integration boundary |
| `aviationDecisionChainEngine.js` | Aviation decision-chain AI orchestration | Gateway operation adapter | Yes, no deterministic rules existed in history | Keep gateway adapter |
| `aviationFinancialStressTestEngine.js` | Financial stress-test AI orchestration | Gateway operation adapter | Yes, no local financial model existed in history | Keep gateway adapter; add schema fixture before production use |
| `engineLLPForecastingEngine.js` | LLP forecast AI orchestration | Gateway operation adapter | Yes, no local forecast calculation existed in history | Keep gateway adapter; add schema fixture before production use |
| `fleetEconomicsEngine.js` | Fleet economics AI orchestration | Gateway operation adapter | Yes, no local fleet mathematics existed in history | Keep gateway adapter; add schema fixture before production use |
| `leaseReturnSimulator.js` | Lease-return scenario AI orchestration | Gateway operation adapter | Yes, no local simulation existed in history | Keep gateway adapter; add schema fixture before production use |
| `maintenanceReserveEngine.js` | Maintenance reserve AI orchestration | Gateway operation adapter | Yes, no local reserve calculation existed in history | Keep gateway adapter; add schema fixture before production use |
| `clauseReasoningEngine.js` | Clause reasoning AI orchestration | Gateway operation adapter | Yes, no deterministic reasoning existed in history | Keep gateway adapter |
| `contractBenchmarkEngine.js` | Benchmarking AI orchestration | Gateway operation adapter | Yes, no database/rule calculation existed in history | Keep gateway adapter |
| `contractNegotiationSimulator.js` | Negotiation simulation AI orchestration | Gateway operation adapter | Yes, no deterministic simulation existed in history | Keep gateway adapter |
| `contractRedlineEngine.js` | Redline AI orchestration | Gateway operation adapter | Yes, no local formatting/rule engine existed in history | Keep gateway adapter |
| `contractRiskScoringEngine.js` | Risk-scoring AI orchestration | Gateway operation adapter | Yes, no local scorer existed in this file | Keep gateway adapter; deterministic scoring is restored in `services/contractRiskEngine.js` |
| `decisionOS.js` | AI-assisted operating decision generation | Gateway operation adapter | Yes, historical file contained no independent decision rules | Keep gateway adapter |
| `services/clauseParser.js` | AI extraction plus taxonomy, severity, confidence, and ARTICLE fallback | Gateway extraction plus deterministic fallback | Restored | Restored taxonomy, severity/confidence shaping, structured segmentation, source references, and fallback behavior |
| `services/obligationParser.js` | AI extraction plus local party/deadline rules | Gateway extraction plus deterministic fallback | Restored | Restored payment/insurance/compliance obligations, party detection, and relative deadline extraction |
| `services/contractRiskEngine.js` | Provider attempts plus deterministic local risk engine | Gateway attempt plus deterministic fallback | Restored | Restored risk formulas, score cap, critical flags, missing protections, summaries, and positional compatibility |
| `services/embeddingService.js` | Direct OpenAI embedding call | Gateway embedding operation | Provider-independent; response shape retained | Keep gateway boundary; embedding requires organization scope |
| `services/aiProviders.js` | Provider helpers and routing compatibility | Compatibility facade | Yes, direct provider logic removed | Keep minimal; no second gateway |
| `services/aiProviderHealth.js` | Direct Mistral/Aleph/OpenAI health probes | Gateway/configuration health surface | Provider calls intentionally superseded | Do not restore direct probes; verify current implementation at deployment |
| `services/ai/aiRouter.js` | Direct routing/provider calls | Gateway compatibility surface | Provider routing intentionally superseded | Do not restore; gateway owns routing |
| `services/aiRoutingEngine.js` | Routing decisions and provider selection | Gateway-compatible routing logic | Preserved | Keep as the single routing decision layer |

## Recovered deterministic behavior

- Contract risk scoring preserves the historical additive rules and 100-point cap. It recognizes uncapped liability, broad indemnification, termination exposure, missing insurance limits, missing protections, and high obligation volume while retaining the historical response structure.
- Clause fallback preserves structured clause output, taxonomy classification, severity scoring, confidence, source evidence, numbered/article segmentation, and source offsets by using the existing deterministic Phase 3 segmenter.
- Obligation fallback preserves payment, insurance, and compliance detection, responsible-party identification, relative `within N days` deadlines, priorities, and risk levels.
- AI remains optional for these fallback paths and all provider access goes through `aiGateway.js`.

## Validation

- Full backend suite: **116 passed**. The previous baseline was 112; four focused legacy-domain regression tests were added.
- Provider-boundary test: **passed**.
- `git diff --check`: **passed**.
- `node --check services/clauseParser.js`: **passed**.
- `node --check services/obligationParser.js`: **passed**.
- `node --check services/contractRiskEngine.js`: **passed**.
- No dedicated safe Supabase test database was identified, so the live migration/RLS harness was not run. Production data and schema were not touched.
- The pre-existing syntax errors remain: `executiveDashboardEngine.js` contains JSX in a `.js` file, and `inspect.js` has a missing closing parenthesis. Neither was changed.

## Remaining uncertainty

Historical aviation and negotiation files were substantially reduced in line count, but their removed bodies were provider prompts, provider fallback calls, and JSON fallback payloads rather than deterministic aviation calculations or rule engines. The current gateway preserves operation names and structured responses, but representative provider schema fixtures should be added before production rollout to detect provider-output drift. No missing deterministic calculation was found in the Git history inspected for these files.
