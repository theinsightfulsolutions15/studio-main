
'use client';

import { useAuth, useCollection, useMemoFirebase, useDoc, useFirestore } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import type { Animal, MilkRecord, FinancialRecord } from '@/lib/types';

export default function Dashboard() {
  const { user, isUserLoading: isAuthLoading } = useAuth();
  const firestore = useFirestore(); // Correctly get firestore instance from hook

  const userDocRef = useMemoFirebase(() => (user && firestore ? doc(firestore, `users/${user.uid}`) : null), [user, firestore]);
  const { data: userData } = useDoc(userDocRef);

  // 🧠 Animals Query - always for the current user
  const animalsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, `users/${user.uid}/animals`);
  }, [firestore, user]);

  // 🧠 Milk Records Query - always for the current user
  const milkRecordsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, `users/${user.uid}/milk_records`);
  }, [firestore, user]);

  // 🧠 Financial Records Query - always for the current user
  const financialRecordsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, `users/${user.uid}/financial_records`);
  }, [firestore, user]);

  // ✅ useCollection को केवल तब चलाओ जब query valid हो
  const { data: animals, isLoading: isLoadingAnimals } = useCollection<Animal>(animalsQuery);
  const { data: milkRecords, isLoading: isLoadingMilk } = useCollection<MilkRecord>(milkRecordsQuery);
  const { data: financialRecords, isLoading: isLoadingFinancial } = useCollection<FinancialRecord>(financialRecordsQuery);


  // 🌀 Loading state
  if (
    isAuthLoading ||
    !user ||
    isLoadingAnimals ||
    isLoadingMilk ||
    isLoadingFinancial
  ) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  // 📊 Dashboard Summary
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Animals</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{animals?.length ?? 0} total animals</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Milk Records</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{milkRecords?.length ?? 0} total milk records</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financial Records</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{financialRecords?.length ?? 0} total financial records</p>
        </CardContent>
      </Card>
    </div>
  );
}
