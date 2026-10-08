import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useAudioRecorder } from './useAudioRecorder';

let active: FakeRecorder;
class FakeRecorder {
  static isTypeSupported = (type: string): boolean => type === 'audio/mp4';
  state = 'inactive'; mimeType = 'audio/mp4';
  onstop?: () => void; onerror?: () => void; ondataavailable?: (event: { data: Blob }) => void;
  constructor() { active = this; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['synthetic audio']) }); this.onstop?.(); }
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
function setup(getUserMedia?: () => Promise<unknown>) {
  const stop = vi.fn();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: getUserMedia || vi.fn(async () => ({ getTracks: () => [{ stop }] })) } });
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  const onFile = vi.fn();
  const view = renderHook(() => useAudioRecorder(onFile));
  return { ...view, stop, onFile };
}
test('iOS MP4 recording produces a review file only after Stop and releases the microphone', async () => {
  const view = setup(); await act(async () => { await view.result.current.start(); });
  expect(view.result.current.state).toBe('recording'); expect(view.onFile).not.toHaveBeenCalled();
  act(() => view.result.current.stop());
  expect(view.onFile).toHaveBeenCalledOnce(); expect(view.onFile.mock.calls[0][0].name).toBe('voice.m4a');
  expect(view.onFile.mock.calls[0][0].type).toBe('audio/mp4'); expect(view.stop).toHaveBeenCalledOnce();
});
test('Cancel and unmount discard data and stop every track', async () => {
  const view = setup(); await act(async () => { await view.result.current.start(); });
  act(() => view.result.current.cancel()); expect(view.onFile).not.toHaveBeenCalled(); expect(view.stop).toHaveBeenCalledOnce();
  await act(async () => { await view.result.current.start(); }); view.unmount();
  expect(view.onFile).not.toHaveBeenCalled(); expect(view.stop).toHaveBeenCalledTimes(2);
});
test('a late permission grant after closing is released without recording', async () => {
  let resolve!: (value: unknown) => void; const stop = vi.fn();
  const view = setup(() => new Promise(r => { resolve = r; }));
  let starting!: Promise<void>; act(() => { starting = view.result.current.start(); });
  act(() => view.result.current.cancel());
  await act(async () => { resolve({ getTracks: () => [{ stop }] }); await starting; });
  expect(view.result.current.state).toBe('idle'); expect(stop).toHaveBeenCalledOnce(); expect(view.onFile).not.toHaveBeenCalled();
});
test('permission refusal keeps a useful audio-file fallback', async () => {
  const view = setup(async () => { throw new DOMException('denied', 'NotAllowedError'); });
  await act(async () => { await view.result.current.start(); });
  expect(view.result.current.state).toBe('idle'); expect(view.result.current.error).toContain('Нет доступа'); expect(view.onFile).not.toHaveBeenCalled();
});
test('recordings exceeding upload size are discarded', async () => {
  const view = setup(); await act(async () => { await view.result.current.start(); });
  act(() => active.ondataavailable?.({ data: new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]) }));
  expect(view.result.current.error).toContain('больше 5 МБ'); expect(view.onFile).not.toHaveBeenCalled(); expect(view.stop).toHaveBeenCalledOnce();
});
test('two-minute recording limit stops recording and offers its file for review', async () => {
  vi.useFakeTimers(); const view = setup(); await act(async () => { await view.result.current.start(); });
  act(() => { vi.advanceTimersByTime(120000); });
  expect(view.onFile).toHaveBeenCalledOnce(); expect(view.stop).toHaveBeenCalledOnce(); expect(view.result.current.state).toBe('idle');
});

test('Chrome WebM codecs are normalized to a MIME accepted by the media API', async () => {
  const view = setup();
  class ChromeRecorder extends FakeRecorder {
    static isTypeSupported = (type: string): boolean => type === 'audio/webm;codecs=opus';
    mimeType = 'audio/webm;codecs=opus';
  }
  vi.stubGlobal('MediaRecorder', ChromeRecorder);
  await act(async () => { await view.result.current.start(); }); act(() => view.result.current.stop());
  expect(view.onFile.mock.calls[0][0].type).toBe('audio/webm'); expect(view.onFile.mock.calls[0][0].name).toBe('voice.webm');
});
