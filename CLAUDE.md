# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
bun install --frozen-lockfile
bunx wrangler d1 migrations apply swipe-republic-campaigns --local   # once, before first dev run
bun run dev                      # Vite + Cloudflare plugin (Worker, DOs, D1, R2 all run locally)
bun test src worker              # unit tests (bun:test); plain `bun test` also picks up throwaway tests under git-ignored artifacts/
bun test src/game.test.ts -t "succession"   # one file / one test by name
bun run build                    # tsc --noEmit + vite build; this is the type check
bun run deploy                   # build + wrangler deploy
bun run types                    # regenerate worker-configuration.d.ts after wrangler.jsonc changes
```

`.env` holds `OPENROUTER_API_KEY` (copy `.env.example`). Wrangler reads it (or `.dev.vars`) for local dev; never give it a `VITE_` prefix. Production uses `wrangler secret put OPENROUTER_API_KEY`.

Scripts under `scripts/` spend real OpenRouter credit. `bun scripts/campaign-smoke.ts http://127.0.0.1:5173` runs an end-to-end campaign against a running server and writes session state under the git-ignored `artifacts/`. `bun scripts/smoke.ts <url> play 30` then plays that save's turns and logs waits and deaths. `experiment.ts` and `chapter-experiment.ts` call the AI functions directly for prompt tuning.

## Architecture

Single Cloudflare Worker serving a React SPA (`dist/client`) and a JSON API under `/api/*`. No framework on either side.

**Client/server boundary.** `src/` is the browser bundle; `worker/` is server-only. The client imports only `type`s from `worker/` and from `src/game.ts`; zod schemas and AI SDKs must stay out of the client bundle. `src/game.ts` is shared: it owns the zod schemas, the `Game`/`World`/`Card` types, and the pure rules (`freshGame`, `play`, `abandon`, `nextDraft`, `publicGame`). All state mutation is server-side; the client only renders `PublicGame` and posts actions. `publicGame` replaces signed reaction deltas with `{ size, uncertain }` so the direction of a choice cannot be read from the network; `history` keeps signed deltas after the fact.

**Durable Objects (`worker/index.ts`).**
- `Dynasty`: one per private save, keyed by game UUID. Holds the `Save` (game, prompt, owner cookie, lease, spent, attempts). Every AI job runs through a **lease** (`acquire` → `allocated` → `finish`) with kinds `world | cards | callback | art`, driven by DO alarms so generation continues after the HTTP request returns. The deck is refilled in batches of 5 when fewer than 5 cards remain (`DECK_TARGET`). `requests[]` dedupes client mutations by `requestId`; `version` guards multi-tab conflicts.
- `Ledger`: one per UTC day (`getByName(YYYY-MM-DD)`), a reserve/settle ledger against `DAILY_AI_BUDGET`. Per-save spend is capped by `GAME_AI_BUDGET` and 100 attempts. Reservations are made before a model call and settled to reported cost; failed calls keep their reservation.
- The DO `migrations` array in `wrangler.jsonc` is history; each production reset adds a migration that creates new class names and deletes the old ones. Never reuse a deleted class name.

**Game rules.** A faction at 0 (`collapse`) or 100 (`excess`) ends the reign; `play()` records an `Ending` with that faction's generated death text and sets `card` to a `Succession` (no AI call). Playing it seats a new ruler (backer 65, rival 40, others 50); year, deck, promises and history carry over. Only `abandon` sets `phase: "over"`.

**Generation flow for a new society.** `POST /api/games` → `initialize` sets `foundation` → alarm loop: `generateWorld` (Luna) → `generateArt` for one background (Muse, stored in R2 under the template ID, served via `/api/art/<id>`) → first `generateCards` → `publishCampaign` writes the world + opening cards to D1 (`campaigns` + FTS5 `campaign_search`) as a reusable template. `POST /api/campaigns/match` runs `candidates` (FTS) then `matchCampaigns` (Jev similarity, only scores > 85 offered). Reusing a template calls `cloneCampaign` and skips generation.

**Cards are pre-scored.** `generateCards` produces drafts, then `scoreCards` (Jev via `@typesafe-ai/sdk`) attaches per-faction `reactions` for both sides before the card is shown. `play()` in `src/game.ts` just applies stored numbers. Promise callbacks (`commitmentId`) interrupt the deck via `nextDraft` and are scored with the cheap `callback` lease.

**Models (`worker/ai.ts`, `worker/art.ts`).** Luna (`~openai/gpt-luna-latest`, AI SDK + OpenRouter provider) writes prose, casts, and SVG path data. Jev (`jev-latest`, TypeSafe SDK) scores. Muse (`meta/muse-image`) paints one background per template. Each call returns `{ value, cost }`; cost comes from OpenRouter usage metadata.

**No compatibility layer.** There are no version constants or upgrade paths. When the world or card shape changes, production is wiped (new DO classes, D1 tables dropped and remigrated, R2 emptied).

**Graphics.** Faction symbols and portraits are validated SVG paths (`vectorShapeSchema`, absolute M/L/H/V/C/Q/Z, coords 0–100) rendered locally by `src/WorldGraphic.tsx` / `src/Portrait.tsx`. Only the background is a raster image.

**Client.** `src/useGame.ts` owns the session, API calls, polling and mutations. `src/App.tsx` picks a screen (`src/screens/`: Welcome → Founding → Arrival → Play → Chronicle) inside `LazyMotion`/`MotionConfig`/`AnimatePresence` from `motion`; use `m.*` components, never `motion.*` (strict mode). `src/screens/Play.tsx` sequences a choice: throw the card, post the choice, then either deal the next card or run the death beat (mourning → client-only death card → succession card). `src/play/DecisionCard.tsx` owns drag, throw and deal; tap, drag and held arrows (`useArrowHold`, 700 ms) all go through it. Every duration and spring lives in `src/motion.ts`; imperative animations must check `useReduced()`. `src/feedback.ts` holds haptics and the synthesized sounds. `src/storage.ts` keeps saved-game pointers in localStorage; the save itself lives in the DO behind an HttpOnly `sr_session` cookie.

## Conventions

- DESIGN.md and PRODUCT.md are the visual and product spec; check them before changing UI, copy, motion, or game rules. Keep the card and two choices central; extra detail goes behind Menu.
- Client-facing error strings from the Worker are whitelisted by regex in the `fetch` catch block; new user-visible errors must match that pattern or they become the generic message.
- Tests mock `cloudflare:workers` with `mock.module` (see `worker/budget.test.ts`) and exercise the DO class directly with a fake `ctx`. Shared fixtures live in `src/testWorld.ts`.
- `docs/` holds dated plans and verification reports for past releases, not current instructions.
