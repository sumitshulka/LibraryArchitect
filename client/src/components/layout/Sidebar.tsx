import { Link, useLocation } from "wouter";
import { navItems } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import logo from "@assets/generated_images/minimalist_abstract_library_logo_icon.png";

export function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const isLocalAdmin = user?.role === 'ADMIN' && user?.isLocalUser;

  const visibleItems = navItems.filter(item => {
    if (item.localAdminOnly && !isLocalAdmin) return false;
    return true;
  });

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border hidden md:flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={logo} alt="LibraTech" className="h-8 w-8 rounded-md bg-white p-1" />
          <span className="font-bold text-lg tracking-tight">LibraTech</span>
        </div>
      </div>

      <div className="flex-1 py-6 flex flex-col gap-1 px-3">
        {visibleItems.map((item) => {
          const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}>
                <item.icon className="h-4 w-4" />
                {item.label}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 p-2 rounded-md hover:bg-sidebar-accent cursor-pointer">
          <div className="h-8 w-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-xs">
            {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{user?.name || 'User'}</span>
            <span className="text-xs text-sidebar-foreground/60">{user?.role || ''}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
