import { useCallback, useEffect, useRef, useState } from 'react';
import { Account, Category, DashboardSummary, Transaction } from '../types';
import { ApiError, fetchAccounts, fetchCategories, fetchDashboard, fetchTransactions } from '../api/client';
import { creationFailure, CreationOutcome } from './useCreationAttempt';

export function useLedger(auth: string, enabled: boolean, month: number, currency: string) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  const sessionEpoch = useRef(0);
  const writing = useRef(false);
  const report = useCallback((cause: unknown, preserveDraft = false, epoch = sessionEpoch.current) => {
    if (epoch !== sessionEpoch.current) return;
    setError(cause instanceof Error ? cause.message : 'Действие не завершено');
    if (cause instanceof ApiError && cause.status === 401) setAuthRequired(true);
    if (!preserveDraft && cause instanceof ApiError && cause.status === 401) {
      setExpired(true); setAccounts([]); setCategories([]); setSummary(null); setTransactions([]);
    }
  }, []);
  const restoreSession = useCallback(() => { sessionEpoch.current++; generation.current++; setLoading(false); setExpired(false); setAuthRequired(false); setError(''); }, []);
  const refresh = useCallback(async () => {
    const revision = ++generation.current;
    const epoch = sessionEpoch.current;
    setLoading(true); setError(''); setNotice('');
    try {
      const [acc, cat, dash, tx] = await Promise.all([
        fetchAccounts(auth, true), fetchCategories(auth), fetchDashboard(auth, month, currency), fetchTransactions(auth, 0, undefined, currency),
      ]);
      if (revision !== generation.current) return;
      setAccounts(acc); setCategories(cat); setSummary(dash); setTransactions(tx); setMore(tx.length === 50);
    } catch (cause) { if (revision === generation.current) report(cause, false, epoch); throw cause; }
    finally { if (revision === generation.current) setLoading(false); }
  }, [auth, month, currency, report]);
  useEffect(() => {
    if (enabled) { setExpired(false); void refresh().catch(() => {}); }
    return () => { generation.current++; };
  }, [enabled, refresh]);
  const refreshRef = useRef(refresh); refreshRef.current = refresh;
  const runMutation = useCallback(async (action: () => Promise<unknown>, creation = false): Promise<CreationOutcome> => {
    if (writing.current) return 'rejected';
    const epoch = sessionEpoch.current;
    writing.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await action();
      try { await refreshRef.current(); setNotice('Изменение сохранено на сервере'); } catch { setNotice('Сохранено. Обновление данных не удалось — попробуйте синхронизацию.'); }
      return 'saved';
    } catch (cause) { report(cause, creation, epoch); return creationFailure(cause); }
    finally { writing.current = false; setBusy(false); }
  }, [refresh, report]);
  const mutate = useCallback(async (action: () => Promise<unknown>) => (await runMutation(action)) === 'saved', [runMutation]);
  const mutateCreation = useCallback((action: () => Promise<unknown>) => runMutation(action, true), [runMutation]);
  const loadMore = async () => {
    if (loading || !more) return;
    const revision = generation.current;
    const epoch = sessionEpoch.current;
    setLoading(true);
    try {
      const page = await fetchTransactions(auth, transactions.length, undefined, currency);
      if (revision !== generation.current) return;
      setTransactions(prev => [...prev, ...page.filter(tx => !prev.some(old => old.id === tx.id))]);
      setMore(page.length === 50);
    } catch (cause) { if (revision === generation.current) report(cause, false, epoch); }
    finally { if (revision === generation.current) setLoading(false); }
  };
  return { accounts, categories, summary, transactions, more, loading, busy, error, expired, authRequired, notice,
    refresh, mutate, mutateCreation, loadMore, report, restoreSession };
}
