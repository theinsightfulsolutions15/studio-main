
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle, ChevronsUpDown, Check, Search, Trash2 } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState, useMemo } from 'react';
import type { Animal, AnimalMovement } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';


function MovementRowSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell>
        <Skeleton className="h-8 w-8 rounded-md" />
      </TableCell>
    </TableRow>
  );
}

function MovementsTable({ movements, isLoading, onEdit, onDelete, searchTerm }: { movements: (AnimalMovement & { animalGovtTagNo?: string })[] | null, isLoading: boolean, onEdit: (movement: AnimalMovement) => void, onDelete: (movement: AnimalMovement) => void, searchTerm?: string }) {
    return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Animal Tag</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="hidden md:table-cell">Reason</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => <MovementRowSkeleton key={i} />)}
            {movements?.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell>{format(new Date(movement.date), 'dd/MM/yyyy')}</TableCell>
                <TableCell className="font-medium">{movement.animalGovtTagNo || movement.animalId}</TableCell>
                <TableCell>
                    <Badge className={movement.type === 'Entry' ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}>
                        {movement.type}
                    </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell max-w-[200px] lg:max-w-[300px] truncate">{movement.reason}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onEdit(movement)}>Edit Record</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onDelete(movement)} className="text-destructive">Delete Record</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
             {movements && movements.length === 0 && !isLoading && (
                <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        No movement records found{searchTerm && ` for "${searchTerm}"`}.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
    );
}

const initialMovementState: Omit<AnimalMovement, 'id' | 'ownerId'> = {
  animalId: '',
  type: 'Entry',
  date: new Date().toISOString(),
  reason: '',
};

export default function MovementPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [selectedMovement, setSelectedMovement] = useState<AnimalMovement | null>(null);
  const [formData, setFormData] = useState<Omit<AnimalMovement, 'id' | 'ownerId'>>(initialMovementState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [movementToDelete, setMovementToDelete] = useState<AnimalMovement | null>(null);

  const animalsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, `users/${user.uid}/animals`);
  }, [firestore, user]);
  const { data: animals, isLoading: isLoadingAnimals } = useCollection<Animal>(animalsQuery);

  const movementsQuery = useMemoFirebase(() => {
      if (!firestore || !user) return null;
      return query(collection(firestore, `users/${user.uid}/movements`));
  }, [firestore, user]);

  const { data: allMovements, isLoading: isLoadingAll } = useCollection<AnimalMovement>(movementsQuery);
  
  const movementsWithAnimalTags = useMemo(() => {
    if (!allMovements || !animals) return allMovements;
    const animalMap = new Map(animals.map(a => [a.id, a.govtTagNo]));
    return allMovements.map(m => ({
        ...m,
        animalGovtTagNo: animalMap.get(m.animalId) || 'Unknown'
    }));
  }, [allMovements, animals]);

    const animalStatuses = useMemo(() => {
        const statuses = new Map<string, 'in' | 'out'>();
        if (!animals || !allMovements) return statuses;

        const sortedMovements = [...allMovements].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const latestMovements = new Map<string, AnimalMovement>();
        for (const movement of sortedMovements) {
            latestMovements.set(movement.animalId, movement);
        }
        
        for (const animal of animals) {
            const latestMovement = latestMovements.get(animal.id);
            if (!latestMovement || latestMovement.type === 'Exit') {
                 statuses.set(animal.id, 'out');
            } else {
                 statuses.set(animal.id, 'in');
            }
        }
        return statuses;
    }, [animals, allMovements]);

    const availableAnimalsForMovement = useMemo(() => {
        if (!animals) return [];
        if (dialogMode === 'edit') return animals; 

        if (formData.type === 'Entry') {
            return animals.filter(a => animalStatuses.get(a.id) === 'out');
        } else { // 'Exit'
            return animals.filter(a => animalStatuses.get(a.id) === 'in');
        }
    }, [animals, animalStatuses, formData.type, dialogMode]);

  const filteredMovements = useMemo(() => {
    if (!movementsWithAnimalTags) return null;
    if (!searchTerm) return movementsWithAnimalTags;
    const lowercasedFilter = searchTerm.toLowerCase();
    return movementsWithAnimalTags.filter(movement =>
      movement.animalGovtTagNo?.toLowerCase().includes(lowercasedFilter)
    );
  }, [searchTerm, movementsWithAnimalTags]);

  const entryMovements = useMemo(() => filteredMovements?.filter(m => m.type === 'Entry'), [filteredMovements]);
  const exitMovements = useMemo(() => filteredMovements?.filter(m => m.type === 'Exit'), [filteredMovements]);
  
  const openDialog = (mode: 'create' | 'edit', movement: AnimalMovement | null = null) => {
    setDialogMode(mode);
    if (movement) {
        setSelectedMovement(movement);
        setFormData(movement);
    } else {
        setSelectedMovement(null);
        setFormData(prev => ({ ...initialMovementState, type: prev.type, date: new Date().toISOString() }));
    }
    setIsFormOpen(true);
  }

  const openDeleteDialog = (movement: AnimalMovement) => {
    setMovementToDelete(movement);
    setIsDeleteAlertOpen(true);
  }

    const handleMovementTypeChange = (value: 'Entry' | 'Exit') => {
        setFormData({ ...formData, type: value, animalId: '' }); 
    };

  const handleFormSubmit = async () => {
    if (!firestore || !user) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
        return;
    }
    if (!formData.animalId || !formData.date || !formData.reason) {
        toast({ variant: 'destructive', title: 'Validation Error', description: 'Animal, Date, and Reason are required.' });
        return;
    }

    setIsSubmitting(true);
    
    try {
        if (dialogMode === 'create') {
            const movementColRef = collection(firestore, `users/${user.uid}/movements`);
            await addDocumentNonBlocking(movementColRef, { ...formData, ownerId: user.uid });
            toast({ title: 'Success', description: 'New movement record has been added.' });
        } else if (dialogMode === 'edit' && selectedMovement) {
            const movementDocRef = doc(firestore, `users/${user.uid}/movements`, selectedMovement.id);
            await updateDocumentNonBlocking(movementDocRef, formData);
            toast({ title: 'Success', description: 'Movement record has been updated.' });
        }
        setIsFormOpen(false);
    } catch (error) {
        console.error("Error saving movement record:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save movement record.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
      if (!firestore || !user || !movementToDelete) return;
      
      const movementDocRef = doc(firestore, `users/${user.uid}/movements`, movementToDelete.id);
      try {
        await deleteDocumentNonBlocking(movementDocRef);
        toast({ title: 'Success', description: 'Movement record has been deleted.'});
      } catch (error) {
        console.error("Error deleting movement:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete movement record.' });
      } finally {
        setIsDeleteAlertOpen(false);
        setMovementToDelete(null);
      }
  };

  const isLoading = isLoadingAll || isLoadingAnimals;

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
                <CardTitle>Animal Movement</CardTitle>
                <CardDescription>Track animal entry and exit records.</CardDescription>
            </div>
             <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:flex-initial">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by Tag No..." 
                        className="pl-8 w-full min-w-[150px] md:w-[250px] lg:w-[300px]" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={() => openDialog('create')}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Movement
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
         <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="entries">Entries</TabsTrigger>
            <TabsTrigger value="exits">Exits</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4">
            <MovementsTable movements={filteredMovements} isLoading={isLoading} onEdit={(mov) => openDialog('edit', mov)} onDelete={openDeleteDialog} searchTerm={searchTerm} />
          </TabsContent>
          <TabsContent value="entries" className="mt-4">
             <MovementsTable movements={entryMovements} isLoading={isLoading} onEdit={(mov) => openDialog('edit', mov)} onDelete={openDeleteDialog} searchTerm={searchTerm} />
          </TabsContent>
           <TabsContent value="exits" className="mt-4">
             <MovementsTable movements={exitMovements} isLoading={isLoading} onEdit={(mov) => openDialog('edit', mov)} onDelete={openDeleteDialog} searchTerm={searchTerm} />
          </TabsContent>
        </Tabs>
      </CardContent>
       <CardFooter>
        <div className="text-xs text-muted-foreground">
          Showing <strong>{filteredMovements?.length ?? 0}</strong> of <strong>{allMovements?.length ?? 0}</strong> records
        </div>
      </CardFooter>
    </Card>

    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>{dialogMode === 'create' ? 'Add Movement Record' : 'Edit Movement Record'}</DialogTitle>
                <DialogDescription>
                    Fill in the details for the animal's movement.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="type">Movement Type</Label>
                        <Select value={formData.type} onValueChange={handleMovementTypeChange} disabled={dialogMode === 'edit'}>
                            <SelectTrigger id="type">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Entry">Entry</SelectItem>
                                <SelectItem value="Exit">Exit</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="date">Date</Label>
                        <DatePicker date={new Date(formData.date)} setDate={(d) => setFormData({ ...formData, date: d?.toISOString() || '' })} />
                    </div>
                </div>

                 <div className="space-y-2">
                    <Label htmlFor="animalId">Animal (by Tag No)</Label>
                     <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                        <PopoverTrigger asChild>
                            <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={comboboxOpen}
                            className="w-full justify-between"
                            disabled={isLoadingAnimals || dialogMode === 'edit'}
                            >
                            {formData.animalId
                                ? animals?.find((animal) => animal.id === formData.animalId)?.govtTagNo
                                : "Select an animal..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" sideOffset={5}>
                            <Command>
                            <CommandInput placeholder="Search animal..." />
                            <CommandEmpty>
                                {isLoadingAnimals ? "Loading animals..." : `No animals available for ${formData.type}.`}
                            </CommandEmpty>
                            <CommandGroup>
                                {availableAnimalsForMovement.map((animal) => (
                                <CommandItem
                                    key={animal.id}
                                    value={`${animal.govtTagNo} ${animal.breed}`}
                                    onSelect={() => {
                                        setFormData({...formData, animalId: animal.id });
                                        setComboboxOpen(false);
                                    }}
                                >
                                    <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.animalId === animal.id ? "opacity-100" : "opacity-0"
                                    )}
                                    />
                                    {animal.govtTagNo} - {animal.breed}
                                </CommandItem>
                                ))}
                            </CommandGroup>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>

                 <div className="space-y-2">
                    <Label htmlFor="reason">Reason</Label>
                    <Input 
                        id="reason" 
                        value={formData.reason} 
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })} 
                        placeholder={formData.type === 'Entry' ? "e.g., Rescued, Born at Gaushala" : "e.g., Adopted, Deceased"}
                    />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary">Cancel</Button>
                </DialogClose>
                <Button type="submit" onClick={handleFormSubmit} disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Record'}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the movement record.
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

    