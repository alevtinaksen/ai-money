export function moneyInput(value: string | number, signed = false): string {
  const text = String(value).trim().replace(',', '.');
  const pattern = signed ? /^-?\d{1,12}(\.\d{1,2})?$/ : /^\d{1,12}(\.\d{1,2})?$/;
  if (!pattern.test(text)) throw new Error('Укажите сумму с точностью до двух знаков после запятой');
  const [whole, fraction = ''] = text.split('.');
  const negative = whole.startsWith('-');
  const cents = BigInt(whole.replace('-', '')) * 100n + BigInt(fraction.padEnd(2, '0'));
  if ((!signed && cents === 0n) || cents > 99999999999999n) throw new Error('Сумма вне допустимого диапазона');
  return `${negative ? '-' : ''}${BigInt(whole.replace('-', ''))}.${fraction.padEnd(2, '0')}`;
}
export const currencyLabel = (code: string) => ({ RUB: '₽', USD: '$', EUR: '€' }[code] || code);
