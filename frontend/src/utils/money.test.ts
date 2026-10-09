import { expect, test } from 'vitest';
import { moneyInput } from './money';
test('money validates exact cents, including the upper boundary', () => {
  expect(moneyInput('999999999999,99')).toBe('999999999999.99');
  expect(moneyInput('000.25')).toBe('0.25');
  expect(moneyInput('-100', true)).toBe('-100.00');
  for (const value of ['1.2345', 'NaN', 'Infinity', '-1', '0', '1000000000000', '12oops']) expect(() => moneyInput(value)).toThrow();
});
