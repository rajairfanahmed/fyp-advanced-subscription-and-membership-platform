"use client";

/* global-error replaces the root layout, so next/link cannot be used here. */
/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#FCFCF9",
          fontFamily:
            "Manrope, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
          color: "#0f172a",
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 24px",
          }}
        >
          <div
            style={{
              maxWidth: 420,
              width: "100%",
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 24,
              padding: 32,
              textAlign: "center",
              boxShadow: "0 10px 40px rgba(15,23,42,0.06)",
            }}
          >
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 12px" }}>
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: "#475569",
                margin: "0 0 24px",
                fontWeight: 500,
              }}
            >
              An unexpected error occurred. You can try again or return home. If
              this keeps happening, contact support with what you were doing
              when it appeared.
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                justifyContent: "center",
              }}
            >
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  background: "#059669",
                  color: "#fff",
                  border: 0,
                  borderRadius: 16,
                  padding: "12px 20px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              <a
                href="/contact"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  border: "1px solid #e2e8f0",
                  borderRadius: 16,
                  padding: "12px 20px",
                  fontWeight: 700,
                  color: "#0f172a",
                  textDecoration: "none",
                }}
              >
                Contact support
              </a>
              <a
                href="/"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "12px 20px",
                  fontWeight: 700,
                  color: "#64748b",
                  textDecoration: "none",
                }}
              >
                Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
