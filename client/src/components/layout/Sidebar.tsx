import { Link, useLocation } from "wouter";
import { navItems, navGroups } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Sheet, SheetContent } from "@/components/ui/sheet";


interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const [location] = useLocation();
  const { user } = useAuth();

  const isLocalAdmin = user?.role === 'ADMIN' && user?.isLocalUser;

  const visibleItems = navItems.filter(item => {
    if (item.localAdminOnly && !isLocalAdmin) return false;
    return true;
  });

  const itemsByLabel = new Map(visibleItems.map(item => [item.label, item]));

  const visibleGroups = navGroups
    .map(group => ({
      title: group.title,
      items: group.items.map(label => itemsByLabel.get(label)).filter((item): item is NonNullable<typeof item> => !!item),
    }))
    .filter(group => group.items.length > 0);

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src="/sc24lib-logo.png" alt="SC24Lib" className="h-8 w-auto" />
        </div>
      </div>

      <div className="flex-1 py-4 flex flex-col gap-4 px-3 overflow-y-auto">
        {visibleGroups.map((group, groupIndex) => (
          <div key={group.title ?? `group-${groupIndex}`} className="flex flex-col gap-1">
            {group.title && (
              <div
                className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40"
                data-testid={`heading-nav-${group.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const hasMoreSpecificMatch = visibleItems.some(
                other => other.href !== item.href && other.href.startsWith(item.href) && location.startsWith(other.href)
              );
              const isActive = !hasMoreSpecificMatch && (location === item.href || (item.href !== '/' && location.startsWith(item.href)));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onLinkClick}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-sidebar-border flex-shrink-0">
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
    </div>
  );
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 hidden md:flex flex-col border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar — Sheet overlay */}
      <Sheet open={mobileOpen} onOpenChange={(open) => { if (!open) onMobileClose?.(); }}>
        <SheetContent side="left" className="p-0 w-64 border-r border-sidebar-border" data-testid="mobile-sidebar">
          <SidebarContent onLinkClick={onMobileClose} />
        </SheetContent>
      </Sheet>
    </>
  );
}
