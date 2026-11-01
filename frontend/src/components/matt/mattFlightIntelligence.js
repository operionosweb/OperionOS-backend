import { answerFlightQuestion } from "../../demo/globeIntelligenceData.js";

export function askMattFlight(question, flight) {
  const result = answerFlightQuestion(question, flight);
  if (!result || typeof result.answer !== "string" || !Array.isArray(result.findings) || !Array.isArray(result.evidence)) {
    throw new Error("The selected flight intelligence returned an invalid response.");
  }
  return {
    established: result.established === true,
    answer: result.answer,
    findings: result.findings,
    evidence: result.evidence.map((item) => ({
      id: item.id,
      excerpt: item.excerpt,
      source_locator: item.source_locator,
      page_number: item.page_number ?? null,
    })),
    ...(Array.isArray(result.limitations) ? { limitations: result.limitations } : {}),
    ...(Array.isArray(result.reviewRecommendations) ? { reviewRecommendations: result.reviewRecommendations } : {}),
    demonstration: true,
  };
}
