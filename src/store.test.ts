import { test } from "node:test";
import assert from "node:assert/strict";
import { GameStore } from "./store.js";

test("create returns a new, independent game with a unique id", () => {
  const store = new GameStore();
  const a = store.create();
  const b = store.create();
  assert.notEqual(a.id, b.id);
  a.game.makeMove(0, 0);
  assert.equal(b.game.getMoveCount(), 0);
  assert.equal(store.get(a.id), a.game);
  assert.equal(store.size, 2);
});

test("get returns undefined for unknown ids", () => {
  assert.equal(new GameStore().get("missing"), undefined);
});

test("oldest game is evicted when the limit is exceeded", () => {
  const store = new GameStore(2);
  const first = store.create();
  const second = store.create();
  const third = store.create();
  assert.equal(store.size, 2);
  assert.equal(store.get(first.id), undefined);
  assert.ok(store.get(second.id));
  assert.ok(store.get(third.id));
});
