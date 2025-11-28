import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { dashboardStats, mockCirculation, mockBooks } from "@/lib/mock-data";
import { Book, Users, Repeat, AlertCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from "recharts";

function StatCard({ title, value, icon: Icon, trend, trendValue, subtext }: any) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
          {trend && (
            <div className={`text-xs flex items-center ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {trend === 'up' ? <ArrowUpRight className="mr-1 h-3 w-3" /> : <ArrowDownRight className="mr-1 h-3 w-3" />}
              {trendValue}
              <span className="text-muted-foreground ml-1">{subtext}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <MainLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of library operations and key metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md border">
            Last updated: Today, 10:23 AM
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Catalog" 
          value={dashboardStats.totalBooks} 
          icon={Book} 
          trend="up" 
          trendValue="+120" 
          subtext="new this month" 
        />
        <StatCard 
          title="Active Loans" 
          value={dashboardStats.booksIssued} 
          icon={Repeat} 
          trend="up" 
          trendValue="+12%" 
          subtext="vs last month" 
        />
        <StatCard 
          title="Overdue Items" 
          value={dashboardStats.overdue} 
          icon={AlertCircle} 
          trend="down" 
          trendValue="-5%" 
          subtext="vs last month" 
        />
        <StatCard 
          title="Total Patrons" 
          value={dashboardStats.totalMembers} 
          icon={Users} 
          trend="up" 
          trendValue="+45" 
          subtext="new members" 
        />
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Circulation Trends</CardTitle>
            <CardDescription>Daily check-outs vs returns over the last week.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardStats.circulationTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `${value}`} 
                  />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend />
                  <Bar dataKey="issues" name="Checkouts" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="returns" name="Returns" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest circulation events.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {mockCirculation.map((record, i) => {
                const book = mockBooks.find(b => b.id === record.bookId);
                return (
                  <div key={i} className="flex items-center">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center border ${
                      record.status === 'OVERDUE' ? 'bg-red-100 border-red-200 text-red-600' : 
                      record.status === 'RETURNED' ? 'bg-green-100 border-green-200 text-green-600' : 
                      'bg-blue-100 border-blue-200 text-blue-600'
                    }`}>
                      {record.status === 'OVERDUE' ? <AlertCircle className="h-4 w-4" /> : 
                       record.status === 'RETURNED' ? <Repeat className="h-4 w-4" /> : 
                       <Book className="h-4 w-4" />}
                    </div>
                    <div className="ml-4 space-y-1">
                      <p className="text-sm font-medium leading-none">{book?.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {record.status === 'RETURNED' ? 'Returned by' : 'Checked out by'} User #{record.userId}
                      </p>
                    </div>
                    <div className="ml-auto font-medium text-xs text-muted-foreground">
                      {record.checkoutDate}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
