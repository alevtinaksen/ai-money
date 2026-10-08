import { CSSProperties, ReactNode } from 'react';
import { Account, Category, TransactionType } from '../../types';
import { currencyLabel } from '../../utils/money';
import { resolveAccountBankAndName } from '../../utils/bankUtils';
import { Amount, Icon, IconButton } from './Primitives';

export function AccountField({ account, label, onClick }: { account?: Account | null; label: string; onClick: () => void }) {
  const resolved = account ? resolveAccountBankAndName(account) : null;
  return <button type="button" className="design-account-field" aria-label={label} onClick={onClick}>
    <span className="design-row-emoji">{account?.icon || '💳'}</span>
    <span className="design-row-title">{resolved ? `${resolved.bank ? resolved.bank.shortName + ' • ' : ''}${resolved.cleanName}` : 'Выберите счёт'}</span>
    {account && <Amount value={account.balance} currency={account.currency} />}
    <span className="design-field-caret"><Icon name="caret" /></span>
  </button>;
}
export function CategoryChoices({ categories, selected, onSelect }: { categories: Category[]; selected?: string; onSelect: (category: Category) => void }) {
  return <div className="design-choice-list">{categories.map(category => <button type="button" key={category.id}
    aria-pressed={selected === category.id} onClick={() => onSelect(category)}>{category.icon} {category.name}</button>)}
    {!categories.length && <p className="design-empty">Нет категорий для этого типа операции</p>}</div>;
}
export interface TransactionEditorProps {
  onClose: () => void; onDelete?: () => void; type: TransactionType; onType: (type: TransactionType) => void;
  dateValue: string; dateLabel: string; onDate: (value: string) => void;
  source?: Account | null; destination?: Account | null; onSource: () => void; onDestination: () => void; onSwap: () => void;
  amount: string; onAmount?: (value: string) => void; onAmountBlur?: () => void; onAmountKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  amountHint?: ReactNode; category?: Category; onCategory: () => void; choices?: ReactNode;
  note: string; onNote: (note: string) => void; onSave: () => void; saving: boolean; locked?: boolean; error?: string;
  keypad?: ReactNode; children?: ReactNode;
}
export function TransactionEditor(p: TransactionEditorProps) {
  const editable = Boolean(p.onAmount);
  return <section className={`design-editor ${p.keypad ? 'design-editor-keypad' : ''}`} aria-label={p.onDelete ? 'Редактирование операции' : 'Новая операция'}>
    <header className="design-editor-header">
      <IconButton icon="close" label="Закрыть" onClick={p.onClose} />
      <label className="design-editor-date"><span>{p.dateLabel}</span><input disabled={p.locked} aria-label="Дата операции" type="date" value={p.dateValue} onChange={e => e.target.value && p.onDate(e.target.value)} /></label>
      <div className="design-editor-actions"><IconButton icon={p.type === 'transfer' ? 'operation' : 'exchange'} label={p.type === 'transfer' ? 'Перейти к расходу' : 'Перевод'}
        onClick={() => p.onType(p.type === 'transfer' ? 'expense' : 'transfer')} disabled={p.locked} className="design-editor-mode" />
        {p.onDelete && <IconButton icon="trash" label="Удалить операцию" onClick={p.onDelete} />}</div>
    </header>
    {p.error && <p role="alert" className="design-editor-error">{p.error}</p>}
    <fieldset disabled={p.locked} className="design-editor-content" style={{ border: 0, marginLeft: 0, marginRight: 0, marginBottom: 0, padding: 0, minWidth: 0 }}>
      <AccountField account={p.source} label="Счёт списания" onClick={p.onSource} />
      {p.type === 'transfer' && <><button type="button" className="design-editor-swap" aria-label="Поменять счета местами" onClick={p.onSwap}><Icon name="exchange" /></button>
        <AccountField account={p.destination} label="Счёт зачисления" onClick={p.onDestination} /></>}
      <div className="design-editor-amount">
        <div className="design-editor-amount-line" style={{ "--amount-characters": p.amount.length + 2 } as CSSProperties}>{editable ? <input aria-label="Сумма" inputMode="decimal" value={p.amount} onChange={e => p.onAmount?.(e.target.value)}
          onBlur={p.onAmountBlur} onKeyDown={p.onAmountKeyDown} style={{ width: `${Math.max(1, p.amount.length) * .61}em` }} /> : <span aria-label="Сумма">{p.amount || '0'}</span>}
          <span className="design-currency">{currencyLabel(p.source?.currency || 'RUB')}</span></div>{p.amountHint}
      </div>
      {p.type !== 'transfer' && <><div className="design-editor-types">
        <button type="button" title="Расход" aria-label="Расход" aria-pressed={p.type === 'expense'} onClick={() => p.onType('expense')}>−</button>
        <button type="button" title="Доход" aria-label="Доход" aria-pressed={p.type === 'income'} onClick={() => p.onType('income')}>+</button>
      </div><button type="button" className="design-account-field" aria-label="Выбрать категорию" onClick={p.onCategory}>
        <span className="design-row-emoji">{p.category?.icon || '📦'}</span><span className="design-row-title">{p.category?.name || 'Без категории'}</span>
        <span className="design-field-caret"><Icon name="caret" /></span></button>{p.choices}</>}
    </fieldset>
    <div className="design-editor-bottom"><div className="design-editor-save-row"><input disabled={p.locked} aria-label="Комментарий" placeholder="Комментарий" value={p.note} onChange={e => p.onNote(e.target.value)} />
      <IconButton icon="check" label="Сохранить" onClick={p.onSave} disabled={p.saving} className="design-editor-save" />
    </div>{p.saving && <p role="status" className="design-empty">Сохраняем…</p>}{p.keypad}</div>
    {p.children}
  </section>;
}
