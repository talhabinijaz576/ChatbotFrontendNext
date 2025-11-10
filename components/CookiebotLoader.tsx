"use client";

import Script from "next/script";

export default function CookiebotLoader({ config }) {
  return (
    <Script
      id="cookiebot-script"
      src="https://consent.cookiebot.com/uc.js"
      data-cbid={config?.app?.dataCbid}
      data-blockingmode="auto"  // ✅ use 'auto' so Cookiebot manages the banner
      strategy="afterInteractive"
      onLoad={() => {
        console.log("✅ Cookiebot script loaded");
      }}
    />
  );
}
