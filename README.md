# Swipe Republic

A browser game about governing a society you describe. Luna writes the world and its dilemmas; Jev judges how four factions react and finds similar societies; Muse paints their world. Your decisions, laws, and promises carry into the next reign.

Production: https://swiperepublic.deadpackets.pw

## Run locally

```sh
bun install --frozen-lockfile
cp .env.example .env
# Set OPENROUTER_API_KEY in .env.
bunx wrangler d1 migrations apply swipe-republic-campaigns --local
bun run dev
```

The Cloudflare Vite plugin runs the Worker and Durable Objects locally. The existing `.env` is ignored by Git. Never use a `VITE_` prefix for the API key.

## Deploy

```sh
bun run build
bunx wrangler secret put OPENROUTER_API_KEY
bunx wrangler d1 migrations apply swipe-republic-campaigns --remote
bunx wrangler deploy
```

Wrangler must be authenticated to the Cloudflare account containing `deadpackets.pw`. The custom domain and SQLite Durable Object migrations are defined in `wrangler.jsonc`. Vite generates the deploy configuration; rebuild before deploying code or configuration changes.

## Game rules

- Four setting-specific factions start with 50 support. Zero support ends a reign; high support is safe.
- Each action has stored reactions, so reloading cannot reroll a decision. Hover, keyboard focus, or arrow keys preview reaction direction. Tap a choice, swipe, or hold a left/right arrow for 700 ms to commit. Releasing early cancels. Every input plays the same full card swipe. A question mark indicates an uncertain judgment, which has a smaller maximum effect.
- Reigns continue until a faction or essential reserve reaches zero. Reserves drain by one each decision; Jev scores whether a choice spends, maintains or replenishes them. There are no aims, retirement requirements or fixed turn limits.
- Promises return after three to five decisions. Up to three laws or lasting effects, unfinished promises, and the cast survive succession. Succession has no fixed reign count; the AI allowance still applies.
- Saves are stored on the server and tied to an HttpOnly browser cookie. Local browser storage lists your societies. Initial session creation uses Web Locks to coordinate tabs and requires a current browser on HTTPS (or localhost). The guest cookie lasts 30 days. Clearing or losing the cookie loses access; download the chronicle to keep the story. There are no accounts or cross-device recovery in v1.

## AI and costs

Luna uses `~openai/gpt-luna-latest` through `ai` and `@openrouter/ai-sdk-provider`. Jev uses `jev-latest` through `@typesafe-ai/sdk` at `https://openrouter.ai/api`; OpenRouter maps it to `~typesafe/jev-latest` on the System One endpoint.

The opening card is generated before taking office and saved with the reusable template. Later cards are generated and scored in groups of three; the next group starts when fewer than two spare cards remain. Cards within a batch do not assume another card's choice. Recorded promises interrupt the deck when due. Narrative requests include plain-language editing rules adapted from Humanizer; there is no extra rewrite call. New dilemmas target 8–28 spoken words and choice labels 1–5 words. Older saved cards keep their original text. A measured three-card sample after simplification contained 23, 22 and 23 words and cost $0.001586 including Jev.

The initial three-card experiments cost $0.00183–$0.00191 per batch, including Jev, before the final prose prompt. They took about 12 seconds. These are measured samples, not a guarantee of latency or cost. Generation logs include model, elapsed time, and cost; game saves also accumulate costs. No player prompt or API key is deliberately logged.

There are no daily count limits on new societies or reused campaign starts.

Remaining limits:

| Limit | Default |
|---|---:|
| Global AI spend reservation per UTC day | $1.00 |
| AI allowance per society | $0.20 |
| Paid preparations per society | 100 |
| API requests per IP | 120 per minute |

Global and per-game spend are reserved before provider calls. Failed or interrupted calls retain a conservative reservation; successful calls settle against usage. No automatic model retry loops. Allowance errors preserve saves. These application limits use conservative reservations for the current model rates; set an OpenRouter key credit limit as a separate hard account-level cap. Model aliases and pricing can change.

### Shared societies and artwork

The player can describe any setting or inhabitants. The application retrieves D1 campaign candidates and asks Jev to score semantic similarity on a 0–100 rubric; this is separate from model confidence. Only scores strictly above 85 are offered, and reuse is optional. Catalogs of up to 64 entries are checked in full. Larger catalogs combine full-text candidates with recent templates before Jev scoring; this bounds cost but can miss a distant paraphrase. Missing a match never blocks original generation.

Luna generates the world name, people, institutions, resources and art descriptions. Muse uses OpenRouter's dedicated `/api/v1/images` endpoint and `meta/muse-image`. A test request returned WebP in 21.2 seconds at $0.01. New templates need one background image. Luna supplies 24 characters, relationships, faction palettes, icons and silhouettes as validated polygons rendered locally as SVG; portraits and icons incur no image calls. Individual completed assets survive retries. Only finished templates enter the shared catalog; private decisions, prompts and session credentials do not.

Cloning copies the starting world and prepared cards, gives cards new IDs, and resets support, history and commitments. It reuses immutable image URLs without calling Muse or Luna for the initial world. Later crises remain specific to each reign's decisions.

Cloudflare's $5 paid plan is the hosting baseline; OpenRouter charges separately. The app uses Worker Static Assets, D1, R2, one Society Durable Object per private save, and a daily budget object. Durable alarms run generation, avoiding the HTTP Worker’s 30-second post-response limit. D1 and R2 are bound in `wrangler.jsonc`; create equivalent resources and replace their identifiers when deploying to another account. No vector service, WebSocket, or additional model SDK is required.

## Check changes

```sh
bun test src worker
bun run build
```

Twenty tests cover hold controls, reserve survival, and survival, succession, atomic card promotion, commitments, private template cloning, matching boundaries, local-save retention, generation reservations, legacy recovery and partial image failures. The campaign smoke test uses real model calls and stores its private test session under ignored `artifacts/`. It checks generation, artwork, matching, ownership, independent reuse and repeated decisions.

```sh
bun scripts/campaign-smoke.ts http://127.0.0.1:5173
```

The initial design and implementation checklist are under `docs/superpowers/`. `docs/verification.md` records the initial release. `docs/polish-verification.md` records the earlier simplification. `docs/campaign-verification.md` records this redesign and live campaign checks. `docs/bug-hunt-polish.md` records the independent bug review.
