let token = '';
export const authorization = (initData: string) => initData ? `tma ${initData}` : token ? `Bearer ${token}` : '';
export function clearSession(expectedAuthorization?: string) {
  if (expectedAuthorization !== undefined && expectedAuthorization !== authorization('')) return;
  token = '';
}
export async function localLogin() {
  const base = import.meta.env.VITE_API_URL || '';
  const response = await fetch(`${base}/api/auth/local`, { method: 'POST' });
  if (!response.ok) throw new Error('Локальный вход запрещён или сервер недоступен');
  const data = await response.json();
  if (typeof data?.access_token !== 'string' || !data.access_token.trim()) throw new Error('Сервер не подтвердил локальный вход');
  token = data.access_token;
}
// Old offline edits are retained for optional recovery, never read into an authenticated ledger.
const LEGACY_KEYS = ['ai_money_sync_data', 'ai_money_accounts', 'ai_money_categories',
  'ai_money_categories_v2', 'ai_money_last_ingested_sync_key', 'ai_money_user_tx_mods', 'ai_money_user_account_mods'];
export function clearLegacyCache() { LEGACY_KEYS.forEach(key => localStorage.removeItem(key)); }
export function exportLegacyCache() {
  const data = Object.fromEntries(LEGACY_KEYS.map(key => [key, localStorage.getItem(key)]));
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'ai-money-local-recovery.json'; link.click();
  URL.revokeObjectURL(url);
}
