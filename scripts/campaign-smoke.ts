import { strict as assert } from "node:assert";
import type { PublicGame } from "../src/game";
import type { CampaignMatch } from "../worker/campaigns";
const base = process.argv[2] ?? "http://127.0.0.1:5181";
const prompt =
  process.argv[3] ??
  "A republic of clockwork bees inside an abandoned observatory, 800 years after humans vanished.";
const reuseOnly = process.argv[4] === "--reuse-only";
let cookie = "";
async function request(path: string, body?: object, session = cookie) {
  const response = await fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Cookie: session,
      ...(body ? { "Content-Type": "application/json", Origin: base } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = response.headers.get("set-cookie");
  if (set && session === cookie) cookie = set.split(";")[0]!;
  const value = (await response.json()) as any;
  return { status: response.status, value };
}
await request("/api/health");
const id = crypto.randomUUID();
const started = Date.now();
let campaignId: string | undefined;
if (reuseOnly) {
  const existing = await request("/api/campaigns/match", { prompt });
  assert.equal(existing.status, 200);
  assert.ok(
    existing.value.matches?.length,
    "No ready campaign matched the reuse test",
  );
  campaignId = existing.value.matches[0].id;
}
let state = await request("/api/games", {
  id,
  prompt,
  ...(campaignId ? { campaignId } : {}),
});
assert.equal(state.status, 200, state.value.error);
await Bun.write(
  `artifacts/campaign-smoke-${new URL(base).hostname}.json`,
  JSON.stringify({ id, cookie }),
);
let last = -1;
while (!state.value.game || state.value.creation) {
  assert.ok(!state.value.error, state.value.error);
  assert.ok(
    Date.now() - started < 300000,
    "World generation exceeded five minutes; resume the saved test instead of recreating it.",
  );
  const done = state.value.creation?.done ?? 0;
  if (done !== last) {
    console.log(
      JSON.stringify({
        stage: state.value.creation?.stage,
        done,
        seconds: Math.round((Date.now() - started) / 1000),
      }),
    );
    last = done;
  }
  await Bun.sleep(2200);
  state = await request(`/api/games/${id}`);
  assert.equal(state.status, 200, state.value.error);
}
const world = state.value.game as PublicGame;
assert.equal(Object.keys(world.world.art ?? {}).length, 10);
assert.ok(world.card);
const art = await fetch(`${base}${world.world.art!.background}`);
assert.equal(art.status, 200);
assert.match(art.headers.get("content-type")!, /^image\/(webp|png|jpeg)$/);
assert.match(art.headers.get("cache-control")!, /immutable/);
const bytes = (await art.arrayBuffer()).byteLength;
assert.ok(bytes > 1000);
assert.equal(
  (
    await request(
      `/api/games/${id}`,
      undefined,
      `sr_session=${crypto.randomUUID()}`,
    )
  ).status,
  404,
);
const found = await request("/api/campaigns/match", { prompt });
assert.equal(found.status, 200);
const match = (found.value.matches as CampaignMatch[]).find(
  (m) => m.name === world.world.name,
);
assert.ok(
  match && match.similarity > 85,
  "Generated world should match its own description",
);
const cloneId = crypto.randomUUID();
const reused = await request("/api/games", {
  id: cloneId,
  prompt,
  campaignId: match.id,
});
assert.equal(reused.status, 200, reused.value.error);
assert.equal(reused.value.creation, null);
assert.deepEqual(reused.value.game.world.art, world.world.art);
assert.deepEqual(reused.value.game.reign.support, [50, 50, 50, 50]);
assert.equal(reused.value.game.totalTurns, 0);
assert.equal(reused.value.game.history.length, 0);
assert.notEqual(reused.value.game.card.id, world.card!.id);
const began = await request(`/api/games/${cloneId}/start`, {
  version: reused.value.game.version,
  requestId: crypto.randomUUID(),
});
assert.equal(began.status, 200);
const decision = {
  version: began.value.game.version,
  requestId: crypto.randomUUID(),
  cardId: began.value.game.card.id,
  side: 0,
};
const chose = await request(`/api/games/${cloneId}/choose`, decision);
assert.equal(chose.status, 200, chose.value.error);
assert.equal(chose.value.game.totalTurns, 1);
assert.equal(
  (await request(`/api/games/${cloneId}/choose`, decision)).value.game
    .totalTurns,
  1,
);
assert.equal((await request(`/api/games/${id}`)).value.game.totalTurns, 0);
await Bun.write(
  `artifacts/campaign-smoke-${new URL(base).hostname}.json`,
  JSON.stringify({ id, cloneId, cookie, game: world }),
);
console.log(
  JSON.stringify({
    passed: true,
    society: world.world.name,
    seconds: Math.round((Date.now() - started) / 1000),
    images: 10,
    backgroundBytes: bytes,
    similarity: match.similarity,
    checks: [
      reuseOnly ? "existing template" : "generation",
      "art persistence",
      "private save",
      "matching",
      "independent reuse",
      "decision idempotency",
    ],
  }),
);
