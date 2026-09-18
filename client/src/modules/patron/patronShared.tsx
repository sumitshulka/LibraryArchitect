import { Link } from "wouter";
import { format, isPast } from "date-fns";
import { ArrowLeft, ArrowRight, BookOpen, CalendarClock, CircleAlert, Library, RotateCcw, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { patronAccountApi, reservationsApi, type PatronLoan } from "@/lib/api";
import { useCurrency } from "@/lib/useCurrency";

export function PatronLoading() {
  return <MainLayout><div className="space-y-6"><Skeleton className="h-28 w-full rounded-2xl" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32 rounded-xl" /><Skeleton className="h-32 rounded-xl" /><Skeleton className="h-32 rounded-xl" /></div><Skeleton className="h-72 rounded-xl" /></div></MainLayout>;
}

export function PatronError({ onRetry }: { onRetry: () => void }) {
  return <MainLayout><Card className="border-red-200 bg-red-50/60"><CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center"><CircleAlert className="h-10 w-10 text-red-600" /><h2 className="text-lg font-semibold text-red-950">We could not load your library account</h2><p className="max-w-md text-sm text-red-800/80">Please try again. Your account data is kept private and comes directly from the library service.</p><Button onClick={onRetry} variant="outline">Try again</Button></CardContent></Card></MainLayout>;
}

export function usePatronAccount() {
  return useQuery({ queryKey: ["patron-library-account"], queryFn: patronAccountApi.getMine });
}

export function AccountHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(120deg,#0f2942,#173f59_62%,#1f6f73)] px-6 py-7 text-white shadow-sm md:px-8">
    <div className="absolute -right-10 -top-20 h-56 w-56 rounded-full border-[28px] border-white/10" />
    <div className="relative max-w-2xl"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">{eyebrow}</p><h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1><p className="mt-2 text-sm leading-6 text-slate-200">{description}</p></div>
  </div>;
}

export function LoanRow({ loan, compact = false }: { loan: PatronLoan; compact?: boolean }) {
  const { format: money } = useCurrency();
  const due = new Date(loan.dueDate);
  const overdue = loan.isOverdue || (isPast(due) && !loan.returnDate);
  return <div className={`flex gap-4 ${compact ? "py-3" : "rounded-xl border border-slate-200 bg-white p-4 shadow-sm"}`}>
    <div className="flex h-12 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 text-slate-400">{loan.coverUrl ? <img src={loan.coverUrl} alt="" className="h-full w-full object-cover" /> : <BookOpen className="h-5 w-5" />}</div>
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="truncate text-sm font-semibold text-slate-900">{loan.bookTitle}</h3><p className="mt-0.5 truncate text-xs text-slate-500">{loan.bookAuthor || "Author not listed"}</p></div><Badge variant={overdue ? "destructive" : "secondary"}>{overdue ? `${loan.daysOverdue || 1} days overdue` : loan.returnDate ? "Returned" : "On loan"}</Badge></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />Due {format(due, "d MMM yyyy")}</span>{loan.libraryName && <span className="inline-flex items-center gap-1"><Library className="h-3.5 w-3.5" />{loan.libraryName}</span>}{loan.totalOutstanding > 0 && <span className="font-medium text-red-700">{money(loan.totalOutstanding)} outstanding</span>}</div></div>
  </div>;
}

export function QuickLinks() {
  return <div className="flex flex-wrap gap-3"><Link href="/catalog"><Button className="gap-2 bg-slate-900 hover:bg-slate-700"><BookOpen className="h-4 w-4" />Browse catalog</Button></Link><Link href="/reservations"><Button variant="outline" className="gap-2"><CalendarClock className="h-4 w-4" />Manage reservations</Button></Link></div>;
}

export function ReservationsPreview() {
  const query = useQuery({ queryKey: ["patron-reservations", "active"], queryFn: () => reservationsApi.list({ status: "ACTIVE" }) });
  if (query.isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (query.isError) return <p className="text-sm text-slate-500">Reservations are temporarily unavailable.</p>;
  const rows = query.data ?? [];
  return <Card className="border-slate-200 shadow-sm"><CardHeader className="flex flex-row items-center justify-between space-y-0"><div><CardTitle className="text-base">Your reservations</CardTitle><p className="mt-1 text-xs text-slate-500">Books waiting in your queue</p></div><Link href="/reservations"><Button variant="ghost" size="sm" className="gap-1">View all <ArrowRight className="h-3.5 w-3.5" /></Button></Link></CardHeader><CardContent>{rows.length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 py-7 text-center text-sm text-slate-500">No active reservations. Find your next read in the catalog.</div> : <div className="divide-y divide-slate-100">{rows.slice(0, 3).map((r) => <div key={r.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{r.bookTitle || "Reserved title"}</p><p className="text-xs text-slate-500">Ready by {format(new Date(r.expiresAt), "d MMM yyyy")}</p></div><Badge variant="outline">{r.status}</Badge></div>)}</div>}</CardContent></Card>;
}

export function SectionHeading({ title, description, href }: { title: string; description?: string; href?: string }) {
  return <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>{description && <p className="text-sm text-slate-500">{description}</p>}</div>{href && <Link href={href}><Button variant="ghost" size="sm" className="gap-1">See all <ArrowRight className="h-3.5 w-3.5" /></Button></Link>}</div>;
}

export function EmptyPanel({ icon: Icon = RotateCcw, title, description, href }: { icon?: LucideIcon; title: string; description: string; href?: string }) {
  return <Card className="border-dashed border-slate-300 bg-slate-50/50"><CardContent className="flex flex-col items-center py-14 text-center"><Icon className="mb-3 h-8 w-8 text-slate-400" /><h3 className="font-semibold text-slate-800">{title}</h3><p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>{href && <Link href={href} className="mt-4"><Button variant="outline">Explore catalog</Button></Link>}</CardContent></Card>;
}

export function PatronPagination({ page, total, pageSize, onPageChange, alwaysShow = false }: { page: number; total: number; pageSize: number; onPageChange: (page: number) => void; alwaysShow?: boolean }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1 && !alwaysShow) return null;
  return <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm sm:flex-row">
    <p className="text-xs text-slate-500">Page {page} of {pageCount} · {total} {total === 1 ? "item" : "items"}</p>
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="gap-1" disabled={page === 1} onClick={() => onPageChange(page - 1)}><ArrowLeft className="h-3.5 w-3.5" />Previous</Button>
      <Button variant="outline" size="sm" className="gap-1" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>Next<ArrowRight className="h-3.5 w-3.5" /></Button>
    </div>
  </div>;
}

export { Card, CardContent, CardHeader, CardTitle, Separator };