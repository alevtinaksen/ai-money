import { useState } from 'react';
import { Category } from '../../types';
import { CategoriesManagerModal } from '../modals/CategoriesManagerModal';
import { Icon, ScreenHeader } from '../design/Primitives';
import { ConfirmPanel } from '../design/Support';
import { useTheme, ThemeMode } from '../../context/ThemeContext';
interface SettingsScreenProps {
  onBack: () => void; categories: Category[]; onSaveCategory: (category: Partial<Category> & {id?:string}) => Promise<boolean>;
  onDeleteCategory: (id:string)=>void; onReorderCategories?: (categories:Category[])=>void;
  onExportData?:()=>void; onRecalculateBalances?:()=>Promise<void>|void; onResetData?:()=>void; onHaptic?:(style?:'light'|'medium'|'heavy')=>void;
}
export function SettingsScreen(p: SettingsScreenProps) {
  const { mode, setMode } = useTheme();
  const [categoriesOpen,setCategoriesOpen]=useState(false),[syncing,setSyncing]=useState(false),[success,setSuccess]=useState(false),[error,setError]=useState(''),[reset,setReset]=useState(false);
  const sync=async()=>{p.onHaptic?.('medium');setSyncing(true);setSuccess(false);setError('');try{await p.onRecalculateBalances?.();setSuccess(true);}catch{setError('Синхронизация не выполнена. Проверьте соединение и повторите.');}finally{setSyncing(false);}};
  return <section className="design-settings"><ScreenHeader title="Настройки" onBack={p.onBack} action={null}/>
    <div className="design-settings-group"><h2>Категории</h2><button className="design-settings-row" onClick={()=>setCategoriesOpen(true)}><span>Управление категориями<small>{p.categories.length} шт.</small></span><Icon name="caret"/></button></div>
    <fieldset className="design-settings-group design-theme"><legend>Тема</legend>
      {([['auto', 'Как в Telegram'], ['light', 'Светлая'], ['dark', 'Тёмная']] as [ThemeMode, string][]).map(([value, label]) =>
        <label className="design-settings-row" key={value}><span>{label}{value === 'auto' && <small>В браузере — как в системе</small>}</span>
          <input type="radio" name="app-theme" value={value} checked={mode === value} onChange={() => { p.onHaptic?.('light'); setMode(value); }} />
        </label>)}
    </fieldset>
    <div className="design-settings-group"><h2>Данные</h2><button className="design-settings-row" aria-label="Обновить данные" disabled={syncing} onClick={()=>void sync()}><Icon name="refresh"/><span>{syncing?'Обновление…':'Обновить данные'}<small>Загрузить последние изменения из бота</small></span><Icon name="caret"/></button>
      {success && <p role="status" className="design-empty">Данные обновлены</p>}{error && <p role="alert" className="design-empty">{error}</p>}
      <button className="design-settings-row" aria-label="Очистить старый локальный кэш" onClick={()=>setReset(true)}><Icon name="trash"/><span>Очистить старый кэш<small>Удалить старые локальные копии с этого устройства</small></span><Icon name="caret"/></button>{p.onExportData && <button className="design-settings-row" onClick={p.onExportData}><Icon name="document"/><span>Экспорт старых локальных черновиков<small>Сохранить копию перед очисткой</small></span></button>}</div>
    <p className="design-empty">Финансовые данные загружаются с сервера</p>
    {reset && <ConfirmPanel title="Очистить старый кэш?" description="Будут удалены старые локальные копии и несинхронизированные правки. Сначала экспортируйте их при необходимости. Серверные операции и счета сохранятся." action="Очистить кэш" onCancel={()=>setReset(false)} onConfirm={()=>{setReset(false);p.onResetData?.();}}/>}
    <CategoriesManagerModal isOpen={categoriesOpen} onClose={()=>setCategoriesOpen(false)} categories={p.categories} onSaveCategory={p.onSaveCategory} onDeleteCategory={p.onDeleteCategory} onReorderCategories={p.onReorderCategories} onHaptic={p.onHaptic}/>
  </section>;
}
