import { useState } from "react";
import { format } from "date-fns";
import { History, Search } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AccountHeader, EmptyPanel, PatronError, PatronLoading, PatronPagination, SectionHeading, usePatronAccount } from "./patronShared";

export default function MyHistoryPage() {
  const query = usePatronAccount();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  if (query.isLoading) return <PatronLoading />;
  if (query.isError || !query.data) return <PatronError onRetry={() => query.refetch()} />;
  const history = query.data.history;
  const visibleHistory = history.slice((page - 1) * pageSize, page * pageSize);
  return <MainLayout><div className="space-y-7"><AccountHeader eyebrow="Reading trail" title="Your circulation history" description="A personal record of the books you have borrowed from the library." /><section><SectionHeading title={`${history.length} ${history.length === 1 ? "title" : "titles"} in your history`} description="Most recent activity appears first." />{history.length ? <><Card className="border-slate-200 shadow-sm"><CardContent className="p-0"><div className="divide-y divide-slate-100">{visibleHistory.map((loan) => <div key={loan.id} className="flex gap-4 p-4 md:p-5"><div className="flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 text-slate-400">{loan.coverUrl ? <img src={loan.coverUrl} alt="" className="h-full w-full object-cover" /> : <History className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold text-slate-900">{loan.bookTitle}</h3><p className="text-sm text-slate-500">{loan.bookAuthor || "Author not listed"}</p></div><Badge variant="secondary">{loan.returnDate ? `Returned ${format(new Date(loan.returnDate), "d MMM yyyy")}` : "Circulation record"}</Badge></div><p className="mt-3 text-xs text-slate-500">Borrowed {format(new Date(loan.checkoutDate), "d MMM yyyy")}{loan.libraryName ? ` · ${loan.libraryName}` : ""}</p></div></div>)}</div></CardContent></Card><PatronPagination page={page} total={history.length} pageSize={pageSize} onPageChange={setPage} /></> : <EmptyPanel icon={Search} title="Your reading trail starts here" description="Borrow your first book and it will appear here." href="/catalog" />}</section></div></MainLayout>;
}