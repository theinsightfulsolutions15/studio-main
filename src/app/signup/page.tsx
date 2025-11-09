
'use client';

import Link from "next/link";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/logo";
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'Firebase not initialized.'})
        return;
    }
    setIsLoading(true);
    try {
      // 1. Create the Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const isAdmin = email.toLowerCase() === 'theinsightfulsolutions@gmail.com';
      
      const batch = writeBatch(firestore);

      // 2. Create user document
      const userRef = doc(firestore, 'users', user.uid);
      const userData = {
        id: user.uid,
        name: fullName,
        email: email,
        role: isAdmin ? 'Admin' : 'User',
        status: isAdmin ? 'Active' : 'Pending',
        signupDate: new Date().toISOString().split('T')[0],
        address: '',
        mobileNo: '',
        customerId: isAdmin ? 'G-001' : '', 
        validityDate: isAdmin ? '2099-12-31' : '',
      };
      batch.set(userRef, userData);

      // 3. Create admin role if applicable
      if (isAdmin) {
        const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
        batch.set(adminRoleRef, { uid: user.uid, role: "Admin" });
      }
      
      await batch.commit();
      
      // 4. Show appropriate toast message and redirect
      if (isAdmin) {
        toast({
          title: "Admin Account Created",
          description: "Your admin account has been successfully created with Customer ID G-001.",
        });
      } else {
        toast({
          title: "Account Created",
          description: "Your account has been created and is now pending admin approval.",
        });
      }

      router.push('/');

    } catch (error: any) {
      console.error("Error signing up:", error);
      let description = "An unexpected error occurred. Please try again.";
      if (error.code === 'auth/email-already-in-use') {
        description = 'This email address is already in use by another account.';
      } else if (error.code === 'permission-denied') {
        description = "You don't have permission to create an account. Please contact an administrator.";
      } else {
        description = error.message;
      }
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: description,
      });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm mx-auto">
        <CardHeader className="text-center">
            <div className="mb-4 inline-block">
                <Logo />
            </div>
          <CardTitle className="text-2xl font-headline">Create an Account</CardTitle>
          <CardDescription>Enter your details to register. Your account will be active after admin approval.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="full-name">Full Name</Label>
                <Input id="full-name" placeholder="Ram Kumar" required value={fullName} onChange={e => setFullName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="ram@example.com" required value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </div>
          </form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/" className="underline">
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
