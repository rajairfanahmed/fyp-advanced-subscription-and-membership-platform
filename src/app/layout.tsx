import type { Metadata, Viewport } from "next";
import { Syne, Manrope } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import MainNav from "@/components/navigation/MainNav";
import Footer from "@/components/layout/Footer";
import { SmoothScroll } from "@/components/layout/SmoothScroll";
import { Cursor } from "@/components/ui/Cursor";
import { TopProgressBar } from "@/components/ui/TopProgressBar";
import { siteConfig } from "@/config/site";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.title,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.shortName,
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#FCFCF9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      telemetry={false}
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      experimental={{ client_debug_mode: false }}
      unsafe_disableDevelopmentModeConsoleWarning
    >
      <html lang="en" className={`${syne.variable} ${manrope.variable}`} suppressHydrationWarning>
        <body suppressHydrationWarning>
          <TopProgressBar />
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--color-ink)] focus:text-white focus:rounded-xl focus:font-bold focus:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
          >
            Skip to main content
          </a>
          <SmoothScroll>
            <Cursor />
            <MainNav />
            <main id="main-content" className="min-w-0 max-w-full overflow-x-clip">{children}</main>
            <Footer />
          </SmoothScroll>
        </body>
      </html>
    </ClerkProvider>
  );
}
