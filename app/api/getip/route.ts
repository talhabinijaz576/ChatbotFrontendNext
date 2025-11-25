import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch("https://api.ipify.org?format=json");
  const data = await res.json();
  console.log("🚀 ~ GET ~ data:", data)

  return NextResponse.json(data);
}


