import React from 'react';

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

  return <div className="design-numpad" aria-label="Числовая клавиатура">{KEYS.map(k => <button key={k.main} type="button"
    aria-label={k.action === 'delete' ? 'Удалить последнюю цифру' : k.action === 'comma' ? 'Десятичная запятая' : k.main}
    onClick={() => handleClick(k)}>{k.action === 'delete' ? <span>⌫</span> : <><span>{k.main}</span>{k.sub && <small>{k.sub}</small>}</>}</button>)}</div>;
};
