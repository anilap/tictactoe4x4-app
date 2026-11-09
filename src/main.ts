import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
createApp().listen(port, () => {
  console.log(`4x4 Tic-Tac-Toe server listening on http://localhost:${port}`);
});
