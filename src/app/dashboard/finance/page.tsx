
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { Button, buttonVariants } from '@/components/ui/button';
import { PlusCircle, ChevronsUpDown, Check, MoreHorizontal } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, writeBatch, doc } from 'firebase/firestore';
import type { FinancialRecord, Account } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { format } from 'date-fns';


function TransactionRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-6 w-20 rounded-full" />
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Skeleton className="h-4 w-32" />
      </TableCell>
      <TableCell className="text-right">
        <Skeleton className="h-4 w-16" />
      </TableCell>
       <TableCell className="text-right">
        <Skeleton className="h-8 w-8" />
      </TableCell>
    </TableRow>
  );
}

type TransactionFormData = {
    date: Date | undefined;
    recordType: 'Receipt' | 'Payment' | 'Transfer' | 'Expense' | 'Bank Record' | 'Milk Record' | 'Milk Sale';
    fromAccount: string | null;
    toAccount: string | null;
    amount: number | '';
    description: string;
};

const initialFormState: TransactionFormData = {
    date: new Date(),
    recordType: 'Receipt',
    fromAccount: null,
    toAccount: null,
    amount: '',
    description: '',
};

export default function FinancePage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Omit<FinancialRecord, 'id' | 'ownerId'>>(initialFormState);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [selectedRecord, setSelectedRecord] = useState<FinancialRecord | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  
  const [fromPopoverOpen, setFromPopoverOpen] = useState(false);
  const [toPopoverOpen, setToPopoverOpen] = useState(false);


  const financialRecordsQuery = useCollection<FinancialRecord>(
    useMemoFirebase(
      () => (user && firestore ? query(collection(firestore, `users/${user.uid}/financial_records`)) : null),
      [user, firestore]
    )
  );

  const accountsQuery = useCollection<Account>(
    useMemoFirebase(
      () => (user && firestore ? query(collection(firestore, `users/${user.uid}/accounts`)) : null),
      [user, firestore]
    )
  );

  const { data: financialData, isLoading: isLoadingTransactions } = financialRecordsQuery;
  const { data: accounts, isLoading: isLoadingAccounts } = accountsQuery;
  
  const receipts = financialData?.filter((t) => t.recordType === 'Receipt');
  const payments = financialData?.filter((t) => t.recordType === 'Payment');
  const expenses = financialData?.filter((t) => t.recordType === 'Expense');
  const milkSales = financialData?.filter((t) => t.recordType === 'Milk Sale');

  const customerAndBankAccounts = useMemo(() => accounts?.filter(a => a.type === 'Customer' || a.type === 'Bank'), [accounts]);
  const expenseAndBankAccounts = useMemo(() => accounts?.filter(a => a.type === 'Expense' || a.type === 'Bank'), [accounts]);


  const handleOpenDialog = (mode: 'create' | 'edit', record: FinancialRecord | null = null) => {
    setDialogMode(mode);
    if(mode === 'edit' && record) {
        setSelectedRecord(record);
        setFormData({
            ...record,
            recordType: record.recordType === 'Payment' || record.recordType === 'Receipt' ? record.recordType : 'Transfer', // Simplify for form
            date: new Date(record.date),
            fromAccount: record.recordType === 'Payment' ? record.accountId || null : null,
            toAccount: record.recordType === 'Receipt' ? record.accountId || null : null,
        });
    } else {
        setSelectedRecord(null);
        setFormData(initialFormState);
    }
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (record: FinancialRecord) => {
    setSelectedRecord(record);
    setIsDeleteAlertOpen(true);
  };
  
  const handleFormSubmit = async () => {
    if (!firestore || !user || !formData.date || !formData.amount) {
        toast({ variant: 'destructive', title: 'Validation Error', description: 'Please fill out all required fields.' });
        return;
    }
    
    setIsSubmitting(true);

    try {
        const dateStr = new Date(formData.date.getTime() - (formData.date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

        if (dialogMode === 'create') {
            const batch = writeBatch(firestore);
            if (formData.recordType === 'Transfer') {
                if (!formData.fromAccount || !formData.toAccount) {
                    toast({ variant: 'destructive', title: 'Validation Error', description: 'Both "From" and "To" accounts are required for a transfer.' });
                    setIsSubmitting(false);
                    return;
                }
                const paymentRef = doc(collection(firestore, `users/${user.uid}/financial_records`));
                batch.set(paymentRef, { recordType: 'Payment', date: dateStr, accountId: formData.fromAccount, amount: Number(formData.amount), description: `Transfer to ${accounts?.find(a => a.id === formData.toAccount)?.name || 'account'}: ${formData.description}`, category: 'Bank Transfer', ownerId: user.uid });
                const receiptRef = doc(collection(firestore, `users/${user.uid}/financial_records`));
                batch.set(receiptRef, { recordType: 'Receipt', date: dateStr, accountId: formData.toAccount, amount: Number(formData.amount), description: `Transfer from ${accounts?.find(a => a.id === formData.fromAccount)?.name || 'account'}: ${formData.description}`, category: 'Bank Transfer', ownerId: user.uid });
            } else { // Receipt or Payment
                const accountId = formData.recordType === 'Receipt' ? formData.toAccount : formData.fromAccount;
                if (!accountId) {
                     toast({ variant: 'destructive', title: 'Validation Error', description: 'An account must be selected.' });
                     setIsSubmitting(false);
                     return;
                }
                const recordRef = doc(collection(firestore, `users/${user.uid}/financial_records`));
                batch.set(recordRef, { date: dateStr, recordType: formData.recordType, accountId: accountId, amount: Number(formData.amount), description: formData.description, category: accounts?.find(a => a.id === accountId)?.type, ownerId: user.uid, });
            }
            await batch.commit();
            toast({ title: 'Success', description: 'Transaction recorded successfully.' });
        } else if (dialogMode === 'edit' && selectedRecord) {
             const recordRef = doc(firestore, `users/${user.uid}/financial_records`, selectedRecord.id);
             const accountId = formData.recordType === 'Receipt' ? formData.toAccount : formData.fromAccount;
             await updateDocumentNonBlocking(recordRef, {
                 date: dateStr,
                 recordType: formData.recordType,
                 accountId: accountId,
                 amount: Number(formData.amount),
                 description: formData.description,
                 category: accounts?.find(a => a.id === accountId)?.type,
             });
             toast({ title: 'Success', description: 'Transaction updated successfully.' });
        }
        
        setIsDialogOpen(false);
    } catch (error) {
        console.error('Error submitting transaction:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to record transaction.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!firestore || !user || !selectedRecord) return;
    
    const recordDocRef = doc(firestore, `users/${user.uid}/financial_records`, selectedRecord.id);
    try {
      await deleteDocumentNonBlocking(recordDocRef);
      toast({ title: 'Success', description: 'Transaction has been deleted.' });
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete transaction.' });
    } finally {
      setIsDeleteAlertOpen(false);
      setSelectedRecord(null);
    }
  };
  
  const renderAccountSelector = (
      type: 'from' | 'to',
      label: string, 
      accountList: Account[] | undefined, 
      popoverOpen: boolean,
      setPopoverOpen: (open: boolean) => void
    ) => {
        
      const selectedAccountId = type === 'from' ? formData.fromAccount : formData.toAccount;
      const setSelectedAccountId = (id: string | null) => {
          setFormData(prev => ({...prev, [`${type}Account`]: id}));
      };
      
      return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                        {selectedAccountId ? accounts?.find(a => a.id === selectedAccountId)?.name : "Select account..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput placeholder="Search account..." />
                        <CommandEmpty>No accounts found.</CommandEmpty>
                        <CommandGroup>
                            {accountList?.map(account => (
                                <CommandItem
                                    key={account.id}
                                    value={account.name}
                                    onSelect={() => {
                                        setSelectedAccountId(account.id);
                                        setPopoverOpen(false);
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", selectedAccountId === account.id ? "opacity-100" : "opacity-0")} />
                                    {account.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
  };


  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <CardTitle>Financial Records</CardTitle>
            <CardDescription>
              Track all receipts, payments, and expenses.
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog('create')}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Transaction
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="receipts">Receipts</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            {/* <TabsTrigger value="milk-sales">Milk Sales</TabsTrigger> */}
          </TabsList>
          <TabsContent value="all" className="mt-4">
            <TransactionsTable data={financialData} isLoading={isLoadingTransactions} accounts={accounts} onEdit={(rec) => handleOpenDialog('edit', rec)} onDelete={openDeleteDialog} />
          </TabsContent>
          <TabsContent value="receipts" className="mt-4">
            <TransactionsTable data={receipts} isLoading={isLoadingTransactions} accounts={accounts} onEdit={(rec) => handleOpenDialog('edit', rec)} onDelete={openDeleteDialog}/>
          </TabsContent>
          <TabsContent value="payments" className="mt-4">
            <TransactionsTable data={payments} isLoading={isLoadingTransactions} accounts={accounts} onEdit={(rec) => handleOpenDialog('edit', rec)} onDelete={openDeleteDialog}/>
          </TabsContent>
          <TabsContent value="expenses" className="mt-4">
            <TransactionsTable data={expenses} isLoading={isLoadingTransactions} accounts={accounts} onEdit={(rec) => handleOpenDialog('edit', rec)} onDelete={openDeleteDialog}/>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">
          Showing <strong>1-{financialData?.length ?? 0}</strong> of{' '}
          <strong>{financialData?.length ?? 0}</strong> transactions
        </div>
      </CardFooter>
    </Card>

    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>{dialogMode === 'create' ? 'Add New Transaction' : 'Edit Transaction'}</DialogTitle>
                <DialogDescription>Record a receipt, payment, or internal transfer.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="date">Date</Label>
                        <DatePicker date={formData.date} setDate={(d) => setFormData(p => ({...p, date: d}))} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="recordType">Transaction Type</Label>
                        <Select value={formData.recordType} onValueChange={(v: any) => setFormData(p => ({...p, recordType: v}))}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Receipt">Receipt</SelectItem>
                                <SelectItem value="Payment">Payment</SelectItem>
                                <SelectItem value="Transfer">Transfer</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {formData.recordType === 'Transfer' ? (
                     <div className="grid grid-cols-2 gap-4">
                        {renderAccountSelector('from', 'From Account', expenseAndBankAccounts, fromPopoverOpen, setFromPopoverOpen)}
                        {renderAccountSelector('to', 'To Account', customerAndBankAccounts, toPopoverOpen, setToPopoverOpen)}
                    </div>
                ) : formData.recordType === 'Receipt' ? (
                    renderAccountSelector('to', 'To Account', customerAndBankAccounts, toPopoverOpen, setToPopoverOpen)
                ) : ( // Payment
                    renderAccountSelector('from', 'From Account', expenseAndBankAccounts, fromPopoverOpen, setFromPopoverOpen)
                )}

                 <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input id="amount" type="number" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData(p => ({...p, amount: Number(e.target.value) || ''}))} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" placeholder="Add a short description..." value={formData.description} onChange={(e) => setFormData(p => ({...p, description: e.target.value}))}/>
                </div>

            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                <Button onClick={handleFormSubmit} disabled={isSubmitting || isLoadingAccounts}>
                    {isSubmitting ? 'Saving...' : 'Save Transaction'}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

     <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this financial record.
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

function TransactionsTable({
  data,
  isLoading,
  accounts,
  onEdit,
  onDelete,
}: {
  data: FinancialRecord[] | undefined | null;
  isLoading: boolean;
  accounts: Account[] | undefined | null;
  onEdit: (record: FinancialRecord) => void;
  onDelete: (record: FinancialRecord) => void;
}) {
  const accountMap = useMemo(() => new Map(accounts?.map(a => [a.id, a.name])), [accounts]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="hidden sm:table-cell">Account</TableHead>
          <TableHead className="hidden md:table-cell">Description</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading &&
          Array.from({ length: 5 }).map((_, i) => (
            <TransactionRowSkeleton key={i} />
          ))}
        {data?.map((record) => (
          <TableRow key={record.id}>
            <TableCell>{format(new Date(record.date), 'dd/MM/yyyy')}</TableCell>
            <TableCell>
              <Badge
                variant={
                  record.recordType === 'Receipt'
                    ? 'secondary'
                    : record.recordType === 'Expense' || record.recordType === 'Payment'
                    ? 'destructive'
                    : 'outline'
                }
                className={`bg-opacity-80 ${record.recordType === 'Receipt' ? 'bg-green-100 text-green-800' : record.recordType === 'Payment' || record.recordType === 'Expense' ? 'bg-red-100 text-red-800' : ''}`}
              >
                {record.recordType}
              </Badge>
            </TableCell>
            <TableCell className="hidden sm:table-cell font-medium">
              {record.accountId ? accountMap.get(record.accountId) : record.category}
            </TableCell>
            <TableCell className="hidden md:table-cell max-w-[200px] lg:max-w-[300px] truncate">
              {record.description}
            </TableCell>
            <TableCell className="text-right font-medium">
              ₹{record.amount.toFixed(2)}
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
                        <DropdownMenuItem onSelect={() => onEdit(record)} disabled={record.category === 'Bank Transfer' || record.recordType === 'Milk Sale'}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onDelete(record)} className="text-destructive" disabled={record.category === 'Bank Transfer' || record.recordType === 'Milk Sale'}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
