import React, { useState } from 'react';
import {
  ArrowLeftOutlined,
  SyncOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  RightOutlined,
  CheckOutlined,
  WarningOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { Category } from '../../types';
import { CategoriesManagerModal } from '../modals/CategoriesManagerModal';

interface SettingsScreenProps {
  onBack: () => void;
  categories: Category[];
  onSaveCategory: (category: Partial<Category> & { id?: string }) => void;
  onDeleteCategory: (id: string) => void;
  onReorderCategories?: (categories: Category[]) => void;
  onRecalculateBalances?: () => Promise<void> | void;
  onResetData?: () => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  categories,
  onSaveCategory,
  onDeleteCategory,
  onReorderCategories,
  onRecalculateBalances,
  onResetData,
  onHaptic,
}) => {
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  const handleSync = async () => {
    onHaptic?.('medium');
    setIsSyncing(true);
    try {
      if (onRecalculateBalances) {
        await onRecalculateBalances();
      }
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2500);
    } catch (e) {
      console.error('Sync failed:', e);
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
      </div>

      {/* Main Settings List */}
      <div className="flex-1 px-5 max-w-lg mx-auto w-full space-y-6">
        {/* Group: Категории */}
        <div>
          <h3 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2 ml-2">
            Категории
          </h3>
          <div className="bg-white dark:bg-[#1A1B20] rounded-[22px] shadow-sm divide-y divide-gray-100 dark:divide-[#252730] overflow-hidden border border-gray-100/80 dark:border-[#252730]">
            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                setIsCategoriesModalOpen(true);
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#20222A] active:bg-gray-100 dark:active:bg-[#252730] transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <AppstoreOutlined className="text-[14px]" />
                </div>
                <div>
                  <span className="text-[15px] font-medium text-[#111827] dark:text-white block">
                    Управление категориями
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 text-[#2B5BFF] text-xs font-semibold">
                <span>{categories.length} шт.</span>
                <RightOutlined className="text-[12px] text-gray-400" />
              </div>
            </button>
          </div>
        </div>

        {/* Group: Данные и Синхронизация */}
        <div>
          <h3 className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2 ml-2">
            Данные и Синхронизация
          </h3>
          <div className="bg-white dark:bg-[#1A1B20] rounded-[22px] shadow-sm divide-y divide-gray-100 dark:divide-[#252730] overflow-hidden border border-gray-100/80 dark:border-[#252730]">
            {/* Синхронизировать */}
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleSync}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#20222A] active:bg-gray-100 dark:active:bg-[#252730] transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <SyncOutlined className={`text-[14px] ${isSyncing ? 'animate-spin text-[#2B5BFF]' : ''}`} />
                </div>
                <div>
                  <span className="text-[15px] font-medium text-[#111827] dark:text-white block">
                    Синхронизировать данные
                  </span>
                  <span className="text-xs text-[#9CA3AF] dark:text-[#8E92A4]">
                    Сверить балансы счетов и транзакции
                  </span>
                </div>
              </div>
              {syncSuccess ? (
                <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full animate-fade-in">
                  <CheckOutlined className="text-[12px]" />
                  <span>Синхронизировано</span>
                </span>
              ) : (
                <RightOutlined className="text-[12px] text-[#8E8E93]" />
              )}
            </button>

            {/* Удалить всё */}
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
                  <span className="text-[15px] font-medium block">Удалить все данные</span>
                  <span className="text-xs text-red-400">Сбросить транзакции, кэш и начать с нуля</span>
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
            <span>AI Финансы • Безопасное хранение</span>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Все данные защищены и синхронизируются в реальном времени
          </p>
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
              <h3 className="text-lg font-bold text-[#111827] dark:text-white">Удалить все данные?</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#8E92A4] mt-1.5 leading-relaxed">
                Все локальные транзакции, изменения счетов и кэш будут полностью очищены. Вы сможете начать учёт с чистого листа.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="py-3 px-4 rounded-xl bg-gray-100 dark:bg-[#252730] text-[#374151] dark:text-white font-semibold text-sm active:bg-gray-200 dark:active:bg-[#2F323D] transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="py-3 px-4 rounded-xl bg-red-600 text-white font-semibold text-sm active:bg-red-700 shadow-sm transition-colors hover:bg-red-700"
              >
                Удалить всё
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categories Manager Modal */}
      <CategoriesManagerModal
        isOpen={isCategoriesModalOpen}
        onClose={() => setIsCategoriesModalOpen(false)}
        categories={categories}
        onSaveCategory={onSaveCategory}
        onDeleteCategory={onDeleteCategory}
        onReorderCategories={onReorderCategories}
        onHaptic={onHaptic}
      />
    </div>
  );
};
