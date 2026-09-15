import { redirect } from "next/navigation";
import React from "react";

import { requireAdminContext } from "@/lib/auth/require-admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAdminContext();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Not signed in.") {
      redirect("/login?redirect_url=/admin");
    }
    redirect("/library");
  }

  return (
    <>
      {/*
        Hide the global MainNav and Footer rendered in root layout.
        Admin dashboard uses its own sidebar navigation via AdminShell/DashboardShell.
      */}
      <style>{`
        header.fixed:not([data-dashboard]) { display: none !important; }
        [data-site-footer] { display: none !important; }
      `}</style>
      {children}
    </>
  );
}
