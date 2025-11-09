
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
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { AmcRenewal, User as AppUser } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { format } from 'date-fns';

function RenewalRowSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-8 w-24 rounded-md" /></TableCell>
    </TableRow>
  );
}

export default function AmcRenewalsPage() {
  const firestore = useFirestore();
  const { user: authUser, isUserLoading: isAuthUserLoading } = useUser();
  const { toast } = useToast();
  
  const [selectedRenewal, setSelectedRenewal] = useState<AmcRenewal | null>(null);
  const [newValidityDate, setNewValidityDate] = useState<Date | undefined>();
  const [isApproving, setIsApproving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!authUser) return null;
    return doc(firestore, 'users', authUser.uid);
  }, [authUser, firestore]);

  const { data: currentUser, isLoading: isUserLoading } = useDoc<AppUser>(userDocRef);

  const isAdmin = currentUser?.role === 'Admin';

  const renewalsCollection = useMemoFirebase(() => {
    if (!isAdmin || !firestore) return null;
    return collection(firestore, 'amc_renewals')
  }, [isAdmin, firestore]);

  const { data: renewals, isLoading: isLoadingRenewals } = useCollection<AmcRenewal>(renewalsCollection);


  const openApproveDialog = (renewal: AmcRenewal) => {
    setSelectedRenewal(renewal);
    setDialogOpen(true);
  };

  const handleApproveRenewal = async () => {
    if (!firestore || !selectedRenewal || !newValidityDate) {
        toast({
            variant: 'destructive',
            title: 'Approval Failed',
            description: 'Please select a new validity date.',
        });
        return;
    }
    setIsApproving(true);
    try {
      const batch = writeBatch(firestore);

      const userDocRef = doc(firestore, 'users', selectedRenewal.userId);
      batch.update(userDocRef, {
        validityDate: newValidityDate.toISOString().split('T')[0],
        status: 'Active'
      });

      const renewalDocRef = doc(firestore, 'amc_renewals', selectedRenewal.id);
      batch.update(renewalDocRef, {
        status: 'Approved',
      });
      
      await batch.commit();

      toast({
        title: 'Renewal Approved',
        description: `User ${selectedRenewal.userName}'s validity has been updated.`,
      });

    } catch (error) {
      console.error("Error approving renewal:", error);
      toast({
        variant: 'destructive',
        title: 'Approval Failed',
        description: 'Could not approve the renewal. Please try again.',
      });
    } finally {
      setIsApproving(false);
      setSelectedRenewal(null);
      setNewValidityDate(undefined);
      setDialogOpen(false);
    }
  };

  if (isAuthUserLoading || isUserLoading) {
     return (
         <Card>
            <CardHeader>
                <CardTitle>AMC Renewals</CardTitle>
                <CardDescription>Review and approve pending AMC renewal requests.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Customer ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => <RenewalRowSkeleton key={i} />)}
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
        <CardTitle>AMC Renewals</CardTitle>
        <CardDescription>Review and approve pending AMC renewal requests.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Customer ID</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(isLoadingRenewals) && Array.from({ length: 5 }).map((_, i) => <RenewalRowSkeleton key={i} />)}
            {renewals?.map((renewal) => (
              <TableRow key={renewal.id}>
                <TableCell>{format(new Date(renewal.date), 'dd/MM/yyyy')}</TableCell>
                <TableCell className="font-medium">{renewal.userName}</TableCell>
                <TableCell>{renewal.customerId}</TableCell>
                <TableCell>₹{renewal.amount.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={renewal.status === 'Approved' ? 'secondary' : 'default'} className="bg-opacity-80">
                    {renewal.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {renewal.status === 'Pending' && (
                    <Button 
                        size="sm"
                        onClick={() => openApproveDialog(renewal)}
                        disabled={isApproving}
                    >
                        Approve
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {renewals && renewals.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">No pending renewals found.</div>
        )}
      </CardContent>
       <CardFooter>
        <div className="text-xs text-muted-foreground">
          Showing <strong>{renewals?.length ?? 0}</strong> of <strong>{renewals?.length ?? 0}</strong> renewals
        </div>
      </CardFooter>
    </Card>

     <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Approve Renewal for {selectedRenewal?.userName}</AlertDialogTitle>
            <AlertDialogDescription>
                Select a new validity date to extend the user's subscription.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="validity-date" className="text-right">
                        New Validity
                    </Label>
                    <div className="col-span-3">
                        <DatePicker date={newValidityDate} setDate={setNewValidityDate} />
                    </div>
                </div>
            </div>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApproveRenewal} disabled={!newValidityDate || isApproving}>
                {isApproving ? 'Approving...' : 'Approve & Extend'}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
