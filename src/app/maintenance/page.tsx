import Link from "next/link";
import { Wrench } from "lucide-react";

export const metadata = {
  title: "Advanced Subscription & Membership Platform · Scheduled maintenance",
  description: "Advanced Subscription & Membership Platform is briefly offline for maintenance.",
};

/**
 * Public landing page surfaced by `src/middleware.ts` whenever
 * `PlatformSettings.maintenanceMode` is true and the visitor is not
 * an admin. Admins can still use the dashboard during maintenance to
 * toggle the flag back off.
 */
export default function MaintenancePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6 py-16">
      <div className="max-w-xl w-full bg-white rounded-[2rem] border border-slate-200 shadow-sm p-10 md:p-14 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 mx-auto mb-8 flex items-center justify-center">
          <Wrench className="w-7 h-7 text-amber-600" />
        </div>
        <h1 className="text-3xl md:text-4xl font-black font-display text-slate-900 tracking-tight mb-4">
          We&rsquo;re briefly offline
        </h1>
        <p className="text-base font-medium text-slate-600 leading-relaxed mb-8">
          Advanced Subscription & Membership Platform is in scheduled maintenance. Subscriptions and content stay
          intact &mdash; we&rsquo;ll be back in a few minutes. Thanks for your
          patience.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-6 py-3 text-sm font-black hover:bg-slate-800 transition-colors"
        >
          Try again
        </Link>
      </div>
    </main>
  );
}
