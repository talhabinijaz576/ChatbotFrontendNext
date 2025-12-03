import fs from "fs";
import "dotenv/config";

export async function GET() {
  const configPath = process.env.CONFIG_PATH;
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));


  return new Response(JSON.stringify(config), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
