import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AddTransactionScreen } from './AddTransactionScreen';
import { EditTransactionModal } from '../modals/EditTransactionModal';
import { Account, Category, Transaction } from '../../types';
const a: Account = {id:'a',user_id:1,name:'Синтетический A',group_name:'Личное',balance:100,currency:'RUB',icon:'💳',color:'#fff',is_default:true,sort_order:0};
const b: Account = {...a,id:'b',name:'Синтетический B'};
const categories: Category[] = [{id:'e',name:'Продукты',type:'expense',icon:'📦',color:'#fff'},{id:'i',name:'Зарплата',type:'income',icon:'💰',color:'#fff'}];
const tx: Transaction = {id:'t',user_id:1,account_id:'a',amount:10,currency:'RUB',type:'expense',category_id:'e',created_at:'2026-10-08T12:00:00Z',revision:1};
afterEach(cleanup);
it('Enter in account search does not submit the parent form', () => {
  const save=vi.fn(async(_data:Partial<Transaction>)=>false);
  render(<AddTransactionScreen accounts={[a,b]} selectedAccount={a} categories={categories} onClose={()=>{}} onSubmit={save}/>);
  fireEvent.keyDown(window,{key:'1'}); fireEvent.click(screen.getByRole('button',{name:'Счёт списания'}));
  const search=screen.getByLabelText('Поиск счёта'); search.focus(); fireEvent.keyDown(search,{key:'Enter'});
  expect(save).not.toHaveBeenCalled();
});
it('changing an expense to income chooses a compatible category before save', async () => {
  const save=vi.fn(async(_data:Partial<Transaction>)=>false);
  render(<EditTransactionModal isOpen transaction={tx} accounts={[a,b]} categories={categories} onClose={()=>{}} onSave={save} onDelete={vi.fn(async()=>false)}/>);
  fireEvent.click(screen.getByRole('button',{name:'Доход'}));fireEvent.click(screen.getByRole('button',{name:'Сохранить'}));
  await waitFor(()=>expect(save).toHaveBeenCalled()); expect(save.mock.calls[0][0]).toMatchObject({type:'income',category_id:'i'});
});
it('transfer swap, date and retry preserve the edited payload', async () => {
  const save=vi.fn(async(_data:Partial<Transaction>)=>false);
  render(<EditTransactionModal isOpen transaction={{...tx,type:'transfer',category_id:null,to_account_id:'b'}} accounts={[a,b]} categories={categories} onClose={()=>{}} onSave={save} onDelete={vi.fn(async()=>false)}/>);
  fireEvent.click(screen.getByRole('button',{name:'Поменять счета местами'}));
  fireEvent.change(screen.getByLabelText('Дата операции'),{target:{value:'2026-10-01'}});
  fireEvent.click(screen.getByRole('button',{name:'Сохранить'})); await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[0][0]).toMatchObject({account_id:'b',to_account_id:'a',type:'transfer'});
  expect(new Date(save.mock.calls[0][0].created_at!).getDate()).toBe(1);
  expect(screen.getByLabelText('Сумма')).toBeTruthy();
});
it('new expense initializes a compatible category even when income comes first', async () => {
  const save=vi.fn(async(_data:Partial<Transaction>)=>false);
  render(<AddTransactionScreen accounts={[a,b]} selectedAccount={a} categories={[...categories].reverse()} onClose={()=>{}} onSubmit={save}/>);
  fireEvent.keyDown(window,{key:'1'});fireEvent.click(screen.getByRole('button',{name:'Сохранить'}));
  await waitFor(()=>expect(save).toHaveBeenCalled()); expect(save.mock.calls[0][0]).toMatchObject({type:'expense',category_id:'e'});
});

it('Enter on a focused account button leaves native activation intact', () => {
  const save=vi.fn(async(_data:Partial<Transaction>)=>false);
  render(<AddTransactionScreen accounts={[a,b]} selectedAccount={a} categories={categories} onClose={()=>{}} onSubmit={save}/>);
  fireEvent.keyDown(window,{key:'1'});
  const button=screen.getByRole('button',{name:'Счёт списания'}); button.focus();
  expect(fireEvent.keyDown(button,{key:'Enter'})).toBe(true);
  expect(save).not.toHaveBeenCalled();
});

it.each(['Продукты', '  Продукты  ', 'Обед • Продукты'])('editing amount preserves the raw note %s', async note => {
  const save = vi.fn(async (_data: Partial<Transaction>) => false);
  render(<EditTransactionModal isOpen transaction={{...tx, category_name:'Продукты', note}} accounts={[a,b]} categories={categories} onClose={()=>{}} onSave={save} onDelete={vi.fn(async()=>false)}/>);
  expect((screen.getByLabelText('Комментарий') as HTMLInputElement).value).toBe(note);
  fireEvent.change(screen.getByLabelText('Сумма'), {target:{value:'11'}});
  fireEvent.click(screen.getByRole('button',{name:'Сохранить'}));
  await waitFor(()=>expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0]).toMatchObject({amount:11,note});
});
