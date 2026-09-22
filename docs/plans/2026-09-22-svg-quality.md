# SVG quality and reaction visibility

1. Reproduce the reaction/icon overlap with current CSS. Reserve a full row for reactions, distinguish losses, and verify all four directions at mobile and desktop sizes.
2. Generate a disposable comparison of three vector styles in one Luna call. Compare a human and nonhuman character before touching production artwork generation.
3. Use the selected direction to improve the generator's shape vocabulary and prompts without image calls or scenario presets. Preserve existing saves and old polygon data.
4. Run schema/render tests and the build; inspect real generated output before publishing.

## Verification

- Reproduced 9.2 px of arrow/icon overlap. The reserved reaction row leaves a 6 px gap at desktop and 320 px widths, including uncertain reactions. Negative reactions use the existing danger color.
- Compared cut-paper profiles, cabinet portraits and ink silhouettes with a human and a clockwork bee. Cabinet portraits are the working direction; the generator remains scenario-driven.
- Added path validation and rendering coverage, legacy polygon compatibility, and a test for an artwork refresh that overlaps a player decision. Names, the current card, history and reserve survive the refresh.
- Full-world generation checks use the production Luna function and validate all 24 portraits and four faction symbols. No portrait or icon image calls are introduced.
- Old saves remain playable. Their artwork updates through the existing background enrichment path when generation allowance remains; there is no production reset.
- Final production-function sample: 24 valid portraits and four symbols, 121.8 seconds, $0.0125631495 including world creation. The generator uses low reasoning for world/identity artwork and keeps minimal reasoning for dialogue. Visual inspection confirmed connected outlines and facial features; repeated face shapes remain a limitation of this compact single-call approach.
- Final checks: 24 tests, 114 assertions; TypeScript and production build pass. Both legacy polygons and new paths render without injecting SVG markup.

## Faction symbol alignment follow-up

- B is confirmed by the player. The art study placed SVGs inline with labels, and the four sample drawings filled only 36–54% of an off-center 100-unit canvas.
- FactionIcon now fits the SVG viewBox to the rendered path/polygon bounds before paint. The authored aspect ratio stays intact, with equal margins and a centered drawing; portraits keep their original composition.
- The study uses the actual React component, a four-column grid and separate aligned labels.
- Browser checks: all four previously failed centering; all four now pass and fill 90.9% of their square viewBox. At 320 px, game tiles remain 36 px with 6 px arrow clearance; preview labels share one top edge and have zero center offset. Neither layout overflows.
