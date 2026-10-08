import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ActionBar, Amount, DateLabel, Icon, IconButton, ScreenHeader, transactionTitle } from '../design/Primitives';
import { Transaction, Account, Category, TransactionType } from '../../types';
import { resolveCategoryAndSubcategory } from '../modals/EditTransactionModal';

interface TransactionsScreenProps {
  onBack: () => void;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  onSelectTransaction: (tx: Transaction) => void;
  onOpenAddTransaction: () => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
  onUpdateTransaction?: (data: {
    id: string;
    amount: number;
    account_id: string;
    to_account_id?: string | null;
    category_id?: string | null;
    type: 'expense' | 'income' | 'transfer';
    note?: string | null;
    created_at?: string;
  }) => void;
}


export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
  onBack,
  transactions,
  accounts: _accounts,
  categories,
  onSelectTransaction,
  onOpenAddTransaction,
  onHaptic,
  onUpdateTransaction,
}) => {
  // Drag & Drop states
  const [draggingTx, setDraggingTx] = useState<Transaction | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    dateKey: string;
    targetTxId?: string | null;
    insertPos?: 'before' | 'after';
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const dragSessionRef = React.useRef<{
    tx: Transaction;
    sourceDateKey: string;
    startX: number;
    startY: number;
    startTime: number;
    isDragging: boolean;
    fromHandle: boolean;
  } | null>(null);
  const justDraggedRef = React.useRef(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<'all' | TransactionType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'month' | '7days'>('all');

  // Filter picker dropdown sheet states


  // Group and filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const resolved = resolveCategoryAndSubcategory(tx);
        const matchNote = tx.note?.toLowerCase().includes(q);
        const matchCat =
          tx.category_name?.toLowerCase().includes(q) ||
          resolved.displayTitle.toLowerCase().includes(q) ||
          (resolved.subcategory && resolved.subcategory.toLowerCase().includes(q));
        const matchAcc = tx.account_name?.toLowerCase().includes(q);
        const matchAmt = tx.amount.toString().includes(q);
        if (!matchNote && !matchCat && !matchAcc && !matchAmt) return false;
      }

      // 2. Type filter
      if (selectedType !== 'all' && tx.type !== selectedType) {
        return false;
      }

      // 3. Category filter
      if (selectedCategory !== 'all') {
        const resolved = resolveCategoryAndSubcategory(tx);
        const catTarget = selectedCategory.toLowerCase();
        if (
          tx.category_id !== selectedCategory &&
          tx.category_name?.toLowerCase() !== catTarget &&
          resolved.mainCategory.toLowerCase() !== catTarget &&
          resolved.subcategory?.toLowerCase() !== catTarget
        ) {
          return false;
        }
      }

      // 4. Period filter
      if (selectedPeriod !== 'all' && tx.created_at) {
        const txDate = new Date(tx.created_at);
        const now = new Date();
        if (selectedPeriod === 'month') {
          if (
            txDate.getMonth() !== now.getMonth() ||
            txDate.getFullYear() !== now.getFullYear()
          ) {
            return false;
          }
        } else if (selectedPeriod === '7days') {
          const diffDays = (now.getTime() - txDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 7) return false;
        }
      }

      return true;
    });
  }, [transactions, searchQuery, selectedType, selectedCategory, selectedPeriod]);

  const getDayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Group transactions by formatted date (e.g. "7 мая", "18 сент.")
  const groupedByDate = useMemo(() => {
    const map = new Map<string, { label: string; items: Transaction[]; expense: number }>();

    for (const tx of filteredTransactions) {
      const d = tx.created_at ? new Date(tx.created_at) : new Date();
      const dateKey = getDayKey(d);
      const dateLabel = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

      if (!map.has(dateKey)) {
        map.set(dateKey, { label: dateLabel, items: [], expense: 0 });
      }

      const entry = map.get(dateKey)!;
      entry.items.push(tx);
      if (tx.type === 'expense') {
        entry.expense += tx.amount;
      }
    }

    const groups: {
      dateKey: string;
      dateLabel: string;
      items: Transaction[];
      totalExpense: number;
      isPlaceholder?: boolean;
    }[] = [];

    const now = new Date();
    const todayKey = getDayKey(now);
    const todayLabel = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

    // If today has no transactions yet, add a clean drop zone target at the top!
    if (!map.has(todayKey) && selectedPeriod !== '7days') {
      groups.push({
        dateKey: todayKey,
        dateLabel: `Сегодня, ${todayLabel}`,
        items: [],
        totalExpense: 0,
        isPlaceholder: true,
      });
    }

    for (const [dateKey, val] of map.entries()) {
      let label = val.label;
      if (dateKey === todayKey) {
        label = `Сегодня, ${val.label}`;
      }
      groups.push({
        dateKey,
        dateLabel: label,
        items: val.items,
        totalExpense: val.expense,
        isPlaceholder: false,
      });
    }

    // Sort descending by actual calendar date
    groups.sort((a, b) => {
      const [yA, mA, dA] = a.dateKey.split('-').map(Number);
      const [yB, mB, dB] = b.dateKey.split('-').map(Number);
      return new Date(yB, mB - 1, dB).getTime() - new Date(yA, mA - 1, dA).getTime();
    });

    return groups;
  }, [filteredTransactions, selectedPeriod]);

  const groupedByDateRef = useRef(groupedByDate);
  groupedByDateRef.current = groupedByDate;

  // Cleanup body drag styles on unmount
  useEffect(() => {
    return () => {
      document.body.style.userSelect = '';
      document.body.style.touchAction = '';
    };
  }, []);

  const typeLabelMap: Record<string, string> = {
    all: 'Все типы',
    expense: 'Расходы',
    income: 'Доходы',
    transfer: 'Переводы',
  };

  const periodLabelMap: Record<string, string> = {
    all: 'Все время',
    month: 'Этот месяц',
    '7days': 'За 7 дней',
  };

  // Drag & Drop action
  const executeDateMove = (txId: string, targetDateKey: string, targetDateLabel: string) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return;

    const oldDate = tx.created_at ? new Date(tx.created_at) : new Date();
    const currentKey = getDayKey(oldDate);
    if (currentKey === targetDateKey) return;

    const [year, month, day] = targetDateKey.split('-').map(Number);
    const hours = isNaN(oldDate.getHours()) ? 12 : oldDate.getHours();
    const minutes = isNaN(oldDate.getMinutes()) ? 0 : oldDate.getMinutes();
    const seconds = isNaN(oldDate.getSeconds()) ? 0 : oldDate.getSeconds();
    const newDate = new Date(year, month - 1, day, hours, minutes, seconds);

    onHaptic?.('heavy');
    onUpdateTransaction?.({
      id: tx.id,
      amount: tx.amount,
      account_id: tx.account_id,
      to_account_id: tx.to_account_id,
      category_id: tx.category_id,
      type: tx.type,
      note: tx.note,
      created_at: newDate.toISOString(),
    });

    setToastMessage(`✓ Перенесено на ${targetDateLabel}`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Universal Pointer Drag (Mobile Touch, iOS Telegram WebApp, Desktop Mouse)
  const handlePointerDown = (
    e: React.PointerEvent,
    tx: Transaction,
    sourceDateKey: string,
    fromHandle = false
  ) => {
    if (!onUpdateTransaction) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!e.isPrimary) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startTime = Date.now();

    dragSessionRef.current = {
      tx,
      sourceDateKey,
      startX,
      startY,
      startTime,
      isDragging: false,
      fromHandle,
    };

    try {
      (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
    } catch (err) {}

    const handleWindowPointerMove = (ev: PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session) return;

      const dx = ev.clientX - session.startX;
      const dy = ev.clientY - session.startY;
      const threshold = session.fromHandle ? 4 : 8;

      if (!session.isDragging) {
        if (Math.hypot(dx, dy) > threshold) {
          session.isDragging = true;
          setDraggingTx(session.tx);
          onHaptic?.('medium');
          document.body.style.userSelect = 'none';
          document.body.style.touchAction = 'none';
        } else {
          return;
        }
      }

      // Active dragging: prevent mobile scroll
      ev.preventDefault();
      setDragPos({ x: ev.clientX, y: ev.clientY });

      // Edge auto-scrolling
      if (ev.clientY < 90) {
        window.scrollBy({ top: -14, behavior: 'auto' });
      } else if (ev.clientY > window.innerHeight - 90) {
        window.scrollBy({ top: 14, behavior: 'auto' });
      }

      // Drop target detection (Card-level detection for intra-day reordering + Date group fallback)
      let targetDateKey: string | null = null;
      let targetTxId: string | null = null;
      let insertPos: 'before' | 'after' = 'after';

      const elem = document.elementFromPoint(ev.clientX, ev.clientY);
      const txCard = elem?.closest('[data-tx-id]');
      if (txCard) {
        targetTxId = txCard.getAttribute('data-tx-id');
        targetDateKey = txCard.getAttribute('data-tx-date-key');
        const rect = txCard.getBoundingClientRect();
        insertPos = ev.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      } else {
        const dropZone = elem?.closest('[data-date-key]');
        if (dropZone) {
          targetDateKey = dropZone.getAttribute('data-date-key');
        } else {
          const allDropZones = document.querySelectorAll('[data-date-key]');
          for (const zone of Array.from(allDropZones)) {
            const rect = zone.getBoundingClientRect();
            if (ev.clientY >= rect.top - 15 && ev.clientY <= rect.bottom + 15) {
              targetDateKey = zone.getAttribute('data-date-key');
              break;
            }
          }
        }
      }

      if (targetDateKey) {
        const newTarget = { dateKey: targetDateKey, targetTxId, insertPos };
        setDragOverTarget((prev) => {
          if (
            !prev ||
            prev.dateKey !== newTarget.dateKey ||
            prev.targetTxId !== newTarget.targetTxId ||
            prev.insertPos !== newTarget.insertPos
          ) {
            onHaptic?.('light');
            return newTarget;
          }
          return prev;
        });
      }
    };

    const cleanupWindowListeners = () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
      document.body.style.userSelect = '';
      document.body.style.touchAction = '';
    };

    const handleWindowPointerUp = (ev: PointerEvent) => {
      cleanupWindowListeners();

      const session = dragSessionRef.current;
      if (!session) return;

      if (session.isDragging) {
        justDraggedRef.current = true;
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 350);

        let finalDateKey = dragOverTarget?.dateKey || null;
        let finalTxId = dragOverTarget?.targetTxId || null;
        let finalInsertPos = dragOverTarget?.insertPos || 'after';

        const elem = document.elementFromPoint(ev.clientX, ev.clientY);
        const txCard = elem?.closest('[data-tx-id]');
        if (txCard) {
          finalTxId = txCard.getAttribute('data-tx-id');
          finalDateKey = txCard.getAttribute('data-tx-date-key');
          const rect = txCard.getBoundingClientRect();
          finalInsertPos = ev.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
        } else {
          const dropZone = elem?.closest('[data-date-key]');
          if (dropZone) {
            finalDateKey = dropZone.getAttribute('data-date-key');
          }
        }

        if (finalDateKey) {
          if (finalDateKey !== session.sourceDateKey) {
            // Inter-day move to a different date
            const targetGroup = groupedByDateRef.current.find((g) => g.dateKey === finalDateKey);
            if (targetGroup) {
              executeDateMove(session.tx.id, targetGroup.dateKey, targetGroup.dateLabel);
            }
          } else if (finalTxId && finalTxId !== session.tx.id) {
            // Intra-day reordering within the same date!
            const group = groupedByDateRef.current.find((g) => g.dateKey === finalDateKey);
            if (group && group.items.length > 1) {
              const fromIndex = group.items.findIndex((t) => t.id === session.tx.id);
              const targetIdx = group.items.findIndex((t) => t.id === finalTxId);
              if (fromIndex !== -1 && targetIdx !== -1) {
                let toIndex = finalInsertPos === 'before' ? targetIdx : targetIdx + 1;
                if (fromIndex < toIndex) toIndex -= 1;

                if (fromIndex !== toIndex) {
                  const newItems = [...group.items];
                  const [moved] = newItems.splice(fromIndex, 1);
                  newItems.splice(toIndex, 0, moved);

                  const [yStr, mStr, dStr] = finalDateKey.split('-').map(Number);
                  onHaptic?.('medium');

                  // Re-distribute timestamps within that date so order is strictly maintained
                  newItems.forEach((item, idx) => {
                    const newDate = new Date(yStr, mStr - 1, dStr, 20, 0, 0, 0);
                    newDate.setMinutes(newDate.getMinutes() - idx * 2);
                    onUpdateTransaction?.({
                      id: item.id,
                      amount: item.amount,
                      account_id: item.account_id,
                      to_account_id: item.to_account_id,
                      category_id: item.category_id,
                      type: item.type,
                      note: item.note,
                      created_at: newDate.toISOString(),
                    });
                  });

                  setToastMessage(`✓ Порядок операций изменен`);
                  setTimeout(() => setToastMessage(null), 2500);
                }
              }
            }
          }
        }
      } else {
        // Simple tap on card body (not from handle) -> open modal
        if (!session.fromHandle && Date.now() - session.startTime < 450) {
          onHaptic?.('light');
          onSelectTransaction(session.tx);
        }
      }

      dragSessionRef.current = null;
      setDraggingTx(null);
      setDragPos(null);
      setDragOverTarget(null);
    };

    const handleWindowPointerCancel = () => {
      cleanupWindowListeners();
      dragSessionRef.current = null;
      setDraggingTx(null);
      setDragPos(null);
      setDragOverTarget(null);
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);
  };



  return <section className="design-screen" aria-label="Транзакции">
    <ScreenHeader title="Транзакции" onBack={onBack}
      action={<IconButton icon="filters" label="Поиск и фильтры" onClick={() => setIsSearchOpen(open => !open)} />} />
    {isSearchOpen && <div className="design-filter-panel">
      <label>Поиск<input placeholder="Категория, счёт, комментарий или сумма" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></label>
      <label>Период<select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value as typeof selectedPeriod)}>
        {Object.entries(periodLabelMap).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Тип<select value={selectedType} onChange={e => setSelectedType(e.target.value as typeof selectedType)}>
        {Object.entries(typeLabelMap).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Категория<select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
        <option value="all">Все категории</option>{categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
      </select></label>
      <button onClick={() => { setSearchQuery(''); setSelectedPeriod('all'); setSelectedType('all'); setSelectedCategory('all'); }}>Сбросить фильтры</button>
    </div>}
    <div className="design-history">
      {groupedByDate.map(group => <section className="design-day" key={group.dateKey} data-date-key={group.dateKey}>
        <h2 className="design-day-label"><DateLabel day={group.dateKey} /></h2>
        <div className="design-rows">
          {group.items.map(tx => {
            const resolved = transactionTitle(tx);
            return <div key={tx.id} className="design-transaction-wrapper" data-tx-id={tx.id} data-tx-date-key={group.dateKey}
              style={{ opacity: draggingTx?.id === tx.id ? .4 : 1, outline: dragOverTarget?.targetTxId === tx.id ? '2px solid #97ff64' : undefined }}>
              <button className="design-row" onPointerDown={e => handlePointerDown(e, tx, group.dateKey)}
                onClick={() => { if (!justDraggedRef.current) onSelectTransaction(tx); }}>
                <span className="design-row-emoji">{resolved.icon}</span><span className="design-row-title">{resolved.title}</span>
                <Amount value={tx.amount} currency={tx.currency} fixed sign={tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''} />
              </button>
              {onUpdateTransaction && <span className="design-drag-slot" aria-hidden="true"
                onPointerDown={e => handlePointerDown(e, tx, group.dateKey, true)}>
                <Icon name="drag" />
              </span>}
            </div>;
          })}
          {!group.items.length && <button className="design-empty" onClick={onOpenAddTransaction}>+ Добавить первую операцию за сегодня</button>}
        </div>
      </section>)}
      {!filteredTransactions.length && <p className="design-empty">{searchQuery || selectedType !== 'all' || selectedCategory !== 'all' ? 'Ничего не найдено' : 'Операций пока нет'}</p>}
    </div>
    {toastMessage && <p role="status" className="design-empty">{toastMessage}</p>}
    {draggingTx && dragPos && <div className="design-drag-preview" style={{ left: dragPos.x, top: dragPos.y }}>
      {transactionTitle(draggingTx).title}
    </div>}
    <ActionBar single><IconButton icon="add" label="Добавить операцию" onClick={onOpenAddTransaction} /></ActionBar>
  </section>;
};
