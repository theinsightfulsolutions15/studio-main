
'use client';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { User as AppUser, AmcRenewal } from '@/lib/types';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { FileClock } from 'lucide-react';
import { format } from 'date-fns';

const initialFormState: Omit<AmcRenewal, 'id' | 'userId' | 'userName' | 'submittedAt' | 'status'> = {
    date: new Date().toISOString(),
    amount: 0,
    transactionType: 'UPI',
    customerId: '',
};

export default function RenewalPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    const [formData, setFormData] = useState<Omit<AmcRenewal, 'id' | 'userId' | 'userName' | 'submittedAt' | 'status'>>(initialFormState);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const userDocRef = useMemoFirebase(() => {
        if (!user) return null;
        return doc(firestore, 'users', user.uid);
    }, [user, firestore]);
    
    const { data: userData, isLoading: isUserDocLoading } = useDoc<AppUser>(userDocRef);

    const pendingRenewalQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'amc_renewals'),
            where('userId', '==', user.uid),
            where('status', '==', 'Pending')
        );
    }, [user, firestore]);

    const { data: pendingRenewals, isLoading: isLoadingRenewals } = useCollection<AmcRenewal>(pendingRenewalQuery);
    const existingPendingRenewal = pendingRenewals?.[0];

    const handleSubmit = async () => {
        if (!user || !userData || !firestore) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to submit a renewal.' });
            return;
        }
        if (formData.amount <= 0 || !formData.date) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Please enter a valid amount and date.' });
            return;
        }

        setIsSubmitting(true);
        const renewalData: Omit<AmcRenewal, 'id'> = {
            userId: user.uid,
            userName: userData.name,
            customerId: userData.customerId,
            date: new Date(formData.date).toISOString().split('T')[0],
            amount: Number(formData.amount),
            transactionType: formData.transactionType,
            status: 'Pending',
            submittedAt: new Date(),
        };

        const renewalsColRef = collection(firestore, 'amc_renewals');
        
        try {
            await addDocumentNonBlocking(renewalsColRef, renewalData);
            toast({
                title: 'Submission Successful',
                description: 'Your AMC renewal request has been submitted for approval.',
            });
            // Don't redirect, let the page re-render to show the pending message
        } catch (error) {
            console.error("Error submitting renewal:", error);
            toast({ variant: 'destructive', title: 'Submission Failed', description: 'Could not submit your request. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const isLoading = isUserLoading || isUserDocLoading || isLoadingRenewals;

    if (isLoading) {
        return (
            <div className="flex justify-center items-start pt-10">
                <Card className="w-full max-w-2xl">
                    <CardHeader>
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </CardContent>
                    <CardFooter>
                         <Skeleton className="h-10 w-32 ml-auto" />
                    </CardFooter>
                </Card>
            </div>
        );
    }
    
    if (existingPendingRenewal) {
        return (
             <div className="flex justify-center items-start pt-10">
                <Card className="w-full max-w-2xl">
                    <CardHeader className="text-center">
                        <FileClock className="mx-auto h-12 w-12 text-primary" />
                        <CardTitle className="mt-4">Request Pending Approval</CardTitle>
                        <CardDescription>
                            Your previous AMC renewal request is currently awaiting approval from an administrator.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">
                        <div className="border rounded-lg p-4 space-y-3 bg-muted/50">
                             <div className="flex justify-between">
                                <span className="text-muted-foreground">Submission Date:</span>
                                <span className="font-medium">{format(existingPendingRenewal.submittedAt.toDate(), 'dd/MM/yyyy')}</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-muted-foreground">Amount Paid:</span>
                                <span className="font-medium">₹{existingPendingRenewal.amount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Payment Mode:</span>
                                <span className="font-medium">{existingPendingRenewal.transactionType}</span>
                            </div>
                        </div>
                         <p className="mt-4 text-center text-muted-foreground">
                            You will be notified once your request has been reviewed. You cannot submit a new request at this time.
                        </p>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full sm:w-auto ml-auto" onClick={() => router.push('/dashboard')}>
                            Back to Dashboard
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex justify-center items-start pt-10">
            <Card className="w-full max-w-2xl">
                <CardHeader>
                    <CardTitle>AMC Renewal Submission</CardTitle>
                    <CardDescription>
                        Fill out the form below to submit your Annual Maintenance Contract renewal details for approval.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Your Name</Label>
                                <Input value={userData?.name || ''} disabled />
                            </div>
                            <div className="space-y-2">
                                <Label>Your Customer ID</Label>
                                <Input value={userData?.customerId || 'Not yet assigned'} disabled />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="date">Payment Date</Label>
                                <DatePicker 
                                    date={new Date(formData.date)} 
                                    setDate={(d) => setFormData(p => ({...p, date: d?.toISOString() || new Date().toISOString()}))} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount Paid (₹)</Label>
                                <Input 
                                    id="amount" 
                                    type="number" 
                                    value={formData.amount} 
                                    onChange={(e) => setFormData(p => ({...p, amount: Number(e.target.value)}))}
                                    placeholder="Enter amount"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="transactionType">Payment Mode</Label>
                            <Select 
                                value={formData.transactionType} 
                                onValueChange={(value: 'RTGS' | 'NEFT' | 'UPI' | 'Cash' | 'Other') => setFormData(p => ({...p, transactionType: value}))}
                            >
                                <SelectTrigger id="transactionType">
                                    <SelectValue placeholder="Select payment mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="UPI">UPI</SelectItem>
                                    <SelectItem value="RTGS">RTGS</SelectItem>
                                    <SelectItem value="NEFT">NEFT</SelectItem>
                                    <SelectItem value="Cash">Cash</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button 
                        className="w-full sm:w-auto ml-auto" 
                        onClick={handleSubmit} 
                        disabled={isSubmitting}
                    >
                       {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
