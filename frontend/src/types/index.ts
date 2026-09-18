export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Account {
  id: string;
  user_id: number;
  name: string;
  group_name: string;
  balance: number;
  currency: string;
  icon: string;
  color: string;
  is_default: boolean;
  sort_order: number;
}

export interface Category {
  id: string;
  user_id?: number;
  name: string;
  type: 'expense' | 'income' | 'both';
  icon: string;
  color: string;
  budget_limit?: number | null;
  sort_order?: number;
  subcategories?: string[];
}

export interface Transaction {
  id: string;
  user_id: number;
  account_id: string;
  to_account_id?: string | null;
  category_id?: string | null;
  amount: number;
  type: TransactionType;
  note?: string | null;
  created_at: string;
  account_name?: string;
  category_name?: string;
  category_icon?: string;
}

export interface CategoryStat {
  id: string;
  name: string;
  icon: string;
  color: string;
  total_amount: number;
  percentage: number;
}

export interface DashboardSummary {
  total_balance: number;
  period_label: string;
  period_income: number;
  period_expense: number;
  categories: CategoryStat[];
  recent_transactions: Transaction[];
}
