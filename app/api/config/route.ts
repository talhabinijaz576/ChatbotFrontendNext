// /pages/api/config.ts
import fs from "fs";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";

export async function GET(req: NextApiRequest, res: NextApiResponse) {
  const configPath = path.resolve(process.cwd(), "../config/config.json");
  const dest = path.resolve(process.cwd(), "../assistant-ui-mem0-starter/app/config/config.json");

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  
  fs.copyFileSync(configPath, dest);
  console.log("✅ Config copied to Next.js project.");
  // res.status(200).json(config);

  return new Response(JSON.stringify(config), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
