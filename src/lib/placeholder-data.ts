import type { Animal, User, FinancialRecord, MilkRecord } from './types';

export const placeholderAnimals: Animal[] = [
  {
    id: '1',
    govtTagNo: 'UID12345',
    tagColor: 'Yellow',
    breed: 'Gir',
    color: 'Brown',
    healthStatus: 'Healthy',
    imageUrl: 'https://picsum.photos/seed/cow1/400/300',
    type: 'Cow',
    gender: 'Female',
    yearOfBirth: 2018,
  },
  {
    id: '2',
    govtTagNo: 'UID67890',
    tagColor: 'Blue',
    breed: 'Murrah',
    color: 'Black',
    healthStatus: 'Under Treatment',
    imageUrl: 'https://picsum.photos/seed/cow2/400/300',
    type: 'Buffalo',
    gender: 'Female',
    yearOfBirth: 2019,
  },
  {
    id: '3',
    govtTagNo: 'UID11223',
    tagColor: 'Green',
    breed: 'Sahiwal',
    color: 'Light Brown',
    healthStatus: 'Healthy',
    imageUrl: 'https://picsum.photos/seed/cow3/400/300',
    type: 'Cow',
    gender: 'Female',
    yearOfBirth: 2021,
  },
  {
    id: '4',
    govtTagNo: 'UID44556',
    tagColor: 'Yellow',
    breed: 'Red Sindhi',
    color: 'Reddish Brown',
    healthStatus: 'Sick',
    imageUrl: 'https://picsum.photos/seed/cow4/400/300',
    type: 'Cow',
    gender: 'Female',
    yearOfBirth: 2017,
  },
    {
    id: '5',
    govtTagNo: 'UID77889',
    tagColor: 'Red',
    breed: 'Other',
    color: 'White and Black',
    healthStatus: 'Healthy',
    imageUrl: 'https://picsum.photos/seed/cow5/400/300',
    type: 'Bull',
    gender: 'Male',
    yearOfBirth: 2020,
  },
];

export const placeholderUsers: User[] = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@gaurakshak.com',
    role: 'Admin',
    status: 'Active',
    signupDate: '2023-01-01',
  },
  {
    id: '2',
    name: 'Seva Karyakarta',
    email: 'user1@example.com',
    role: 'User',
    status: 'Active',
    signupDate: '2023-02-10',
  },
  {
    id: '3',
    name: 'New Volunteer',
    email: 'user2@example.com',
    role: 'User',
    status: 'Pending',
    signupDate: '2024-05-20',
  },
    {
    id: '4',
    name: 'Inactive User',
    email: 'user3@example.com',
    role: 'User',
    status: 'Inactive',
    signupDate: '2023-03-15',
  },
];

export const financialData: FinancialRecord[] = [
    { id: '1', date: '2024-05-01', recordType: 'Receipt', category: 'Donation', amount: 5000, description: 'Donation from Shri Ram.' },
    { id: '2', date: '2024-05-03', recordType: 'Expense', category: 'Fodder', amount: 1500, description: 'Purchase of green fodder.' },
    { id: '3', date: '2024-05-05', recordType: 'Receipt', category: 'Milk Sale', amount: 750, description: 'Sale of 15L milk.' },
    { id: '4', date: '2024-05-10', recordType: 'Expense', category: 'Medical', amount: 1200, description: 'Vaccination for calves.' },
    { id: '5', date: '2024-05-15', recordType: 'Payment', category: 'Salary', amount: 8000, description: 'Monthly salary for staff.' },
];

export const milkData: MilkRecord[] = [
    { id: '1', date: '2024-05-20', animalId: '1', animalTag: 'UID12345', quantity: 7, time: 'Morning' },
    { id: '2', date: '2024-05-20', animalId: '3', animalTag: 'UID11223', quantity: 5, time: 'Morning' },
    { id: '3', date: '2024-05-20', animalId: '1', animalTag: 'UID12345', quantity: 6, time: 'Evening' },
    { id: '4', date: '2024-05-20', animalId: '3', animalTag: 'UID11223', quantity: 4.5, time: 'Evening' },
    { id: '5', date: '2024-05-21', animalId: '1', animalTag: 'UID12345', quantity: 7.2, time: 'Morning' },
];

export const monthlyChartData = [
  { month: "January", milk: 1860, expense: 800 },
  { month: "February", milk: 3050, expense: 1398 },
  { month: "March", milk: 2370, expense: 5800 },
  { month: "April", milk: 4730, expense: 2908 },
  { month: "May", milk: 4890, expense: 3800 },
];
