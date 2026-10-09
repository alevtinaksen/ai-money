import { useRef, useState } from 'react';
import { ApiError } from '../api/client';

export type CreationOutcome = 'saved' | 'rejected' | 'uncertain';
export const creationFailure = (cause: unknown): CreationOutcome =>
  cause instanceof ApiError && cause.status >= 400 && cause.status < 500 && cause.status !== 408
    ? 'rejected' : 'uncertain';
export const uncertainCreationMessage = 'Не удалось подтвердить сохранение. Статус записи неизвестен. Повторите сохранение этого черновика: сумма спишется только один раз.';

/** Keep the exact request until its acknowledgement; a later rejection cannot undo an earlier unknown commit. */
export function useCreationAttempt<T extends object>(
  submit: (payload: T & { client_id: string }) => Promise<CreationOutcome | boolean>,
  onBlockedChange?: (blocked: boolean) => void,
  uncertainMessage = uncertainCreationMessage,
) {
  const request = useRef<(T & { client_id: string }) | null>(null);
  const pending = useRef(false);
  const unknownCommit = useRef(false);
  const [phase, setPhase] = useState<'editable' | 'pending' | 'uncertain' | 'saved'>('editable');
  const [error, setError] = useState('');
  const blocked = () => pending.current || unknownCommit.current;
  const run = async (payload: T) => {
    if (pending.current) return;
    request.current ??= { ...payload, client_id: crypto.randomUUID() };
    pending.current = true; setPhase('pending'); setError(''); onBlockedChange?.(true);
    let outcome: CreationOutcome;
    try {
      const response = await submit(request.current);
      outcome = response === true ? 'saved' : response === false ? 'uncertain' : response;
    } catch (cause) { outcome = creationFailure(cause); setError((cause as Error).message); }
    pending.current = false;
    if (outcome === 'saved') {
      unknownCommit.current = false; request.current = null; setPhase('saved'); onBlockedChange?.(false);
    } else if (outcome === 'uncertain' || unknownCommit.current) {
      unknownCommit.current = true; setPhase('uncertain'); setError(uncertainMessage);
    } else {
      request.current = null; setPhase('editable'); onBlockedChange?.(false);
    }
    return outcome;
  };
  const retry = () => request.current ? run(request.current) : Promise.resolve(undefined);
  return { run, retry, blocked, phase, error, locked: phase === 'pending' || phase === 'uncertain' };
}
