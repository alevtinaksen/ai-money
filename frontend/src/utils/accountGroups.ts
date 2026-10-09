import { Account } from '../types';
import { resolveAccountBankAndName } from './bankUtils';

export function groupAccountsByBank(accounts: Account[]) {
  const banks = new Map<string, { label: string; groups: Map<string, Account[]> }>();
  for (const account of accounts) {
    const explicit = account.bank_name?.trim();
    const bank = resolveAccountBankAndName({ name: explicit ? '' : account.name, bank_name: explicit }).bank;
    const label = bank?.name || explicit || (/налич/i.test(account.name) ? 'Наличные' : 'Другие счета');
    const key = bank?.id || label.toLocaleLowerCase('ru');
    const entry = banks.get(key) || { label, groups: new Map<string, Account[]>() };
    const purpose = account.group_name || 'Личное';
    entry.groups.set(purpose, [...(entry.groups.get(purpose) || []), account]);
    banks.set(key, entry);
  }
  return [...banks].map(([key, bank]) => ({ key, label: bank.label,
    groups: [...bank.groups].map(([name, items]) => ({ name, items })) }));
}
