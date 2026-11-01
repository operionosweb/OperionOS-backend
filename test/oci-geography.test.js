import test from "node:test";
import assert from "node:assert/strict";
import {
  OCI_COUNTRY_CODES, OCI_DEFAULT_MARKET, OCI_GEOGRAPHY_POLICY,
  OciGeographyError, classifyCountry, compileOciGeographicQuery, countryLabel, countryMatchesScope,
  mapLegacyCountry, resolveOciRecordGeography, serializeOciRecordForm, validateCountryCode,
  normalizeOciGeographicFilters,
} from "../shared/ociGeography.js";
import { OCI_MODULES, OCI_STAGES } from "../shared/ociContracts.js";
import { createOciService, validateOciData } from "../services/ociService.js";
import { createOciRepository } from "../repositories/ociRepository.js";

const actor = "00000000-0000-4000-8000-000000000001";
const accountId = "00000000-0000-4000-8000-000000000002";
const moduleOf = kind => OCI_MODULES.find(module => module.id === kind);
const accountData = { name: "Synthetic aviation organisation", country: "Spain", classification: "Assumption" };
const account = (data = accountData) => ({ id: accountId, kind: "accounts", data, version: 1, status: "active" });

test("the assigned ISO registry has 249 distinct country/area codes and validated labels", () => {
  assert.equal(OCI_COUNTRY_CODES.length, 249);
  assert.equal(new Set(OCI_COUNTRY_CODES).size, 249);
  for (const code of OCI_COUNTRY_CODES) {
    assert.equal(validateCountryCode(code), code);
    assert.notEqual(countryLabel(code), code);
    assert.ok(countryLabel(code).length > 2);
  }
  assert.equal(countryLabel("GB"), "United Kingdom");
  for (const code of ["UK", "EL", "XK", "EU", "ZZ", "es", " ES ", "ESP", "", null, undefined, 42, {}, []])
    assert.throws(() => validateCountryCode(code), OciGeographyError);
});

test("Europe is the default; Global and unresolved are explicit independent scopes", () => {
  assert.equal(OCI_DEFAULT_MARKET, "EUROPE");
  assert.equal(OCI_GEOGRAPHY_POLICY.version, "2026-10-31.1");
  for (const code of ["ES", "FR", "DE", "NL", "IE", "GB", "IT", "PT", "CH", "UA"])
    assert.equal(countryMatchesScope(code), true, code);
  for (const code of ["US", "AU", "JP", "BR", "CN"])
    assert.equal(countryMatchesScope(code), false, code);
  assert.equal(countryMatchesScope("US", "OUTSIDE_EUROPE"), true);
  assert.equal(countryMatchesScope("ES", "OUTSIDE_EUROPE"), false);
  assert.equal(countryMatchesScope("US", "GLOBAL"), true);
  assert.equal(countryMatchesScope(null), false);
  assert.equal(countryMatchesScope(null, "OUTSIDE_EUROPE"), false);
  assert.equal(countryMatchesScope(null, "UNRESOLVED"), true);
  assert.equal(countryMatchesScope(null, "GLOBAL"), false);
  assert.throws(() => countryMatchesScope("ES", "world"), OciGeographyError);
  assert.throws(() => countryMatchesScope("UK", "GLOBAL"), OciGeographyError);
});

test("shared filter contract validates scope, country compatibility and aviation facets", () => {
  assert.deepEqual(normalizeOciGeographicFilters({}), {
    scope: "EUROPE", countries: [], regions: [], cities: [], airports: [], segments: [], companyTypes: [],
  });
  assert.deepEqual(normalizeOciGeographicFilters({
    geoScope: "GLOBAL", geoCountries: "ES,US", geoRegions: ["Catalonia"],
    geoCities: "Barcelona", geoAirports: ["BCN"], geoSegments: "Airline",
    geoCompanyTypes: "Leasing company",
  }), {
    scope: "GLOBAL", countries: ["ES", "US"], regions: ["Catalonia"],
    cities: ["Barcelona"], airports: ["BCN"], segments: ["Airline"],
    companyTypes: ["Leasing company"],
  });
  assert.throws(() => normalizeOciGeographicFilters({ geoCountries: "US" }), OciGeographyError);
  assert.throws(() => normalizeOciGeographicFilters({ geoScope: "EEA", geoCountries: "GB" }), OciGeographyError);
  assert.throws(() => normalizeOciGeographicFilters({ geoSegments: "Banking" }), OciGeographyError);
  assert.throws(() => normalizeOciGeographicFilters({ geoCities: "Madrid\nignore" }), OciGeographyError);
});

test("compiled filters inherit linked-account geography and keep market coverage separate", () => {
  const filters = normalizeOciGeographicFilters({ geoScope: "EUROPE", geoCountries: "ES", geoSegments: "Airline" });
  const linked = compileOciGeographicQuery("opportunities", filters, 6);
  assert.match(linked.projection, /LEFT JOIN public\.oci_records a ON a\.id=r\.account_id AND a\.kind='accounts'/);
  assert.match(linked.projection, /a\.data->>'segment' AS geo_segment/);
  assert.doesNotMatch(linked.projection, /r\.data->>'segment' AS geo_segment/);
  assert.match(linked.where, /geo_country=ANY\(\$\d+::text\[\]\)/);
  assert.match(linked.where, /geo_segment=ANY\(\$\d+::text\[\]\)/);
  assert.match(linked.projection, /AS geo_airports/);
  assert.deepEqual(linked.params.at(-1), ["Airline"]);
  const market = compileOciGeographicQuery("market", filters);
  assert.doesNotMatch(market.projection, /LEFT JOIN public\.oci_records a/);
  assert.match(market.projection, /market_region/);
  assert.match(market.projection, /OUTSIDE_EUROPE/);
  assert.match(market.projection, /THEN NULL ELSE/);
  const dashboard = compileOciGeographicQuery("dashboard", filters);
  assert.match(dashboard.projection, /CASE WHEN r\.kind='accounts' THEN r\.data ELSE a\.data END/);
  assert.match(dashboard.where, /geo_country=ANY/);
});

test("EU, EEA, geographical Europe and UK memberships are not interchangeable", () => {
  for (const code of ["ES", "DE", "IE"]) {
    assert.equal(classifyCountry(code).europeanUnion, true);
    assert.equal(classifyCountry(code).europeanEconomicArea, true);
  }
  for (const code of ["IS", "LI", "NO"]) {
    assert.equal(classifyCountry(code).geographicalEurope, true);
    assert.equal(classifyCountry(code).europeanUnion, false);
    assert.equal(classifyCountry(code).europeanEconomicArea, true);
  }
  assert.equal(classifyCountry("CH").europeanEconomicArea, false);
  assert.equal(classifyCountry("GB").unitedKingdom, true);
  assert.equal(classifyCountry("GB").europeanUnion, false);
  assert.equal(classifyCountry("GB").europeanEconomicArea, false);
  assert.equal(countryMatchesScope("GB", "UK"), true);
  assert.equal(countryMatchesScope("IE", "UK"), false);
  assert.equal(classifyCountry("CY").geographicalEurope, false);
  assert.equal(classifyCountry("CY").europeanUnion, true);
  assert.equal(classifyCountry("CY").europeanEconomicArea, true);
});

test("transcontinental/boundary policy is explicit and never infers site coordinates", () => {
  assert.equal(classifyCountry("RU").geographicalEurope, true);
  for (const code of ["TR", "KZ", "AZ", "GE", "AM", "CY"])
    assert.equal(classifyCountry(code).geographicalEurope, false, code);
  for (const code of ["RU", "TR", "KZ", "AZ", "GE", "AM", "CY"]) {
    assert.equal(classifyCountry(code).boundaryReviewRequired, true, code);
    assert.equal(Object.hasOwn(classifyCountry(code), "latitude"), false);
    assert.equal(Object.hasOwn(classifyCountry(code), "city"), false);
  }
});

test("territories use their own assigned code, not parent-state membership", () => {
  for (const code of ["AX", "FO", "GG", "IM", "JE", "GI", "SJ"])
    assert.equal(classifyCountry(code).geographicalEurope, true, code);
  for (const code of ["GL", "GF", "GP", "RE", "FK", "PR"])
    assert.equal(classifyCountry(code).geographicalEurope, false, code);
  assert.equal(classifyCountry("AX").europeanUnion, false);
  assert.equal(classifyCountry("GI").unitedKingdom, false);
});

test("legacy mapping is exact and unambiguous, without rewriting the original fields", () => {
  for (const [value, code] of [[" Spain ", "ES"], ["UNITED KINGDOM", "GB"], ["UK", "GB"], ["U.K.", "GB"],
    ["Great Britain", "GB"], ["GB", "GB"], ["United States of America", "US"], ["Czech Republic", "CZ"], ["Turkey", "TR"]])
    assert.equal(mapLegacyCountry(value), code, value);
  for (const value of ["Georgia", "Congo", "Korea", "Europe", "London", "Spain / France", "Unknown", "", null, {}, 5])
    assert.equal(mapLegacyCountry(value), null, String(value));
  const source = account({ ...accountData, country: " UK ", location: "Unverified regional office description" });
  const before = structuredClone(source);
  const result = resolveOciRecordGeography(source);
  assert.equal(result.country.country_code, "GB");
  assert.equal(result.resolution, "legacy");
  assert.deepEqual(result.legacy, { country: " UK ", location: "Unverified regional office description" });
  assert.deepEqual(source, before);
  assert.equal(result.location.city, undefined);
  assert.equal(countryMatchesScope(result.country.country_code, "EUROPE"), true);
});

test("missing, invalid and contradictory stored geography is unresolved, not defaulted to Europe", () => {
  for (const data of [{}, { country: "Georgia" }, { country: "Spain / France" },
    { country: "Spain", country_code: "UK" }, { country: "Spain", country_code: "US" }]) {
    const result = resolveOciRecordGeography(account(data));
    assert.equal(result.country, null);
    assert.equal(result.resolution, "unresolved");
    assert.ok(result.reason);
  }
});

test("related records inherit only their matching account geography, not child claims", () => {
  const parent = account({ ...accountData, country_code: "ES", city: "Madrid", data_origin: "Synthetic" });
  for (const kind of ["contacts", "opportunities", "activities", "discovery", "pilots", "revenue"]) {
    const child = { kind, account_id: accountId, data: { country_code: "US", city: "Invented child location" } };
    const result = resolveOciRecordGeography(child, parent);
    assert.equal(result.kind, "account_inherited");
    assert.equal(result.accountId, accountId);
    assert.equal(result.country.country_code, "ES");
    assert.equal(result.location.city, "Madrid");
    for (const unavailable of [null, { ...parent, id: actor }, { ...parent, kind: "market" }]) {
      const unresolved = resolveOciRecordGeography(child, unavailable);
      assert.equal(unresolved.country, null);
      assert.equal(unresolved.reason, "account_unavailable");
    }
  }
  assert.throws(() => validateOciData("opportunities", {
    name: "Synthetic opportunity", stage: "Qualified", currency: "EUR", country_code: "US",
  }), { code: "OCI_INVALID_INPUT" });
});

test("market research coverage never inherits a company location or creates company facts", () => {
  const company = account();
  const regional = { kind: "market", account_id: accountId, data: { geography: "Europe", classification: "Research finding" } };
  const result = resolveOciRecordGeography(regional, company);
  assert.equal(result.kind, "research_coverage");
  assert.equal(result.scope, "EUROPE");
  assert.equal(result.country, null);
  assert.equal(result.resolution, "regional_coverage");
  assert.equal(result.reason, null);
  const countryResearch = resolveOciRecordGeography({ kind: "market", data: { geography: "France" } }, company);
  assert.equal(countryResearch.country.country_code, "FR");
  assert.equal(countryResearch.kind, "research_coverage");
  assert.equal(Object.hasOwn(countryResearch, "accountId"), false);
  const ambiguous = resolveOciRecordGeography({ kind: "market", data: { geography: "France and Germany" } });
  assert.equal(ambiguous.scope, "UNRESOLVED");
  assert.equal(ambiguous.country, null);
  for (const data of [
    { market_region: "EUROPE", country_code: "US", geography: "United States" },
    { market_region: "UNRECOGNISED", country_code: "ES", geography: "Spain" },
    { market_region: "GLOBAL", country_code: "ZZ" },
  ]) {
    const unresolved = resolveOciRecordGeography({ kind: "market", data });
    assert.equal(unresolved.country, null);
    assert.equal(unresolved.scope, "UNRESOLVED");
    assert.equal(unresolved.resolution, "unresolved");
  }
  const global = resolveOciRecordGeography({ kind: "market", data: { geography: "Worldwide" } });
  assert.equal(global.scope, "GLOBAL");
  assert.equal(global.resolution, "global_coverage");
  assert.equal(countryMatchesScope(global.country?.country_code ?? null, global.scope), false);
});

test("canonical metadata, aviation identifiers and research scope conflicts fail explicitly", () => {
  const valid = validateOciData("accounts", { ...accountData, country_code: "ES", city: "Madrid",
    airport_iata: "MAD", airport_icao: "LEMD", geographic_confidence: "Low", data_origin: "Synthetic" });
  assert.equal(valid.country_code, "ES");
  for (const metadata of [{ country_code: "UK" }, { country_code: "US" }, { airport_iata: "mad" },
    { airport_iata: "M4D" }, { airport_icao: "MAD" }])
    assert.throws(() => validateOciData("accounts", { ...accountData, ...metadata }), OciGeographyError);
  assert.throws(() => validateOciData("accounts", { name: "Synthetic", classification: "Assumption", country_code: "ES" }), OciGeographyError);
  assert.throws(() => validateOciData("market", {
    title: "Synthetic research", classification: "Research finding", market_region: "EUROPE", country_code: "US",
  }), OciGeographyError);
  assert.throws(() => validateOciData("market", {
    title: "Synthetic research", classification: "Research finding", geography: "Europe", country_code: "US",
  }), OciGeographyError);
  assert.throws(() => validateOciData("market", {
    title: "Synthetic research", classification: "Research finding", geography: "Europe", market_region: "GLOBAL",
  }), OciGeographyError);
  assert.equal(validateOciData("market", {
    title: "Synthetic research", classification: "Research finding", market_region: "EU", country_code: "CY",
  }).country_code, "CY");
});

test("full form serialization and validation preserve geographic/evidence fields without converting provenance", () => {
  const current = { ...accountData, country_code: "ES", location: "Legacy text", city: "Madrid",
    geographic_source: "Synthetic fixture source", geographic_confidence: "Low",
    data_origin: "Synthetic", source: "Fixture reference", researchDate: "2026-10-31", confidence: "Low" };
  const form = new FormData();
  form.set("name", "Edited synthetic organisation");
  form.set("classification", "Assumption");
  const submitted = serializeOciRecordForm(moduleOf("accounts"), form, current);
  const output = validateOciData("accounts", submitted, OCI_STAGES, current);
  for (const key of Object.keys(current).filter(key => key !== "name"))
    assert.deepEqual(output[key], current[key], key);
  assert.equal(output.name, "Edited synthetic organisation");
  assert.equal(submitted.country, "Spain");
  assert.equal(Object.hasOwn(output, "latitude"), false);
  form.set("city", "");
  const cleared = validateOciData("accounts", serializeOciRecordForm(moduleOf("accounts"), form, current), OCI_STAGES, current);
  assert.equal(Object.hasOwn(cleared, "city"), false);
  assert.equal(cleared.country_code, "ES");
});

test("PATCH preserves omitted metadata and raw legacy values while business payload replacement remains intact", async () => {
  let saved;
  const original = account({ ...accountData, country: " UK ", location: " legacy location ",
    country_code: "GB", data_origin: "Synthetic", geographic_source: "Fixture", confidence: "Low", researchNotes: "Replaceable business field" });
  const service = createOciService({
    getStages: async () => OCI_STAGES,
    getRecord: async () => original,
    updateRecord: async (kind, id, input) => { saved = input; return { ...original, data: input.data, version: 2 }; },
  });
  await service.updateRecord("accounts", accountId, { data: { name: "Updated synthetic", classification: "Assumption" }, version: 1 }, actor);
  assert.equal(saved.data.country, " UK ");
  assert.equal(saved.data.location, " legacy location ");
  assert.equal(saved.data.country_code, "GB");
  assert.equal(saved.data.data_origin, "Synthetic");
  assert.equal(saved.data.geographic_source, "Fixture");
  assert.equal(saved.data.confidence, "Low");
  assert.equal(Object.hasOwn(saved.data, "researchNotes"), false);
  await assert.rejects(service.updateRecord("accounts", accountId, {
    data: { name: original.data.name, classification: "Assumption", country_code: "ES" }, version: 1,
  }, actor), OciGeographyError);
});

test("metadata-only edits retain the legacy account identity tuple and repository duplicate handling", async () => {
  const original = account({ ...accountData, country: " UK " });
  const key = data => [data.name.trim().toLowerCase(), (data.country || "").trim().toLowerCase()].join("\0");
  let stored = original;
  const repo = createOciRepository(async (sql, params) => {
    if (sql.startsWith("select value")) return { rows: [{ value: OCI_STAGES }] };
    if (sql.startsWith("select *")) return { rows: [stored] };
    if (sql.startsWith("update public.oci_records")) {
      const data = JSON.parse(params[2]);
      assert.equal(key(data), key(original.data));
      stored = { ...stored, data, version: 2 };
      return { rows: [stored] };
    }
    if (sql.startsWith("insert into public.oci_records")) {
      const data = JSON.parse(params[1]);
      if (key(data) === key(stored.data)) throw Object.assign(new Error("Synthetic unique-index violation"), { code: "23505" });
      return { rows: [{ ...original, data }] };
    }
    throw new Error("Unexpected repository operation");
  });
  const service = createOciService(repo);
  await service.updateRecord("accounts", accountId, {
    data: { name: original.data.name, classification: "Assumption", country_code: "GB", data_origin: "Synthetic" }, version: 1,
  }, actor);
  assert.equal(stored.data.country, " UK ");
  const legacyForm = new FormData();
  legacyForm.set("name", "Edited synthetic");
  legacyForm.set("country", " UK ");
  legacyForm.set("location", " legacy location ");
  legacyForm.set("classification", "Assumption");
  const savedLegacy = validateOciData("accounts", serializeOciRecordForm(moduleOf("accounts"), legacyForm), OCI_STAGES);
  assert.equal(savedLegacy.country, " UK ");
  assert.equal(savedLegacy.location, " legacy location ");
  await assert.rejects(service.createRecord("accounts", {
    data: { name: original.data.name, country: "uk", classification: "Assumption", country_code: "GB" },
  }, actor), { status: 409, code: "OCI_DUPLICATE_CONFLICT" });
});

test("market geography and financial provenance survive PATCH without new filter parameters", async () => {
  const current = { title: "Synthetic European research", classification: "Research finding", geography: "Europe",
    market_region: "EUROPE", source: "Fixture reference", researchDate: "2026-10-31", confidence: "Low", data_origin: "Synthetic" };
  const output = validateOciData("market", { title: "Updated research" }, OCI_STAGES, current);
  for (const key of Object.keys(current).filter(key => key !== "title")) assert.equal(output[key], current[key], key);
  const child = validateOciData("opportunities", { name: "Synthetic opportunity", stage: "Qualified", currency: "EUR", probabilityAssumptions: "Manual", probability: 20 },
    OCI_STAGES, { name: "Old opportunity", stage: "Qualified", currency: "EUR", classification: "Assumption", country_code: "ES", data_origin: "Synthetic" });
  assert.equal(child.country_code, undefined);
  assert.equal(child.classification, undefined);
  assert.equal(child.data_origin, "Synthetic");
  const service = createOciService({});
  await assert.rejects(service.listRecords("accounts", { market: "EUROPE" }), { code: "OCI_INVALID_INPUT" });
});
