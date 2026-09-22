import { strict as assert } from "node:assert";
const base = process.argv[2] ?? "http://127.0.0.1:5173";
const file = `artifacts/smoke-${new URL(base).hostname}.json`;
const mode = process.argv[3] ?? "create";
let saved: any = (await Bun.file(file).exists())
  ? await Bun.file(file).json()
  : { id: crypto.randomUUID(), cookie: "", game: null };
async function request(path: string, body?: object, cookie = saved.cookie) {
  const res = await fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json", Origin: base } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get("set-cookie");
  if (set && cookie === saved.cookie) saved.cookie = set.split(";")[0];
  const value: any = await res.json();
  return { status: res.status, value };
}
async function persist() {
  await Bun.write(file, JSON.stringify(saved));
}
if (mode === "create") {
  await request("/api/health");
  await persist();
  const t = Date.now();
  let r = await request("/api/games", {
    id: saved.id,
    prompt:
      "Arab Spring 2011 Egypt. A fictional caretaker council; grounded political drama.",
  });
  assert.equal(r.status, 200);
  while (!r.value.game || r.value.creation) {
    assert.ok(!r.value.error, r.value.error);
    assert.ok(
      Date.now() - t < 300000,
      "Preparation deadline; resume the saved society.",
    );
    await Bun.sleep(2200);
    r = await request(`/api/games/${saved.id}`);
    assert.equal(r.status, 200, r.value.error);
  }
  assert.ok(r.value.game, r.value.error);
  saved.game = r.value.game;
  await persist();
  console.log(
    JSON.stringify({
      created: saved.game.world.name,
      ms: Date.now() - t,
      factions: saved.game.world.factions.map((f: any) => f.name),
    }),
  );
} else if (mode === "start") {
  const r = await request(`/api/games/${saved.id}/start`, {
    requestId: crypto.randomUUID(),
    version: saved.game.version,
  });
  assert.equal(r.status, 200);
  saved.game = r.value.game;
  await persist();
} else if (mode === "security") {
  const unauth = await request(
    `/api/games/${saved.id}`,
    undefined,
    "sr_session=12345678-1234-4123-8123-123456789abc",
  );
  assert.equal(unauth.status, 404);
  const invalid = await request(`/api/games/${saved.id}/choose`, {
    requestId: crypto.randomUUID(),
    version: saved.game.version,
    cardId: crypto.randomUUID(),
    side: 8,
  });
  assert.notEqual(invalid.status, 200);
  const csrf = await fetch(`${base}/api/games/${saved.id}/prepare`, {
    method: "POST",
    headers: {
      Cookie: saved.cookie,
      Origin: "https://evil.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(csrf.status, 403);
  console.log("Ownership, invalid input, cross-origin mutation: PASS");
} else if (mode === "play") {
  const turns = Number(process.argv[4] ?? 6);
  for (let i = 0; i < turns; i++) {
    let state = (await request(`/api/games/${saved.id}`)).value;
    const started = Date.now();
    while (!state.game?.card && state.game?.phase !== "over") {
      assert.ok(!state.error, state.error);
      assert.ok(Date.now() - started < 90000, "Preparation deadline");
      if (state.busy) {
        await Bun.sleep(1200);
        state = (await request(`/api/games/${saved.id}`)).value;
      } else
        state = (await request(`/api/games/${saved.id}/prepare`, {})).value;
    }
    saved.game = state.game;
    if (state.game.phase === "over") break;
    const g = state.game;
    const side = g.card.kind === "succession" ? 0 : i % 2;
    const body = {
      cardId: g.card.id,
      side,
      version: g.version,
      requestId: crypto.randomUUID(),
    };
    const r = await request(`/api/games/${saved.id}/choose`, body);
    assert.equal(r.status, 200, JSON.stringify(r.value));
    const duplicate = await request(`/api/games/${saved.id}/choose`, body);
    assert.equal(duplicate.value.game.totalTurns, r.value.game.totalTurns);
    saved.game = r.value.game;
    await persist();
    console.log(
      JSON.stringify({
        turn: saved.game.totalTurns,
        title: g.card.title ?? "Succession",
        callback: !!g.card.commitmentId,
        waitMs: Date.now() - started,
        support: saved.game.reign.support,
      }),
    );
    if (saved.game.endings.length > g.endings.length)
      console.log(JSON.stringify({ death: saved.game.endings.at(-1) }));
  }

}
