import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { EditAccountModal } from './EditAccountModal';
import { EditTransactionModal } from './EditTransactionModal';
import { ProposalRow } from '../ai/ProposalRow';
import { Account, Category, Transaction } from '../../types';
const account: Account = {id:'a',user_id:1,name:'Накопления на отпуск',currency:'RUB',balance:100,icon:'💳',color:'#fff',group_name:'Личное',is_default:true,sort_order:0};
const category: Category = {id:'e',name:'Подарки',type:'expense',icon:'📦',color:'#fff'};
const tx: Transaction = {id:'tx',user_id:1,account_id:'a',revision:1,currency:'RUB',amount:10,type:'expense',note:'',created_at:'2026-10-09T10:00:00Z',category_id:'archived',category_name:'Прежняя категория',category_icon:'🧰'};
afterEach(cleanup);
test('editing account preserves its actual custom name in input and request',async()=>{
 const save=vi.fn(async (_p:Partial<Account>)=>true);const view=render(<EditAccountModal isOpen account={{...account,bank_name:'Альфа-Банк'}} onClose={()=>{}} onSave={save}/>);
 expect((view.getByLabelText('Название счёта') as HTMLInputElement).value).toBe(account.name);
 fireEvent.click(view.getByLabelText('Сохранить'));await waitFor(()=>expect(save).toHaveBeenCalledOnce());
 expect(save.mock.calls[0][0].name).toBe(account.name);
});
test.each(['account','transaction'])('%s pending save blocks editing, closing and duplicate submit',async kind=>{
 let finish!:(ok:boolean)=>void;const pending=new Promise<boolean>(r=>finish=r);const save=vi.fn(()=>pending);const close=vi.fn();
 const view=kind==='account'?render(<EditAccountModal isOpen account={account} onClose={close} onSave={save}/>):render(<EditTransactionModal isOpen transaction={tx} accounts={[account]} categories={[]} onClose={close} onSave={save} onDelete={vi.fn(async()=>false)}/>);
 fireEvent.click(view.getByLabelText('Сохранить'));
 expect(view.getByLabelText(kind==='account'?'Название счёта':'Сумма').matches(':disabled')).toBe(true);
 const back=view.getByLabelText(kind==='account'?'Назад':'Закрыть');expect(back.matches(':disabled')).toBe(true);
 fireEvent.click(back);fireEvent.keyDown(document,{key:'Escape'});fireEvent.click(view.getByLabelText('Сохранить'));
 expect(close).not.toHaveBeenCalled();expect(save).toHaveBeenCalledOnce();
 await act(async()=>finish(false));
 expect(view.getByRole('alert')).toBeTruthy();
 expect(view.getByLabelText(kind==='account'?'Название счёта':'Сумма').matches(':disabled')).toBe(false);
});
test('income proposal resolves duplicate category names only among compatible types',async()=>{
 const save=vi.fn(async (_p:any)=>true);const view=render(<ProposalRow proposal={{type:'income',amount:'10',category_name:'Подарки'}} accounts={[account]} categories={[category,{...category,id:'i',type:'income'}]} onSave={save}/>);
 expect((view.getByLabelText('Категория') as HTMLSelectElement).value).toBe('i');
 fireEvent.click(view.getByText('Подтвердить и сохранить'));await waitFor(()=>expect(save).toHaveBeenCalledOnce());
 expect(save.mock.calls[0][0]).toMatchObject({category_id:'i',type:'income'});
});
test('transfer destination permits credit accounts and excludes source, archive and other currency',()=>{
 const credit={...account,id:'b',name:'Кредитная карта',group_name:'Кредиты'};
 const view=render(<EditTransactionModal isOpen transaction={{...tx,type:'transfer',to_account_id:'b'}} accounts={[account,credit,{...account,id:'usd',name:'Dollar',currency:'USD'},{...account,id:'arch',name:'Archive',is_archived:true}]} categories={[]} onClose={()=>{}} onSave={vi.fn(async()=>false)} onDelete={vi.fn(async()=>false)}/>);
 fireEvent.click(view.getByLabelText('Счёт зачисления'));const sheet=within(view.getByRole('dialog',{name:'Выберите счёт'}));
 expect(sheet.getByText('Кредитная карта')).toBeTruthy();expect(sheet.queryByText('Dollar')).toBeNull();expect(sheet.queryByText('Archive')).toBeNull();expect(sheet.queryByText(account.name)).toBeNull();
});
test('archived category remains visibly named and is preserved on unrelated edit',async()=>{
 const save=vi.fn(async (_p:any)=>false);const view=render(<EditTransactionModal isOpen transaction={tx} accounts={[account]} categories={[]} onClose={()=>{}} onSave={save} onDelete={vi.fn(async()=>false)}/>);
 expect(view.getByText('Прежняя категория (архивная)')).toBeTruthy();expect(view.queryByText('Без категории')).toBeNull();
 fireEvent.change(view.getByLabelText('Комментарий'),{target:{value:'updated'}});fireEvent.click(view.getByLabelText('Сохранить'));
 await waitFor(()=>expect(save).toHaveBeenCalledOnce());expect(save.mock.calls[0][0].category_id).toBe('archived');
});

test('pending delete prevents cancellation and edit; rejection stays visible inside confirmation',async()=>{
 let finish!:(ok:boolean)=>void;const remove=vi.fn(()=>new Promise<boolean>(r=>finish=r));const close=vi.fn();
 const view=render(<EditTransactionModal isOpen transaction={tx} accounts={[account]} categories={[]} onClose={close} onSave={vi.fn(async()=>true)} onDelete={remove}/>);
 fireEvent.click(view.getByLabelText('Удалить операцию'));fireEvent.click(view.getByRole('button',{name:'Удалить'}));
 const confirmation=within(view.getByRole('dialog',{name:'Удалить операцию?'}));
 expect(confirmation.getByText('Отмена').matches(':disabled')).toBe(true);expect(view.getByLabelText('Сумма').matches(':disabled')).toBe(true);
 fireEvent.click(confirmation.getByText('Отмена'));fireEvent.keyDown(document,{key:'Escape'});expect(close).not.toHaveBeenCalled();expect(remove).toHaveBeenCalledOnce();
 await act(async()=>finish(false));expect(confirmation.getByRole('alert').textContent).toContain('Не удалось удалить');expect(view.getByRole('dialog',{name:'Удалить операцию?'})).toBeTruthy();
});
