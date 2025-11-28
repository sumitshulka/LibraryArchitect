import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { circulationApi, booksApi, usersApi } from "@/lib/api";
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
import { Search, QrCode, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

export default function CirculationPage() {
  const [checkoutIsbn, setCheckoutIsbn] = useState("");
  const [checkoutUserId, setCheckoutUserId] = useState("");

  const { data: circulation = [] } = useQuery({
    queryKey: ["circulation"],
    queryFn: () => circulationApi.getAll(),
  });

  const { data: books = [] } = useQuery({
    queryKey: ["books"],
    queryFn: () => booksApi.getAll(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.getAll,
  });

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Circulation</h1>
          <p className="text-muted-foreground mt-1">Process checkouts, returns, and manage holds.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Quick Checkout
            </CardTitle>
            <CardDescription>Scan ISBN or enter details manually</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input 
                placeholder="Scan Member ID or Search Name..." 
                value={checkoutUserId}
                onChange={(e) => setCheckoutUserId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Input 
                placeholder="Scan Book ISBN..." 
                value={checkoutIsbn}
                onChange={(e) => setCheckoutIsbn(e.target.value)}
              />
            </div>
            <Button className="w-full gap-2">
              <RefreshCw className="h-4 w-4" />
              Process Checkout
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Quick Return
            </CardTitle>
            <CardDescription>Process returns and calculate fines</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Scan Book ISBN to Return..." className="flex-1" />
              <Button variant="secondary">Check Item</Button>
            </div>
            <div className="p-4 bg-muted/50 rounded-md text-sm text-muted-foreground text-center h-[108px] flex items-center justify-center border border-dashed">
              Scan an item to see return details
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-lg border shadow-sm mt-6">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Active Transactions</h3>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search transactions..." className="pl-9 h-9" />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Patron</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {circulation.map((record) => {
              const book = books.find(b => b.id === record.bookId);
              const user = users.find(u => u.id === record.userId);
              
              return (
                <TableRow key={record.id}>
                  <TableCell className="font-mono text-xs">{record.id}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{book?.title}</span>
                      <span className="text-xs text-muted-foreground">ISBN: {book?.isbn}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{user?.name}</span>
                      <span className="text-xs text-muted-foreground">{user?.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className={record.status === 'OVERDUE' ? "text-red-600 font-medium" : ""}>
                    {new Date(record.dueDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`
                      ${record.status === 'OVERDUE' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                      ${record.status === 'ACTIVE' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                      ${record.status === 'RETURNED' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                    `}>
                      {record.status === 'OVERDUE' && <AlertCircle className="mr-1 h-3 w-3" />}
                      {record.status === 'RETURNED' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                      {record.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Details</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </MainLayout>
  );
}
