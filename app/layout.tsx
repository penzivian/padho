import type { Metadata } from "next";
import { Caveat, Fraunces } from "next/font/google";

import { AppNav } from "@/components/app-nav";

import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-serif"
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: "500",
  variable: "--font-script"
});

export const metadata: Metadata = {
  title: "Padho — coaching, simplified",
  description: "Teacher-first coaching management for tutors and small institutes"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${caveat.variable}`}>
        <AppNav />
        {children}
      </body>
    </html>
  );
}
