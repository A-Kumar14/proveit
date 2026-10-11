import type { Metadata } from "next";
import { Andika, Atkinson_Hyperlegible, Inter, Lexend } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { authEnabled } from "@proveit/server/auth";
import { a11yBootScript, SETTINGS_KEY } from "@proveit/lib/a11y";
import { AccessibilityLayer } from "./_components/a11y/AccessibilityLayer";
import "@fontsource/opendyslexic/400.css";
import "@fontsource/opendyslexic/700.css";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600"] });
// Reading fonts for the accessibility settings. Not preloaded: a browser only downloads the one a student picks.
const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin"], preload: false });
const atkinson = Atkinson_Hyperlegible({ variable: "--font-atkinson", subsets: ["latin"], weight: ["400", "700"], preload: false });
const andika = Andika({ variable: "--font-andika", subsets: ["latin"], weight: ["400", "700"], preload: false });

export const metadata: Metadata = {
  title: "Mastery",
  description: "Know what you actually know.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const page = (
    // The boot script sets accessibility attributes on <html> before hydration, so React must not flag them.
    <html lang="en" className={`${inter.variable} ${lexend.variable} ${atkinson.variable} ${andika.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: a11yBootScript(SETTINGS_KEY) }} />
      </head>
      <body className="h-screen overflow-hidden">
        <div className="a11y-app">{children}</div>
        <AccessibilityLayer />
      </body>
    </html>
  );
  return authEnabled() ? <ClerkProvider>{page}</ClerkProvider> : page;
}
