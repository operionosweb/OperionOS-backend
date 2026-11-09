const ECB_SERIES = Object.freeze({
  USD: "US dollar",
  GBP: "Pound sterling",
  CHF: "Swiss franc",
  JPY: "Japanese yen",
  CAD: "Canadian dollar",
  AUD: "Australian dollar",
  CNY: "Chinese yuan renminbi",
  DKK: "Danish krone",
  HKD: "Hong Kong dollar",
  NOK: "Norwegian krone",
  NZD: "New Zealand dollar",
  SEK: "Swedish krona",
  SGD: "Singapore dollar",
});
const ECB_BASE_URL = "https://data-api.ecb.europa.eu/service/data/EXR";
const NYFED_URL = "https://markets.newyorkfed.org/api/rates/secured/sofr/last/90.json";
const EIA_SERIES_ID = "EER_EPJK_PF4_RGC_DPG";
const EIA_SERIES_URL = `https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=pet&s=${EIA_SERIES_ID.toLowerCase()}&f=w`;
const ECB_REFERENCE = "https://data.ecb.europa.eu/data/datasets/EXR";
const NYFED_REFERENCE = "https://markets.newyorkfed.org/static/docs/markets-api.html";

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseCsvRow(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function parseEcbCsv(text, currency, retrievedAt) {
  const [headerLine, ...lines] = String(text || "").trim().split(/\r?\n/);
  if (!headerLine || lines.length === 0) return [];
  const headers = parseCsvRow(headerLine);
  const index = Object.fromEntries(headers.map((header, position) => [header, position]));
  for (const required of ["TIME_PERIOD", "OBS_VALUE", "OBS_STATUS", "CURRENCY", "CURRENCY_DENOM"]) {
    if (index[required] === undefined) throw new Error(`ECB response is missing ${required}`);
  }
  const rows = lines.map(parseCsvRow).filter((row) => row.length === headers.length);
  const asOf = retrievedAt.slice(0, 10);
  const observationsByDate = new Map();
  for (const row of rows) {
    const observationDate = row[index.TIME_PERIOD];
    const value = Number(row[index.OBS_VALUE]);
    if (
      row[index.CURRENCY] !== currency
      || row[index.CURRENCY_DENOM] !== "EUR"
      || row[index.OBS_STATUS] !== "A"
      || !validDate(observationDate)
      || observationDate > asOf
      || !Number.isFinite(value)
      || value <= 0
    ) continue;
    const series = `D.${currency}.EUR.SP00.A`;
    const sourceReference = `${ECB_BASE_URL}/${series}`;
    const observation = {
      indicator_id: `fx.eur.${currency.toLowerCase()}`,
      category: "fx",
      value,
      unit: `${currency} per EUR`,
      currency,
      base_currency: "EUR",
      quote_currency: currency,
      market_applicability: "ECB euro reference rate; informational only, not intended for market transactions or as a contractual benchmark",
      observation_date: observationDate,
      publication_timestamp: null,
      retrieval_timestamp: retrievedAt,
      source_id: "ecb",
      source_reference: sourceReference,
      data_quality_status: "verified",
      record_type: "published_observation",
      is_historical: false,
      update_status: "recorded",
    };
    const existing = observationsByDate.get(observationDate);
    if (existing && existing.value !== value) {
      throw new Error(`ECB returned conflicting observations for ${currency} on ${observationDate}`);
    }
    if (!existing) observationsByDate.set(observationDate, observation);
  }
  const observations = [...observationsByDate.values()].sort((left, right) => left.observation_date.localeCompare(right.observation_date));
  const latestDate = observations.at(-1)?.observation_date;
  return observations.map((observation) => ({
    ...observation,
    is_historical: observation.observation_date !== latestDate,
  }));
}

function normalizeEiaDate(value) {
  const date = /^\d{8}$/.test(String(value || ""))
    ? String(value).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3")
    : String(value || "");
  return validDate(date) ? date : null;
}

function parseEiaSeries(payload, retrievedAt) {
  const series = payload?.series?.find((item) => item?.series_id === EIA_SERIES_ID);
  if (!series || !Array.isArray(series.data) || !/dollars?\s+per\s+gallon/i.test(String(series.units || ""))) {
    throw new Error("EIA response does not contain the approved jet-fuel series and units");
  }
  const asOf = retrievedAt.slice(0, 10);
  const observationsByDate = new Map();
  for (const entry of series.data) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const observationDate = normalizeEiaDate(entry[0]);
    const value = Number(entry[1]);
    if (!observationDate || observationDate > asOf || !Number.isFinite(value) || value <= 0) continue;
    const observation = {
      indicator_id: "fuel.jet.us.gulf_coast",
      category: "fuel",
      value,
      unit: "USD per gallon",
      currency: "USD",
      base_currency: null,
      quote_currency: null,
      market_applicability: "U.S. Gulf Coast kerosene-type jet fuel spot price FOB",
      observation_date: observationDate,
      publication_timestamp: null,
      retrieval_timestamp: retrievedAt,
      source_id: "eia",
      source_reference: EIA_SERIES_URL,
      data_quality_status: "verified",
      record_type: "published_observation",
      is_historical: false,
      update_status: "recorded",
    };
    const existing = observationsByDate.get(observationDate);
    if (existing && existing.value !== value) {
      throw new Error(`EIA returned conflicting jet-fuel observations on ${observationDate}`);
    }
    if (!existing) observationsByDate.set(observationDate, observation);
  }
  const rows = [...observationsByDate.values()];
  if (!rows.length) throw new Error("EIA returned no verified observations");
  const latestDate = rows.map((row) => row.observation_date).sort().at(-1);
  return rows.map((row) => ({ ...row, is_historical: row.observation_date !== latestDate }));
}

async function fetchText(fetchImpl, url) {
  const response = await fetchImpl(url, {
    headers: { accept: "text/csv,application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`External source returned HTTP ${response.status}`);
  return response.text();
}

function safeFailureReason(error) {
  const status = String(error?.message || "").match(/\bHTTP\s+(\d{3})\b/i)?.[1];
  return status
    ? `Source returned HTTP ${status}.`
    : "Source retrieval or validation failed.";
}

export function createExternalAviationSignalService({
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  ecbCurrencies = Object.keys(ECB_SERIES),
  eiaApiKey = process.env.EIA_API_KEY,
  eiaTermsAccepted = process.env.EIA_TERMS_ACCEPTED === "true",
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required");

  return {
    async collectPublicObservations() {
      const retrievedAt = now().toISOString();
      const jobs = ecbCurrencies.map((currency) => ({
        category: "fx",
        run: async () => {
          if (!ECB_SERIES[currency]) throw new TypeError(`Unsupported ECB currency ${currency}`);
          const series = `D.${currency}.EUR.SP00.A`;
          const url = `${ECB_BASE_URL}/${series}?lastNObservations=90&format=csvdata`;
          const rows = parseEcbCsv(await fetchText(fetchImpl, url), currency, retrievedAt);
          if (!rows.length) throw new Error(`ECB returned no verified observations for ${currency}`);
          return rows;
        },
      }));
      jobs.push({
        category: "interest",
        run: async () => {
          const response = await fetchImpl(NYFED_URL, {
            headers: { accept: "application/json" },
            signal: AbortSignal.timeout(10000),
          });
          if (!response.ok) throw new Error(`External source returned HTTP ${response.status}`);
          const payload = await response.json();
          if (!Array.isArray(payload?.refRates)) throw new Error("NY Fed response has no reference-rate observations");
          const observationsByDate = new Map();
          for (const item of payload.refRates) {
            const value = Number(item?.percentRate);
            if (
              item?.type !== "SOFR"
              || !validDate(item.effectiveDate)
              || item.effectiveDate > retrievedAt.slice(0, 10)
              || !Number.isFinite(value)
              || value <= 0
            ) continue;
            const observation = {
              indicator_id: "interest.us.sofr",
              category: "interest",
              value,
              unit: "percent per annum",
              currency: "USD",
              base_currency: null,
              quote_currency: null,
              market_applicability: "United States secured overnight financing rate",
              observation_date: item.effectiveDate,
              publication_timestamp: null,
              retrieval_timestamp: retrievedAt,
              source_id: "nyfed",
              source_reference: NYFED_REFERENCE,
              data_quality_status: "verified",
              record_type: "published_observation",
              is_historical: false,
              update_status: "recorded",
            };
            const existing = observationsByDate.get(item.effectiveDate);
            if (existing && existing.value !== value) {
              throw new Error(`New York Fed returned conflicting SOFR observations on ${item.effectiveDate}`);
            }
            if (!existing) observationsByDate.set(item.effectiveDate, observation);
          }
          const rows = [...observationsByDate.values()];
          if (!rows.length) throw new Error("NY Fed returned no verified SOFR observations");
          const latestDate = rows.map((row) => row.observation_date).sort().at(-1);
          return rows.map((row) => ({ ...row, is_historical: row.observation_date !== latestDate }));
        },
      });
      if (eiaApiKey && eiaTermsAccepted) {
        jobs.push({
          category: "fuel",
          run: async () => {
            const url = new URL("https://api.eia.gov/series/");
            url.searchParams.set("api_key", eiaApiKey);
            url.searchParams.set("series_id", EIA_SERIES_ID);
            const response = await fetchImpl(url, {
              headers: { accept: "application/json" },
              signal: AbortSignal.timeout(10000),
            });
            if (!response.ok) throw new Error(`External source returned HTTP ${response.status}`);
            return parseEiaSeries(await response.json(), retrievedAt);
          },
        });
      }
      const sourceResults = await Promise.allSettled(jobs.map((job) => job.run()));

      const observations = [];
      const sources = {
        fuel: {
          status: "unavailable",
          sourceId: "eia",
          reason: eiaApiKey
            ? eiaTermsAccepted
              ? "The configured EIA retrieval did not return a verified observation."
              : "EIA API terms acceptance is not confirmed; no fuel-price request was made."
            : "No authorized EIA API key is configured; no fuel-price request was made.",
        },
        fx: { status: "unavailable", sourceId: "ecb", reason: "ECB retrieval failed." },
        interest: { status: "unavailable", sourceId: "nyfed", reason: "New York Fed retrieval failed." },
      };
      sourceResults.forEach((result, index) => {
        const category = jobs[index].category;
        const source = sources[category];
        if (result.status === "fulfilled") {
          observations.push(...result.value);
          source.status = "available";
          source.reason = null;
        } else {
          source.failures = [...(source.failures || []), safeFailureReason(result.reason)];
          if (category === "fuel") source.status = "unavailable";
        }
      });
      if (sources.fx.failures?.length) sources.fx.status = observations.some((item) => item.category === "fx") ? "partial" : "unavailable";
      if (sources.interest.failures?.length) sources.interest.status = "unavailable";
      if (sources.fuel.status === "available") sources.fuel.reason = null;
      return {
        observations,
        sources,
        retrievedAt,
        disclaimer: "External market observations are informational. They are not forecasts, transaction prices, or proof of a contractual loss.",
      };
    },
  };
}

export const EXTERNAL_SIGNAL_SOURCES = Object.freeze({
  ecb: {
    name: "European Central Bank",
    reference: ECB_REFERENCE,
    reusePolicy: "https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html",
    attribution: "Source: ECB statistics.",
    limitation: "Public ESCB statistics may be reused free of charge with source attribution and without modifying the statistics. ECB reference rates are informational and not intended for market transactions or as contractual benchmarks.",
  },
  eia: {
    name: "U.S. Energy Information Administration",
    reference: EIA_SERIES_URL,
    terms: "https://www.eia.gov/opendata/terms-of-service.php",
    attribution: "Source: U.S. Energy Information Administration (EIA).",
    limitation: "The API key is required and must be provisioned through approved secret storage. Cite the EIA; do not imply endorsement or use the EIA logo without permission.",
  },
  nyfed: {
    name: "Federal Reserve Bank of New York",
    reference: NYFED_REFERENCE,
    terms: "https://www.newyorkfed.org/markets/reference-rates-terms-of-use",
    attribution: "Source: Federal Reserve Bank of New York (New York Fed).",
    limitation: "NY Fed reference-rate terms require attribution and a source disclaimer when data is distributed.",
    disclaimer: "SOFR data is subject to the Terms of Use posted at newyorkfed.org. The New York Fed is not responsible for publication of SOFR data by Operion, does not sanction or endorse any particular republication, and has no liability for your use.",
  },
});
