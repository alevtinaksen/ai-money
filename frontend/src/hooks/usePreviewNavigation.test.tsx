import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PreviewNavigationResult, usePreviewNavigation } from './usePreviewNavigation';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); history.replaceState(null, '', '/'); });
function setup(path = '/frontend/dist/index.html') {
  const parent = { postMessage: vi.fn() };
  vi.spyOn(window, 'parent', 'get').mockReturnValue(parent as unknown as Window);
  history.replaceState(null, '', path);
  const navigate = vi.fn((): PreviewNavigationResult => ({ status: 'applied', message: 'Открыт экран' }));
  renderHook(() => usePreviewNavigation(navigate));
  const send = (route = 'accounts', origin = location.origin, source: unknown = parent) => window.dispatchEvent(
    new MessageEvent('message', { source: source as Window, origin, data: { type: 'ai-money:preview:navigate', requestId: 'step-1', route } }));
  return { parent, navigate, send };
}
it('same-origin local stand receives a correlated navigation acknowledgement', () => {
  const view = setup(); view.send();
  expect(view.navigate).toHaveBeenCalledWith('accounts');
  expect(view.parent.postMessage).toHaveBeenCalledWith({ type: 'ai-money:preview:navigation-result',
    requestId: 'step-1', route: 'accounts', status: 'applied', message: 'Открыт экран' }, location.origin);
});
it('foreign source and foreign origin cannot navigate or receive an acknowledgement', () => {
  const view = setup(); view.send('accounts', 'https://foreign.example'); view.send('accounts', location.origin, {});
  expect(view.navigate).not.toHaveBeenCalled(); expect(view.parent.postMessage).not.toHaveBeenCalled();
});
it.each(['/', '/frontend/', '/index.html'])('normal runtime at %s does not expose the bridge', path => {
  const view = setup(path); view.send(); expect(view.navigate).not.toHaveBeenCalled(); expect(view.parent.postMessage).not.toHaveBeenCalled();
});
it('stand-alone runtime never listens even at the dist path', () => {
  history.replaceState(null, '', '/frontend/dist/index.html');
  const navigate = vi.fn(); renderHook(() => usePreviewNavigation(navigate));
  window.dispatchEvent(new MessageEvent('message', { source: window, origin: location.origin,
    data: { type: 'ai-money:preview:navigate', requestId: 'step-1', route: 'accounts' } }));
  expect(navigate).not.toHaveBeenCalled();
});
it('non-loopback hosts never expose the preview bridge', () => {
  vi.stubGlobal('location', { pathname: '/frontend/dist/index.html', hostname: 'money.example', origin: 'https://money.example' });
  const view = setup(); view.send();
  expect(view.navigate).not.toHaveBeenCalled(); expect(view.parent.postMessage).not.toHaveBeenCalled();
});
it('unsupported routes receive an explicit refusal without dispatching an action', () => {
  const view = setup(); view.send('delete-all');
  expect(view.navigate).not.toHaveBeenCalled();
  expect(view.parent.postMessage.mock.calls[0][0]).toMatchObject({ status: 'unsupported', route: 'delete-all' });
});
it('uses current pending/uncertain guard and acknowledges its refusal', () => {
  const view = setup(); view.navigate.mockReturnValue({ status: 'blocked', message: 'Сначала подтвердите сохранение' });
  view.send('add-expense');
  expect(view.parent.postMessage.mock.calls[0][0]).toMatchObject({ status: 'blocked', requestId: 'step-1' });
});
