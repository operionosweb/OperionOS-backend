export function resolveContext(location, contracts, primaryContract, aviationContext) {
  const contractId = location.pathname.match(/^\/demo\/contracts\/([^/]+)/)?.[1];
  const contract = contracts.find((item) => item.id === contractId) || primaryContract;
  const section = location.pathname.split("/").at(-1);
  if (location.pathname.includes("live-tracking")) {
    const aircraft = aviationContext?.aircraft;
    const relatedContracts = aviationContext?.relatedContracts || [];
    return { type: "AIRCRAFT", title: aviationContext?.selectedContract?.title || aircraft?.registration || "Aircraft intelligence", subtitle: aviationContext?.selectedContract ? `${aviationContext.linkedAircraft?.length || 0} linked aircraft / ${aircraft?.registration}` : aircraft ? `${aircraft.model} / ${aircraft.flightNumber}` : "Aviation intelligence ready", contract: aviationContext?.selectedContract || relatedContracts[0] || contract, aircraft, relatedContracts, relationships: aviationContext?.relationships || [], selectedContract: aviationContext?.selectedContract, linkedAircraft: aviationContext?.linkedAircraft || [] };
  }
  if (contractId) {
    const labels = { risks: "Risk intelligence ready", obligations: "Obligation intelligence ready", deadlines: "Deadline intelligence ready", evidence: "Evidence intelligence ready", clauses: "Clause intelligence ready" };
    return { type: section === "assistant" ? "CONTRACT" : (section || "CONTRACT").toUpperCase(), title: contract.title, subtitle: labels[section] || `Analysing ${contract.contractId}`, contract };
  }
  if (location.pathname.includes("intelligence")) return { type: "PORTFOLIO", title: "Contract intelligence", subtitle: "Portfolio intelligence ready", contract };
  if (location.pathname.includes("upload")) return { type: "DOCUMENT", title: "Contract ingestion", subtitle: "Document context ready", contract };
  return { type: "PORTFOLIO", title: "Aviation Partners Ltd.", subtitle: "Portfolio intelligence ready", contract };
}
export function suggestionsFor(context) {
  if (context.type === "AIRCRAFT") return ["What aircraft are affected by this contract?", "Show supplier dependencies", "Show linked maintenance obligations"];
  if (context.type === "RISKS") return ["Analyse the highest contract risks", "Which risks have the strongest evidence?", "What should management review first?"];
  if (context.type === "OBLIGATIONS") return ["Show obligations due this month", "Which obligations are conditional?", "Show obligation source clauses"];
  if (context.type === "DEADLINES") return ["Which deadlines are computable?", "Show ambiguous deadlines", "What trigger dates are missing?"];
  return ["Analyse the highest contract risks", "Show obligations due this month", "Summarise this contract", "What happens if we return the aircraft late?"];
}

function evidenceFor(contract, ids) {
  return ids.map((id) => contract.evidence.find((item) => item.id === id)).filter(Boolean);
}

export function answerQuestion(question, context) {
  const contract = context.contract;
  const scopedContracts = context.relatedContracts?.length ? context.relatedContracts : [contract];
  const relationshipFor = (item) => context.relationships?.find((relationship) => relationship.contractId === item.id);
  const scopedRisks = scopedContracts.flatMap((item) => { const relationship = relationshipFor(item); return relationship ? item.risks.filter((risk) => relationship.riskIds.includes(risk.id)) : item.risks; });
  const scopedObligations = scopedContracts.flatMap((item) => { const relationship = relationshipFor(item); return relationship ? item.obligations.filter((obligation) => relationship.obligationIds.includes(obligation.id)) : item.obligations; });
  const scopedDeadlines = scopedContracts.flatMap((item) => { const relationship = relationshipFor(item); return relationship ? item.deadlines.filter((deadline) => relationship.deadlineIds.includes(deadline.id)) : item.deadlines; });
  const normalized = question.toLowerCase();
  const base = { id: `answer-${Date.now()}`, role: "assistant", question, contractId: contract.id };
  if (/late|return aircraft|redelivery/.test(normalized)) {
    return { ...base, type: "risk", title: "Late-return exposure identified", summary: "Late return may trigger a daily fee under Clause 22.4. Continued delay may also give the lessor termination rights after the stated period.", confidence: 96, items: contract.risks.filter((risk) => risk.id === "rk-return"), evidence: evidenceFor(contract, ["ev-return", "ev-termination"]), recommendation: "Confirm the contractual return date and prepare the redelivery evidence package before expiry." };
  }
  if (/risk|exposure|management review/.test(normalized)) {
    return { ...base, type: "risk", title: `${scopedRisks.length} material risks identified`, summary: `Operion ranked the prepared findings linked to ${context.aircraft?.registration || contract.contractId} and retained their evidence lineage.`, confidence: 94, items: scopedRisks, evidence: evidenceFor(contract, contract.risks.flatMap((risk) => risk.evidenceIds).slice(0, 3)), recommendation: "Review critical return conditions before the high-severity maintenance records finding." };
  }
  if (/obligation|commitment|insurance/.test(normalized)) {
    const items = /insurance/.test(normalized) ? scopedObligations.filter((item) => item.category === "Insurance") : scopedObligations;
    return { ...base, type: "obligation", title: `${items.length} structured obligation${items.length === 1 ? "" : "s"} found`, summary: "Each obligation remains connected to its actor, timing, condition, clause, and source evidence.", confidence: 97, items, evidence: evidenceFor(contract, items.map((item) => item.evidenceId)), recommendation: "Validate trigger dates before treating relative deadlines as calendar dates." };
  }
  if (/deadline|due|timing|trigger date|ambiguous/.test(normalized)) {
    return { ...base, type: "deadline", title: `${scopedDeadlines.length} deadline expressions found`, summary: "Operion distinguishes absolute, relative, recurring, and event-based timing without inventing missing dates.", confidence: 95, items: scopedDeadlines, evidence: evidenceFor(contract, contract.deadlines.map((item) => item.evidenceId)), recommendation: "Supply the insurance expiry and shop-visit dates to resolve conditional deadlines." };
  }
  if (/which aircraft|aircraft.*depend|aircraft.*affect|linked aircraft/.test(normalized) && context.selectedContract) {
    const linkedAircraft = context.linkedAircraft || [];
    return { ...base, type: "aircraft", title: `${linkedAircraft.length} aircraft depend on this contract`, summary: `${contract.title} is connected to ${linkedAircraft.map((item) => item.registration).join(", ") || "no established aircraft"} in the prepared aviation relationship model.`, confidence: linkedAircraft.length ? 96 : 0, items: linkedAircraft.map((item) => ({ id: item.id, title: item.registration, category: `${item.type} · ${item.origin} → ${item.destination}`, severity: item.status })), evidence: [], recommendation: "Select an affected aircraft in Live Tracking to review its route, weather, and wider contract context." };
  }
  if (/contract.*connect|contracts.*affect|related contract/.test(normalized)) return { ...base, type: "answer", title: `${scopedContracts.length} connected contract${scopedContracts.length === 1 ? "" : "s"}`, summary: `${context.aircraft?.registration || "The selected asset"} is connected to ${scopedContracts.map((item) => item.title).join(", ") || "no established contracts"}.`, confidence: scopedContracts.length ? 96 : 0, items: scopedContracts.map((item) => ({ id: item.id, title: item.title, category: item.type, severity: item.status })), evidence: evidenceFor(contract, contract.evidence.slice(0, 2).map((item) => item.id)), recommendation: "Open the connected contract to inspect its clauses and source evidence." };
  if (/aircraft|fleet|maintenance/.test(normalized)) {
    const aircraft = context.aircraft || contract.aircraft;
    return { ...base, type: "aircraft", title: aircraft ? "Aircraft relationship established" : "No aircraft relationship established", summary: aircraft ? `${aircraft.registration} / ${aircraft.model} is linked to ${scopedContracts.length} prepared contract record${scopedContracts.length === 1 ? "" : "s"}.` : "The prepared contract has no aircraft association.", confidence: aircraft ? 92 : 0, items: aircraft ? [{ id: "aircraft", title: aircraft.registration, category: aircraft.model, severity: "Linked" }] : [], evidence: evidenceFor(contract, ["ev-maintenance"]), recommendation: aircraft ? "Review linked maintenance and redelivery obligations." : "Add a verified aircraft-contract relationship before drawing operational conclusions." };
  }
  if (/supplier|counterparty|dependency/.test(normalized)) {
    return { ...base, type: "supplier", title: `${scopedContracts.length} counterparty relationship${scopedContracts.length === 1 ? "" : "s"} identified`, summary: `These counterparties are connected to ${context.aircraft?.registration || contract.contractId} through prepared agreements. Broader supplier concentration is not established.`, confidence: 88, items: scopedContracts.map((item) => ({ id: item.id, title: item.counterparty, category: item.type, severity: "Contractual" })), evidence: [], recommendation: "Review each agreement before inferring portfolio-level supplier dependency." };
  }
  if (/summar|contract/.test(normalized)) {
    return { ...base, type: "answer", title: contract.title, summary: `${contract.contractId} is a prepared ${contract.type.toLowerCase()} between ${contract.lessor} and ${contract.lessee}. Operion identified ${contract.clauses.length} clauses, ${contract.obligations.length} obligations, ${contract.deadlines.length} deadlines, and ${contract.risks.length} risks.`, confidence: 98, items: contract.risks.slice(0, 2), evidence: evidenceFor(contract, ["ev-return", "ev-insurance"]), recommendation: "Open the contract workspace to inspect each finding and its source." };
  }
  return { ...base, type: "unsupported", title: "Insufficient evidence", summary: "Operion could not establish this answer from the available contract evidence.", confidence: 0, items: [], evidence: [], searched: "Prepared clauses, obligations, deadlines, risks, and evidence", found: "No finding with sufficient relevance", missing: "Verified source evidence or a supported operational data source" };
}
