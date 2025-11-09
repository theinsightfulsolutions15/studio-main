
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
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
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoreHorizontal, PlusCircle, Search, FileDown, FileUp, Camera, Upload } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, doc as firestoreDoc, addDoc } from 'firebase/firestore';
import type { Animal, AnimalMovement } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { cn } from '@/lib/utils';


function AnimalRowSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell>
        <Skeleton className="h-8 w-8 rounded-md" />
      </TableCell>
    </TableRow>
  );
}

const initialAnimalState: Omit<Animal, 'id' | 'ownerId'> = {
    type: 'Cow',
    govtTagNo: '',
    breed: '',
    color: '',
    gender: 'Female',
    yearOfBirth: new Date().getFullYear(),
    healthStatus: 'Healthy',
    tagColor: '',
    identificationMark: '',
    imageUrl: '',
};

type ExitDialogState = {
    isOpen: boolean;
    animal: Animal | null;
    reason: string;
};

const initialExitDialogState: ExitDialogState = {
    isOpen: false,
    animal: null,
    reason: '',
}

export default function AnimalsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Omit<Animal, 'id' | 'ownerId'>>(initialAnimalState);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'view'>('create');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [exitDialogState, setExitDialogState] = useState<ExitDialogState>(initialExitDialogState);

  const [searchTerm, setSearchTerm] = useState('');
  const [filteredAnimals, setFilteredAnimals] = useState<Animal[] | null>(null);

  // Image Capture State
  const [isCaptureDialogOpen, setIsCaptureDialogOpen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    if (isCaptureDialogOpen) {
      const getCameraPermission = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          setHasCameraPermission(true);

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings.',
          });
        }
      };
      getCameraPermission();
    } else {
        // Stop camera stream when dialog closes
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    }
  }, [isCaptureDialogOpen, toast]);


  const handleCaptureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUri);
        setFormData({ ...formData, imageUrl: dataUri });
        setIsCaptureDialogOpen(false);
      }
    }
  };
  
   const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUri = e.target?.result as string;
        setCapturedImage(dataUri);
        setFormData({ ...formData, imageUrl: dataUri });
      };
      reader.readAsDataURL(file);
    }
  };


  const animalsCollection = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, `users/${user.uid}/animals`));
  }, [user, firestore]);
  
  const { data: animals, isLoading } = useCollection<Animal>(animalsCollection);

  useEffect(() => {
    if (animals) {
      if (!searchTerm) {
        setFilteredAnimals(animals);
      } else {
        const lowercasedFilter = searchTerm.toLowerCase();
        const filteredData = animals.filter(animal =>
          Object.values(animal).some(value =>
            String(value).toLowerCase().includes(lowercasedFilter)
          )
        );
        setFilteredAnimals(filteredData);
      }
    } else {
      setFilteredAnimals(null);
    }
  }, [searchTerm, animals]);


  const handleExport = () => {
    if (!animals) {
        toast({
            variant: "destructive",
            title: "Export Failed",
            description: "No animal data to export.",
        });
        return;
    }
    const dataToExport = animals.map(animal => ({
        'TYPE': animal.type,
        'TAG NO': animal.govtTagNo,
        'BREED': animal.breed,
        'COLOR': animal.color,
        'GENDER': animal.gender,
        'YEAR OF BIRTH': animal.yearOfBirth,
        'HEALTH STATUS': animal.healthStatus,
        'TAG COLOR': animal.tagColor,
        'IDENTIFICATION MARK': animal.identificationMark || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Animals");
    XLSX.writeFile(workbook, "Gaushala_Animals.xlsx");
     toast({
        title: "Export Successful",
        description: "Animal data has been exported to Gaushala_Animals.xlsx.",
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && firestore && user) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet);

                if (json.length === 0) {
                  toast({ variant: 'destructive', title: "Import Failed", description: "The Excel file is empty." });
                  return;
                }

                const existingTagNos = new Set(animals?.map(a => a.govtTagNo));
                const importTagNos = new Set<string>();
                let duplicateFoundInFile = false;
                let duplicateFoundInDB = false;
                let duplicateTagNo = '';

                for (const row of json) {
                    const tagNo = String(row['TAG NO']);
                    if (importTagNos.has(tagNo)) {
                        duplicateFoundInFile = true;
                        duplicateTagNo = tagNo;
                        break;
                    }
                    if (existingTagNos.has(tagNo)) {
                        duplicateFoundInDB = true;
                        duplicateTagNo = tagNo;
                        break;
                    }
                    importTagNos.add(tagNo);
                }

                if (duplicateFoundInFile) {
                    toast({ variant: "destructive", title: "Import Failed", description: `Duplicate Tag No "${duplicateTagNo}" found in the import file.` });
                    return;
                }
                if (duplicateFoundInDB) {
                    toast({ variant: "destructive", title: "Import Failed", description: `Tag No "${duplicateTagNo}" already exists in the database.` });
                    return;
                }

                const animalsColRef = collection(firestore, `users/${user.uid}/animals`);

                for (const row of json) {
                    const animalData: Omit<Animal, 'id'> = {
                        type: row['TYPE'],
                        govtTagNo: String(row['TAG NO']),
                        breed: row['BREED'],
                        color: row['COLOR'],
                        gender: row['GENDER'],
                        yearOfBirth: Number(row['YEAR OF BIRTH']),
                        healthStatus: row['HEALTH STATUS'],
                        tagColor: row['TAG COLOR'],
                        identificationMark: row['IDENTIFICATION MARK'] || '',
                        ownerId: user.uid,
                    };
                    await addDoc(animalsColRef, animalData);
                }

                toast({
                    title: "Import Successful",
                    description: `${json.length} animal records have been imported.`,
                });

            } catch (error) {
                console.error("Import error:", error);
                toast({
                    variant: "destructive",
                    title: "Import Failed",
                    description: "Could not import the file. Please check the file format and try again.",
                });
            }
        };
        reader.readAsBinaryString(file);
    }
    if(event.target) {
        event.target.value = '';
    }
  };

  const handleFormSubmit = async () => {
    if (!firestore || !user) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
      return;
    }
    if (!formData.govtTagNo || !formData.breed) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Tag No and Breed are required.' });
      return;
    }

    setIsSubmitting(true);
    const animalsColRef = collection(firestore, `users/${user.uid}/animals`);

    if (dialogMode === 'create') {
      if (animals?.some(animal => animal.govtTagNo === formData.govtTagNo)) {
        toast({ variant: 'destructive', title: 'Registration Failed', description: `An animal with Tag No "${formData.govtTagNo}" already exists.` });
        setIsSubmitting(false);
        return;
      }
      try {
        await addDocumentNonBlocking(animalsColRef, { ...formData, ownerId: user.uid });
        toast({ title: 'Success', description: 'New animal has been registered.' });
      } catch (error) {
        console.error("Error registering animal:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to register animal.' });
      }
    } else if (dialogMode === 'edit' && selectedAnimal) {
       if (animals?.some(animal => animal.govtTagNo === formData.govtTagNo && animal.id !== selectedAnimal.id)) {
        toast({ variant: 'destructive', title: 'Update Failed', description: `An animal with Tag No "${formData.govtTagNo}" already exists.` });
        setIsSubmitting(false);
        return;
      }
      try {
        const animalDocRef = firestoreDoc(firestore, `users/${user.uid}/animals`, selectedAnimal.id);
        await updateDocumentNonBlocking(animalDocRef, formData);
        toast({ title: 'Success', description: 'Animal details have been updated.' });
      } catch (error) {
        console.error("Error updating animal:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update animal details.' });
      }
    }
    
    setIsSubmitting(false);
    setIsFormOpen(false);
  };
  
   const openDialog = (mode: 'create' | 'edit' | 'view', animal: Animal | null = null) => {
    setDialogMode(mode);
    if (animal) {
        setSelectedAnimal(animal);
        setFormData(animal);
        setCapturedImage(animal.imageUrl || null);
    } else {
        setSelectedAnimal(null);
        setFormData(initialAnimalState);
        setCapturedImage(null);
    }
    setIsFormOpen(true);
  };
  
  const openDeleteDialog = (animal: Animal) => {
    setSelectedAnimal(animal);
    setIsDeleteAlertOpen(true);
  };
  
  const handleConfirmDelete = async () => {
      if (!firestore || !user || !selectedAnimal) return;
      
      const animalDocRef = firestoreDoc(firestore, `users/${user.uid}/animals`, selectedAnimal.id);
      try {
        await deleteDocumentNonBlocking(animalDocRef);
        toast({ title: 'Success', description: `Animal ${selectedAnimal.govtTagNo} has been deleted.`});
      } catch (error) {
        console.error("Error deleting animal:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete animal. Check if it has related records.' });
      } finally {
        setIsDeleteAlertOpen(false);
        setSelectedAnimal(null);
      }
  };
  
  const openExitDialog = (animal: Animal) => {
      setExitDialogState({ isOpen: true, animal, reason: ''});
  };
  
  const handleConfirmExit = async () => {
      const { animal, reason } = exitDialogState;
      if (!firestore || !user || !animal || !reason) {
          toast({ variant: 'destructive', title: 'Error', description: 'A reason for exit is required.' });
          return;
      }
      
      setIsSubmitting(true);
      const movementData: Omit<AnimalMovement, 'id' | 'ownerId'> = {
          animalId: animal.id,
          type: 'Exit',
          date: new Date().toISOString(),
          reason: reason,
      };

      const movementsColRef = collection(firestore, `users/${user.uid}/movements`);
      try {
        await addDocumentNonBlocking(movementsColRef, { ...movementData, ownerId: user.uid });
        toast({ title: 'Success', description: `Animal ${animal.govtTagNo} has been marked as exited.`});
      } catch (error) {
        console.error("Error marking animal as exited:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to record animal exit.'});
      } finally {
        setIsSubmitting(false);
        setExitDialogState(initialExitDialogState);
      }
  };
  
  const dialogTitles = {
    create: 'Register a New Animal',
    edit: 'Edit Animal Details',
    view: 'View Animal Details',
  };
  
  const dialogDescriptions = {
      create: 'Fill in the details below to add a new animal to the Gaushala records.',
      edit: 'Update the details for this animal.',
      view: 'Viewing the details for this animal.'
  };


  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
                <CardTitle>Animals</CardTitle>
                <CardDescription>Manage and track all animals in the Gaushala.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:flex-initial">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search animals..." 
                        className="pl-8 w-full min-w-[150px] md:w-[250px] lg:w-[300px]" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                 <Button variant="outline" onClick={handleImportClick}>
                    <FileUp className="mr-2 h-4 w-4" />
                    Import
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".xlsx, .xls"
                />
                <Button variant="outline" onClick={handleExport}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Export
                </Button>
                <Button className="w-auto" onClick={() => openDialog('create')}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Register Animal
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Image</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Tag No</TableHead>
              <TableHead>Breed</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Year of Birth</TableHead>
              <TableHead>Health Status</TableHead>
              <TableHead>Tag Color</TableHead>
              <TableHead>Identification Mark</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(isLoading || !user) && Array.from({ length: 5 }).map((_, i) => <AnimalRowSkeleton key={i} />)}
            {filteredAnimals?.map((animal) => (
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
                <TableCell>{animal.type}</TableCell>
                <TableCell className="font-medium">{animal.govtTagNo}</TableCell>
                <TableCell>{animal.breed}</TableCell>
                <TableCell>{animal.color}</TableCell>
                <TableCell>{animal.gender}</TableCell>
                <TableCell>{animal.yearOfBirth}</TableCell>
                <TableCell>
                  <Badge variant={animal.healthStatus === 'Healthy' ? 'secondary' : animal.healthStatus === 'Sick' ? 'destructive' : 'default'} className="bg-opacity-80">
                    {animal.healthStatus}
                  </Badge>
                </TableCell>
                <TableCell>{animal.tagColor}</TableCell>
                <TableCell>{animal.identificationMark}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => openDialog('view', animal)}>View Details</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openDialog('edit', animal)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openExitDialog(animal)}>Mark as Exited</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => openDeleteDialog(animal)} className="text-destructive">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
             {filteredAnimals && filteredAnimals.length === 0 && !isLoading && (
                <TableRow>
                    <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                        No animals found{searchTerm && ` for "${searchTerm}"`}.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
       <CardFooter>
        <div className="text-xs text-muted-foreground">
          Showing <strong>{filteredAnimals?.length ?? 0}</strong> of <strong>{animals?.length ?? 0}</strong> animals
        </div>
      </CardFooter>
    </Card>

    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
                <DialogTitle>{dialogTitles[dialogMode]}</DialogTitle>
                <DialogDescription>
                    {dialogDescriptions[dialogMode]}
                </DialogDescription>
            </DialogHeader>
            <div className="grid md:grid-cols-3 gap-6 py-4">
                <div className="md:col-span-1 flex flex-col items-center gap-4">
                    <div className="w-full aspect-square rounded-md bg-muted flex items-center justify-center overflow-hidden">
                            {capturedImage ? (
                            <Image src={capturedImage} alt="Animal" width={400} height={400} className="object-cover h-full w-full" />
                        ) : (
                            <Camera className="h-16 w-16 text-muted-foreground" />
                        )}
                    </div>
                    {dialogMode !== 'view' && (
                        <div className="w-full grid grid-cols-2 gap-2">
                            <Button variant="outline" onClick={() => setIsCaptureDialogOpen(true)}>
                                <Camera className="mr-2 h-4 w-4" />
                                Capture
                            </Button>
                            <Button variant="outline" onClick={() => uploadInputRef.current?.click()}>
                                <Upload className="mr-2 h-4 w-4" />
                                Upload
                            </Button>
                            <input
                                type="file"
                                ref={uploadInputRef}
                                onChange={handleImageUpload}
                                className="hidden"
                                accept="image/*"
                            />
                        </div>
                    )}
                </div>
                <div className="md:col-span-2 grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="type">Type</Label>
                            <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value })} disabled={dialogMode === 'view'}>
                                <SelectTrigger id="type">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Cow">Cow</SelectItem>
                                    <SelectItem value="Buffalo">Buffalo</SelectItem>
                                    <SelectItem value="Bull">Bull</SelectItem>
                                    <SelectItem value="Calf">Calf</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="govtTagNo">Govt. Tag No.</Label>
                            <Input id="govtTagNo" value={formData.govtTagNo} onChange={(e) => setFormData({ ...formData, govtTagNo: e.target.value })} placeholder="UID12345" disabled={dialogMode === 'view'} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="breed">Breed</Label>
                            <Input id="breed" value={formData.breed} onChange={(e) => setFormData({ ...formData, breed: e.target.value })} placeholder="e.g., Gir, Murrah" disabled={dialogMode === 'view'} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="color">Color</Label>
                            <Input id="color" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} placeholder="e.g., Brown, Black" disabled={dialogMode === 'view'} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="gender">Gender</Label>
                            <Select value={formData.gender} onValueChange={(value: 'Male' | 'Female') => setFormData({ ...formData, gender: value })} disabled={dialogMode === 'view'}>
                                <SelectTrigger id="gender">
                                    <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Female">Female</SelectItem>
                                    <SelectItem value="Male">Male</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="yearOfBirth">Year of Birth</Label>
                            <Input id="yearOfBirth" type="number" value={formData.yearOfBirth} onChange={(e) => setFormData({ ...formData, yearOfBirth: parseInt(e.target.value) })} placeholder="e.g., 2020" disabled={dialogMode === 'view'} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="healthStatus">Health Status</Label>
                            <Select value={formData.healthStatus} onValueChange={(value: 'Healthy' | 'Sick' | 'Under Treatment') => setFormData({ ...formData, healthStatus: value })} disabled={dialogMode === 'view'}>
                                <SelectTrigger id="healthStatus">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Healthy">Healthy</SelectItem>
                                    <SelectItem value="Sick">Sick</SelectItem>
                                    <SelectItem value="Under Treatment">Under Treatment</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tagColor">Tag Color</Label>
                            <Input id="tagColor" value={formData.tagColor} onChange={(e) => setFormData({ ...formData, tagColor: e.target.value })} placeholder="e.g., Yellow, Blue" disabled={dialogMode === 'view'} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="identificationMark">Identification Mark</Label>
                        <Input id="identificationMark" value={formData.identificationMark} onChange={(e) => setFormData({ ...formData, identificationMark: e.target.value })} placeholder="Any unique marks" disabled={dialogMode === 'view'} />
                    </div>
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary">Cancel</Button>
                </DialogClose>
                {dialogMode !== 'view' && (
                    <Button type="submit" onClick={handleFormSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : (dialogMode === 'create' ? 'Register Animal' : 'Save Changes')}
                    </Button>
                )}
            </DialogFooter>
        </DialogContent>
    </Dialog>
    
    <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the animal record for <strong>{selectedAnimal?.govtTagNo}</strong>.
                    All related data (movements, milk records) will NOT be deleted but will be orphaned.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete} className={cn(buttonVariants({ variant: "destructive" }))}>
                    Delete Permanently
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    
    <Dialog open={exitDialogState.isOpen} onOpenChange={(isOpen) => setExitDialogState(p => ({...p, isOpen}))}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Mark Animal as Exited</DialogTitle>
                <DialogDescription>
                    Create an exit record for animal <strong>{exitDialogState.animal?.govtTagNo}</strong>.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="exitReason">Reason for Exit</Label>
                    <Input 
                        id="exitReason" 
                        value={exitDialogState.reason}
                        onChange={(e) => setExitDialogState(p => ({...p, reason: e.target.value}))}
                        placeholder="e.g., Adopted, Deceased, Transferred"
                    />
                </div>
            </div>
             <DialogFooter>
                <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
                <Button onClick={handleConfirmExit} disabled={isSubmitting || !exitDialogState.reason}>
                    {isSubmitting ? 'Saving...' : 'Confirm Exit'}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>


    <Dialog open={isCaptureDialogOpen} onOpenChange={setIsCaptureDialogOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Capture Animal Photo</DialogTitle>
          <DialogDescription>
            Position the animal in the frame and click "Capture" to take a photo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-full aspect-video bg-black rounded-md overflow-hidden flex items-center justify-center">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
          </div>
          {hasCameraPermission === false && (
            <Alert variant="destructive">
              <Camera className="h-4 w-4" />
              <AlertTitle>Camera Access Required</AlertTitle>
              <AlertDescription>
                Please allow camera access in your browser to use this feature.
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setIsCaptureDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCaptureImage} disabled={!hasCameraPermission}>
            <Camera className="mr-2 h-4 w-4" />
            Capture Photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
