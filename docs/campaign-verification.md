# Freeform campaigns and survival redesign

Live version: `9d322d60-50a8-4da0-8407-5ac6e7fcf164`.

Production: https://swiperepublic.deadpackets.pw/

## What changed

| Before | After |
|---|---|
| Fixed portrait slots and species choices | Freeform character descriptions and ten bespoke Muse images per new world |
| Every world generated independently | Optional Jev matches above 85; immutable D1 templates and R2 artwork |
| Aim selection, retirement checklist, turn-36 ending, five reigns | Survival until loss of support; consequences and succession continue |
| Static introduction and world-details button | Generated scene reveal, scarce resources, four faction introductions, then the first crisis |
| Separate request to advance an already prepared card | Atomic card promotion; overlapping exits and arrivals; durable prefetch |

## Verification

- `bun test`: 15 passing tests, 68 assertions. `bun run build` and `git diff --check` passed.
- Final client: 246.52 kB JavaScript / 77.19 kB gzip; 21.06 kB CSS / 5.58 kB gzip. No animation dependency added. SDKs remain server-only.
- Browser checks: desktop, 390×844 and 320×740; measured document widths equal viewport widths. Both choice targets remain at least 44 px. Pointer swipe, keyboard choice, introductory shortcut guard, reduced-motion toggle, and saved-game reload passed. Reduced mode reported `animation-name: none`.
- A wholly custom octopus republic generated its own setting, characters, resources and artwork. Its shared template is named Copper Bells. Another prompt generated clockwork bees in an abandoned observatory; no runtime scene or species presets were used.
- Final five-at-a-time generation test produced Observatory Republic and all ten images, then passed ownership, matching, independent-clone and duplicate-choice assertions in 71 seconds. The saved game's accumulated cost, including initial prefetch, was $0.104495824. These are measured samples, not latency guarantees.
- Jev scored an octopus-setting paraphrase at 98 in one test and rejected a conflicting Egypt 2011 request. Individual matching calls cost approximately $0.000028. Scores are rubric-based semantic similarity, not classifier confidence. The live API supports at most ten rubric levels; the implementation uses 0–9 normalized to 0–100.
- Live health returned version 2. Live reuse smoke passed in five seconds: ten persistent images, correct cache headers, owner-only saves, matching, independent initial state and idempotent decisions. The background response contained 616,292 bytes.
- Existing live Mars save loaded with its legacy portrait fallback. Its recorded history and choices were not changed by the migration.

## Live test boundary

The production test IP had already used its four new-world admissions that UTC day. Fresh production generation was correctly refused. Full paid generation was verified in isolated local Cloudflare storage using the real Luna, Jev and Muse APIs. The already generated Copper Bells template and its ten images were then copied to production D1/R2; no private run, prompt or cookie was published. Live reuse and gameplay were verified against that template.

Cached starts now have a separate allowance of twenty per IP per day, with two hundred globally. Paid world admission remains four per IP; the $1/day and $0.20/game reservations are unchanged. A regression test verifies that cached admissions cannot relax the paid-world limit.

The D1 bulk-import endpoint rejected the authenticated import. The same idempotent SQL succeeded through D1's query endpoint. All ten R2 uploads completed before the template was published.

## Independent bug review

Hunter, Skeptic and Referee independently inspected the implementation. Seven original issues were confirmed and fixed; none was dismissed as a false positive.

| Finding | Severity | Fix |
|---|---|---|
| Old unfinished saves could not restart | Medium | Upgrade null-game saves to durable foundation jobs |
| Keyboard decisions could fire during introduction | Medium | Require playing phase in keyboard and choice handlers |
| Welcome Retry did nothing without an active ID | Medium | Retry the matching request |
| Interrupted calls lost their per-game spending reservation | Medium | Persist reservation before calls and reconcile once |
| Prefetch could exceed the HTTP background lifetime | Medium | Run generation through Durable Object alarms |
| Search could replace a saved game opened meanwhile | Medium | Prevent competing navigation while matching |
| A qualifying match could display exactly 85 | Low | Preserve the qualifying score's visible precision |

Partial-image failure tests also verify that successful images remain saved, only missing work is retried, incomplete templates are not published, and completion is published once.

<details>
<summary>Dismissed findings: 0</summary>

The Skeptic saw two frontend bugs after their fixes had already landed. The Referee confirmed that the original bugs were valid and that their reported paths were resolved. No low-confidence findings remain from this review.

</details>

## Practical limits

Larger catalogs use bounded full-text retrieval plus recent entries before Jev scoring; an old paraphrase can be missed. Missing a candidate still permits original generation. Image consistency and prose remain model-dependent. New-world art has no automatic paid retry loop. The preparation screen reports actual persisted progress, permits browsing the introduction while images finish, and gates taking office on completion.

The gesture path coalesces position updates with animation frames and uses transforms and opacity. No frame-rate claim was made or measured. Generation timing varies with provider load.

A final image-size probe requested `resolution: "512"`. Muse accepted it but still returned a 1600×1600 WebP (146,764 bytes). No claim of server-side resizing is made; production keeps the verified request format, immutable caching and selective portrait preloading.
