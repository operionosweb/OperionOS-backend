# Operion frontend

The public corporate website, synthetic demo and authenticated application share
this React/Vite project. Corporate design changes are scoped to
`.op-corporate-shell` in `src/styles/corporate-aero.css`; demo and production styles
remain separate.

## Corporate components

- `AeroHero` supplies the responsive corporate hero and asset relationship cards.
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
  `CockpitGlobe` adapts the supplied Three.js globe into an isolated React scene:
  procedural Earth, clouds, radar, wind, atmosphere and selectable flight
  corridors. Layer switches, flight filters, orbit, zoom and pause are local.
  Aircraft and weather come from the existing deterministic synthetic provider;
  no CDN, paid service, live feed or global layer-control object is used.
- Resources and Intelligence are public routes built from existing workflows,
  demo links and maturity disclosures. Platform remains an alias for Product.
  All public routes share Home's hero, typography, blue/cyan tokens, card,
  navigation and footer styling.

Joby font stacks use system fallbacks until licensed font files are supplied.
Do not copy proprietary font binaries from another website.

## Validation

```powershell
npm.cmd run build
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

In another terminal:

```powershell
npm.cmd run test:corporate
```

The UI tests require the existing Playwright Chromium runtime. They cover all
corporate routes at desktop, tablet and mobile widths (including 320px), aircraft
drag/view controls, capability disclosures, mobile navigation, targeted panel
contrast, cockpit placement/layers/filtering, route metadata and mocked enquiry
success/error states. External requests are blocked,
and no real contact request or database
operation is performed. `CORPORATE_TEST_URL` may select another loopback frontend.
The authenticated acceptance harness remains separate and disabled.
