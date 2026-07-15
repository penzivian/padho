import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans, Spectral } from "next/font/google";

import { AppNav } from "@/components/app-nav";

import "./globals.css";

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-serif"
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans"
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: "Padho — coaching, simplified",
  description: "Teacher-first coaching management for tutors and small institutes"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${spectral.variable} ${publicSans.variable} ${plexMono.variable} font-sans`}>
        <AppNav />
        {children}
      </body>
    </html>
  );
}
