// server.js
import next from "next";
import http from "http";
import fs from "fs";
import path from "path";
const app = next({ dev: process.env.NODE_ENV !== "production" });
const handle = app.getRequestHandler();

// Use .sock on Linux, Named Pipe on Windows
const isWin = process.platform === "win32";
const socketPath = isWin
  ? `\\\\.\\pipe\\${process.env.APP_NAME || "nextapp"}`
  : path.join("/tmp", `${process.env.APP_NAME || "nextapp"}.sock`);

if (!isWin && fs.existsSync(socketPath)) {
  fs.unlinkSync(socketPath);
}

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    handle(req, res);
  });

  server.listen(socketPath, () => {
    console.log(`> ${process.env.APP_NAME} running on ${socketPath}`);
  });
});
