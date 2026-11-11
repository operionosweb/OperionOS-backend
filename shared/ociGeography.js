export const OCI_GEOGRAPHY_POLICY = Object.freeze({
  version: "2026-10-31.1",
  europeDefinition: "UN M49 region 150, at country/area level; not an assertion about a particular site.",
  countrySource: "https://www.iso.org/obp/ui/#search/code/",
  europeSource: "https://unstats.un.org/unsd/methodology/m49/",
  euSource: "https://european-union.europa.eu/principles-countries-history/eu-countries_en",
  eeaSource: "https://www.efta.int/eea",
});
export const OCI_DEFAULT_MARKET = "EUROPE";
export const OCI_GEOGRAPHIC_SCOPES = Object.freeze({
  EUROPE: "Geographical Europe",
  EU: "European Union",
  EEA: "European Economic Area",
  UK: "United Kingdom",
  OUTSIDE_EUROPE: "Outside Europe",
  UNRESOLVED: "Unresolved geography",
  GLOBAL: "Global scope",
});
export const OCI_AVIATION_SEGMENTS = Object.freeze([
  "Airline", "Aircraft lessor", "MRO", "Aviation consultancy",
  "Ground handling", "Airport operator", "Aviation supplier", "Other",
]);
export const OCI_COMPANY_TYPES = Object.freeze([
  "Airline", "Airport operator", "Aviation supplier", "Consultancy",
  "Ground handler", "Leasing company", "MRO organisation", "Other",
]);

export const OCI_COUNTRY_CODES = Object.freeze(
  ("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
   "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
   "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
   "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ " +
   "NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
   "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ " +
   "UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW").split(" "),
);
const countryCodes = new Set(OCI_COUNTRY_CODES);
const europeCodes = new Set("AD AL AT AX BA BE BG BY CH CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA".split(" "));
const euCodes = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split(" "));
const eeaCodes = new Set([...euCodes, "IS", "LI", "NO"]);
const boundaryCodes = new Set(["RU", "TR", "KZ", "AZ", "GE", "AM", "CY"]);
const names = new Intl.DisplayNames(["en"], { type: "region" });
const labelOverrides = Object.freeze({
  GB: "United Kingdom", US: "United States", CZ: "Czechia", TR: "T\u00fcrkiye",
  CG: "Republic of the Congo", CD: "Democratic Republic of the Congo",
  KR: "South Korea", KP: "North Korea", VA: "Holy See",
});

export class OciGeographyError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
    this.code = "OCI_INVALID_GEOGRAPHY";
  }
}
export function validateCountryCode(code) {
  if (typeof code !== "string" || !countryCodes.has(code))
    throw new OciGeographyError("Country must be an assigned uppercase ISO 3166-1 alpha-2 code; use GB, not UK.");
  return code;
}
export function countryLabel(code) {
  validateCountryCode(code);
  return labelOverrides[code] || names.of(code);
}
export function classifyCountry(code) {
  validateCountryCode(code);
  return {
    country_code: code, country_name: countryLabel(code),
    geographicalEurope: europeCodes.has(code),
    europeanUnion: euCodes.has(code),
    europeanEconomicArea: eeaCodes.has(code),
    unitedKingdom: code === "GB",
    boundaryReviewRequired: boundaryCodes.has(code),
    policyVersion: OCI_GEOGRAPHY_POLICY.version,
  };
}

const normaliseLegacy = value => value.trim().toLowerCase().replace(/\s+/g, " ");
const legacyCountries = new Map();
for (const code of OCI_COUNTRY_CODES) {
  legacyCountries.set(code.toLowerCase(), code);
  // "Georgia" may be a US state; bare "Congo" and "Korea" are also ambiguous.
  if (code !== "GE") legacyCountries.set(normaliseLegacy(countryLabel(code)), code);
}
for (const [alias, code] of Object.entries({
  UK: "GB", "U.K.": "GB", "Great Britain": "GB",
  "United Kingdom of Great Britain and Northern Ireland": "GB",
  USA: "US", "United States of America": "US", "Czech Republic": "CZ",
  Turkey: "TR", "Russian Federation": "RU", "Republic of Ireland": "IE",
  "Hong Kong": "HK",
})) legacyCountries.set(normaliseLegacy(alias), code);
export function mapLegacyCountry(value) {
  return typeof value === "string" ? legacyCountries.get(normaliseLegacy(value)) || null : null;
}
export function legacyCountryMap() {
  return Object.fromEntries(legacyCountries);
}

const locationKeys = ["administrative_region", "city", "airport_iata", "airport_icao", "geographic_source", "geographic_confidence"];
const geographicKeys = ["country_code", ...locationKeys, "market_region"];
const provenanceKeys = ["data_origin", "classification", "source", "researchDate", "confidence"];
const legacyKeys = { accounts: ["country", "location"], market: ["geography"] };
const relatedKinds = new Set(["contacts", "opportunities", "activities", "discovery", "pilots", "revenue"]);

export function preserveOciGeographicData(kind, incoming, current = {}, allowedFields = null) {
  const output = { ...incoming };
  const allowed = allowedFields ? new Set(allowedFields.map(field => typeof field === "string" ? field : field.key)) : null;
  for (const key of [...geographicKeys, ...provenanceKeys, ...(legacyKeys[kind] || [])]) {
    if (allowed && !allowed.has(key)) continue;
    if (!Object.hasOwn(incoming, key) && Object.hasOwn(current, key))
      output[key] = current[key];
  }
  return output;
}
const legacyFields = new Set(["country", "location", "geography"]);
export function isLegacyGeographicField(kind, key) {
  return legacyFields.has(key) && (legacyKeys[kind] || []).includes(key);
}

export function validateOciGeography(kind, data) {
  if (data.country_code !== undefined) validateCountryCode(data.country_code);
  if (data.airport_iata !== undefined && !/^[A-Z]{3}$/.test(data.airport_iata))
    throw new OciGeographyError("Airport IATA identifier must contain three uppercase letters.");
  if (data.airport_icao !== undefined && !/^[A-Z]{4}$/.test(data.airport_icao))
    throw new OciGeographyError("Airport ICAO identifier must contain four uppercase letters.");
  if (data.market_region !== undefined && !Object.hasOwn(OCI_GEOGRAPHIC_SCOPES, data.market_region))
    throw new OciGeographyError("Unknown research geographic scope.");
  const legacyCode = mapLegacyCountry(data.country);
  if (kind === "accounts" && data.country_code && legacyCode && legacyCode !== data.country_code)
    throw new OciGeographyError("Canonical country conflicts with the legacy account country. Review both explicitly.");
  if (kind === "accounts" && data.country_code && !data.country)
    throw new OciGeographyError("Keep an explicit legacy Country value for account identity compatibility.");
  if (kind === "market") {
    const legacyScope = typeof data.geography === "string" ? legacyResearchScopes.get(normaliseLegacy(data.geography)) : null;
    if (data.market_region && legacyScope && data.market_region !== legacyScope)
      throw new OciGeographyError("Legacy research coverage conflicts with the selected research scope.");
    const scope = data.market_region || legacyScope;
    if (data.country_code && scope && !countryMatchesScope(data.country_code, scope))
      throw new OciGeographyError("Research country is outside the selected research scope.");
  }
  return data;
}

export function countryMatchesScope(code, scope = OCI_DEFAULT_MARKET) {
  if (!Object.hasOwn(OCI_GEOGRAPHIC_SCOPES, scope)) throw new OciGeographyError("Unknown geographic scope.");
  if (code === null) return scope === "UNRESOLVED";
  const country = classifyCountry(code);
  switch (scope) {
    case "GLOBAL": return true;
    case "UNRESOLVED": return false;
    case "EUROPE": return country.geographicalEurope;
    case "EU": return country.europeanUnion;
    case "EEA": return country.europeanEconomicArea;
    case "UK": return country.unitedKingdom;
    case "OUTSIDE_EUROPE": return !country.geographicalEurope;
  }
}

const queryKeys = Object.freeze({
  geoCountries: "countries", geoRegions: "regions", geoCities: "cities",
  geoAirports: "airports", geoSegments: "segments", geoCompanyTypes: "companyTypes",
});
function queryValues(value, key, maximum) {
  if (value === undefined) return [];
  const values = (Array.isArray(value) ? value : [value]).flatMap(item =>
    typeof item === "string" ? item.split(",") : [item]);
  if (values.length > maximum || values.some(item => typeof item !== "string" || !item.trim() ||
      item.length > 100 || /[\u0000-\u001f\u007f]/.test(item)))
    throw new OciGeographyError(`Invalid ${key} geographic filter.`);
  const result = [...new Set(values.map(item => item.trim()))];
  if (result.length > maximum) throw new OciGeographyError(`Too many ${key} geographic filters.`);
  return result;
}
export function normalizeOciGeographicFilters(query = {}) {
  const scope = query.geoScope ?? OCI_DEFAULT_MARKET;
  if (typeof scope !== "string" || !Object.hasOwn(OCI_GEOGRAPHIC_SCOPES, scope))
    throw new OciGeographyError("Invalid geographic market scope.");
  const filters = { scope };
  for (const [queryKey, name] of Object.entries(queryKeys))
    filters[name] = queryValues(query[queryKey], name, name === "countries" ? 50 : 20);
  for (const code of filters.countries) {
    validateCountryCode(code);
    if (scope !== "GLOBAL" && !countryMatchesScope(code, scope))
      throw new OciGeographyError("Selected country does not belong to the selected geographic scope.");
  }
  for (const [name, allowed] of [["segments", OCI_AVIATION_SEGMENTS], ["companyTypes", OCI_COMPANY_TYPES]]) {
    if (filters[name].some(value => !allowed.includes(value)))
      throw new OciGeographyError(`Invalid aviation ${name === "segments" ? "segment" : "company type"}.`);
  }
  return filters;
}
export function appendOciGeographicParams(params, filters) {
  params.set("geoScope", filters.scope);
  for (const [key, name] of Object.entries(queryKeys))
    if (filters[name]?.length) params.set(key, filters[name].join(","));
  return params;
}

function countrySql(data, legacyKey, next) {
  const mapping = legacyCountryMap();
  const mappingParam = next(JSON.stringify(mapping));
  const codesParam = next(OCI_COUNTRY_CODES);
  const legacy = `NULLIF(lower(btrim((${data})->>'${legacyKey}')), '')`;
  const mappedLegacy = `(${mappingParam}::jsonb ->> ${legacy})`;
  const canonical = `(${data})->>'country_code'`;
  return `CASE WHEN (${data}) ? 'country_code' THEN CASE
    WHEN ${canonical}=ANY(${codesParam}::text[]) AND
      (${legacy} IS NULL OR ${mappedLegacy} IS NULL OR ${mappedLegacy}=${canonical}) THEN ${canonical}
    ELSE NULL END
    ELSE ${mappedLegacy} END`;
}
function marketScopeSql(data) {
  const explicit = `NULLIF(${data}->>'market_region','')`;
  return `CASE WHEN ${explicit} IS NOT NULL THEN CASE
      WHEN ${explicit} IN ('EUROPE','EU','EEA','UK','OUTSIDE_EUROPE','UNRESOLVED','GLOBAL') THEN ${explicit}
      ELSE 'UNRESOLVED' END
    ELSE CASE lower(btrim(${data}->>'geography'))
      WHEN 'europe' THEN 'EUROPE' WHEN 'eu' THEN 'EU' WHEN 'european union' THEN 'EU'
      WHEN 'eea' THEN 'EEA' WHEN 'european economic area' THEN 'EEA'
      WHEN 'uk' THEN 'UK' WHEN 'united kingdom' THEN 'UK'
      WHEN 'outside europe' THEN 'OUTSIDE_EUROPE'
      WHEN 'global' THEN 'GLOBAL' WHEN 'worldwide' THEN 'GLOBAL' END END`;
}
export function compileOciGeographicQuery(kind, filters, startIndex = 1) {
  const params = [];
  const next = value => { params.push(value); return `$${startIndex + params.length - 1}`; };
  const linked = kind === "dashboard" ||
    new Set(["contacts", "opportunities", "activities", "discovery", "pilots", "revenue"]).has(kind);
  const recordData = "r.data";
  const accountData = kind === "dashboard" ? "CASE WHEN r.kind='accounts' THEN r.data ELSE a.data END"
    : linked ? "a.data" : recordData;
  const marketRawCountry = ["market", "dashboard"].includes(kind)
    ? countrySql(recordData, "geography", next) : null;
  const accountCountry = kind === "market" ? null : countrySql(accountData, "country", next);
  let marketCountry = marketRawCountry;
  let resolvedMarketScope = "NULL::text";
  if (marketRawCountry) {
    const rawScope = marketScopeSql(recordData);
    const europe = next(OCI_COUNTRY_CODES.filter(code => countryMatchesScope(code, "EUROPE")));
    const eu = next(OCI_COUNTRY_CODES.filter(code => countryMatchesScope(code, "EU")));
    const eea = next(OCI_COUNTRY_CODES.filter(code => countryMatchesScope(code, "EEA")));
    const mismatch = `(${rawScope}='UNRESOLVED' OR (r.data ? 'country_code' AND ${marketRawCountry} IS NULL)
      OR (${marketRawCountry} IS NOT NULL AND (
        (${rawScope}='EUROPE' AND NOT (${marketRawCountry}=ANY(${europe}::text[]))) OR
        (${rawScope}='EU' AND NOT (${marketRawCountry}=ANY(${eu}::text[]))) OR
        (${rawScope}='EEA' AND NOT (${marketRawCountry}=ANY(${eea}::text[]))) OR
        (${rawScope}='UK' AND ${marketRawCountry}<>'GB') OR
        (${rawScope}='OUTSIDE_EUROPE' AND ${marketRawCountry}=ANY(${europe}::text[]))
      )))`;
    resolvedMarketScope = `CASE WHEN ${mismatch} THEN 'UNRESOLVED'
      WHEN ${rawScope} IS NOT NULL THEN ${rawScope}
      WHEN ${marketRawCountry} IS NULL THEN 'UNRESOLVED' END`;
    marketCountry = `CASE WHEN (${resolvedMarketScope})='UNRESOLVED' THEN NULL ELSE ${marketRawCountry} END`;
  }
  const countryExpression = kind === "dashboard"
    ? `CASE WHEN r.kind='market' THEN ${marketCountry} ELSE ${accountCountry} END`
    : kind === "market" ? marketCountry : accountCountry;
  const marketScopeExpression = kind === "market" ? resolvedMarketScope
    : kind === "dashboard" ? `CASE WHEN r.kind='market' THEN ${resolvedMarketScope} END` : "NULL::text";
  const segmentExpression = kind === "market" || kind === "accounts" ? "r.data->>'segment'"
    : kind === "dashboard" ? "CASE WHEN r.kind IN ('accounts','market') THEN r.data->>'segment' ELSE a.data->>'segment' END"
    : linked ? "a.data->>'segment'" : "NULL::text";
  const companyTypeExpression = kind === "dashboard" ? "CASE WHEN r.kind='accounts' THEN r.data->>'company_type' WHEN r.kind='market' THEN NULL::text ELSE a.data->>'company_type' END"
    : kind === "accounts" ? "r.data->>'company_type'"
    : linked ? "a.data->>'company_type'" : "NULL::text";
  const locationData = kind === "market" ? recordData
    : kind === "dashboard" ? "CASE WHEN r.kind IN ('accounts','market') THEN r.data ELSE a.data END"
    : accountData;
  const projection = `SELECT r.*,
    ${countryExpression} AS geo_country,
    ${marketScopeExpression} AS geo_market_scope,
    (${locationData})->>'administrative_region' AS geo_region,
    (${locationData})->>'city' AS geo_city,
    ARRAY_REMOVE(ARRAY[NULLIF((${locationData})->>'airport_iata',''), NULLIF((${locationData})->>'airport_icao','')], NULL) AS geo_airports,
    ${segmentExpression} AS geo_segment,
    ${companyTypeExpression} AS geo_company_type,
    ${kind === "dashboard" ? "CASE WHEN r.kind='accounts' THEN r.data->>'priority' ELSE a.data->>'priority' END" : kind === "accounts" ? "r.data->>'priority'" : "NULL::text"} AS geo_account_priority
    FROM public.oci_records r${linked ? "\n    LEFT JOIN public.oci_records a ON a.id=r.account_id AND a.kind='accounts'" : ""}`;
  const clauses = [];
  if (filters.scope !== "GLOBAL") {
    if (filters.scope === "UNRESOLVED") {
      clauses.push("geo_country IS NULL AND (geo_market_scope IS NULL OR geo_market_scope='UNRESOLVED')");
    } else {
      const countrySet = OCI_COUNTRY_CODES.filter(code => countryMatchesScope(code, filters.scope));
      const countryParam = next(countrySet);
      clauses.push(`(geo_country=ANY(${countryParam}::text[]) OR geo_market_scope=${next(filters.scope)})`);
    }
  }
  for (const [name, column] of [["countries", "geo_country"], ["regions", "geo_region"], ["cities", "geo_city"],
    ["segments", "geo_segment"], ["companyTypes", "geo_company_type"]]) {
    if (filters[name]?.length) clauses.push(`${column}=ANY(${next(filters[name])}::text[])`);
  }
  if (filters.airports?.length) clauses.push(`geo_airports && ${next(filters.airports)}::text[]`);
  return {
    projection, joins: "",
    where: clauses.length ? clauses.join(" AND ") : "TRUE",
    params, countryExpression, marketScopeExpression,
  };
}

function resolveCountry(data, legacyValue) {
  const legacyCode = mapLegacyCountry(legacyValue);
  if (data.country_code !== undefined && !countryCodes.has(data.country_code))
    return { country: null, resolution: "unresolved", reason: "invalid_canonical_country" };
  if (data.country_code && legacyCode && legacyCode !== data.country_code)
    return { country: null, resolution: "unresolved", reason: "conflicting_country" };
  const code = data.country_code || legacyCode;
  return code
    ? { country: classifyCountry(code), resolution: data.country_code ? "canonical" : "legacy", reason: null }
    : { country: null, resolution: "unresolved", reason: "missing_or_ambiguous_country" };
}
function locationData(data) {
  return Object.fromEntries(locationKeys.filter(key => Object.hasOwn(data, key)).map(key => [key, data[key]]));
}
const legacyResearchScopes = new Map([
  ["europe", "EUROPE"], ["european union", "EU"], ["eu", "EU"],
  ["european economic area", "EEA"], ["eea", "EEA"], ["outside europe", "OUTSIDE_EUROPE"],
  ["global", "GLOBAL"], ["worldwide", "GLOBAL"],
]);

export function resolveOciRecordGeography(record, account = null) {
  if (!record || typeof record !== "object") throw new OciGeographyError("An OCI record is required.");
  const data = record.data || {};
  if (record.kind === "accounts") {
    return { kind: "account_location", ...resolveCountry(data, data.country), location: locationData(data),
      legacy: { country: data.country, location: data.location } };
  }
  if (record.kind === "market") {
    const resolved = resolveCountry(data, data.geography);
    const rawScope = data.market_region || (typeof data.geography === "string" ? legacyResearchScopes.get(normaliseLegacy(data.geography)) : null);
    const scope = rawScope || (resolved.country ? null : "UNRESOLVED");
    if (scope && !Object.hasOwn(OCI_GEOGRAPHIC_SCOPES, scope))
      return { kind: "research_coverage", country: null, scope: "UNRESOLVED", resolution: "unresolved", reason: "invalid_research_scope", legacy: { geography: data.geography } };
    if (resolved.reason === "invalid_canonical_country" || resolved.reason === "conflicting_country" ||
      (scope && resolved.country && !countryMatchesScope(resolved.country.country_code, scope)))
      return { kind: "research_coverage", country: null, scope: "UNRESOLVED", resolution: "unresolved", reason: resolved.reason || "conflicting_research_scope", legacy: { geography: data.geography } };
    return { kind: "research_coverage", ...resolved, scope,
      resolution: scope === "GLOBAL" && !resolved.country ? "global_coverage"
        : scope && scope !== "UNRESOLVED" && !resolved.country ? "regional_coverage" : resolved.resolution,
      reason: scope && scope !== "UNRESOLVED" && !resolved.country ? null : resolved.reason,
      location: locationData(data), legacy: { geography: data.geography } };
  }
  if (!relatedKinds.has(record.kind)) throw new OciGeographyError("Unknown OCI geographic record kind.");
  if (!record.account_id || !account || account.kind !== "accounts" || account.id !== record.account_id)
    return { kind: "account_inherited", accountId: record.account_id || null, country: null, resolution: "unresolved", reason: "account_unavailable" };
  return { ...resolveOciRecordGeography(account), kind: "account_inherited", accountId: account.id };
}

export function serializeOciRecordForm(module, form, current = {}) {
  const data = {};
  const legacy = new Set(legacyKeys[module.id] || []);
  for (const field of module.fields) {
    if (!form.has(field.key)) continue;
    const raw = form.get(field.key);
    data[field.key] = raw === "" || raw === null ? "" : field.type === "number" ? Number(raw)
      : legacy.has(field.key) ? String(raw) : String(raw).trim();
  }
  return preserveOciGeographicData(module.id, data, current, module.fields);
}
