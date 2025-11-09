
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
} from 'lucide-react';
import { doc } from 'firebase/firestore';
import {
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import type { NavItem, User as AppUser } from '@/lib/types';
import Logo from './logo';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';

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
    { href: '/dashboard/user-approvals', title: 'User Approvals', icon: UserCheck },
    { href: '/dashboard/amc', title: 'AMC Renewals', icon: ShieldCheck },
];

const settingsItem: NavItem = {
  href: '/dashboard/settings',
  title: 'Settings',
  icon: Settings,
};

export default function Nav() {
  const pathname = usePathname();
  const { user: authUser } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!authUser || !firestore) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [authUser, firestore]);

  const { data: currentUser, isLoading } = useDoc<AppUser>(userDocRef);

  const isAdmin = currentUser?.role === 'Admin';

  const navItems = isAdmin ? [...baseNavItems, ...masterNavItems, ...adminNavItems] : [...baseNavItems, ...masterNavItems];


  return (
    <>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {isLoading && Array.from({ length: 6 }).map((_, i) => (
             <SidebarMenuItem key={i}>
                <SidebarMenuButton tooltip="Loading..." asChild>
                    <div className="flex items-center gap-2 p-2">
                        <div className="h-4 w-4 bg-muted rounded" />
                        <div className="h-4 w-20 bg-muted rounded" />
                    </div>
                </SidebarMenuButton>
             </SidebarMenuItem>
          ))}
          {!isLoading && navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(item.href)}
                tooltip={item.title}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
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
