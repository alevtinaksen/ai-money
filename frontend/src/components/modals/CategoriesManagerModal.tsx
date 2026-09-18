import React, { useState } from 'react';
import {
  CloseOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
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

const POPULAR_EMOJIS = [
  '🍔', '🍽️', '☕', '🛴', '🚗', '🚕', '🚘', '⛽',
  '🛍️', '👗', '💻', '🎬', '🍿', '🎮', '💊', '🩺',
  '🏠', '💡', '✨', '💄', '🏃', '🐱', '✈️', '💿',
  '🎁', '🏦', '💸', '💰', '📦', '📱', '🎨', '🍕',
];

const PASTEL_COLORS = [
  '#FEE2E2', '#FEF3C7', '#DCFCE7', '#E0F2FE', '#EDE9FE',
  '#FCE7F3', '#FFEDD5', '#DBEAFE', '#F3F4F6', '#CFFAFE',
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
  const [searchQuery, setSearchQuery] = useState('');

  // Editing / Creating category state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Editor form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'expense' | 'income'>('expense');
  const [formIcon, setFormIcon] = useState('📦');
  const [formColor, setFormColor] = useState('#FEE2E2');
  const [formSubcategories, setFormSubcategories] = useState<string[]>([]);
  const [newSubcatInput, setNewSubcatInput] = useState('');
  const [showEmojiGrid, setShowEmojiGrid] = useState(false);

  // Confirmation for delete
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  if (!isOpen) return null;

  const filteredCategories = categories.filter((c) => {
    if (c.type !== activeTab) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchSub = c.subcategories?.some((s) => s.toLowerCase().includes(q));
      if (!matchName && !matchSub) return false;
    }
    return true;
  });

  const handleOpenCreate = () => {
    onHaptic?.('light');
    setEditingCategory(null);
    setFormName('');
    setFormType(activeTab);
    setFormIcon(activeTab === 'income' ? '💰' : '🛍️');
    setFormColor(activeTab === 'income' ? '#DCFCE7' : '#FEE2E2');
    setFormSubcategories([]);
    setNewSubcatInput('');
    setShowEmojiGrid(false);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    onHaptic?.('light');
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormType(cat.type);
    setFormIcon(cat.icon || '📦');
    setFormColor(cat.color || '#FEE2E2');
    setFormSubcategories(cat.subcategories ? [...cat.subcategories] : []);
    setNewSubcatInput('');
    setShowEmojiGrid(false);
    setIsEditorOpen(true);
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

  const handleSaveForm = () => {
    if (!formName.trim()) return;
    onHaptic?.('heavy');
    onSaveCategory({
      id: editingCategory?.id,
      name: formName.trim(),
      type: formType,
      icon: formIcon,
      color: formColor,
      subcategories: formSubcategories,
    });
    setIsEditorOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!categoryToDelete) return;
    onHaptic?.('heavy');
    onDeleteCategory(categoryToDelete.id);
    setCategoryToDelete(null);
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in select-none transition-colors">
      <div className="relative w-full max-w-lg bg-[#F6F7FB] dark:bg-[#121318] rounded-t-[32px] pt-3 pb-8 px-5 shadow-2xl z-10 h-[90vh] flex flex-col animate-slide-up border-t border-gray-100 dark:border-[#252730]">
        {/* Handle Bar */}
        <div className="w-10 h-1 bg-[#D1D5DB] dark:bg-[#343744] rounded-full mx-auto mb-3 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-white dark:bg-[#1E1F26] flex items-center justify-center text-[#4B5563] dark:text-[#A0A5B5] shadow-xs active:scale-95"
          >
            <CloseOutlined className="text-[16px]" />
          </button>

          <h2 className="text-[18px] font-bold text-[#111827] dark:text-white">
            Управление категориями
          </h2>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="w-9 h-9 rounded-full bg-[#2B5BFF] text-white flex items-center justify-center shadow-sm active:scale-95 transition-transform"
          >
            <PlusOutlined className="text-[16px]" />
          </button>
        </div>

        {/* Tab Switcher: Расход / Доход */}
        <div className="bg-gray-200/70 dark:bg-[#1E1F26] p-1 rounded-2xl flex items-center mb-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              setActiveTab('expense');
            }}
            className={`flex-1 py-2 rounded-xl text-[14px] font-bold transition-all ${
              activeTab === 'expense'
                ? 'bg-white dark:bg-[#2B2D38] text-[#111827] dark:text-white shadow-xs'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            💸 Расходы
          </button>
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              setActiveTab('income');
            }}
            className={`flex-1 py-2 rounded-xl text-[14px] font-bold transition-all ${
              activeTab === 'income'
                ? 'bg-white dark:bg-[#2B2D38] text-[#111827] dark:text-white shadow-xs'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            💰 Доходы
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3 shrink-0">
          <SearchOutlined className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[14px]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по категориям и подкатегориям..."
            className="w-full bg-white dark:bg-[#1E1F26] pl-9 pr-3.5 py-2.5 rounded-2xl text-[14px] text-[#111827] dark:text-white placeholder-gray-400 focus:outline-none border border-gray-100 dark:border-gray-800 shadow-xs"
          />
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
          {filteredCategories.length > 0 ? (
            filteredCategories.map((cat) => (
              <div
                key={cat.id}
                className="bg-white dark:bg-[#1E1F26] p-3.5 rounded-[22px] border border-gray-100 dark:border-gray-800 shadow-xs flex items-center justify-between space-x-3 transition-all"
              >
                {/* Left Icon + Names */}
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div
                    className="w-12 h-12 rounded-[16px] flex items-center justify-center text-2xl shrink-0 shadow-xs"
                    style={{ backgroundColor: cat.color || '#FEE2E2' }}
                  >
                    {cat.icon || '📦'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[15px] font-bold text-[#111827] dark:text-white leading-tight truncate">
                      {cat.name}
                    </h4>
                    {/* Subcategories list or count */}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {cat.subcategories && cat.subcategories.length > 0 ? (
                        cat.subcategories.map((sub) => (
                          <span
                            key={sub}
                            className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                          >
                            {sub}
                          </span>
                        ))
                      ) : (
                        <span className="text-[12px] text-gray-400 italic">Без подкатегорий</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(cat)}
                    className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800/80 text-gray-500 dark:text-gray-300 hover:text-[#2B5BFF] flex items-center justify-center active:scale-90 transition-all"
                  >
                    <EditOutlined className="text-[14px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onHaptic?.('medium');
                      setCategoryToDelete(cat);
                    }}
                    className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800/80 text-gray-500 dark:text-gray-300 hover:text-red-500 active:scale-90 transition-all"
                  >
                    <DeleteOutlined className="text-[14px]" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 text-gray-400 text-sm">
              Категории не найдены
            </div>
          )}
        </div>
      </div>

      {/* Editor Modal: Add or Edit Category */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in select-none">
          <div className="bg-white dark:bg-[#1A1B20] rounded-[32px] w-full max-w-sm p-6 shadow-2xl space-y-4 animate-slide-up border border-gray-100 dark:border-[#252730] max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-bold text-[#111827] dark:text-white">
                {editingCategory ? 'Редактировать категорию' : 'Новая категория'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#252730] flex items-center justify-center text-gray-500 dark:text-gray-400"
              >
                <CloseOutlined className="text-[14px]" />
              </button>
            </div>

            {/* Big Emoji Circle + Color selector */}
            <div className="flex flex-col items-center justify-center space-y-3 py-2">
              <button
                type="button"
                onClick={() => setShowEmojiGrid(!showEmojiGrid)}
                className="w-20 h-20 rounded-[24px] flex items-center justify-center text-4xl shadow-sm border border-black/5 active:scale-95 transition-all relative"
                style={{ backgroundColor: formColor }}
              >
                {formIcon}
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#2B5BFF] text-white flex items-center justify-center shadow-xs">
                  <EditOutlined className="text-[11px]" />
                </div>
              </button>

              {/* Emoji Grid Selector */}
              {showEmojiGrid && (
                <div className="w-full bg-gray-50 dark:bg-[#20222A] p-2.5 rounded-2xl border border-gray-100 dark:border-gray-800 grid grid-cols-8 gap-1 max-h-36 overflow-y-auto animate-fade-in">
                  {POPULAR_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => {
                        onHaptic?.('light');
                        setFormIcon(em);
                        setShowEmojiGrid(false);
                      }}
                      className="w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg active:scale-95 transition-all"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}

              {/* Pastel Color Palette */}
              <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1">
                {PASTEL_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => {
                      onHaptic?.('light');
                      setFormColor(col);
                    }}
                    className={`w-6 h-6 rounded-full transition-transform active:scale-90 ${
                      formColor === col ? 'ring-2 ring-[#2B5BFF] ring-offset-2 scale-110' : ''
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>

            {/* Name Input */}
            <div>
              <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Название категории
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Например: Еда, Развлечения"
                className="w-full bg-gray-50 dark:bg-[#20222A] px-4 py-3 rounded-xl text-[15px] font-semibold text-[#111827] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2B5BFF]"
              />
            </div>

            {/* Type Selector (Расход / Доход) */}
            <div>
              <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Тип
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormType('expense')}
                  className={`py-2.5 rounded-xl font-bold text-[13px] border transition-all ${
                    formType === 'expense'
                      ? 'bg-red-50 dark:bg-red-950/40 text-[#FF4B55] border-red-300 dark:border-red-800'
                      : 'bg-gray-50 dark:bg-[#20222A] text-gray-500 border-transparent'
                  }`}
                >
                  Расход
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('income')}
                  className={`py-2.5 rounded-xl font-bold text-[13px] border transition-all ${
                    formType === 'income'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-[#10B981] border-emerald-300 dark:border-emerald-800'
                      : 'bg-gray-50 dark:bg-[#20222A] text-gray-500 border-transparent'
                  }`}
                >
                  Доход
                </button>
              </div>
            </div>

            {/* Subcategories Editor */}
            <div className="space-y-2 pt-1">
              <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider block">
                Подкатегории
              </label>

              {/* Subcategories Chips */}
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {formSubcategories.length > 0 ? (
                  formSubcategories.map((sub) => (
                    <span
                      key={sub}
                      className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#2B5BFF] text-xs font-semibold"
                    >
                      <span>{sub}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubcategory(sub)}
                        className="hover:text-red-500 text-[10px] ml-0.5"
                      >
                        ✕
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">Нет подкатегорий</span>
                )}
              </div>

              {/* Add Subcategory Input */}
              <div className="flex items-center space-x-2 pt-1">
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
                  className="flex-1 bg-gray-50 dark:bg-[#20222A] px-3 py-2 rounded-xl text-xs text-[#111827] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2B5BFF]"
                />
                <button
                  type="button"
                  onClick={handleAddSubcategory}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl text-xs hover:bg-gray-200 active:scale-95 transition-all"
                >
                  +
                </button>
              </div>
            </div>

            {/* Actions: Cancel & Save */}
            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="py-3 px-4 rounded-xl bg-gray-100 dark:bg-[#252730] text-[#374151] dark:text-white font-semibold text-sm active:bg-gray-200"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveForm}
                disabled={!formName.trim()}
                className="py-3 px-4 rounded-xl bg-[#2B5BFF] disabled:opacity-50 text-white font-semibold text-sm active:scale-98 shadow-sm"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in select-none">
          <div className="bg-white dark:bg-[#1A1B20] rounded-[28px] w-full max-w-sm p-6 shadow-2xl space-y-4 animate-slide-up text-center border border-gray-100 dark:border-[#252730]">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 flex items-center justify-center mx-auto text-xl">
              <DeleteOutlined />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#111827] dark:text-white">
                Удалить категорию?
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Категория «{categoryToDelete.name}» будет удалена из списка.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="py-2.5 rounded-xl bg-gray-100 dark:bg-[#252730] text-gray-700 dark:text-gray-300 font-semibold text-sm"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm shadow-sm"
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
