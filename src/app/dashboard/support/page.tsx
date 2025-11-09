
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { User as AppUser, SupportTicket } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const initialFormState = {
    subject: '',
    description: '',
};

function TicketRowSkeleton() {
    return (
        <TableRow>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-48" /></TableCell>
            <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24 hidden md:table-cell" /></TableCell>
        </TableRow>
    );
}

export default function SupportPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [formData, setFormData] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [user, firestore]);
  const { data: userData, isLoading: isUserDataLoading } = useDoc<AppUser>(userDocRef);

  const userTicketsQuery = useMemoFirebase(() => {
      if (!user || !firestore) return null;
      return query(collection(firestore, 'support_tickets'), where('userId', '==', user.uid));
  }, [user, firestore]);

  const { data: tickets, isLoading: isLoadingTickets } = useCollection<SupportTicket>(userTicketsQuery);
  
  const visibleTickets = useMemo(() => {
    if (!tickets) return [];
    const fifteenDaysAgo = subDays(new Date(), 15);
    return tickets.filter(ticket => {
        if (ticket.status === 'Closed' && ticket.closedAt) {
            return ticket.closedAt.toDate() > fifteenDaysAgo;
        }
        return true;
    }).sort((a,b) => b.submittedAt.toDate() - a.submittedAt.toDate());
  }, [tickets]);


  const handleSubmit = async () => {
    if (!user || !userData) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
      return;
    }
    if (!formData.subject || !formData.description) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please fill out all fields.' });
      return;
    }

    setIsSubmitting(true);
    const ticketData: Omit<SupportTicket, 'id'> = {
      userId: user.uid,
      userName: userData.name,
      userEmail: userData.email,
      customerId: userData.customerId,
      subject: formData.subject,
      description: formData.description,
      status: 'Open',
      submittedAt: new Date(),
      closedAt: null,
    };

    try {
      const ticketsColRef = collection(firestore, 'support_tickets');
      await addDocumentNonBlocking(ticketsColRef, ticketData);
      toast({
        title: 'Request Submitted',
        description: 'Your support ticket has been sent. We will get back to you shortly.',
      });
      setFormData(initialFormState);
    } catch (error) {
      console.error("Error submitting ticket:", error);
      toast({ variant: 'destructive', title: 'Submission Failed', description: 'Could not submit your request.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const isLoading = isUserLoading || isUserDataLoading;

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Contact Support</CardTitle>
                <CardDescription>
                    Have an issue or a question? Fill out the form below to create a support ticket.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                ) : (
                    <div className="grid gap-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Your Name</Label>
                                <Input value={userData?.name || ''} disabled />
                            </div>
                            <div className="space-y-2">
                                <Label>Your Email</Label>
                                <Input value={userData?.email || ''} disabled />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="subject">Subject</Label>
                            <Input 
                                id="subject" 
                                value={formData.subject}
                                onChange={(e) => setFormData(p => ({...p, subject: e.target.value}))}
                                placeholder="e.g., Issue with animal registration"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Describe your issue</Label>
                            <Textarea 
                                id="description" 
                                value={formData.description}
                                onChange={(e) => setFormData(p => ({...p, description: e.target.value}))}
                                placeholder="Please provide as much detail as possible..."
                                rows={5}
                            />
                        </div>

                        <Button 
                            className="w-full sm:w-auto" 
                            onClick={handleSubmit} 
                            disabled={isSubmitting || isLoading}
                        >
                        {isSubmitting || isLoading ? 'Submitting...' : 'Submit Request'}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>My Support Tickets</CardTitle>
                <CardDescription>A history of your submitted support requests.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="hidden md:table-cell">Closed On</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingTickets && Array.from({length: 3}).map((_, i) => <TicketRowSkeleton key={i} />)}
                        {visibleTickets.map(ticket => (
                            <TableRow key={ticket.id}>
                                <TableCell>{ticket.submittedAt ? format(ticket.submittedAt.toDate(), 'dd/MM/yyyy') : '...'}</TableCell>
                                <TableCell className="font-medium">{ticket.subject}</TableCell>
                                <TableCell>
                                    <Badge variant={ticket.status === 'Open' ? 'default' : 'secondary'}>
                                        {ticket.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">{ticket.closedAt ? format(ticket.closedAt.toDate(), 'dd/MM/yyyy') : '-'}</TableCell>
                            </TableRow>
                        ))}
                         {!isLoadingTickets && visibleTickets.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                    You have not submitted any support tickets.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}
