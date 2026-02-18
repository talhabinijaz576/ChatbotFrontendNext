export const dynamic = "force-dynamic"; 

import React from "react";
import Widget from "@/app/widget";
import { loadExternalConfig } from "@/lib/config-loader";

export default async function ChatPage() {
  // Load config on server side - no API call needed
  const config = loadExternalConfig();

  return <Widget initialConfig={config} />;
}
