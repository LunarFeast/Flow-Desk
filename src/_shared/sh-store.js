/* ============================================================
   共用的一层 IndexedDB 助手
   ----------
   从前这两家各写了一份同名的东西：Flow-Desk 的 fd2-store.js 里一整套「开库 + 按键值取放」，
   为写的 w1-core.js 里另一整套「开库 + 一个事务跑完才算数」。函数名一样、形状不一样，
   同一套 IDB 的坑（版本对不上、开不动、被别的窗口占着、事务被中止）分头养，
   一处补了截止时间另一处照旧悬着 —— 外27 全清第 3 条并成这一份，两家都调它。
   #118 卡死的三条规矩（跟着搬过来，两家从此同一套）：
     1) 开库 / 读写都有截止时间，到点就报错，绝不让 await 一直悬着（悬着就是新建作品不动）；
     2) 写操作等事务真提交（oncomplete），不等单条请求的回调（那样提交了个寂寞也返回 true）；
     3) 失败要把原因带回界面，不许静默换后端。
   库开在哪个名字、store 叫什么、降级到 localStorage 还是内存，各家的存档形状不归这里管
   （为写那一头的 mkKv 在 w1-core.js，Flow-Desk 那一头的三后端在 fd2-store.js）。
   ============================================================ */
const IDB_MS = 4000;
/* 这一层递回来的错都是英文，翻成一句能看懂的话，翻不出就原文摆出来，总比只看到"失败"强 */
function reasonOf(e){
  if(!e) return '未知错误';
  if(e instanceof Error && !e.name) return e.message || String(e);
  const n = e.name || '', m = e.message || '';
  if(n === 'QuotaExceededError' || /quota/i.test(n)) return '本地存储满了';
  if(n === 'SecurityError') return '这台机器不让这一页用数据库';
  if(/closing|closed/i.test(m) || n === 'InvalidStateError') return '数据库连接已经关了（另一个窗口占着）';
  if(n === 'TransactionInactiveError') return '事务已经结束';
  if(n === 'AbortError') return '这次操作被中止';
  if(/version/i.test(m)) return '数据库版本对不上（另一个窗口开着老版本）';
  return m || n || String(e);
}
function idbOpen(name, store){
  return new Promise((res, rej) => {
    let rq, settled = false;
    const fail = why => { if(settled) return; settled = true; clearTimeout(timer); rej(new Error(why)); };
    const ok = db => { if(settled) return; settled = true; clearTimeout(timer); res(db); };
    const timer = setTimeout(() => {
      try{ rq.abort(); }catch(e){}
      fail('数据库 ' + IDB_MS / 1000 + ' 秒没响应（可能被另一个窗口占着）');
    }, IDB_MS);
    try{ rq = indexedDB.open(name, 1); }
    catch(e){ fail('打不开数据库：' + reasonOf(e)); return; }
    rq.onupgradeneeded = () => { if(!rq.result.objectStoreNames.contains(store)) rq.result.createObjectStore(store); };
    rq.onsuccess = () => ok(rq.result);
    rq.onerror = () => fail('打不开数据库：' + (rq.error ? reasonOf(rq.error) : '这台机器不让这一页用数据库'));
    rq.onblocked = () => fail('数据库被另一个窗口占用');
  });
}
/* 一个事务跑完才算数：oncomplete 成功，onabort / onerror 把真原因带回；超时先中止再报错 */
function idbRun(db, store, mode, work, tag){
  return new Promise((res, rej) => {
    let tx, out, settled = false;
    const done = () => { if(settled) return; settled = true; clearTimeout(timer); res(out); };
    const fail = why => { if(settled) return; settled = true; clearTimeout(timer); rej(new Error(why)); };
    const timer = setTimeout(() => {
      try{ tx.abort(); }catch(e){}
      fail(tag + '失败：' + IDB_MS / 1000 + ' 秒没跑完（数据库被另一个窗口占着？）');
    }, IDB_MS);
    try{ tx = db.transaction(store, mode); }
    catch(e){ fail(tag + '失败：' + reasonOf(e)); return; }
    tx.oncomplete = done;
    tx.onabort = tx.onerror = ev => fail(tag + '失败：' + reasonOf((ev.target && ev.target.error) || tx.error || ev.target));
    try{ work(tx.objectStore(store), v => { out = v; }); }
    catch(e){ fail(tag + '失败：' + reasonOf(e)); }
  });
}
/* 按键值取放的那一层薄壳（Flow-Desk 的数据层吃的是这一个，接口和它从前自己那份一模一样）。
   库开一次记下来；每一条都走 idbRun，于是上面那三条规矩在这一层也生效。
   开库之后要不要挂 onversionchange（别的窗口来要版本号时先松手）归各家自己定，这儿不替它决定。 */
const IDB = {
  dbs:{},
  async db(name, store){
    if(!this.dbs[name]) this.dbs[name] = await idbOpen(name, store);
    return this.dbs[name];
  },
  async get(name, store, key){
    const db = await this.db(name, store);
    return idbRun(db, store, 'readonly', (os, put) => { const rq = os.get(key); rq.onsuccess = () => put(rq.result); }, '读');
  },
  async put(name, store, val, key){
    const db = await this.db(name, store);
    await idbRun(db, store, 'readwrite', os => os.put(val, key), '存');
  },
  async del(name, store, key){
    const db = await this.db(name, store);
    await idbRun(db, store, 'readwrite', os => os.delete(key), '删');
  },
  /* 这一个库里躺着的键，按前缀筛（不筛就把整库都当成一个目录捞出来了） */
  async keys(name, store, prefix){
    const db = await this.db(name, store);
    const ks = await idbRun(db, store, 'readonly', (os, put) => { const rq = os.getAllKeys(); rq.onsuccess = () => put(rq.result); }, '列') || [];
    return ks.filter(k => String(k).startsWith(prefix || ''));
  }
};
