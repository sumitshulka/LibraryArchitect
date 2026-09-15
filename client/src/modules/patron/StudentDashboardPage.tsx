import { AlertCircle, Banknote, BookOpen, History, Sparkles } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrency } from "@/lib/useCurrency";
import { AccountHeader, EmptyPanel, LoanRow, PatronError, PatronLoading, QuickLinks, ReservationsPreview, SectionHeading, usePatronAccount } from "./patronShared";
import { Link } from "wouter";

export default function StudentDashboardPage() {
  const query = usePatronAccount();
  const { format: money } = useCurrency();
  if (query.isLoading) return <PatronLoading />;
  if (query.isError || !query.data) return <PatronError onRetry={() => query.refetch()} />;
  const { user, summary, activeLoans, history } = query.data;
  return <MainLayout><div className="space-y-7">
    <AccountHeader eyebrow="Personal library" title={`Good to see you, ${user.name.split(" ")[0]}.`} description="A clear view of what is out, what needs attention, and what you can do next." />
    <QuickLinks />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[{ label: "On loan", value: summary.activeLoans, icon: BookOpen, href: "/my-loans", tone: "text-cyan-700 bg-cyan-50" }, { label: "Needs attention", value: summary.overdueLoans, icon: AlertCircle, href: "/my-loans", tone: "text-amber-700 bg-amber-50" }, { label: "Outstanding", value: money(summary.totalOutstanding), icon: Banknote, href: "/my-fines", tone: "text-rose-700 bg-rose-50" }, { label: "Items read", value: summary.historyCount, icon: History, href: "/my-history", tone: "text-indigo-700 bg-indigo-50" }].map(({ label, value, icon: Icon, href, tone }) => <Link href={href} key={label}><Card className="h-full border-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p></div><div className={`rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" /></div></CardContent></Card></Link>)}
    </div>
    <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]"><section><SectionHeading title="What you have out" description="Keep an eye on due dates and charges." href="/my-loans" />{activeLoans.length ? <div className="space-y-3">{activeLoans.slice(0, 3).map((loan) => <LoanRow key={loan.id} loan={loan} />)}</div> : <EmptyPanel icon={Sparkles} title="Nothing checked out" description="Your next great read is waiting in the catalog." href="/catalog" />}</section><div className="space-y-6"><ReservationsPreview /><Card className="border-slate-200 bg-slate-900 text-white"><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Keep reading</p><h3 className="mt-2 text-lg font-semibold">Find a new title for your next study session.</h3><p className="mt-2 text-sm text-slate-300">Search by subject, author, or title and reserve a copy when it matters.</p><Link href="/catalog"><Button className="mt-4 bg-cyan-400 text-slate-950 hover:bg-cyan-300">Explore catalog</Button></Link></CardContent></Card></div></div>
    {history.length > 0 && <section><SectionHeading title="Recently returned" href="/my-history" /><div className="grid gap-3 md:grid-cols-2">{history.slice(0, 2).map((loan) => <LoanRow key={loan.id} loan={loan} compact />)}</div></section>}
  </div></MainLayout>;
}