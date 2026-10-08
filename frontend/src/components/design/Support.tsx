import { ReactNode } from 'react';
import { Dialog } from '../shared/Dialog';
import { IconButton } from './Primitives';

export function SupportPage({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <section className="design-support design-support-page"><header className="design-support-header"><IconButton icon="close" label="Закрыть" onClick={onClose} /><h1>{title}</h1></header><div className="design-support-body">{children}</div></section>;
}
export function ConfirmPanel({ title, description, action, onCancel, onConfirm }: { title: string; description: string; action: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="design-overlay"><Dialog title={title} onClose={onCancel}><div className="design-confirm"><h2>{title}</h2><p>{description}</p><div className="design-confirm-actions"><button onClick={onCancel}>Отмена</button><button className="design-primary" onClick={onConfirm}>{action}</button></div></div></Dialog></div>;
}
