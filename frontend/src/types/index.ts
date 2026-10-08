export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Account {
  id: string;
  user_id: number;
  name: string;
  group_name: string;
  bank_name?: string;
  balance: number;
  currency: string;
  icon: string;
  color: string;
  is_default: boolean;
  sort_order: number;
  is_archived?: boolean;
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
  parent_id?: string | null;
}

export interface Transaction {
  revision: number;
  currency: string;
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
  currency: string;
  balances_by_currency: Record<string, number>;
  totals_by_currency: Record<string, { income: number; expense: number }>;
  income_categories?: CategoryStat[];
  total_balance: number;
  period_label: string;
  period_income: number;
  period_expense: number;
  categories: CategoryStat[];
  recent_transactions: Transaction[];
}

export interface CategoryAnalytics {
  category_id: string; period_label: string; currency: string; kind: 'expense' | 'income';
  total_amount: number; transaction_count: number; breakdown: CategoryStat[]; transactions: Transaction[];
}
