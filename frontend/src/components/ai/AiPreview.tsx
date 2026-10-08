import { useRef, useState } from 'react';
import { Account, Category } from '../../types';
import { ParsedResult, parseMediaAPI, parseTextAPI, TransactionInput } from '../../api/client';
import { SupportPage } from '../design/Support';
import { ProposalRow } from './ProposalRow';
import { CreationOutcome } from '../../hooks/useCreationAttempt';

interface Props {
  auth: string; kind: 'voice' | 'receipt'; accounts: Account[]; categories: Category[];
  onClose: () => void; onSave: (data: TransactionInput) => Promise<CreationOutcome | boolean>;
  onBlockedChange?: (blocked: boolean) => void;
}
export function AiPreview({ auth, kind, accounts, categories, onClose, onSave, onBlockedChange }: Props) {
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const savingRows = useRef(new Set<number>());
  const [blocked, setBlocked] = useState(false);
  const rowBlocked = (index: number, value: boolean) => {
    if (value) savingRows.current.add(index); else savingRows.current.delete(index);
    const next = savingRows.current.size > 0; setBlocked(next); onBlockedChange?.(next);
  };
  const parse = async (file?: File) => {
    if (savingRows.current.size || loading) return;
    setLoading(true); setError(''); setResult(null);
    try { setResult(file ? await parseMediaAPI(auth, file, kind) : await parseTextAPI(auth, text)); }
    catch (cause) { setError((cause as Error).message); }
    finally { setLoading(false); }
  };
  return <SupportPage title={kind === 'receipt' ? 'Фото чека' : 'Голос и текст'} onClose={() => { if (!savingRows.current.size) onClose(); }}>
      <p>Распознавание только предлагает поля. Проверьте сумму, валюту и счета перед сохранением каждой операции.</p>
      <p>Для файлов требуется разрешённый облачный AI: файл и названия счетов/категорий передаются настроенному поставщику Groq или Gemini. Без облака доступен текст одной операции.</p>
      <label className="block">{kind === 'receipt' ? 'Выберите фото' : 'Выберите аудиофайл'}
        <input aria-label="Файл для распознавания" type="file" disabled={loading || blocked}
          accept={kind === 'receipt' ? 'image/jpeg,image/png,image/webp' : 'audio/ogg,audio/mpeg,audio/wav,audio/mp4,audio/webm'}
          onChange={e => { const file = e.target.files?.[0]; if (file) void parse(file); e.target.value = ''; }} /></label>
      {kind === 'voice' && <><label className="block">Текст операции
        <textarea disabled={blocked} className="" value={text} onChange={e => setText(e.target.value)} /></label>
        <button disabled={loading || blocked || !text.trim()} className="design-primary" onClick={() => void parse()}>Подготовить черновик</button></>}
      {blocked && <p role="status">Сначала подтвердите сохранение текущей операции. Затем можно распознать новый текст или файл.</p>}
      {loading && <p role="status">Распознаём… Деньги ещё не изменены.</p>}
      {error && <p role="alert" className="design-error">{error}</p>}
      {result?.clarification && <p>{result.clarification}</p>}
      {result?.transactions.map((proposal, index) => <ProposalRow key={`${JSON.stringify(result)}:${index}`}
        proposal={proposal} accounts={accounts} categories={categories} onSave={onSave} onBlockedChange={value => rowBlocked(index, value)} />)}
  </SupportPage>;
}
