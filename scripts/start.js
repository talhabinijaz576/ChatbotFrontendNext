const fs = require("fs");
const { exec } = require("child_process");

const configPath = "../config/config.json";

// Default to port if not specified
let port = 3000;
let socket = null;

try {
  const raw = fs.readFileSync(configPath, "utf8");
  console.log("🚀 ~ raw:", raw)
  const config = JSON.parse(raw);
  console.log("🚀 ~ config:", config)

  if (config.socket) {
    socket = config.socket;
  } else if (config.port && !isNaN(config.port)) {
    port = config.port;
  } else {
    console.warn("⚠️ No valid socket or port found in config, using default 3000");
  }
} catch (err) {
  console.log("🚀 ~ err:", err)
  console.warn("⚠️ Could not read config file, using default 3000");
}

if (socket) {
  // Remove existing socket file (if any)
  try {
    fs.unlinkSync(socket);
  } catch (e) {}

  console.log(`🚀 Starting Next.js using socket: ${socket}\n`);

  // Run Next.js bound to a Unix socket using `--socket`
  // Note: Supported on Next.js 13.4+ (Node 18+)
  const command = `next dev --socket ${socket}`;
  const child = exec(command);

  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
} else {
  console.log(`🚀 Starting Next.js on port ${port}...\n`);
  const command = `next dev -p ${port}`
  const child = exec(command);

  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
}

