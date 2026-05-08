"use client";

import Link from "next/link";
import { mainNavLinks, authLinks } from "@/config/navigation";
import styles from "./MobileNav.module.css";

/**
 * MobileNav — Slide-down mobile navigation overlay.
 *
 * Renders below the header on small screens when the
 * hamburger menu is toggled open.
 */
interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileNav({ isOpen, onClose }: MobileNavProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className={styles.backdrop}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        className={`${styles.panel} ${isOpen ? styles.panelOpen : ""}`}
        aria-hidden={!isOpen}
      >
        <ul className={styles.links}>
          {mainNavLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={styles.link}
                onClick={onClose}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className={styles.divider} />

        <div className={styles.actions}>
          <Link
            href={authLinks.login.href}
            className={styles.loginBtn}
            onClick={onClose}
          >
            {authLinks.login.label}
          </Link>
          <Link
            href={authLinks.signup.href}
            className={styles.signupBtn}
            onClick={onClose}
          >
            {authLinks.signup.label}
          </Link>
        </div>
      </div>
    </>
  );
}
