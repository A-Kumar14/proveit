import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { authEnabled } from "@proveit/server/auth";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Mastery",
  description: "Know what you actually know.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const page = (
    <html lang="en" className={inter.variable}>
      <body className="h-screen overflow-hidden">{children}</body>
    </html>
  );
  return authEnabled() ? <ClerkProvider>{page}</ClerkProvider> : page;
}
