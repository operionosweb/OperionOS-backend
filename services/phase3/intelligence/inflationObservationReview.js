import { INFLATION_SERIES, isIsoDate } from "../../../shared/aviationIndexation.js";

export function prepareReviewedInflationObservation(input, retrievedAt = new Date().toISOString()) {
  const series = INFLATION_SERIES[input?.seriesId];
  const month = input?.period;
  const publication = input?.publicationTimestamp;
  if (!series || input?.reviewConfirmed !== true
    || !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ""))
    || !isIsoDate(`${month}-01`)
    || !Number.isFinite(input?.value) || input.value <= 0 || input.value > 1e6
    || typeof publication !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(publication)
    || !Number.isFinite(Date.parse(publication))
    || !isIsoDate(publication.slice(0, 10))
    || publication.slice(0, 7) <= month
    || Date.parse(publication) > Date.parse(retrievedAt)
    || input.sourceReference !== series.sourceReference
    || input.unit !== series.unit
    || input.geography !== series.geography) {
    throw new TypeError("An exact supported series, positive index level, completed month, publication timestamp, official reference, units, geography and explicit human source verification are required");
  }
  return {
    indicator_id: series.indicatorId, category: "inflation", value: input.value,
    unit: series.unit, currency: series.currency, base_currency: null, quote_currency: null,
    market_applicability: series.geography,
    observation_date: `${month}-01`, publication_timestamp: publication,
    retrieval_timestamp: retrievedAt, source_id: series.sourceId,
    source_reference: series.sourceReference, data_quality_status: "verified",
    record_type: "published_observation", is_historical: true,
  };
}
