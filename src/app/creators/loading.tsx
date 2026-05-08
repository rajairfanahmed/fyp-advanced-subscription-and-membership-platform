import { Container } from "@/components/layout/Container";

export default function CreatorsLoading() {
  return (
    <div className="flex flex-col min-h-screen pt-32 pb-20 lg:pt-40 bg-[var(--color-paper)]">
      <Container>
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-sm font-bold text-slate-600">
          Loading creators...
        </div>
      </Container>
    </div>
  );
}
