
'use client';

import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import Nav from "@/components/nav";
import Header from "@/app/dashboard/header";
import { useFirebase } from "@/firebase";
import { ServerCrash } from "lucide-react";
import Logo from "@/components/logo";

function MaintenanceScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-center p-4">
      <div className="mb-4">
        <Logo />
      </div>
      <ServerCrash className="h-16 w-16 text-destructive mb-4" />
      <h1 className="text-3xl font-bold font-headline mb-2">Service Temporarily Unavailable</h1>
      <p className="text-muted-foreground max-w-md">
        The system is currently undergoing maintenance. Please try again later. We apologize for any inconvenience.
      </p>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isMaintenanceMode, isAdmin } = useFirebase();

  if (isMaintenanceMode && !isAdmin) {
    return <MaintenanceScreen />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar collapsible="icon">
          <Nav />
        </Sidebar>
        <SidebarInset className="flex flex-col flex-1">
          <Header />
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto bg-muted/30">
            <div className="w-full">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
