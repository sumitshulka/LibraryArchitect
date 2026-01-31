import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Building2, Clock, MapPin, Phone, Mail, ExternalLink } from "lucide-react";

export default function PublicHomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">LibraTech</h1>
              <p className="text-xs text-muted-foreground">Library Management System</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold tracking-tight mb-4">
            Welcome to the University Library
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Access millions of books, journals, and digital resources to support your academic journey.
          </p>
          
          <Card className="mb-12 border-2 border-primary/20 bg-primary/5">
            <CardContent className="p-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Building2 className="h-8 w-8 text-primary" />
                <h3 className="text-2xl font-semibold">Staff & Student Access</h3>
              </div>
              <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
                To access the full library system, please log in through your institution's portal. 
                The library system is integrated with the campus ERP for seamless authentication.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="gap-2" disabled>
                  <ExternalLink className="h-5 w-5" />
                  Access via Institution Portal
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                If you're a student or faculty member, please access the library through your campus portal or ERP system.
              </p>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card>
              <CardContent className="p-6 text-center">
                <Clock className="h-10 w-10 mx-auto mb-4 text-primary" />
                <h4 className="font-semibold mb-2">Library Hours</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Monday - Friday: 8:00 AM - 10:00 PM</p>
                  <p>Saturday: 9:00 AM - 6:00 PM</p>
                  <p>Sunday: 12:00 PM - 8:00 PM</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <MapPin className="h-10 w-10 mx-auto mb-4 text-primary" />
                <h4 className="font-semibold mb-2">Location</h4>
                <div className="text-sm text-muted-foreground">
                  <p>Main Campus Library</p>
                  <p>Building A, First Floor</p>
                  <p>University Campus</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Phone className="h-10 w-10 mx-auto mb-4 text-primary" />
                <h4 className="font-semibold mb-2">Contact Us</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="flex items-center justify-center gap-2">
                    <Phone className="h-4 w-4" /> +1 (555) 123-4567
                  </p>
                  <p className="flex items-center justify-center gap-2">
                    <Mail className="h-4 w-4" /> library@university.edu
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <h4 className="font-semibold mb-4">Quick Stats</h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-3xl font-bold text-primary">500K+</div>
                    <div className="text-sm text-muted-foreground">Physical Books</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-3xl font-bold text-primary">1M+</div>
                    <div className="text-sm text-muted-foreground">Digital Resources</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-3xl font-bold text-primary">50+</div>
                    <div className="text-sm text-muted-foreground">Study Rooms</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-3xl font-bold text-primary">24/7</div>
                    <div className="text-sm text-muted-foreground">Online Access</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h4 className="font-semibold mb-4">Services</h4>
                <ul className="space-y-3 text-left">
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-primary">1</span>
                    </div>
                    <span className="text-sm">Book borrowing and returns</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-primary">2</span>
                    </div>
                    <span className="text-sm">Inter-library loan requests</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-primary">3</span>
                    </div>
                    <span className="text-sm">Research assistance and consultations</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-primary">4</span>
                    </div>
                    <span className="text-sm">Study room reservations</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-primary">5</span>
                    </div>
                    <span className="text-sm">Digital resource access</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <footer className="border-t mt-12 py-6 bg-muted/30">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>LibraTech Library Management System</p>
          <p className="mt-1">Powered by Enterprise Library Solutions</p>
        </div>
      </footer>
    </div>
  );
}
