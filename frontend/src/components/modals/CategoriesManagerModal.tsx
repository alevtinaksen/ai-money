import { useState } from 'react';
import { Category } from '../../types';
import { SupportPage, ConfirmPanel } from '../design/Support';
import { Dialog } from '../shared/Dialog';

interface Props {
  isOpen: boolean; onClose: () => void; categories: Category[];
  onSaveCategory: (category: Partial<Category> & { id?: string }) => Promise<boolean>;
  onDeleteCategory: (id: string) => void;
  onReorderCategories?: (categories: Category[]) => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}
export function CategoriesManagerModal({ isOpen, onClose, categories, onSaveCategory, onDeleteCategory }: Props) {
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [archiving, setArchiving] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  if (!isOpen) return null;
  const save = async () => {
    if (!editing?.name?.trim()) return;
    setBusy(true);
    try { if (await onSaveCategory(editing)) setEditing(null); }
    finally { setBusy(false); }
  };
  return <Dialog title="Категории" onClose={onClose}>
    <SupportPage title="Категории" onClose={onClose}>
        {!editing ? <>
          <button className="design-primary" onClick={() => setEditing({ name: '', type: 'expense', icon: '📦', color: '#F3F4F6' })}>Добавить категорию</button>
          {categories.length === 0 && <p>Категорий пока нет</p>}
          {categories.map(cat => <div key={cat.id} className="design-paper p-4 flex gap-3 justify-between">
            <button className="text-left" onClick={() => setEditing(cat)}>{cat.icon} {cat.name}
              {cat.parent_id && <small className="block">Подкатегория: {categories.find(parent => parent.id === cat.parent_id)?.name}</small>}</button>
            <button aria-label={`Архивировать ${cat.name}`} onClick={() => setArchiving(cat)}>Архивировать</button>
          </div>)}
        </> : <fieldset disabled={busy} className="space-y-4 design-paper p-4">
          <label className="block">Название <input className="block" value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>
          <label className="block">Значок <input className="" value={editing.icon || ''} onChange={e => setEditing({ ...editing, icon: e.target.value })} /></label>
          <label className="block">Тип <select className="bg-transparent" value={editing.type || 'expense'} onChange={e => setEditing({ ...editing, type: e.target.value as Category['type'] })}>
            <option value="expense">Расход</option><option value="income">Доход</option><option value="both">Оба</option></select></label>
          <label className="block">Родительская категория <select className="bg-transparent" value={editing.parent_id || ''} onChange={e => setEditing({ ...editing, parent_id: e.target.value || null })}>
            <option value="">Нет</option>{categories.filter(c => c.id !== editing.id).map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></label>
          <button onClick={() => void save()} className="design-primary">{busy ? 'Сохраняем…' : 'Сохранить'}</button>
          <button className="p-3" onClick={() => setEditing(null)}>Отмена</button>
        </fieldset>}
      {archiving && <ConfirmPanel title="Архивировать категорию?" description="История операций сохранится." action="Архивировать" onCancel={() => setArchiving(null)} onConfirm={() => { onDeleteCategory(archiving.id); setArchiving(null); }} />}
    </SupportPage>
  </Dialog>;
}
