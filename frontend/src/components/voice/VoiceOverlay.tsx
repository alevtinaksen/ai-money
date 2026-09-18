import React, { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';
import { Account } from '../../types';

interface VoiceOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAccount: Account;
  onVoiceSuccess: (parsedResult: any) => void;
  initData: string;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
  onOpenAccountSelect?: () => void;
}

export const VoiceOverlay: React.FC<VoiceOverlayProps> = ({
  isOpen,
  onClose,
  selectedAccount,
  onVoiceSuccess,
  onHaptic,
  onOpenAccountSelect,
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
      setTranscriptText('Говорите...');
      setIsRecording(true);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsProcessing(true);
        setTranscriptText('Обрабатываю...');
        stream.getTracks().forEach((t) => t.stop());
        
        // Demo/fallback recognition simulation
        setTimeout(() => {
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
          setIsProcessing(false);
          onClose();
        }, 600);
      };

      recorder.start(100);
    } catch (err) {
      console.warn('Microphone error or permission denied, using speech prompt');
      setTranscriptText('Говорите...');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleFinish = () => {
    onHaptic?.('heavy');
    if (isRecording) {
      stopRecording();
    } else {
      setIsProcessing(true);
      setTranscriptText('Обрабатываю...');
      setTimeout(() => {
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
        setIsProcessing(false);
        onClose();
      }, 500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between items-center bg-black/35 backdrop-blur-[3px] px-6 pb-8 pt-12 animate-fade-in select-none">
      {/* Top Space (Dashboard is visible underneath with blur) */}
      <div className="w-full flex-1" onClick={onClose} />

      {/* Center Interactive Section: Speech Bubble & Account Pill */}
      <div className="w-full max-w-sm flex flex-col items-center space-y-4 mb-6">
        {/* Account Pill with Sparkles */}
        <button
          type="button"
          onClick={() => {
            onHaptic?.('light');
            onOpenAccountSelect?.();
          }}
          className="flex items-center space-x-2 bg-white px-4 py-2 rounded-full shadow-md text-[#111827] active:scale-95 transition-all"
        >
          <span className="text-base">{selectedAccount.icon || '❤️'}</span>
          <span className="text-[14px] font-semibold">{selectedAccount.name}</span>
          <span className="text-[#2B5BFF] text-xs font-bold">✨</span>
        </button>

        {/* Speech Bubble («Говорите...») */}
        <div className="bg-white px-7 py-3 rounded-full shadow-lg flex items-center space-x-2">
          {isRecording && (
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          )}
          <span className="text-[17px] font-medium text-[#6B7280]">
            {transcriptText}
          </span>
        </div>
      </div>

      {/* Bottom Floating Control Bar (Pixel-perfect matching Screenshot 5) */}
      <div className="w-full max-w-xs flex items-center justify-between px-4 pb-2">
        {/* Close Button (Left) */}
        <button
          type="button"
          onClick={() => {
            onHaptic?.('light');
            onClose();
          }}
          className="w-13 h-13 p-3.5 rounded-full bg-white text-[#111827] shadow-[0_4px_16px_rgba(0,0,0,0.12)] flex items-center justify-center active:scale-90 transition-all border border-gray-100"
        >
          <X className="w-6 h-6 stroke-[2.2]" />
        </button>

        {/* Big Action Checkmark Button (Center) */}
        <div className="relative">
          <div className="absolute -inset-1.5 bg-[#2B5BFF]/30 rounded-full blur-md" />
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleFinish}
            className="relative w-18 h-18 p-4 rounded-full bg-[#2B5BFF] text-white shadow-[0_8px_24px_rgba(43,91,255,0.45)] flex items-center justify-center active:scale-95 transition-all"
          >
            {isProcessing ? (
              <div className="w-7 h-7 border-3 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-9 h-9 stroke-[3]" />
            )}
          </button>
        </div>

        {/* Balanced spacer so center button remains perfectly centered */}
        <div className="w-13 h-13 pointer-events-none" />
      </div>
    </div>
  );
};
