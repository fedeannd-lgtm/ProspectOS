import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
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
  title: "ProspectOS",
  description: "B2B prospecting platform",
};

const devBypass =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY === "pk_test_xxx"

const skipClerk = process.env.NEXT_PUBLIC_SKIP_CLERK === "true"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // TEMP: minimal layout to test if Vercel serves anything
  return (
    <html lang="en">
      <body>Darwin test OK - {String(skipClerk)}</body>
    </html>
  )
}
