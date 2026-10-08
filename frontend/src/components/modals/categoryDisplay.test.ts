import { expect, test } from 'vitest';
import { resolveCategoryAndSubcategory } from './EditTransactionModal';
test('server categories are never replaced by inferred personal taxonomy', () => {
  expect(resolveCategoryAndSubcategory({ category_name: 'Продукты', category_icon: '📦', note: 'Кофе' }))
    .toMatchObject({ displayTitle: 'Продукты', subcategory: null, icon: '📦' });
  expect(resolveCategoryAndSubcategory({ type: 'expense' }).displayTitle).toBe('Без категории');
});
