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
  title: "Jazee - ChatGPT with Memory",
  description: "Jazee - ChatGPT with Memory is a personalized AI chat app powered by jazee that remembers your preferences, facts, and memories.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
      <script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="c56e461d-0677-4ac1-b078-fd84a7a62526" data-blockingmode="auto" type="text/javascript"></script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}