"use client";
import React, { use } from "react";
import { useSearchParams } from "next/navigation";
import Widget from "@/app/widget";
const page = async () => {
  const searchParams = useSearchParams();
  console.log("🚀 ~ page ~ searchParams:", searchParams);
  const name = searchParams.get("name");

  // const response = await fetch("/api/config");
  // const data = await response.json();
  return <Widget params={searchParams} />;
};

export default page;