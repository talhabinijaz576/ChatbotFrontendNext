import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Prestitech - Vera A.I Chatbot",
  description: "Jazee - ChatGPT with Memory ...",
  themeColor: "#ffffff",
  icons: {
    icon: "/avatar.svg",
    apple: "/avatar.svg",
  },
  other: {
    "mask-icon": "/avatar.svg",
    "color": "#010a03", // Safari pinned tab color
  },
};


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // const res = await fetch(`/api/config`);
  // const config = await res.json();
  // console.log("🚀 ~ RootLayout ~ config:", config)
  return (
    <html lang="en">
      <head>
      <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="4670ae65-a0e8-4bfd-9efa-b72b4da126fe" data-blockingmode="auto" type="text/javascript"></script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}