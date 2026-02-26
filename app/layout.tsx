import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { loadExternalConfig } from "@/lib/config-loader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Generate metadata dynamically from config
export async function generateMetadata(): Promise<Metadata> {
  try {
    const config = loadExternalConfig();
    const title = config?.app?.title || "Prestitech - Vera A.I Chatbot";
    let icon = config?.app?.icon || "/avatar.svg";
    
    // Normalize the icon URL
    // If it's a relative path and doesn't start with /, add it
    // If it's a relative path starting with /, it's already correct for public folder
    // If it's an absolute URL (http/https), use it as-is
    if (icon && !icon.startsWith('http://') && !icon.startsWith('https://') && !icon.startsWith('/')) {
      icon = '/' + icon;
    }
    
    return {
      title,
      description: "Jazee - ChatGPT with Memory ...",
      themeColor: "#ffffff",
      icons: {
        icon: icon,
        apple: icon,
      },
      other: {
        "mask-icon": icon,
        "color": "#010a03", // Safari pinned tab color
      },
    };
  } catch (error) {
    // Fallback to default metadata if config fails to load
    console.error("Failed to load config for metadata:", error);
    return {
      title: "Prestitech - Vera A.I Chatbot",
      description: "Jazee - ChatGPT with Memory ...",
      themeColor: "#ffffff",
      icons: {
        icon: "/avatar.svg",
        apple: "/avatar.svg",
      },
      other: {
        "mask-icon": "/avatar.svg",
        "color": "#010a03",
      },
    };
  }
}


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
         {/* Cookiebot - Skip loading if ID contains "DISABLE" to prevent permission prompts */}
         {/* The ID contains "DISABLE" which indicates it should not be loaded */}
         {/* Uncomment and update the ID below if Cookiebot is needed */}
         {/* 
         <Script
           id="Cookiebot"
           src="https://consent.cookiebot.com/uc.js"
           data-cbid="DISABLE99d8218b-7b80-4667-afac-d4a918cc85e2"
           data-blockingmode="auto"
           type="text/javascript"
           strategy="lazyOnload"
         />
         */}
        {children}
      </body>
    </html>
  );
}