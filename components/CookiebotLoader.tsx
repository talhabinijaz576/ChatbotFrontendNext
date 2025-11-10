"use client";

import Script from "next/script";

export default function CookiebotLoader({config}) {
  return (
    <Script
      id="cookiebot-script"
      src="https://consent.cookiebot.com/uc.js"
      data-cbid={config?.app?.dataCbid}
      data-blockingmode="manual"
      strategy="afterInteractive" // Load after hydration
      onLoad={() => {
        console.log("✅ Cookiebot loaded");
      }}
    />
  );
}
