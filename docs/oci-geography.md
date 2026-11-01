# OCI Europe-first geographic contract - Increment A and B

Policy version: **2026-10-31.1**, effective 31 October 2026.
Default commercial scope: **EUROPE**. Global is an explicit secondary scope.
Increment A defines the geographic contract. Increment B applies it to shared
OCI list filters and the Command Centre; it does not change authentication, TLS,
database schema, production deployment or external services.

## Sources and membership policy

- Assigned ISO 3166-1 alpha-2 country/area identifiers:
  <https://www.iso.org/obp/ui/#search/code/>. The shared registry contains 249 codes.
  Canonical codes are uppercase; the United Kingdom is `GB`, never `UK`.
  `XK` is not an assigned ISO code and is not accepted as canonical in this version.
- Europe country/area scope uses UN M49 statistical region **150**:
  <https://unstats.un.org/unsd/methodology/m49/>.
- EU membership uses the 27 member states:
  <https://european-union.europa.eu/principles-countries-history/eu-countries_en>.
- EEA membership uses those EU states plus Iceland, Liechtenstein and Norway:
  <https://www.efta.int/eea>. Switzerland and the UK are not EEA members.

This is a versioned country/area grouping, not a physical location classifier or
commercial attractiveness/sanctions assessment. EU, EEA and UK are independent
attributes. Cyprus is EU/EEA but is Western Asia in M49; it therefore does not match
this version's geographical-Europe scope. EU scope still includes it.

### Transcontinental and disputed-boundary treatment

Russia is included by M49's Europe grouping. Turkey, Kazakhstan, Azerbaijan,
Georgia, Armenia and Cyprus follow M49's Asia grouping and are not included in
EUROPE. All seven codes carry `boundaryReviewRequired: true`. A Russian country
code does not prove that an office is west of the continental boundary; a Turkish
code does not prove that an office is outside physical Europe. Exact site placement
needs separately verified location evidence; this increment does not infer it.

Any broader commercial-Europe definition must be an explicit policy-version
change with tests, not an undocumented addition or an equation of Europe with EU.
Unrecognised jurisdictions/labels remain unresolved; that is not a political
claim about recognition or an inferred country assignment.

### Territories

Territories use their own assigned codes, not their administering state's code.
M49 Europe includes AX, FO, GG, IM, JE, GI and SJ. Greenland, French Guiana,
Guadeloupe, Reunion and Falkland Islands are not Europe under this policy.
EU/EEA flags here mean member-state country codes, not a determination of treaty
application in a territory. Territory-specific EU legal coverage is not modelled.
An airport identifier does not override this policy or prove a company location.

## Shared resolution and validation

[ociGeography.js](../shared/ociGeography.js) is browser/server compatible and has
no provider/database imports. It exports country validation, English display
labels, independent membership attributes, scope matching, legacy resolution,
account inheritance and the form serializer.

Labels use English `Intl.DisplayNames` with explicit overrides for the UK, US,
Czechia, Turkey, both Congos, both Koreas and Holy See. The 249-code registry and
membership sets are pinned in source; labels for other codes may follow runtime
ICU updates. Display labels do not become database identity keys.

Only exact case-insensitive English labels, assigned codes and the documented
explicit aliases in the helper are legacy-mapped. UK/U.K./Great Britain map to GB;
USA maps to US, Czech Republic to CZ and Turkey to TR. No fuzzy matching,
geocoding, city inference, translation or external enrichment occurs.
Bare Georgia, Congo, Korea, lists such as "Spain / France", missing values and
unsupported labels are unresolved. Country fields containing assigned two-letter
codes are interpreted as country codes, not administrative-region abbreviations.

Invalid persisted canonical codes or contradictory recognised legacy/canonical
countries return unresolved with a reason. Write validation rejects invalid codes,
conflicts and malformed IATA/ICAO identifiers with an explicit 400 error.
Identifier format validation is **not verification that an airport exists or that
the company is based there**.

## Storage, inheritance and provenance

No migration is needed for this additive JSONB contract.

- Accounts and market records may store `country_code`, `administrative_region`,
  `city`, `airport_iata`, `airport_icao`, `geographic_source` and
  `geographic_confidence`.
- `country_name` is a derived display value, not another editable identity.
- Market records may store `market_region` as an explicit coverage scope.
  Legacy "Europe", "EU", "EEA", "Global"/"Worldwide" coverage is resolved separately.
- Contacts, opportunities, activities, discovery, pilots and revenue inherit
  geography only from the matching linked account. A missing/mismatched account
  is unresolved. Child data cannot override account location. This does not assert
  a contact's residence, meeting venue or revenue-delivery location.
- A market record always resolves as `research_coverage`, even if linked to an
  account. Regional research never creates country/company-location facts.
- `data_origin` supports Real, Synthetic and Unclassified on all modules.
  Missing origin stays missing/unclassified; no resolver labels it Real.
  These values are administrator declarations, not external verification.
- Market research geography remains research coverage; it is not inherited as
  an account location. Geographic option lists may include research facets, and
  the filter panel explicitly identifies those options as coverage rather than
  verified company locations.
- No latitude/longitude, enrichment, reference-directory loading or automatic
  record population is added.

## Shared filters and Command Centre (Increment B)

The shared browser/server helpers normalize `geoScope`, `geoCountries`,
`geoRegions`, `geoCities`, `geoAirports`, `geoSegments` and `geoCompanyTypes`.
Filters are parameterized in the server repository and applied before page
counts/pagination. Country facets accept multiple canonical ISO codes; segment
and company-type facets use the shared contract. Country and company-location
facets on linked contacts, opportunities, activities, discovery, pilots and
revenue inherit from their linked account. Market records use their own
coverage/location data and never inherit account geography.

The workspace defaults to EUROPE and persists filter context in the current
browser tab across module navigation/reload. Global remains an explicit scope.
Changing scope drops only incompatible country/location facets and retains
aviation-segment and company-type selections; reset restores EUROPE and clears
all facets. Region/city/airport choices come from stored active account or
research records; missing facets are shown as unavailable rather than
invented. The authorized `/api/oci/geography/options` endpoint returns a bounded
list (up to 2,000 rows, with a truncation flag).

The Command Centre uses the same server-side scope and filters. It groups
available target accounts, qualified opportunities, open pipeline, discovery,
pilots/proposals and revenue by available geographic and provenance dimensions.
Currency and actual/forecast revenue basis remain separate. A market metric is
not inferred from these CRM records. Missing or unknown `data_origin` is shown
as Unclassified, never silently counted as Real. Records with unresolved
geography are disclosed separately from selected-scope totals. Priority
opportunities appear only where an explicit account priority is recorded.

Backend tests exercise normalization, linked-account query compilation,
parameterization, grouping and bounds using injected query functions; this is
not a PostgreSQL execution test. Browser tests exercise Europe default, Global
selection, persistence, filter reset/cross-module requests and responsive
layouts. A real isolated-database integration test remains outstanding.

## Full-payload PATCH and legacy identity compatibility

Ordinary business fields retain full-replacement PATCH semantics. Omitted
geographic/provenance keys and legacy `country`/`location`/`geography` are preserved
by the shared form serializer and server validator. Explicit blank/null values
clear optional fields subject to validation; provenance edits remain explicit.
Existing required evidence rules remain in force.

The existing unique index is still **lower(trim(name)) + lower(trim(country))**,
not country_code. Increment A never rewrites a legacy country into its display
label or replaces it with a code. Canonical metadata-only edits therefore preserve
the index key. New canonical account data requires an explicit legacy Country
value. A recognised legacy country must agree with the canonical code.

The database's current exact-text uniqueness behavior is preserved, not expanded:
"UK" and "United Kingdom" can already be distinct index keys, as can other
synonyms/unresolved strings. This increment does not promise canonical-country
deduplication, change the index or fix that pre-existing limitation. Such a change
requires reviewed duplicate resolution and a separately authorised migration.

Backend tests exercise real helper/validator/form/service/repository behavior with
an injected unique-index model. They are not a PostgreSQL constraint execution or
provider acceptance test; real isolated-database verification remains outstanding.
