# Swipe Republic: freeform worlds and survival

## Decisions

The player's description defines the society. There is no list of supported settings or species. Shared campaigns are immutable starting worlds, never another player's save. The player may accept a similar campaign or create their own even when matches exist.

- D1 stores finished campaign templates and searchable generated descriptions. R2 stores bespoke Muse images. Existing Society Durable Objects retain private, serialized reigns.
- Jev scores semantic setting similarity on an explicit 0–100 rubric, separate from its confidence. Only scores strictly above 85 are suggested. For a small catalog all entries are considered; larger catalogs use full-text retrieval plus recent entries before Jev. This cost-bound retrieval can miss paraphrases; it never prevents a new world.
- Luna writes the society, six characters with unconstrained appearance descriptions, factions, resources, art direction and crises. Muse generates one background, six individual portraits and three resource icons. At the measured $0.01/image this is $0.10 in artwork per new template. Existing daily and per-game spend limits remain enforced.
- Durable alarms prepare worlds in stages and persist each completed image batch. Retries preserve successful assets. Only complete templates are discoverable. Cloning creates fresh meters, history, commitments and unique card IDs.
- No aims, retirement checklist, 36-decision ending or five-reign ceiling. Reigns end when a faction withdraws support. Promises, laws and consequences continue through succession; the AI spending allowance still bounds paid generation.

## Experience

A single freeform input leads to optional matching worlds, then a generated world reveal. The backdrop, society name, immediate problem, people and scarce resources are introduced progressively. Artwork preparation reports real progress. No player decision is required while the world is incomplete. The first crisis is ready before taking office.

The selected midnight-cabinet direction uses dark surroundings, brass, readable ivory text and restrained red warnings. The composition studies remain layout and motion studies only; their Mars setting is not a runtime preset. Spectacle belongs at arrival and collapse. Normal turns have one speaker, one request and two choices. Touch, buttons, keyboard, focus visibility and reduced motion all work.

## Implementation and checks

1. Add shared templates, Jev matching and resumable Muse artwork → verify threshold, privacy, incomplete-template exclusion and duplicate completion tests.
2. Remove aims and fixed endings; promote prepared cards in the choice mutation → verify survival past turn 36, collapse, succession, due promises and old-save compatibility.
3. Wire optional reuse, generation progress, dynamic artwork and progressive onboarding → verify freeform nonhuman and historical settings, reload and retry.
4. Improve deck motion and arrival/collapse transitions → verify mobile sizing, keyboard, reduced motion and browser errors.
5. Build, run focused adversarial review, deploy and smoke test → record measured bytes, model costs and live outcomes.

## Deviations

The previous draft proposed curated backgrounds. The user rejected that premise. All new worlds now require bespoke, persisted Muse artwork. Existing saved worlds keep their legacy fallback art.

Paid world limits remain unchanged. Cached starts use a separate twenty-per-IP daily admission limit so a player can reuse a ready society even after spending their new-world admissions. The first completed original test template was promoted to production for live reuse verification. See `docs/campaign-verification.md` for measured checks and the production fresh-generation test boundary.
