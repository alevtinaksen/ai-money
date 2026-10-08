import { Account, Category, DashboardSummary, Transaction } from '../types';
import { authorization, clearSession } from './session';

const API_BASE = import.meta.env.VITE_API_URL || '';
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function request<T>(path: string, initData = '', options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const headers = new Headers(options.headers);
    const auth = authorization(initData);
    if (auth) headers.set('Authorization', auth);
    if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${API_BASE}/api${path}`, { ...options, headers, signal: controller.signal });
    if (!response.ok) {
      if (response.status === 401) clearSession(auth);
      const body = await response.json().catch(() => ({}));
      throw new ApiError(response.status, typeof body?.detail === 'string' ? body.detail : 'Запрос не выполнен');
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, 'Нет ответа сервера. Запись могла сохраниться; повторите неизменённый черновик или обновите историю.');
  } finally { clearTimeout(timeout); }
}
export const fetchAccounts = (auth: string, archived = false) => request<Account[]>(`/accounts?include_archived=${archived}`, auth);
export const fetchCategories = (auth: string) => request<Category[]>('/categories', auth);
export const fetchDashboard = (auth: string, monthOffset = 0, currency = 'RUB') =>
  request<DashboardSummary>(`/analytics/dashboard?month_offset=${monthOffset}&currency=${currency}`, auth);
export const fetchTransactions = (auth: string, offset = 0, month?: number, currency?: string) => {
  const params = new URLSearchParams({ offset: String(offset), limit: '50' });
  if (month !== undefined) params.set('month_offset', String(month));
  if (currency) params.set('currency', currency);
  return request<Transaction[]>(`/transactions?${params}`, auth);
};
export type TransactionInput = Pick<Transaction, 'account_id' | 'type'> & {
  amount: string; client_id?: string; category_id?: string | null; to_account_id?: string | null;
  note?: string | null; created_at?: string;
};
export const createTransactionAPI = async (auth: string, data: TransactionInput): Promise<Transaction> => {
  const response = await request<unknown>('/transactions', auth, { method: 'POST', body: JSON.stringify(data) });
  const tx = response as Partial<Transaction> | null;
  // A 200 with unrelated/incomplete JSON cannot acknowledge the submitted financial write.
  if (!tx || typeof tx !== 'object' || typeof tx.id !== 'string' || !tx.id.trim() ||
    !Number.isInteger(tx.revision) || (tx.revision ?? 0) < 1 || typeof tx.amount !== 'number' ||
    !Number.isFinite(tx.amount) || tx.amount <= 0 || tx.amount !== Number(data.amount) ||
    typeof tx.account_id !== 'string' || !tx.account_id || tx.account_id !== data.account_id ||
    !['expense', 'income', 'transfer'].includes(tx.type ?? '') || tx.type !== data.type) {
    throw new ApiError(0, 'Сервер не подтвердил данные операции. Запись могла сохраниться; повторите неизменённый черновик.');
  }
  return tx as Transaction;
};
export const updateTransactionAPI = (auth: string, id: string, data: Omit<TransactionInput, 'client_id'> & { revision: number }) =>
  request<Transaction>(`/transactions/${id}`, auth, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTransactionAPI = (auth: string, id: string, revision: number) =>
  request(`/transactions/${id}?revision=${revision}`, auth, { method: 'DELETE' });
export type AccountInput = Pick<Account, 'name' | 'group_name' | 'icon'> & {
  bank_name?: string | null; color?: string; currency?: string; balance?: string;
};
export const createAccountAPI = (auth: string, data: AccountInput) =>
  request<Account>('/accounts', auth, { method: 'POST', body: JSON.stringify(data) });
export const updateAccountAPI = (auth: string, id: string, data: Omit<AccountInput, 'balance' | 'currency'>) =>
  request<Account>(`/accounts/${id}`, auth, { method: 'PUT', body: JSON.stringify(data) });
export const deleteAccountAPI = (auth: string, id: string) => request(`/accounts/${id}`, auth, { method: 'DELETE' });
export type CategoryInput = Pick<Category, 'name' | 'type' | 'icon' | 'color'> & {
  parent_id?: string | null; budget_limit?: string | null; sort_order?: number;
};
export const saveCategoryAPI = (auth: string, data: CategoryInput, id?: string) =>
  request<Category>(id ? `/categories/${id}` : '/categories', auth,
    { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) });
export const deleteCategoryAPI = (auth: string, id: string) => request(`/categories/${id}`, auth, { method: 'DELETE' });
export interface Proposal { amount: string | number; type: Transaction['type']; note?: string;
  account_name?: string; to_account_name?: string; category_name?: string; }
export interface ParsedResult { transactions: Proposal[]; clarification?: string; }
export const parseTextAPI = (auth: string, text: string) => request<ParsedResult>('/ai/parse-text', auth,
  { method: 'POST', body: JSON.stringify({ text }) });
export const parseMediaAPI = (auth: string, file: File, kind: 'voice' | 'receipt') => {
  const body = new FormData(); body.append('file', file);
  return request<ParsedResult>(`/ai/parse-${kind}`, auth, { method: 'POST', body });
};
