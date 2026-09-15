"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

const NATIVE_SCROLL_PREFIXES = [
  "/admin",
  "/creator",
  "/account",
  "/billing",
  "/subscription",
  "/notifications",
  "/library",
  "/sign-in",
  "/sign-up",
  "/login",
  "/verify-email",
  "/reset-password",
  "/forgot-password",
  "/maintenance",
];

function usesNativeScroll(pathname: string | null) {
  if (!pathname) return false;
  return NATIVE_SCROLL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const native = usesNativeScroll(pathname);

  useEffect(() => {
    if (native) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    let frame = 0;
    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [native]);

  return <>{children}</>;
}
