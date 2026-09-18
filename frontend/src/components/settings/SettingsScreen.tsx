import React, { useState } from 'react';
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
  Check,
  AlertTriangle,
} from 'lucide-react';

interface SettingsScreenProps {
  onBack: () => void;
  onRecalculateBalances?: () => void;
  onResetData?: () => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

const CURRENCIES = ['RUB (₽)', 'USD ($)', 'EUR (€)', 'USDT (₮)'];
const AI_MODELS = ['Groq Llama 3.3', 'DeepSeek V3', 'OpenAI GPT-4o mini'];
const VOICE_ENGINES = ['Whisper Cloud (Groq)', 'Web Speech API (Browser)'];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  onRecalculateBalances,
  onResetData,
  onHaptic,
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('app_theme') as 'light' | 'dark') || 'light';
  });
  const [currencyIdx, setCurrencyIdx] = useState<number>(() => {
    const saved = localStorage.getItem('app_currency');
    const idx = CURRENCIES.findIndex((c) => c.startsWith(saved || 'RUB'));
    return idx >= 0 ? idx : 0;
  });
  const [lang, setLang] = useState<'Русский' | 'English'>(() => {
    return (localStorage.getItem('app_lang') as 'Русский' | 'English') || 'Русский';
  });
  const [scannerEnabled, setScannerEnabled] = useState<boolean>(() => {
    return localStorage.getItem('app_scanner') !== 'false';
  });
  const [aiModelIdx, setAiModelIdx] = useState<number>(0);
  const [voiceEngineIdx, setVoiceEngineIdx] = useState<number>(0);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  const handleToggleTheme = () => {
    onHaptic?.('medium');
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('app_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleNextCurrency = () => {
    onHaptic?.('light');
    const next = (currencyIdx + 1) % CURRENCIES.length;
    setCurrencyIdx(next);
    localStorage.setItem('app_currency', CURRENCIES[next].split(' ')[0]);
  };

  const handleToggleLang = () => {
    onHaptic?.('light');
    const next = lang === 'Русский' ? 'English' : 'Русский';
    setLang(next);
    localStorage.setItem('app_lang', next);
  };

  const handleToggleScanner = () => {
    onHaptic?.('light');
    const next = !scannerEnabled;
    setScannerEnabled(next);
    localStorage.setItem('app_scanner', next ? 'true' : 'false');
  };

  const handleNextAiModel = () => {
    onHaptic?.('light');
    setAiModelIdx((prev) => (prev + 1) % AI_MODELS.length);
  };

  const handleNextVoiceEngine = () => {
    onHaptic?.('light');
    setVoiceEngineIdx((prev) => (prev + 1) % VOICE_ENGINES.length);
  };

  const handleSync = async () => {
    onHaptic?.('medium');
    setIsSyncing(true);
    try {
      await onRecalculateBalances?.();
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2500);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirmReset = () => {
    onHaptic?.('heavy');
    setShowResetConfirm(false);
    onResetData?.();
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] flex flex-col justify-between pb-12 select-none animate-fade-in relative">
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

        <div className="flex items-center space-x-1 px-3 py-1 rounded-full bg-[#EDE9FE] text-[#7C3AED] text-xs font-bold shadow-sm">
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
            {/* Тема */}
            <button
              type="button"
              onClick={handleToggleTheme}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Palette className="w-4 h-4" />
                </div>
                <span className="text-[15px] font-medium text-[#111827]">Тема</span>
              </div>
              <div className="flex items-center space-x-1.5 text-[#2B5BFF] text-sm font-semibold">
                <span>{theme === 'light' ? '☀️ Светлая' : '🌙 Тёмная'}</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>

            {/* Валюта */}
            <button
              type="button"
              onClick={handleNextCurrency}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <span className="text-[15px] font-medium text-[#111827]">Основная валюта</span>
              </div>
              <div className="flex items-center space-x-1.5 text-[#111827] text-sm font-semibold">
                <span className="bg-[#EEF2FF] text-[#4338CA] px-2.5 py-0.5 rounded-full text-xs font-bold">
                  {CURRENCIES[currencyIdx]}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>

            {/* Язык */}
            <button
              type="button"
              onClick={handleToggleLang}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </div>
                <span className="text-[15px] font-medium text-[#111827]">Язык</span>
              </div>
              <div className="flex items-center space-x-1.5 text-[#6B7280] text-sm font-medium">
                <span>{lang}</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>
          </div>
        </div>

        {/* Group: ИИ и Распознавание */}
        <div>
          <h3 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2 ml-2">
            ИИ и Распознавание
          </h3>
          <div className="bg-white rounded-[22px] shadow-sm divide-y divide-gray-100 overflow-hidden border border-gray-100/80">
            {/* Голосовой ввод */}
            <button
              type="button"
              onClick={handleNextVoiceEngine}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[15px] font-medium text-[#111827] block">Голосовой ввод</span>
                  <span className="text-xs text-[#9CA3AF]">Whisper STT / Web API</span>
                </div>
              </div>
              <div className="flex items-center space-x-1 text-[#2B5BFF] text-xs font-semibold max-w-[140px] text-right truncate">
                <span>{VOICE_ENGINES[voiceEngineIdx]}</span>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              </div>
            </button>

            {/* Сканер чеков и QR */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ScanLine className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[15px] font-medium text-[#111827] block">Сканер чеков и QR</span>
                  <span className="text-xs text-[#9CA3AF]">Распознавание чеков с ФНС</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleScanner}
                className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                  scannerEnabled ? 'bg-[#2B5BFF]' : 'bg-gray-200'
                }`}
              >
                <div
                  className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                    scannerEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* AI-парсер */}
            <button
              type="button"
              onClick={handleNextAiModel}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[15px] font-medium text-[#111827] block">AI-движок</span>
                  <span className="text-xs text-[#9CA3AF]">Семантический разбор фраз</span>
                </div>
              </div>
              <div className="flex items-center space-x-1 text-[#111827] text-xs font-semibold">
                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-bold">
                  {AI_MODELS[aiModelIdx]}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              </div>
            </button>
          </div>
        </div>

        {/* Group: Данные */}
        <div>
          <h3 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2 ml-2">
            Данные и Синхронизация
          </h3>
          <div className="bg-white rounded-[22px] shadow-sm divide-y divide-gray-100 overflow-hidden border border-gray-100/80">
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleSync}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <span className="text-[15px] font-medium text-[#111827] block">
                    Пересчитать балансы счетов
                  </span>
                  <span className="text-xs text-[#9CA3AF]">
                    Сверить все транзакции и остатки
                  </span>
                </div>
              </div>
              {syncSuccess ? (
                <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full animate-fade-in">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Обновлено</span>
                </span>
              ) : (
                <ChevronRight className="w-4 h-4 text-[#8E8E93]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onHaptic?.('heavy');
                setShowResetConfirm(true);
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-red-50 active:bg-red-100 transition-colors text-left text-red-600"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[15px] font-medium block">Очистить кэш и сбросить</span>
                  <span className="text-xs text-red-400">Сбросить данные к начальным</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>

        {/* Group: Информация */}
        <div className="pt-2 text-center text-xs text-[#8E8E93] space-y-1">
          <div className="flex items-center justify-center space-x-1">
            <Info className="w-3.5 h-3.5" />
            <span>AI Финансы v1.2 • Groq Llama 3.3 Edition</span>
          </div>
          <p className="text-[11px] text-gray-400">Все данные зашифрованы и сохраняются локально</p>
        </div>
      </div>

      {/* Confirmation Modal for Reset */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm p-5 animate-fade-in">
          <div className="bg-white rounded-[28px] max-w-sm w-full p-6 shadow-2xl space-y-4 animate-slide-up text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#111827]">Сбросить данные?</h3>
              <p className="text-sm text-[#6B7280] mt-1.5">
                Локальные кэши будут очищены, а балансы и категории восстановлены к исходным значениям.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="py-3 px-4 rounded-xl bg-gray-100 text-[#374151] font-semibold text-sm active:bg-gray-200"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="py-3 px-4 rounded-xl bg-red-600 text-white font-semibold text-sm active:bg-red-700 shadow-sm"
              >
                Сбросить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
