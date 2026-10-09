import { useEffect, useRef, useState } from 'react';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DURATION_MS = 120000;
const MIME_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];

export function useAudioRecorder(onFile: (file: File) => void) {
  const [state, setState] = useState<'idle' | 'requesting' | 'recording'>('idle');
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const generation = useRef(0);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timers = useRef<number[]>([]);
  const deliver = useRef(onFile); deliver.current = onFile;
  const release = () => {
    timers.current.forEach(id => { clearTimeout(id); clearInterval(id); }); timers.current = [];
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    recorder.current = null;
  };
  const cancel = () => {
    generation.current++;
    const active = recorder.current;
    if (active && active.state !== 'inactive') active.stop();
    release(); setState('idle'); setSeconds(0);
  };
  useEffect(() => () => {
    generation.current++;
    if (recorder.current?.state !== 'inactive') recorder.current?.stop();
    release();
  }, []);
  const start = async () => {
    if (recorder.current || stream.current || state === 'requesting') return;
    setError(''); setSeconds(0);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Запись недоступна в этом браузере. Отправьте голосовое боту или выберите аудиофайл.'); return;
    }
    const version = ++generation.current;
    setState('requesting');
    let acquired: MediaStream | null = null;
    try {
      // Called directly from the microphone gesture, before any asynchronous navigation.
      acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (version !== generation.current) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream.current = acquired;
      const mimeType = MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('unsupported');
      const active = new MediaRecorder(acquired, { mimeType });
      recorder.current = active;
      const chunks: Blob[] = []; let size = 0;
      active.ondataavailable = event => {
        if (version !== generation.current || !event.data.size) return;
        size += event.data.size;
        if (size > MAX_BYTES) {
          cancel(); setError('Запись больше 5 МБ. Запишите более короткое сообщение.'); return;
        }
        chunks.push(event.data);
      };
      active.onerror = () => { if (version === generation.current) { cancel(); setError('Запись прервалась. Попробуйте ещё раз или отправьте голосовое боту.'); } };
      active.onstop = () => {
        if (version !== generation.current) return;
        const type = (active.mimeType || mimeType).split(';', 1)[0].trim().toLowerCase();
        release(); setState('idle');
        const blob = new Blob(chunks, { type });
        if (!blob.size) { setError('Запись пустая. Попробуйте ещё раз.'); return; }
        const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        deliver.current(new File([blob], `voice.${extension}`, { type }));
      };
      active.start(1000); setState('recording');
      timers.current = [window.setInterval(() => setSeconds(value => value + 1), 1000),
        window.setTimeout(() => { if (active.state === 'recording') active.stop(); }, MAX_DURATION_MS)];
    } catch (cause) {
      acquired?.getTracks().forEach(track => track.stop());
      if (version !== generation.current) return;
      release(); setState('idle');
      setError(cause instanceof DOMException && cause.name === 'NotAllowedError'
        ? 'Нет доступа к микрофону. Разрешите его в настройках браузера или отправьте голосовое боту.'
        : 'Не удалось начать запись. Выберите аудиофайл или отправьте голосовое боту.');
    }
  };
  return { state, error, seconds, start, cancel, stop: () => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  } };
}

export type AudioRecorder = ReturnType<typeof useAudioRecorder>;
