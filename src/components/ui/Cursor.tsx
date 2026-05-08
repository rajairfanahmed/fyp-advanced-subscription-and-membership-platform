"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

/**
 * Path prefixes where the custom cursor should NOT mount. We scope it
 * to public marketing pages only — dashboards (`/admin`, `/creator`,
 * `/library`, `/billing`, `/account`, etc.) keep the native cursor so
 * forms, tables, and modals don't fight with the floating dot.
 */
const SUPPRESSED_CURSOR_PREFIXES = [
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
  "/maintenance",
];

function shouldSuppressCursor(pathname: string | null): boolean {
  if (!pathname) return false;
  return SUPPRESSED_CURSOR_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function Cursor() {
  const pathname = usePathname();
  const suppressed = shouldSuppressCursor(pathname);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPointer, setIsPointer] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (suppressed) {
      setIsVisible(false);
      return;
    }
    // Only show custom cursor on non-touch devices
    if (window.matchMedia("(pointer: coarse)").matches) return;
    // Respect the user's OS-level reduced-motion preference.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });

      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      const role = target.getAttribute("role");
      const isFormControl =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        tag === "option" ||
        target.isContentEditable ||
        role === "textbox" ||
        role === "combobox";

      if (isFormControl) {
        setIsVisible(false);
        return;
      }

      if (!isVisible) setIsVisible(true);

      setIsPointer(
        window.getComputedStyle(target).cursor === "pointer" ||
        tag === "a" ||
        tag === "button"
      );
    };

    const onMouseLeave = () => setIsVisible(false);
    const onMouseEnter = () => setIsVisible(true);

    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
    };
  }, [isVisible, suppressed]);

  if (suppressed || !isVisible) return null;

  return (
    <motion.div
      className="fixed top-0 left-0 w-8 h-8 rounded-full border border-emerald-500/50 pointer-events-none z-[9999] mix-blend-difference hidden md:flex items-center justify-center"
      animate={{
        x: position.x - 16,
        y: position.y - 16,
        scale: isPointer ? 1.5 : 1,
        backgroundColor: isPointer ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0)",
      }}
      transition={{
        type: "spring",
        stiffness: 150,
        damping: 15,
        mass: 0.5,
      }}
    >
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
    </motion.div>
  );
}
