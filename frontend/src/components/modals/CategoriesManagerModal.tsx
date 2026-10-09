import { CreationOutcome, useCreationAttempt } from '../../hooks/useCreationAttempt';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Category } from '../../types';
import { ConfirmPanel } from '../design/Support';
import { ScreenHeader, Icon } from '../design/Primitives';
import { InlineField } from '../design/InlineField';
import { categorySelection } from '../../utils/categorySelection';
import { useVisibleViewport } from '../../hooks/useVisibleViewport';
import { Dialog } from '../shared/Dialog';

interface Props {
  isOpen: boolean; onClose: () => void; categories: Category[];
  onSaveCategory: (category: Partial<Category> & { id?: string; client_id?: string }) => Promise<CreationOutcome | boolean>;
  onDeleteCategory: (id: string) => Promise<boolean>;
  onBlockedChange?: (blocked: boolean) => void; serverError?: string; sessionRecovery?: ReactNode;
  onReorderCategories?: (categories: Category[]) => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}
export function CategoriesManagerModal({ isOpen, onClose, categories, onSaveCategory, onDeleteCategory, onBlockedChange, serverError, sessionRecovery }: Props) {
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [archiving, setArchiving] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const section = useRef<HTMLElement>(null);
  const viewport = useVisibleViewport();
  const attempt = useCreationAttempt<Partial<Category>>(onSaveCategory, onBlockedChange,
    'Категория могла быть создана. Повторите сохранение этого черновика: копия не появится.');
  const locked = busy || attempt.locked;
  useEffect(() => {
    if (!pendingFocus.current || editing || archiving || menuId) return;
    (triggers.current.get(pendingFocus.current) || section.current?.querySelector<HTMLButtonElement>('button[aria-label="Назад"]'))?.focus();
    pendingFocus.current = null;
  }, [editing, archiving, menuId]);
  if (!isOpen) return null;
  const edit = (category: Partial<Category>) => { setEditing(category); setMenuId(null); setError(''); };
  const back = () => { if (busy || attempt.blocked()) return; if (menuId) { pendingFocus.current = menuId; setMenuId(null); }
    else if (editing) { pendingFocus.current = editing.id || 'new'; setEditing(null); setError(''); } else onClose(); };
  const save = async () => {
    if (busy) return;
    if (!editing?.id && attempt.blocked()) {
      if (await attempt.retry() === 'saved') { pendingFocus.current = 'new'; setEditing(null); }
      return;
    }
    if (!editing?.name?.trim()) { setError('Укажите название категории'); return; }
    setError('');
    if (!editing.id) {
      const outcome = await attempt.run(editing);
      if (outcome === 'saved') { pendingFocus.current = 'new'; setEditing(null); }
      else if (outcome === 'rejected') setError('Не удалось сохранить категорию. Проверьте данные и повторите.');
      return;
    }
    setBusy(true);
    try {
      const outcome = await onSaveCategory(editing);
      if (outcome === true || outcome === 'saved') { pendingFocus.current = editing.id; setEditing(null); }
      else setError('Не удалось сохранить категорию. Проверьте данные и повторите.');
    } catch { setError('Не удалось сохранить категорию. Проверьте соединение и повторите.'); }
    finally { setBusy(false); }
  };
  const archive = async () => {
    if (!archiving || busy) return;
    setBusy(true); setError('');
    try {
      if (await onDeleteCategory(archiving.id)) { pendingFocus.current = archiving.id; setArchiving(null); }
      else setError('Не удалось архивировать категорию. Проверьте подкатегории и повторите.');
    } catch { setError('Не удалось архивировать категорию. Проверьте соединение и повторите.'); }
    finally { setBusy(false); }
  };
  const rows = (items: Category[], visited = new Set<string>()): React.ReactNode => items.filter(cat => !visited.has(cat.id)).map(cat => {
    const children = categories.filter(child => child.parent_id === cat.id);
    const open = expanded.includes(cat.id);
    return <div key={cat.id} className="design-category-node">
      <div className="design-category-row">
        <button type="button" className="design-category-title" aria-expanded={children.length ? open : undefined}
          onClick={() => children.length ? setExpanded(ids => open ? ids.filter(id => id !== cat.id) : [...ids, cat.id]) : edit(cat)}>
          <span>{cat.icon} {cat.name}</span>{children.length > 0 && <Icon name="caret" />}
          {cat.parent_id && <small>Категория: {categories.find(parent => parent.id === cat.parent_id)?.name}</small>}
        </button>
        <div className="design-category-actions" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuId(id => id === cat.id ? null : id); }}>
          <button type="button" ref={element => { if (element) triggers.current.set(cat.id, element); else triggers.current.delete(cat.id); }} className="design-category-more" aria-label={`Действия категории ${cat.name}`} aria-expanded={menuId === cat.id}
            onClick={() => setMenuId(menuId === cat.id ? null : cat.id)}>⋯</button>
          {menuId === cat.id && <div className="design-category-menu" role="group" aria-label={`Действия ${cat.name}`}>
            <button type="button" autoFocus onClick={() => edit(cat)}>Редактировать</button>
            <button type="button" onClick={() => { setArchiving(cat); setMenuId(null); }}>Архивировать</button>
          </div>}
        </div>
      </div>
      {open && rows(children, new Set([...visited, cat.id]))}
    </div>;
  });
  const title = editing ? editing.id ? 'Изменить категорию' : 'Новая категория' : 'Категории';
  return <Dialog title={title} onClose={back}>
    <section ref={section} className="design-support design-support-page design-category-manager" style={viewport ? { height: viewport.height, top: viewport.top, bottom: 'auto' } : undefined}>
      <ScreenHeader title={title} onBack={back} backDisabled={locked} action={null} />
      <div className="design-support-body">
        {!editing ? <>
          <button className="design-primary" onClick={() => edit({ name: '', type: 'expense', icon: '📦', color: '#F3F4F6' })}>Добавить категорию</button>
          {categories.length === 0 && <p>Категорий пока нет</p>}
          <div className="design-category-list">{rows(categorySelection(categories).roots)}</div>
        </> : <fieldset disabled={locked} className="design-category-fields">
          <InlineField label="Название" aria-label="Название категории" maxLength={100} value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} />
          <InlineField label="Значок" aria-label="Значок категории" maxLength={20} value={editing.icon || ''} onChange={e => setEditing({ ...editing, icon: e.target.value })} />
          <label className="design-inline-field">Тип <select value={editing.type || 'expense'} onChange={e => setEditing({ ...editing, type: e.target.value as Category['type'] })}>
            <option value="expense">Расход</option><option value="income">Доход</option><option value="both">Оба</option></select></label>
          <label className="design-inline-field">Категория <select aria-label="Родительская категория" value={editing.parent_id || ''} onChange={e => setEditing({ ...editing, parent_id: e.target.value || null })}>
            <option value="">Нет</option>{categories.filter(c => c.id !== editing.id).map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></label>
        </fieldset>}
        {editing && <><button disabled={busy || attempt.phase === 'pending'} onClick={() => void save()} className="design-primary">{busy || attempt.phase === 'pending' ? 'Сохраняем…' : 'Сохранить'}</button>
          <button disabled={locked} className="design-primary-secondary" onClick={back}>Отмена</button></>}
        {!archiving && (error || attempt.error) && <p role="alert" className="design-error">{attempt.error || serverError || error}</p>}
        {sessionRecovery}
      {archiving && <ConfirmPanel title="Архивировать категорию?" description="История операций сохранится." action="Архивировать" busy={busy} error={error ? serverError || error : undefined} onCancel={() => { if (!busy) { pendingFocus.current = archiving.id; setArchiving(null); } }} onConfirm={() => void archive()} />}
      </div>
    </section>
  </Dialog>;
}
