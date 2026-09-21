# Simplification and polish verification

Verified 21 September 2026. The final design follows the user's request for heavy simplification, with the midnight cabinet mood retained in color, portrait art and brief motion.

## Before / after

| Area | Before | After |
|---|---|---|
| Main screen | Decision surrounded by titles, side information and repeated outcomes | Four meters, one speaker, one short dilemma and two choices |
| Choosing | Select, then confirm or reconsider | Tap or swipe commits; hover, focus and keyboard arrows preview |
| Narrative | Longer setup and explanation | New cards target 18–28 words; measured sample: 23, 22, 23 words |
| World detail | Persistent aims, promises, laws and faction descriptions | Menu disclosures; tapping a faction opens its details |
| Welcome | Large introduction and supporting explanation | One prompt field, three examples, Begin; saved games collapsed |
| Introduction / ending | More supporting text and action stages | Two aims with only the selected description; two direct successor choices |
| Readability | Dense competing text | Single 420 px column, 23–25 px dialogue; 20–22 px for long stored cards |
| Character art | Procedural SVG portraits | One bundled 196,884-byte WebP atlas with human, animal and speculative advisers |
| Mood | Pale document styling and browser chrome | Dark olive, worn brass, severe portraits, restrained red, matching favicon and browser theme |
| Motion | Limited feedback | Card arrival, direct drag, 240 ms departure, meter interpolation, brief numerical changes, dialog transitions |
| Accessibility | Basic keyboard support | 44 px controls, accessible faction names/values, reaction symbols, modal focus restoration and reduced motion |
| Client JavaScript | 101.83 KB gzip | 75.97 KB gzip; server validation schema removed from client dependency graph |
| Storage / sessions | Shared capped index and concurrent initialization | Per-society records, no silent cap, tab synchronization and serialized initialization |
| Accounting / history | Retry and clamping inconsistencies | Idempotent settlement with persistence retries; history records applied changes |
| Preparation | Missing resume prefetch and oversized callback gate | Guarded resume prefetch; callback uses its own allowance |

## Checks

- `bun test`: 7 pass, 0 fail, 30 assertions. `bun run build`: TypeScript and both Vite builds pass. `git diff --check`: pass.
- Client output scanned for the actual environment API key: absent from all 8 output files. No key included in this report or browser assets.
- Browser: desktop, 390 px mobile and 320 px narrow layout inspected. Narrow page width and scroll width both 320 px. All measured main game controls at least 44 px tall. Long stored text remains scrollable.
- Browser interactions: direct choice, pointer swipe, arrow-key preview and Enter, defeat, succession, earned retirement, faction details, introduction, welcome, menu and Escape dismissal. Closing the menu returns focus to Menu.
- Live local model flow: generated a world with valid portrait selections, started play and committed a decision. Separate simplified narrative sample generated three cards, scored by Jev, for $0.0015861405 total; Luna 8.154 seconds and Jev 0.509 seconds. These are samples, not latency guarantees.
- Text contrast against card surface #23261e: primary 12.09:1, muted 7.53:1, brass 8.05:1, danger 8.08:1. Portrait text has a dark overlay; it was visually inspected, not exhaustively pixel-tested.
- Reduced-motion CSS and numerical interpolation branches inspected. No OS-level reduced-motion setting was changed during QA. A full screen-reader session and physical mobile device test were not performed.
- Two fonts load from the app: Newsreader 58.08 KB and Manrope 24.83 KB. CSS 4.19 KB gzip. No animation dependency or runtime image calls.
- Bug hunt: ten confirmed defects resolved, one dismissed candidate. See [full report](bug-hunt-polish.md).

## Portrait asset

Mode: built-in image generation, one new image, no source references. Final asset: `public/art/cabinet-portraits.webp`. The original PNG was converted to WebP with `cwebp -q 80 -noalpha`; the image content was not programmatically edited. Output is a 1254 × 1254 atlas. The product crops individual cells through CSS.

<details>
<summary>Generation prompt</summary>

Use case: stylized-concept. Asset type: a production sprite atlas for a grim political card game called Swipe Republic. Create ONE square image in an EXACT 4 by 4 grid of 16 equally sized square portrait tiles, edge to edge, with no gutters or borders. Each tile is a different isolated head-and-shoulders bust, face centered at the exact center of its tile, looking directly at the viewer. Art direction: extraordinary sculptural linocut meets carved bronze relief, severe geometric planes, convincing detailed faces, painterly dry pigment, dramatic single side light, high contrast shadows, blackened olive charcoal background and weathered antique brass highlights. Serious, exhausted, distrustful political advisers, never cute, never cartoon, never sketch doodle. All wear very simple dark collarless clothing with no era-specific ornaments or insignia. Diverse people; no real known individual. Row 1 left to right: older man with angular long face, woman with cropped dark hair, elderly woman with high cheekbones, bald man with broad face. Row 2 left to right: older man with close beard, younger woman with long tied-back hair, anthropomorphic fox statesperson, anthropomorphic owl statesperson. Row 3 left to right: anthropomorphic deer statesperson, anthropomorphic bear statesperson, anthropomorphic beaver statesperson, severe humanoid robot adviser. Row 4 left to right: reserved humanoid alien adviser with long skull, middle-aged man with glasses, older woman with swept back hair, middle-aged man with curly hair. Every face remains easily legible as a small game portrait, occupies about half tile width, full top of head visible. Consistent lighting, scale and alignment in every cell. NO TEXT, no labels, no letters, no numbers, no symbols, no watermark. Dark desaturated palette, rich material texture and exact aligned grid. Desired output 2048x2048 or larger.

</details>

## Release

Worker version: `d2424466-50a4-42a7-93a6-486b86446e5f`.

- `https://swiperepublic.deadpackets.pw/api/health`: HTTPS success, status ok.
- `https://swipe-republic.b00073615.workers.dev/api/health`: HTTPS success, status ok.
- Production API smoke: ownership isolation, invalid-input rejection and cross-origin mutation protection pass.
- Production browser renders the simplified welcome and generated Mars Civic Union with the new world schema. One tap advanced to Sol 2 with support 44/50/56/50; reloading restored the same turn, card and values. No browser console errors were recorded. The loading label was then corrected to “Opening your world…” so resuming does not imply regenerating a save.

Older saved cards keep their original text; shorter prose applies to newly generated cards.

