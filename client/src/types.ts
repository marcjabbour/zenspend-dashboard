
export type TransactionType = 'expense' | 'income' | 'cc_payment';
export type BudgetPeriod = 'weekly' | 'monthly';
export type RecurrenceAction = 'one' | 'future' | 'all';

export interface Category {
  id: string;
  name: string;
  weeklyBudget: number;
  period: BudgetPeriod;
  color: string;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  categoryId: string;
  description: string;
  type: TransactionType;
  isFixed?: boolean;
  groupId?: string; // Links recurring instances
}

export interface UserSettings {
  monthlyIncome: number;
  currency: string;
  showFixedCosts: boolean;
  checkingBalance: number;
  creditCardBalance: number;
  balanceAsOf: string;
}
