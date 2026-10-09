import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { App } from './App';
import { Account } from './types';
import { clearSession } from './api/session';
const base: Account={id:'a',user_id:1,name:'Synthetic',currency:'RUB',balance:100,icon:'💳',color:'#fff',group_name:'Личное',is_default:true,sort_order:0};
afterEach(()=>{cleanup();vi.unstubAllGlobals();clearSession();delete window.Telegram;});
test.each([undefined, {}])('account lost/incomplete response %j retries one intent with unchanged initial balance',async ack=>{
 window.Telegram={WebApp:{initData:'signed',ready(){},expand(){},initDataUnsafe:{}}} as any;
 const saved=new Map<string,Account>();const payloads:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(path:string,opts?:RequestInit)=>{
  if(path==='/api/accounts'&&opts?.method==='POST'){
   const data=JSON.parse(String(opts.body));payloads.push(data);
   if(!saved.has(data.client_id))saved.set(data.client_id,{...base,...data,id:'new-'+saved.size,balance:Number(data.balance)});
   if(payloads.length===1){if(ack===undefined)throw new Error('commit -> response lost');return new Response(JSON.stringify(ack));}
   return new Response(JSON.stringify(saved.get(data.client_id)));
  }
  if(path.includes('/accounts'))return new Response(JSON.stringify([base,...saved.values()]));
  if(path.includes('/analytics'))return new Response(JSON.stringify({currency:'RUB',balances_by_currency:{RUB:100+[...saved.values()].reduce((sum,a)=>sum+a.balance,0)},total_balance:100+[...saved.values()].reduce((sum,a)=>sum+a.balance,0),period_label:'2026-10',period_income:0,period_expense:0,categories:[],recent_transactions:[]}));
  return new Response('[]');
 }));
 const view=render(<App/>);fireEvent.click(await view.findByLabelText('Открыть счета'));fireEvent.click(view.getByLabelText('Создать счёт'));
 fireEvent.change(view.getByLabelText('Название счёта'),{target:{value:'Initial1000'}});fireEvent.change(view.getByLabelText('Начальный баланс'),{target:{value:'1000'}});
 fireEvent.click(view.getByLabelText('Сохранить'));await view.findByText(/Счёт мог быть создан/);
 expect(view.getByLabelText('Название счёта').matches(':disabled')).toBe(true);
 fireEvent.click(within(view.getByRole('dialog',{name:'Счёт'})).getByLabelText('Назад'));fireEvent.keyDown(document,{key:'Escape'});expect(view.getByLabelText('Начальный баланс')).toBeTruthy();
 fireEvent.click(view.getByLabelText('Сохранить'));await waitFor(()=>expect(view.queryByLabelText('Начальный баланс')).toBeNull());
 expect(payloads).toHaveLength(2);expect(payloads[0].client_id).toBeTruthy();expect(payloads[1]).toEqual(payloads[0]);expect(saved.size).toBe(1);expect([...saved.values()][0].balance).toBe(1000);
});
