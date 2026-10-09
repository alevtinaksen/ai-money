import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AddTransactionScreen } from './AddTransactionScreen';
import { EditTransactionModal } from '../modals/EditTransactionModal';
import { Account, Category, Transaction } from '../../types';

const account: Account = { id:'a', user_id:1, name:'Test', currency:'RUB', balance:10000,
  icon:'💳', color:'#fff', group_name:'Карты', is_default:true, sort_order:0 };
const categories: Category[] = [
  {id:'food',name:'Еда',icon:'🍔',type:'expense'},
  {id:'shop',name:'Супермаркет',icon:'🛒',type:'expense',parent_id:'food'},
  {id:'cafe',name:'Кафе',icon:'🍽️',type:'expense',parent_id:'food'},
  {id:'transport',name:'Транспорт',icon:'🚗',type:'expense'},
  {id:'taxi',name:'Такси',icon:'🚕',type:'expense',parent_id:'transport'},
  {id:'income',name:'Зарплата',icon:'💰',type:'income'},
].map(c=>({...c,color:'#fff'})) as Category[];
afterEach(cleanup);
it('shows only roots, then children of the chosen root, and saves the child ID', async()=>{
  const submit=vi.fn(async (_data:{category_id:string})=>true);
  const view=render(<AddTransactionScreen accounts={[account]} selectedAccount={account} categories={categories} onClose={vi.fn()} onSubmit={submit}/>);
  fireEvent.click(view.getByLabelText('Выбрать категорию'));
  const roots=within(view.getByRole('region',{name:'Основные категории'}));
  expect(roots.queryByRole('button',{name:/Супермаркет|Кафе|Такси|Зарплата/})).toBeNull();
  expect(roots.getAllByRole('button')).toHaveLength(2);
  fireEvent.click(roots.getByRole('button',{name:'🚗 Транспорт'}));
  expect(view.queryByRole('region',{name:'Основные категории'})).toBeNull();
  expect(view.queryByRole('button',{name:'🛒 Супермаркет'})).toBeNull();
  fireEvent.click(view.getByRole('button',{name:'🚕 Такси'}));
  fireEvent.change(view.getByLabelText('Сумма'),{target:{value:'5000'}});
  fireEvent.click(view.getByLabelText('Сохранить'));
  await waitFor(()=>expect(submit).toHaveBeenCalledOnce());
  expect(submit.mock.calls[0][0].category_id).toBe('taxi');
});
it('can return from a child to its parent without inventing another category', async()=>{
  const submit=vi.fn(async (_data:{category_id:string})=>true);
  const view=render(<AddTransactionScreen initialCategoryId="shop" accounts={[account]} selectedAccount={account} categories={categories} onClose={vi.fn()} onSubmit={submit}/>);
  expect(view.getByRole('button',{name:'🛒 Супермаркет'}).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(view.getByRole('button',{name:'🍔 Без подкатегории'}));
  fireEvent.change(view.getByLabelText('Сумма'),{target:{value:'250,50'}});
  fireEvent.click(view.getByLabelText('Сохранить'));
  await waitFor(()=>expect(submit).toHaveBeenCalledOnce());
  expect(submit.mock.calls[0][0].category_id).toBe('food');
});
it('editing preserves raw notes while choosing a new child; income switches to compatible roots', async()=>{
  const save=vi.fn(async (_data:{category_id?:string;note?:string|null})=>true);
  const transaction:Transaction={id:'t',revision:1,user_id:1,account_id:'a',currency:'RUB',type:'expense',amount:5000,category_id:'shop',note:'Raw note',created_at:'2026-10-09T00:00:00Z'};
  const view=render(<EditTransactionModal isOpen transaction={transaction} accounts={[account]} categories={categories} onClose={vi.fn()} onSave={save} onDelete={vi.fn(async()=>true)}/>);
  fireEvent.click(view.getByRole('button',{name:'🍽️ Кафе'}));
  fireEvent.click(view.getByLabelText('Сохранить'));
  await waitFor(()=>expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0]).toMatchObject({category_id:'cafe',note:'Raw note'});
  fireEvent.click(view.getByRole('button',{name:'Доход'}));
  fireEvent.click(view.getByLabelText('Выбрать категорию'));
  const roots=within(view.getByRole('region',{name:'Основные категории'}));
  expect(roots.getAllByRole('button')).toHaveLength(1);
  expect(roots.getByRole('button',{name:'💰 Зарплата'})).toBeTruthy();
});
it('empty category list does not expose categories from a different operation type',()=>{
  const view=render(<AddTransactionScreen accounts={[account]} selectedAccount={account} categories={categories.filter(c=>c.type==='income')} onClose={vi.fn()} onSubmit={vi.fn(async()=>true)}/>);
  fireEvent.click(view.getByLabelText('Выбрать категорию'));
  expect(view.getByText('Нет категорий для этого типа операции')).toBeTruthy();
  expect(view.queryByRole('button',{name:'💰 Зарплата'})).toBeNull();
});
it('money emoji and transfer words do not change the selected expense into a transfer',async()=>{
  const submit=vi.fn(async (_data:{category_id:string;type:string;to_account_id?:string})=>true);
  const list=[{...categories[0],id:'gift',name:'Перевод подарка',icon:'💸'},
    ...categories.map(c=>c.id==='shop'?{...c,icon:'💸'}:c)];
  const view=render(<AddTransactionScreen initialCategoryId="shop" accounts={[account,{...account,id:'b'}]}
    selectedAccount={account} categories={list} onClose={vi.fn()} onSubmit={submit}/>);
  expect(view.getByRole('button',{name:'💸 Супермаркет'}).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(view.getByRole('button',{name:'💸 Супермаркет'}));
  fireEvent.change(view.getByLabelText('Сумма'),{target:{value:'250'}});
  fireEvent.click(view.getByLabelText('Сохранить'));
  await waitFor(()=>expect(submit).toHaveBeenCalledOnce());
  expect(submit.mock.calls[0][0]).toMatchObject({category_id:'shop',type:'expense'});
  expect(submit.mock.calls[0][0].to_account_id).toBeUndefined();
});
