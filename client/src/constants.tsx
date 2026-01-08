
import { Category } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'groceries', name: 'Groceries', weeklyBudget: 800, period: 'weekly', color: '#10b981' }, // Emerald
  { id: 'outings', name: 'Outings', weeklyBudget: 1000, period: 'weekly', color: '#3b82f6' },  // Blue
  { id: 'misc', name: 'Misc', weeklyBudget: 200, period: 'weekly', color: '#6366f1' },       // Indigo
];

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
