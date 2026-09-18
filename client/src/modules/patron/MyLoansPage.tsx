import { useState } from "react";
import { Link } from "wouter";
import { BookOpen, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MainLayout } from "@/components/layout/MainLayout";
import { AccountHeader, EmptyPanel, LoanRow, PatronError, PatronLoading, PatronPagination, QuickLinks, SectionHeading, usePatronAccount } from "./patronShared";

export default function MyLoansPage() {
  const query = usePatronAccount();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  if (query.isLoading) return <PatronLoading />;
  if (query.isError || !query.data) return <PatronError onRetry={() => query.refetch()} />;
  const loans = query.data.activeLoans;
  const overdue = loans.filter((loan) => loan.isOverdue);
  const visibleLoans = loans.slice((page - 1) * pageSize, page * pageSize);
  return <MainLayout><div className="space-y-7"><AccountHeader eyebrow="My loans" title="Books currently with you" description="Due dates, pickup libraries, and any charges in one place." /><QuickLinks />
    {overdue.length > 0 && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><p><strong>{overdue.length} {overdue.length === 1 ? "item is" : "items are"} overdue.</strong> Return them to avoid additional charges.</p></div>}
     <section><SectionHeading title={`${loans.length} active ${loans.length === 1 ? "loan" : "loans"}`} description="Your current checkouts" />{loans.length ? <><div className="grid gap-3 md:grid-cols-2">{visibleLoans.map((loan) => <LoanRow key={loan.id} loan={loan} />)}</div><PatronPagination page={page} total={loans.length} pageSize={pageSize} onPageChange={setPage} /></> : <EmptyPanel icon={BookOpen} title="Your shelf is clear" description="You do not have any active loans right now." href="/catalog" />}</section>
    <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm font-semibold">Looking for something else?</p><p className="mt-1 text-sm text-slate-500">Browse available books or check the status of your reserved titles.</p><div className="mt-4 flex gap-2"><Link href="/catalog"><Button size="sm">Browse catalog</Button></Link><Link href="/reservations"><Button size="sm" variant="outline">Reservations</Button></Link></div></div>
  </div></MainLayout>;
}