import React from "react";

interface PageShellProps {
  children: React.ReactNode;
  role: "Public" | "Auth" | "Subscriber" | "Creator" | "Admin";
  title: string;
}

export function PageShell({ children, role, title }: PageShellProps) {
  return (
    <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)] flex flex-col font-sans">
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-glass)] backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-display font-bold text-xl tracking-tight">Nexora</span>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-emerald)] text-white uppercase tracking-wider">
            {role}
          </span>
        </div>
        <h1 className="text-sm font-medium text-[var(--color-muted)] hidden sm:block">{title}</h1>
      </header>
      <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto p-6 md:p-10">
        {children}
      </main>
    </div>
  );
}
