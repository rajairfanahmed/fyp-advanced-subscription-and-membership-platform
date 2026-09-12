import React from "react";

export function DashboardPreviewCard() {
  return (
    <div className="relative w-full max-w-5xl mx-auto mt-16 animate-fade-in-up">
      {/* Decorative Glow */}
      <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 via-sky-500/20 to-emerald-500/20 rounded-[3rem] blur-3xl opacity-70 -z-10"></div>

      <div className="bg-[var(--color-glass)] backdrop-blur-xl border border-white/60 rounded-[2rem] shadow-2xl p-6 sm:p-8 ring-1 ring-slate-900/5 overflow-hidden">
        {/* Mock Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-sky-500 flex items-center justify-center text-white font-display font-black text-[10px] tracking-wide shadow-lg shadow-emerald-500/30">
              ASMP
            </div>
            <div>
              <h3 className="text-lg font-bold font-display text-[var(--color-ink)] leading-tight">Creator Dashboard</h3>
              <p className="text-sm font-medium text-[var(--color-muted)]">/creator</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-[var(--color-border)] shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Example</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[
            { label: "Monthly Revenue", value: "$12,450", trend: "+14.5%", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
            { label: "Active Members", value: "842", trend: "+5.2%", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
            { label: "Conversion Rate", value: "8.4%", trend: "+1.2%", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
            { label: "Content Views", value: "4,920", trend: "+24.8%", icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" },
            { label: "In-app notices", value: "128", trend: "Example", icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
            { label: "Premium Plan", value: "Active", trend: "Healthy", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                  </svg>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                  {stat.trend}
                </span>
              </div>
              <p className="text-sm font-semibold text-[var(--color-muted)] mb-1">{stat.label}</p>
              <p className="text-3xl font-display font-bold text-[var(--color-ink)] tracking-tight">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
