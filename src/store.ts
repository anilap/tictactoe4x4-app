import { randomUUID } from "node:crypto";
import { TicTacToe } from "./tictactoe.js";

/** In-memory game store. Oldest games are evicted once `maxGames` is exceeded. */
export class GameStore {
  private readonly games = new Map<string, TicTacToe>();

  constructor(private readonly maxGames = 1000) {}

  create(): { id: string; game: TicTacToe } {
    const id = randomUUID();
    const game = new TicTacToe();
    this.games.set(id, game);
    if (this.games.size > this.maxGames) {
      const oldest = this.games.keys().next().value as string;
      this.games.delete(oldest);
    }
    return { id, game };
  }

  get(id: string): TicTacToe | undefined {
    return this.games.get(id);
  }

  get size(): number {
    return this.games.size;
  }
}
