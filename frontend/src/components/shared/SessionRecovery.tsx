export function SessionRecovery({ required, telegram, pending, error, onLogin }: {
  required: boolean; telegram: boolean; pending: boolean; error: string; onLogin: () => void;
}) {
  if (!required) return null;
  if (telegram) return <p>Сессия Telegram истекла. Новый запуск потеряет открытый черновик: сначала сверьте историю перед повторным вводом.</p>;
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname)) return null;
  return <div>
    <p>Сессия истекла. Войдите снова, затем повторите сохранение текущего черновика.</p>
    <button className="design-primary" disabled={pending} onClick={onLogin}>Войти снова локально</button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
