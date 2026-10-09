import { useEffect, useRef } from 'react';

const stack: HTMLElement[] = [];

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current!;
    stack.push(dialog);
    stack.sort((a, b) => a.contains(b) ? -1 : b.contains(a) ? 1 : 0);
    const previous = document.activeElement as HTMLElement | null;
    const siblings = [...dialog.parentElement!.children].filter(node => node !== dialog) as HTMLElement[];
    const prior = siblings.map(node => node.inert);
    siblings.forEach(node => { node.inert = true; });
    const controls = () => [...dialog.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex="0"]')]
      .filter(node => !node.matches(':disabled') && node.getClientRects().length > 0);
    if (stack[stack.length - 1] === dialog) (controls()[0] || dialog).focus();
    const trap = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== dialog) return;
      if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const nodes = controls(), first = nodes[0], last = nodes[nodes.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', trap, true);
    return () => {
      document.removeEventListener('keydown', trap, true);
      const index = stack.indexOf(dialog); if (index >= 0) stack.splice(index, 1);
      siblings.forEach((node, index) => { node.inert = prior[index]; });
      previous?.focus();
    };
  }, []);
  return <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>{children}</div>;
}
