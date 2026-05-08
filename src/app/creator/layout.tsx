import React from "react";

export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* 
        Hide the global MainNav and Footer rendered in root layout.
        Creator dashboard uses its own sidebar navigation via CreatorShell/DashboardShell.
      */}
      <style>{`
        header.fixed:not([data-dashboard]) { display: none !important; }
        [data-site-footer] { display: none !important; }
      `}</style>
      {children}
    </>
  );
}
