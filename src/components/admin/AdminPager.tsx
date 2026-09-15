"use client";

import { Button } from "@/components/ui/Button";
import type { AdminPageMeta } from "@/types/admin-stats";

export function AdminPager({
  page,
  onPage,
}: {
  page?: AdminPageMeta | null;
  onPage: (next: number) => void;
}) {
  if (!page || page.totalPages <= 1) {
    if (!page || page.total === 0) return null;
    return (
      <p className="px-6 py-4 text-xs font-bold text-slate-400">
        {page.total.toLocaleString()} result{page.total === 1 ? "" : "s"}
      </p>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-t border-slate-100">
      <p className="text-xs font-bold text-slate-400">
        Page {page.page} of {page.totalPages} · {page.total.toLocaleString()} total
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 px-4 text-xs rounded-xl"
          disabled={page.page <= 1}
          onClick={() => onPage(page.page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 px-4 text-xs rounded-xl"
          disabled={page.page >= page.totalPages}
          onClick={() => onPage(page.page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
