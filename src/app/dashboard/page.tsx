
'use client';

import { useCollection, useMemoFirebase, useFirestore, useUser, useDoc } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import type { Animal, MilkRecord, FinancialRecord, User as AppUser, AmcRenewal } from '@/lib/types';
import { Users, UserCheck, UserPlus, ShieldCheck, Droplets, IndianRupee, Beef, AlertTriangle, Plus, Truck, GlassWater, BookUser } from 'lucide-react';
import { useMemo } from 'react';
import { format, isSameDay, isSameMonth, startOfMonth, isPast } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useIsMobile } from '@/hooks/use-mobile';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


function StatCard({ title, value, icon: Icon, description }: { title: string, value: number | string, icon: React.ElementType, description?: string }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </CardContent>
        </Card>
    );
}

function AdminDashboard() {
  const { firestore } = useUser();

  // Queries for Admin Stats
  const allUsersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const pendingUsersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), where('status', '==', 'Pending')) : null, [firestore]);
  const activeUsersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), where('status', '==', 'Active')) : null, [firestore]);
  const pendingRenewalsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'amc_renewals'), where('status', '==', 'Pending')) : null, [firestore]);

  const { data: allUsers, isLoading: isLoadingAllUsers } = useCollection<AppUser>(allUsersQuery);
  const { data: pendingUsers, isLoading: isLoadingPendingUsers } = useCollection<AppUser>(pendingUsersQuery);
  const { data: activeUsers, isLoading: isLoadingActiveUsers } = useCollection<AppUser>(activeUsersQuery);
  const { data: pendingRenewals, isLoading: isLoadingRenewals } = useCollection<AmcRenewal>(pendingRenewalsQuery);

  const isLoading = isLoadingAllUsers || isLoadingPendingUsers || isLoadingActiveUsers || isLoadingRenewals;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium"><Spinner /></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold"><Spinner /></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={allUsers?.length ?? 0} icon={Users} description="All registered users in the system." />
        <StatCard title="Pending Users" value={pendingUsers?.length ?? 0} icon={UserPlus} description="Users awaiting approval." />
        <StatCard title="Active Users" value={activeUsers?.length ?? 0} icon={UserCheck} description="Users with active accounts." />
        <StatCard title="Pending Renewals" value={pendingRenewals?.length ?? 0} icon={ShieldCheck} description="AMC renewal requests to be approved." />
    </div>
  );
}


function UserDashboard() {
    const { user } = useUser();
    const firestore = useFirestore();

    const userDocRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
    const { data: userData } = useDoc<AppUser>(userDocRef);

    const animalsQuery = useMemoFirebase(() => (firestore && user ? collection(firestore, `users/${user.uid}/animals`) : null), [firestore, user]);
    const milkRecordsQuery = useMemoFirebase(() => (firestore && user ? collection(firestore, `users/${user.uid}/milk_records`) : null), [firestore, user]);
    const financialRecordsQuery = useMemoFirebase(() => (firestore && user ? query(collection(firestore, `users/${user.uid}/financial_records`), where('recordType', '==', 'Milk Sale')) : null), [firestore, user]);

    const { data: animals, isLoading: isLoadingAnimals } = useCollection<Animal>(animalsQuery);
    const { data: milkRecords, isLoading: isLoadingMilk } = useCollection<MilkRecord>(milkRecordsQuery);
    const { data: financialRecords, isLoading: isLoadingFinancial } = useCollection<FinancialRecord>(financialRecordsQuery);

    const today = new Date();
    const firstDayOfMonth = startOfMonth(today);

    const { todayProduction, monthProduction } = useMemo(() => {
        if (!milkRecords) return { todayProduction: 0, monthProduction: 0 };
        return milkRecords.reduce((acc, record) => {
            const recordDate = new Date(record.date);
            if (isSameDay(recordDate, today)) {
                acc.todayProduction += record.quantity;
            }
            if (isSameMonth(recordDate, today)) {
                acc.monthProduction += record.quantity;
            }
            return acc;
        }, { todayProduction: 0, monthProduction: 0 });
    }, [milkRecords, today]);

    const { todaySales, monthSales } = useMemo(() => {
        if (!financialRecords) return { todaySales: 0, monthSales: 0 };
        return financialRecords.reduce((acc, record) => {
            const recordDate = new Date(record.date);
            if (isSameDay(recordDate, today)) {
                acc.todaySales += record.amount;
            }
            if (isSameMonth(recordDate, today)) {
                acc.monthSales += record.amount;
            }
            return acc;
        }, { todaySales: 0, monthSales: 0 });
    }, [financialRecords, today]);
    
    const isExpired = useMemo(() => {
        if (!userData?.validityDate) return false;
        return isPast(new Date(userData.validityDate));
    }, [userData]);


    const isLoading = isLoadingAnimals || isLoadingMilk || isLoadingFinancial;

     if (isLoading) {
        return (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium"><Spinner /></CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold"><Spinner /></div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
    }

    return (
        <div className="space-y-6">
            {isExpired && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Account Expired</AlertTitle>
                    <AlertDescription className="flex justify-between items-center">
                        Your account subscription has expired. Please renew to continue accessing all features.
                        <Button asChild variant="outline" className="text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive">
                           <Link href="/dashboard/renewal">Renew Now</Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <StatCard title="Total Animals" value={animals?.length ?? 0} icon={Beef} description="Total animals in your gaushala" />
            <StatCard title="Today's Production" value={`${todayProduction.toFixed(2)} L`} icon={Droplets} description={`Total milk collected today`} />
            <StatCard title="Monthly Production" value={`${monthProduction.toFixed(2)} L`} icon={Droplets} description={`Since ${format(firstDayOfMonth, "MMM dd")}`} />
            <StatCard title="Today's Sales" value={`₹${todaySales.toFixed(2)}`} icon={IndianRupee} description="Total revenue from milk sales today" />
            <StatCard title="Monthly Sales" value={`₹${monthSales.toFixed(2)}`} icon={IndianRupee} description={`Since ${format(firstDayOfMonth, "MMM dd")}`} />
            </div>
        </div>
    );
}

export default function Dashboard() {
  const { isUserLoading, isAdmin } = useUser();
  const isMobile = useIsMobile();

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div>
        <div className="mb-6">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
                {isAdmin ? 'An overview of system activity.' : 'A summary of your Gaushala records.'}
            </p>
        </div>
        {isAdmin ? <AdminDashboard /> : <UserDashboard />}
        
        {isMobile && !isAdmin && (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="icon" className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-20">
                        <Plus className="h-6 w-6" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" className="w-56 mb-2">
                    <DropdownMenuItem asChild>
                        <Link href="/dashboard/master/animals">
                            <Beef /><span>Add Animal</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/dashboard/movement">
                            <Truck /><span>Add Movement</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/dashboard/milk-records">
                            <GlassWater /><span>Add Production</span>
                        </Link>
                    </DropdownMenuItem>
                     <DropdownMenuItem asChild>
                        <Link href="/dashboard/milk-records">
                            <IndianRupee /><span>Add Milk Sale</span>
                        </Link>
                    </DropdownMenuItem>
                     <DropdownMenuItem asChild>
                        <Link href="/dashboard/finance">
                            <IndianRupee /><span>Add New Transaction</span>
                        </Link>
                    </DropdownMenuItem>
                     <DropdownMenuItem asChild>
                        <Link href="/dashboard/master/accounts">
                            <BookUser /><span>Add Accounts</span>
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )}
    </div>
  );
}
