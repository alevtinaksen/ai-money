import React, { useState } from 'react';
import {
  ArrowLeftOutlined,
  BgColorsOutlined,
  DollarOutlined,
  GlobalOutlined,
  AudioOutlined,
  ScanOutlined,
  ApiOutlined,
  SyncOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  RightOutlined,
  ThunderboltOutlined,
  CheckOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../context/ThemeContext';

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
  const { mode, setMode } = useTheme();
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
    // cycle: light -> dark -> auto -> light
    if (mode === 'light') {
      setMode('dark');
    } else if (mode === 'dark') {
      setMode('auto');
    } else {
      setMode('light');
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
    <div className="min-h-screen bg-[#F6F7FB] dark:bg-[#121318] flex flex-col justify-between pb-12 select-none animate-fade-in relative transition-colors">
      {/* Top Header */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              onBack();
            }}
            className="w-10 h-10 rounded-full bg-white dark:bg-[#1A1B20] shadow-sm flex items-center justify-center text-[#111827] dark:text-white active:bg-[#F3F4F6] dark:active:bg-[#252730] border border-gray-100 dark:border-[#252730]"
          >
            <ArrowLeftOutlined className="text-[18px]" />
          </button>
          <h1 className="text-[24px] font-bold text-[#111827] dark:text-white tracking-tight">
            Настройки
          </h1>
        </div>

        <div className="flex items-center space-x-1 px-3 py-1 rounded-full bg-[#EDE9FE] dark:bg-[#2D1B69] text-[#7C3AED] dark:text-[#A78BFA] text-xs font-bold shadow-sm">
          <ThunderboltOutlined className="text-[12px]" />
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
          <div className="bg-white dark:bg-[#1A1B20] rounded-[22px] shadow-sm divide-y divide-gray-100 dark:divide-[#252730] overflow-hidden border border-gray-100/80 dark:border-[#252730]">
            {/* Тема */}
            <button
              type="button"
              onClick={handleToggleTheme}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#20222A] active:bg-gray-100 dark:active:bg-[#252730] transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <BgColorsOutlined className="text-[14px]" />
                </div>
                <span className="text-[15px] font-medium text-[#111827] dark:text-white">Тема</span>
              </div>
              <div className="flex items-center space-x-1.5 text-[#2B5BFF] text-sm font-semibold">
                <span>{mode === 'light' ? '☀️ Светлая' : mode === 'dark' ? '🌙 Тёмная' : '🤖 Авто'}</span>
                <RightOutlined className="text-[12px] text-gray-400" />
              </div>
            </button>

            {/* Валюта */}
            <button
              type="button"
              onClick={handleNextCurrency}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#20222A] active:bg-gray-100 dark:active:bg-[#252730] transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <DollarOutlined className="text-[14px]" />
                </div>
                <span className="text-[15px] font-medium text-[#111827] dark:text-white">Основная валюта</span>
              </div>
              <div className="flex items-center space-x-1.5 text-[#111827] dark:text-white text-sm font-semibold">
                <span className="bg-[#EEF2FF] dark:bg-[#252B48] text-[#4338CA] dark:text-[#818CF8] px-2.5 py-0.5 rounded-full text-xs font-bold">
                  {CURRENCIES[currencyIdx]}
                </span>
                <RightOutlined className="text-[12px] text-gray-400" />
              </div>
            </button>

            {/* Язык */}
            <button
              type="button"
              onClick={handleToggleLang}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#20222A] active:bg-gray-100 dark:active:bg-[#252730] transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <GlobalOutlined className="text-[14px]" />
                </div>
                <span className="text-[15px] font-medium text-[#111827] dark:text-white">Язык</span>
              </div>
              <div className="flex items-center space-x-1.5 text-[#6B7280] dark:text-[#8E92A4] text-sm font-medium">
                <span>{lang}</span>
                <RightOutlined className="text-[12px] text-gray-400" />
              </div>
            </button>
          </div>
        </div>

        {/* Group: ИИ и Распознавание */}
        <div>
          <h3 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2 ml-2">
            ИИ и Распознавание
          </h3>
          <div className="bg-white dark:bg-[#1A1B20] rounded-[22px] shadow-sm divide-y divide-gray-100 dark:divide-[#252730] overflow-hidden border border-gray-100/80 dark:border-[#252730]">
            {/* Голосовой ввод */}
            <button
              type="button"
              onClick={handleNextVoiceEngine}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#20222A] active:bg-gray-100 dark:active:bg-[#252730] transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <AudioOutlined className="text-[14px]" />
                </div>
                <div>
                  <span className="text-[15px] font-medium text-[#111827] dark:text-white block">Голосовой ввод</span>
                  <span className="text-xs text-[#9CA3AF] dark:text-[#8E92A4]">Whisper STT / Web API</span>
                </div>
              </div>
              <div className="flex items-center space-x-1 text-[#2B5BFF] text-xs font-semibold max-w-[140px] text-right truncate">
                <span>{VOICE_ENGINES[voiceEngineIdx]}</span>
                <RightOutlined className="text-[12px] text-gray-400 shrink-0" />
              </div>
            </button>

            {/* Сканер чеков и QR */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ScanOutlined className="text-[14px]" />
                </div>
                <div>
                  <span className="text-[15px] font-medium text-[#111827] dark:text-white block">Сканер чеков и QR</span>
                  <span className="text-xs text-[#9CA3AF] dark:text-[#8E92A4]">Распознавание чеков с ФНС</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleScanner}
                className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                  scannerEnabled ? 'bg-[#2B5BFF]' : 'bg-gray-200 dark:bg-[#252730]'
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
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#20222A] active:bg-gray-100 dark:active:bg-[#252730] transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <ApiOutlined className="text-[14px]" />
                </div>
                <div>
                  <span className="text-[15px] font-medium text-[#111827] dark:text-white block">AI-движок</span>
                  <span className="text-xs text-[#9CA3AF] dark:text-[#8E92A4]">Семантический разбор фраз</span>
                </div>
              </div>
              <div className="flex items-center space-x-1 text-[#111827] dark:text-white text-xs font-semibold">
                <span className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-md font-bold">
                  {AI_MODELS[aiModelIdx]}
                </span>
                <RightOutlined className="text-[12px] text-gray-400 shrink-0" />
              </div>
            </button>
          </div>
        </div>

        {/* Group: Данные */}
        <div>
          <h3 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2 ml-2">
            Данные и Синхронизация
          </h3>
          <div className="bg-white dark:bg-[#1A1B20] rounded-[22px] shadow-sm divide-y divide-gray-100 dark:divide-[#252730] overflow-hidden border border-gray-100/80 dark:border-[#252730]">
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleSync}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#20222A] active:bg-gray-100 dark:active:bg-[#252730] transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <SyncOutlined className={`text-[14px] ${isSyncing ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <span className="text-[15px] font-medium text-[#111827] dark:text-white block">
                    Пересчитать балансы счетов
                  </span>
                  <span className="text-xs text-[#9CA3AF] dark:text-[#8E92A4]">
                    Сверить все транзакции и остатки
                  </span>
                </div>
              </div>
              {syncSuccess ? (
                <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full animate-fade-in">
                  <CheckOutlined className="text-[12px]" />
                  <span>Обновлено</span>
                </span>
              ) : (
                <RightOutlined className="text-[12px] text-[#8E8E93]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onHaptic?.('heavy');
                setShowResetConfirm(true);
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-red-50 dark:hover:bg-red-950/30 active:bg-red-100 dark:active:bg-red-900/40 transition-colors text-left text-red-600 dark:text-red-400"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <DeleteOutlined className="text-[14px]" />
                </div>
                <div>
                  <span className="text-[15px] font-medium block">Очистить кэш и сбросить</span>
                  <span className="text-xs text-red-400">Сбросить данные к начальным</span>
                </div>
              </div>
              <RightOutlined className="text-[12px] text-red-400" />
            </button>
          </div>
        </div>

        {/* Group: Информация */}
        <div className="pt-2 text-center text-xs text-[#8E8E93] space-y-1">
          <div className="flex items-center justify-center space-x-1">
            <InfoCircleOutlined className="text-[12px]" />
            <span>AI Финансы v1.2 • Groq Llama 3.3 Edition</span>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">Все данные зашифрованы и сохраняются локально</p>
        </div>
      </div>

      {/* Confirmation Modal for Reset */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm p-5 animate-fade-in">
          <div className="bg-white dark:bg-[#1A1B20] rounded-[28px] max-w-sm w-full p-6 shadow-2xl space-y-4 animate-slide-up text-center border border-gray-100 dark:border-[#252730]">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <WarningOutlined className="text-[22px]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#111827] dark:text-white">Сбросить данные?</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#8E92A4] mt-1.5">
                Локальные кэши будут очищены, а балансы и категории восстановлены к исходным значениям.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="py-3 px-4 rounded-xl bg-gray-100 dark:bg-[#252730] text-[#374151] dark:text-white font-semibold text-sm active:bg-gray-200 dark:active:bg-[#2F323D]"
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
