import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";

let server: Server;
let base: string;

before(async () => {
  server = createApp();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const post = (path: string, body?: unknown, raw?: string) =>
  fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });

async function newGame(): Promise<string> {
  const res = await post("/api/games");
  assert.equal(res.status, 201);
  return (await res.json()).id;
}

const move = (id: string, row: unknown, col: unknown) => post(`/api/games/${id}/moves`, { row, col });

test("POST /api/games creates a game with X to move", async () => {
  const res = await post("/api/games");
  assert.equal(res.status, 201);
  const game = await res.json();
  assert.match(game.id, /^[0-9a-f-]{36}$/);
  assert.equal(game.currentPlayer, "X");
  assert.equal(game.status, "in_progress");
  assert.equal(game.moveCount, 0);
});

test("moves alternate and GET returns the current state", async () => {
  const id = await newGame();
  assert.equal((await (await move(id, 0, 0)).json()).currentPlayer, "O");
  const state = await (await move(id, 0, 1)).json();
  assert.deepEqual(state.board[0], ["X", "O", "", ""]);

  const got = await fetch(`${base}/api/games/${id}`);
  assert.equal(got.status, 200);
  assert.deepEqual(await got.json(), state);
});

test("the first winning move ends the game; later moves get 409", async () => {
  const id = await newGame();
  const sequence = [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]];
  for (const [r, c] of sequence) assert.equal((await move(id, r, c)).status, 200);

  const res = await move(id, 0, 3); // 7th move wins
  assert.equal(res.status, 200);
  const state = await res.json();
  assert.equal(state.winner, "X");
  assert.deepEqual(state.winTypes, ["horizontal"]);
  assert.equal(state.isGameOver, true);
  assert.equal(state.currentPlayer, null);

  const after = await move(id, 3, 3);
  assert.equal(after.status, 409);
  assert.match((await after.json()).error, /game is over/);
});

test("occupied cell returns 409", async () => {
  const id = await newGame();
  await move(id, 2, 2);
  assert.equal((await move(id, 2, 2)).status, 409);
});

test("invalid coordinates return 400", async () => {
  const id = await newGame();
  assert.equal((await move(id, 4, 0)).status, 400);
  assert.equal((await move(id, "a", 0)).status, 400);
  assert.equal((await move(id, 1.5, 0)).status, 400);
});

test("malformed requests", async () => {
  const id = await newGame();
  assert.equal((await post(`/api/games/${id}/moves`, undefined, "{not json")).status, 400);
  assert.equal((await post(`/api/games/${id}/moves`, { row: 1 })).status, 400);
  assert.equal((await post(`/api/games/${id}/moves`, "text")).status, 400);
  assert.equal((await post(`/api/games/${id}/moves`, null)).status, 400);
});

test("oversized bodies are rejected", async () => {
  const id = await newGame();
  const res = await post(`/api/games/${id}/moves`, undefined, JSON.stringify({ row: "x".repeat(20_000) }));
  assert.equal(res.status, 413);
});

test("unknown game and unknown route return 404", async () => {
  assert.equal((await fetch(`${base}/api/games/does-not-exist`)).status, 404);
  assert.equal((await move("does-not-exist", 0, 0)).status, 404);
  assert.equal((await fetch(`${base}/nope`)).status, 404);
});

test("wrong HTTP methods return 405", async () => {
  const id = await newGame();
  assert.equal((await fetch(`${base}/api/games`)).status, 405);
  assert.equal((await post(`/api/games/${id}`)).status, 405);
  assert.equal((await fetch(`${base}/api/games/${id}/moves`)).status, 405);
});

test("OPTIONS preflight returns 204 with CORS headers", async () => {
  const res = await fetch(`${base}/api/games`, { method: "OPTIONS" });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
});
