import { createServer } from "http";
import { parse } from "url";
import next from "next";
import fs from "fs";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Allow both SOCKET_PATH and PORT
const socketPath = process.env.SOCKET_PATH;
const port = process.env.PORT || 3000;

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  if (socketPath) {
    // remove old socket if it exists
    if (fs.existsSync(socketPath)) {
      fs.unlinkSync(socketPath);
    }

    server.listen(socketPath, () => {
      fs.chmodSync(socketPath, "777");
      console.log(`✅ Server running on socket: ${socketPath}`);
    });
  } else {
    server.listen(port, (err) => {
      if (err) throw err;
      console.log(`🚀 Server running on http://localhost:${port}`);
    });
  }
});
