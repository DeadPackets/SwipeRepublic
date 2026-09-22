# Swipe Republic: dynasty rules and cinematic polish

## Decisions

- Four faction meters from 0 to 100, starting at 50. A meter at **0 or at 100 ends the reign**. The scarce reserve is removed.
- Death ends a ruler, not the game. The next ruler takes office through a succession card, and the dynasty continues. Only Menu → Abandon ends the game.
- Previews show which factions react and whether the reaction is small or large, never its direction. The server enforces this.
- Every world has eight collectible deaths, one `collapse` and one `excess` per faction, written by Luna.
- Motion personality is **C · Cinematic**, as chosen from the motion lab (https://claude.ai/artifact/2dpBcMRRkNMMSwKFAuKjGM).
- `motion` 13.4.1 is added through `LazyMotion` with `domAnimation` and the `m` components, measured at 30.4 kB gzipped. The hand-written pointer drag stays and feeds Motion values.
- Haptics use `navigator.vibrate`, which only works on Android. Sound is synthesized with Web Audio, is off by default and is toggled in Menu.
- **No compatibility.** Production data is wiped at deploy. Every legacy path is deleted.
- `GAME_AI_BUDGET` stays at 0.20. With GPT-6 Luna on `low` reasoning, a card costs about $0.0004, so the per-save cap on 100 paid calls is reached before the dollar cap.
- The shared card bag is deferred to its own spec. It needs wait-time data from this release first.

## Rules (`src/game.ts`)

### Types

```ts
type Reaction = { delta: number; uncertain: boolean };            // server only
type PublicReaction = { size: "small" | "large"; uncertain: boolean } | null;
type Death = { title: string; reason: string };                   // title ≤ 40, reason ≤ 120
type Faction = { name; description; priority; redLine; label; color; symbol; collapse: Death; excess: Death };
type Ending = {
  kind: "collapse" | "excess" | "abandoned";
  faction: number | null;       // null for abandoned
  title: string; reason: string;
  reign: number; turns: number; // turns this ruler lasted
  year: number;                 // dynasty year (totalTurns) at death
};
type Card = Draft & { id: string; reactions: Reaction[][]; commitmentId?: string };
type Succession = { id: string; kind: "succession"; candidates: [number, number] };
type Game = {
  id; prompt; world; version;
  totalTurns: number;           // dynasty year
  reign: { number: number; turn: number; support: number[] };
  card: Card | Succession | null;
  deck: Card[]; commitments; legacies; history; endings: Ending[];
  phase: "intro" | "playing" | "over";
  cost; generations;
};
```

### `play(game, cardId, side)`

1. A normal card applies `reactions[side]` deltas and clamps support to 0–100. It then advances `totalTurns` and `reign.turn`, records history with signed deltas, and applies promise and legacy rules, which are unchanged.
2. After applying, it finds the first faction at 0 (a `collapse` death) or else the first at 100 (an `excess` death). Lower index wins ties.
3. On death, it pushes an `Ending` with that faction's `Death` text and sets `card` to a `Succession`. The deck, commitments, history and legacies all carry over.
4. The candidates are the two highest-support factions other than the fatal one. On equal support, the lower index comes first.
5. Playing a `Succession` card makes the chosen candidate the backer. The backer gets 65, the other candidate 40, and the remaining two factions 50. `reign.number` goes up by one and `reign.turn` resets to 0. `totalTurns` does not advance. The next card is a due promise if one exists, otherwise `deck.shift()`.
6. `abandon` pushes an `abandoned` ending and sets `phase: "over"`.

`nextDraft` is unchanged, but it never runs while `card` is a `Succession`.

### `publicGame`

`publicGame` removes `deck`, `cost` and `generations`. It maps the current card's reactions to `PublicReaction`. A delta of 0 becomes `null`. A size of 10 or more is `large`, anything under 10 is `small`. `Succession` cards pass through unchanged, because their outcome is shown in the card's own text. `history` keeps its signed deltas. `nextPortrait` is removed.

### Scores

These are derived on the client and never stored:

| Score | How it is derived |
|---|---|
| Dynasty year | `totalTurns`, shown in `world.calendar` units |
| Best reign | The largest `turns` across endings and the current reign |
| Deaths collected | Distinct `(faction, kind)` pairs in endings, out of 8 |
| Milestones | A toast when `reign.turn` reaches 5, 10, 20, 40, 60 or 100 |

## Generation (`worker/`)

- **`worldSchema`**: each faction gains `collapse` and `excess` Deaths. The prompt asks for one-line gallows endings in the world's own register. For example, Reigns' "Death by roses" means trampled by an adoring crowd. The schema drops `tone`, `resources` and `pressure`. Faction identity fields and character identity fields become required.
- **`generateCards`**:
  - The reserve paragraphs are removed.
  - A new rule applies when a faction's support is above 75 or below 25: at least one card in the batch must involve that faction, and its more tempting option must push the faction further toward the edge.
  - A batch is 5 cards. The opening card stays a batch of 1. The timeout for a card call goes from 25 s to 40 s.
- **`scoreCards`**: the stock questions are removed.
- **Durable Object lease kinds** are `world | cards | callback | art`, with `identity` removed. Preparation is queued when the deck holds fewer than 5 cards. The `cards` lease reserves 0.025.
- **Leases while a `Succession` card is current**: `acquire` does not treat the card as missing, and a `cards` lease may still fill the deck in the background.
- **Deleted code**:
  - `enrichWorld` and `WORLD_IDENTITY_VERSION`.
  - `CAMPAIGN_VERSION` and its column.
  - `polygonSchema` and the `graphicSchema` union.
  - The `portrait-N` and `resource-N` art slots.
  - `LEGACY_KEY` and `clearPreResetSaves`.
  - `retired`, `term` and `reserve` in all their forms.
  - Optional save fields: `settled`, `reservations` and `queued` become required and are initialized in `initialize`.

## Production wipe (at deploy, confirmed first)

| Store | Action |
|---|---|
| Durable Objects | Migration `v6-dynasty-create` adds `Dynasty` and `Ledger`; a second deploy with `v7-dynasty-delete` deletes `SocietyV3` and `Budget`. Class names are new, so no deleted name is reused. |
| D1 | Rewrite `0001_campaigns.sql` without `version`. Drop both tables, clear `d1_migrations`, then reapply. The `database_id` does not change. |
| R2 | Empty `swipe-republic-art`. The method is picked at deploy after counting objects. |

## Client

### Structure

| File | Role |
|---|---|
| `src/useGame.ts` | Session, `api`, polling, `create`, `choose`, `abandon`, `retry`. It holds the `active`, `lock` and `gameRef` refs together. |
| `src/App.tsx` | Chooses a screen and wraps the app in `LazyMotion`, `MotionConfig reducedMotion` and `AnimatePresence mode="wait"` |
| `src/screens/Welcome.tsx`, `Founding.tsx`, `Arrival.tsx`, `Play.tsx`, `Chronicle.tsx` | One screen each. `Chronicle` shows when `phase === "over"`. |
| `src/play/Meters.tsx`, `DecisionCard.tsx`, `DeathCard.tsx` | Play pieces |
| `src/MenuDialog.tsx` | Menu, world, promises, laws, history, settings and abandon |
| `src/feedback.ts` | `haptic()` and the four synthesized sounds |
| `src/motion.ts` | Every motion constant below, in one place |
| `src/style.css` | Rewritten as one sheet from the `DESIGN.md` tokens |

The following files are deleted: `AnimatedNumber.tsx`, the legacy branches in `WorldGraphic.tsx` and the preload of `nextPortrait`.

### Death beat

A death happens inside `Play`, not on a separate screen. When a `choose` response carries a longer `endings` list, the following happens in order:

1. The meters play their hit animation.
2. The mourning sequence runs.
3. `DeathCard`, a client-only card, enters. Swiping it either way, or tapping Continue, dismisses it.
4. The `Succession` card from the server enters.

A reload during the beat skips straight to the succession card.

### Motion constants (C · Cinematic)

| Moment | Values |
|---|---|
| Drag | `rotate = clamp(±9°, x/16)`, `rotateY = clamp(±16°, x/12)` inside `perspective(1000px)`. The card lifts `|x|·0.03`, and the portrait moves `−x·0.05` at scale 1.06. Transform origin is 50% 115%. |
| Threshold | 26% of the card's width. Beyond it, movement is damped by a rubber-band factor of 0.5. A flick also commits when \|x\| > 30 px and speed > 800 px/s in the same direction. |
| Snap back | Spring with stiffness 240 and damping 16, carrying the release velocity |
| Throw | 0.62 s with ease `[.5,0,.3,1]`. The card drops 60 px, rotates up to ±24° and fades from 1 to 0. |
| Enter | The card starts at y 34, scale 0.9 and blur 6 px, then springs in with stiffness 160 and damping 18. It then turns from `rotateY(180°)` to 0 over 0.55 s with ease `[.4,0,.2,1]`. The back face shows the speaker's faction symbol. Words then fade in over 0.35 s, 18 ms apart. |
| Answer label | A band across the top of the card in the faction color. Its opacity is `(|x| − 12) / 70`, and it aligns toward the drag side. |
| Preview dots | 8 px for small and 15 px for large. They animate over 0.55 s with ease `[.16,1,.3,1]`. An uncertain dot flickers between filled and outline every 0.9 s. |
| Meter hit | Spring with stiffness 120 and damping 12, meters 90 ms apart. The icon's color flashes to gain or loss over 0.9 s. A ▲ or ▼ floats up 16 px and fades. A hit of 12 or more shakes the icon for 0.36 s. |
| Edge glow | Below 15 or above 85, the icon turns the danger color and breathes a glow every 1.6 s |
| Mourning | Over 1.6 s, the scene and the surviving meters fade to `grayscale(.85) brightness(.75)` and the vignette rises to 0.9. The fatal icon flares from scale 1 to 1.6 and settles at 1.25 over 1.4 s, then holds for 500 ms. |
| Dynasty year | The number rolls over 0.5 s and blurs in from 4 px at y −6 |
| Toast | Spring with stiffness 400 and damping 24. It shows for 1.6 s. |
| Screens | Crossfade over 0.5 s with a 12 px rise and blur 4 px → 0 |
| Dialogs | They enter with opacity and scale 0.97 → 1 on a spring with stiffness 300 and damping 26. Panels slide 24 px sideways, and the dialog's height animates. |
| Stagger | Welcome, the match list and the Arrival factions reveal 60 ms apart |
| Buttons | Press scales to 0.96 over 80 ms. Release uses a spring with stiffness 500 and damping 18. |
| Reduced motion | Every item above becomes a 120 ms opacity fade. This follows the OS setting and the Menu toggle. |

The keyboard keeps the 700 ms held arrow. When it commits, it uses the throw with a synthetic velocity of ±1200 px/s.

### Feedback

| Event | Haptic (Android) | Sound (opt-in) |
|---|---|---|
| Threshold crossed | 8 ms | A tick |
| Commit | 15 ms | A whoosh of filtered noise sweeping 500 → 2600 Hz |
| A hit of 12 or more | 20 ms | A tick per changed meter, high for a gain and low for a loss |
| Death | 30, 40, 80 ms | A sting: detuned saws with a lowpass falling 1400 → 160 Hz |
| Milestone | none | A two-note chime |

A single `AudioContext` is created on the first gesture after the player turns sound on.

### Accessibility

These gaps come from the UI inventory:
- Focus moves to the heading of each new screen.
- The card is focusable, and its label is the speaker plus the dialogue.
- The live region announces only commits, deaths and milestones, not hovers.
- The abandon confirm becomes an `alertdialog`.
- `dialog::backdrop` respects reduced motion.
- Menu panel changes return focus to the panel heading.
- Each faction button exposes `aria-haspopup="dialog"`.

## Tests

Existing tests are extended, not duplicated.

| File | What it checks |
|---|---|
| `src/game.test.ts` | Death at 0 and at 100, and lower index on ties. Succession card candidates and the 65/40/50/50 split. Carryover of year, deck, promises and history. Abandon sets `phase: "over"`. `publicGame` leaks no sign. Reserve tests are removed. |
| `src/graphics.test.ts` | The polygon case is dropped |
| `src/storage.test.ts` | The legacy and reset cases are dropped |
| `worker/budget.test.ts` | The `cards` lease reserves 0.025. A `Succession` card still lets the deck refill. The legacy tests are removed. |
| `worker/campaigns.test.ts` | Unchanged apart from the types |

The build check is `bun run build`. The test check is `bun test src worker`, which must be green.

## Docs

The following files are updated to match: `DESIGN.md` for motion, death and succession; `PRODUCT.md` for the principles on reigns and preview; `README.md` for how to play; and `CLAUDE.md` for lease kinds, the removal of version constants and the client structure.

## Deviations

- The approved change of `GAME_AI_BUDGET` from 0.20 to 0.40 is withdrawn. It assumed GPT-5.6 prices. On 2026-09-23, two runs measured a 3-card batch on GPT-6 Luna with `low` reasoning at $0.0009–$0.0013 and 13.0–13.4 s.
- A 3-card batch takes 13 s, which is about 52% of the old 25 s timeout. A batch of 5 would exceed it, so the timeout rises to 40 s.
- The refill threshold rises from 3 to 5 cards. At a 4 s human pace, a threshold of 3 left waits of 2.0–7.1 s about every 6 cards, because a 5-card batch takes 13–20 s.
- The throw drops the card 60 px instead of raising it, to match the motion lab the user chose.
- The death card is built in `src/play/faces.tsx` together with the normal and succession faces, not in a separate `DeathCard.tsx`.
- The Durable Object migration is split into two tags and two deploys. Cloudflare rejected a combined create-and-delete migration in the 2026-09-22 reset.
- R2 needed no purge: it held 0 objects at deploy time.
