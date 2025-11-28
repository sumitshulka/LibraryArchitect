import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { mockBooks } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Search, AlertTriangle, RefreshCcw, Archive, CheckCircle } from "lucide-react";

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Inventory Audit</h1>
          <p className="text-muted-foreground mt-1">Stock verification and asset management.</p>
        </div>
        <Button size="sm" className="gap-2">
          <RefreshCcw className="h-4 w-4" />
          Start New Audit
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12,500</div>
            <p className="text-xs text-muted-foreground mt-1">Physical copies in system</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Verified (This Cycle)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">8,432</div>
            <p className="text-xs text-muted-foreground mt-1">67% completion rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Discrepancies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">42</div>
            <p className="text-xs text-muted-foreground mt-1">Items marked missing</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Current Audit Session: #AUD-2025-003</h3>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Scan or search ISBN..." 
              className="pl-9 h-9" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ISBN / Asset ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Expected Location</TableHead>
              <TableHead>Last Scanned</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockBooks.slice(0, 5).map((book, i) => (
              <TableRow key={book.id}>
                <TableCell className="font-mono text-xs">{book.isbn}</TableCell>
                <TableCell className="font-medium">{book.title}</TableCell>
                <TableCell className="text-muted-foreground">Shelf A-{100 + i}</TableCell>
                <TableCell>{i === 4 ? 'Never' : 'Today, 10:45 AM'}</TableCell>
                <TableCell>
                  {i === 4 ? (
                     <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                       <AlertTriangle className="mr-1 h-3 w-3" /> Missing
                     </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle className="mr-1 h-3 w-3" /> Verified
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">
                    {i === 4 ? 'Mark Found' : 'Details'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </MainLayout>
  );
}
