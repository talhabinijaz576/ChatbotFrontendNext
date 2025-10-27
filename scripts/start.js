const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

// Path to your external config
const configPath = path.resolve(__dirname, "../../config/start.json");

// Read JSON and extract port
let port = 3000; // default fallback
try {
  console.log("configPath", configPath)
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  console.log("🚀 ~ config:", config)
  if (typeof config.port === "number") {
    port = config.port;
  } else {
    console.warn("⚠️ No valid 'port' in config/start.json, using default 3000");
  }
} catch (err) {
  console.log("🚀 ~ err:", err)
  console.warn("⚠️ Could not read config file, using default 3000");
}

console.log(`🚀 Starting Next.js on port ${port}`);

exec(`next dev -p ${port}`, (error, stdout, stderr) => {
  if (error) console.error(error);
  console.log(stdout);
  console.error(stderr);
});
