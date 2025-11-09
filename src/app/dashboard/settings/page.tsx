
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
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
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Camera, Upload, DatabaseBackup, Power } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection, useFirebase } from '@/firebase';
import { doc, collection, getDocs, query, writeBatch, documentId, where, setDoc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useEffect, useState, useRef, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { User as AppUser, Animal, AnimalMovement, FinancialRecord, MilkRecord, Account } from '@/lib/types';
import * as XLSX from 'xlsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';


export default function SettingsPage() {
  const { user, isUserLoading, isAdmin } = useUser();
  const { isMaintenanceMode } = useFirebase();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  // Backup State
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Restore State
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'full' | 'user'>('full');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isRestoreAlertOpen, setIsRestoreAlertOpen] = useState(false);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  // User Profile state
  const [displayName, setDisplayName] = useState('');
  const [address, setAddress] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [photoURL, setPhotoURL] = useState<string | null>(null);

  // Image Capture State
  const [isCaptureDialogOpen, setIsCaptureDialogOpen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [user, firestore]);
  
  const { data: userData, isLoading: isUserDocLoading } = useDoc<AppUser>(userDocRef);

  const allUsersCollection = useMemoFirebase(() => {
      if (!isAdmin || !firestore) return null;
      return collection(firestore, 'users');
  }, [isAdmin, firestore]);
  const { data: allUsers, isLoading: isLoadingAllUsers } = useCollection<AppUser>(allUsersCollection);
  

  useEffect(() => {
    if (userData) {
      setDisplayName(userData.name || user?.displayName || '');
      setAddress(userData.address || '');
      setMobileNo(userData.mobileNo || '');
      setPhotoURL(userData.photoURL || user?.photoURL || null);
    } else if (user) {
      setDisplayName(user.displayName || '');
      setPhotoURL(user.photoURL || null);
    }
  }, [userData, user]);
  

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
        setPhotoURL(dataUri);
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
        setPhotoURL(dataUri);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileSave = () => {
     if (!userDocRef) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to update your profile.' });
        return;
    }
    const profileData: any = {
        name: displayName,
        address,
        mobileNo,
    };
    if (photoURL) {
        profileData.photoURL = photoURL;
    }

    setDocumentNonBlocking(userDocRef, profileData, { merge: true });
    toast({
      title: "Success",
      description: "Profile updated successfully.",
    });
  };

  const cleanDataForExport = (data: any[], fieldsToRemove: string[]) => {
    if (!data) return [];
    return data.map(item => {
        const newItem = { ...item };
        fieldsToRemove.forEach(field => delete newItem[field]);
        return newItem;
    });
  };

  const fetchDataForUser = async (userId: string) => {
    const collections = ['animals', 'movements', 'financial_records', 'milk_records', 'accounts'];
    const user_data: { [key: string]: any[] } = {};

    for (const col of collections) {
      const colRef = collection(firestore, `users/${userId}/${col}`);
      const snapshot = await getDocs(colRef);
      user_data[col] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return user_data;
  };

  const handleBackup = async () => {
    if (!firestore || !user) {
        toast({ variant: 'destructive', title: 'Backup Failed', description: 'Could not create backup.' });
        return;
    }
    setIsBackingUp(true);

    try {
        const workbook = XLSX.utils.book_new();
        
        if (isAdmin) {
            const usersSnapshot = await getDocs(collection(firestore, 'users'));
            const allUsersToBackup = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));

            const cleanedUsers = cleanDataForExport(allUsersToBackup, ['photoURL']);
            const usersSheet = XLSX.utils.json_to_sheet(cleanedUsers);
            XLSX.utils.book_append_sheet(workbook, usersSheet, 'All User Profiles');

            for (const u of allUsersToBackup) {
                const userDataToBackup = await fetchDataForUser(u.id);
                for (const [colName, data] of Object.entries(userDataToBackup)) {
                    if(data.length > 0) {
                      const sheetName = `${u.customerId || u.id.substring(0,5)}_${colName}`.substring(0, 31);
                      let cleanedData = data;
                      if(colName === 'animals'){
                          cleanedData = cleanDataForExport(data, ['imageUrl']);
                      }
                      const sheet = XLSX.utils.json_to_sheet(cleanedData);
                      XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
                    }
                }
            }
             XLSX.writeFile(workbook, 'GauRakshak_Full_Backup.xlsx');

        } else {
            const userDataToBackup = await fetchDataForUser(user.uid);
            
            const cleanedAnimals = cleanDataForExport(userDataToBackup.animals, ['imageUrl']);

            XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(cleanedAnimals), 'Animals');
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(userDataToBackup.movements), 'Movements');
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(userDataToBackup.financial_records), 'Financial_Records');
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(userDataToBackup.milk_records), 'Milk_Records');
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(userDataToBackup.accounts), 'Accounts');

            XLSX.writeFile(workbook, `GauRakshak_MyData_Backup.xlsx`);
        }

        toast({ title: "Backup Successful", description: "Your data has been exported to an Excel file." });

    } catch (error) {
        console.error("Backup error:", error);
        toast({ variant: 'destructive', title: 'Backup Failed', description: 'An error occurred while creating the backup.' });
    } finally {
        setIsBackingUp(false);
    }
  };
  
    const handleRestoreFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };
    
    const triggerRestore = () => {
        if (!selectedFile) {
            toast({ variant: 'destructive', title: 'No File Selected', description: 'Please select a backup file to restore.' });
            return;
        }
        if (restoreMode === 'user' && !selectedUserId) {
            toast({ variant: 'destructive', title: 'No User Selected', description: 'Please select a user to restore data for.' });
            return;
        }
        setIsRestoreAlertOpen(true);
    };

    const handleConfirmRestore = async () => {
        if (!firestore || !selectedFile || !isAdmin) return;
    
        setIsRestoring(true);
        setIsRestoreAlertOpen(false);
    
        const statusDocRef = doc(firestore, 'system', 'status');
        await setDoc(statusDocRef, { isMaintenanceMode: true });
    
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const batch = writeBatch(firestore);
    
                if (restoreMode === 'full') {
                    // Full Restore Logic: Iterate through all sheets
                    for (const sheetName of workbook.SheetNames) {
                        const worksheet = workbook.Sheets[sheetName];
                        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
    
                        if (sheetName === 'All User Profiles') {
                            for (const record of jsonData) {
                                const docRef = doc(firestore, 'users', record.id);
                                batch.set(docRef, record);
                            }
                        } else {
                            const [userIdentifier, ...collectionParts] = sheetName.split('_');
                            const collectionName = collectionParts.join('_');
                            
                            // Find the user by customerId or a substring of their UID
                            const user = allUsers?.find(u => u.customerId === userIdentifier || u.id.substring(0, 5) === userIdentifier);
    
                            if (user) {
                                for (const record of jsonData) {
                                    if (record.id) { // Ensure record has an ID
                                      const docRef = doc(firestore, `users/${user.id}/${collectionName}`, String(record.id));
                                      batch.set(docRef, record);
                                    }
                                }
                            }
                        }
                    }
                    toast({ title: 'Full Restore Successful', description: 'All data has been restored from the backup.' });
                } else if (restoreMode === 'user' && selectedUserId) {
                    // User-wise Restore Logic
                    const selectedUser = allUsers?.find(u => u.id === selectedUserId);
                    if (!selectedUser) {
                        throw new Error('Selected user not found.');
                    }
                    const userIdentifier = selectedUser.customerId || selectedUser.id.substring(0, 5);
    
                    // Iterate through sheets and only process those belonging to the selected user
                    for (const sheetName of workbook.SheetNames) {
                        if (sheetName.startsWith(userIdentifier)) {
                            const [, ...collectionParts] = sheetName.split('_');
                            const collectionName = collectionParts.join('_');
                            const worksheet = workbook.Sheets[sheetName];
                            const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
    
                            for (const record of jsonData) {
                               if (record.id) { // Ensure record has an ID
                                  const docRef = doc(firestore, `users/${selectedUserId}/${collectionName}`, String(record.id));
                                  batch.set(docRef, record);
                               }
                            }
                        }
                    }
                    toast({ title: 'User Restore Successful', description: `Data for ${selectedUser.name} has been restored.` });
                }
    
                await batch.commit();
    
            } catch (error) {
                console.error("Restore error:", error);
                toast({ variant: 'destructive', title: 'Restore Failed', description: String(error) || 'An error occurred during the restore process.' });
            } finally {
                await setDoc(statusDocRef, { isMaintenanceMode: false });
                setIsRestoring(false);
                setSelectedFile(null);
                setSelectedUserId(null);
                if (restoreFileInputRef.current) {
                    restoreFileInputRef.current.value = '';
                }
            }
        };
        reader.readAsArrayBuffer(selectedFile);
    };

    const handleMaintenanceModeToggle = async (checked: boolean) => {
        if (!firestore) return;
        const statusDocRef = doc(firestore, 'system', 'status');
        try {
            await setDoc(statusDocRef, { isMaintenanceMode: checked }, { merge: true });
            toast({
                title: 'Success',
                description: `Maintenance mode has been ${checked ? 'enabled' : 'disabled'}.`
            });
        } catch (error) {
            console.error("Error toggling maintenance mode:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not update maintenance mode status.'
            });
        }
    };


  const isLoading = isUserLoading || isUserDocLoading;

  return (
    <>
    <div className="space-y-6">
        <h1 className="text-3xl font-bold font-headline">Settings</h1>

        <Card>
            <CardHeader>
                <CardTitle>User Profile</CardTitle>
                <CardDescription>This is your account information. Click save to update.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="grid md:grid-cols-[1fr_3fr] gap-6">
                    <div className="flex flex-col items-center gap-4">
                        <Avatar className="h-32 w-32">
                           <AvatarImage src={photoURL || `https://i.pravatar.cc/150?u=${user?.email}`} />
                           <AvatarFallback>{displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
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
                    </div>
                    <div className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="user-name">Your Name</Label>
                                {isLoading ? <Skeleton className="h-10 w-full" /> : <Input id="user-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="user-email">Your Email</Label>
                                {isLoading ? <Skeleton className="h-10 w-full" /> : <Input id="user-email" value={user?.email || ''} readOnly disabled />}
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="user-mobile">Mobile No.</Label>
                                {isLoading ? <Skeleton className="h-10 w-full" /> : <Input id="user-mobile" value={mobileNo} onChange={(e) => setMobileNo(e.target.value)} />}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="customer-id">Customer ID</Label>
                                {isLoading ? <Skeleton className="h-10 w-full" /> : <Input id="customer-id" value={userData?.customerId || ''} readOnly disabled />}
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="address">Address</Label>
                            {isLoading ? <Skeleton className="h-20 w-full" /> : <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} />}
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="user-role">Role</Label>
                    {isLoading ? <Skeleton className="h-10 w-full" /> : <Input id="user-role" value={userData?.role || ''} readOnly disabled />}
                </div>

                <Button onClick={handleProfileSave} disabled={isLoading}>Save Changes</Button>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Data Backup</CardTitle>
                <CardDescription>
                    {isAdmin ? 'Download a complete backup of all data in the system.' : 'Securely back up all your personal application data.'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">
                                {isAdmin ? 'Create a Full System Backup' : 'Create a New Backup'}
                            </p>
                            <p className="text-sm text-muted-foreground">This will generate an Excel file with all relevant data.</p>
                        </div>
                        <Button variant="outline" onClick={handleBackup} disabled={isBackingUp || isLoading}>
                            <Download className="mr-2 h-4 w-4" />
                            {isBackingUp ? 'Backing up...' : (isAdmin ? 'Download Full Backup' : 'Download My Data')}
                        </Button>
                    </div>
                     {isBackingUp && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                            <Spinner className="h-4 w-4" />
                            <span>Backup in progress. This may take a few moments...</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>

        {isAdmin && (
             <Card>
                <CardHeader>
                    <CardTitle>Data Restore</CardTitle>
                    <CardDescription>
                        Restore data from an Excel backup file. This is a highly destructive operation.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="rounded-lg border border-destructive/50 p-4 bg-destructive/10">
                        <AlertTitle className="text-destructive font-semibold">Warning: Destructive Action</AlertTitle>
                        <AlertDescription className="text-destructive/90">
                           Restoring data will permanently overwrite existing data. This action cannot be undone. 
                           Enable maintenance mode before proceeding.
                        </AlertDescription>
                    </div>

                    <div className="space-y-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <Label htmlFor="maintenance-mode" className="font-semibold">Enable Maintenance Mode</Label>
                                <p className="text-sm text-muted-foreground">
                                    Put the app offline for all users before starting the restore.
                                </p>
                            </div>
                            <Switch
                                id="maintenance-mode"
                                checked={isMaintenanceMode}
                                onCheckedChange={handleMaintenanceModeToggle}
                                disabled={isRestoring}
                            />
                        </div>
                     </div>

                    <div className={cn("space-y-4 rounded-lg border p-4", !isMaintenanceMode && "opacity-50 pointer-events-none")}>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Restore Mode</Label>
                                 <Select value={restoreMode} onValueChange={(v: 'full' | 'user') => setRestoreMode(v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select restore mode" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="full">Full Data Restore</SelectItem>
                                        <SelectItem value="user">User-wise Restore</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             {restoreMode === 'user' && (
                                <div className="space-y-2">
                                    <Label>Select User</Label>
                                    <Select onValueChange={setSelectedUserId} value={selectedUserId || undefined} disabled={isLoadingAllUsers}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a user to restore..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {isLoadingAllUsers && <SelectItem value="loading" disabled>Loading users...</SelectItem>}
                                            {allUsers?.map(u => (
                                                <SelectItem key={u.id} value={u.id}>{u.name} ({u.customerId || u.email})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                         </div>

                        <div className="space-y-2">
                            <Label htmlFor="restore-file">Backup File (.xlsx)</Label>
                            <Input id="restore-file" type="file" accept=".xlsx" ref={restoreFileInputRef} onChange={handleRestoreFileSelect} />
                        </div>
                         <div>
                            <Button onClick={triggerRestore} disabled={isRestoring || !selectedFile || (restoreMode === 'user' && !selectedUserId)}>
                                <DatabaseBackup className="mr-2 h-4 w-4" />
                                {isRestoring ? 'Restoring...' : 'Restore Data'}
                            </Button>
                             {isRestoring && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                                    <Spinner className="h-4 w-4" />
                                    <span>Restore in progress. Please do not navigate away. This may take several minutes...</span>
                                </div>
                            )}
                        </div>
                    </div>

                </CardContent>
            </Card>
        )}
    </div>

     <Dialog open={isCaptureDialogOpen} onOpenChange={setIsCaptureDialogOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Capture Profile Photo</DialogTitle>
          <DialogDescription>
            Position yourself in the frame and click "Capture" to take a photo.
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
    
     <AlertDialog open={isRestoreAlertOpen} onOpenChange={setIsRestoreAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently overwrite the database with data from the backup file. 
                    {restoreMode === 'user' && selectedUserId && `Only data for the user "${allUsers?.find(u => u.id === selectedUserId)?.name}" will be affected.`}
                    This action is irreversible.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsRestoring(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmRestore} className={cn(buttonVariants({ variant: "destructive" }))}>
                    {isRestoring ? 'Restoring...' : 'Yes, Restore Data'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

    