import { Banknote, CheckCircle2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrency } from "@/lib/useCurrency";
import { AccountHeader, EmptyPanel, PatronError, PatronLoading, SectionHeading, usePatronAccount } from "./patronShared";

export default function MyFinesPage() {
  const query = usePatronAccount();
  const { format: money } = useCurrency();
  if (query.isLoading) return <PatronLoading />;
  if (query.isError || !query.data) return <PatronError onRetry={() => query.refetch()} />;
  const items = [...query.data.activeLoans, ...query.data.history].filter((loan) => loan.totalOutstanding > 0);
  return <MainLayout><div className="space-y-7"><AccountHeader eyebrow="My account" title="Outstanding charges" description="A transparent breakdown of overdue and damage charges linked to your loans." />
    <Card className="border-rose-200 bg-rose-50/60"><CardContent className="flex items-center justify-between gap-4 p-6"><div><p className="text-sm font-medium text-rose-900">Total outstanding</p><p className="mt-1 text-3xl font-semibold tracking-tight text-rose-950">{money(query.data.summary.totalOutstanding)}</p></div><Banknote className="h-9 w-9 text-rose-600" /></CardContent></Card>
    <section><SectionHeading title="Charge details" description="Charges remain attached to the circulation record that created them." />{items.length ? <div className="space-y-3">{items.map((loan) => <Card key={loan.id} className="border-slate-200 shadow-sm"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-4"><div><p className="font-semibold text-slate-900">{loan.bookTitle}</p><p className="mt-1 text-xs text-slate-500">{loan.isOverdue ? `${loan.daysOverdue || 1} days overdue` : "Damage or replacement charge"}</p></div><div className="text-right"><p className="font-semibold text-rose-700">{money(loan.totalOutstanding)}</p><p className="text-xs text-slate-500">{loan.fineOutstanding > 0 ? `Fine ${money(loan.fineOutstanding)}` : ""}{loan.damageOutstanding > 0 ? `Damage ${money(loan.damageOutstanding)}` : ""}</p></div></CardContent></Card>)}</div> : <EmptyPanel icon={CheckCircle2} title="You are all clear" description="There are no outstanding fines or damage charges on your account." />}</section>
  </div></MainLayout>;
}