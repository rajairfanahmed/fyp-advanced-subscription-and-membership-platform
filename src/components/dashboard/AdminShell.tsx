"use client";

import React from "react";
import { DashboardShell } from "./DashboardShell";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return <DashboardShell role="admin">{children}</DashboardShell>;
}
