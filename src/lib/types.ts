
import type { LucideIcon } from "lucide-react";

export type Animal = {
  id: string;
  ownerId?: string;
  type: string;
  govtTagNo: string;
  breed: string;
  color: string;
  gender: 'Male' | 'Female';
  yearOfBirth: number;
  healthStatus: 'Healthy' | 'Sick' | 'Under Treatment';
  tagColor: string;
  identificationMark?: string;
  imageUrl?: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'User';
  status: 'Pending' | 'Active' | 'Inactive' | 'Expired';
  signupDate: string;
  customerId?: string;
  photoURL?: string;
  validityDate?: string;
  address?: string;
  mobileNo?: string;
};

export type FinancialRecord = {
  id: string;
  date: string;
  recordType: 'Receipt' | 'Payment' | 'Expense' | 'Milk Record' | 'Bank Record' | 'Milk Sale';
  category?: string;
  amount: number;
  description: string;
  ownerId?: string;
  transactionType?: 'RTGS' | 'NEFT' | 'UPI' | 'Cash' | 'Other';
  // for milk sales
  customerName?: string;
  quantity?: number;
  rate?: number;
  accountId?: string;
  invoiceNo?: string;
};

export type MilkRecord = {
  id: string;
  date: string;
  animalId: string;
  animalTag: string;
  quantity: number; // in liters
  time: 'Morning' | 'Evening';
  ownerId?: string;
};

export type NavItem = {
  href: string;
  title: string;
  icon: LucideIcon;
  label?: string;
};

export type AnimalMovement = {
  id: string;
  animalId: string;
  type: 'Entry' | 'Exit';
  date: string; // ISO 8601 format
  reason: string;
  ownerId?: string;
};

export type AmcRenewal = {
    id: string;
    userId: string;
    userName: string;
    customerId?: string;
    date: string;
    amount: number;
    transactionType: 'RTGS' | 'NEFT' | 'UPI' | 'Cash' | 'Other';
    status: 'Pending' | 'Approved';
    submittedAt: any; // Firestore Timestamp
};

export type AmcDetail = {
    id: string;
    userId: string;
    startDate: string;
    endDate: string;
    description: string;
};

export type Account = {
    id: string;
    name: string;
    type: 'Customer' | 'Bank' | 'Expense';
    ownerId?: string;
};

export type SystemStatus = {
    isMaintenanceMode: boolean;
};
