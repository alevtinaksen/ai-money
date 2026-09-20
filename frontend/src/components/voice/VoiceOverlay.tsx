import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CloseOutlined, CheckOutlined } from '@ant-design/icons';
import { Account, Category } from '../../types';
import { parseTextAPI, parseVoiceAPI } from '../../api/client';
import { parseFinancialSpeech } from '../../utils/voiceParser';
import { resolveAccountBankAndName } from '../../utils/bankUtils';

interface VoiceOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAccount: Account;
  accounts: Account[];
  categories: Category[];
  onVoiceSuccess: (parsedResult: any) => void;
  initData: string;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
  onOpenAccountSelect?: () => void;
}

export const VoiceOverlay: React.FC<VoiceOverlayProps> = ({
  isOpen,
  onClose,
  selectedAccount,
  accounts,
  categories,
  onVoiceSuccess,
  initData,
  onHaptic,
  onOpenAccountSelect,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptText, setTranscriptText] = useState('Говорите...');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const capturedTextRef = useRef<string>('');
  const hasProcessedRef = useRef<boolean>(false);

  const resolvedAccount = resolveAccountBankAndName(selectedAccount);

  const cleanupRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
      mediaRecorderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  }, []);

  const processSpokenInput = useCallback(
    async (spokenText: string, audioBlob?: Blob) => {
      if (hasProcessedRef.current) return;
      hasProcessedRef.current = true;
      setIsProcessing(true);
      setTranscriptText('Обрабатываю...');

      const trimmedText = spokenText.trim();

      // 1. If we have recognized text, send to text parser or parse locally
      if (trimmedText && trimmedText !== 'Говорите...') {
        try {
          // Attempt backend LLM parse
          const res = await parseTextAPI(initData, trimmedText);
          if (res && res.transactions && res.transactions.length > 0) {
            onVoiceSuccess(res);
            setIsProcessing(false);
            onClose();
            return;
          }
        } catch (err) {
          console.warn('Backend text parse failed, using client-side smart parser:', err);
        }

        // Fallback: high-accuracy local parser
        const localParsed = parseFinancialSpeech(
          trimmedText,
          categories,
          accounts,
          selectedAccount
        );

        if (localParsed.amount > 0) {
          onVoiceSuccess({
            transactions: [
              {
                amount: localParsed.amount,
                type: localParsed.type,
                category_id: localParsed.category.id,
                category_name: localParsed.category.name,
                account_id: localParsed.account?.id || selectedAccount.id,
                account_name: localParsed.account?.name || selectedAccount.name,
                to_account_id: localParsed.to_account?.id,
                to_account_name: localParsed.to_account?.name,
                note: localParsed.note,
              },
            ],
          });
          setIsProcessing(false);
          onClose();
          return;
        }
      }

      // 2. If no text was recognized yet, but we have audio recorded, send audio to backend
      if (audioBlob && audioBlob.size > 0) {
        try {
          const res = await parseVoiceAPI(initData, audioBlob);
          if (res && res.transactions && res.transactions.length > 0) {
            onVoiceSuccess(res);
            setIsProcessing(false);
            onClose();
            return;
          }
        } catch (err) {
          console.warn('Backend audio voice parse error:', err);
        }
      }

      // 3. If silence or unrecognizable input
      setIsProcessing(false);
      setErrorMessage('Не удалось разобрать речь. Пожалуйста, повторите фразу.');
      setTranscriptText('Говорите...');
      hasProcessedRef.current = false;
    },
    [initData, categories, accounts, selectedAccount, onVoiceSuccess, onClose]
  );

  const startListening = useCallback(async () => {
    hasProcessedRef.current = false;
    capturedTextRef.current = '';
    audioChunksRef.current = [];
    setErrorMessage(null);
    setTranscriptText('Говорите...');
    setIsProcessing(false);

    // 1. Initialize Web Speech API (real-time streaming speech recognition)
    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.lang = 'ru-RU';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          let accumulated = '';
          for (let i = 0; i < event.results.length; i++) {
            accumulated += event.results[i][0].transcript + ' ';
          }
          const cleaned = accumulated.trim();
          if (cleaned) {
            capturedTextRef.current = cleaned;
            setTranscriptText(cleaned);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition warning:', event.error);
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('Failed to start SpeechRecognition:', e);
      }
    }

    // 2. Also capture microphone audio via MediaRecorder in parallel as fallback
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const mimeTypes = ['audio/webm', 'audio/mp4', 'audio/ogg', ''];
        let chosenMime = '';
        for (const m of mimeTypes) {
          if (!m || MediaRecorder.isTypeSupported(m)) {
            chosenMime = m;
            break;
          }
        }

        const options = chosenMime ? { mimeType: chosenMime } : undefined;
        const recorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.start(100);
        setIsRecording(true);
      } else {
        setIsRecording(true);
      }
    } catch (err: any) {
      console.warn('Microphone permission or access error:', err);
      // If Web Speech is running, we can still recognize speech!
      if (recognitionRef.current) {
        setIsRecording(true);
      } else {
        setErrorMessage('Разрешите доступ к микрофону в браузере');
        setTranscriptText('Микрофон недоступен');
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      startListening();
    } else {
      cleanupRecording();
    }
    return () => {
      cleanupRecording();
    };
  }, [isOpen, startListening, cleanupRecording]);

  const handleFinish = () => {
    if (hasProcessedRef.current || isProcessing) return;
    onHaptic?.('heavy');

    const spokenText = capturedTextRef.current;
    let audioBlob: Blob | undefined;

    if (audioChunksRef.current.length > 0) {
      audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    }

    cleanupRecording();
    processSpokenInput(spokenText, audioBlob);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between items-center bg-black/40 backdrop-blur-[4px] px-6 pb-8 pt-12 animate-fade-in select-none">
      {/* Top Space (click outside to dismiss) */}
      <div className="w-full flex-1" onClick={onClose} />

      {/* Center Interactive Section: Speech Bubble & Account Pill */}
      <div className="w-full max-w-sm flex flex-col items-center space-y-4 mb-6">
        {/* Account Pill */}
        <button
          type="button"
          onClick={() => {
            onHaptic?.('light');
            onOpenAccountSelect?.();
          }}
          className="flex items-center space-x-2 bg-white dark:bg-[#1A1B20] px-4 py-2.5 rounded-full shadow-lg text-[#111827] dark:text-white active:scale-95 transition-all border border-gray-100 dark:border-[#252730]"
        >
          <span className="text-lg">{selectedAccount.icon || '❤️'}</span>
          {resolvedAccount.bank && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#252730] text-[#4B5563] dark:text-[#A0A5B5]">
              {resolvedAccount.bank.shortName}
            </span>
          )}
          <span className="text-[14px] font-semibold">{resolvedAccount.cleanName}</span>
          <span className="text-[#2B5BFF] text-xs font-bold">✨</span>
        </button>

        {/* Speech Bubble («Говорите...» / Spoken Words) */}
        <div className="bg-white dark:bg-[#1A1B20] px-6 py-3.5 rounded-full shadow-xl flex items-center space-x-2.5 border border-gray-100 dark:border-[#252730] max-w-full">
          {isRecording && !isProcessing && (
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
          )}
          <span className="text-[16px] font-medium text-[#111827] dark:text-white truncate max-w-[280px]">
            {transcriptText}
          </span>
        </div>

        {/* Error message or Hint if any */}
        {errorMessage && (
          <div className="text-center text-[13px] text-red-500 font-medium px-4 py-1.5 bg-red-50 dark:bg-red-950/40 rounded-full border border-red-200 dark:border-red-900/40">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="w-full max-w-xs flex items-center justify-between px-4 pb-2">
        {/* Close Button (Left) */}
        <button
          type="button"
          onClick={() => {
            onHaptic?.('light');
            cleanupRecording();
            onClose();
          }}
          className="w-13 h-13 p-3.5 rounded-full bg-white dark:bg-[#1A1B20] text-[#111827] dark:text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] flex items-center justify-center active:scale-90 transition-all border border-gray-100 dark:border-[#252730]"
        >
          <CloseOutlined className="text-[20px]" />
        </button>

        {/* Big Action Checkmark Button (Center) */}
        <div className="relative">
          <div className="absolute -inset-1.5 bg-[#2B5BFF]/30 rounded-full blur-md" />
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleFinish}
            className="relative w-18 h-18 p-4 rounded-full bg-[#2B5BFF] text-white shadow-[0_8px_24px_rgba(43,91,255,0.45)] flex items-center justify-center active:scale-95 transition-all hover:brightness-105"
          >
            {isProcessing ? (
              <div className="w-7 h-7 border-3 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckOutlined className="text-[32px]" />
            )}
          </button>
        </div>

        {/* Balanced spacer */}
        <div className="w-13 h-13 pointer-events-none" />
      </div>
    </div>
  );
};
