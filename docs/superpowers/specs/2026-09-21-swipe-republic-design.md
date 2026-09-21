# Swipe Republic — design proposal

Status: brainstorm draft, not an approved implementation specification.
Date: 2026-09-21.

## Decisions first

**Product promise:** Describe a society. Take power. Make impossible choices. Live with what survives you.

The recommended game is a political story roguelite: brief reigns inside a persistent, player-defined society. The pleasure is recognizing a consequence: “The minister I protected has just betrayed me.” Survival creates tension; personal ambitions give decisions meaning; succession makes failure productive.

| Decision | Recommendation | Reason |
|---|---|---|
| Main mode | Successive rulers in one evolving society | Players become attached to the world, not just a score |
| Input | One plain-text description, followed by a compact interpretation | Gets players into the game and exposes incorrect assumptions |
| Controls | Two choices: swipe, buttons, or keyboard | Keeps every turn readable and accessible |
| AI responsibilities | Luna writes; Jev evaluates; code resolves | Preserves consistent rules and bounded costs |
| Complexity | Four faction meters; at most three visible active commitments | Provides depth without a management dashboard |

Alternatives: standalone survival runs are simpler and easier to compare, but lose attachment between reigns. Finite campaigns give stronger closure, but constrain the open-ended setting. Recommend succession first, with successful retirement providing a satisfying stopping point.

Assumptions awaiting user reaction: single-player; mobile first; guest play; succession; restrained political satire; 30–40 decisions for a successful reign. No subscription, multiplayer, or global leaderboard is needed for the first release. All timings, thresholds, token budgets, and difficulty values below are design targets, not measured performance.

## The first minute

1. Enter a setting, such as “Future 1 AE Mars colony.” Check: no account or configuration wizard is required.
2. Read a short world interpretation: role, era, four factions, central tension. Check: an ambiguous calendar such as “AE” is explicitly interpreted and can be corrected.
3. Choose one of two ambitions, such as “Become independent from Earth” or “Keep every habitat alive.” Check: each has visible completion conditions.
4. Face a concrete opening crisis. Check: both choices express actions, not vague yes/no responses.
5. Swipe and see a short consequence plus changed faction support. Check: the player can explain why at least one meter moved.

Target: the opening card is ready within 8 seconds at p95 after confirming the setting. Measure before committing to this target. During generation, reveal completed world details progressively, but never show a playable card before its outcomes are validated and persisted.

## World adaptation must change the rules of the story

Keep four internal faction roles: coercive force, public voice, productive labor, and shared belief. Their names, values, representatives, rivals, resources, and failure stories change with the setting. “Church” becomes the society's actual source of moral authority or shared belief; do not force a religion into every world.

| Role | Fictionalized Egypt, 2011 | Mars colony, 1 AE |
|---|---|---|
| Military | Armed forces | Habitat Security |
| Press | Independent media | Relay Network |
| Workers | Labor unions | Life-support crews |
| Church / belief | Religious institutions, modeled as a simplified coalition | Founding Charter Assembly |
| Scarcity | Bread, fuel, public funds | Oxygen, water, spare parts |
| Central question | Who controls the transition? | Who owns the means of survival? |

These are illustrative mappings, not historical assertions or fixed templates. The interpretation screen makes simplification visible. Historical settings become alternate history from the first decision; factual background should not be marketed as verified without a separate research feature.

Luna produces a compact world record: society, calendar and turn scale, player role, technology limits, four faction definitions, six named recurring characters, three scarce resources, opening conflict, and two ambitions. Each faction has two priorities and one red line. Resource quantities are used only where a specific commitment needs them; there is no hidden universal economy simulator.

The setting changes causal logic, not just nouns. An information blackout on Mars can interrupt engineering coordination. A blackout in another setting might limit organizing while intensifying distrust. Cards must use the world's established institutions and constraints.

Visual adaptation uses selected palettes, emblems, textures, and portrait parts from a controlled asset library. Fully bespoke illustration for every invented society is outside the first release. Text and game context adapt fully; visual variety has a declared asset limit.

## A turn that feels good

The main screen contains four faction symbols and meters, the date, one portrait card, two actions, and a compact commitment strip. The card has a speaker, a dilemma of at most 45 words, and action labels of at most 7 words each.

Dragging reveals the action and highlights affected factions with direction and rough magnitude. A dangerous choice has an explicit danger cue. Exact numeric changes appear after commitment. Buttons offer the same previews through focus or a first selection; keyboard and assistive technology expose equivalent information.

Commit animation target: 180–250 ms, followed by a one-line consequence. No typewriter effect blocks reading. No timer pressures a decision. Reduced-motion mode removes rotation and motion effects. Sound is optional and only starts after interaction.

The next card is prepared while the current card is being read. Start with two immediate successor candidates, one for each committed outcome; each is tied to its predicted state version. Keep only one step ahead, never a recursive tree. If generation is incomplete, retain the confirmed consequence and show a brief preparation state. Measure wasted generation before deciding whether to retain this optimization.

## Rules, risk, and fairness

The four meters represent faction support on a 0–100 scale. Start around 50, with limited variation defined by the opening scenario. A faction at 20 or below is visibly at risk; reaching 0 ends the reign with a faction-specific loss.

Do not punish a player simply because a support meter reaches 100. Political capture comes from explicit concessions: giving the generals emergency powers creates an obligation that can later become a coup. Favor has a price the player can understand.

Proposed ordinary reaction buckets are -12, -6, 0, +6, and +12. Major cards can use -20, -10, 0, +10, and +20, but must be labeled as major before commitment. These are balancing parameters to tune through playtests. Resolve all faction deltas simultaneously; if several hit zero, record all causes and select the ending by the lowest unclamped score, then fixed faction order on a tie.

Promises and consequences are structured records with a source decision, due turn, conditions, and an allowed effect. Only accepted choices schedule their branch's records. No more than three commitments are active at once. A fulfilled or failed commitment is consumed once; unresolved ones cannot be silently forgotten.

A fall on a displayed dangerous choice is valid. An unrelated generated catastrophe with no warning is not. The director does not secretly increase damage to force a dramatic ending. The player can win by completing the ambition and reaching a named transition milestone, then retire or continue at higher risk.

## Engagement through memory and variation

| Mechanic | Concrete moment | Purpose |
|---|---|---|
| Recurring characters | A reporter you spared publishes your scandal | Attachment and recognizable consequences |
| Promises | “You said the pumps would be repaired by Sol 12” | Anticipation across several turns |
| Temptations | Accept outside aid now; grant inspection rights later | Immediate relief with a visible future cost |
| Personal ambition | Save the colony without accepting Earth control | Gives the player a reason beyond survival |
| Legacy | Your successor inherits the emergency powers you created | Makes defeat open another story |

Use a director implemented in code to choose the next kind of card: introduction, tradeoff, callback, relief, or climax. Luna fills that brief. Targets: at least one callback within every five cards once history exists; no more than two severe crises in succession; one quieter human or absurd card within each six-card span. These are adjustable content rules, not guarantees of engagement.

Keep one main story arc and at most two smaller threads active. Difficulty grows through obligations and conflicting interests, not longer prose. Do not assign permanent faction stereotypes; a labor union can favor technical progress and oppose a particular unsafe project.

Humor comes from bureaucracy, personalities, and the player's contradictions. An oxygen-rationing minister who requests a larger ceremonial greenhouse is funnier than a stream of random disasters. Real suffering is not treated as the punchline.

## A worked example

Setting: “Future 1 AE Mars colony.” The following text and numbers are illustrative authored design examples, not model outputs.

> Chief engineer Samira Vale: “The nursery's oxygen reserve will last six sols. The private greenhouse can cover the deficit. Its owner also funds your security force.”

| Choice | Security | Relay | Crews | Charter |
|---|---:|---:|---:|---:|
| Requisition the greenhouse | -12 | +6 | +12 | +6 |
| Negotiate a supply contract | +6 | -6 | -6 | 0 |

Both options address the immediate oxygen problem. Requisition creates a property-rights dispute. The contract creates a payment commitment due in three turns. Before swiping, the player sees those tradeoffs in concise terms.

Three turns later, the contract owner may demand control of the colony's water meters. If the player requisitioned the greenhouse instead, a legal challenge can emerge. A branch only appears when its recorded conditions hold.

After a fall, the successor meets the same engineer. She remembers whether the nursery survived. This repeated recognition is the central retention hypothesis to test.

## Losing, winning, and returning

A reign ends with a portrait, title, tenure, achieved ambition milestones, and three causal decisions. An optional share image tells a story: “Saved the nursery. Sold the water. Exiled on Sol 38.” The player chooses whether to share it.

On succession, preserve up to three defining laws or scars, unresolved world-level consequences, and characters whose age and circumstances permit their return. Reset personal support to a viable range derived from the successor's coalition. Preserve long consequences without trapping every successor in immediate defeat.

Offer two successors with distinct starting coalitions and ambitions. Progress unlocks alternate starting situations, discovered endings, and cosmetic chronicles. Avoid permanent numeric boosts that make later runs automatically easier.

The first release tracks ambitions and a local chronicle. Later, a daily challenge can offer a compact, fixed scenario. Fair competition requires stored and versioned cards, outcomes, and rules; an LLM seed alone does not produce a reliable identical challenge. Freeform worlds should not share a global survival leaderboard.

## AI workflow and SDKs

System One guidance recommends narrow typed judgments, independent questions together, and deterministic control flow. Apply that directly: [TypeSafe's building guide](https://docs.typesafe.ai/concepts/how-to-build-with-system-one).

| Component | Input | Output and authority |
|---|---|---|
| Luna world generation | Player description and world schema | Proposed world record; code validates it |
| Luna card generation | World facts, relevant history, director brief | Proposed dilemma and two concrete actions |
| Jev evaluation | Card, faction priorities, relevant facts | Eight typed reaction judgments: two choices × four factions |
| Rules engine | Stored evaluations and selected action | Numeric changes, promises, time, victory or defeat |
| Luna chronicle | Confirmed event log | Optional summary; cannot change recorded events |

For Luna, use `ai` with `@openrouter/ai-sdk-provider`, model `~openai/gpt-luna-latest`, and schema-validated structured output. This provider is documented by [OpenRouter](https://openrouter.ai/docs/guides/community/vercel-ai-sdk).

For Jev, use `@typesafe-ai/sdk` with base URL `https://openrouter.ai/api` and the same server-side OpenRouter key. Its `systemOne` call uses `jev-latest`, which OpenRouter documents as mapping to `~typesafe/jev-latest`. It calls `/api/v1/systemone`, not the chat-completions endpoint. [OpenRouter TypeSafe integration](https://openrouter.ai/docs/guides/community/typesafe-sdk).

Each Jev question asks one faction's immediate support reaction to one action using five explicit categories: strongly oppose, oppose, neutral, support, strongly support. Criteria include the faction's priorities and red line. Map the chosen category to the card's fixed numeric bucket in code. Probability is confidence in the classification, not the amount of support gained.

If confidence is below a provisional 0.65 threshold, request a clearer card once and reevaluate. Tune that threshold on labeled examples; it is not an established accuracy guarantee. If validation still fails, use a previously validated, currently eligible reserve card or show a recoverable retry state. Never convert model failure into neutral outcomes that players can exploit.

Validate card lengths, distinct actions, referenced IDs, allowed effects, timeline, and branch conditions. Reject ordinary cards where one choice is strictly better on every modeled immediate and future dimension. Allow occasional beneficial relief cards deliberately. Freeze both outcomes before exposing the card; reloading never rerolls them.

The bounded context contains stable world facts, active commitments, relevant character facts, a compact history summary, and the last five decisions. The event log remains authoritative. Summaries cannot resurrect dead characters, erase laws, or mark an unchosen action as taken.

## Cloudflare architecture

Use a React + Vite + TypeScript client, Worker API, and one SQLite-backed Durable Object per society. The object stores its world, current ruler, support values, card outcomes, commitments, state version, and event log. Keeping those records together simplifies atomic turn resolution.

The browser sends the card ID, selected side, request ID, and expected state version. It never sends authoritative scores. A short transaction validates ownership and version, applies the stored outcome, appends the event, and returns the new state. Repeated request IDs return the original result; stale cards cannot apply twice.

Keep slow model calls in the Worker, outside Durable Object transactions. Reserve a generation job with a state version, perform the model calls, then commit only if the reservation is still current. Use an expiring lease to recover interrupted generation. Bound each run to one active generation job so repeated clicks cannot multiply API charges.

Guest access uses an opaque, secure, HttpOnly session credential. A public share token is distinct from the credential used to play. Render generated content as text. The world prompt is data, not permission to alter tools, scoring limits, or server instructions. Store the key in Cloudflare secrets; the existing local `.env` must be excluded from Git before implementation commits.

Use Worker Static Assets for the frontend. Do not add D1, KV, Queues, R2, vector search, or WebSockets until a specific feature needs them. A request-driven generation flow is sufficient initially; completed outcomes and resumable jobs survive disconnection.

Cloudflare's paid plan starts at $5/month and includes 10 million Worker requests and 30 million CPU milliseconds; static asset requests are free. Durable Objects have separate included allocations and duration/storage metering. Keeping provider waits outside them limits active duration. This architecture targets the base allowances at modest traffic, not a guaranteed $5 bill at every load. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

## Cost and latency gates

The live OpenRouter catalog lists Luna at $0.20 per million input tokens and $1.20 per million output tokens for the proposed short contexts. Jev was not present in the public catalog response inspected; its integration and alias are documented separately. Availability, SDK compatibility in Workers, pricing, and actual response shape need an authenticated smoke test. [OpenRouter model catalog](https://openrouter.ai/api/v1/models).

Illustrative Luna budget per candidate: 2,000 input + 350 output tokens = $0.00082. Forty generated candidates cost $0.0328; generating both next branches can approach $0.0656 per 40 played cards. At 10,000 such reigns that is about $328–$656 for Luna alone, excluding setup, retries, summaries, Jev, and any additional billed reasoning. This is arithmetic using assumed token counts, not a measured run cost.

Record per-call billed usage, latency, retries, and discarded branches. Set server-side session and global spend limits before public launch; reserve budget for in-flight jobs. When the limit is reached, save the game and pause generation. A Cloudflare CPU limit does not cap OpenRouter spending.

Performance targets: local swipe response below 100 ms, confirmed resolution below 700 ms p95, next card ready without a visible wait on at least 95% of turns at the measured reading cadence. These must be tested with both requested models from a deployed Worker before choosing between on-demand generation and two-branch prefetch.

## Visual direction

Recommend an archival card table: off-white paper, near-black type, one society-specific accent, restrained portrait silhouettes, and light tactile motion. The card is the dominant object; surrounding chrome stays quiet. The UI has a fixed structure even when the society changes.

Before implementation, compare three disposable single-file studies with fake data: archival paper, dark council chamber, and austere civic poster. Each shows the same opening card, drag preview, danger state, and succession screen. No production code changes during this comparison. The purpose is to expose visual preferences cheaply, not to build three games.

Accessibility acceptance: keyboard completion of a whole reign; screen-reader action labels and announced outcomes; touch targets at least 44 CSS pixels; no color-only warnings; readable long faction names; reduced-motion mode; resume after a failed network request.

## Build order and acceptance checks

1. Prove both model integrations in a Worker and create the three visual studies. Verify: real typed responses, recorded cost/latency, and a chosen visual direction.
2. Build a deterministic 12-card local game using authored fixtures. Verify: swipes, warnings, callbacks, retirement, defeat, reload, and duplicate requests behave consistently.
3. Add world generation and Jev scoring. Verify: Egypt, Mars, and one deliberately unusual setting produce distinct causal dilemmas and valid faction mappings.
4. Add persistent societies and succession. Verify: a promise returns on its scheduled turn and an accepted law survives the ruler.
5. Tune with playtests, then deploy. Verify: measured model spend, error recovery, mobile controls, and player understanding meet the launch targets.

First release: text-defined worlds, four factions, two choices, recurring cast, promises, one ambition per reign, succession, autosave, and an ending chronicle. Later: daily challenges, public chronicles, accounts, richer portraits, and additional scenario packs. Keep trading, multiplayer, a general crafting economy, and chat-with-every-character outside scope.

## What we need to learn

The first playtest should answer whether players remember their decisions and care about the consequences. Measure comprehension, not only clicks. Proposed initial sample: 10 players, each playing two reigns.

| Question | Proposed acceptance check |
|---|---|
| Does the world feel personal? | At least 8 of 10 identify a setting-specific dilemma |
| Do consequences feel fair? | At least 8 of 10 explain the cause of their ending |
| Is there attachment? | At least 7 of 10 recall a recurring character without prompting |
| Does failure invite another run? | At least 6 of 10 choose succession without a reward prompt |
| Is latency breaking the rhythm? | Observe waits and exits; compare with instrumented p95 timing |

These are product hypotheses and small-sample release checks, not statistically proven engagement claims. The most consequential open decision is succession versus independent runs. Visual tone, acceptable AI spend per reign, and the desired level of historical fidelity are the next unknowns to resolve.

## Deviations

No implementation or deployment was performed during this brainstorm. Succession is a provisional recommendation while the user's preference is pending. No authenticated model generation was performed; documentation and the public model catalog establish the proposed integration, not operational verification.
