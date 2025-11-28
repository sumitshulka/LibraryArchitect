import { Bell, Search, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopBar() {
  return (
    <header className="h-16 border-b bg-background sticky top-0 z-40 flex items-center justify-between px-6">
      <div className="flex items-center gap-4 md:hidden">
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
        </Button>
        <span className="font-bold">LibraTech</span>
      </div>

      <div className="hidden md:flex items-center w-1/3">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search books, patrons, or ISBN..." 
            className="pl-9 bg-muted/40 border-muted-foreground/20 focus-visible:ring-sidebar-primary"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
             <Button variant="ghost" size="sm" className="gap-2">
               <span className="hidden sm:inline-block text-sm font-medium text-muted-foreground">ERP Connected</span>
               <div className="h-2 w-2 rounded-full bg-green-500" />
             </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>System Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>ERP Sync: Active</DropdownMenuItem>
            <DropdownMenuItem>DB Status: Healthy</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
