import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col md:ml-64 transition-all duration-300 ease-in-out">
        <TopBar />
        <main className="flex-1 p-6 overflow-auto bg-muted/20">
          <div className="max-w-7xl w-full space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
