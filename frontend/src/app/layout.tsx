import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthGate } from "@/components/auth-gate";
import { SiteHeader } from "@/components/site-header";
import { Providers } from "./providers";

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Commons", template: "%s · Commons" },
  description: "Course work and discussion in Commons.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${hanken.variable} ${fraunces.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <a
            href="#main-content"
            className="sr-only fixed top-3 left-3 z-50 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground shadow-lg focus:not-sr-only"
          >
            Skip to main content
          </a>
          <SiteHeader />
          <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
            <AuthGate>{children}</AuthGate>
          </main>
        </Providers>
      </body>
    </html>
  );
}
