# Cinematic polish and simplification

Decisions: keep the deterministic game rules and existing API. The selected midnight cabinet palette and portraits remain. The later user request supersedes the elaborate composition: one short dilemma, four meters, two immediate choices; optional information lives in Menu. No new per-turn AI calls.

1. [x] Make isolated visual studies and select a direction. Check: three original studies, user selected midnight cabinet; two compact studies followed the simplification request.
2. [x] Rebuild the surfaces and motion, then distill the UI. Check: welcome, introduction, play, ending, succession, dialogs, errors and saves.
3. [x] Complete Hunter → Skeptic → Referee review and fix confirmed defects. Check: ten confirmed defects resolved; targeted reproduction and regression tests.
4. [x] Verify responsive layout, keyboard/touch, reduced-motion implementation, contrast and bundle size. Check: browser checks and production build; see polish verification.
5. [x] Deploy verified changes and record release evidence. Check: HTTPS, live interface and commit.

## Deviations

- Removed the sidebars, decorative cabinet scene, repeated titles/outcomes and confirmation step after the user requested heavy simplification.
- Shortened generation prompts instead of rewriting already saved cards, which preserves their choices and avoids additional model cost.
- Used one bundled portrait atlas and CSS motion; no animation library or runtime image service.
