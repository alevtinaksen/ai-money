import { ReactNode } from 'react';
import { currencyLabel } from '../../utils/money';
import { Transaction } from '../../types';
import { resolveCategoryAndSubcategory, formatTransactionSubtitleNote } from '../modals/EditTransactionModal';

export type DesignIcon = 'camera' | 'microphone' | 'plus' | 'wallet' | 'settings' | 'exchange' | 'back' | 'drag' | 'add' | 'filters' | 'close' | 'trash' | 'check' | 'caret' | 'operation' | 'search' | 'refresh' | 'edit' | 'card' | 'document' | 'right';
export function Icon({ name }: { name: DesignIcon }) {
  return <img src={`/design/${name}.svg`} alt="" className={`design-icon design-icon-${name}`} />;
}
export function IconButton({ icon, label, onClick, children, className = '', disabled = false }: {
  icon: DesignIcon; label: string; onClick?: () => void; children?: ReactNode; className?: string; disabled?: boolean;
}) {
  return <button type="button" className={`design-icon-button ${className}`} aria-label={label} onClick={onClick} disabled={disabled}>
    <Icon name={icon} />{children}
  </button>;
}
export function Amount({ value, currency, fixed = false, sign = '' }: {
  value: number; currency: string; fixed?: boolean; sign?: string;
}) {
  return <span className="design-amount"><span>{sign}{fixed ? value.toFixed(2) : String(Number(value.toFixed(2)))}</span>
    <span className="design-currency">{currencyLabel(currency)}</span></span>;
}
export function ScreenHeader({ title, onBack, action, backDisabled = false }: { title: string; onBack: () => void; action: ReactNode; backDisabled?: boolean }) {
  return <header className="design-header"><div className="design-header-leading">
    <IconButton icon="back" label="Назад" onClick={onBack} disabled={backDisabled} /><h1>{title}</h1>
  </div>{action}</header>;
}
export function ActionBar({ children, single = false }: { children: ReactNode; single?: boolean }) {
  return <nav className={`design-action-bar ${single ? 'design-action-single' : ''}`} aria-label="Действия">{children}</nav>;
}
export function DateLabel({ day }: { day: string }) {
  const localKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const now = new Date(), today = localKey(now);
  const previous = new Date(now); previous.setDate(previous.getDate() - 1);
  const yesterday = localKey(previous);
  return <span>{new Date(day+'T12:00:00Z').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' })}
    {day === today ? <span className="design-muted"> [Сегодня]</span> : day === yesterday ? <span className="design-muted"> [Вчера]</span> : null}</span>;
}
export function transactionTitle(tx: Transaction) {
  const resolved = resolveCategoryAndSubcategory(tx);
  const note = formatTransactionSubtitleNote(tx.note, resolved);
  return { icon: resolved.icon, title: resolved.displayTitle + (note ? ` • ${note}` : '') };
}
export function TransactionRow({ tx, onSelect, drag = false }: { tx: Transaction; onSelect: () => void; drag?: boolean }) {
  const { icon, title } = transactionTitle(tx);
  return <button type="button" className="design-row" onClick={onSelect}>
    <span className="design-row-emoji">{icon}</span><span className="design-row-title">{title}</span>
    <Amount value={tx.amount} currency={tx.currency} sign={tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''} fixed={drag} />
    {drag && <Icon name="drag" />}
  </button>;
}
