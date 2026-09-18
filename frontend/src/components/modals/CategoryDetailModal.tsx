import React, { useState } from 'react';
import {
  ArrowLeftOutlined,
  EditOutlined,
  CreditCardOutlined,
  FileTextOutlined,
  RightOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { Transaction, CategoryStat, Category } from '../../types';
import { CATEGORIES_CATALOG } from './EditTransactionModal';

interface CategoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: CategoryStat | Category | null;
  periodLabel?: string;
  transactions: Transaction[];
  onOpenAddTransaction?: (categoryId?: string) => void;
  onSelectTransaction?: (tx: Transaction) => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

interface SubcatStat {
  name: string;
  icon?: string;
  amount: number;
  percentage: number;
}

export const CategoryDetailModal: React.FC<CategoryDetailModalProps> = ({
  isOpen,
  onClose,
  category,
  periodLabel = 'Май 2026 г.',
  transactions,
  onOpenAddTransaction,
  onSelectTransaction,
  onHaptic,
}) => {
  const [periodTab, setPeriodTab] = useState<'days' | 'weeks'>('days');
  const [showTxList, setShowTxList] = useState(false);
  const [budget, setBudget] = useState<number | null>(null);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  if (!isOpen || !category) return null;

  // Find active catalog entry for subcategories matching
  const activeCatalog =
    CATEGORIES_CATALOG.find((c) => c.name.toLowerCase() === category.name.toLowerCase()) ||
    CATEGORIES_CATALOG.find((c) => category.name.toLowerCase().includes(c.name.toLowerCase()));

  // Filter transactions strictly for this category and its subcategories
  const catTxs = transactions.filter((t) => {
    if (t.type !== 'expense') return false;
    if (t.category_id && t.category_id === category.id) return true;
    const catNameLower = category.name.toLowerCase();
    const tCatName = t.category_name?.toLowerCase() || '';
    const tNote = t.note?.toLowerCase() || '';

    if (tCatName === catNameLower || tNote === catNameLower) return true;

    // Check if tx is a subcategory of this category
    if (activeCatalog) {
      if (
        activeCatalog.subcategories.some(
          (sc) => sc.toLowerCase() === tCatName || sc.toLowerCase() === tNote
        )
      ) {
        return true;
      }
    }
    return false;
  });

  // Dynamic metrics calculated purely from user data
  const totalAmount = catTxs.reduce((sum, t) => sum + t.amount, 0);
  const txCount = catTxs.length;

  // Subcategories breakdown
  const subcategories: SubcatStat[] = (() => {
    if (catTxs.length === 0) {
      return [
        { name: 'Без подкатегории', icon: category.icon, amount: 0, percentage: 0 },
      ];
    }

    const subMap: Record<string, number> = {};
    for (const t of catTxs) {
      let subName = t.note?.trim();
      if (!subName || subName.toLowerCase() === category.name.toLowerCase()) {
        if (t.category_name && t.category_name.toLowerCase() !== category.name.toLowerCase()) {
          subName = t.category_name.trim();
        } else {
          subName = 'Без подкатегории';
        }
      }
      subMap[subName] = (subMap[subName] || 0) + t.amount;
    }

    const items = Object.entries(subMap).map(([name, amt]) => ({
      name,
      icon: name === 'Без подкатегории' ? category.icon : '📁',
      amount: amt,
      percentage: totalAmount > 0 ? Math.round((amt / totalAmount) * 100) : 0,
    }));

    return items.sort((a, b) => b.amount - a.amount);
  })();

  // Daily Chart Points: Days 1 to 31 dynamically mapped from transaction dates
  const daySpendMap: Record<number, number> = {};
  for (const t of catTxs) {
    if (t.created_at) {
      const d = new Date(t.created_at).getDate();
      if (d >= 1 && d <= 31) {
        daySpendMap[d] = (daySpendMap[d] || 0) + t.amount;
      }
    }
  }

  const daysData = Array.from({ length: 31 }, (_, i) => {
    const day = i + 1;
    return { day, val: daySpendMap[day] || 0 };
  });

  const maxVal = Math.max(100, ...daysData.map((d) => d.val));
  const chartHeight = 120;
  const chartWidth = 300;

  const points = daysData.map((d, i) => {
    const x = (i / (daysData.length - 1)) * chartWidth;
    const y = chartHeight - (d.val / maxVal) * (chartHeight - 10) - 5;
    return { x, y, val: d.val, day: d.day };
  });

  const pathD = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    // Catmull-Rom or cubic bezier for smooth curve
    const prev = points[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

  const handleSaveBudget = () => {
    const parsed = parseFloat(budgetInput.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      setBudget(parsed);
    } else {
      setBudget(null);
    }
    setIsEditingBudget(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F6F7FB] dark:bg-[#121318] text-[#111827] dark:text-white flex flex-col overflow-y-auto no-scrollbar animate-fade-in select-none transition-colors duration-200">
      {/* Top Bar */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between sticky top-0 bg-[#F6F7FB]/90 dark:bg-[#121318]/90 backdrop-blur-md z-20 border-b border-gray-200 dark:border-gray-800/40">
        <button
          type="button"
          onClick={() => {
            onHaptic?.('light');
            onClose();
          }}
          className="w-10 h-10 rounded-full bg-white dark:bg-[#1F2026] flex items-center justify-center text-[#111827] dark:text-gray-300 active:scale-90 transition-all border border-gray-200 dark:border-gray-700/40 shadow-xs"
        >
          <ArrowLeftOutlined className="text-[18px]" />
        </button>

        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-full bg-white dark:bg-[#1F2026] flex items-center justify-center text-xl border border-gray-200 dark:border-gray-700/40 shadow-xs">
            {category.icon}
          </div>
          <div className="text-left">
            <h2 className="text-[17px] font-bold text-[#111827] dark:text-white leading-tight">{category.name}</h2>
            <span className="text-[12px] text-gray-500 dark:text-gray-400 font-medium block leading-none mt-0.5">
              {periodLabel}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onHaptic?.('light');
            setIsEditingBudget(true);
            setBudgetInput(budget ? budget.toString() : '');
          }}
          className="w-10 h-10 rounded-full bg-white dark:bg-[#1F2026] flex items-center justify-center text-[#111827] dark:text-gray-300 active:scale-90 transition-all border border-gray-200 dark:border-gray-700/40 shadow-xs"
        >
          <EditOutlined className="text-[14px]" />
        </button>
      </div>

      <div className="p-5 space-y-4 max-w-md mx-auto w-full pb-24">
        {/* Card 1: Бюджет на месяц */}
        <div className="bg-white dark:bg-[#1A1B20] rounded-[22px] p-4 border border-gray-100 dark:border-gray-800/60 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-[#25262C] flex items-center justify-center text-gray-400 border border-gray-100 dark:border-gray-700/40">
                <CreditCardOutlined className="text-[18px]" />
              </div>
              <div>
                <span className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 block">Бюджет на месяц</span>
                <span className="text-[20px] font-black text-[#111827] dark:text-white block tracking-tight mt-0.5">
                  {budget ? `${budget.toLocaleString('ru-RU')} ₽` : 'Не установлен'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                setIsEditingBudget(!isEditingBudget);
                setBudgetInput(budget ? budget.toString() : '');
              }}
              className="text-[13px] font-bold text-[#2B5BFF] dark:text-[#4F75FF] bg-blue-50 dark:bg-[#25262C] px-3 py-1.5 rounded-full hover:opacity-90 transition-colors"
            >
              {budget ? 'Изменить' : 'Установить'}
            </button>
          </div>

          {/* Quick budget inline edit input */}
          {isEditingBudget && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/60 flex items-center space-x-2 animate-fade-in">
              <input
                type="number"
                placeholder="Сумма лимита (₽)"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="flex-1 bg-gray-50 dark:bg-[#25262C] rounded-xl px-3.5 py-2 text-[#111827] dark:text-white text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#2B5BFF]"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveBudget}
                className="bg-[#2B5BFF] text-white px-3.5 py-2 rounded-xl text-xs font-bold active:scale-95"
              >
                ОК
              </button>
              <button
                type="button"
                onClick={() => setIsEditingBudget(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                <CloseOutlined className="text-[14px]" />
              </button>
            </div>
          )}
        </div>

        {/* Card 2: Транзакции */}
        <button
          type="button"
          onClick={() => {
            onHaptic?.('light');
            setShowTxList(!showTxList);
          }}
          className="w-full bg-white dark:bg-[#1A1B20] rounded-[22px] p-4 border border-gray-100 dark:border-gray-800/60 shadow-xs flex items-center justify-between text-left active:scale-[0.99] transition-all"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-[#25262C] flex items-center justify-center text-gray-400 border border-gray-100 dark:border-gray-700/40">
              <FileTextOutlined className="text-[18px]" />
            </div>
            <div>
              <span className="text-[13px] font-semibold text-gray-500 dark:text-gray-400 block">Транзакции</span>
              <span className="text-[20px] font-black text-[#FF4B55] block tracking-tight mt-0.5">
                {totalAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                ₽
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-[#25262C] text-[#2B5BFF] dark:text-[#4F75FF] font-bold text-[13px]">
            <span>{txCount}</span>
            <RightOutlined className="text-[12px]" />
          </div>
        </button>

        {/* Expanded Transaction List */}
        {showTxList && catTxs.length > 0 && (
          <div className="bg-white dark:bg-[#1A1B20] rounded-[22px] p-3 border border-gray-100 dark:border-gray-800/60 space-y-2 animate-slide-up shadow-xs">
            {catTxs.map((tx) => (
              <button
                key={tx.id}
                type="button"
                onClick={() => {
                  onHaptic?.('light');
                  onSelectTransaction?.(tx);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-[#25262C]/60 hover:bg-gray-100 dark:hover:bg-[#25262C] text-left transition-all"
              >
                <div>
                  <span className="text-[14px] font-semibold text-[#111827] dark:text-white block">
                    {tx.category_name && tx.note && tx.note.toLowerCase() !== tx.category_name.toLowerCase()
                      ? `${tx.category_name} · ${tx.note}`
                      : tx.note || tx.category_name || 'Расход'}
                  </span>
                  <span className="text-[11px] text-gray-400 block mt-0.5">
                    {new Date(tx.created_at).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
                <span className="text-[14px] font-bold text-[#FF4B55]">
                  −{tx.amount.toLocaleString('ru-RU')} ₽
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Segmented Period Control: [ Дни | Недели ] */}
        <div className="bg-gray-100 dark:bg-[#1A1B20] p-1 rounded-2xl border border-gray-200 dark:border-gray-800/60 flex items-center">
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              setPeriodTab('days');
            }}
            className={`flex-1 py-2 rounded-xl text-[14px] font-bold transition-all text-center ${
              periodTab === 'days'
                ? 'bg-white dark:bg-[#2B5BFF] text-[#111827] dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Дни
          </button>
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              setPeriodTab('weeks');
            }}
            className={`flex-1 py-2 rounded-xl text-[14px] font-bold transition-all text-center ${
              periodTab === 'weeks'
                ? 'bg-white dark:bg-[#2B5BFF] text-[#111827] dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Недели
          </button>
        </div>

        {/* Chart Card */}
        <div className="bg-white dark:bg-[#1A1B20] rounded-[22px] p-4 border border-gray-100 dark:border-gray-800/60 shadow-xs relative">
          <div className="flex">
            {/* Y-Axis Labels */}
            <div className="w-16 flex flex-col justify-between text-[11px] font-medium text-gray-400 pr-2 h-[120px] text-right leading-none select-none">
              <span>{Math.round(maxVal).toLocaleString('ru-RU')} ₽</span>
              <span>{Math.round(maxVal * 0.66).toLocaleString('ru-RU')} ₽</span>
              <span>{Math.round(maxVal * 0.33).toLocaleString('ru-RU')} ₽</span>
              <span>0 ₽</span>
            </div>

            {/* SVG Interactive Line Chart */}
            <div className="flex-1 relative h-[120px]">
              {/* Horizontal Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                <div className="border-b border-gray-300 dark:border-gray-600 w-full" />
                <div className="border-b border-gray-300 dark:border-gray-600 w-full" />
                <div className="border-b border-gray-300 dark:border-gray-600 w-full" />
                <div className="border-b border-gray-300 dark:border-gray-600 w-full" />
              </div>

              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Filled Gradient Area */}
                <path d={areaD} fill="url(#purpleGradient)" />

                {/* Smooth Curve */}
                <path d={pathD} fill="none" stroke="#A855F7" strokeWidth="2.5" />

                {/* Points */}
                {points.map((p) => (
                  <circle
                    key={p.day}
                    cx={p.x}
                    cy={p.y}
                    r={p.val > 0 ? 3.5 : 2}
                    fill={p.val > 0 ? '#C084FC' : '#9CA3AF'}
                    stroke={p.val > 0 ? '#FFFFFF' : 'none'}
                    strokeWidth={p.val > 0 ? 1.5 : 0}
                  />
                ))}
              </svg>
            </div>
          </div>

          {/* X-Axis Days Labels */}
          <div className="flex justify-between text-[10px] text-gray-400 font-medium pl-16 pr-1 mt-2">
            <span>1</span>
            <span>3</span>
            <span>5</span>
            <span>7</span>
            <span>9</span>
            <span>11</span>
            <span>13</span>
            <span>15</span>
            <span>17</span>
            <span>19</span>
            <span>21</span>
            <span>23</span>
            <span>25</span>
            <span>27</span>
            <span>29</span>
            <span>31</span>
          </div>
        </div>

        {/* Section: Подкатегории */}
        <div className="space-y-3 pt-2">
          <h3 className="text-[18px] font-bold text-[#111827] dark:text-white">Подкатегории</h3>

          <div className="space-y-2.5">
            {subcategories.map((sub) => (
              <div
                key={sub.name}
                className="bg-white dark:bg-[#1A1B20] rounded-[20px] p-3.5 border border-gray-100 dark:border-gray-800/60 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-gray-50 dark:bg-[#25262C] flex items-center justify-center text-lg border border-gray-100 dark:border-gray-700/40">
                      {sub.icon || '📁'}
                    </div>
                    <span className="text-[15px] font-semibold text-[#111827] dark:text-white">{sub.name}</span>
                  </div>

                  <div className="flex items-center space-x-2 text-right">
                    <div>
                      <span className="text-[15px] font-black text-[#FF4B55] block leading-tight">
                        {sub.amount.toLocaleString('ru-RU', {
                          minimumFractionDigits: sub.amount % 1 === 0 ? 0 : 2,
                        })}{' '}
                        ₽
                      </span>
                    </div>
                    <RightOutlined className="text-[12px] text-gray-400" />
                  </div>
                </div>

                {/* Subcategory Progress Bar & Percentage */}
                <div className="flex items-center space-x-3 mt-2.5 pl-12">
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-[#25262C] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2B5BFF] rounded-full"
                      style={{ width: `${Math.max(4, sub.percentage)}%` }}
                    />
                  </div>
                  <span className="text-[12px] font-semibold text-gray-400 min-w-[30px] text-right">
                    {sub.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Action Button (+) matching media_1789747991545.png */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          type="button"
          onClick={() => {
            onHaptic?.('medium');
            onOpenAddTransaction?.(category.id);
          }}
          className="w-14 h-14 rounded-full bg-[#DCE6FF] dark:bg-[#1E284A] text-[#2B5BFF] dark:text-[#5B82FF] flex items-center justify-center active:scale-90 transition-all border border-[#B3C8FD] dark:border-[#2B5BFF]/40 shadow-[0_4px_16px_rgba(43,91,255,0.2)]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-7 h-7"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
