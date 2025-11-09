
'use client';

import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/logo";
import { useAuth, useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { initiateEmailSignIn } from '@/firebase/non-blocking-login';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(true); // Start as true

  useEffect(() => {
    // If there is no user and we are done loading, stop verifying.
    if (!user && !isUserLoading) {
        setIsVerifying(false);
    }
    
    if (user && !isUserLoading && firestore && auth) {
      const userDocRef = doc(firestore, 'users', user.uid);
      getDoc(userDocRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            if (userData.status === 'Active' && (userData.role === 'Admin' || userData.role === 'User')) {
              router.push('/dashboard');
            } else {
              let description = 'Your account requires admin approval.';
              if (userData.status === 'Inactive' || userData.status === 'Expired') {
                description = 'Your account is inactive or expired. Please contact an administrator.';
              }
              toast({
                variant: 'destructive',
                title: 'Login Failed',
                description: description,
              });
              signOut(auth);
              setIsVerifying(false);
            }
          } else {
            // This case should ideally not happen if signup is the only way to create an auth user
            toast({
              variant: 'destructive',
              title: 'Login Failed',
              description: 'No user record found. Please sign up.',
            });
            signOut(auth);
            setIsVerifying(false);
          }
        })
        .catch((serverError) => {
            const contextualError = new FirestorePermissionError({
              path: userDocRef.path,
              operation: 'get',
            });
            errorEmitter.emit('permission-error', contextualError);
            setIsVerifying(false);
        });
    }
  }, [user, isUserLoading, auth, firestore, router, toast]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
        toast({
            variant: "destructive",
            title: "Login Error",
            description: "Authentication service is not available.",
        });
        return;
    }
    setIsVerifying(true); // Show loading state immediately
    initiateEmailSignIn(auth, email, password, () => {
        setIsVerifying(false); // On error, stop verifying
    });
  };

  if (isVerifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Logo />
          <p className="text-muted-foreground mt-2">Loading, please wait...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm mx-auto">
        <CardHeader className="text-center">
          <div className="mb-4 inline-block">
             <Logo />
          </div>
          <CardTitle className="text-2xl font-headline">Welcome Back</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="ml-auto inline-block text-sm underline">
                    Forgot your password?
                  </Link>
                </div>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={isVerifying}>
                {isVerifying ? 'Verifying...' : 'Login'}
              </Button>
            </div>
          </form>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
