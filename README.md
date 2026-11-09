# 4x4 Tic-Tac-Toe Server

A standalone Node.js + TypeScript HTTP server (no runtime dependencies) for a 4x4
Tic-Tac-Toe / Connect-Four style game.

## Rules

- Moves are made one at a time; **X always starts**, then players alternate.
- Win conditions: row (horizontal), column (vertical), diagonal, four corners, 2x2 box.
- The win check is skipped for moves 1-6 and **first runs on the 7th move**.
- The **first winning move ends the game**; further moves are rejected. A full board with no
  winner is a draw and also rejects moves.

## Requirements

- Node.js 20 or newer (developed on Node 22)
- npm

## Install

```bash
npm install
```

## Run the app

```bash
npm start                  # http://localhost:3000  (PORT=8080 npm start to change the port)
npm run dev                # same, but restarts on file changes
```

Production-style run:

```bash
npm run build              # compiles to dist/
npm run serve              # node dist/main.js
```

Try it:

```bash
curl -X POST localhost:3000/api/games                                   # note the "id"
curl -X POST localhost:3000/api/games/<id>/moves \
     -H 'Content-Type: application/json' -d '{"row":0,"col":0}'
curl localhost:3000/api/games/<id>
```

## Run the tests

```bash
npm test                   # all unit + API tests
npm run test:coverage      # same, with a coverage report; fails if lines, branches or
                           # functions fall below 80%
```

To run a single file: `npx tsx --test src/tictactoe.test.ts`

## API

| Method | Path                   | Body                         | Result                           |
|--------|------------------------|------------------------------|----------------------------------|
| POST   | `/api/games`           | –                            | `201` new game state (with `id`) |
| GET    | `/api/games/:id`       | –                            | current state                    |
| POST   | `/api/games/:id/moves` | `{"row": 0, "col": 0}` (0-3) | updated state                    |

Errors: `400` invalid coordinates or body, `404` unknown game, `409` cell taken or game over,
`413` body too large.

State example:

```json
{
  "id": "…", "board": [["X","",…],…], "currentPlayer": "O", "moveCount": 1,
  "winner": null, "winTypes": [], "winningCells": [],
  "anyMovesLeft": true, "isGameOver": false, "status": "in_progress"
}
```

## `TicTacToe` class (`src/tictactoe.ts`)

| Method | Returns |
|---|---|
| `makeMove(row, col)` | new `GameState`; throws `GameOverError`, `InvalidMoveError`, `CellOccupiedError` |
| `checkWinner()` | `"X"`, `"O"` or `null` |
| `anyMovesLeft()` | `true` while there is no winner and the board is not full |
| `isGameOver()` | `true` after a win or a full board |
| `currentPlayer()`, `getMoveCount()`, `getBoard()`, `getWinningLines()`, `getState()`, `reset()` | helpers |

## Project layout

```
src/tictactoe.ts   game logic
src/store.ts       in-memory game store (evicts oldest games past 1000)
src/app.ts         HTTP routes
src/main.ts        server entry point
src/*.test.ts      tests
```
