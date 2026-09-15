"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function isInternalNavigation(anchor: HTMLAnchorElement, event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }

  let next: URL;
  try {
    next = new URL(href, window.location.href);
  } catch {
    return false;
  }

  if (next.origin !== window.location.origin) return false;
  if (next.pathname === window.location.pathname && next.search === window.location.search) {
    return false;
  }

  return true;
}

function TopProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const [hiding, setHiding] = useState(false);

  const firstPaintRef = useRef(true);
  const trickleRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const safetyTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (trickleRef.current) {
      window.clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (safetyTimerRef.current) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    if (trickleRef.current) {
      window.clearInterval(trickleRef.current);
      trickleRef.current = null;
    }
    if (safetyTimerRef.current) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    setActive(true);
    setHiding(false);
    setWidth(100);
    hideTimerRef.current = window.setTimeout(() => {
      setHiding(true);
      hideTimerRef.current = window.setTimeout(() => {
        setActive(false);
        setHiding(false);
        setWidth(0);
        hideTimerRef.current = null;
      }, 200);
    }, 160);
  }, []);

  const start = useCallback(() => {
    clearTimers();
    setHiding(false);
    setActive(true);
    setWidth(14);
    trickleRef.current = window.setInterval(() => {
      setWidth((current) => {
        if (current >= 86) return current;
        return current + Math.max(0.5, (86 - current) * 0.07);
      });
    }, 180);
    safetyTimerRef.current = window.setTimeout(finish, 10000);
  }, [clearTimers, finish]);

  useEffect(() => {
    if (firstPaintRef.current) {
      firstPaintRef.current = false;
      return;
    }
    finish();
  }, [routeKey, finish]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || !isInternalNavigation(anchor, event)) return;
      start();
    };

    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [start]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  if (!active && width === 0) return null;

  return (
    <div
      role="progressbar"
      aria-hidden="true"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      className="fixed top-0 left-0 right-0 z-[200] pointer-events-none h-[2.5px]"
      style={{
        opacity: hiding ? 0 : 1,
        transition: "opacity 180ms ease",
      }}
    >
      <div
        className="h-full bg-[var(--color-emerald)] shadow-[0_0_10px_var(--color-emerald)]"
        style={{
          width: `${width}%`,
          transition: "width 180ms var(--ease-premium, ease-out)",
        }}
      />
    </div>
  );
}

export function TopProgressBar() {
  return (
    <Suspense fallback={null}>
      <TopProgressBarInner />
    </Suspense>
  );
}
