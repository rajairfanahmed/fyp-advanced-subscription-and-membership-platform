import React from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
