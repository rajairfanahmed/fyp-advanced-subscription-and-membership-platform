"use client";

import { motion, Variants } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MotionRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  duration?: number;
  staggerChildren?: number;
  /** Skip scroll-driven animation (use on auth/forms so content is always visible and interactive). */
  instant?: boolean;
}

export function MotionReveal({
  children,
  className,
  delay = 0,
  y = 40,
  duration = 0.6,
  staggerChildren,
  instant = false,
}: MotionRevealProps) {
  if (instant) {
    const instantContainer: Variants = {
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          when: "beforeChildren",
          staggerChildren: staggerChildren ?? 0,
        },
      },
    };
    return (
      <motion.div
        className={cn(className)}
        variants={instantContainer}
        initial="visible"
        animate="visible"
      >
        {children}
      </motion.div>
    );
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0, y },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration,
        delay,
        ease: [0.16, 1, 0.3, 1],
        when: "beforeChildren",
        ...(staggerChildren ? { staggerChildren } : {}),
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "50px" }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({
  children,
  className,
  y = 20,
  delay,
  id,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  delay?: number;
  id?: string;
}) {
  const itemVariants: Variants = {
    hidden: { opacity: 0, y },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <motion.div id={id} variants={itemVariants} className={cn(className)}>
      {children}
    </motion.div>
  );
}
