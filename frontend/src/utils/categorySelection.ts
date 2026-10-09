import { Category } from '../types';

/** A selectable branch comes from server IDs, never display names or emoji. */
export function categorySelection(categories: Category[], selected?: string) {
  const byId = new Map(categories.map(category => [category.id, category]));
  const current = selected ? byId.get(selected) : undefined;
  const childrenOf = (id?: string) => id ? categories.filter(category => category.parent_id === id) : [];
  const branch = childrenOf(current?.id).length ? current : byId.get(current?.parent_id || '') || current;
  let root = current;
  const seen = new Set<string>();
  while (root?.parent_id && byId.has(root.parent_id) && !seen.has(root.id)) {
    seen.add(root.id); root = byId.get(root.parent_id);
  }
  const roots = categories.filter(category => !category.parent_id || !byId.has(category.parent_id));
  return { roots, root, branch, children: childrenOf(branch?.id) };
}
