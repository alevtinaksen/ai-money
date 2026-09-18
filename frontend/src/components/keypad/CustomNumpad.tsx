import React from 'react';
import { RollbackOutlined } from '@ant-design/icons';

interface CustomNumpadProps {
  onDigit: (digit: string) => void;
  onDelete: () => void;
  onComma: () => void;
  onHaptic?: () => void;
}

const KEYS = [
  { main: '1', sub: '' },
  { main: '2', sub: 'А Б В Г' },
  { main: '3', sub: 'Д Е Ж З' },
  { main: '4', sub: 'И Й К Л' },
  { main: '5', sub: 'М Н О П' },
  { main: '6', sub: 'Р С Т У' },
  { main: '7', sub: 'Ф Х Ц Ч' },
  { main: '8', sub: 'Ш Щ Ъ Ы' },
  { main: '9', sub: 'Ь Э Ю Я' },
  { main: ',', sub: '', action: 'comma' },
  { main: '0', sub: '' },
  { main: 'del', sub: '', action: 'delete' },
];

export const CustomNumpad: React.FC<CustomNumpadProps> = ({
  onDigit,
  onDelete,
  onComma,
  onHaptic
}) => {
  const handleClick = (key: typeof KEYS[0]) => {
    onHaptic?.();
    if (key.action === 'delete') {
      onDelete();
    } else if (key.action === 'comma') {
      onComma();
    } else {
      onDigit(key.main);
    }
  };

  return (
    <div className="w-full bg-[#E5E7EB] dark:bg-[#181920] pt-3 pb-8 px-4 rounded-t-[32px] shadow-[0_-4px_20px_rgba(0,0,0,0.03)] select-none transition-colors">
      <div className="max-w-md mx-auto grid grid-cols-3 gap-2 sm:gap-3">
        {KEYS.map((k, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleClick(k)}
            className="h-[52px] sm:h-[58px] bg-white dark:bg-[#252732] active:bg-[#F3F4F6] dark:active:bg-[#2E303D] rounded-[16px] flex flex-col items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all active:scale-[0.98]"
          >
            {k.action === 'delete' ? (
              <RollbackOutlined className="text-[22px] text-[#1F2937] dark:text-white" />
            ) : (
              <>
                <span className="text-[24px] font-medium leading-none text-[#111827] dark:text-white">
                  {k.main}
                </span>
                {k.sub ? (
                  <span className="text-[9px] font-medium tracking-[0.1em] text-[#6B7280] dark:text-[#8E92A4] mt-0.5">
                    {k.sub}
                  </span>
                ) : null}
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
