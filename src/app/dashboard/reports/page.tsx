

'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Sheet as ExcelIcon, Search, Check, ChevronsUpDown } from 'lucide-react';
import { DatePickerWithRange } from '@/components/date-picker-range';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Animal, AnimalMovement } from '@/lib/types';
import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { format, eachDayOfInterval, startOfDay, subDays, endOfDay } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';


declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

function AnimalRegistryReport() {
    const firestore = useFirestore();
    const { user } = useUser();

    const [typeFilter, setTypeFilter] = useState('All');
    const [breedFilter, setBreedFilter] = useState('All');
    const [colorFilter, setColorFilter] = useState('All');
    const [healthStatusFilter, setHealthStatusFilter] = useState('All');
    const [ageFilter, setAgeFilter] = useState('All');

    const animalsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, `users/${user.uid}/animals`);
    }, [user, firestore]);

    const { data: animals, isLoading } = useCollection<Animal>(animalsQuery);

    const filteredAnimals = useMemo(() => {
        if (!animals) return [];
        return animals.filter(animal => {
            const typeMatch = typeFilter === 'All' || animal.type === typeFilter;
            const breedMatch = breedFilter === 'All' || animal.breed === breedFilter;
            const colorMatch = colorFilter === 'All' || animal.color === colorFilter;
            const healthStatusMatch = healthStatusFilter === 'All' || animal.healthStatus === healthStatusFilter;

            const age = new Date().getFullYear() - animal.yearOfBirth;
            const ageMatch = ageFilter === 'All' || 
                (ageFilter === '0-2' && age <= 2) ||
                (ageFilter === '3-5' && age >= 3 && age <= 5) ||
                (ageFilter === '6-10' && age >= 6 && age <= 10) ||
                (ageFilter === '10+' && age > 10);
            
            return typeMatch && breedMatch && colorMatch && healthStatusMatch && ageMatch;
        });
    }, [animals, typeFilter, breedFilter, colorFilter, healthStatusFilter, ageFilter]);
    
    const uniqueTypes = useMemo(() => ['All Types', ...Array.from(new Set(animals?.map(a => a.type)))], [animals]);
    const uniqueBreeds = useMemo(() => ['All Breeds', ...Array.from(new Set(animals?.map(a => a.breed)))], [animals]);
    const uniqueColors = useMemo(() => ['All Colors', ...Array.from(new Set(animals?.map(a => a.color)))], [animals]);
    const uniqueHealthStatuses = ['All Health Statuses', 'Healthy', 'Sick', 'Under Treatment'];
    const ageRanges = ['All Ages', '0-2', '3-5', '6-10', '10+'];

    const exportToExcel = () => {
        const dataToExport = filteredAnimals.map(animal => ({
            'Tag No': animal.govtTagNo,
            'Type': animal.type,
            'Breed': animal.breed,
            'Color': animal.color,
            'Gender': animal.gender,
            'Year of Birth': animal.yearOfBirth,
            'Health Status': animal.healthStatus,
            'Tag Color': animal.tagColor,
            'Identification Mark': animal.identificationMark || '',
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Animal Registry");
        XLSX.writeFile(workbook, "Animal_Registry_Report.xlsx");
    };

    const exportToPdf = () => {
        const doc = new jsPDF();
        doc.text("Animal Registry Report", 14, 15);
        
        const tableData = filteredAnimals.map(animal => [
            animal.govtTagNo,
            animal.type,
            animal.breed,
            animal.color,
            animal.gender,
            animal.yearOfBirth.toString(),
            animal.healthStatus,
        ]);

        doc.autoTable({
            startY: 20,
            head: [['Tag No', 'Type', 'Breed', 'Color', 'Gender', 'Birth Year', 'Status']],
            body: tableData,
        });

        doc.save('Animal_Registry_Report.pdf');
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <CardTitle>Animal Registry</CardTitle>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={exportToExcel} disabled={isLoading || filteredAnimals.length === 0}><ExcelIcon className="mr-2 h-4 w-4" /> Excel</Button>
                        <Button variant="outline" onClick={exportToPdf} disabled={isLoading || filteredAnimals.length === 0}><FileText className="mr-2 h-4 w-4" /> PDF</Button>
                    </div>
                </div>
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4">
                   <Select value={typeFilter} onValueChange={setTypeFilter}>
                       <SelectTrigger><SelectValue placeholder="All Types" /></SelectTrigger>
                       <SelectContent>{uniqueTypes.map(t => <SelectItem key={t} value={t === 'All Types' ? 'All' : t}>{t}</SelectItem>)}</SelectContent>
                   </Select>
                   <Select value={breedFilter} onValueChange={setBreedFilter}>
                       <SelectTrigger><SelectValue placeholder="All Breeds" /></SelectTrigger>
                       <SelectContent>{uniqueBreeds.map(b => <SelectItem key={b} value={b === 'All Breeds' ? 'All' : b}>{b}</SelectItem>)}</SelectContent>
                   </Select>
                   <Select value={colorFilter} onValueChange={setColorFilter}>
                       <SelectTrigger><SelectValue placeholder="All Colors" /></SelectTrigger>
                       <SelectContent>{uniqueColors.map(c => <SelectItem key={c} value={c === 'All Colors' ? 'All' : c}>{c}</SelectItem>)}</SelectContent>
                   </Select>
                   <Select value={healthStatusFilter} onValueChange={setHealthStatusFilter}>
                       <SelectTrigger><SelectValue placeholder="All Health Statuses" /></SelectTrigger>
                       <SelectContent>{uniqueHealthStatuses.map(s => <SelectItem key={s} value={s === 'All Health Statuses' ? 'All' : s}>{s}</SelectItem>)}</SelectContent>
                   </Select>
                   <Select value={ageFilter} onValueChange={setAgeFilter}>
                       <SelectTrigger><SelectValue placeholder="All Ages" /></SelectTrigger>
                       <SelectContent>{ageRanges.map(a => <SelectItem key={a} value={a === 'All Ages' ? 'All' : a}>{a === '10+' ? '> 10 Years' : a === 'All' ? 'All Ages' : `${a} Years`}</SelectItem>)}</SelectContent>
                   </Select>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Image</TableHead>
                            <TableHead>Tag No</TableHead>
                            <TableHead>Breed</TableHead>
                            <TableHead>Color</TableHead>
                            <TableHead>Gender</TableHead>
                            <TableHead>Age</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && Array.from({length: 5}).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-10 w-10 rounded-md" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                            </TableRow>
                        ))}
                        {!isLoading && filteredAnimals.map(animal => (
                            <TableRow key={animal.id}>
                                <TableCell>
                                    <Image 
                                        src={animal.imageUrl || "https://picsum.photos/seed/placeholder/80/80"} 
                                        alt={animal.breed}
                                        width={40}
                                        height={40}
                                        className="rounded-md object-cover aspect-square"
                                    />
                                </TableCell>
                                <TableCell className="font-medium">{animal.govtTagNo}</TableCell>
                                <TableCell>{animal.breed}</TableCell>
                                <TableCell>{animal.color}</TableCell>
                                <TableCell>{animal.gender}</TableCell>
                                <TableCell>{new Date().getFullYear() - animal.yearOfBirth}</TableCell>
                                <TableCell>{animal.healthStatus}</TableCell>
                            </TableRow>
                        ))}
                        {!isLoading && filteredAnimals.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    No animals match the selected filters.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function MovementHistoryReport() {
    const firestore = useFirestore();
    const { user } = useUser();
    
    const [filter, setFilter] = useState<'All' | 'Entry' | 'Exit'>('All');
    const [searchTerm, setSearchTerm] = useState('');

    const animalsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, `users/${user.uid}/animals`);
    }, [user, firestore]);

    const movementsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, `users/${user.uid}/movements`);
    }, [user, firestore]);

    const { data: animals, isLoading: isLoadingAnimals } = useCollection<Animal>(animalsQuery);
    const { data: movements, isLoading: isLoadingMovements } = useCollection<AnimalMovement>(movementsQuery);
    
    const animalMap = useMemo(() => new Map(animals?.map(a => [a.id, a.govtTagNo])), [animals]);

    const filteredMovements = useMemo(() => {
        if (!movements) return [];
        let movementsWithTags = movements.map(m => ({
            ...m,
            animalGovtTagNo: animalMap.get(m.animalId) || 'Unknown Tag'
        }));

        if (filter !== 'All') {
            movementsWithTags = movementsWithTags.filter(m => m.type === filter);
        }
        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            movementsWithTags = movementsWithTags.filter(m => 
                m.reason.toLowerCase().includes(lowercasedTerm) || 
                m.animalGovtTagNo.toLowerCase().includes(lowercasedTerm)
            );
        }
        return movementsWithTags;
    }, [movements, animalMap, filter, searchTerm]);

    const isLoading = isLoadingAnimals || isLoadingMovements;

    const exportToExcel = () => {
        const dataToExport = filteredMovements.map(m => ({
            'Date': format(new Date(m.date), 'dd/MM/yyyy'),
            'Animal Tag': m.animalGovtTagNo,
            'Type': m.type,
            'Reason': m.reason
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Movement History");
        XLSX.writeFile(workbook, "Movement_History_Report.xlsx");
    };

    const exportToPdf = () => {
        const doc = new jsPDF();
        doc.text("Animal Movement History Report", 14, 15);
        
        const tableData = filteredMovements.map(m => [
            format(new Date(m.date), 'dd/MM/yyyy'),
            m.animalGovtTagNo,
            m.type,
            m.reason
        ]);

        doc.autoTable({
            startY: 20,
            head: [['Date', 'Animal Tag', 'Type', 'Reason']],
            body: tableData,
        });

        doc.save('Movement_History_Report.pdf');
    };


    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <CardTitle>Animal Movement History</CardTitle>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={exportToExcel} disabled={isLoading || filteredMovements.length === 0}><ExcelIcon className="mr-2 h-4 w-4" /> Excel</Button>
                        <Button variant="outline" onClick={exportToPdf} disabled={isLoading || filteredMovements.length === 0}><FileText className="mr-2 h-4 w-4" /> PDF</Button>
                    </div>
                </div>
                 <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4">
                    <div className="flex items-center gap-2">
                        <Button variant={filter === 'All' ? 'default' : 'outline'} onClick={() => setFilter('All')}>All</Button>
                        <Button variant={filter === 'Entry' ? 'default' : 'outline'} onClick={() => setFilter('Entry')}>Check In</Button>
                        <Button variant={filter === 'Exit' ? 'default' : 'outline'} onClick={() => setFilter('Exit')}>Check Out</Button>
                    </div>
                    <div className="relative w-full md:w-auto">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search by reason or animal..." 
                            className="pl-8 w-full md:w-[300px]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Animal Tag</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Reason</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && Array.from({length: 5}).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                            </TableRow>
                        ))}
                        {!isLoading && filteredMovements.map(movement => (
                            <TableRow key={movement.id}>
                                <TableCell>{format(new Date(movement.date), 'dd/MM/yyyy')}</TableCell>
                                <TableCell className="font-medium">{movement.animalGovtTagNo}</TableCell>
                                <TableCell>
                                    <Badge className={cn(movement.type === 'Entry' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')} variant={movement.type === 'Entry' ? 'secondary' : 'destructive'}>
                                        {movement.type === 'Entry' ? 'Check In' : 'Check Out'}
                                    </Badge>
                                </TableCell>
                                <TableCell>{movement.reason}</TableCell>
                            </TableRow>
                        ))}
                        {!isLoading && filteredMovements.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    No movements found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

type DailySummaryRow = {
    date: string;
    openingMale: number;
    openingFemale: number;
    opening0_3yr: number;
    openingGt3yr: number;
    inMale: number;
    inFemale: number;
    in0_3yr: number;
    inGt3yr: number;
    inReasons: string;
    outMale: number;
    outFemale: number;
    out0_3yr: number;
    outGt3yr: number;
    outReasons: string;
    closingMale: number;
    closingFemale: number;
    closing0_3yr: number;
    closingGt3yr: number;
};

function DailySummaryReport() {
    const firestore = useFirestore();
    const { user } = useUser();
    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 7), to: new Date() });
    const [selectedAnimalType, setSelectedAnimalType] = useState<string | 'All'>('All');
    const [animalPopoverOpen, setAnimalPopoverOpen] = useState(false);

    const animalsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, `users/${user.uid}/animals`);
    }, [user, firestore]);

    const movementsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, `users/${user.uid}/movements`);
    }, [user, firestore]);

    const { data: animals, isLoading: isLoadingAnimals } = useCollection<Animal>(animalsQuery);
    const { data: movements, isLoading: isLoadingMovements } = useCollection<AnimalMovement>(movementsQuery);
    
    const uniqueAnimalTypes = useMemo(() => {
        if (!animals) return [];
        return ['All', ...Array.from(new Set(animals.map(a => a.type)))];
    }, [animals]);
    
    const animalMap = useMemo(() => new Map(animals?.map(a => [a.id, a])), [animals]);
    
    const dailySummaryData = useMemo(() => {
        if (!animals || !movements || !dateRange?.from) return [];
        
        const animalsToProcess = selectedAnimalType === 'All' 
            ? animals 
            : animals.filter(a => a.type === selectedAnimalType);
        
        const animalIdsToProcess = new Set(animalsToProcess.map(a => a.id));

        const startDate = startOfDay(dateRange.from);
        const endDate = dateRange.to ? startOfDay(dateRange.to) : startDate;
        
        const sortedMovements = movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let openingBalance = { male: 0, female: 0, '0-3yr': 0, '>3yr': 0 };

        animals.forEach(animal => {
            if (!animalIdsToProcess.has(animal.id)) return;

            const lastMovementBeforeStart = sortedMovements
                .filter(m => m.animalId === animal.id && startOfDay(new Date(m.date)) < startDate)
                .pop();
            
            if (lastMovementBeforeStart?.type === 'Entry') {
                 const age = startDate.getFullYear() - animal.yearOfBirth;
                 if (animal.gender === 'Male') openingBalance.male++;
                 else openingBalance.female++;

                 if (age <= 3) openingBalance['0-3yr']++;
                 else openingBalance['>3yr']++;
            }
        });


        const dateArray = eachDayOfInterval({ start: startDate, end: endDate });
        const reportData: DailySummaryRow[] = [];

        dateArray.forEach(currentDate => {
            const currentDayMovements = sortedMovements.filter(m => {
                const isCorrectDate = startOfDay(new Date(m.date)).getTime() === currentDate.getTime();
                return isCorrectDate && animalIdsToProcess.has(m.animalId);
            });
            
            const dailyIn = { male: 0, female: 0, '0-3yr': 0, '>3yr': 0, reasons: [] as string[] };
            const dailyOut = { male: 0, female: 0, '0-3yr': 0, '>3yr': 0, reasons: [] as string[] };

            currentDayMovements.forEach(m => {
                const animal = animalMap.get(m.animalId);
                if (animal) {
                    const age = currentDate.getFullYear() - animal.yearOfBirth;
                    const stats = m.type === 'Entry' ? dailyIn : dailyOut;
                    
                    if (animal.gender === 'Male') stats.male++;
                    else stats.female++;

                    if (age <= 3) stats['0-3yr']++;
                    else stats['>3yr']++;
                    if(m.reason) stats.reasons.push(m.reason);
                }
            });
            
            const closingBalance = {
                male: openingBalance.male + dailyIn.male - dailyOut.male,
                female: openingBalance.female + dailyIn.female - dailyOut.female,
                '0-3yr': openingBalance['0-3yr'] + dailyIn['0-3yr'] - dailyOut['0-3yr'],
                '>3yr': openingBalance['>3yr'] + dailyIn['>3yr'] - dailyOut['>3yr'],
            };
            
            reportData.push({
                date: format(currentDate, 'dd-MM-yyyy'),
                openingMale: openingBalance.male,
                openingFemale: openingBalance.female,
                opening0_3yr: openingBalance['0-3yr'],
                openingGt3yr: openingBalance['>3yr'],
                inMale: dailyIn.male,
                inFemale: dailyIn.female,
                in0_3yr: dailyIn['0-3yr'],
                inGt3yr: dailyIn['>3yr'],
                inReasons: dailyIn.reasons.join(', '),
                outMale: dailyOut.male,
                outFemale: dailyOut.female,
                out0_3yr: dailyOut['0-3yr'],
                outGt3yr: dailyOut['>3yr'],
                outReasons: dailyOut.reasons.join(', '),
                closingMale: closingBalance.male,
                closingFemale: closingBalance.female,
                closing0_3yr: closingBalance['0-3yr'],
                closingGt3yr: closingBalance['>3yr'],
            });

            openingBalance = closingBalance;
        });

        return reportData;
    }, [animals, movements, dateRange, animalMap, selectedAnimalType]);

    const isLoading = isLoadingAnimals || isLoadingMovements;

    const exportToExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(dailySummaryData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Summary");
        XLSX.writeFile(workbook, "Daily_Summary_Report.xlsx");
    };

    const exportToPdf = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text("Daily Summary Report", 14, 15);
        
        const tableData = dailySummaryData.map(row => Object.values(row));
        const head = [
            ['Date', 'Open M', 'Open F', 'Open 0-3', 'Open >3', 'In M', 'In F', 'In 0-3', 'In >3', 'In Reasons',
            'Out M', 'Out F', 'Out 0-3', 'Out >3', 'Out Reasons', 'Close M', 'Close F', 'Close 0-3', 'Close >3']
        ];

        doc.autoTable({
            startY: 20,
            head: head,
            body: tableData,
            styles: { fontSize: 7, cellPadding: 1 },
            headStyles: { fontStyle: 'bold', fontSize: 7, fillColor: [22, 163, 74] },
        });

        doc.save('Daily_Summary_Report.pdf');
    };

    return (
         <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <CardTitle>Daily Summary</CardTitle>
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <Popover open={animalPopoverOpen} onOpenChange={setAnimalPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full md:w-[200px] justify-between">
                                    {selectedAnimalType}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Search animal type..." />
                                    <CommandEmpty>No animal types found.</CommandEmpty>
                                    <CommandGroup>
                                        {uniqueAnimalTypes.map(type => (
                                            <CommandItem key={type} value={type} onSelect={() => { setSelectedAnimalType(type); setAnimalPopoverOpen(false); }}>
                                                <Check className={cn("mr-2 h-4 w-4", selectedAnimalType === type ? "opacity-100" : "opacity-0")} />
                                                {type}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                        <div className="flex gap-2">
                           <Button variant="outline" size="icon" onClick={exportToExcel} disabled={isLoading || dailySummaryData.length === 0}><ExcelIcon className="h-4 w-4" /></Button>
                           <Button variant="outline" size="icon" onClick={exportToPdf} disabled={isLoading || dailySummaryData.length === 0}><FileText className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                 <div className="w-full overflow-x-auto">
                    <Table>
                        <TableHeader>
                             <TableRow>
                                <TableHead className="text-left border-r min-w-[120px]">Date</TableHead>
                                <TableHead colSpan={4} className="text-center border-r">OPENING</TableHead>
                                <TableHead colSpan={5} className="text-center border-r">IN</TableHead>
                                <TableHead colSpan={5} className="text-center border-r">OUT</TableHead>
                                <TableHead colSpan={4} className="text-center">CLOSING</TableHead>
                            </TableRow>
                            <TableRow>
                                <TableHead className="border-r"></TableHead>
                                <TableHead className="text-center">M</TableHead>
                                <TableHead className="text-center">F</TableHead>
                                <TableHead className="text-center">0-3</TableHead>
                                <TableHead className="text-center border-r">&gt;3</TableHead>
                                <TableHead className="text-center">M</TableHead>
                                <TableHead className="text-center">F</TableHead>
                                <TableHead className="text-center">0-3</TableHead>
                                <TableHead className="text-center">&gt;3</TableHead>
                                <TableHead className="text-center border-r">Reason</TableHead>
                                <TableHead className="text-center">M</TableHead>
                                <TableHead className="text-center">F</TableHead>
                                <TableHead className="text-center">0-3</TableHead>
                                <TableHead className="text-center">&gt;3</TableHead>
                                <TableHead className="text-center border-r">Reason</TableHead>
                                <TableHead className="text-center">M</TableHead>
                                <TableHead className="text-center">F</TableHead>
                                <TableHead className="text-center">0-3</TableHead>
                                <TableHead className="text-center">&gt;3</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && <tr><TableCell colSpan={19}><Skeleton className="h-20 w-full"/></TableCell></tr>}
                            {!isLoading && dailySummaryData.map(row => (
                                <TableRow key={row.date}>
                                    <TableCell className="font-medium border-r">{row.date}</TableCell>
                                    <TableCell className="text-center">{row.openingMale}</TableCell>
                                    <TableCell className="text-center">{row.openingFemale}</TableCell>
                                    <TableCell className="text-center">{row.opening0_3yr}</TableCell>
                                    <TableCell className="text-center border-r">{row.openingGt3yr}</TableCell>
                                    <TableCell className="text-center">{row.inMale}</TableCell>
                                    <TableCell className="text-center">{row.inFemale}</TableCell>
                                    <TableCell className="text-center">{row.in0_3yr}</TableCell>
                                    <TableCell className="text-center">{row.inGt3yr}</TableCell>
                                    <TableCell className="max-w-[150px] truncate border-r">{row.inReasons}</TableCell>
                                    <TableCell className="text-center">{row.outMale}</TableCell>
                                    <TableCell className="text-center">{row.outFemale}</TableCell>
                                    <TableCell className="text-center">{row.out0_3yr}</TableCell>
                                    <TableCell className="text-center">{row.outGt3yr}</TableCell>
                                    <TableCell className="max-w-[150px] truncate border-r">{row.outReasons}</TableCell>
                                    <TableCell className="text-center">{row.closingMale}</TableCell>
                                    <TableCell className="text-center">{row.closingFemale}</TableCell>
                                    <TableCell className="text-center">{row.closing0_3yr}</TableCell>
                                    <TableCell className="text-center">{row.closingGt3yr}</TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && dailySummaryData.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={19} className="h-24 text-center">No data for selected date range.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                 </div>
            </CardContent>
         </Card>
    );
}

type CrossTabSummary = {
    opening: { '0-3yr': number; '>3yr': number; total: number };
    in: { '0-3yr': number; '>3yr': number; total: number; reasons: string[] };
    out: { '0-3yr': number; '>3yr': number; total: number; reasons: string[] };
    closing: { '0-3yr': number; '>3yr': number; total: number };
};

type CrossTabReportData = {
    male: CrossTabSummary;
    female: CrossTabSummary;
    total: CrossTabSummary;
};

function CrossTabSummaryReport() {
    const firestore = useFirestore();
    const { user } = useUser();
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [selectedAnimalType, setSelectedAnimalType] = useState<string | 'All'>('All');
    const [animalPopoverOpen, setAnimalPopoverOpen] = useState(false);

    const animalsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, `users/${user.uid}/animals`);
    }, [user, firestore]);

    const movementsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, `users/${user.uid}/movements`);
    }, [user, firestore]);

    const { data: animals, isLoading: isLoadingAnimals } = useCollection<Animal>(animalsQuery);
    const { data: movements, isLoading: isLoadingMovements } = useCollection<AnimalMovement>(movementsQuery);
    
    const uniqueAnimalTypes = useMemo(() => {
        if (!animals) return [];
        return ['All', ...Array.from(new Set(animals.map(a => a.type)))];
    }, [animals]);
    
    const crossTabData = useMemo<CrossTabReportData | null>(() => {
        if (!animals || !movements || !dateRange?.from) return null;

        const animalsToProcess = selectedAnimalType === 'All' 
            ? animals 
            : animals.filter(a => a.type === selectedAnimalType);
        
        const animalMap = new Map(animalsToProcess.map(a => [a.id, a]));

        const startDate = startOfDay(dateRange.from);
        const endDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        
        const sortedMovements = movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const getEmptySummary = (): CrossTabSummary => ({
            opening: { '0-3yr': 0, '>3yr': 0, total: 0 },
            in: { '0-3yr': 0, '>3yr': 0, total: 0, reasons: [] },
            out: { '0-3yr': 0, '>3yr': 0, total: 0, reasons: [] },
            closing: { '0-3yr': 0, '>3yr': 0, total: 0 },
        });

        const reportData: CrossTabReportData = {
            male: getEmptySummary(),
            female: getEmptySummary(),
            total: getEmptySummary(),
        };
        
        animalsToProcess.forEach(animal => {
            const lastMovementBeforeStart = sortedMovements
                .filter(m => m.animalId === animal.id && new Date(m.date) < startDate)
                .pop();
            
            if (lastMovementBeforeStart?.type === 'Entry') {
                const genderData = animal.gender === 'Male' ? reportData.male : reportData.female;
                const age = startDate.getFullYear() - animal.yearOfBirth;
                const ageGroup = age <= 3 ? '0-3yr' : '>3yr';
                genderData.opening[ageGroup]++;
                genderData.opening.total++;
            }
        });

        const movementsInRange = sortedMovements.filter(m => {
            const moveDate = new Date(m.date);
            return moveDate >= startDate && moveDate <= endDate && animalMap.has(m.animalId);
        });

        movementsInRange.forEach(movement => {
            const animal = animalMap.get(movement.animalId);
            if (!animal) return;

            const genderData = animal.gender === 'Male' ? reportData.male : reportData.female;
            const age = new Date(movement.date).getFullYear() - animal.yearOfBirth;
            const ageGroup = age <= 3 ? '0-3yr' : '>3yr';
            const movementTypeData = movement.type === 'Entry' ? genderData.in : genderData.out;

            movementTypeData[ageGroup]++;
            movementTypeData.total++;
            if (movement.reason) movementTypeData.reasons.push(movement.reason);
        });

        // Calculate closing and totals
        ['male', 'female'].forEach(g => {
            const gender = g as 'male' | 'female';
            const data = reportData[gender];
            data.closing['0-3yr'] = data.opening['0-3yr'] + data.in['0-3yr'] - data.out['0-3yr'];
            data.closing['>3yr'] = data.opening['>3yr'] + data.in['>3yr'] - data.out['>3yr'];
            data.closing.total = data.opening.total + data.in.total - data.out.total;
        });
        
        reportData.total.opening['0-3yr'] = reportData.male.opening['0-3yr'] + reportData.female.opening['0-3yr'];
        reportData.total.opening['>3yr'] = reportData.male.opening['>3yr'] + reportData.female.opening['>3yr'];
        reportData.total.opening.total = reportData.male.opening.total + reportData.female.opening.total;
        reportData.total.in['0-3yr'] = reportData.male.in['0-3yr'] + reportData.female.in['0-3yr'];
        reportData.total.in['>3yr'] = reportData.male.in['>3yr'] + reportData.female.in['>3yr'];
        reportData.total.in.total = reportData.male.in.total + reportData.female.in.total;
        reportData.total.out['0-3yr'] = reportData.male.out['0-3yr'] + reportData.female.out['0-3yr'];
        reportData.total.out['>3yr'] = reportData.male.out['>3yr'] + reportData.female.out['>3yr'];
        reportData.total.out.total = reportData.male.out.total + reportData.female.out.total;
        reportData.total.closing['0-3yr'] = reportData.male.closing['0-3yr'] + reportData.female.closing['0-3yr'];
        reportData.total.closing['>3yr'] = reportData.male.closing['>3yr'] + reportData.female.closing['>3yr'];
        reportData.total.closing.total = reportData.male.closing.total + reportData.female.closing.total;
        reportData.total.in.reasons = [...reportData.male.in.reasons, ...reportData.female.in.reasons];
        reportData.total.out.reasons = [...reportData.male.out.reasons, ...reportData.female.out.reasons];

        return reportData;

    }, [animals, movements, dateRange, selectedAnimalType]);
    
    const isLoading = isLoadingAnimals || isLoadingMovements;

    return (
        <Card>
            <CardHeader>
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <CardTitle>Cross-Tab Summary</CardTitle>
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <Popover open={animalPopoverOpen} onOpenChange={setAnimalPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full md:w-[200px] justify-between">
                                    {selectedAnimalType}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Search animal type..." />
                                    <CommandEmpty>No animal types found.</CommandEmpty>
                                    <CommandGroup>
                                        {uniqueAnimalTypes.map(type => (
                                            <CommandItem key={type} value={type} onSelect={() => { setSelectedAnimalType(type); setAnimalPopoverOpen(false); }}>
                                                <Check className={cn("mr-2 h-4 w-4", selectedAnimalType === type ? "opacity-100" : "opacity-0")} />
                                                {type}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                        <div className="flex gap-2">
                           <Button variant="outline" size="icon" disabled={isLoading || !crossTabData}><ExcelIcon className="h-4 w-4" /></Button>
                           <Button variant="outline" size="icon" disabled={isLoading || !crossTabData}><FileText className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="w-full overflow-x-auto">
                     <Table className="border">
                        <TableHeader>
                             <TableRow>
                                <TableHead rowSpan={2} className="text-left align-middle border-r min-w-[80px]"></TableHead>
                                <TableHead colSpan={3} className="text-center border-r">OPENING</TableHead>
                                <TableHead colSpan={4} className="text-center border-r">IN</TableHead>
                                <TableHead colSpan={4} className="text-center border-r">OUT</TableHead>
                                <TableHead colSpan={3} className="text-center">CLOSING</TableHead>
                            </TableRow>
                            <TableRow>
                                <TableHead className="text-center">0-3 YR</TableHead>
                                <TableHead className="text-center">&gt;3 YR</TableHead>
                                <TableHead className="text-center font-bold border-r">TOTAL</TableHead>
                                <TableHead className="text-center">0-3 YR</TableHead>
                                <TableHead className="text-center">&gt;3 YR</TableHead>
                                <TableHead className="text-center font-bold">TOTAL</TableHead>
                                <TableHead className="text-center border-r">REASON</TableHead>
                                <TableHead className="text-center">0-3 YR</TableHead>
                                <TableHead className="text-center">&gt;3 YR</TableHead>
                                <TableHead className="text-center font-bold">TOTAL</TableHead>
                                <TableHead className="text-center border-r">REASON</TableHead>
                                <TableHead className="text-center">0-3 YR</TableHead>
                                <TableHead className="text-center">&gt;3 YR</TableHead>
                                <TableHead className="text-center font-bold">TOTAL</TableHead>
                            </TableRow>
                        </TableHeader>
                         <TableBody>
                            {isLoading && <tr><TableCell colSpan={15}><Skeleton className="h-20 w-full"/></TableCell></tr>}
                            {!isLoading && !crossTabData && (
                                <TableRow>
                                    <TableCell colSpan={15} className="h-24 text-center">
                                        Please select a date range to view the report.
                                    </TableCell>
                                </TableRow>
                            )}
                            {crossTabData && (
                                <>
                                <TableRow>
                                    <TableCell className="font-bold border-r">Male</TableCell>
                                    <TableCell className="text-center">{crossTabData.male.opening['0-3yr']}</TableCell>
                                    <TableCell className="text-center">{crossTabData.male.opening['>3yr']}</TableCell>
                                    <TableCell className="text-center font-bold border-r">{crossTabData.male.opening.total}</TableCell>
                                    <TableCell className="text-center">{crossTabData.male.in['0-3yr']}</TableCell>
                                    <TableCell className="text-center">{crossTabData.male.in['>3yr']}</TableCell>
                                    <TableCell className="text-center font-bold">{crossTabData.male.in.total}</TableCell>
                                    <TableCell className="text-center border-r max-w-xs truncate">{[...new Set(crossTabData.male.in.reasons)].join(', ')}</TableCell>
                                    <TableCell className="text-center">{crossTabData.male.out['0-3yr']}</TableCell>
                                    <TableCell className="text-center">{crossTabData.male.out['>3yr']}</TableCell>
                                    <TableCell className="text-center font-bold">{crossTabData.male.out.total}</TableCell>
                                    <TableCell className="text-center border-r max-w-xs truncate">{[...new Set(crossTabData.male.out.reasons)].join(', ')}</TableCell>
                                    <TableCell className="text-center">{crossTabData.male.closing['0-3yr']}</TableCell>
                                    <TableCell className="text-center">{crossTabData.male.closing['>3yr']}</TableCell>
                                    <TableCell className="text-center font-bold">{crossTabData.male.closing.total}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-bold border-r">Female</TableCell>
                                    <TableCell className="text-center">{crossTabData.female.opening['0-3yr']}</TableCell>
                                    <TableCell className="text-center">{crossTabData.female.opening['>3yr']}</TableCell>
                                    <TableCell className="text-center font-bold border-r">{crossTabData.female.opening.total}</TableCell>
                                    <TableCell className="text-center">{crossTabData.female.in['0-3yr']}</TableCell>
                                    <TableCell className="text-center">{crossTabData.female.in['>3yr']}</TableCell>
                                    <TableCell className="text-center font-bold">{crossTabData.female.in.total}</TableCell>
                                    <TableCell className="text-center border-r max-w-xs truncate">{[...new Set(crossTabData.female.in.reasons)].join(', ')}</TableCell>
                                    <TableCell className="text-center">{crossTabData.female.out['0-3yr']}</TableCell>
                                    <TableCell className="text-center">{crossTabData.female.out['>3yr']}</TableCell>
                                    <TableCell className="text-center font-bold">{crossTabData.female.out.total}</TableCell>
                                    <TableCell className="text-center border-r max-w-xs truncate">{[...new Set(crossTabData.female.out.reasons)].join(', ')}</TableCell>
                                    <TableCell className="text-center">{crossTabData.female.closing['0-3yr']}</TableCell>
                                    <TableCell className="text-center">{crossTabData.female.closing['>3yr']}</TableCell>
                                    <TableCell className="text-center font-bold">{crossTabData.female.closing.total}</TableCell>
                                </TableRow>
                                <TableRow className="bg-muted font-bold">
                                    <TableCell className="font-bold border-r">Total</TableCell>
                                    <TableCell className="text-center">{crossTabData.total.opening['0-3yr']}</TableCell>
                                    <TableCell className="text-center">{crossTabData.total.opening['>3yr']}</TableCell>
                                    <TableCell className="text-center font-bold border-r">{crossTabData.total.opening.total}</TableCell>
                                    <TableCell className="text-center">{crossTabData.total.in['0-3yr']}</TableCell>
                                    <TableCell className="text-center">{crossTabData.total.in['>3yr']}</TableCell>
                                    <TableCell className="text-center font-bold">{crossTabData.total.in.total}</TableCell>
                                    <TableCell className="text-center border-r max-w-xs truncate">{[...new Set(crossTabData.total.in.reasons)].join(', ')}</TableCell>
                                    <TableCell className="text-center">{crossTabData.total.out['0-3yr']}</TableCell>
                                    <TableCell className="text-center">{crossTabData.total.out['>3yr']}</TableCell>
                                    <TableCell className="text-center font-bold">{crossTabData.total.out.total}</TableCell>
                                    <TableCell className="text-center border-r max-w-xs truncate">{[...new Set(crossTabData.total.out.reasons)].join(', ')}</TableCell>
                                    <TableCell className="text-center">{crossTabData.total.closing['0-3yr']}</TableCell>
                                    <TableCell className="text-center">{crossTabData.total.closing['>3yr']}</TableCell>
                                    <TableCell className="text-center font-bold">{crossTabData.total.closing.total}</TableCell>
                                </TableRow>
                                </>
                            )}
                         </TableBody>
                     </Table>
                </div>
            </CardContent>
        </Card>
    )
}

type DetailedReportRow = Animal & {
  checkInDate?: string;
  checkOutDate?: string;
  checkOutReason?: string;
  age?: number;
};

function DetailedReport() {
    const firestore = useFirestore();
    const { user } = useUser();

    const animalsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, `users/${user.uid}/animals`);
    }, [user, firestore]);

    const movementsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, `users/${user.uid}/movements`);
    }, [user, firestore]);

    const { data: animals, isLoading: isLoadingAnimals } = useCollection<Animal>(animalsQuery);
    const { data: movements, isLoading: isLoadingMovements } = useCollection<AnimalMovement>(movementsQuery);
    
    const detailedReportData = useMemo<DetailedReportRow[]>(() => {
        if (!animals || !movements) return [];

        const movementsMap = new Map<string, { entry?: AnimalMovement; exit?: AnimalMovement }>();
        const animalsWithMovements = new Set<string>();

        movements.forEach(movement => {
            animalsWithMovements.add(movement.animalId);
            const existing = movementsMap.get(movement.animalId) || {};
            if (movement.type === 'Entry') {
                if (!existing.entry || new Date(movement.date) < new Date(existing.entry.date)) {
                    existing.entry = movement;
                }
            } else { 
                 if (!existing.exit || new Date(movement.date) > new Date(existing.exit.date)) {
                    existing.exit = movement;
                }
            }
            movementsMap.set(movement.animalId, existing);
        });

        return animals
            .filter(animal => animalsWithMovements.has(animal.id))
            .map(animal => {
                const animalMovements = movementsMap.get(animal.id);
                const age = new Date().getFullYear() - animal.yearOfBirth;
                return {
                    ...animal,
                    age,
                    checkInDate: animalMovements?.entry ? format(new Date(animalMovements.entry.date), 'dd-MM-yyyy') : undefined,
                    checkOutDate: animalMovements?.exit ? format(new Date(animalMovements.exit.date), 'dd-MM-yyyy') : undefined,
                    checkOutReason: animalMovements?.exit?.reason,
                };
        });
    }, [animals, movements]);

    const isLoading = isLoadingAnimals || isLoadingMovements;

    const exportToExcel = () => {
        const dataToExport = detailedReportData.map((row, index) => ({
            'S.N.': index + 1,
            'CHECK IN DATE': row.checkInDate,
            'TAG NO.': row.govtTagNo,
            'TAG COLOR': row.tagColor,
            'BREED': row.breed,
            'AGE': row.age,
            'MALE/FEMALE': row.gender,
            'COW COLOR': row.color,
            'IDENTIFICATION MARK': row.identificationMark,
            'HEALTH STATUS': row.healthStatus,
            'CHECK OUT DATE': row.checkOutDate,
            'CHECK OUT REASON': row.checkOutReason
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Detailed Report");
        XLSX.writeFile(workbook, "Detailed_Report.xlsx");
    };

    const exportToPdf = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text("Detailed Animal Report", 14, 15);

        const tableData = detailedReportData.map((row, index) => [
            index + 1,
            row.checkInDate || '',
            row.govtTagNo,
            row.tagColor,
            row.breed,
            row.age || '',
            row.gender,
            row.color,
            row.identificationMark || '',
            row.healthStatus,
            row.checkOutDate || '',
            row.checkOutReason || ''
        ]);

        doc.autoTable({
            startY: 20,
            head: [['S.N.', 'Check In Date', 'Tag No.', 'Tag Color', 'Breed', 'Age', 'Gender', 'Cow Color', 'Iden. Mark', 'Health Status', 'Check Out Date', 'Check Out Reason']],
            body: tableData,
            styles: { fontSize: 8, cellPadding: 1.5 },
            headStyles: { fontStyle: 'bold', fontSize: 8, fillColor: [22, 163, 74] },
        });

        doc.save('Detailed_Report.pdf');
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Detailed Report</CardTitle>
                     <div className="flex gap-2">
                        <Button variant="outline" onClick={exportToExcel} disabled={isLoading || detailedReportData.length === 0}><ExcelIcon className="mr-2 h-4 w-4" /> Excel</Button>
                        <Button variant="outline" onClick={exportToPdf} disabled={isLoading || detailedReportData.length === 0}><FileText className="mr-2 h-4 w-4" /> PDF</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                 <div className="w-full overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>S.N.</TableHead>
                                <TableHead>Check In</TableHead>
                                <TableHead>Tag No.</TableHead>
                                <TableHead>Tag Color</TableHead>
                                <TableHead>Breed</TableHead>
                                <TableHead>Age</TableHead>
                                <TableHead>Gender</TableHead>
                                <TableHead>Cow Color</TableHead>
                                <TableHead>Iden. Mark</TableHead>
                                <TableHead>Health</TableHead>
                                <TableHead>Check Out</TableHead>
                                <TableHead>Reason</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={12}><Skeleton className="h-6 w-full" /></TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && detailedReportData.map((row, index) => (
                                <TableRow key={row.id}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>{row.checkInDate}</TableCell>
                                    <TableCell className="font-medium">{row.govtTagNo}</TableCell>
                                    <TableCell>{row.tagColor}</TableCell>
                                    <TableCell>{row.breed}</TableCell>
                                    <TableCell>{row.age}</TableCell>
                                    <TableCell>{row.gender}</TableCell>
                                    <TableCell>{row.color}</TableCell>
                                    <TableCell>{row.identificationMark}</TableCell>
                                    <TableCell>{row.healthStatus}</TableCell>
                                    <TableCell>{row.checkOutDate}</TableCell>
                                    <TableCell>{row.checkOutReason}</TableCell>
                                </TableRow>
                            ))}
                             {!isLoading && detailedReportData.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={12} className="h-24 text-center">No data available.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                 </div>
            </CardContent>
        </Card>
    );
}


export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold font-headline">Reports</h1>
      </div>

      <Tabs defaultValue="animal-registry">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full md:w-auto">
            <TabsTrigger value="animal-registry">Animal Registry</TabsTrigger>
            <TabsTrigger value="movement-history">Movement History</TabsTrigger>
            <TabsTrigger value="daily-summary">Daily Summary</TabsTrigger>
            <TabsTrigger value="cross-tab">Cross-Tab Summary</TabsTrigger>
            <TabsTrigger value="detailed-report">Detailed Report</TabsTrigger>
        </TabsList>

        <TabsContent value="animal-registry" className="mt-4">
            <AnimalRegistryReport />
        </TabsContent>
        <TabsContent value="movement-history" className="mt-4">
            <MovementHistoryReport />
        </TabsContent>
        <TabsContent value="daily-summary" className="mt-4">
            <DailySummaryReport />
        </TabsContent>
         <TabsContent value="cross-tab" className="mt-4">
            <CrossTabSummaryReport />
        </TabsContent>
        <TabsContent value="detailed-report" className="mt-4">
            <DetailedReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
