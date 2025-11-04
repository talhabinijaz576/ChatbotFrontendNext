"use client";

import Script from "next/script";

export default function CookiebotLoader() {
  return (
    <Script
      id="cookiebot-script"
      src="https://consent.cookiebot.com/uc.js"
      data-cbid="c56e461d-0677-4ac1-b078-fd84a7a62526"
      data-blockingmode="auto"
      strategy="afterInteractive" // Load after hydration
      onLoad={() => {
        console.log("✅ Cookiebot loaded");
      }}
    />
  );
}
