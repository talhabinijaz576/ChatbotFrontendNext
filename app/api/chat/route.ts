// /pages/api/config.ts
import fs from "fs";
import path from "path";
import { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const configPath = path.resolve(process.cwd(), "../config/config.json"); // Make sure this path is correct
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);
    res.status(200).json(config);
  } catch (err: any) {
    console.error("API config load error:", err.message);
    res.status(500).json({ error: "Failed to load config." });
  }
}
