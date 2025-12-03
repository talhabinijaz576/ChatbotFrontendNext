import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";

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
  icons: {
    icon: "/avatar.svg",
    apple: "/avatar.svg",
  },
};


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
         <Script
          id="Cookiebot"
          src="https://consent.cookiebot.com/uc.js"
          data-cbid="4670ae65-a0e8-4bfd-9efa-b72b4da126fe"
          data-blockingmode="auto"
          strategy="afterInteractive"   // 👍 THIS FIXES THE SLOW LOAD
        />

        {children}
      </body>
    </html>
  );
}