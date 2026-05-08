/**
 * AppShell — Reusable layout wrapper for all pages.
 *
 * Provides consistent vertical structure:
 * MainNav → page content → Footer
 */

import MainNav from "@/components/navigation/MainNav";
import Footer from "@/components/layout/Footer";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
      }}
    >
      <MainNav />

      <main style={{ flex: 1 }}>{children}</main>

      <Footer />
    </div>
  );
}
