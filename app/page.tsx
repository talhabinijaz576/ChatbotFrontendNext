"use client"
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const newId = uuidv4();
    const params = new URLSearchParams(searchParams);
    const queryString = params.toString();

    router.replace(`/chat/${newId}${queryString ? `?${queryString}` : ""}`);
  }, [searchParams, router]);

  return <div>Redirecting...</div>;
}