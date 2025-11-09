
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, query as firestoreQuery, where, getDocs, updateDoc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { format } from 'date-fns';


// Helper function to generate the next customer ID
const getNextCustomerId = (allUsers: AppUser[] | null): string => {
    if (!allUsers || allUsers.length === 0) {
        return 'G-001';
    }

    const existingIds = allUsers
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
       <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
      <TableCell>
        <Skeleton className="h-8 w-24 rounded-md" />
      </TableCell>
    </TableRow>
  );
}


export default function UserApprovalsPage() {
  const firestore = useFirestore();
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const { toast } = useToast();
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
  
  const pendingUsersQuery = useMemoFirebase(() => {
    if (!isAdmin || !firestore) return null;
    return firestoreQuery(collection(firestore, 'users'), where('status', '==', 'Pending'));
  }, [isAdmin, firestore]);

  const allUsersQuery = useMemoFirebase(() => {
    if (!isAdmin || !firestore) return null;
    return collection(firestore, 'users');
  }, [isAdmin, firestore]);


  const { data: pendingUsers, isLoading: isLoadingPendingUsers } = useCollection<AppUser>(pendingUsersQuery);
  const { data: allUsers } = useCollection<AppUser>(allUsersQuery);


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
        const newCustomerId = getNextCustomerId(allUsers);
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

  if (isUserLoading || isAuthUserLoading) {
      return (
        <Card>
            <CardHeader>
                <CardTitle>Loading User Approvals...</CardTitle>
                <CardDescription>Please wait while we fetch the data.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead className="hidden sm:table-cell">Signup Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 3 }).map((_, i) => <UserRowSkeleton key={i} />)}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      )
  }
  
  if (!isAdmin) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>You do not have permission to view this page.</CardDescription>
            </CardHeader>
        </Card>
    );
  }


  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>User Approvals</CardTitle>
        <CardDescription>Review and approve new user registrations.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="hidden sm:table-cell">Signup Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(isLoadingPendingUsers) && Array.from({ length: 3 }).map((_, i) => <UserRowSkeleton key={i} />)}
            {pendingUsers?.map((user) => (
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
                <TableCell className="hidden sm:table-cell">{format(new Date(user.signupDate), 'dd/MM/yyyy')}</TableCell>
                <TableCell>
                  <Badge variant={user.status === 'Pending' ? 'default' : 'destructive'} className="bg-opacity-80">
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button 
                    size="sm"
                    onClick={() => openApprovalDialog(user)}
                    disabled={!isAdmin || isApproving === user.id}
                   >
                     {isApproving === user.id ? 'Approving...' : 'Approve'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
             {pendingUsers && pendingUsers.length === 0 && (
                <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                        No pending user approvals.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
       <CardFooter>
        <div className="text-xs text-muted-foreground">
          Showing <strong>{pendingUsers?.length ?? 0}</strong> pending approvals
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
