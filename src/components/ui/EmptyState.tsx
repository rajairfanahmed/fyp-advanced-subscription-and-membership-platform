import React from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionText, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center max-w-lg mx-auto bg-white border border-[var(--color-border)] rounded-[var(--radius-card)] shadow-[var(--shadow-soft)]">
      <div className="w-16 h-16 rounded-2xl bg-[var(--color-emerald)]/10 flex items-center justify-center text-[var(--color-emerald)] mb-6">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <h3 className="text-xl font-bold font-display text-[var(--color-ink)] mb-3">{title}</h3>
      <p className="text-[var(--color-muted)] mb-8 leading-relaxed">{description}</p>
      {actionText && onAction && (
        <button 
          onClick={onAction}
          className="px-6 py-2.5 rounded-xl bg-[var(--color-ink)] text-white font-medium hover:bg-[var(--color-ink)]/90 transition-colors"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
