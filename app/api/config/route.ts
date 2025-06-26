// /pages/api/config.ts
import fs from "fs";
import path from "path";
import "dotenv/config"; // add at top of config.ts
import type { NextApiRequest, NextApiResponse } from "next";

export async function GET(req: NextApiRequest, res: NextApiResponse) {
  const configPath = process.env.CONFIG_PATH
  // : path.resolve(process.cwd(), "../config/config.json");

  // const dest = path.resolve(process.cwd(), "../assistant-ui-mem0-starter/app/config/config.json");

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  console.log("🚀 ~ GET ~ config:", config)
  
  // fs.copyFileSync(configPath, dest);
  // res.status(200).json(config);

  return new Response(JSON.stringify(config), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
