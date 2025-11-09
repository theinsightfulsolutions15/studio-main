
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, MoreHorizontal, Plus } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import type { Account } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

function AccountRowSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
    </TableRow>
  );
}

const initialAccountState: Omit<Account, 'id' | 'ownerId'> = {
  name: '',
  type: 'Customer',
};

export default function AccountsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState<Omit<Account, 'id' | 'ownerId'>>(initialAccountState);

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);


  const accountsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, `users/${user.uid}/accounts`));
  }, [user, firestore]);

  const { data: accounts, isLoading } = useCollection<Account>(accountsQuery);

  const customerAccounts = useMemo(() => accounts?.filter(acc => acc.type === 'Customer'), [accounts]);
  const bankAccounts = useMemo(() => accounts?.filter(acc => acc.type === 'Bank'), [accounts]);
  const expenseAccounts = useMemo(() => accounts?.filter(acc => acc.type === 'Expense'), [accounts]);

  const openDialog = (mode: 'create' | 'edit', account: Account | null = null) => {
    setDialogMode(mode);
    if(mode === 'edit' && account) {
        setSelectedAccount(account);
        setFormData(account);
    } else {
        setSelectedAccount(null);
        setFormData(initialAccountState);
    }
    setIsFormOpen(true);
  };
  
  const openDeleteDialog = (account: Account) => {
      setAccountToDelete(account);
      setIsDeleteAlertOpen(true);
  }

  const handleFormSubmit = async () => {
    if (!firestore || !user) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
      return;
    }
    if (!formData.name) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Account Name is required.' });
      return;
    }

    setIsSubmitting(true);
    
    try {
        if(dialogMode === 'create') {
            const accountsColRef = collection(firestore, `users/${user.uid}/accounts`);
            await addDocumentNonBlocking(accountsColRef, { ...formData, ownerId: user.uid });
            toast({ title: 'Success', description: 'New account has been created.' });
        } else if (dialogMode === 'edit' && selectedAccount) {
            const accountDocRef = doc(firestore, `users/${user.uid}/accounts`, selectedAccount.id);
            await updateDocumentNonBlocking(accountDocRef, formData);
            toast({ title: 'Success', description: 'Account has been updated.' });
        }
        setIsFormOpen(false);
    } catch (error) {
        console.error("Error saving account:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save account.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
      if (!firestore || !user || !accountToDelete) return;

      const accountDocRef = doc(firestore, `users/${user.uid}/accounts`, accountToDelete.id);
      try {
        await deleteDocumentNonBlocking(accountDocRef);
        toast({ title: 'Success', description: `Account "${accountToDelete.name}" has been deleted.` });
      } catch (error) {
         console.error("Error deleting account:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete account. It might be in use in financial records.' });
      } finally {
        setIsDeleteAlertOpen(false);
        setAccountToDelete(null);
      }
  }

  const renderActionButton = () => {
    if (isMobile) {
        return (
            <Button size="icon" className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-20" onClick={() => openDialog('create')}>
                <Plus className="h-6 w-6" />
                <span className="sr-only">Add Account</span>
            </Button>
        );
    }
    return (
        <Button onClick={() => openDialog('create')}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Account
        </Button>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle>Master Accounts</CardTitle>
              <CardDescription>Manage your customer, bank, and expense accounts.</CardDescription>
            </div>
            {!isMobile && renderActionButton()}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="customers" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="customers">Customers</TabsTrigger>
              <TabsTrigger value="banks">Bank Accounts</TabsTrigger>
              <TabsTrigger value="expenses">Expense Accounts</TabsTrigger>
            </TabsList>
            <TabsContent value="customers" className="mt-4">
              <AccountsTable accounts={customerAccounts} isLoading={isLoading} onEdit={(acc) => openDialog('edit', acc)} onDelete={openDeleteDialog} />
            </TabsContent>
            <TabsContent value="banks" className="mt-4">
              <AccountsTable accounts={bankAccounts} isLoading={isLoading} onEdit={(acc) => openDialog('edit', acc)} onDelete={openDeleteDialog}/>
            </TabsContent>
            <TabsContent value="expenses" className="mt-4">
              <AccountsTable accounts={expenseAccounts} isLoading={isLoading} onEdit={(acc) => openDialog('edit', acc)} onDelete={openDeleteDialog}/>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter>
          <div className="text-xs text-muted-foreground">
            Showing <strong>{accounts?.length ?? 0}</strong> total accounts
          </div>
        </CardFooter>
      </Card>

      {isMobile && renderActionButton()}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'create' ? 'Add New Account' : 'Edit Account'}</DialogTitle>
            <DialogDescription>
             {dialogMode === 'create' ? 'Create a new customer, bank, or expense account.' : 'Update the details for this account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="account-type">Account Type</Label>
              <Select value={formData.type} onValueChange={(value: 'Customer' | 'Bank' | 'Expense') => setFormData({ ...formData, type: value })}>
                <SelectTrigger id="account-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Customer">Customer</SelectItem>
                  <SelectItem value="Bank">Bank Account</SelectItem>
                  <SelectItem value="Expense">Expense Account</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-name">Account Name</Label>
              <Input
                id="account-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={
                    formData.type === 'Customer' ? 'e.g., John Doe' :
                    formData.type === 'Bank' ? 'e.g., SBI Main Branch' :
                    'e.g., Fodder Expenses'
                }
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit" onClick={handleFormSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

       <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the account <strong>{accountToDelete?.name}</strong>.
                    If this account has been used in any financial records, deleting it may cause issues.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete} className={cn(buttonVariants({ variant: "destructive" }))}>
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function AccountsTable({ accounts, isLoading, onEdit, onDelete }: { accounts: Account[] | null | undefined, isLoading: boolean, onEdit: (account: Account) => void, onDelete: (account: Account) => void }) {
  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && Array.from({ length: 3 }).map((_, i) => <AccountRowSkeleton key={i} />)}
          {accounts?.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-medium">{account.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{account.type}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onEdit(account)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onDelete(account)} className="text-destructive">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {!isLoading && (!accounts || accounts.length === 0) && (
            <TableRow>
              <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                No accounts of this type found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
