# Verified bug report — 21 September 2026

Scope: the game engine, React client, local save index and Worker budget/session flow. Three isolated reviewers worked as Hunter, Skeptic and Referee. The Referee reviewed the fixes again after implementation. The later visual simplification keeps those fixes.

## Stats

- Hunter candidates: 11. Skeptic accepted: 11. Referee confirmed: 10; dismissed: 1.
- Confirmed severity: 0 critical, 5 medium, 5 low.
- Confirmed findings resolved: 10. Unresolved confirmed findings: 0.
- Regression suite: 7 tests, 30 assertions, 0 failures.

## Confirmed defects and fixes

| ID | Severity | Location | Before | After / evidence |
|---|---|---|---|---|
| 1 | Medium | src/storage.ts; src/App.tsx | A stale tab could overwrite another society in the shared index | Independent per-society keys and storage-event synchronization; retention test |
| 2 | Medium | src/storage.ts | Saving society 31 silently removed the oldest selector | No metadata cap; test retains 37 records across legacy and independent entries |
| 3 | Medium | worker/index.ts | A due promise required $0.015 despite reserving $0.002 | Callback admission uses $0.002; tested with $0.01 remaining |
| 4 | Medium | worker/index.ts | Repeated completion could charge one generation twice | Bounded settled-token list; duplicate, zero-cost and failed-persistence retries tested |
| 5 | Medium | src/App.tsx | Concurrent first visits could replace the ownership cookie | Web Locks serializes session initialization across tabs; browsers without Web Locks receive an explicit error |
| 7 | Low | src/App.tsx | Delayed development StrictMode resume could display an older version | Reject lower-version responses for the current society |
| 8 | Low | src/game.ts | History could show +12 when support only increased by 2 | Record actual clamped differences; regression test |
| 9 | Low | src/game.ts | A completed ambition still recorded another increment | Record whether progress actually increased; regression test |
| 10 | Low | src/DecisionCard.tsx | Major cards lacked a visible classification | Visible Major crisis or Promise due label |
| 11 | Low | worker/index.ts | Resuming the last prepared card did not restart missing prefetch | Resume schedules one guarded background preparation |

The follow-up review found a persistence-retry edge case in the initial token fix. The final implementation re-persists an already-settled completion on retry and also settles zero-cost tokens. Both paths have regression coverage.

## Evidence limits

Items 2, 4 and 7 carried medium confidence in the baseline report. The retention cap and duplicate charging were reproduced locally. A deployed post-commit RPC response loss was not injected. The obsolete-response race is confirmed for development StrictMode, not claimed as a measured production incident. Cookie initialization was source-reviewed; its narrow live interleaving was not forced. There are no remaining low-confidence findings classified as confirmed bugs.

<details>
<summary>Dismissed finding: BUG-6</summary>

A manually replaced local-storage value with valid JSON but the wrong shape could cause a later operation to fail. No supported old schema or application-generated path produced that value. The Referee dismissed it as an unproven normal-use defect. The new persistence boundary nevertheless validates records while reading legacy and per-society metadata.

</details>

## Reproduce regression checks

```sh
bun test
bun run build
```

The original reviewer reports and exploratory reproductions remain in ignored local `artifacts/`. Committed tests cover supported behavior without calling paid providers.
