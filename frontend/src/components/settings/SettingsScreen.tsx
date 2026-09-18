import React from 'react';
import {
  ArrowLeft,
  Palette,
  RefreshCw,
  Globe,
  Mic,
  ScanLine,
  Cpu,
  Trash2,
  Info,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface SettingsScreenProps {
  onBack: () => void;
  onRecalculateBalances?: () => void;
  onResetData?: () => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  onRecalculateBalances,
  onResetData,
  onHaptic,
}) => {
  return (
    <div className="min-h-screen bg-[#F6F7FB] flex flex-col justify-between pb-12 select-none animate-fade-in">
      {/* Top Header */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              onBack();
            }}
            className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[#111827] active:bg-[#F3F4F6]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[24px] font-bold text-[#111827] tracking-tight">
            Настройки
          </h1>
        </div>

        <div className="flex items-center space-x-1 px-3 py-1 rounded-full bg-[#EDE9FE] text-[#7C3AED] text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Pro</span>
        </div>
      </div>

      {/* Main Settings List */}
      <div className="flex-1 px-5 max-w-lg mx-auto w-full space-y-6">
        {/* Group: Общие */}
        <div>
          <h3 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2 ml-2">
            Общие
          </h3>
          <div className="bg-white rounded-[22px] shadow-sm divide-y divide-gray-100 overflow-hidden border border-gray-100/80">
            <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Palette className="w-4 h-4" />
                </div>
                <span className="text-[15px] font-medium text-[#111827]">Тема</span>
              </div>
              <div className="flex items-center space-x-1 text-[#8E8E93] text-sm">
                <span>Светлая</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <span className="text-[15px] font-medium text-[#111827]">Валюта</span>
              </div>
              <div className="flex items-center space-x-1 text-[#8E8E93] text-sm">
                <span>RUB (₽)</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </div>
                <span className="text-[15px] font-medium text-[#111827]">Язык</span>
              </div>
              <div className="flex items-center space-x-1 text-[#8E8E93] text-sm">
                <span>Русский</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Group: ИИ */}
        <div>
          <h3 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2 ml-2">
            ИИ и Распознавание
          </h3>
          <div className="bg-white rounded-[22px] shadow-sm divide-y divide-gray-100 overflow-hidden border border-gray-100/80">
            <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Mic className="w-4 h-4" />
                </div>
                <span className="text-[15px] font-medium text-[#111827]">Голосовой ввод</span>
              </div>
              <div className="flex items-center space-x-1 text-[#8E8E93] text-sm">
                <span>ru-RU (Whisper)</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ScanLine className="w-4 h-4" />
                </div>
                <span className="text-[15px] font-medium text-[#111827]">Сканер чеков и QR</span>
              </div>
              <div className="flex items-center space-x-1 text-emerald-600 font-semibold text-sm">
                <span>Включен</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Cpu className="w-4 h-4" />
                </div>
                <span className="text-[15px] font-medium text-[#111827]">AI-парсер</span>
              </div>
              <div className="flex items-center space-x-1 text-[#8E8E93] text-sm">
                <span>Groq Llama 3.3</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Group: Данные */}
        <div>
          <h3 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2 ml-2">
            Данные
          </h3>
          <div className="bg-white rounded-[22px] shadow-sm divide-y divide-gray-100 overflow-hidden border border-gray-100/80">
            <button
              type="button"
              onClick={() => {
                onHaptic?.('medium');
                onRecalculateBalances?.();
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <span className="text-[15px] font-medium text-[#111827]">
                  Пересчитать балансы счетов
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8E8E93]" />
            </button>

            <button
              type="button"
              onClick={() => {
                onHaptic?.('heavy');
                onResetData?.();
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-red-50 transition-colors text-left text-red-600"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <span className="text-[15px] font-medium">Стереть все данные</span>
              </div>
              <ChevronRight className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>

        {/* Group: Информация */}
        <div className="pt-2 text-center text-xs text-[#8E8E93]">
          <div className="flex items-center justify-center space-x-1 mb-1">
            <Info className="w-3.5 h-3.5" />
            <span>AI Финансы v1.0 • 100% Free Personal Edition</span>
          </div>
        </div>
      </div>
    </div>
  );
};
