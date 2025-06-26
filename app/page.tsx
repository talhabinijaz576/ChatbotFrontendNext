"use client";

import dynamic from "next/dynamic";
import { redirect, useRouter } from "next/navigation";
import { useEffect } from "react";
// import { useRouter } from "next/router";
// import { useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

// const Assistant = dynamic(
//   () => import("./assistant").then((mod) => mod.Assistant),
//   { ssr: false }
// );

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const newId = uuidv4(); // Always new for each tab
    router.replace(`/chat/${newId}`);
  }, []);

  return <div>Redirecting...</div>;
}
