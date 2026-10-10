/* 外27 全清第 3 条：_shared/sh-store.js 那份并好的 IDB 助手实测
   吃的是文件里真实的源码文本（整份塞进 vm），配一把假 indexedDB。
   盯的几条：
     1) get / put / del / keys 四条路走得通，keys 的前缀筛得对，同一个库只开一次；
     2) 写操作等的是事务真提交（oncomplete），不是单条请求的 onsuccess；
     3) 库开不动时到点报错，不许让 await 一直悬着（IDB_MS = 4 秒，这一条要等满 4 秒）；
     4) 失败带回的是翻成人话的原因，不是光一个 error。 */
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync('D:/Programs/Flow-Desk/src/_shared/sh-store.js', 'utf8');

function makeStore(){
  const data = new Map();
  const log = [];
  const db = {
    close(){ log.push('close'); },
    objectStoreNames:{ contains:() => true },
    createObjectStore(){ return {}; },
    transaction(store, mode){
      const tx = { _aborted:false,
        objectStore(){ return {
          get(k){ const rq = {}; setTimeout(() => { rq.result = data.get(k); rq.onsuccess && rq.onsuccess(); }, 0); return rq; },
          getAllKeys(){ const rq = {}; setTimeout(() => { rq.result = [...data.keys()]; rq.onsuccess && rq.onsuccess(); }, 0); return rq; },
          put(v, k){ const rq = {}; data.set(k, v); setTimeout(() => { rq.onsuccess && rq.onsuccess(); }, 0); return rq; },
          delete(k){ const rq = {}; data.delete(k); setTimeout(() => { rq.onsuccess && rq.onsuccess(); }, 0); return rq; }
        }; },
        abort(){ tx._aborted = true; if(tx.onabort) tx.onabort({ target:{ error:{ name:'AbortError' } } }); },
        set oncomplete(f){ log.push('req-then-complete'); setTimeout(() => { if(!tx._aborted) f(); }, 3); },
        set onabort(f){ tx._abort = f; },
        set onerror(f){ tx._error = f; }
      };
      return tx;
    }
  };
  return { db, data, log };
}

let opens = 0;
function factory(db){
  return { open:() => { opens++; const rq = {}; setTimeout(() => { rq.result = db; rq.onsuccess && rq.onsuccess(); }, 0); return rq; } };
}
function sandbox(idb){
  const ctx = { indexedDB:idb, setTimeout, clearTimeout, console, Date, Math, JSON, String, Number, Error, Array, Object, isFinite, parseFloat, Promise };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  /* 顶层的 const 不挂在 global 上，再跑一趟把它们取出来 */
  vm.runInContext('globalThis.X = { IDB, reasonOf, idbOpen, idbRun };', ctx);
  return ctx.X;
}

const out = [];
const ok = (name, pass, note) => out.push({ name, pass, note:note || '' });

/* ---------- 1 · 四条路 ---------- */
{
  const { db, data } = makeStore();
  const X = sandbox(factory(db));
  await X.IDB.put('fd-files', 'files', { value:1 }, 'a.json');
  await X.IDB.put('fd-files', 'files', { value:2 }, 'sub/b.json');
  const g = await X.IDB.get('fd-files', 'files', 'a.json');
  const ks = await X.IDB.keys('fd-files', 'files', 'sub/');
  const all = await X.IDB.keys('fd-files', 'files', '');
  await X.IDB.del('fd-files', 'files', 'a.json');
  const g2 = await X.IDB.get('fd-files', 'files', 'a.json');
  ok('put / get / del 走得通', JSON.stringify(g) === '{"value":1}' && g2 === undefined,
    '读回 ' + JSON.stringify(g) + '，删掉之后读回 ' + JSON.stringify(g2));
  ok('keys 按前缀筛', ks.length === 1 && ks[0] === 'sub/b.json' && all.length === 2,
    'sub/ 得到 ' + JSON.stringify(ks) + '，空前缀得到 ' + all.length + ' 条');
  ok('同一个库只开一次', opens === 1, '这几趟一共开了 ' + opens + ' 回');
  ok('假库里落了又删干净', data.size === 1);
}

/* ---------- 2 · 等的是事务真提交 ---------- */
{
  const { db } = makeStore();
  const X = sandbox(factory(db));
  const t0 = Date.now();
  await X.IDB.put('x', 'kv', 1, 'k');
  const spent = Date.now() - t0;
  /* 假库里请求的 onsuccess 在 0 毫秒就好，事务的 oncomplete 在 3 毫秒：等到的该是后一头 */
  ok('写操作等事务 oncomplete，不等请求 onsuccess', spent >= 2, '这一趟 await 走了 ' + spent + ' 毫秒');
}

/* ---------- 3 · 开库卡住要报错 ---------- */
{
  const X = sandbox({ open:() => ({}) });   /* 永远不 onsuccess、也不 onerror */
  const t0 = Date.now();
  let err = '';
  try{ await X.IDB.db('hang', 'kv'); }catch(e){ err = e.message; }
  const spent = Date.now() - t0;
  ok('库开不动时到点报错、不悬着', /4 秒没响应/.test(err) && spent >= 3900 && spent < 5500,
    spent + ' 毫秒之后报：' + err);
}

/* ---------- 4 · 原因翻成人话 ---------- */
{
  const X = sandbox({ open:() => ({}) });
  ok('reasonOf 认得出配额', X.reasonOf({ name:'QuotaExceededError' }) === '本地存储满了');
  ok('reasonOf 认得出权限', X.reasonOf({ name:'SecurityError' }) === '这台机器不让这一页用数据库');
  ok('reasonOf 认得出事务结束', X.reasonOf({ name:'TransactionInactiveError' }) === '事务已经结束');
  ok('reasonOf 认得出自己造的错误', X.reasonOf(new Error('就地写的一句')) === '就地写的一句');
  const bad = { transaction:() => { throw { name:'InvalidStateError', message:'' }; } };
  let m = '';
  try{ await X.IDB.get.call({ db:async () => bad }, 'x', 'kv', 'k'); }catch(e){ m = e.message; }
  ok('事务起不来时把原因带在句子里', /读失败：数据库连接已经关了/.test(m), m);
}

/* ---------- 5 · 开库直接被拒 ---------- */
{
  const X = sandbox({ open:() => { const rq = {};
    setTimeout(() => { rq.error = { name:'SecurityError' }; rq.onerror && rq.onerror(); }, 0); return rq; } });
  let m = '';
  try{ await X.IDB.db('nope', 'kv'); }catch(e){ m = e.message; }
  ok('开库失败报的是翻过的话', /打不开数据库：这台机器不让这一页用数据库/.test(m), m);
}

let pass = 0;
for(const r of out){ console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.note ? '  ｜ ' + r.note : '')); if(r.pass) pass++; }
console.log('—— ' + pass + ' / ' + out.length + ' 条过');
process.exit(pass === out.length ? 0 : 1);
