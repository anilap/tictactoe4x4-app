/**
 * 4x4 Tic-Tac-Toe, played one move at a time.
 *
 * Rules
 *  - X always moves first, then players alternate.
 *  - A player wins by owning all four cells of any of: a row (horizontal),
 *    a column (vertical), either main diagonal, the four corners, or any
 *    2x2 box (9 possible positions).
 *  - Win checking is skipped for moves 1-6 and starts on the 7th move
 *    (the earliest move on which anybody can own four cells).
 *  - The first winning move ends the game; no further moves are accepted.
 *    A full board with no winner is a draw and also accepts no more moves.
 */

export const SIZE = 4;
export const MIN_MOVES_BEFORE_WIN_CHECK = 7;

export type Player = "X" | "O";
export type CellValue = Player | null;
export type CellPos = readonly [row: number, col: number];

export enum WinType {
  Horizontal = "horizontal",
  Vertical = "vertical",
  Diagonal = "diagonal",
  Corners = "corners",
  Box = "2x2 box",
}

export interface Win {
  player: Player;
  type: WinType;
  cells: readonly CellPos[];
}

export interface GameState {
  /** "X", "O" or "" for empty. */
  board: string[][];
  /** Whose turn it is, or null once the game is over. */
  currentPlayer: Player | null;
  moveCount: number;
  winner: Player | null;
  winTypes: WinType[];
  /** Union of all cells that belong to a winning line. */
  winningCells: [number, number][];
  anyMovesLeft: boolean;
  isGameOver: boolean;
  status: "in_progress" | "won" | "draw";
}

/** Coordinates are not integers inside the board. */
export class InvalidMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMoveError";
  }
}

/** The move is well-formed but not allowed right now. */
export class RuleViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleViolationError";
  }
}

export class CellOccupiedError extends RuleViolationError {
  constructor(row: number, col: number) {
    super(`Cell (${row}, ${col}) is already taken`);
    this.name = "CellOccupiedError";
  }
}

export class GameOverError extends RuleViolationError {
  constructor() {
    super("The game is over; no further moves are allowed");
    this.name = "GameOverError";
  }
}

function buildLines(): { type: WinType; cells: readonly CellPos[] }[] {
  const lines: { type: WinType; cells: readonly CellPos[] }[] = [];
  const range = [...Array(SIZE).keys()];
  const last = SIZE - 1;

  for (const r of range) {
    lines.push({ type: WinType.Horizontal, cells: range.map((c) => [r, c] as const) });
  }
  for (const c of range) {
    lines.push({ type: WinType.Vertical, cells: range.map((r) => [r, c] as const) });
  }
  lines.push({ type: WinType.Diagonal, cells: range.map((i) => [i, i] as const) });
  lines.push({ type: WinType.Diagonal, cells: range.map((i) => [i, last - i] as const) });
  lines.push({
    type: WinType.Corners,
    cells: [[0, 0], [0, last], [last, 0], [last, last]],
  });
  for (let r = 0; r < SIZE - 1; r++) {
    for (let c = 0; c < SIZE - 1; c++) {
      lines.push({
        type: WinType.Box,
        cells: [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]],
      });
    }
  }
  return lines;
}

/** 4 rows + 4 columns + 2 diagonals + corners + 9 boxes = 20 lines. */
const WIN_LINES = buildLines();

const emptyGrid = (): CellValue[][] =>
  Array.from({ length: SIZE }, () => Array<CellValue>(SIZE).fill(null));

export class TicTacToe {
  private grid: CellValue[][] = emptyGrid();
  private moves = 0;
  private winningPlayer: Player | null = null;
  private wins: Win[] = [];

  /**
   * Place the current player's mark at (row, col) and pass the turn.
   * Throws GameOverError if the game has ended, InvalidMoveError for bad
   * coordinates and CellOccupiedError for a taken cell. A rejected move
   * changes nothing.
   */
  makeMove(row: number, col: number): GameState {
    if (this.isGameOver()) throw new GameOverError();

    const inRange = (n: number) => Number.isInteger(n) && n >= 0 && n < SIZE;
    if (!inRange(row) || !inRange(col)) {
      throw new InvalidMoveError(
        `Row and column must be integers from 0 to ${SIZE - 1}, got (${String(row)}, ${String(col)})`,
      );
    }
    if (this.grid[row][col] !== null) throw new CellOccupiedError(row, col);

    const player = this.moves % 2 === 0 ? "X" : "O";
    this.grid[row][col] = player;
    this.moves++;

    // No win is possible before a player owns four cells (move 7 at the earliest).
    if (this.moves >= MIN_MOVES_BEFORE_WIN_CHECK) this.evaluateWin(player);
    return this.getState();
  }

  /** Check whether `player`'s latest move completed any line; locks the game if so. */
  protected evaluateWin(player: Player): void {
    const wins = WIN_LINES.filter(({ cells }) =>
      cells.every(([r, c]) => this.grid[r][c] === player),
    ).map(({ type, cells }): Win => ({ player, type, cells }));
    if (wins.length > 0) {
      this.wins = wins;
      this.winningPlayer = player;
    }
  }

  /** The winner, or null if nobody has won (yet). */
  checkWinner(): Player | null {
    return this.winningPlayer;
  }

  /** True while the board is full. */
  isBoardFull(): boolean {
    return this.moves >= SIZE * SIZE;
  }

  /** True while further moves are accepted (no winner and an empty cell exists). */
  anyMovesLeft(): boolean {
    return this.winningPlayer === null && !this.isBoardFull();
  }

  /** The game ends on the first win, or when the board is full. */
  isGameOver(): boolean {
    return !this.anyMovesLeft();
  }

  /** Whose turn it is, or null when the game is over. */
  currentPlayer(): Player | null {
    if (this.isGameOver()) return null;
    return this.moves % 2 === 0 ? "X" : "O";
  }

  getMoveCount(): number {
    return this.moves;
  }

  /** A copy of the board: "X", "O" or "" per cell. */
  getBoard(): string[][] {
    return this.grid.map((row) => row.map((cell) => cell ?? ""));
  }

  /** Every winning line completed by the winning move (empty if none). */
  getWinningLines(): Win[] {
    return [...this.wins];
  }

  /** Start over with an empty board; X moves first. */
  reset(): void {
    this.grid = emptyGrid();
    this.moves = 0;
    this.winningPlayer = null;
    this.wins = [];
  }

  getState(): GameState {
    const winningCells = new Map<string, [number, number]>();
    for (const { cells } of this.wins) {
      for (const [r, c] of cells) winningCells.set(`${r},${c}`, [r, c]);
    }
    return {
      board: this.getBoard(),
      currentPlayer: this.currentPlayer(),
      moveCount: this.moves,
      winner: this.winningPlayer,
      winTypes: [...new Set(this.wins.map((w) => w.type))],
      winningCells: [...winningCells.values()],
      anyMovesLeft: this.anyMovesLeft(),
      isGameOver: this.isGameOver(),
      status: this.winningPlayer !== null ? "won" : this.isBoardFull() ? "draw" : "in_progress",
    };
  }
}
