import "./_group.css";
import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { BarChart3, BookOpen, Check, ChevronDown, CircleHelp, Clock3, Database, Download, FileText, Filter, Gauge, History, ImageIcon, Library, Menu, MoreHorizontal, Pencil, Plus, Search, Settings2, ShieldCheck, Sparkles, Trash2, Upload, X } from "lucide-react";

type BookStatus = "AVAILABLE" | "CHECKED_OUT" | "MAINTENANCE" | "LOST";
type Book = { id: number; title: string; author: string; year: number; category: string; isbn: string; status: BookStatus; tags: string[]; coverTone: string; coverMark: string };

const seedBooks: Book[] = [
  { id: 1, title: "Clean Code", author: "Robert C. Martin", year: 2008, category: "Technology", isbn: "9780132350884", status: "AVAILABLE", tags: ["Software", "Engineering"], coverTone: "#7e9b94", coverMark: "CC" },
  { id: 2, title: "The Design of Everyday Things", author: "Don Norman", year: 2013, category: "Design", isbn: "9780465050659", status: "CHECKED_OUT", tags: ["UX"], coverTone: "#d29b72", coverMark: "DO" },
  { id: 3, title: "Thinking, Fast and Slow", author: "Daniel Kahneman", year: 2011, category: "Psychology", isbn: "9780374533557", status: "AVAILABLE", tags: ["Behavior"], coverTone: "#a7b6c0", coverMark: "TF" },
  { id: 4, title: "The Pragmatic Programmer", author: "David Thomas", year: 2019, category: "Technology", isbn: "9780135957059", status: "MAINTENANCE", tags: ["Programming"], coverTone: "#c8ba72", coverMark: "PP" },
  { id: 5, title: "A Brief History of Time", author: "Stephen Hawking", year: 1988, category: "Science", isbn: "9780553380163", status: "LOST", tags: ["Physics"], coverTone: "#6e7786", coverMark: "BH" },
];

const statusMeta: Record<BookStatus, { label: string; className: string; dot: string }> = {
  AVAILABLE: { label: "Available", className: "bg-[#e1eee9] text-[#2d6258]", dot: "bg-[#4f8d7f]" },
  CHECKED_OUT: { label: "Checked out", className: "bg-[#e8e5f0] text-[#625c7b]", dot: "bg-[#8179a6]" },
  MAINTENANCE: { label: "Maintenance", className: "bg-[#f4e7d7] text-[#9b633d]", dot: "bg-[#c88551]" },
  LOST: { label: "Lost", className: "bg-[#f3dfdc] text-[#984f4d]", dot: "bg-[#bf7167]" },
};

function Cover({ book, small = false }: { book: Book; small?: boolean }) {
  return (
    <div
      aria-label={`Cover placeholder for ${book.title}`}
      className={`relative flex shrink-0 items-end overflow-hidden rounded-[3px] border border-white/40 shadow-[2px_3px_0_rgba(28,43,47,0.08)] ${small ? "h-12 w-8" : "h-14 w-10"}`}
      style={{ backgroundColor: book.coverTone }}
    >
      <div className="absolute -right-3 -top-4 h-12 w-12 rounded-full border-[6px] border-white/20" />
      <span className="relative z-10 p-1 font-['DM_Sans'] text-[9px] font-bold tracking-[0.12em] text-[#f8f4ea]">{book.coverMark}</span>
    </div>
  );
}

function Shell({ children, onSettings }: { children: ReactNode; onSettings: () => void }) {
  return (
    <div className="min-h-[100dvh] bg-[#f4f1e8] font-['DM_Sans'] text-[#20333a]">
      <style>{`
        .catalog-scrollbar::-webkit-scrollbar { width: 7px; height: 7px; }
        .catalog-scrollbar::-webkit-scrollbar-thumb { background: #becbc4; border-radius: 8px; }
        .catalog-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .catalog-row { transition: background-color 180ms ease, transform 180ms ease, box-shadow 180ms ease; }
        .catalog-row:hover { background: #fbfaf5; box-shadow: inset 3px 0 #5c8b82; }
        .catalog-action { transition: background-color 160ms ease, color 160ms ease, transform 160ms ease; }
        .catalog-action:hover { transform: translateY(-1px); }
        .ink-grid { background-image: linear-gradient(rgba(77, 109, 105, .07) 1px, transparent 1px), linear-gradient(90deg, rgba(77, 109, 105, .07) 1px, transparent 1px); background-size: 18px 18px; }
        @keyframes catalog-rise { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }
        .catalog-rise { animation: catalog-rise 440ms ease both; }
      `}</style>
      <div className="flex min-h-[100dvh]">
        <aside className="hidden w-[218px] shrink-0 flex-col bg-[#20333a] text-[#dce7de] md:flex">
          <div className="flex h-[70px] items-center gap-3 border-b border-[#78918a]/20 px-6">
            <div className="grid h-9 w-9 place-items-center rounded-sm bg-[#c8ba72] text-[#20333a] shadow-[3px_3px_0_#17272b]">
              <Library className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </div>
            <div>
              <div className="font-['Playfair_Display'] text-[18px] font-semibold tracking-[-0.02em]">SC24Lib</div>
              <div className="mt-0.5 text-[9px] uppercase tracking-[0.22em] text-[#a9c1b6]">Reference room</div>
            </div>
          </div>
          <div className="px-4 py-7">
            <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#78918a]">Workspace</div>
            <nav className="space-y-1 text-[13px]">
              <div className="flex items-center gap-3 rounded-sm bg-[#355059] px-3 py-2.5 font-semibold text-[#f4f1e8] shadow-[inset_3px_0_#c8ba72]"><BookOpen className="h-4 w-4 text-[#c8ba72]" />Catalog</div>
              <div className="flex items-center gap-3 rounded-sm px-3 py-2.5 text-[#a9c1b6] transition-colors hover:bg-[#2b444b] hover:text-[#f4f1e8]"><Clock3 className="h-4 w-4" />Circulation</div>
              <div className="flex items-center gap-3 rounded-sm px-3 py-2.5 text-[#a9c1b6] transition-colors hover:bg-[#2b444b] hover:text-[#f4f1e8]"><Database className="h-4 w-4" />Patrons</div>
              <div className="flex items-center gap-3 rounded-sm px-3 py-2.5 text-[#a9c1b6] transition-colors hover:bg-[#2b444b] hover:text-[#f4f1e8]"><BarChart3 className="h-4 w-4" />Reports</div>
            </nav>
          </div>
          <div className="mt-auto border-t border-[#78918a]/20 p-4">
            <button onClick={onSettings} className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left text-[13px] text-[#a9c1b6] transition-colors hover:bg-[#2b444b] hover:text-[#f4f1e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ba72]">
              <Settings2 className="h-4 w-4" />Settings
              <span className="ml-auto text-[10px] text-[#78918a]">Z39.50</span>
            </button>
            <div className="mt-4 flex items-center gap-3 px-3">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-[#b9cbc0] text-[10px] font-bold text-[#20333a]">AM</div>
              <div className="min-w-0"><div className="truncate text-xs font-semibold">Alex Morgan</div><div className="text-[10px] text-[#78918a]">Head librarian</div></div>
            </div>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="flex h-[70px] items-center justify-between border-b border-[#d6d9ce] bg-[#f8f6ef] px-5 md:px-8">
            <div className="flex items-center gap-3 text-[12px] text-[#80908b]"><Menu className="h-4 w-4 md:hidden" /><span>Library Management</span><span className="text-[#bdc5bd]">/</span><span className="font-semibold text-[#334950]">Catalog</span></div>
            <div className="flex items-center gap-3"><div className="hidden items-center gap-2 text-[11px] text-[#80908b] sm:flex"><span className="h-2 w-2 rounded-full bg-[#79a891]" />Sync healthy</div><div className="grid h-8 w-8 place-items-center rounded-full bg-[#d9e6de] text-[10px] font-bold text-[#355e57]">AM</div></div>
          </header>
          <main className="catalog-scrollbar h-[calc(100dvh-70px)] overflow-y-auto px-5 py-6 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, eyebrow, children, onClose, wide = false }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#17272b]/50 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <div className={`max-h-[90vh] w-full overflow-auto rounded-sm border border-[#d6d9ce] bg-[#f8f6ef] shadow-[0_18px_55px_rgba(25,43,46,0.24)] ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="flex items-start justify-between border-b border-[#d6d9ce] px-6 py-5">
          <div><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#658a81]">{eyebrow ?? "Catalog workspace"}</div><h2 className="font-['Playfair_Display'] text-[26px] font-semibold leading-none text-[#20333a]">{title}</h2></div>
          <button onClick={onClose} aria-label="Close dialog" className="rounded-sm p-1 text-[#80908b] transition-colors hover:bg-[#e8ebe2] hover:text-[#20333a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c8b82]"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: BookStatus }) {
  const meta = statusMeta[status];
  return <Badge className={`gap-1.5 border-0 px-2.5 py-1 text-[10px] font-semibold ${meta.className}`}><span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}</Badge>;
}

export function CohesiveOverview() {
  const [books, setBooks] = useState(seedBooks);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | BookStatus>("All");
  const [modal, setModal] = useState<"analytics" | "add" | "bulk" | "marc" | "history" | "edit" | "delete" | "settings" | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [notice, setNotice] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");

  const visible = useMemo(() => books.filter((book) => {
    const matchesFilter = filter === "All" || book.status === filter;
    const haystack = `${book.title} ${book.author} ${book.isbn} ${book.category}`.toLowerCase();
    return matchesFilter && haystack.includes(query.toLowerCase());
  }), [books, filter, query]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };

  const openBookModal = (kind: "marc" | "history" | "edit" | "delete", book: Book) => {
    setSelectedBook(book);
    setModal(kind);
  };

  const addResource = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTitle.trim() || !newAuthor.trim()) return;
    const newBook: Book = { id: Date.now(), title: newTitle.trim(), author: newAuthor.trim(), year: 2024, category: "New acquisitions", isbn: "9780000000000", status: "AVAILABLE", tags: ["New"], coverTone: "#8a9e8c", coverMark: newTitle.trim().slice(0, 2).toUpperCase() };
    setBooks((current) => [newBook, ...current]);
    setNewTitle("");
    setNewAuthor("");
    setModal(null);
    flash("Resource added to the collection");
  };

  const removeBook = () => {
    if (!selectedBook) return;
    setBooks((current) => current.filter((book) => book.id !== selectedBook.id));
    setModal(null);
    setSelectedBook(null);
    flash("Record removed from the catalog");
  };

  return (
    <Shell onSettings={() => setModal("settings")}>
      <div className="mx-auto w-full max-w-[1240px]">
        <div className="catalog-rise mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#658a81]"><span className="h-px w-7 bg-[#c8ba72]" />Collection desk · Tuesday, 14 May 2024</div>
            <h1 className="font-['Playfair_Display'] text-[38px] font-semibold leading-[0.95] tracking-[-0.04em] text-[#20333a] md:text-[46px]">Catalog overview</h1>
            <p className="mt-2 max-w-xl text-[13px] leading-5 text-[#71817c]">A measured view of the collection, its current availability, and the records that need a librarian’s attention.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { flash("Catalog export prepared"); }} className="catalog-action h-9 rounded-sm border-[#cbd4ca] bg-[#f8f6ef] px-3 text-[11px] text-[#45635e] hover:bg-[#e9eee7] focus-visible:ring-[#5c8b82]"><Download className="mr-2 h-3.5 w-3.5" />Export</Button>
            <Button variant="outline" onClick={() => setModal("bulk")} className="catalog-action h-9 rounded-sm border-[#cbd4ca] bg-[#f8f6ef] px-3 text-[11px] text-[#45635e] hover:bg-[#e9eee7] focus-visible:ring-[#5c8b82]"><Upload className="mr-2 h-3.5 w-3.5" />Bulk upload</Button>
            <Button onClick={() => setModal("add")} className="catalog-action h-9 rounded-sm bg-[#355e57] px-3 text-[11px] text-[#f8f6ef] shadow-[3px_3px_0_#c8ba72] hover:bg-[#2c514b] focus-visible:ring-[#c8ba72]"><Plus className="mr-2 h-3.5 w-3.5" />Add resource</Button>
          </div>
        </div>

        <div className="catalog-rise grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="relative overflow-hidden rounded-sm bg-[#355e57] p-5 text-[#f8f6ef] shadow-[4px_4px_0_#c8ba72]">
            <div className="ink-grid absolute inset-0 opacity-20" />
            <div className="relative"><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b8d0c3]">Collection at a glance</div><div className="mt-3 flex items-end gap-3"><span className="font-['Playfair_Display'] text-[42px] leading-none">1,284</span><span className="pb-1 text-[11px] text-[#b8d0c3]">total records</span></div><div className="mt-3 flex items-center gap-2 text-[11px] text-[#dce7de]"><span className="rounded-full bg-[#c8ba72] px-2 py-0.5 font-semibold text-[#20333a]">+24</span> acquired this quarter</div></div>
          </div>
          <div className="rounded-sm border border-[#d6d9ce] bg-[#f8f6ef] p-5"><div className="flex items-center justify-between text-[#80908b]"><span className="text-[10px] font-bold uppercase tracking-[0.18em]">On shelf</span><Gauge className="h-4 w-4 text-[#5c8b82]" /></div><div className="mt-3 font-['Playfair_Display'] text-[31px] leading-none text-[#20333a]">1,047</div><div className="mt-2 text-[11px] text-[#71817c]">81.5% of the collection</div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#e1e7df]"><div className="h-full w-[81.5%] rounded-full bg-[#78a394]" /></div></div>
          <div className="rounded-sm border border-[#d6d9ce] bg-[#f8f6ef] p-5"><div className="flex items-center justify-between text-[#80908b]"><span className="text-[10px] font-bold uppercase tracking-[0.18em]">Circulating</span><Clock3 className="h-4 w-4 text-[#8179a6]" /></div><div className="mt-3 font-['Playfair_Display'] text-[31px] leading-none text-[#20333a]">186</div><div className="mt-2 text-[11px] text-[#71817c]">14.5% currently checked out</div><div className="mt-4 flex -space-x-1"><span className="h-2 w-10 rounded-full bg-[#8179a6]" /><span className="h-2 w-6 rounded-full bg-[#b9b3cb]" /><span className="h-2 w-3 rounded-full bg-[#dedbe7]" /></div></div>
          <div className="rounded-sm border border-[#d6d9ce] bg-[#f8f6ef] p-5"><div className="flex items-center justify-between text-[#80908b]"><span className="text-[10px] font-bold uppercase tracking-[0.18em]">Needs attention</span><ShieldCheck className="h-4 w-4 text-[#bf7167]" /></div><div className="mt-3 font-['Playfair_Display'] text-[31px] leading-none text-[#20333a]">51</div><div className="mt-2 text-[11px] text-[#71817c]">maintenance or missing</div><button onClick={() => { setFilter("MAINTENANCE"); flash("Showing records needing attention"); }} className="mt-3 text-[11px] font-semibold text-[#9b5d4f] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bf7167]">Review records <span aria-hidden="true">→</span></button></div>
        </div>

        <div className="catalog-rise mt-6 flex flex-col justify-between gap-3 border-b border-[#d6d9ce] pb-3 sm:flex-row sm:items-end">
          <div><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#658a81]">Primary task</div><h2 className="mt-1 font-['Playfair_Display'] text-[25px] font-semibold text-[#20333a]">Manage collection</h2></div>
          <Button variant="outline" onClick={() => setModal("analytics")} className="catalog-action h-9 self-start rounded-sm border-[#bdcbc0] bg-[#e8eee7] px-3 text-[11px] font-semibold text-[#355e57] hover:bg-[#dce8df] focus-visible:ring-[#5c8b82] sm:self-auto"><BarChart3 className="mr-2 h-3.5 w-3.5" />Open catalog analytics</Button>
        </div>

        <div className="mt-3 rounded-sm border border-[#d6d9ce] bg-[#f8f6ef] shadow-[0_5px_0_rgba(69,99,94,0.05)]">
          <div className="flex flex-col gap-3 border-b border-[#d6d9ce] p-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-[370px]"><Search className="absolute left-3 top-[11px] h-3.5 w-3.5 text-[#80908b]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 rounded-sm border-[#cbd4ca] bg-[#fcfbf6] pl-9 text-[12px] placeholder:text-[#99a7a0] focus-visible:ring-[#5c8b82]" placeholder="Search title, author, ISBN, or category" /></div>
            <div className="flex items-center justify-between gap-3 sm:justify-end"><span className="text-[11px] text-[#80908b]">{visible.length} of {books.length} visible</span><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="h-9 rounded-sm border-[#cbd4ca] bg-[#fcfbf6] px-3 text-[11px] text-[#45635e] hover:bg-[#e9eee7] focus-visible:ring-[#5c8b82]"><Filter className="mr-2 h-3.5 w-3.5" />{filter === "All" ? "All statuses" : statusMeta[filter].label}<ChevronDown className="ml-2 h-3 w-3" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="rounded-sm border-[#d6d9ce] bg-[#f8f6ef]">{(["All", "AVAILABLE", "CHECKED_OUT", "MAINTENANCE", "LOST"] as const).map((item) => <DropdownMenuItem key={item} onClick={() => setFilter(item)} className="text-xs focus:bg-[#e2ece4]">{item === "All" ? "All statuses" : statusMeta[item].label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div>
          </div>
          <div className="catalog-scrollbar max-h-[356px] overflow-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-[#edf1ea] text-[10px] font-bold uppercase tracking-[0.15em] text-[#78908a]"><tr><th className="w-16 px-4 py-3 font-semibold">Cover</th><th className="px-3 py-3 font-semibold">Title & author</th><th className="px-3 py-3 font-semibold">Category</th><th className="px-3 py-3 font-semibold">ISBN</th><th className="px-3 py-3 font-semibold">Status</th><th className="w-14 px-4 py-3 text-right font-semibold"> </th></tr></thead>
              <tbody className="divide-y divide-[#e0e2d9]">{visible.map((book) => <tr key={book.id} className="catalog-row group">
                <td className="px-4 py-3"><Cover book={book} small /></td>
                <td className="px-3 py-3"><button onClick={() => openBookModal("edit", book)} className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c8b82]"><div className="text-[13px] font-semibold text-[#29434a] group-hover:text-[#47786e]">{book.title}</div><div className="mt-0.5 text-[11px] text-[#80908b]">{book.author} <span className="px-1 text-[#b1bbb3]">·</span> {book.year}</div></button><div className="mt-1.5 flex flex-wrap gap-1">{book.tags.map((tag) => <Badge key={tag} variant="outline" className="h-4 rounded-sm border-[#d1d9cf] bg-[#f8f6ef] px-1.5 text-[9px] font-medium text-[#72857e]">{tag}</Badge>)}</div></td>
                <td className="px-3 py-3"><Badge variant="outline" className="rounded-sm border-[#d1d9cf] bg-transparent px-2 py-1 text-[10px] font-medium text-[#5d746d]">{book.category}</Badge></td>
                <td className="px-3 py-3 font-['JetBrains_Mono'] text-[10px] tracking-[-0.04em] text-[#82938b]">{book.isbn}</td>
                <td className="px-3 py-3"><StatusBadge status={book.status} /></td>
                <td className="px-4 py-3 text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${book.title}`} className="h-8 w-8 rounded-sm text-[#80908b] hover:bg-[#e6eee7] hover:text-[#355e57] focus-visible:ring-[#5c8b82]"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-44 rounded-sm border-[#d6d9ce] bg-[#f8f6ef]"><DropdownMenuLabel className="text-[10px] uppercase tracking-[0.15em] text-[#80908b]">Record actions</DropdownMenuLabel><DropdownMenuItem onClick={() => openBookModal("edit", book)} className="text-xs focus:bg-[#e2ece4]"><Pencil className="mr-2 h-3.5 w-3.5" />Edit details</DropdownMenuItem><DropdownMenuItem onClick={() => openBookModal("marc", book)} className="text-xs focus:bg-[#e2ece4]"><FileText className="mr-2 h-3.5 w-3.5" />View MARC record</DropdownMenuItem><DropdownMenuItem onClick={() => openBookModal("history", book)} className="text-xs focus:bg-[#e2ece4]"><History className="mr-2 h-3.5 w-3.5" />View history</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => openBookModal("delete", book)} className="text-xs text-[#a9544d] focus:bg-[#f4e2df] focus:text-[#a9544d]"><Trash2 className="mr-2 h-3.5 w-3.5" />Delete record</DropdownMenuItem></DropdownMenuContent></DropdownMenu></td>
              </tr>)}{visible.length === 0 && <tr><td colSpan={6} className="h-36 text-center"><div className="mx-auto flex w-fit flex-col items-center text-[#80908b]"><Search className="mb-2 h-5 w-5 text-[#a7b5ad]" /><span className="text-xs font-semibold">No records match this view</span><button onClick={() => { setQuery(""); setFilter("All"); }} className="mt-1 text-[11px] text-[#47786e] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c8b82]">Clear search and filters</button></div></td></tr>}</tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[#d6d9ce] px-4 py-3 text-[10px] text-[#80908b]"><span>Showing the most recently touched records</span><div className="flex items-center gap-2"><span className="rounded-sm bg-[#e7eee7] px-2 py-1 font-semibold text-[#47786e]">Page 1</span><button onClick={() => flash("You are viewing the complete mockup collection")} className="rounded-sm px-2 py-1 hover:bg-[#e7eee7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c8b82]">Next <span aria-hidden="true">→</span></button></div></div>
        </div>

        <div className="mt-5 flex flex-col justify-between gap-3 border-t border-[#d6d9ce] pt-4 text-[11px] text-[#80908b] sm:flex-row"><span className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-[#c8ba72]" />Last catalog sync 08:42 · all local records up to date</span><button onClick={() => setModal("settings")} className="flex items-center gap-1.5 self-start font-semibold text-[#47786e] hover:text-[#2c514b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c8b82]">Catalog settings <Settings2 className="h-3.5 w-3.5" /></button></div>
      </div>

      {notice && <div className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-sm border border-[#9db9a8] bg-[#355e57] px-4 py-3 text-xs font-semibold text-[#f8f6ef] shadow-[4px_4px_0_#c8ba72]"><Check className="h-4 w-4 text-[#c8ba72]" />{notice}</div>}

      {modal === "analytics" && <Modal title="Catalog analytics" eyebrow="Collection signals" onClose={() => setModal(null)} wide><div className="grid gap-6 md:grid-cols-[1fr_260px]"><div><div className="mb-4 flex items-end justify-between"><div><div className="text-[11px] font-semibold text-[#355e57]">Circulation over the last six months</div><div className="mt-1 text-[11px] text-[#80908b]">Checked-out items, excluding renewals</div></div><div className="font-['Playfair_Display'] text-2xl text-[#20333a]">186 <span className="font-['DM_Sans'] text-[11px] text-[#658a81]">active</span></div></div><div className="flex h-48 items-end gap-3 border-b border-l border-[#cbd4ca] px-4 pb-0 pt-4">{[44, 57, 52, 68, 61, 82].map((height, index) => <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="w-full max-w-9 rounded-t-sm bg-[#7da497] transition-all hover:bg-[#355e57]" style={{ height: `${height}%` }} /><span className="text-[10px] text-[#80908b]">{["Dec", "Jan", "Feb", "Mar", "Apr", "May"][index]}</span></div>)}</div></div><div className="rounded-sm bg-[#edf1ea] p-4"><div className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#658a81]">Collection mix</div>{[["Technology", "31%", "#355e57"], ["Design", "19%", "#c8ba72"], ["Science", "16%", "#8179a6"], ["Other", "34%", "#b9cbc0"]].map(([label, percentage, color]) => <div key={label} className="mb-4 last:mb-0"><div className="mb-1 flex justify-between text-[11px] font-semibold text-[#45635e]"><span>{label}</span><span>{percentage}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#d7dfd6]"><div className="h-full rounded-full" style={{ width: percentage, backgroundColor: color }} /></div></div>)}</div></div><div className="mt-5 grid gap-3 border-t border-[#d6d9ce] pt-4 sm:grid-cols-3"><div><div className="text-[10px] uppercase tracking-[0.15em] text-[#80908b]">Top title</div><div className="mt-1 text-xs font-semibold text-[#355e57]">The Design of Everyday Things</div></div><div><div className="text-[10px] uppercase tracking-[0.15em] text-[#80908b]">Peak day</div><div className="mt-1 text-xs font-semibold text-[#355e57]">Tuesday · 42 checkouts</div></div><div><div className="text-[10px] uppercase tracking-[0.15em] text-[#80908b]">Signal</div><div className="mt-1 text-xs font-semibold text-[#9b633d]">Science shelf under-circulating</div></div></div></Modal>}

      {modal === "add" && <Modal title="Add a resource" eyebrow="New catalog record" onClose={() => setModal(null)}><form onSubmit={addResource} className="space-y-4"><label className="block text-xs font-semibold text-[#45635e]">Title<Input required value={newTitle} onChange={(event) => setNewTitle(event.target.value)} className="mt-1.5 h-10 rounded-sm border-[#cbd4ca] bg-[#fcfbf6] text-sm focus-visible:ring-[#5c8b82]" placeholder="Enter the resource title" /></label><label className="block text-xs font-semibold text-[#45635e]">Author<Input required value={newAuthor} onChange={(event) => setNewAuthor(event.target.value)} className="mt-1.5 h-10 rounded-sm border-[#cbd4ca] bg-[#fcfbf6] text-sm focus-visible:ring-[#5c8b82]" placeholder="Enter an author or contributor" /></label><div className="grid grid-cols-2 gap-3"><div className="rounded-sm bg-[#edf1ea] p-3 text-[11px] text-[#71817c]"><div className="font-semibold text-[#45635e]">Default status</div><div className="mt-1">Available</div></div><div className="rounded-sm bg-[#edf1ea] p-3 text-[11px] text-[#71817c]"><div className="font-semibold text-[#45635e]">Record source</div><div className="mt-1">Local entry</div></div></div><div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setModal(null)} className="rounded-sm border-[#cbd4ca] text-xs">Cancel</Button><Button type="submit" className="rounded-sm bg-[#355e57] text-xs hover:bg-[#2c514b]">Create record</Button></div></form></Modal>}

      {modal === "bulk" && <Modal title="Bulk upload" eyebrow="Import records" onClose={() => setModal(null)}><div className="rounded-sm border border-dashed border-[#9db9a8] bg-[#edf1ea] p-8 text-center"><Upload className="mx-auto h-7 w-7 text-[#5c8b82]" /><div className="mt-3 text-sm font-semibold text-[#355e57]">Drop a CSV or MARC file here</div><div className="mt-1 text-[11px] text-[#80908b]">Up to 10,000 records · UTF-8 or MARC21</div><Button onClick={() => { setModal(null); flash("Upload queue opened"); }} className="mt-5 rounded-sm bg-[#355e57] text-xs hover:bg-[#2c514b]">Choose file</Button></div><div className="mt-4 flex items-center gap-2 text-[11px] text-[#80908b]"><CircleHelp className="h-3.5 w-3.5" />Need a template? <button onClick={() => flash("CSV template downloaded")} className="font-semibold text-[#47786e] underline-offset-2 hover:underline">Download CSV template</button></div></Modal>}

      {modal === "marc" && selectedBook && <Modal title="MARC21 record" eyebrow="Bibliographic record" onClose={() => setModal(null)} wide><div className="mb-4 flex items-center gap-3"><Cover book={selectedBook} /><div><div className="text-sm font-semibold text-[#29434a]">{selectedBook.title}</div><div className="text-[11px] text-[#80908b]">{selectedBook.author} · {selectedBook.isbn}</div></div></div><div className="overflow-hidden rounded-sm border border-[#d6d9ce]"><div className="grid grid-cols-[60px_1fr] border-b border-[#d6d9ce] bg-[#edf1ea] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#78908a]"><span>Tag</span><span>Field content</span></div>{[["001", selectedBook.isbn], ["100", `$a ${selectedBook.author}.`], ["245", `$a ${selectedBook.title} / $c ${selectedBook.author}.`], ["260", "$b SC24Lib Press, $c 2024."], ["650", `$a ${selectedBook.category}.`]].map(([tag, content]) => <div key={tag} className="grid grid-cols-[60px_1fr] border-b border-[#e0e2d9] px-3 py-3 font-['JetBrains_Mono'] text-[11px] last:border-b-0"><span className="font-semibold text-[#658a81]">{tag}</span><span className="text-[#45635e]">{content}</span></div>)}</div><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => flash("Record validation passed")} className="rounded-sm border-[#cbd4ca] text-xs">Validate</Button><Button onClick={() => { setModal(null); flash("MARC record saved"); }} className="rounded-sm bg-[#355e57] text-xs">Save record</Button></div></Modal>}

      {modal === "history" && selectedBook && <Modal title="Record history" eyebrow="Audit trail" onClose={() => setModal(null)}><div className="mb-4 flex items-center gap-3 border-b border-[#d6d9ce] pb-4"><Cover book={selectedBook} /><div><div className="text-sm font-semibold text-[#29434a]">{selectedBook.title}</div><StatusBadge status={selectedBook.status} /></div></div><div className="space-y-4">{[["14 May 2024", "Alex Morgan", "Availability checked"], ["02 Apr 2024", "Mina Patel", "Category updated"], ["18 Jan 2024", "System", "Record synchronized"]].map(([date, actor, action], index) => <div key={date} className="flex gap-3"><div className="relative flex flex-col items-center"><span className={`mt-1 h-2.5 w-2.5 rounded-full ${index === 0 ? "bg-[#c8ba72]" : "bg-[#a9bdb2]"}`} />{index < 2 && <span className="h-full w-px bg-[#d6d9ce]" />}</div><div className="pb-2"><div className="text-[11px] font-semibold text-[#45635e]">{action}</div><div className="mt-0.5 text-[10px] text-[#80908b]">{date} · {actor}</div></div></div>)}</div></Modal>}

      {modal === "edit" && selectedBook && <Modal title="Edit details" eyebrow="Catalog record" onClose={() => setModal(null)}><div className="flex items-center gap-3 rounded-sm bg-[#edf1ea] p-3"><Cover book={selectedBook} /><div><div className="text-sm font-semibold text-[#29434a]">{selectedBook.title}</div><div className="text-[11px] text-[#80908b]">Editing opens the complete record in the library workspace.</div></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-sm border border-[#d6d9ce] bg-[#fcfbf6] p-3"><div className="text-[10px] uppercase tracking-[0.15em] text-[#80908b]">Category</div><div className="mt-1 text-xs font-semibold text-[#45635e]">{selectedBook.category}</div></div><div className="rounded-sm border border-[#d6d9ce] bg-[#fcfbf6] p-3"><div className="text-[10px] uppercase tracking-[0.15em] text-[#80908b]">ISBN</div><div className="mt-1 font-['JetBrains_Mono'] text-[11px] text-[#45635e]">{selectedBook.isbn}</div></div></div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setModal(null)} className="rounded-sm border-[#cbd4ca] text-xs">Close</Button><Button onClick={() => { setModal(null); flash("Opening full record editor"); }} className="rounded-sm bg-[#355e57] text-xs">Open editor <Pencil className="ml-2 h-3 w-3" /></Button></div></Modal>}

      {modal === "delete" && selectedBook && <Modal title="Delete this record?" eyebrow="Destructive action" onClose={() => setModal(null)}><div className="rounded-sm border border-[#e7c4be] bg-[#f8eae7] p-4 text-[12px] leading-5 text-[#874d47]">This will remove <strong>{selectedBook.title}</strong> from the local catalog view. The record can be restored from the audit history by an administrator.</div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setModal(null)} className="rounded-sm border-[#cbd4ca] text-xs">Keep record</Button><Button onClick={removeBook} className="rounded-sm bg-[#a9544d] text-xs hover:bg-[#8e463f]"><Trash2 className="mr-2 h-3.5 w-3.5" />Delete record</Button></div></Modal>}

      {modal === "settings" && <Modal title="Catalog settings" eyebrow="Workspace configuration" onClose={() => setModal(null)}><div className="space-y-3"><button onClick={() => flash("Remote catalog settings selected")} className="flex w-full items-center gap-3 rounded-sm border border-[#d6d9ce] bg-[#fcfbf6] p-4 text-left transition-colors hover:bg-[#e8eee7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c8b82]"><Database className="h-4 w-4 text-[#5c8b82]" /><span><span className="block text-xs font-semibold text-[#355e57]">Remote catalog connections</span><span className="mt-0.5 block text-[11px] text-[#80908b]">Configure Z39.50 sources and import rules.</span></span></button><button onClick={() => flash("Policy settings selected")} className="flex w-full items-center gap-3 rounded-sm border border-[#d6d9ce] bg-[#fcfbf6] p-4 text-left transition-colors hover:bg-[#e8eee7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c8b82]"><ShieldCheck className="h-4 w-4 text-[#5c8b82]" /><span><span className="block text-xs font-semibold text-[#355e57]">Collection policies</span><span className="mt-0.5 block text-[11px] text-[#80908b]">Review circulation, retention, and record defaults.</span></span></button></div></Modal>}
    </Shell>
  );
}