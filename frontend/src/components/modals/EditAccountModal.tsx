import { CreationOutcome, useCreationAttempt } from '../../hooks/useCreationAttempt';
import { useVisibleViewport } from '../../hooks/useVisibleViewport';
import { InlineField } from '../design/InlineField';
import { moneyInput, currencyLabel } from '../../utils/money';
import React, { useState, useEffect } from 'react';
import { ConfirmPanel } from '../design/Support';
import { ActionBar, Icon, IconButton, ScreenHeader } from '../design/Primitives';
import { Account } from '../../types';
import { BANK_OPTIONS, resolveAccountBankAndName } from '../../utils/bankUtils';

interface EditAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onSave: (updated: Partial<Account> & { id?: string; client_id?: string }) => Promise<CreationOutcome | boolean>;
  onBlockedChange?: (blocked: boolean) => void;
  onDelete?: (id: string) => Promise<boolean>;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

const EMOJI_CATEGORIES = [
  {
    title: 'Деньги & Финансы',
    emojis: ['💳', '💵', '🪙', '💰', '🏦', '💎', '📈', '📊', '🧾', '💼', '🏧', '🏷️'],
  },
  {
    title: 'Жизнь & Еда',
    emojis: ['🍎', '🍔', '🍕', '☕', '🛒', '🛍️', '🎁', '🏖️', '✈️', '🏠', '🔑', '💡'],
  },
  {
    title: 'Авто & Техника',
    emojis: ['🚗', '🚘', '⛽', '🔧', '🏎️', '📱', '💻', '⌚', '🎧', '🎮', '🚲', '🛴'],
  },
  {
    title: 'Личное & Семья',
    emojis: ['❤️', '💛', '💙', '💜', '👥', '👤', '🐱', '🐾', '🧘', '✨', '🎓', '👶'],
  },
];

export const EditAccountModal: React.FC<EditAccountModalProps> = ({
  isOpen,
  onClose,
  account,
  onSave,
  onBlockedChange,
  onDelete,
  onHaptic,
}) => {
  const viewport = useVisibleViewport();
  const [currency, setCurrency] = useState('RUB');
  const [name, setName] = useState('');
  const [bankName, setBankName] = useState<string>('');
  const [balanceStr, setBalanceStr] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [formError, setFormError] = useState('');
  const [groupName, setGroupName] = useState('Личное');
  const [icon, setIcon] = useState('💳');
  const [customEmojiInput, setCustomEmojiInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const attempt = useCreationAttempt<Partial<Account>>(onSave, onBlockedChange, 'Счёт мог быть создан. Повторите сохранение этого черновика: начальный остаток будет учтён только один раз.');
  const locked = saving || attempt.locked;
  const close = () => { if (!saving && !attempt.blocked()) onClose(); };

  useEffect(() => {
    setShowEmojiPicker(false); setShowDeleteConfirm(false); setShowOptions(false); setFormError('');
    setCurrency(account?.currency || 'RUB');
    if (account) {
      const resolved = resolveAccountBankAndName(account);
      setName(account.name);
      setBankName(account.bank_name || resolved.bank?.name || '');
      setBalanceStr(account.balance.toString());
      setGroupName(account.group_name || 'Личное');
      setIcon(account.icon || '💳');
      setCustomEmojiInput(account.icon || '');
    } else {
      setName('');
      setBankName('');
      setBalanceStr('');
      setGroupName('Личное');
      setIcon('💳');
      setCustomEmojiInput('💳');
    }
  }, [account, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (saving) return;
    if (!account && attempt.blocked()) { if (await attempt.retry() === 'saved') onClose(); return; }
    onHaptic?.('heavy');
    let bal: number;
    try { bal = Number(moneyInput(balanceStr || '0', true)); }
    catch (cause) { setFormError((cause as Error).message); return; }
    setFormError('');
    const payload = {
      id: account?.id,
      name: name.trim() || 'Новый счёт',
      bank_name: bankName.trim() || undefined,
      balance: bal,
      currency,
      group_name: groupName,
      icon,
    };
    if (!account) {
      if (await attempt.run(payload) === 'saved') onClose();
      return;
    }
    setSaving(true);
    try {
      const saved = await onSave(payload);
      if (saved === true || saved === 'saved') onClose();
      else setFormError('Не удалось сохранить. Проверьте сообщение сервера и повторите.');
    } catch { setFormError('Не удалось сохранить. Проверьте соединение и повторите.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (account && onDelete && !saving) {
      onHaptic?.('heavy'); setSaving(true);
      try { if (await onDelete(account.id)) onClose(); else setFormError('Не удалось архивировать счёт. Повторите позже.'); }
      catch { setFormError('Не удалось архивировать счёт. Повторите позже.'); }
      finally { setSaving(false); }
    }
  };

  return <section className="design-support design-support-page design-account-editor" aria-label="Изменить счёт" style={viewport ? { height: viewport.height, top: viewport.top, bottom: 'auto' } : undefined}>
    <ScreenHeader title={account ? 'Изменить счет' : 'Новый счёт'} onBack={close} backDisabled={locked} action={<IconButton icon="settings" label="Дополнительные настройки счёта" disabled={locked} onClick={() => setShowOptions(value => !value)} />} />
    <button type="button" className="design-account-emoji" disabled={locked} aria-label="Выбрать значок счёта" onClick={() => setShowEmojiPicker(open => !open)}>{icon}</button>
    <fieldset disabled={locked} className="design-account-editor-fields" style={{ border: 0, margin: 0, minWidth: 0, paddingInline: 0, display: 'block', background: 'var(--design-bg)' }}>
    {showEmojiPicker && <div className="design-paper design-emoji-picker">
      <label>Свой значок<input aria-label="Свой значок счёта" maxLength={20} value={customEmojiInput} onChange={e => setCustomEmojiInput(e.target.value)} /></label>
      <button className="design-primary" onClick={() => { if(customEmojiInput.trim()) { setIcon(customEmojiInput.trim()); setShowEmojiPicker(false); } }}>Применить</button>
      {EMOJI_CATEGORIES.map(group => <section key={group.title}><h2>{group.title}</h2><div className="design-option-grid">{group.emojis.map(emoji => <button key={emoji} aria-label={`Значок ${emoji}`} aria-pressed={icon === emoji}
        onClick={() => {setIcon(emoji);setShowEmojiPicker(false);}}>{emoji}</button>)}</div></section>)}
    </div>}
    <label className="design-account-inline">{account ? 'Баланс' : 'Начальный баланс'}<span>
      <input aria-label="Начальный баланс" placeholder="0.00" inputMode="decimal" disabled={Boolean(account)} value={balanceStr} onChange={e => setBalanceStr(e.target.value)} />
      <span className="design-currency">{currencyLabel(currency)}</span></span></label>
    <InlineField label="Название счёта" aria-label="Название счёта" maxLength={100} placeholder="Например: Основная карта, Копилка..." value={name} onChange={e => setName(e.target.value)} />
    <div className="design-account-choice"><h2 className="design-form-label">Банк</h2><div className="design-option-grid">{BANK_OPTIONS.map(bank => {
      const selected=bankName.toLowerCase().includes(bank.shortName.toLowerCase());return <button key={bank.id} aria-pressed={selected} onClick={() => setBankName(selected ? '' : bank.name)}>{bank.shortName}</button>;
    })}<button aria-pressed={!BANK_OPTIONS.some(bank => bankName.toLowerCase().includes(bank.shortName.toLowerCase()))}
      onClick={() => { if (BANK_OPTIONS.some(bank => bankName.toLowerCase().includes(bank.shortName.toLowerCase()))) setBankName(''); setShowOptions(true); }}>Другое</button></div></div>
    <div className="design-account-choice"><h2 className="design-form-label">Группа счёта</h2><div className="design-option-grid">{['Личное','Общее','Кредиты'].map(group => <button key={group} aria-pressed={groupName === group} onClick={() => setGroupName(group)}>{group}</button>)}</div></div>
    {showOptions && <div className="design-account-options">
      <label>Название банка<input aria-label="Название банка" value={bankName} maxLength={50} onChange={e => setBankName(e.target.value)} placeholder="Без банка" /></label>
      <label>Название группы<input aria-label="Название группы" value={groupName} maxLength={50} onChange={e => setGroupName(e.target.value)} /></label>
      {account ? <p>Баланс меняется через операции. Валюта счёта: {currency}.</p> : <label>Валюта<select aria-label="Валюта нового счёта" value={currency} onChange={e => setCurrency(e.target.value)}><option>RUB</option><option>USD</option><option>EUR</option></select></label>}
    </div>}
    </fieldset>
    {(formError || attempt.error) && <p role="alert" className="design-error">{attempt.error || formError}</p>}
    <ActionBar>
    {account && onDelete && <IconButton icon="trash" label="Архивировать" disabled={locked} onClick={() => setShowDeleteConfirm(true)} />}
    <button className="design-primary design-form-save" aria-label="Сохранить" disabled={saving || attempt.phase === 'pending'} onClick={() => void handleSave()}><Icon name="check" /></button>
    </ActionBar>
    {showDeleteConfirm && <ConfirmPanel title="Архивировать счёт?" description="Все связанные операции останутся в истории." action="Архивировать" busy={saving} error={formError} onCancel={() => { if (!saving) setShowDeleteConfirm(false); }} onConfirm={() => void handleDelete()} />}
  </section>;
};
