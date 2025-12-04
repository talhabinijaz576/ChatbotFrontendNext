import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export function middleware(req: Request) {
  const url = new URL(req.url);

  // Redirect root instantly
  if (url.pathname === "/") {
    url.pathname = `/chat/${uuidv4()}`;
    return NextResponse.redirect(url);
  }

  // Redirect /widget to /widget/chat
  if (url.pathname === "/widget") {
    url.pathname = "/widget/chat";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
