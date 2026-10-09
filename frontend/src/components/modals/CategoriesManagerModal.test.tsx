import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CategoriesManagerModal } from './CategoriesManagerModal';
import { CreationOutcome } from '../../hooks/useCreationAttempt';
import { Category } from '../../types';
const categories:Category[]=[{id:'food',name:'Еда',icon:'🍔',type:'expense',color:'#fff'},
  {id:'shop',name:'Супермаркет',icon:'🛒',type:'expense',color:'#fff',parent_id:'food'}];
afterEach(cleanup);
function setup(save=vi.fn(async (_data:Partial<Category>)=>true as CreationOutcome | boolean)) {
  const close=vi.fn(),archive=vi.fn(async()=>true);
  return {...render(<CategoriesManagerModal isOpen categories={categories} onClose={close} onSaveCategory={save} onDeleteCategory={archive}/>),close,save,archive};
}
it('keeps children collapsed and archives the selected category only after confirmation',()=>{
  const view=setup();
  expect(view.queryByText('🛒 Супермаркет')).toBeNull();
  expect(view.queryByText('Архивировать')).toBeNull();
  fireEvent.click(view.getByRole('button',{name:'🍔 Еда'}));
  fireEvent.click(view.getByRole('button',{name:'Действия категории Супермаркет'}));
  fireEvent.click(view.getByRole('button',{name:'Архивировать'}));
  expect(view.archive).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole('button',{name:'Архивировать'}));
  expect(view.archive).toHaveBeenCalledWith('shop');
});
it('Escape dismisses the action menu, then edit screen, preserving category management',async()=>{
  const view=setup();
  fireEvent.click(view.getByRole('button',{name:'Действия категории Еда'}));
  fireEvent.keyDown(document,{key:'Escape'});
  expect(view.close).not.toHaveBeenCalled();
  expect(view.queryByRole('group',{name:'Действия Еда'})).toBeNull();
  expect(document.activeElement).toBe(view.getByRole('button',{name:'Действия категории Еда'}));
  fireEvent.click(view.getByRole('button',{name:'Действия категории Еда'}));
  fireEvent.click(view.getByRole('button',{name:'Редактировать'}));
  expect(view.getByLabelText('Название категории').closest('label')?.className).toBe('design-inline-field');
  fireEvent.change(view.getByLabelText('Название категории'),{target:{value:'Продукты'}});
  fireEvent.click(view.getByRole('button',{name:'Сохранить'}));
  await waitFor(()=>expect(view.save).toHaveBeenCalledOnce());
  expect(view.save.mock.calls[0][0]).toMatchObject({id:'food',name:'Продукты'});
  expect(view.getByRole('dialog',{name:'Категории'})).toBeTruthy();
});
it('canceling archive restores focus to the same category action trigger',()=>{
  const view=setup();
  fireEvent.click(view.getByRole('button',{name:'Действия категории Еда'}));
  fireEvent.click(view.getByRole('button',{name:'Архивировать'}));
  fireEvent.keyDown(document,{key:'Escape'});
  expect(view.archive).not.toHaveBeenCalled();
  expect(view.queryByRole('dialog',{name:'Архивировать категорию?'})).toBeNull();
  expect(document.activeElement).toBe(view.getByRole('button',{name:'Действия категории Еда'}));
});
it('shows save failure and preserves editable input for retry',async()=>{
  const view=setup(vi.fn(async()=>false));
  fireEvent.click(view.getByRole('button',{name:'Добавить категорию'}));
  fireEvent.change(view.getByLabelText('Название категории'),{target:{value:'Test'}});
  fireEvent.click(view.getByRole('button',{name:'Сохранить'}));
  await waitFor(()=>expect(view.getByRole('alert')).toBeTruthy());
  expect((view.getByLabelText('Название категории') as HTMLInputElement).value).toBe('Test');
});

it('archive failure displays server reason inside confirmation and allows retry',async()=>{
 const archive=vi.fn(async()=>false);
 const view=render(<CategoriesManagerModal isOpen categories={categories} onClose={()=>{}} onSaveCategory={vi.fn(async()=>true)} onDeleteCategory={archive} serverError="Сначала архивируйте подкатегории"/>);
 fireEvent.click(view.getByRole('button',{name:'Действия категории Еда'}));fireEvent.click(view.getByRole('button',{name:'Архивировать'}));fireEvent.click(view.getByRole('button',{name:'Архивировать'}));
 await waitFor(()=>expect(view.getByRole('alert').textContent).toBe('Сначала архивируйте подкатегории'));
 expect(view.getByRole('dialog',{name:'Архивировать категорию?'}).contains(view.getByRole('alert'))).toBe(true);
 fireEvent.click(view.getByRole('button',{name:'Архивировать'}));await waitFor(()=>expect(archive).toHaveBeenCalledTimes(2));
});
it('category unknown creation locks fields and close, preserves key/payload across retry',async()=>{
 const save=vi.fn(async (_p:Partial<Category>&{client_id?:string})=>'uncertain' as const);
 const view=setup(save);fireEvent.click(view.getByRole('button',{name:'Добавить категорию'}));
 fireEvent.change(view.getByLabelText('Название категории'),{target:{value:'Synthetic'}});fireEvent.click(view.getByRole('button',{name:'Сохранить'}));
 await waitFor(()=>expect(view.getByRole('alert').textContent).toContain('копия не появится'));
 expect(view.getByLabelText('Название категории').matches(':disabled')).toBe(true);fireEvent.keyDown(document,{key:'Escape'});expect(view.close).not.toHaveBeenCalled();
 fireEvent.click(view.getByRole('button',{name:'Сохранить'}));await waitFor(()=>expect(save).toHaveBeenCalledTimes(2));expect(save.mock.calls[0][0].client_id).toBeTruthy();expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0]);
});
