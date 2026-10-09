import { Category } from '../../types';
import { categorySelection } from '../../utils/categorySelection';
import { CategoryChoices } from './TransactionEditor';

export function CategorySelection({ categories, selected, expanded, onSelect, onCollapse }: {
  categories: Category[]; selected?: string; expanded: boolean;
  onSelect: (category: Category) => void; onCollapse: () => void;
}) {
  const menu = categorySelection(categories, selected);
  if (expanded) return <section aria-label="Основные категории">
    <CategoryChoices categories={menu.roots} selected={menu.root?.id}
      onSelect={category => { onSelect(category); onCollapse(); }} />
  </section>;
  if (!menu.branch || !menu.children.length) return null;
  const branch = menu.branch;
  return <section aria-label={`Подкатегории ${branch.name}`}>
    <p className="design-category-caption">Подкатегории</p>
    <div className="design-choice-list">
      <button type="button" aria-pressed={selected === branch.id} onClick={() => onSelect(branch)}>{branch.icon} Без подкатегории</button>
      {menu.children.map(category => <button type="button" key={category.id} aria-pressed={selected === category.id}
        onClick={() => onSelect(category)}>{category.icon} {category.name}</button>)}
    </div>
  </section>;
}
