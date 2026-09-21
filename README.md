# Swipe Republic

A browser game about governing a society you describe. Luna writes the world and its dilemmas; Jev judges how four factions react. Your decisions, laws, and promises carry into the next reign.

Production: https://swiperepublic.deadpackets.pw

## Run locally

```sh
bun install --frozen-lockfile
cp .env.example .env
# Set OPENROUTER_API_KEY in .env.
bun run dev
```

The Cloudflare Vite plugin runs the Worker and Durable Objects locally. The existing `.env` is ignored by Git. Never use a `VITE_` prefix for the API key.

## Deploy

```sh
bun run build
bunx wrangler secret put OPENROUTER_API_KEY
bunx wrangler deploy
```

Wrangler must be authenticated to the Cloudflare account containing `deadpackets.pw`. The custom domain and SQLite Durable Object migrations are defined in `wrangler.jsonc`. Vite generates the deploy configuration; rebuild before deploying code or configuration changes.

## Game rules

- Four setting-specific factions start with 50 support. Zero support ends a reign; high support is safe.
- Each action has stored reactions, so reloading cannot reroll a decision. Arrows preview the direction and scale. A question mark indicates an uncertain judgment, which has a smaller maximum effect.
- Six actions toward your ambition and 24 decisions permit retirement. Every term ends at decision 36.
- Promises return after three to five decisions. Up to three laws or lasting effects, unfinished promises, and the cast survive succession. Each society supports five reigns.
- Saves are stored on the server and tied to an HttpOnly browser cookie. Local browser storage lists your societies. The guest cookie lasts 30 days. Clearing or losing the cookie loses access; download the chronicle to keep the story. There are no accounts or cross-device recovery in v1.

## AI and costs

Luna uses `~openai/gpt-luna-latest` through `ai` and `@openrouter/ai-sdk-provider`. Jev uses `jev-latest` through `@typesafe-ai/sdk` at `https://openrouter.ai/api`; OpenRouter maps it to `~typesafe/jev-latest` on the System One endpoint.

The opening card is generated alone. Later cards are generated and scored in groups of three; the next group starts while the last available card is being read. Cards within a batch do not assume another card's choice. Recorded promises interrupt the deck when due. Narrative requests include plain-language editing rules adapted from Humanizer; there is no extra rewrite call.

The initial three-card experiments cost $0.00183–$0.00191 per batch, including Jev, before the final prose prompt. They took about 12 seconds. These are measured samples, not a guarantee of latency or cost. Generation logs include model, elapsed time, and cost; game saves also accumulate costs. No player prompt or API key is deliberately logged.

Default limits in `wrangler.jsonc`:

| Limit | Default |
|---|---:|
| Global AI spend reservation per UTC day | $1.00 |
| AI allowance per society | $0.20 |
| World generation attempts per IP per UTC day | 4 |
| New societies per UTC day | 100 globally, 4 per IP |
| Paid preparations per IP per UTC day | 180 |
| Paid preparations per society | 100 |
| API requests per IP | 120 per minute |

Global spend is reserved before provider calls. Failed or interrupted calls retain a conservative reservation; successful calls settle against usage. No automatic model retry loops. Allowance errors preserve saves. These application limits use conservative reservations for the current model rates; set an OpenRouter key credit limit as a separate hard account-level cap. Model aliases and pricing can change.

Cloudflare's $5 paid plan is the hosting baseline. OpenRouter charges separately. The app uses Worker Static Assets, one Durable Object per society, and a daily budget object. Model calls run outside Durable Objects to avoid paying object duration while waiting for AI. No database service, queue, WebSocket, image generation, or vector store is required.

## Check changes

```sh
bun test
bun run build
```

Four focused engine tests cover progression, callback consumption, stale choices, collapse, retirement, term limits, and inherited ambition. `scripts/smoke.ts` exercises the real HTTP API, including duplicate requests and access checks. It creates real model calls and stores its private test session under ignored `artifacts/`.

```sh
bun scripts/smoke.ts http://127.0.0.1:5173 create
bun scripts/smoke.ts http://127.0.0.1:5173 start
bun scripts/smoke.ts http://127.0.0.1:5173 security
bun scripts/smoke.ts http://127.0.0.1:5173 play 6
```

The initial design and implementation checklist are under `docs/superpowers/`. `docs/verification.md` records release evidence and design changes.
