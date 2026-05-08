"use client";

import React from "react";
import { DashboardShell } from "./DashboardShell";

export function CreatorShell({ children }: { children: React.ReactNode }) {
  return <DashboardShell role="creator">{children}</DashboardShell>;
}
