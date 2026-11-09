import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { GameStore } from "./store.js";
import { InvalidMoveError, RuleViolationError, TicTacToe } from "./tictactoe.js";

const MAX_BODY_BYTES = 10_000;
const GAME_PATH = /^\/api\/games\/([A-Za-z0-9-]+)(\/moves)?$/;

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "Request body too large");
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

const view = (id: string, game: TicTacToe) => ({ id, ...game.getState() });

async function route(store: GameStore, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;

  // POST /api/games -> start a new game
  if (path === "/api/games") {
    if (req.method !== "POST") throw new HttpError(405, "Use POST");
    req.resume();
    const { id, game } = store.create();
    return sendJson(res, 201, view(id, game));
  }

  const match = GAME_PATH.exec(path);
  if (match) {
    const [, id, movesSuffix] = match;
    const game = store.get(id);
    if (!game) throw new HttpError(404, `Game ${id} not found`);

    // GET /api/games/:id -> current state
    if (!movesSuffix) {
      if (req.method !== "GET") throw new HttpError(405, "Use GET");
      return sendJson(res, 200, view(id, game));
    }

    // POST /api/games/:id/moves {row, col} -> make a move
    if (req.method !== "POST") throw new HttpError(405, "Use POST");
    const body = await readJson(req);
    if (typeof body !== "object" || body === null || !("row" in body) || !("col" in body)) {
      throw new HttpError(400, 'Request body must look like {"row": 0, "col": 0}');
    }
    const { row, col } = body as { row: unknown; col: unknown };
    game.makeMove(row as number, col as number);
    return sendJson(res, 200, view(id, game));
  }

  throw new HttpError(404, "Not found");
}

export function createApp(store: GameStore = new GameStore()): Server {
  return createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      await route(store, req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message });
      } else if (err instanceof InvalidMoveError) {
        sendJson(res, 400, { error: err.message });
      } else if (err instanceof RuleViolationError) {
        sendJson(res, 409, { error: err.message });
      } else {
        console.error(err);
        sendJson(res, 500, { error: "Internal server error" });
      }
    }
  });
}
