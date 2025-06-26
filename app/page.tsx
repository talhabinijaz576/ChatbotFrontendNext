"use client";

import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
// import { useRouter } from "next/router";
// import { useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

// const Assistant = dynamic(
//   () => import("./assistant").then((mod) => mod.Assistant),
//   { ssr: false }
// );

export default function HomePage() {
  redirect(`/chat/${uuidv4()}`);
}
