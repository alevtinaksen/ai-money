import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { TransactionsScreen } from './TransactionsScreen';
import { CategoryAnalyticsScreen } from '../categories/CategoryAnalyticsScreen';
import { Transaction } from '../../types';
const tx: Transaction={id:'tx',user_id:1,account_id:'a',revision:1,currency:'RUB',amount:10,type:'expense',note:'search target',created_at:new Date().toISOString()};
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers();});
test('seven days excludes future and old transactions but retains recent operation',()=>{
 const view=render(<TransactionsScreen transactions={[tx,{...tx,id:'future',note:'future',created_at:new Date(Date.now()+30*86400000).toISOString()},{...tx,id:'old',note:'old',created_at:new Date(Date.now()-8*86400000).toISOString()}]} accounts={[]} categories={[]} onBack={()=>{}} onSelectTransaction={()=>{}} onOpenAddTransaction={()=>{}}/>);
 fireEvent.click(view.getByLabelText('Поиск и фильтры'));fireEvent.change(view.getByLabelText('Период'),{target:{value:'7days'}});
 expect(view.getByText(/search target/)).toBeTruthy();expect(view.queryByText(/• future/)).toBeNull();expect(view.queryByText(/• old/)).toBeNull();
});
test.each([' search target ', '10.00','10,00','-10.00','-10,00 ₽'])('history searches displayed amount or trimmed text: %s',query=>{
 const view=render(<TransactionsScreen transactions={[tx]} accounts={[]} categories={[]} onBack={()=>{}} onSelectTransaction={()=>{}} onOpenAddTransaction={()=>{}}/>);
 fireEvent.click(view.getByLabelText('Поиск и фильтры'));fireEvent.change(view.getByLabelText('Поиск'),{target:{value:query}});expect(view.getByText(/search target/)).toBeTruthy();
});
test('category result crossing month boundary retains server period label',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-31T23:59:59.900Z'));
 let finish!:(r:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(r=>finish=r)));
 const view=render(<CategoryAnalyticsScreen auth="signed" category={{id:'c',name:'Категория',type:'expense',icon:'📦',color:'#fff'}} initialMonth={0} currency="RUB" kind="expense" onClose={()=>{}} onSelectTransaction={()=>{}}/>);
 expect(view.getByText('октябрь 2026 г.')).toBeTruthy();vi.setSystemTime(new Date('2026-11-01T00:00:00.100Z'));
 await act(async()=>finish(new Response(JSON.stringify({category_id:'c',period_label:'2026-10',currency:'RUB',kind:'expense',total_amount:777,transaction_count:0,breakdown:[],transactions:[]}))));
 expect(view.getByText('октябрь 2026 г.')).toBeTruthy();expect(view.queryByText('ноябрь 2026 г.')).toBeNull();expect(view.getByText('777')).toBeTruthy();
});
