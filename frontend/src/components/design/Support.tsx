import { ReactNode } from 'react';
import { Dialog } from '../shared/Dialog';
import { IconButton } from './Primitives';

export function SupportPage({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <section className="design-support design-support-page"><header className="design-support-header"><IconButton icon="close" label="Закрыть" onClick={onClose} /><h1>{title}</h1></header><div className="design-support-body">{children}</div></section>;
}
export function ConfirmPanel({ title, description, action, onCancel, onConfirm, busy = false, error }: { title: string; description: string; action: string; onCancel: () => void; onConfirm: () => void; busy?: boolean; error?: string }) {
  return <div className="design-overlay"><Dialog title={title} onClose={() => { if (!busy) onCancel(); }}><div className="design-confirm"><h2>{title}</h2><p>{description}</p>{error && <p role="alert" className="design-error">{error}</p>}<div className="design-confirm-actions"><button disabled={busy} onClick={onCancel}>Отмена</button><button disabled={busy} className="design-primary" onClick={onConfirm}>{busy ? 'Сохраняем…' : action}</button></div></div></Dialog></div>;
}
