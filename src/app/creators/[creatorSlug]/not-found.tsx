import Link from "next/link";
import { Container } from "@/components/layout/Container";

export default function CreatorNotFound() {
  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)]">
      <Container>
        <div className="bg-white rounded-2xl border border-slate-200 p-8">
          <h1 className="text-3xl font-black font-display text-slate-950 mb-3">Creator not found</h1>
          <p className="text-sm font-bold text-slate-600 mb-6">
            This creator profile is unavailable or has not been published yet.
          </p>
          <Link href="/creators" className="text-sm font-black text-emerald-700 hover:text-emerald-800">
            Browse published creators
          </Link>
        </div>
      </Container>
    </div>
  );
}
