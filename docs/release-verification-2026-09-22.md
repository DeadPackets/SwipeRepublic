# Approved silhouette release verification

- Production code shares one 620 ms card exit across buttons, drag and the 700 ms arrow hold. Reduced motion uses a 120 ms dissolve.
- `bun test src worker`: 20 passing tests, 87 assertions. Hold cancellation, key-repeat latching, persistent reserves, succession, private clones, budgets and legacy save compatibility covered.
- Prototype hold checks: 8 passing tests, 23 assertions.
- `bun run build`: TypeScript and both Vite builds pass. Client JavaScript 78.70 kB gzip; CSS 7.30 kB gzip.
- Local paid campaign smoke passed in 94 seconds: The Weather Parliament, 24 generated nonhuman characters, one 638,422-byte background, 99.11 similarity, persistent art, private ownership, independent reuse and idempotent decisions.
- Browser onboarding and gameplay passed. Button click produced a measured lateral transform of -284 px during exit; dragging advanced exactly one turn. A short arrow tap did not choose. Browser automation cannot sustain a key hold; the hold state machine is covered by automated tests.
- At 320 px and 390 px: no horizontal document overflow. Both choice labels compute to 20 px Manrope. At 1280 px: 440 px card, 22 px choice labels. Browser error log empty.

## Independent bug review

Hunter, Skeptic and Referee inspected the release separately. Hunter reported one low-severity typography issue: the right label matched a legacy first-span arrow rule. The label rule now sets `font: inherit`; Skeptic and Referee confirmed the fix with equal specificity and later source order. Browser computed styles confirm both labels match. No reported issue remains open.

During review, the preparation countdown also received its own progress-track selector so the track's 2 px height cannot clip the estimate.

## Compatibility

Existing character indices, cards, history and art stay valid. Old worlds may gain identities and additional cast when their remaining AI allowance permits it. Existing unscored reserve choices maintain reserves. Shared template version 2 excludes old six-person templates from new matches without deleting saves.
