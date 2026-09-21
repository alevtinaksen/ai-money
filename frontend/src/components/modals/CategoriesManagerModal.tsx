import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArrowLeftOutlined,
  CloseOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  RightOutlined,
  HolderOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import { Category } from '../../types';
import { saveStoredCategories } from '../../api/client';

interface CategoriesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSaveCategory: (category: Partial<Category> & { id?: string }) => void;
  onDeleteCategory: (id: string) => void;
  onReorderCategories?: (categories: Category[]) => void;
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
  onReorderCategories,
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

  // Toast notification for drag & drop
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Drag & Drop State
  const [draggingCat, setDraggingCat] = useState<Category | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    catId: string;
    insertPos: 'before' | 'after';
  } | null>(null);

  const dragSessionRef = useRef<{
    cat: Category;
    startX: number;
    startY: number;
    startTime: number;
    isDragging: boolean;
    fromHandle: boolean;
  } | null>(null);

  const justDraggedRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter and sort categories for the current tab
  const displayCategories = useMemo(() => {
    return categories
      .filter((c) => {
        if (activeTab === 'expense') {
          return c.type === 'expense' || c.type === 'both';
        }
        return c.type === 'income' || c.type === 'both';
      })
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [categories, activeTab]);

  const displayCategoriesRef = useRef(displayCategories);
  displayCategoriesRef.current = displayCategories;

  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  // Cleanup body drag styles on unmount
  useEffect(() => {
    return () => {
      document.body.style.userSelect = '';
      document.body.style.touchAction = '';
    };
  }, []);

  if (!isOpen) return null;

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
    if (justDraggedRef.current) return;
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

  // Reorder categories handler
  const executeReorder = (sourceCatId: string, targetCatId: string, insertPos: 'before' | 'after') => {
    if (sourceCatId === targetCatId) return;

    const currentList = [...displayCategoriesRef.current];
    const sourceIndex = currentList.findIndex((c) => c.id === sourceCatId);
    const targetIndex = currentList.findIndex((c) => c.id === targetCatId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const [movedCat] = currentList.splice(sourceIndex, 1);
    let newTargetIndex = currentList.findIndex((c) => c.id === targetCatId);

    if (insertPos === 'after') {
      newTargetIndex += 1;
    }

    currentList.splice(newTargetIndex, 0, movedCat);

    // Update sort_order for current tab categories
    const updatedTabCategories = currentList.map((cat, idx) => ({
      ...cat,
      sort_order: idx + 1,
    }));

    const tabCatMap = new Map(updatedTabCategories.map((c) => [c.id, c]));

    // Merge with full categories array
    const fullUpdatedCategories = categoriesRef.current.map((cat) => {
      if (tabCatMap.has(cat.id)) {
        return tabCatMap.get(cat.id)!;
      }
      return cat;
    });

    onHaptic?.('heavy');
    if (onReorderCategories) {
      onReorderCategories(fullUpdatedCategories);
    } else {
      saveStoredCategories(fullUpdatedCategories);
    }

    setToastMessage('✓ Порядок категорий сохранен');
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Pointer drag event handlers
  const handlePointerDown = (
    e: React.PointerEvent,
    cat: Category,
    fromHandle = false
  ) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!e.isPrimary) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startTime = Date.now();

    dragSessionRef.current = {
      cat,
      startX,
      startY,
      startTime,
      isDragging: false,
      fromHandle,
    };

    try {
      (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
    } catch (err) {}

    const handleWindowPointerMove = (ev: PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session) return;

      const dx = ev.clientX - session.startX;
      const dy = ev.clientY - session.startY;
      const threshold = session.fromHandle ? 4 : 8;

      if (!session.isDragging) {
        if (Math.hypot(dx, dy) > threshold) {
          session.isDragging = true;
          setDraggingCat(session.cat);
          onHaptic?.('medium');
          document.body.style.userSelect = 'none';
          document.body.style.touchAction = 'none';
        } else {
          return;
        }
      }

      // Active dragging
      ev.preventDefault();
      setDragPos({ x: ev.clientX, y: ev.clientY });

      // Auto-scrolling in container
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (ev.clientY < rect.top + 60) {
          containerRef.current.scrollTop -= 10;
        } else if (ev.clientY > rect.bottom - 60) {
          containerRef.current.scrollTop += 10;
        }
      }

      // Drop target detection
      let targetCatId: string | null = null;
      let insertPos: 'before' | 'after' = 'after';

      const elem = document.elementFromPoint(ev.clientX, ev.clientY);
      const catCard = elem?.closest('[data-cat-id]');
      if (catCard) {
        targetCatId = catCard.getAttribute('data-cat-id');
        const rect = catCard.getBoundingClientRect();
        insertPos = ev.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      }

      if (targetCatId && targetCatId !== session.cat.id) {
        const newTarget = { catId: targetCatId, insertPos };
        setDragOverTarget((prev) => {
          if (!prev || prev.catId !== newTarget.catId || prev.insertPos !== newTarget.insertPos) {
            onHaptic?.('light');
            return newTarget;
          }
          return prev;
        });
      } else {
        setDragOverTarget(null);
      }
    };

    const cleanupWindowListeners = () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
      document.body.style.userSelect = '';
      document.body.style.touchAction = '';
    };

    const handleWindowPointerUp = (ev: PointerEvent) => {
      cleanupWindowListeners();

      const session = dragSessionRef.current;
      if (!session) return;

      if (session.isDragging) {
        justDraggedRef.current = true;
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 350);

        let finalCatId = dragOverTarget?.catId || null;
        let finalInsertPos = dragOverTarget?.insertPos || 'after';

        const elem = document.elementFromPoint(ev.clientX, ev.clientY);
        const catCard = elem?.closest('[data-cat-id]');
        if (catCard) {
          finalCatId = catCard.getAttribute('data-cat-id');
          const rect = catCard.getBoundingClientRect();
          finalInsertPos = ev.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
        }

        if (finalCatId && finalCatId !== session.cat.id) {
          executeReorder(session.cat.id, finalCatId, finalInsertPos);
        }
      }

      dragSessionRef.current = null;
      setDraggingCat(null);
      setDragPos(null);
      setDragOverTarget(null);
    };

    const handleWindowPointerCancel = () => {
      cleanupWindowListeners();
      dragSessionRef.current = null;
      setDraggingCat(null);
      setDragPos(null);
      setDragOverTarget(null);
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);
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
        <div className="flex-1 flex flex-col h-full overflow-hidden px-5 pt-12 pb-6 max-w-lg mx-auto w-full relative">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[99] bg-[#1E293B] border border-emerald-500/40 text-emerald-400 font-bold text-xs px-4 py-2.5 rounded-full shadow-2xl flex items-center space-x-2 animate-bounce">
              <CheckCircleFilled className="text-[14px]" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Top Bar */}
          <div className="flex items-center justify-between mb-3 shrink-0">
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
              <div>
                <h1 className="text-[24px] font-bold text-white tracking-tight">
                  Категории
                </h1>
              </div>
            </div>

            <div className="flex items-center">
              {/* Add category button */}
              <button
                type="button"
                onClick={handleOpenCreate}
                className="w-11 h-11 rounded-full bg-[#DCE6FF] dark:bg-[#1E284A] text-[#2B5BFF] border border-[#B3C8FD] dark:border-[#2B5BFF]/40 shadow-sm flex items-center justify-center active:scale-95 transition-transform"
              >
                <PlusOutlined className="text-[18px] text-[#2B5BFF]" />
              </button>
            </div>
          </div>

          {/* Drag Hint */}
          <div className="text-[11px] text-[#8E92A4] mb-3 px-1 flex items-center justify-between">
            <span>Удерживайте и тяните для изменения порядка</span>
            <span className="font-semibold text-xs text-[#2B5BFF]">{displayCategories.length} кат.</span>
          </div>

          {/* Tab Switch: Расход / Доход */}
          <div className="bg-[#181920] p-1.5 rounded-[22px] flex border border-white/5 mb-3 shrink-0">
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

          {/* List of Categories with Drag & Drop */}
          <div
            ref={containerRef}
            className="flex-1 overflow-y-auto space-y-2.5 pb-8 pr-0.5 relative"
          >
            {displayCategories.map((cat) => {
              const isBeingDragged = draggingCat?.id === cat.id;
              const isTargetBefore =
                dragOverTarget?.catId === cat.id && dragOverTarget.insertPos === 'before';
              const isTargetAfter =
                dragOverTarget?.catId === cat.id && dragOverTarget.insertPos === 'after';

              return (
                <div key={cat.id} className="relative">
                  {/* Neon Blue Drop Indicator Line - Before */}
                  {isTargetBefore && (
                    <div className="h-1 bg-[#2B5BFF] rounded-full mx-2 my-1 shadow-md shadow-blue-500/50 animate-pulse transition-all" />
                  )}

                  <div
                    data-cat-id={cat.id}
                    onPointerDown={(e) => handlePointerDown(e, cat, false)}
                    onClick={() => handleOpenEdit(cat)}
                    className={`w-full bg-[#1C1D24] hover:bg-[#23252E] rounded-[22px] p-3.5 flex items-center justify-between border transition-all cursor-grab active:cursor-grabbing touch-none select-none ${
                      isBeingDragged
                        ? 'opacity-30 border-dashed border-[#2B5BFF] scale-[0.98] bg-[#222533]'
                        : 'border-white/5 active:scale-[0.99]'
                    }`}
                  >
                    {/* Left Icon + Text */}
                    <div className="flex items-center space-x-3 min-w-0 flex-1 pointer-events-none">
                      <div className="w-11 h-11 rounded-[16px] bg-[#14151C] flex items-center justify-center text-[22px] shrink-0 shadow-inner">
                        {cat.icon || '📦'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[16px] font-bold text-white tracking-tight leading-tight truncate">
                          {cat.name}
                        </h4>
                        {cat.subcategories && cat.subcategories.length > 0 ? (
                          <span className="text-[12px] text-[#8E92A4] block mt-0.5 font-medium truncate">
                            {cat.subcategories.slice(0, 3).join(', ')}
                            {cat.subcategories.length > 3 ? ` +${cat.subcategories.length - 3}` : ''}
                          </span>
                        ) : (
                          <span className="text-[12px] text-gray-500 block mt-0.5 font-medium">
                            {cat.type === 'both' ? 'Расход и доход' : cat.type === 'income' ? 'Доход' : 'Расход'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Drag Grip Handle + Edit Arrow */}
                    <div className="flex items-center space-x-2 shrink-0 ml-2">
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          handlePointerDown(e, cat, true);
                        }}
                        className="p-2 text-gray-500 hover:text-white active:text-[#2B5BFF] transition-colors cursor-grab active:cursor-grabbing touch-none"
                        title="Потяните для перестановки"
                      >
                        <HolderOutlined className="text-[17px]" />
                      </div>
                      <RightOutlined className="text-[12px] text-gray-600 pointer-events-none pr-1" />
                    </div>
                  </div>

                  {/* Neon Blue Drop Indicator Line - After */}
                  {isTargetAfter && (
                    <div className="h-1 bg-[#2B5BFF] rounded-full mx-2 my-1 shadow-md shadow-blue-500/50 animate-pulse transition-all" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Floating Drag Preview */}
          {draggingCat && dragPos && (
            <div
              className="fixed pointer-events-none z-[100] transform -translate-x-1/2 -translate-y-1/2 w-72 bg-[#1C1D24] border-2 border-[#2B5BFF] rounded-[22px] p-3.5 shadow-2xl shadow-[#2B5BFF]/30 flex items-center space-x-3 opacity-95 scale-105 rotate-2"
              style={{
                left: `${dragPos.x}px`,
                top: `${dragPos.y}px`,
              }}
            >
              <div className="w-10 h-10 rounded-[14px] bg-[#14151C] flex items-center justify-center text-[20px] shrink-0">
                {draggingCat.icon || '📦'}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-[15px] font-bold text-white tracking-tight truncate">
                  {draggingCat.name}
                </h4>
                <span className="text-[11px] text-[#2B5BFF] font-semibold">
                  Перемещение...
                </span>
              </div>
            </div>
          )}
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
