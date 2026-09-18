import React, { useState } from 'react';
import {
  ArrowLeftOutlined,
  CloseOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  RightOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Category } from '../../types';

interface CategoriesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSaveCategory: (category: Partial<Category> & { id?: string }) => void;
  onDeleteCategory: (id: string) => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

const EMOJI_PALETTE = [
  '🍔', '🍽️', '☕', '🛴', '🍕', '🍣', '🍰', '🍏',
  '🚗', '🚕', '🚙', '🚘', '🚌', '🚆', '⛽', '🔧',
  '🛍️', '👗', '👟', '💻', '📱', '🎧', '🧼', '🎨',
  '🎬', '🍿', '🎮', '🎉', '🎟️', '🎳', '🎪', '⚽',
  '💊', '🩺', '🧠', '🦷', '🧴', '💉', '🌿', '🏋️',
  '🏠', '🔑', '💡', '🔨', '🛋️', '📦', '🧹', '🪴',
  '👤', '✨', '💄', '💅', '💇', '🧖', '🏃', '🕶️',
  '✈️', '🏖️', '🏨', '🗺️', '🚆', '🧳', '🚢', '🗽',
  '🐱', '🐶', '🐟', '🐾', '🦜', '🐹', '🐰', '🦴',
  '💿', '🎵', '📺', '☁️', '📰', '📚', '🎙️', '🔔',
  '🎁', '🎈', '💐', '🎂', '💌', '🧸', '🍫', '🍷',
  '🏦', '💰', '💸', '📈', '🪙', '💳', '💵', '💎',
];

export const CategoriesManagerModal: React.FC<CategoriesManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  onSaveCategory,
  onDeleteCategory,
  onHaptic,
}) => {
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');

  // Navigation: null = list screen, Category / 'new' = editor screen
  const [editingCategory, setEditingCategory] = useState<Category | 'new' | null>(null);

  // Editor form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'expense' | 'income' | 'both'>('expense');
  const [formIcon, setFormIcon] = useState('🍔');
  const [formSubcategories, setFormSubcategories] = useState<string[]>([]);
  const [newSubcatInput, setNewSubcatInput] = useState('');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen) return null;

  // Filter categories for the current tab
  const displayCategories = categories.filter((c) => {
    if (activeTab === 'expense') {
      return c.type === 'expense' || c.type === 'both';
    }
    return c.type === 'income' || c.type === 'both';
  });

  const handleOpenCreate = () => {
    onHaptic?.('light');
    setEditingCategory('new');
    setFormName('');
    setFormType(activeTab);
    setFormIcon(activeTab === 'income' ? '💰' : '🛍️');
    setFormSubcategories([]);
    setNewSubcatInput('');
    setIsEmojiPickerOpen(false);
  };

  const handleOpenEdit = (cat: Category) => {
    onHaptic?.('light');
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormType(cat.type || 'expense');
    setFormIcon(cat.icon || '🍔');
    setFormSubcategories(cat.subcategories ? [...cat.subcategories] : []);
    setNewSubcatInput('');
    setIsEmojiPickerOpen(false);
  };

  const handleCloseEditor = () => {
    onHaptic?.('light');
    setEditingCategory(null);
    setIsEmojiPickerOpen(false);
    setShowDeleteConfirm(false);
  };

  const handleAddSubcategory = () => {
    const trimmed = newSubcatInput.trim();
    if (!trimmed) return;
    if (formSubcategories.includes(trimmed)) return;
    onHaptic?.('light');
    setFormSubcategories((prev) => [...prev, trimmed]);
    setNewSubcatInput('');
  };

  const handleRemoveSubcategory = (sub: string) => {
    onHaptic?.('light');
    setFormSubcategories((prev) => prev.filter((s) => s !== sub));
  };

  const handleSave = () => {
    if (!formName.trim()) return;
    onHaptic?.('heavy');
    onSaveCategory({
      id: editingCategory !== 'new' && editingCategory ? editingCategory.id : undefined,
      name: formName.trim(),
      type: formType,
      icon: formIcon,
      subcategories: formSubcategories,
    });
    handleCloseEditor();
  };

  const handleConfirmDelete = () => {
    if (editingCategory === 'new' || !editingCategory) return;
    onHaptic?.('heavy');
    onDeleteCategory(editingCategory.id);
    setShowDeleteConfirm(false);
    handleCloseEditor();
  };

  return (
    <div className="fixed inset-0 z-[85] bg-[#121318] text-white flex flex-col animate-fade-in select-none overflow-hidden">
      {/* ===================== VIEW 2: EDIT / CREATE CATEGORY SCREEN ===================== */}
      {editingCategory ? (
        <div className="flex-1 flex flex-col justify-between h-full overflow-y-auto px-5 pt-12 pb-8 max-w-lg mx-auto w-full animate-slide-up">
          <div>
            {/* Top Bar */}
            <div className="flex items-center space-x-3 mb-4">
              <button
                type="button"
                onClick={handleCloseEditor}
                className="w-11 h-11 rounded-full bg-[#1C1D24] text-white flex items-center justify-center border border-white/5 shadow-sm active:scale-95 transition-transform"
              >
                <CloseOutlined className="text-[17px]" />
              </button>
              <h1 className="text-[22px] font-bold text-white tracking-tight">
                {editingCategory === 'new' ? 'Новая категория' : 'Редактировать категорию'}
              </h1>
            </div>

            {/* Avatar with Edit Badge */}
            <div className="flex justify-center my-4">
              <div
                onClick={() => {
                  onHaptic?.('light');
                  setIsEmojiPickerOpen(true);
                }}
                className={`w-24 h-24 rounded-full bg-[#261E23] relative flex items-center justify-center cursor-pointer shadow-lg active:scale-95 transition-all border-2 ${
                  formType === 'income'
                    ? 'border-emerald-500/50'
                    : formType === 'both'
                    ? 'border-blue-500/50'
                    : 'border-[#FF5757]/50'
                }`}
              >
                <span className="text-[44px]">{formIcon}</span>
                <div
                  className={`w-7 h-7 rounded-full text-white flex items-center justify-center absolute bottom-0 right-0 shadow-md border-2 border-[#121318] ${
                    formType === 'income'
                      ? 'bg-[#10B981]'
                      : formType === 'both'
                      ? 'bg-[#2B5BFF]'
                      : 'bg-[#FF5757]'
                  }`}
                >
                  <EditOutlined className="text-[12px]" />
                </div>
              </div>
            </div>

            {/* 3-Way Segmented Switch: [ ↓ Расход ] [ ↑ Доход ] [ ⇅ Оба ] */}
            <div className="flex items-center justify-center space-x-2.5 my-5">
              <button
                type="button"
                onClick={() => {
                  onHaptic?.('light');
                  setFormType('expense');
                }}
                className={`py-2.5 px-4 rounded-full text-sm font-semibold flex items-center space-x-1.5 transition-all active:scale-95 ${
                  formType === 'expense'
                    ? 'bg-[#FF5757] text-white shadow-md'
                    : 'bg-[#1C1D24] border border-white/5 text-[#8E92A4]'
                }`}
              >
                <span className={formType === 'expense' ? 'text-white' : 'text-[#FF5757]'}>↓</span>
                <span>Расход</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onHaptic?.('light');
                  setFormType('income');
                }}
                className={`py-2.5 px-4 rounded-full text-sm font-semibold flex items-center space-x-1.5 transition-all active:scale-95 ${
                  formType === 'income'
                    ? 'bg-[#10B981] text-white shadow-md'
                    : 'bg-[#1C1D24] border border-white/5 text-[#8E92A4]'
                }`}
              >
                <span className={formType === 'income' ? 'text-white' : 'text-[#10B981]'}>↑</span>
                <span>Доход</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onHaptic?.('light');
                  setFormType('both');
                }}
                className={`py-2.5 px-4 rounded-full text-sm font-semibold flex items-center space-x-1.5 transition-all active:scale-95 ${
                  formType === 'both'
                    ? 'bg-[#2B5BFF] text-white shadow-md'
                    : 'bg-[#1C1D24] border border-white/5 text-[#8E92A4]'
                }`}
              >
                <span className={formType === 'both' ? 'text-white' : 'text-[#2B5BFF]'}>⇅</span>
                <span>Оба</span>
              </button>
            </div>

            {/* Name Input */}
            <div className="bg-[#1C1D24] border border-white/5 rounded-[18px] px-4 py-3.5 flex items-center space-x-3 mb-5">
              <EditOutlined className="text-gray-400 text-[16px]" />
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Название категории"
                className="bg-transparent text-white font-semibold text-[16px] outline-none flex-1 placeholder:text-gray-600"
              />
            </div>

            {/* Subcategories Section */}
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2 px-1">
                <span className="text-[15px] font-semibold text-gray-200">Подкатегории</span>
                <span className="text-sm text-gray-500 font-medium">({formSubcategories.length})</span>
              </div>

              {/* Add Subcategory Bar */}
              <div className="bg-[#1C1D24] border border-white/5 rounded-[18px] p-1.5 pl-4 flex items-center justify-between mb-3">
                <input
                  type="text"
                  value={newSubcatInput}
                  onChange={(e) => setNewSubcatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubcategory();
                    }
                  }}
                  placeholder="Добавить подкатегорию..."
                  className="bg-transparent text-white text-[15px] outline-none flex-1 placeholder:text-gray-500"
                />
                <button
                  type="button"
                  onClick={handleAddSubcategory}
                  className="w-9 h-9 rounded-xl bg-[#2C242E] text-[#FF5757] flex items-center justify-center active:scale-95 transition-transform"
                >
                  <PlusOutlined className="text-[15px]" />
                </button>
              </div>

              {/* Subcategories Chips */}
              <div className="flex flex-wrap gap-2 pt-1">
                {formSubcategories.map((sub) => (
                  <div
                    key={sub}
                    className="bg-[#1E212D] text-white px-3.5 py-2 rounded-2xl flex items-center space-x-2 text-sm font-medium border border-white/5 shadow-sm"
                  >
                    <span>{sub}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubcategory(sub)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <CloseOutlined className="text-[11px]" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Delete Category Button (when editing existing category) */}
            {editingCategory !== 'new' && (
              <button
                type="button"
                onClick={() => {
                  onHaptic?.('heavy');
                  setShowDeleteConfirm(true);
                }}
                className="w-full py-3.5 rounded-[18px] bg-[#2E1A22] border border-red-500/20 text-[#FF5757] font-semibold text-[15px] flex items-center justify-center space-x-2 active:bg-[#381E28] transition-colors mt-6"
              >
                <DeleteOutlined className="text-[16px]" />
                <span>Удалить категорию</span>
              </button>
            )}
          </div>

          {/* Bottom Save Button */}
          <div className="pt-6">
            <button
              type="button"
              disabled={!formName.trim()}
              onClick={handleSave}
              className={`w-full py-4 rounded-[22px] font-bold text-[17px] shadow-lg transition-all active:scale-[0.99] ${
                formType === 'income'
                  ? 'bg-[#10B981] hover:bg-[#059669] text-white shadow-emerald-500/25'
                  : formType === 'both'
                  ? 'bg-[#2B5BFF] hover:bg-[#1E4BEB] text-white shadow-blue-500/25'
                  : 'bg-[#FF5757] hover:bg-[#FF4545] text-white shadow-red-500/25'
              }`}
            >
              Сохранить
            </button>
          </div>
        </div>
      ) : (
        /* ===================== VIEW 1: CATEGORIES LIST SCREEN ===================== */
        <div className="flex-1 flex flex-col h-full overflow-hidden px-5 pt-12 pb-6 max-w-lg mx-auto w-full">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => {
                  onHaptic?.('light');
                  onClose();
                }}
                className="w-11 h-11 rounded-full bg-[#1C1D24] text-white flex items-center justify-center border border-white/5 shadow-sm active:scale-95 transition-transform"
              >
                <ArrowLeftOutlined className="text-[18px]" />
              </button>
              <h1 className="text-[24px] font-bold text-white tracking-tight">
                Категории
              </h1>
            </div>

            <div className="flex items-center space-x-2.5">
              {/* Sort button */}
              <button
                type="button"
                onClick={() => onHaptic?.('light')}
                className="w-11 h-11 rounded-full bg-[#1C1D24] text-white flex items-center justify-center border border-white/5 active:scale-95 transition-transform"
              >
                <UnorderedListOutlined className="text-[17px]" />
              </button>

              {/* Add category button with rocket badge */}
              <button
                type="button"
                onClick={handleOpenCreate}
                className="w-11 h-11 rounded-full bg-[#2A2346] text-white flex items-center justify-center relative border border-purple-500/30 active:scale-95 transition-transform shadow-md"
              >
                <PlusOutlined className="text-[18px]" />
                <span className="absolute -top-1 -right-1 text-[12px] leading-none">🚀</span>
              </button>
            </div>
          </div>

          {/* Tab Switch: Расход / Доход */}
          <div className="bg-[#181920] p-1.5 rounded-[22px] flex border border-white/5 mb-4 shrink-0">
            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                setActiveTab('expense');
              }}
              className={`flex-1 py-2.5 rounded-[18px] text-[15px] font-bold transition-all ${
                activeTab === 'expense'
                  ? 'bg-[#2B5BFF] text-white shadow-md'
                  : 'text-[#8E92A4] hover:text-white'
              }`}
            >
              Расход
            </button>
            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                setActiveTab('income');
              }}
              className={`flex-1 py-2.5 rounded-[18px] text-[15px] font-bold transition-all ${
                activeTab === 'income'
                  ? 'bg-[#2B5BFF] text-white shadow-md'
                  : 'text-[#8E92A4] hover:text-white'
              }`}
            >
              Доход
            </button>
          </div>

          {/* List of Categories */}
          <div className="flex-1 overflow-y-auto space-y-3 pb-8 pr-0.5">
            {displayCategories.map((cat) => (
              <div
                key={cat.id}
                onClick={() => handleOpenEdit(cat)}
                className="w-full bg-[#1C1D24] hover:bg-[#23252E] rounded-[22px] p-4 flex items-center justify-between border border-white/5 active:scale-[0.99] transition-all cursor-pointer"
              >
                {/* Left Icon + Text */}
                <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-[18px] bg-[#14151C] flex items-center justify-center text-[24px] shrink-0 shadow-inner">
                    {cat.icon || '📦'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[17px] font-bold text-white tracking-tight leading-tight truncate">
                      {cat.name}
                    </h4>
                    {cat.subcategories && cat.subcategories.length > 0 && (
                      <span className="text-[13px] text-[#8E92A4] block mt-0.5 font-medium">
                        {cat.subcategories.length} подкатегорий
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Arrow */}
                <RightOutlined className="text-[13px] text-gray-500 shrink-0 ml-2" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== EMOJI PICKER SHEET ===================== */}
      {isEmojiPickerOpen && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-[#181920] rounded-t-[32px] pt-4 pb-8 px-5 shadow-2xl border-t border-white/10 animate-slide-up max-h-[60vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
              <h3 className="text-[17px] font-bold text-white">Выберите иконку</h3>
              <button
                type="button"
                onClick={() => setIsEmojiPickerOpen(false)}
                className="w-8 h-8 rounded-full bg-[#242630] text-gray-300 flex items-center justify-center active:scale-95"
              >
                <CloseOutlined className="text-[14px]" />
              </button>
            </div>
            <div className="grid grid-cols-8 gap-2 overflow-y-auto py-2">
              {EMOJI_PALETTE.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onHaptic?.('light');
                    setFormIcon(emoji);
                    setIsEmojiPickerOpen(false);
                  }}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center text-[24px] active:scale-90 transition-all ${
                    formIcon === emoji ? 'bg-[#2B5BFF]/30 border border-[#2B5BFF]' : 'hover:bg-white/5'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================== DELETE CONFIRMATION MODAL ===================== */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/60 backdrop-blur-sm p-5 animate-fade-in">
          <div className="bg-[#1C1D24] rounded-[28px] max-w-sm w-full p-6 shadow-2xl space-y-4 text-center border border-white/10 animate-slide-up">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-[#FF5757] flex items-center justify-center mx-auto text-xl">
              <DeleteOutlined />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Удалить категорию?</h3>
              <p className="text-sm text-gray-400 mt-1.5">
                Категория «{formName}» и все её подкатегории будут удалены.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="py-3 px-4 rounded-xl bg-[#252834] text-white font-semibold text-sm active:bg-[#2F3240]"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="py-3 px-4 rounded-xl bg-[#FF5757] text-white font-semibold text-sm active:bg-red-600 shadow-sm"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
