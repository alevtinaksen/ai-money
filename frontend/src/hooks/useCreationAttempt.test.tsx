import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { creationFailure, CreationOutcome, useCreationAttempt } from './useCreationAttempt';
afterEach(cleanup);
it.each([0, 408, 500, 502, 503])('status %s keeps the exact payload and identity for retry', async status => {
  const submit = vi.fn().mockRejectedValueOnce(new ApiError(status, 'synthetic')).mockResolvedValueOnce('saved');
  const changed = vi.fn(); const { result } = renderHook(() => useCreationAttempt(submit, changed));
  await act(async () => { await result.current.run({ amount: '10.00' }); });
  expect(result.current.phase).toBe('uncertain'); expect(result.current.blocked()).toBe(true);
  await act(async () => { await result.current.run({ amount: '20.00' }); });
  expect(submit.mock.calls[1][0]).toEqual(submit.mock.calls[0][0]);
  expect(result.current.phase).toBe('saved'); expect(changed).toHaveBeenLastCalledWith(false);
});
it.each([400, 401, 403, 409, 422, 429])('definitive status %s permits correction before any unknown commit', async status => {
  const submit = vi.fn().mockRejectedValueOnce(new ApiError(status, 'invalid')).mockResolvedValueOnce('saved');
  const { result } = renderHook(() => useCreationAttempt(submit));
  await act(async () => { await result.current.run({ amount: '10.00' }); });
  expect(result.current.blocked()).toBe(false); expect(result.current.phase).toBe('editable');
  await act(async () => { await result.current.run({ amount: '20.00' }); });
  expect(submit.mock.calls[1][0].client_id).not.toBe(submit.mock.calls[0][0].client_id);
  expect(submit.mock.calls[1][0].amount).toBe('20.00');
});
it('later definitive rejection cannot prove an earlier ambiguous write did not commit', async () => {
  const submit = vi.fn().mockResolvedValueOnce('uncertain').mockResolvedValueOnce('rejected').mockResolvedValueOnce('saved');
  const { result } = renderHook(() => useCreationAttempt(submit));
  await act(async () => { await result.current.run({ amount: '10.00' }); });
  await act(async () => { await result.current.run({ amount: '20.00' }); });
  expect(result.current.phase).toBe('uncertain'); expect(result.current.blocked()).toBe(true);
  await act(async () => { await result.current.run({ amount: '30.00' }); });
  expect(submit.mock.calls.map(([payload]) => payload)).toEqual(Array(3).fill(submit.mock.calls[0][0]));
});
it('synchronous repeated activation sends a single request', async () => {
  let resolve!: (outcome: CreationOutcome) => void;
  const submit = vi.fn(() => new Promise<CreationOutcome>(done => { resolve = done; }));
  const { result } = renderHook(() => useCreationAttempt(submit));
  let first!: Promise<CreationOutcome | undefined>;
  act(() => { first = result.current.run({ amount: '10.00' }); void result.current.run({ amount: '10.00' }); });
  expect(submit).toHaveBeenCalledOnce(); expect(result.current.blocked()).toBe(true);
  await act(async () => { resolve('saved'); await first; });
});
it('unexpected transport failures are ambiguous', () => { expect(creationFailure(new Error('connection'))).toBe('uncertain'); });
