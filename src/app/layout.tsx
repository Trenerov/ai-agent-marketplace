import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { WalletProvider } from "@/context/WalletContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Agent Marketplace | OP_NET",
  description: "First AI Agent Marketplace on Bitcoin. Mint, trade, and monetize AI agents as NFTs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <WalletProvider>
          <Suspense fallback={<div className="sticky top-0 z-50 h-[73px] border-b border-white/10 bg-[rgba(10,10,15,0.82)] backdrop-blur-xl" />}>
            <Navbar />
          </Suspense>
          <main className="min-h-screen">{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
