import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CellOccupiedError,
  GameOverError,
  InvalidMoveError,
  MIN_MOVES_BEFORE_WIN_CHECK,
  Player,
  SIZE,
  TicTacToe,
  WinType,
} from "./tictactoe.js";

type Move = [number, number];

const play = (game: TicTacToe, moves: Move[]) => moves.forEach(([r, c]) => game.makeMove(r, c));

/** X and O alternate (X first): xs[0], os[0], xs[1], os[1], ... */
function interleave(game: TicTacToe, xs: Move[], os: Move[]): void {
  xs.forEach((x, i) => {
    game.makeMove(...x);
    if (os[i]) game.makeMove(...os[i]);
  });
}

/** Counts how often the win check runs. */
class SpyGame extends TicTacToe {
  calls: Player[] = [];
  protected override evaluateWin(player: Player): void {
    this.calls.push(player);
    super.evaluateWin(player);
  }
}

// ---------------------------------------------------------------- basics

test("new game: X to move, no winner, moves left, not over", () => {
  const g = new TicTacToe();
  assert.equal(g.checkWinner(), null);
  assert.equal(g.anyMovesLeft(), true);
  assert.equal(g.isGameOver(), false);
  assert.equal(g.currentPlayer(), "X");
  assert.equal(g.getMoveCount(), 0);
  assert.deepEqual(g.getWinningLines(), []);
  assert.deepEqual(g.getBoard(), Array.from({ length: SIZE }, () => ["", "", "", ""]));
});

test("turns alternate, X first", () => {
  const g = new TicTacToe();
  g.makeMove(0, 0);
  assert.equal(g.currentPlayer(), "O");
  g.makeMove(0, 1);
  assert.equal(g.currentPlayer(), "X");
  g.makeMove(1, 0);
  assert.deepEqual(g.getBoard()[0], ["X", "O", "", ""]);
  assert.deepEqual(g.getBoard()[1], ["X", "", "", ""]);
  assert.equal(g.getMoveCount(), 3);
});

test("makeMove returns the new state", () => {
  const state = new TicTacToe().makeMove(2, 3);
  assert.equal(state.board[2][3], "X");
  assert.equal(state.currentPlayer, "O");
  assert.equal(state.moveCount, 1);
  assert.equal(state.status, "in_progress");
});

test("getBoard returns a copy", () => {
  const g = new TicTacToe();
  g.makeMove(0, 0);
  g.getBoard()[0][0] = "O";
  assert.equal(g.getBoard()[0][0], "X");
});

// ----------------------------------------------- win check starts on move 7

test("win check is skipped for moves 1-6 and runs from move 7", () => {
  assert.equal(MIN_MOVES_BEFORE_WIN_CHECK, 7);
  const g = new SpyGame();
  const moves: Move[] = [
    [0, 0], [0, 1], [1, 2], [0, 3], [2, 0], [3, 3], // moves 1-6
    [3, 1], [2, 2], // moves 7 (X) and 8 (O)
  ];
  play(g, moves.slice(0, 6));
  assert.deepEqual(g.calls, []);
  g.makeMove(...moves[6]);
  assert.deepEqual(g.calls, ["X"]);
  g.makeMove(...moves[7]);
  assert.deepEqual(g.calls, ["X", "O"]);
  assert.equal(g.checkWinner(), null);
  assert.equal(g.isGameOver(), false);
});

test("a win on the 7th move is detected", () => {
  const g = new TicTacToe();
  interleave(g, [[0, 0], [0, 1], [0, 2], [0, 3]], [[1, 0], [1, 1], [1, 2]]);
  assert.equal(g.getMoveCount(), 7);
  assert.equal(g.checkWinner(), "X");
});

test("O's earliest possible win is the 8th move", () => {
  const g = new SpyGame();
  play(g, [
    [0, 1], [0, 0], [1, 1], [1, 0], [2, 1], [2, 0], [0, 2], // moves 1-7, no winner
  ]);
  assert.equal(g.checkWinner(), null);
  g.makeMove(3, 0); // move 8: O completes column 0
  assert.equal(g.checkWinner(), "O");
  assert.deepEqual(g.getState().winTypes, [WinType.Vertical]);
  assert.equal(g.getMoveCount(), 8);
});

// ------------------------------------------------------------- win types

const O_FILLER: Move[] = [[1, 1], [1, 2], [2, 1]];

function assertXWinsWith(xs: Move[], os: Move[], expected: WinType[]): void {
  const g = new TicTacToe();
  interleave(g, xs, os);
  assert.equal(g.checkWinner(), "X");
  assert.deepEqual(g.getState().winTypes, expected);
}

test("horizontal win", () => {
  assertXWinsWith([[2, 0], [2, 1], [2, 2], [2, 3]], [[0, 0], [0, 1], [0, 2]], [WinType.Horizontal]);
});

test("vertical win", () => {
  assertXWinsWith([[0, 2], [1, 2], [2, 2], [3, 2]], [[0, 0], [1, 0], [2, 0]], [WinType.Vertical]);
});

test("diagonal win (main)", () => {
  assertXWinsWith([[0, 0], [1, 1], [2, 2], [3, 3]], [[0, 1], [0, 2], [0, 3]], [WinType.Diagonal]);
});

test("diagonal win (anti)", () => {
  assertXWinsWith([[0, 3], [1, 2], [2, 1], [3, 0]], [[0, 0], [0, 1], [0, 2]], [WinType.Diagonal]);
});

test("four corners win", () => {
  assertXWinsWith([[0, 0], [0, 3], [3, 0], [3, 3]], O_FILLER, [WinType.Corners]);
});

test("2x2 box win at every position", () => {
  for (let r = 0; r < SIZE - 1; r++) {
    for (let c = 0; c < SIZE - 1; c++) {
      const box: Move[] = [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]];
      const taken = new Set(box.map(([a, b]) => `${a},${b}`));
      const filler: Move[] = [];
      for (let a = 0; a < SIZE && filler.length < 3; a++) {
        for (let b = 0; b < SIZE && filler.length < 3; b++) {
          if (!taken.has(`${a},${b}`)) filler.push([a, b]);
        }
      }
      assertXWinsWith(box, filler, [WinType.Box]);
    }
  }
});

test("one move can complete several lines; all are reported", () => {
  const g = new TicTacToe();
  interleave(
    g,
    [[0, 0], [0, 1], [0, 2], [3, 0], [3, 3], [0, 3]],
    [[1, 0], [1, 1], [1, 3], [2, 0], [2, 3]],
  );
  assert.equal(g.getMoveCount(), 11);
  assert.equal(g.checkWinner(), "X");
  const state = g.getState();
  assert.deepEqual(new Set(state.winTypes), new Set([WinType.Horizontal, WinType.Corners]));
  assert.equal(g.getWinningLines().length, 2);
  assert.deepEqual(
    new Set(state.winningCells.map(([r, c]) => `${r},${c}`)),
    new Set(["0,0", "0,1", "0,2", "0,3", "3,0", "3,3"]),
  );
});

test("three in a row is not a win", () => {
  const g = new TicTacToe();
  interleave(g, [[0, 0], [0, 1], [0, 2], [2, 3]], [[1, 0], [1, 1], [1, 3]]);
  assert.equal(g.checkWinner(), null);
});

// ---------------------------------------------- game over locks further input

test("first win ends the game and blocks further moves", () => {
  const g = new TicTacToe();
  interleave(g, [[0, 0], [0, 1], [0, 2], [0, 3]], [[1, 0], [1, 1], [1, 2]]);
  const before = g.getState();

  assert.equal(g.isGameOver(), true);
  assert.equal(g.anyMovesLeft(), false); // empty cells remain, but no input is allowed
  assert.equal(g.currentPlayer(), null);
  assert.equal(before.status, "won");
  assert.equal(before.winner, "X");

  assert.throws(() => g.makeMove(3, 3), GameOverError);
  assert.throws(() => g.makeMove(9, 9), GameOverError); // game over takes precedence
  assert.deepEqual(g.getState(), before);
});

const DRAW_X: Move[] = [[0, 0], [0, 2], [1, 0], [1, 2], [2, 1], [2, 3], [3, 1], [3, 3]];
const DRAW_O: Move[] = [[0, 1], [0, 3], [1, 1], [1, 3], [2, 0], [2, 2], [3, 0], [3, 2]];

test("full board without a winner is a draw", () => {
  const g = new TicTacToe();
  interleave(g, DRAW_X, DRAW_O);
  assert.equal(g.getMoveCount(), 16);
  assert.equal(g.checkWinner(), null);
  assert.equal(g.isBoardFull(), true);
  assert.equal(g.anyMovesLeft(), false);
  assert.equal(g.isGameOver(), true);
  assert.equal(g.getState().status, "draw");
  assert.throws(() => g.makeMove(0, 0), GameOverError);
});

// -------------------------------------------------------------- bad input

test("invalid coordinates are rejected without changing the game", () => {
  const g = new TicTacToe();
  const bad: [unknown, unknown][] = [
    [-1, 0], [0, -1], [4, 0], [0, 4], [1.5, 0], [0, 0.5],
    [NaN, 0], [Infinity, 0], ["1", 0], [0, null], [undefined, 0],
  ];
  for (const [r, c] of bad) {
    assert.throws(() => g.makeMove(r as number, c as number), InvalidMoveError, `(${String(r)}, ${String(c)})`);
  }
  assert.equal(g.getMoveCount(), 0);
  assert.equal(g.currentPlayer(), "X");
});

test("occupied cell is rejected and the turn does not advance", () => {
  const g = new TicTacToe();
  g.makeMove(1, 1);
  assert.throws(() => g.makeMove(1, 1), CellOccupiedError);
  assert.equal(g.getMoveCount(), 1);
  assert.equal(g.currentPlayer(), "O");
  assert.equal(g.getBoard()[1][1], "X");
});

// ------------------------------------------------------------------ reset

test("reset starts a fresh game after a win", () => {
  const g = new TicTacToe();
  interleave(g, [[0, 0], [0, 1], [0, 2], [0, 3]], [[1, 0], [1, 1], [1, 2]]);
  assert.equal(g.isGameOver(), true);

  g.reset();
  assert.equal(g.checkWinner(), null);
  assert.equal(g.isGameOver(), false);
  assert.equal(g.getMoveCount(), 0);
  assert.deepEqual(g.getWinningLines(), []);
  assert.equal(g.makeMove(0, 0).board[0][0], "X");
});
