import { useEffect, useRef, useState } from 'react';
import { Account, Category } from '../../types';
import { ParsedResult, parseMediaAPI, parseTextAPI, TransactionInput } from '../../api/client';
import { SupportPage } from '../design/Support';
import { ProposalRow } from './ProposalRow';
import { CreationOutcome } from '../../hooks/useCreationAttempt';
import { AudioRecorder } from '../../hooks/useAudioRecorder';

interface Props {
  auth: string; kind: 'voice' | 'receipt'; accounts: Account[]; categories: Category[];
  onClose: () => void; onSave: (data: TransactionInput) => Promise<CreationOutcome | boolean>;
  onBlockedChange?: (blocked: boolean) => void;
  initialFile?: File | null; recorder?: AudioRecorder;
}
export function AiPreview({ auth, kind, accounts, categories, onClose, onSave, onBlockedChange, initialFile, recorder }: Props) {
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const savingRows = useRef(new Set<number>());
  const [blocked, setBlocked] = useState(false);
  const parsing = useRef(false);
  const receivedFile = useRef<File | null>(null);
  const rowBlocked = (index: number, value: boolean) => {
    if (value) savingRows.current.add(index); else savingRows.current.delete(index);
    const next = savingRows.current.size > 0; setBlocked(next); onBlockedChange?.(next);
  };
  const parse = async (file?: File) => {
    if (savingRows.current.size || parsing.current) return;
    if (file && file.size > 5 * 1024 * 1024) { setError('Файл больше 5 МБ. Выберите меньший файл.'); return; }
    parsing.current = true;
    setLoading(true); setError(''); setResult(null);
    try { setResult(file ? await parseMediaAPI(auth, file, kind) : await parseTextAPI(auth, text)); }
    catch (cause) { setError((cause as Error).message); }
    finally { parsing.current = false; setLoading(false); }
  };
  useEffect(() => {
    if (initialFile && receivedFile.current !== initialFile && !blocked && !parsing.current) {
      receivedFile.current = initialFile; void parse(initialFile);
    }
  }, [initialFile, blocked, loading]);
  return <SupportPage title={kind === 'receipt' ? 'Фото чека' : 'Голос и текст'} onClose={() => { if (!savingRows.current.size) onClose(); }}>
      {kind === 'voice' && recorder && <section className="design-voice-capture" aria-label="Запись голоса">
        {recorder.state === 'requesting' ? <><p role="status">Разрешите доступ к микрофону…</p><button onClick={recorder.cancel}>Отмена</button></>
          : recorder.state === 'recording' ? <><p role="status">Запись · {recorder.seconds} с</p>
            <button className="design-primary" onClick={recorder.stop}>Остановить и распознать</button><button onClick={recorder.cancel}>Отменить запись</button></>
          : <button className="design-primary" disabled={loading || blocked} onClick={() => {
            if (savingRows.current.size || parsing.current) return;
            setResult(null); void recorder.start();
          }}>Записать голос</button>}
        {recorder.error && <p role="alert" className="design-error">{recorder.error}</p>}
      </section>}
      <p>Проверьте распознанные суммы перед сохранением. Файл передаётся настроенному AI.</p>
      {error && initialFile && <button disabled={loading || blocked} className="design-primary" onClick={() => void parse(initialFile)}>Повторить распознавание</button>}
      {recorder?.state !== 'recording' && recorder?.state !== 'requesting' && <>
      <label className="block">{kind === 'receipt' ? 'Выберите фото' : 'Выберите аудиофайл'}
        <input aria-label="Файл для распознавания" type="file" disabled={loading || blocked}
          accept={kind === 'receipt' ? 'image/jpeg,image/png,image/webp' : 'audio/ogg,audio/mpeg,audio/wav,audio/mp4,audio/webm'}
          capture={kind === 'receipt' ? 'environment' : undefined}
          onChange={e => { const file = e.target.files?.[0]; if (file) void parse(file); e.target.value = ''; }} /></label>
      {kind === 'voice' && <><label className="block">Текст операции
        <textarea disabled={blocked} className="" value={text} onChange={e => setText(e.target.value)} /></label>
        <button disabled={loading || blocked || !text.trim()} className="design-primary" onClick={() => void parse()}>Подготовить черновик</button></>}
      </>}
      {blocked && <p role="status">Сначала подтвердите сохранение текущей операции. Затем можно распознать новый текст или файл.</p>}
      {loading && <p role="status">Распознаём… Деньги ещё не изменены.</p>}
      {error && <p role="alert" className="design-error">{error}</p>}
      {result?.clarification && <p>{result.clarification}</p>}
      {recorder?.state !== 'recording' && recorder?.state !== 'requesting' && result?.transactions.map((proposal, index) => <ProposalRow key={`${JSON.stringify(result)}:${index}`}
        proposal={proposal} accounts={accounts} categories={categories} onSave={onSave} onBlockedChange={value => rowBlocked(index, value)} />)}
  </SupportPage>;
}
