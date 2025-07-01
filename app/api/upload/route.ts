import { writeFile } from "fs/promises";
import path from "path";
import { mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const blob = formData.get("file");

    if (!blob || typeof blob === "string") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await blob.arrayBuffer());

    const id = randomUUID();
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    const filePath = path.join(uploadsDir, id);

    // Ensure uploads directory exists
    await mkdir(uploadsDir, { recursive: true });

    await writeFile(filePath, buffer);

    return NextResponse.json({
      id,
      url: `/uploads/${id}`, // This URL will work publicly
    });
  } catch (err) {
    console.error("Upload Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
