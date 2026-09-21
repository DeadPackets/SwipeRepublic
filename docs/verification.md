# Release verification

Checked on 2026-09-21. Cloudflare deployment: `c9b04748-167c-43d4-90e7-8c0a463dd860`. These are development checks and small live samples, not player-retention or load-test results.

## Implementation

React/Vite frontend and Cloudflare Worker API are deployed to `swiperepublic.deadpackets.pw`. The same deployment is available at `swipe-republic.b00073615.workers.dev`. The browser sends choices to a server-owned game state. Luna writes worlds and cards; Jev scores the two choices against four faction priorities. Neither model controls game rules or directly changes stored support.

The release includes freeform settings, adapted factions/resources/cast, illustrated portraits, two ambitions, faction previews, simultaneous consequences, delayed promises, persistent laws, retirement, defeat, succession, five-reign campaigns, saved societies, and a downloadable chronicle. Mouse, keyboard and touch inputs use the same decision endpoint.

## Checks

| Check | Result |
|---|---|
| `bun test` | 4 passed; 18 assertions |
| `bun run build` | TypeScript and production build passed |
| Client credential scan | OpenRouter key absent from all client build files |
| Local campaign | 24 decisions, several promise callbacks, earned retirement, succession, two further decisions |
| Production campaign | World creation, start, six decisions, promise callback, duplicate requests |
| Access controls | Foreign session returned 404; invalid side rejected; foreign Origin returned 403; oversized body returned 413 locally |
| Browser interactions | Button preview/confirm, arrows/Enter, drag gesture, saved-state reload, chronicle dialog and Escape passed |
| Mobile layout | Inspected at 390 × 844; document width and scroll width both 390 |
| Browser console | No captured errors after final local interaction checks |
| Domain | Public DNS resolves; custom-domain HTTPS returns 200 with valid certificate using an explicit resolved address |

The local operating-system resolver still returned a cached name-resolution failure for the custom domain during release checks. Game interaction QA used localhost; the published desktop welcome screen was also inspected on workers.dev; production API QA used the workers.dev hostname. The custom-domain request used curl's `--resolve` with the public DNS answer, without disabling certificate verification. Ordinary custom-domain browser navigation has not been verified from this machine.

An independent backend review found two defects: denied budget requests consumed lifetime generation attempts, and inherited promises could advance a different ambition. Both were fixed and checked again. A regression test covers the inherited ambition case. A controlled denial experiment confirmed that 120 denied reservations consumed zero paid attempts.

## Measured AI samples

| Operation | Elapsed | Model cost |
|---|---:|---:|
| Three-card generation plus Jev, early prompt | About 12 seconds | $0.00183–$0.00191 |
| World generation, final short-name instructions | 6.8 seconds | $0.000990 |
| Production world creation, earlier prompt | 10.2 seconds | Recorded by server usage logs |
| Production six-decision smoke run | Cached decisions about 1.2 seconds; generation waits 9.5–13.3 seconds | Recorded by server usage logs |

API smoke timings include network round trips, duplicate-request verification and polling. They are not swipe animation timings. The samples are too small to claim a percentile or a stable average. Initial generation and exhausted decks still require visible waiting.

Humanizer guidance is included in the narrative system prompt. It asks for direct speech, concrete requests, natural sentence lengths and specific political costs, and rejects stock metaphors, inflated significance and mannered conclusions. Editing happens in the generation call. New faction-name instructions fixed malformed long labels in a repeated Egypt experiment. Generated prose is still model output and can vary.

## Deviations from the proposal

- Short independent batches replace a generated tree of both future branches. This avoids spending on discarded branches. Confirmed history and unresolved cards are passed into subsequent generations.
- Low-confidence judgments get capped effects. No automatic regeneration loop spends more money searching for a desired judgment.
- Setting-specific resources appear in dilemmas; the four faction meters are the numerical system. No second resource simulation was added.
- Portraits use bundled SVG variants and a small palette set. There are no image-generation calls or audio in this release.
- Progression uses ambitions, laws and succession within each saved society. Cross-device accounts, public leaderboards and shared competitive seeds remain outside v1.

The app defaults to a $1 daily global AI reservation limit, $0.20 per society, bounded world creation and preparation quotas, and no automatic provider retries. Cloudflare hosting and OpenRouter usage are separate charges. A provider-side credit limit is the independent account-level cap.
