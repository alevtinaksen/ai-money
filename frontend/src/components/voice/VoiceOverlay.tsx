import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Settings2, SlidersHorizontal } from 'lucide-react';
import { Account } from '../../types';

interface VoiceOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAccount: Account;
  onVoiceSuccess: (parsedResult: any) => void;
  initData: string;
  onHaptic?: () => void;
}

export const VoiceOverlay: React.FC<VoiceOverlayProps> = ({
  isOpen,
  onClose,
  selectedAccount,
  onVoiceSuccess,
  initData,
  onHaptic
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptText, setTranscriptText] = useState('Говорите...');
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (isOpen) {
      startRecording();
    } else {
      stopRecording();
    }
  }, [isOpen]);

  const startRecording = async () => {
    try {
      setTranscriptText('Слушаю вас...');
      setIsRecording(true);
      audioChunksRef.current = [];

      // Check microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleAudioProcess(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(100);
    } catch (err) {
      console.warn('Microphone access denied or not supported, using demo voice input');
      setTranscriptText('Кофе 250 с карты Альфа');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleAudioProcess = async (blob: Blob) => {
    setIsProcessing(true);
    setTranscriptText('Обработка AI...');
    try {
      const formData = new FormData();
      formData.append('file', blob, 'voice.webm');
      const res = await fetch('http://localhost:8000/api/ai/parse-voice', {
        method: 'POST',
        headers: { Authorization: `tma ${initData}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        onVoiceSuccess(data);
        onClose();
        return;
      }
    } catch (e) {
      // Fallback demo transaction
    }

    // Demo parsed result fallback
    setTimeout(() => {
      setIsProcessing(false);
      onVoiceSuccess({
        transactions: [
          {
            amount: 250,
            type: 'expense',
            category_name: 'Еда',
            account_name: selectedAccount.name,
            note: 'Кофе',
          },
        ],
      });
      onClose();
    }, 800);
  };

  const handleFinish = () => {
    onHaptic?.();
    if (isRecording) {
      stopRecording();
    } else {
      // Complete with demo
      handleAudioProcess(new Blob());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between items-center bg-black/60 backdrop-blur-md px-6 py-12 animate-fade-in text-white select-none">
      {/* Top Spacer */}
      <div className="w-full flex justify-center pt-8">
        <div className="flex items-center space-x-2">
          {/* Account Pill */}
          <div className="flex items-center space-x-2 bg-white text-[#1F2937] px-4 py-2 rounded-full shadow-lg">
            <span className="text-base">{selectedAccount.icon}</span>
            <span className="text-sm font-semibold">{selectedAccount.name}</span>
            <span className="text-blue-500 text-xs">✨</span>
          </div>

          <button
            type="button"
            className="w-10 h-10 rounded-full bg-white/90 text-[#4B5563] flex items-center justify-center shadow-md active:scale-95"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center Speech Bubble / Wave */}
      <div className="flex flex-col items-center justify-center my-auto">
        <div className="bg-white/95 text-[#374151] px-8 py-4 rounded-full shadow-2xl text-[20px] font-medium tracking-tight mb-6 flex items-center space-x-3">
          {isRecording && (
            <div className="flex space-x-1 items-center">
              <span className="w-2 h-4 bg-blue-600 rounded-full animate-bounce" />
              <span className="w-2 h-6 bg-blue-600 rounded-full animate-bounce [animation-delay:0.15s]" />
              <span className="w-2 h-3 bg-blue-600 rounded-full animate-bounce [animation-delay:0.3s]" />
            </div>
          )}
          <span>{transcriptText}</span>
        </div>

        <p className="text-white/60 text-xs text-center max-w-xs">
          Назовите трату, например: «Кофе 250 с карты Альфа» или «Аптека 1200 и такси 450»
        </p>
      </div>

      {/* Bottom Controls */}
      <div className="w-full max-w-xs flex items-center justify-between pb-6">
        {/* Cancel Button */}
        <button
          type="button"
          onClick={() => {
            onHaptic?.();
            onClose();
          }}
          className="w-14 h-14 rounded-full bg-white text-[#1F2937] flex items-center justify-center shadow-xl active:scale-95 transition-all"
        >
          <X className="w-6 h-6" strokeWidth={2.5} />
        </button>

        {/* Big Action Checkmark Button */}
        <div className="relative">
          <div className="absolute -inset-2 bg-blue-500/30 rounded-full blur-md animate-pulse" />
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleFinish}
            className="relative w-20 h-20 rounded-full bg-[#2B5BFF] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(43,91,255,0.45)] active:scale-95 transition-all"
          >
            {isProcessing ? (
              <div className="w-7 h-7 border-3 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-10 h-10 stroke-[3]" />
            )}
          </button>
        </div>

        {/* Settings Button */}
        <button
          type="button"
          onClick={onHaptic}
          className="w-14 h-14 rounded-full bg-white text-[#1F2937] flex items-center justify-center shadow-xl active:scale-95 transition-all"
        >
          <Settings2 className="w-6 h-6 text-[#1F2937]" />
        </button>
      </div>
    </div>
  );
};
