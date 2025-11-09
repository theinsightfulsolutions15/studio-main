
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  IndianRupee,
  BarChart2,
  Settings,
  GlassWater,
  Beef,
  Truck,
  ShieldCheck,
  UserCheck,
  BookUser,
  BookCopy,
  LifeBuoy,
  Bug,
} from 'lucide-react';
import { doc, collection, query, where } from 'firebase/firestore';
import {
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarMenuSkeleton,
  SidebarMenuBadge,
} from '@/components/ui/sidebar';
import type { NavItem, User as AppUser, AmcRenewal, SupportTicket } from '@/lib/types';
import Logo from './logo';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';

const baseNavItems: NavItem[] = [
  { href: '/dashboard', title: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/movement', title: 'Movement', icon: Truck },
  { href: '/dashboard/milk-records', title: 'Milk Records', icon: GlassWater },
  { href: '/dashboard/finance', title: 'Finance', icon: IndianRupee },
  { href: '/dashboard/ledger', title: 'Ledger', icon: BookCopy },
  { href: '/dashboard/reports', title: 'Reports', icon: BarChart2 },
];

const masterNavItems: NavItem[] = [
    { href: '/dashboard/master/animals', title: 'Animals', icon: Beef },
    { href: '/dashboard/master/accounts', title: 'Accounts', icon: BookUser },
];

const adminNavItems: NavItem[] = [
    { href: '/dashboard/users', title: 'Users', icon: Users },
    { href: '/dashboard/user-approvals', title: 'User Approvals', icon: UserCheck, id: 'user-approvals' },
    { href: '/dashboard/amc', title: 'AMC Renewals', icon: ShieldCheck, id: 'amc-renewals' },
    { href: '/dashboard/support-tickets', title: 'Support Tickets', icon: Bug, id: 'support-tickets' },
];

const supportItem: NavItem = {
    href: '/dashboard/support',
    title: 'Support',
    icon: LifeBuoy,
};

const settingsItem: NavItem = {
  href: '/dashboard/settings',
  title: 'Settings',
  icon: Settings,
};

export default function Nav() {
  const pathname = usePathname();
  const { user: authUser, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!authUser || !firestore) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [authUser, firestore]);

  const { data: currentUser, isLoading: isCurrentUserLoading } = useDoc<AppUser>(userDocRef);

  const isAdmin = currentUser?.role === 'Admin';
  
  const pendingRenewalsQuery = useMemoFirebase(() => {
    if (!isAdmin || !firestore) return null;
    return query(collection(firestore, 'amc_renewals'), where('status', '==', 'Pending'));
  }, [isAdmin, firestore]);
  
  const { data: pendingRenewals } = useCollection<AmcRenewal>(pendingRenewalsQuery);
  const pendingRenewalsCount = pendingRenewals?.length ?? 0;

  const pendingUsersQuery = useMemoFirebase(() => {
    if (!isAdmin || !firestore) return null;
    return query(collection(firestore, 'users'), where('status', '==', 'Pending'));
  }, [isAdmin, firestore]);
  const { data: pendingUsers } = useCollection<AppUser>(pendingUsersQuery);
  const pendingUsersCount = pendingUsers?.length ?? 0;

  const openTicketsQuery = useMemoFirebase(() => {
    if (!isAdmin || !firestore) return null;
    return query(collection(firestore, 'support_tickets'), where('status', '==', 'Open'));
  }, [isAdmin, firestore]);
  const { data: openTickets } = useCollection<SupportTicket>(openTicketsQuery);
  const openTicketsCount = openTickets?.length ?? 0;


  const isLoading = isUserLoading || isCurrentUserLoading;

  const navItems = isAdmin 
    ? [...baseNavItems, ...masterNavItems, ...adminNavItems] 
    : [...baseNavItems, ...masterNavItems];

  return (
    <>
      <SidebarHeader className="items-center">
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {isLoading && Array.from({ length: 8 }).map((_, i) => (
             <SidebarMenuItem key={i}>
                <div className="flex items-center gap-2 p-2 h-8 w-full">
                    <SidebarMenuSkeleton showIcon />
                </div>
             </SidebarMenuItem>
          ))}
          {!isLoading && navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
                tooltip={item.title}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
              {item.id === 'amc-renewals' && pendingRenewalsCount > 0 && (
                <SidebarMenuBadge>{pendingRenewalsCount}</SidebarMenuBadge>
              )}
              {item.id === 'user-approvals' && pendingUsersCount > 0 && (
                <SidebarMenuBadge>{pendingUsersCount}</SidebarMenuBadge>
              )}
              {item.id === 'support-tickets' && openTicketsCount > 0 && (
                <SidebarMenuBadge>{openTicketsCount}</SidebarMenuBadge>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
             <SidebarMenuItem>
                <SidebarMenuButton
                    asChild
                    isActive={pathname === supportItem.href}
                    tooltip={supportItem.title}
                >
                    <Link href={supportItem.href}>
                        <supportItem.icon />
                        <span>{supportItem.title}</span>
                    </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                    asChild
                    isActive={pathname === settingsItem.href}
                    tooltip={settingsItem.title}
                >
                    <Link href={settingsItem.href}>
                        <settingsItem.icon />
                        <span>{settingsItem.title}</span>
                    </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
          </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
