import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const root = new URL('../source/frontend/src/', import.meta.url);
async function load(path) {
 let src=fs.readFileSync(new URL(path,root),'utf8').replace(/^import .* from .*;\r?\n/gm,'').replace('import.meta.env.VITE_API_URL', "'https://local.invalid'");
 return import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(src)).toString('base64'));
}
let storage=new Map();
globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
globalThis.window={location:{href:'https://local.invalid'}};
const p=await load('utils/voiceParser.ts');
const c=await load('api/client.ts');
const results=[];
for(const phrase of ['потратила 5 тысяч рублей','сто рублей пятьдесят копеек','две с половиной сотни','перевод получила 500 рублей']) {
 results.push({test:'voice',phrase,amount:p.parseRussianNumberWords(phrase),type:p.parseFinancialSpeech(phrase,c.INITIAL_CATEGORIES,c.INITIAL_ACCOUNTS,c.INITIAL_ACCOUNTS[0]).type});
}
globalThis.fetch=async()=>({ok:false,status:401});
results.push({test:'create401',result:await c.createTransactionAPI('',{account_id:'a',amount:42,type:'expense'})});
globalThis.fetch=async()=>{throw new Error('offline')};
results.push({test:'deleteOffline',result:await c.deleteTransactionAPI('','x')});
storage.clear();
globalThis.fetch=async()=>({ok:true,json:async()=>[]});
results.push({test:'emptyAccountList',count:(await c.fetchAccounts('')).length});
storage.clear();
c.recordUserAccountMod('a',{id:'a',name:'Test',balance:900},'updated');
results.push({test:'balanceOverride',server:800,result:c.mergeAccountsWithLocalMods([{id:'a',name:'Test',balance:800}])[0].balance});
storage.clear();
c.saveStoredCategories(Array.from({length:35},(_,i)=>({id:String(i),name:'X'})));
results.push({test:'35categories',count:(await c.fetchCategories('')).length});
storage.clear();
c.saveStoredSyncData({recent_transactions:[{id:'x',amount:10,type:'expense',created_at:'2026-09-26T12:00:00Z'}]});
globalThis.fetch=async()=>({ok:true,json:async()=>({recent_transactions:[{id:'x',amount:20,type:'expense',created_at:'2026-09-26T12:00:00Z'}]})});
results.push({test:'serverTransactionEdit',server:20,result:(await c.fetchDashboard('')).recent_transactions.find(t=>t.id==='x').amount});
console.log(JSON.stringify(results,null,2));
