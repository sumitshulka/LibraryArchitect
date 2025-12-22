import { MainLayout } from "@/components/layout/MainLayout";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from "recharts";
import { Download, Calendar, Filter } from "lucide-react";
import { useCurrency } from "@/lib/useCurrency";

const monthlyData = [
  { name: 'Jan', issues: 400, returns: 350, fines: 120 },
  { name: 'Feb', issues: 300, returns: 280, fines: 90 },
  { name: 'Mar', issues: 550, returns: 500, fines: 150 },
  { name: 'Apr', issues: 450, returns: 420, fines: 110 },
  { name: 'May', issues: 600, returns: 580, fines: 200 },
  { name: 'Jun', issues: 350, returns: 340, fines: 80 },
];

const categoryData = [
  { name: 'Computer Science', value: 450, color: 'hsl(var(--chart-1))' },
  { name: 'Fiction', value: 320, color: 'hsl(var(--chart-2))' },
  { name: 'History', value: 210, color: 'hsl(var(--chart-3))' },
  { name: 'Science', value: 180, color: 'hsl(var(--chart-4))' },
  { name: 'Biography', value: 150, color: 'hsl(var(--chart-5))' },
];

export default function ReportsPage() {
  const { currency } = useCurrency();
  
  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Detailed insights into library usage and performance.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Calendar className="h-4 w-4" />
            Last 6 Months
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="circulation" className="w-full">
        <TabsList>
          <TabsTrigger value="circulation">Circulation</TabsTrigger>
          <TabsTrigger value="acquisitions">Acquisitions</TabsTrigger>
          <TabsTrigger value="fines">Fines & Revenue</TabsTrigger>
        </TabsList>
        
        <TabsContent value="circulation" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Circulation Trends</CardTitle>
                <CardDescription>Checkouts vs Returns over time</CardDescription>
              </CardHeader>
              <CardContent className="pl-0">
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: 'transparent'}} />
                      <Legend />
                      <Bar dataKey="issues" name="Issues" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="returns" name="Returns" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Popular Categories</CardTitle>
                <CardDescription>Distribution of borrowed items by genre</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fines" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue from Fines</CardTitle>
              <CardDescription>Collected fines from overdue books and lost items</CardDescription>
            </CardHeader>
            <CardContent className="pl-0">
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${currency.symbol}${value}`} />
                    <Tooltip formatter={(value) => [`${currency.symbol}${value}`, 'Amount']} />
                    <Legend />
                    <Line type="monotone" dataKey="fines" name={`Fines Collected (${currency.symbol})`} stroke="hsl(var(--destructive))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
