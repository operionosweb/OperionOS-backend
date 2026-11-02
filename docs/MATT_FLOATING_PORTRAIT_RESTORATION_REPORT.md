# Matt approved floating portrait restoration

Prompt 73196. Date: 2 November 2026. **Local rendering verified.**

## Asset and previous implementation

The existing approved asset was found and visually inspected:
[executive-office.jpg](../frontend/public/matt/executive-office.jpg).
It is the established Matt office portrait, 758 × 503 pixels.

SHA-256:
`63B20DFD2E849FCB61C1119DA96164F9E12F2DAB0FA457D4B9105469EA1A421C`.

It was not generated, replaced, recompressed, uploaded or edited. No new face,
stock avatar, unrelated image or chatbot symbol was substituted.

Historical HEAD's [floating component](../frontend/src/components/demo/OperionAssistant.jsx)
rendered `<Video size={24}/>` beside Matt. The preserved local remediation
already replaced that control with the actual image; the public artifact did
not receive that local work. This task does not falsely claim to have newly
created an image element that was already present on disk.

## Final local implementation

- Existing image URL: `/matt/executive-office.jpg`.
- Shared `MattFloating` is used by Demo and production layout, including
  workspace/Globe contextual invocation and platform-only presence.
- Closed launcher now has the exact accessible name **Ask Matt**; expanded
  control remains **Close Matt assistant**, with `aria-expanded`.
- Decorative image has empty alt text inside the labeled button, avoiding a
  redundant accessible announcement.
- Existing [CSS](../frontend/src/styles/mattFloating.css) retains a 40px square,
  circular clipping, border, cover crop, approved face positioning, white
  corporate control and subtle shadow. No distortion or redesign was introduced.
- Desktop fixed right/bottom placement and mobile safe-area-aware placement
  remain unchanged.
- Opening toggles the shared panel without navigation. Selected contract/flight
  and page context are preserved; expansion uses existing scoped links.
- Main full Matt intentionally has no duplicate floating control; its talking
  environment is not replaced with the static launcher portrait.

## Executed browser evidence

| Environment/context | Widths | Result |
|---|---|---|
| SaaS dashboard with selected authorized contract | 320, 390, 1440 | PASS each: image decode, exact existing URL/dimensions, circular crop, cover sizing, within viewport, Ask Matt opens shared selected context and URL unchanged |
| Demo contract workspace | 320, 390, 1440 | PASS each: actual loaded image, appropriate density, circular bounds, keyboard open and contract-preserving expansion |
| Demo selected Globe aircraft | Same responsive suite plus actual Globe selection test | PASS: selection/switch/close, floating/expanded scope, no stale aircraft context |
| Main/workspace/floating/report continuity | Existing serial suite | PASS |
| General mobile/desktop layout | 320, 390, 768, 1024, 1440, 1920 | PASS supported regression checks; mobile viewport is not physical-device acceptance |

The rename exposed a legitimate test-locator ambiguity: Globe also has an
**Ask Matt** action. Tests now target the floating region or main content
explicitly instead of selecting the first matching button. Assertions were
not removed or weakened.

**Production portrait restoration is not deployed by this task.** The current
local rendering is verified in both Demo and SaaS; the served public build
remains older. A static launcher is a navigation control, never evidence of
genuine live Matt responses.
