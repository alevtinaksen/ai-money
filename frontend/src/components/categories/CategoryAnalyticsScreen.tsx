import { useEffect, useRef, useState } from 'react';
import { Category, CategoryAnalytics, Transaction } from '../../types';
import { fetchCategoryAnalytics } from '../../api/client';
import { Amount, TransactionRow } from '../design/Primitives';
import { SupportPage } from '../design/Support';

interface Props {
  auth: string; category: Category; initialMonth: number; currency: string; kind: 'income' | 'expense';
  onClose: () => void; onSelectTransaction: (tx: Transaction) => void;
}
export function CategoryAnalyticsScreen({ auth, category, initialMonth, currency, kind, onClose, onSelectTransaction }: Props) {
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<CategoryAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    const version = ++generation.current;
    setData(null); setLoading(true); setError(''); pending.current = true;
    void fetchCategoryAnalytics(auth, category.id, month, currency, kind).then(result => {
      if (version === generation.current) setData(result);
    }).catch(cause => { if (version === generation.current) setError((cause as Error).message); })
      .finally(() => { if (version === generation.current) { pending.current = false; setLoading(false); } });
    return () => { generation.current++; };
  }, [auth, category.id, month, currency, kind, retry]);
  const loadMore = async () => {
    if (pending.current || !data) return;
    const version = generation.current;
    pending.current = true; setLoading(true); setError('');
    try {
      const page = await fetchCategoryAnalytics(auth, category.id, month, currency, kind, data.transactions.length);
      if (version === generation.current) setData({ ...page, transactions: [...data.transactions, ...page.transactions] });
    } catch (cause) { if (version === generation.current) setError((cause as Error).message); }
    finally { if (version === generation.current) { pending.current = false; setLoading(false); } }
  };
  const period = new Date(); period.setUTCDate(1); period.setUTCMonth(period.getUTCMonth() + month);
  return <SupportPage title={category.name} onClose={onClose}>
    <div className="design-calendar">
      <button aria-label="Предыдущий месяц" disabled={month <= -120} onClick={() => setMonth(value => value - 1)}>←</button>
      <span>{period.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
      <button aria-label="Следующий месяц" disabled={month >= 120} onClick={() => setMonth(value => value + 1)}>→</button>
    </div>
    {loading && <p role="status">Загружаем статистику…</p>}
    {error && <p role="alert">{error} <button onClick={() => data ? void loadMore() : setRetry(value => value + 1)}>Повторить</button></p>}
    {data && <>
      <div className="design-category-total"><span>{category.icon}</span><h2><Amount value={data.total_amount} currency={currency} /></h2>
        <p>{kind === 'expense' ? 'Расходы' : 'Доходы'} · Операций: {data.transaction_count}</p></div>
      {data.breakdown.length > 0 && <section aria-label="Разбивка по категориям" className="design-category-breakdown">
        {data.breakdown.map(stat => <div key={stat.id}><span>{stat.icon} {stat.name}</span><Amount value={stat.total_amount} currency={currency} />
          <meter min="0" max="100" value={stat.percentage} aria-label={`${stat.name}: ${stat.percentage}%`} /></div>)}
      </section>}
      <section aria-label="Операции категории">
        <h2 className="design-form-label">Операции</h2>
        {data.transactions.map(tx => <TransactionRow key={tx.id} tx={tx} onSelect={() => onSelectTransaction(tx)} />)}
        {!data.transaction_count && <p>Нет операций в выбранном месяце</p>}
        {data.transactions.length < data.transaction_count && <button className="design-primary" disabled={loading} onClick={() => void loadMore()}>Загрузить ещё</button>}
      </section>
    </>}
  </SupportPage>;
}
