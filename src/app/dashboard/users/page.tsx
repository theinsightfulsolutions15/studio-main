
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, updateDoc, getDocs, query as firestoreQuery, where } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useState, useMemo } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';


// Helper function to generate the next customer ID
const getNextCustomerId = (users: AppUser[] | null): string => {
    if (!users || users.length === 0) {
        return 'G-001';
    }

    const existingIds = users
        .map(u => u.customerId)
        .filter((id): id is string => !!id && id.startsWith('G-'))
        .map(id => parseInt(id.substring(2), 10))
        .filter(num => !isNaN(num));

    if (existingIds.length === 0) {
        return 'G-001';
    }

    const maxId = Math.max(...existingIds);
    return `G-${(maxId + 1).toString().padStart(3, '0')}`;
};

function UserRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32 hidden sm:block" />
          </div>
        </div>
      </TableCell>
       <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell>
        <Skeleton className="h-8 w-8 rounded-md" />
      </TableCell>
    </TableRow>
  );
}


export default function UsersPage() {
  const firestore = useFirestore();
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [isApproving, setIsApproving] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [validityDate, setValidityDate] = useState<Date | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [authUser, firestore]);

  const { data: currentUser, isLoading: isUserLoading } = useDoc<AppUser>(userDocRef);

  const isAdmin = currentUser?.role === 'Admin';
  
  const usersCollection = useMemoFirebase(() => {
    if (!isAdmin || !firestore) return null;
    return collection(firestore, 'users');
  }, [isAdmin, firestore]);

  const { data: users, isLoading: isLoadingUsers } = useCollection<AppUser>(usersCollection);

  const dataToDisplay = useMemo(() => {
    if(isAdmin) return users;
    if(currentUser) return [currentUser];
    return [];
  }, [isAdmin, users, currentUser]);


  const handleApproveUser = async () => {
    if (!firestore || !selectedUser || !validityDate) {
        toast({
            variant: 'destructive',
            title: 'Approval Failed',
            description: 'Please select a validity date.',
        });
        return;
    }
    setIsApproving(selectedUser.id);
    try {
        const newCustomerId = getNextCustomerId(users);
        const userDocToUpdateRef = doc(firestore, 'users', selectedUser.id);

        await updateDocumentNonBlocking(userDocToUpdateRef, {
            status: 'Active',
            customerId: newCustomerId,
            validityDate: validityDate.toISOString().split('T')[0],
        });

        toast({
            title: 'User Approved',
            description: `The user has been approved with Customer ID: ${newCustomerId}`,
        });
    } catch (error) {
        console.error("Error approving user:", error);
        toast({
            variant: 'destructive',
            title: 'Approval Failed',
            description: 'Could not approve the user. Please try again.',
        });
    } finally {
        setIsApproving(null);
        setSelectedUser(null);
        setValidityDate(undefined);
        setDialogOpen(false);
    }
  };

  const openApprovalDialog = (user: AppUser) => {
    setSelectedUser(user);
    setDialogOpen(true);
  }

  const isLoading = isAuthUserLoading || isUserLoading || (isAdmin && isLoadingUsers);


  if (isLoading) {
      return (
        <Card>
            <CardHeader>
                <CardTitle>Loading Users...</CardTitle>
                <CardDescription>Please wait while we fetch the user data.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead className="hidden sm:table-cell">Customer ID</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="hidden md:table-cell">Validity Date</TableHead>
                            <TableHead><span className="sr-only">Actions</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 5 }).map((_, i) => <UserRowSkeleton key={i} />)}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      )
  }
  
  if (!isAdmin && !currentUser) {
    // This state can happen briefly while currentUser is loading.
    // Or if a non-admin user somehow has no user document.
    return (
        <Card>
            <CardHeader>
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>You do not have permission to view this page or your user profile could not be loaded.</CardDescription>
            </CardHeader>
             <CardContent>
                <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
            </CardContent>
        </Card>
    );
  }


  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
                <CardTitle>{isAdmin ? 'User Management' : 'My Profile'}</CardTitle>
                <CardDescription>{isAdmin ? 'Manage user accounts and roles.' : 'View your profile details.'}</CardDescription>
            </div>
            {isAdmin && (
                <Button disabled={!isAdmin}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite User
                </Button>
            )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="hidden sm:table-cell">Customer ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Validity Date</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(isLoading) && Array.from({ length: 4 }).map((_, i) => <UserRowSkeleton key={i} />)}
            {dataToDisplay?.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                    <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarImage src={user.photoURL || `https://i.pravatar.cc/150?u=${user.email}`} alt={user.name} />
                            <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="font-medium truncate">
                            {user.name}
                            <div className="text-sm text-muted-foreground truncate hidden sm:block">{user.email}</div>
                        </div>
                    </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{user.customerId || 'N/A'}</TableCell>
                <TableCell>
                  <Badge variant={user.status === 'Active' ? 'secondary' : user.status === 'Pending' ? 'default' : 'destructive'} className="bg-opacity-80">
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">{user.validityDate ? format(new Date(user.validityDate), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost" disabled={!isAdmin || isApproving === user.id}>
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {user.status === 'Pending' && (
                            <DropdownMenuItem onSelect={() => openApprovalDialog(user)}>
                                Approve User
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem disabled={!isAdmin}>Edit Role</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" disabled={!isAdmin}>Deactivate User</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
       <CardFooter>
        <div className="text-xs text-muted-foreground">
          Showing <strong>{dataToDisplay?.length ?? 0}</strong> of <strong>{dataToDisplay?.length ?? 0}</strong> users
        </div>
      </CardFooter>
    </Card>

    <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Approve User: {selectedUser?.name}</AlertDialogTitle>
            <AlertDialogDescription>
                Select a validity date for this user. They will have full access until this date.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="validity-date" className="text-right">
                        Validity
                    </Label>
                    <div className="col-span-3">
                        <DatePicker date={validityDate} setDate={setValidityDate} />
                    </div>
                </div>
            </div>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApproveUser} disabled={!validityDate || !!isApproving}>
                {isApproving ? 'Approving...' : 'Approve'}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    </>
  );
}
