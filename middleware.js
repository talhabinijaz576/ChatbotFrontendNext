import { NextResponse } from "next/server";

export function middleware(req) {
  console.log(`[REQUEST] ${req.method} ${req.nextUrl.pathname}`);
  return NextResponse.next();
}
