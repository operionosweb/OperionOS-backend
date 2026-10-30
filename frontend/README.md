# Operion frontend

The public corporate website, synthetic demo and authenticated application share
this React/Vite project. Corporate base styles are scoped to
`.op-corporate-shell` in `src/styles/corporate-aero.css`; demo and production base
layouts remain separate. `src/styles/spatial-surfaces.css` is the shared
presentation and mobile-gutter layer, imported last.

## Corporate components

- `AeroHero` supplies the responsive corporate hero and asset relationship cards.
- The interactive 3D aircraft is Home-only. Other corporate routes use the same
  typography and calls to action without loading the aircraft scene.
- `AircraftScene` uses the packaged Three.js dependency, not a remote script or
  externally hosted model. It includes a smooth fuselage, mirrored airfoil wings,
  cabin windows, cockpit glazing and open turbofan intakes. Drag to orbit, use the
  view buttons to zoom/reset, or opt into automatic rotation. Animation pauses
  offscreen; decorative animation respects reduced-motion preferences, while
  automatic rotation is explicitly opt-in. WebGL failures are explicit.
- `CapabilityLayers` provides keyboard-accessible capability disclosures and
  separates available features from development/roadmap capabilities.
- `SalesHero` delegates to `AeroHero`; shared sections, forms, legal pages and
  navigation receive the same corporate visual tokens.
- `ExecutiveCockpit` appears on Home below the product demonstration and on
  Platform/Product, below the "A real view..." introduction. The shared
  `FlightOperations` and `CesiumFlightGlobe` are shared with the Demo Dashboard
  and tracking workspace, so every surface exposes the same aircraft search, flight filters, selection,
  globe/map, standard/satellite imagery, clouds, illustrative weather/wind,
  routes, pause, orbit, zoom, reset and fullscreen controls.
  Aircraft and weather come from the existing deterministic synthetic provider.
  External base-map imagery retains its provider attribution; it is not flight
  or forecast data.
- Every globe renders the same detailed Home airliner as a local, embedded-texture
  glTF model, not a camera-facing icon. Rebuild it after changing `buildAircraft`
  with `npm run build:aircraft-model` (uses the installed Vite, Playwright and
  Three.js tooling). Five material batches share the original fuselage, wings,
  engine fans and glazing. Model tint and outline preserve the five flight-status
  colours. Geographic orientation follows each prepared heading; camera orbit
  changes the actual 3D perspective without changing that heading.
  Airport-to-aircraft-to-destination lines sample geodesics above the ellipsoid;
  the selected route labels its origin and destination. Model size is exaggerated
  at overview zoom levels for visibility. All fleet entries use this illustrative
  airliner, **not** type-exact or verified airframe geometry. Model failures are
  reported explicitly; the fleet list and aircraft details remain available.
  Cesium 1.132 and Widgets 13.0 are pinned together so the viewer, route
  primitives and packaged workers use one Engine 19 renderer, rather than loading
  incompatible nested engines.
- "Explore the fleet" opens a bounded, scrollable search/status selector directly
  inside every globe, including fullscreen. Selecting an aircraft replaces it
  with that aircraft's infocard; Escape closes the fleet panel and restores
  focus to its toggle. Empty results keep the globe and filters available.
  At narrow widths aircraft facts stack, layer buttons wrap and panels stay
  inside the canvas without covering the map controls.
- Desktop demo navigation collapses to a left icon rail, expands on mouse hover
  or keyboard focus, and can be pinned open. Mobile retains its navigation drawer
  and bottom navigation. Relationship-node badges and tracking actions use
  bounded, wrapping text rather than overflowing their cards or buttons.
- Mobile globe navigation uses two fingers to pan/orbit, pinch to zoom and twist
  to rotate the view. A single tap still selects an aircraft; a single-finger
  drag cannot move the map. This shared touch controller is also used by the
  authenticated production globe, without altering mouse controls. Touch gestures
  on the canvas are reserved for the globe; scroll the page outside the canvas.
- The About page presents the company story, aviation-first focus, four explicit
  maturity stages, six principles and the founder's supplied photograph and
  first-person biography. Predictive risk, simulation and digital twins are not
  represented as operational forecasts. The supplied logo is also packaged as
  48px/192px favicons and a 180px Apple touch icon.
- Corporate and Demo share a cinematic spatial presentation: layered panels,
  edge lighting, depth shadows and restrained coordinate grids. This is a visual
  design, not an immersive WebXR session or a new device-permission request.
- At viewport widths up to 900px, Corporate, Demo and authenticated workspace
  primary infocards, content images and globe
  frames use the screen width minus a 2px gutter on each side. Card grids stack
  into one column. Nested layout wrappers do not add another gutter. Globe
  infocards and fleet filters fill the map width; camera controls remain above
  the scrollable popup. Logos, icons, graph nodes and inline controls retain
  their semantic sizes.
  Consent banners and evidence drawers follow the same gutters; authenticated
  workspace navigation switches to its existing mobile drawer through 900px.
- Home's Core Idea connects selectable maintenance, fuel and aircraft-lease
  examples through paper-like agreement and working-situation cards, rather
  than a decorative intelligence hub. Desktop mouse movement adds restrained
  3D tilt; cards settle into view without continuous animation. Mobile and
  reduced-motion preferences disable the motion.
- Home's aviation-context section connects five selectable working situations
  (maintenance/suppliers, fuel, currency, interest rates and weather) to the
  relevant agreement, mechanism and next review question. These are illustrative
  reasoning paths, not connected live feeds, verified events or forecasts.
- Home's 3D Asset View supports actual mesh picking, camera-following numbered
  hotspots and keyboard-accessible part buttons for airframe/cabin, engines,
  wings/fuel systems, tail and cockpit/avionics. The popup explains typical
  agreement families and three review checks, with explicit limitations.
  Selection highlights the model region; dragging still orbits and Escape
  closes the popup and restores focus. Contract examples use existing routes.
- Resources and Intelligence are public routes built from existing workflows,
  demo links and maturity disclosures. Platform remains an alias for Product.
  All public routes share Home's hero, typography, blue/cyan tokens, card,
  navigation and footer styling.

Joby font stacks use system fallbacks until licensed font files are supplied.
Do not copy proprietary font binaries from another website.

## Aviation provider availability

No licensed live flight, Turbli turbulence or verified airframe-photo integration
is configured. Search covers only the synthetic fleet (registration, callsign,
flight number, ICAO address and operator). All globe surfaces label live flights,
turbulence and photos as unavailable and link to Flightradar24 and Turbli externally.
No website scraping, third-party map embedding or photo hotlink is performed.
Illustrative weather is not presented as turbulence. The optional Xweather
integration described below makes provider requests only when explicitly enabled
on the server and selected in the browser.
Never use an unrelated stock image to identify a synthetic aircraft.

Future live integration requires approved provider documentation, display/photo
rights, and server-side credentials; no API key belongs in frontend configuration.
The map is not suitable for navigation or operational weather decisions.

## Command centre and shared spatial schema

The Demo Dashboard has six connected areas: portfolio overview, shared globe,
priority review actions, contractual financial exposure, obligations/critical events,
and contract portfolio/supplier relationships. A compact external-risk availability
area distinguishes missing feeds from supported evidence. Dashboard contract and
counterparty search, contract and risk filters also constrain the globe's linked
aircraft. The existing financial-impact and deadline workspaces remain available.

`components/aviation/globeSchema.js` is the authoritative layer/filter schema.
Home, Platform, Dashboard and tracking all render `FlightOperations`; tracking
retains its contextual tabs, dependency graph, contract preview and assistant.
The obsolete `DemoLiveTracking` module re-exports that same tracking workspace.
Only `FlightOperations` imports the Cesium renderer.

The twelve requested layer categories are present. Aircraft, route airports,
contract-linked assets and prepared contractual/financial hotspots are selectable.
Hotspots project existing demo associations near synthetic aircraft positions;
they are not observed regional events. Counterparty, supplier/MRO/handling/fuel
facilities, geopolitical signals and geographic supplier-dependency overlays
remain explicitly unavailable where coordinates or verified feeds are missing.
No facility location, loss estimate or external event is invented.

Registration/callsign search combines with aircraft type, operator, contract type,
counterparty/supplier, contractual risk, exposure category, weather severity and
contract status. Asset-category and region filters disclose missing taxonomy
instead of offering fake results. All contract predicates must match the same
linked agreement. Spatial records are also available through a keyboard-accessible
list, with contract links and the same legend on every globe.

Review editors validate an owner, support notes/status, Save and Cancel, and
retain changes **only while the dashboard remains mounted**. No API mutation,
legal change, externally assigned task or persisted customer record is implied.
The demo has no authenticated editing permission; real edits remain gated by the
existing production workflows.

The prepared MRO, insurance and handling fixtures reuse lease sample evidence.
The command centre explicitly discloses this limitation; their counts and
extraction confidence are not validated type-specific analysis. Financial amounts
remain labelled synthetic assumptions, separated from unquantified risk.
Conditional deadline expressions are not converted into invented calendar dates.
Only known absolute dates appear in the absolute-date view.

### Optional Xweather Raster Maps

Every `CesiumFlightGlobe` includes expandable, independently selectable Xweather
filters: regional radar, GeoColor satellite imagery, 10-metre surface wind speeds
and administrative boundaries. Synthetic scenario weather is hidden while provider
imagery is selected and restored when all provider layers are switched off.
These raster overlays are not MapsGL vector animations, flight-level wind or GTG
turbulence; they do not reproduce Turbli's altitude/time controls.

Configure `XWEATHER_CLIENT_ID` and `XWEATHER_CLIENT_SECRET` in the backend's
deployment secret store, then set `XWEATHER_MAPS_ENABLED=1` only after verifying
Raster Maps subscription and display rights. Rotate credentials previously shared
in chat before production use. Never put them in `VITE_*` variables, frontend
code, browser URLs or Git. `VITE_API_BASE_URL` points to the backend origin when
it is not served behind the frontend's same-origin `/api` reverse proxy.

`GET /api/weather-maps/status` reports configuration, **not** authenticated
provider connectivity. Tiles use `/api/weather-maps/tiles/{layer}/{z}/{x}/{y}`.
The server validates a fixed layer allowlist and zoom 1-6, refuses redirects,
limits response sizes and timeouts, deduplicates requests, and caches at most
200 tiles for five minutes. It allows at most 300 upstream requests per five
minutes and 24 concurrent requests **per process**. This public, opt-in proxy
needs deployment-level access controls, shared rate limits and provider spending
alerts before scaling; process restarts and multiple instances reset/multiply
the in-memory budget. The browser requests no provider imagery until a filter
is selected and reports tile errors explicitly. Enabled imagery remains a snapshot
until the layer is toggled or the page is reloaded; this is not continuous tracking.

Turbli integration still requires documented authorized access. Xweather
credentials do not authorize a Turbli feed. Provider connectivity and subscription
have not been verified by the offline tests.

References: [Xweather tile format](https://www.xweather.com/docs/maps/getting-started/map-tiles)
and [supported raster layers](https://www.xweather.com/docs/maps/layers).
Run isolated, mocked proxy tests from the repository root with
`node --test test/weather-map-routes.test.js`; these never call the provider.

## Validation

```powershell
npm.cmd run build
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

In another terminal:

```powershell
npm.cmd run test:corporate
node --test tests/command-centre.test.mjs
node --test --test-concurrency=1 tests\about-touch.test.mjs tests\globe-touch-controls.test.mjs
node --test --test-concurrency=1 tests\spatial-surfaces.test.mjs
```

The UI tests require the existing Playwright Chromium runtime. They cover all
corporate routes at desktop, tablet and mobile widths (including 320px), aircraft
drag/view controls, capability disclosures, mobile navigation, targeted panel
contrast, cockpit placement/layers/filtering, route metadata and mocked enquiry
success/error states. External requests are blocked,
and no real contact request or database
operation is performed. `CORPORATE_TEST_URL` may select another loopback frontend.
The authenticated acceptance harness remains separate and disabled.

The demo Executive Cockpit gives the interactive globe the full workspace width.
Selected-aircraft infocards appear as dismissible, scrollable popups **inside**
the globe, including fullscreen. Clicking an aircraft/route or choosing a fleet
entry opens the same popup on Home, Platform, Dashboard and tracking. Close with
the close button or Escape while focused inside the card; map navigation remains
available alongside it. On small screens the card uses a bounded bottom panel.
Fleet search and selection use a second on-globe popup;
contract metrics and intelligence cards follow in a separate section. The UI suite
also checks this layout at 1440, 1024, 768, 390 and 320px and exercises fleet
selection, filters and globe layers.
Command-centre checks additionally cover 320, 360, 390, 430, 768, 1024, 1440 and
1920px with actual WebGL rendering, evidence disclosure, filtered portfolio
records, review validation/save/cancel and shared spatial controls.
Corporate checks additionally cover Home-only aircraft, edge-to-edge Home video,
non-overlapping aviation-sector cards, all desktop links in the mobile menu,
and shared globe search/provider-availability behavior.
About checks cover all eight widths, the unchanged founder image, expanded
biography, maturity disclosures, CTA destinations, metadata and favicon assets.
Mobile checks dispatch actual two-point browser touch gestures for pan, pinch
and rotation on all four shared globe routes, single-tap aircraft selection and
2D map panning. One-finger drags must leave the camera unchanged.
