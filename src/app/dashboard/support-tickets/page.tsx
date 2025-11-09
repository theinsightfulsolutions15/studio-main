
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Search } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, serverTimestamp, query as firestoreQuery, collectionGroup } from 'firebase/firestore';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { SupportTicket } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useState, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { Input } from '@/components/ui/input';

function TicketRowSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
    </TableRow>
  );
}

export default function SupportTicketsPage() {
  const { isAdmin, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const ticketsQuery = useMemoFirebase(() => {
    if (!isAdmin || !firestore) return null;
    return firestoreQuery(collectionGroup(firestore, 'support_tickets'));
  }, [isAdmin, firestore]);

  const { data: allTickets, isLoading: isLoadingTickets } = useCollection<SupportTicket>(ticketsQuery);

  const filteredTickets = useMemo(() => {
    if (!allTickets) return [];
    if (!searchTerm) return allTickets;

    const lowercasedTerm = searchTerm.toLowerCase();
    return allTickets.filter(ticket => 
        ticket.userName?.toLowerCase().includes(lowercasedTerm) ||
        ticket.userEmail?.toLowerCase().includes(lowercasedTerm) ||
        ticket.subject?.toLowerCase().includes(lowercasedTerm) ||
        ticket.customerId?.toLowerCase().includes(lowercasedTerm)
    );
  }, [allTickets, searchTerm]);

  const openTickets = useMemo(() => {
      return filteredTickets?.filter(t => t.status === 'Open').sort((a,b) => b.submittedAt.toDate() - a.submittedAt.toDate()) || [];
    }, [filteredTickets]);

  const closedTickets = useMemo(() => {
    if (!filteredTickets) return [];
    const fifteenDaysAgo = subDays(new Date(), 15);
    return filteredTickets.filter(ticket => {
        if (ticket.status === 'Closed' && ticket.closedAt) {
            return ticket.closedAt.toDate() > fifteenDaysAgo;
        }
        return false;
    }).sort((a,b) => b.closedAt.toDate() - a.closedAt.toDate());
  }, [filteredTickets]);


  const handleUpdateStatus = async (ticket: SupportTicket, status: 'Open' | 'Closed') => {
    if (!firestore) return;

    const ticketDocRef = doc(firestore, 'support_tickets', ticket.id);
    const updateData: { status: 'Open' | 'Closed'; closedAt?: any } = { status };
    if (status === 'Closed') {
      updateData.closedAt = serverTimestamp();
    } else {
      updateData.closedAt = null;
    }

    try {
      await updateDocumentNonBlocking(ticketDocRef, updateData);
      toast({
        title: 'Status Updated',
        description: `Ticket from ${ticket.userName} has been marked as ${status}.`,
      });
    } catch (error) {
      console.error('Error updating ticket status:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not update the ticket status.',
      });
    }
  };

  if (isUserLoading) {
    return <Card><CardHeader><CardTitle>Loading...</CardTitle></CardHeader></Card>;
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            You do not have permission to view this page.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="open">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="closed">Recently Closed</TabsTrigger>
        </TabsList>
        <div className="relative w-full md:w-auto md:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <TabsContent value="open" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Open Support Tickets</CardTitle>
            <CardDescription>Review and manage all pending support requests from users.</CardDescription>
          </CardHeader>
          <CardContent>
            <TicketsTable
              tickets={openTickets}
              isLoading={isLoadingTickets}
              onUpdateStatus={handleUpdateStatus}
            />
          </CardContent>
          <CardFooter>
            <div className="text-xs text-muted-foreground">
              Showing <strong>{openTickets.length}</strong> open tickets.
            </div>
          </CardFooter>
        </Card>
      </TabsContent>
      <TabsContent value="closed" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Recently Closed Support Tickets</CardTitle>
            <CardDescription>A history of support requests closed in the last 15 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <TicketsTable
              tickets={closedTickets}
              isLoading={isLoadingTickets}
              onUpdateStatus={handleUpdateStatus}
            />
          </CardContent>
           <CardFooter>
            <div className="text-xs text-muted-foreground">
              Showing <strong>{closedTickets.length}</strong> closed tickets.
            </div>
          </CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function TicketsTable({
  tickets,
  isLoading,
  onUpdateStatus,
}: {
  tickets: SupportTicket[];
  isLoading: boolean;
  onUpdateStatus: (ticket: SupportTicket, status: 'Open' | 'Closed') => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>User</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Status</TableHead>
          <TableHead><span className="sr-only">Actions</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && Array.from({ length: 5 }).map((_, i) => <TicketRowSkeleton key={i} />)}
        {tickets.map(ticket => (
          <TableRow key={ticket.id}>
            <TableCell>{ticket.submittedAt ? format(ticket.submittedAt.toDate(), 'dd/MM/yyyy') : '...'}</TableCell>
            <TableCell>
              <div className="font-medium">{ticket.userName}</div>
              <div className="text-sm text-muted-foreground">{ticket.userEmail} ({ticket.customerId || 'No ID'})</div>
            </TableCell>
            <TableCell>{ticket.subject}</TableCell>
            <TableCell>
              <Badge variant={ticket.status === 'Open' ? 'default' : 'secondary'}>
                {ticket.status}
              </Badge>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {ticket.status === 'Open' && (
                    <DropdownMenuItem onClick={() => onUpdateStatus(ticket, 'Closed')}>
                      Mark as Closed
                    </DropdownMenuItem>
                  )}
                  {ticket.status === 'Closed' && (
                    <DropdownMenuItem onClick={() => onUpdateStatus(ticket, 'Open')}>
                      Re-open Ticket
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
        {!isLoading && tickets.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
              No tickets found in this category.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
