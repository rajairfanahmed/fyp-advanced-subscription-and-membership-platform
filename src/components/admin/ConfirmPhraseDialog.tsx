"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function ConfirmPhraseDialog({
  open,
  title,
  description,
  phrase,
  phraseHint,
  confirmLabel,
  pending,
  tone = "danger",
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  phrase: string;
  phraseHint?: string;
  confirmLabel: string;
  pending?: boolean;
  tone?: "danger" | "warning";
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  if (!open) return null;

  const matches = typed.trim().toLowerCase() === phrase.trim().toLowerCase();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-phrase-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200"
        onClick={(event) => event.stopPropagation()}
      >
        <h3
          id="confirm-phrase-title"
          className="text-xl font-black font-display text-[var(--color-ink)] mb-2"
        >
          {title}
        </h3>
        <p className="text-sm font-medium text-slate-600 leading-relaxed mb-4">
          {description}
        </p>
        <p className="text-xs font-bold text-slate-500 mb-2">
          {phraseHint ?? "Type the confirmation phrase to continue."}{" "}
          <span className="font-black text-slate-800">{phrase}</span>
        </p>
        <input
          autoFocus
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          disabled={pending}
          className="w-full mb-6 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 disabled:opacity-60"
        />
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full sm:w-auto",
              tone === "danger"
                ? "text-rose-700 border-rose-300 hover:bg-rose-50"
                : "text-amber-800 border-amber-300 hover:bg-amber-50"
            )}
            onClick={onConfirm}
            disabled={!matches || pending}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
