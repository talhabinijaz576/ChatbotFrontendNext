import path from "path";
import fs from "fs";

// /my-next-app/lib/config-loader.ts
export function loadExternalConfig() {
  const configPath = path.resolve(process.cwd(), "../config/config.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  console.log("🚀 ~ loadExternalConfig ~ raw:", raw)
  return JSON.parse(raw);
}
