/* ============================================================
   中立词库层 · 组件定制生成的那些功能共用
   WNW 和 FD 都读这一份代码、同一份 data.txt：宿主只负责告诉它
   "文件在哪、存覆盖层用哪个库、用户手动选过的那份存在哪儿"。
   宿主要在本文件之前装好 window.TOOL_HOST（用 getter，别在装载时就取全局量）：
     kv                 { get(k,fb) / put(k,v) / del(k) }   覆盖层与选中的原文存这里
     bankDir            数据层那一级的前缀（自建词库和包自带底本都往它后面接）
     picked(which)      用户手动选过的那份原文（存在宿主 kv 里），没选过返回 null
   h() / toast() / Bus 两个宿主同名同义，直接用全局的。
   ============================================================ */
const H = () => window.TOOL_HOST;
/* 删之前问一句。_shared 这几家不许叫 wnwAsk —— 那是为写骨架里的函数，Flow-Desk 自己那一框没有它；
   照 genDeleteAsk 那一写法用宿主给的对话框搭一枚共用的，两个宿主都使得。
   宿主没给对话框（比如被谁单独拿去跑）时退回浏览器自己那一句，至少不漏掉这一问。 */
function shAsk(q, yes){
  return new Promise(res => {
    const T = H();
    if(!T || !T.dlg || typeof T.dlg.open !== 'function'){ res(window.confirm(q)); return; }
    const done = v => { T.dlg.close(); res(v); };
    T.dlg.open('请确认', h('div', { class:'wnw-hint', style:'line-height:1.9' }, q), [
      h('button', { class:'wnw-btn primary', onclick:() => done(true) }, yes || '删除'),
      h('button', { class:'wnw-btn mini', onclick:() => done(false) }, '取消')
    ]);
  });
}
/* ---------- 词库跟着功能走 ----------
   哪份词库属于哪个包，写在包的说明书里：bank:{ which, name, file, user }。
     file  = 包里那份出厂底本叫什么（默认 bank.txt）
     user  = 用户改过的那份落在数据层哪儿（<包名>-bank/data.txt），没有就当没改过
   所以名字、路径、底本全都从包上现取，这文件里不硬写任何一家的词库名和目录名。
   产物里没有这个包（卸掉了），它那份词库也就从名单里没了 —— 界面不会剩一份没主的库。 */
function bankDecl(which){
  if(typeof Packs === 'undefined') return null;
  for(const m of Packs.list()) if(m.bank && m.bank.which === which) return m;
  return null;
}
/* which → 包 id（读包里底本要用它去问宿主） */
function bankPack(which){
  const m = bankDecl(which);
  return m ? m.id : '';
}
/* 词库各自叫什么：从小提示、编辑器到生成器都读这张表。
   运行时加载器（sh-load.js）把说明书一家家填进 PACK_META 之后调这一趟，BANK_NAME 才认得全；
   开机时 PACK_META 还是空的，所以不能再拿一个 IIFE 在装载时就定死。 */
const BANK_NAME = {};
function bankSync(){
  if(typeof Packs === 'undefined') return BANK_NAME;
  const list = Packs.list();
  for(const m of list) if(m.bank && m.bank.which) BANK_NAME[m.bank.which] = m.bank.name || m.bank.which;
  /* 功能说明书那一份还没读到时名单就是空的，别拿假名字顶上去 */
  return BANK_NAME;
}
/* 用户在生成器里自建的词库：which 统一是 'b:' + 词库名，明文落在 <词库名>/data.txt，
   和内置那两份一模一样的形状。名单记在 plugins/banks.json，两个宿主读同一份。 */
const BANK_CUSTOM = [];

/* 每个词库要能按名字反查 which：向导里选词库、配方里写词库名，都走这个 */
function bankWhich(name){
  const k = Object.keys(BANK_NAME).find(w => BANK_NAME[w] === name);
  return k || ('b:' + String(name).replace(/^b:/, ''));
}

/* ============================================================
   词库明文：【分类.路径】打头，一行一条；每个功能各读各的库，互不覆盖。
   取文顺序：用户那一份 fetch → 包里的出厂底本 → 手动选过的那份 → 普通 fetch。
   覆盖按分类存，改一条只写一条，改完广播让所有实例重解析，立刻生效。 */
const Banks = {
  _base:{}, _ov:{}, _live:{},
  name(which){ return BANK_NAME[which] || String(which).replace(/^b:/, ''); },
  /* 用户那一个明文落在哪儿：先让宿主点名指路（老写法还认），
     再问这个包的说明书（bank.user），最后按目录名推（自建词库那种）。 */
  path(which){
    const H2 = H();
    if(H2.file && H2.file[which]) return H2.file[which];
    const m = bankDecl(which);
    if(m && m.bank && m.bank.user) return (H2.bankDir || '') + m.bank.user;
    return (H2.bankDir || '') + this.name(which) + '/data.txt';
  },
  /* 所有词库名：内置在前，自建按名字排；生成器向导和词库编辑器都从这里取 */
  list(){ return Object.values(BANK_NAME).concat(BANK_CUSTOM.slice().sort()); },
  /* 包自带的词库（说明书上点了 bank 的那几个包）：词库删除那个按钮不碰它们。
     要连词库一起带走走的是「卸掉插件 + 同步清除数据」那条路，删了包才算删了库。 */
  isBuiltin(name){ return Object.values(BANK_NAME).includes(String(name || '').trim()); },
  /* 名单只读一次；读不到（这份名单还没建起来）就是空表，不影响内置两份 */
  async loadReg(){
    const rel = (H().components || 'plugins/') + 'banks.json';
    try{
      const r = await fetch(rel, { cache:'no-store' });
      if(!r.ok) return BANK_CUSTOM;
      const d = await r.json();
      BANK_CUSTOM.length = 0;
      for(const n of (d && d.banks) || []) if(typeof n === 'string' && !BANK_CUSTOM.includes(n) && !Object.values(BANK_NAME).includes(n)) BANK_CUSTOM.push(n);
    }catch(e){}
    return BANK_CUSTOM;
  },
  /* 新建词库 = 建目录 + 一份带示例分类的明文 + 名单里加一笔。写盘只有 exe 做得到。 */
  async create(name){
    const nm = String(name || '').trim();
    if(!nm) throw new Error('词库名不能是空的');
    if(/[\\/:*?"<>|]/.test(nm)) throw new Error('词库名里不能有 \\ / : * ? " < > |');
    if(this.list().includes(nm)) throw new Error('已经有叫「' + nm + '」的词库了，换个名字');
    if(!(window.FD_APP && window.FD_APP.writePageFile)) throw new Error('建目录这条通道只在 Flow-Desk 程序里有 · 这份词库没建起来');
    const A = H();
    const sample = '【示例.大类】\n条目一\n条目二\n';
    await window.FD_APP.writePageFile(this.path(bankWhich(nm)), sample);
    const next = BANK_CUSTOM.concat([nm]).sort();
    await window.FD_APP.writePageFile((A.components || 'plugins/') + 'banks.json', JSON.stringify({ banks:next }, null, 2));
    BANK_CUSTOM.length = 0; BANK_CUSTOM.push(...next);
    Bus.emit('bank-new', nm);
    return nm;
  },
  /* 删词库 = 整个目录带走 + 从名单里摘掉 + 抹掉这台机器上的镜像。
     只认自建的那几个：包自带的词库跟着包走，卸包才算删库，这一条不碰它们。 */
  async remove(name){
    const nm = String(name || '').trim();
    if(!nm) throw new Error('词库名是空的');
    if(Object.values(BANK_NAME).includes(nm)) throw new Error('「' + nm + '」是自带的模型，不动它');
    const A = H();
    if(!(window.FD_APP && window.FD_APP.delPageFile)) throw new Error('删文件这条通道只在 Flow-Desk 程序里有 · 这份词库没删掉');
    await window.FD_APP.delPageFile((A.bankDir || '') + nm, true);
    const next = BANK_CUSTOM.filter(n => n !== nm);
    await window.FD_APP.writePageFile((A.components || 'plugins/') + 'banks.json', JSON.stringify({ banks:next }, null, 2));
    BANK_CUSTOM.length = 0; BANK_CUSTOM.push(...next);
    await A.kv.del('banktxt.b:' + nm);
    Bus.emit('bank-del', nm);
    return nm;
  },
  async text0(which){
    const H2 = H();
    const rel = this.path(which);
    if(window.FD_APP && window.FD_APP.root){
      try{ const r = await fetch(rel, { cache:'no-store' }); if(r.ok) return await r.text(); }
      catch(e){}
      /* 用户那一份还没生成过（或者被「同步清除数据」带走了）：读这个包里自带的那份底本。
         底本在包里而不是产物里，所以改了包不用重新生成页面也能读到新的一版。 */
      const m = bankDecl(which);
      if(m && m.bank && m.bank.file && typeof window.FD_APP.packFile === 'function'){
        try{
          const r = await window.FD_APP.packFile(m.id, m.bank.file);
          if(r && r.ok && r.text != null) return r.text;
        }catch(e){}
      }
    }
    const pk = H2.picked && await H2.picked(which);
    if(pk != null) return pk;
    let r;
    try{ r = await fetch(rel, { cache:'no-store' }); }
    catch(e){ throw new Error('词库读不到：' + rel + '（这一家没带底本 · 点「换一份词库文件」挑一份）'); }
    if(!r.ok) throw new Error('词库读不到：' + rel + '（' + r.status + '）');
    return await r.text();
  },
  async base(which){
    if(this._base[which] != null) return this._base[which];
    return (this._base[which] = await this.text0(which));
  },
  async ov(which){
    if(!this._ov[which]) this._ov[which] = (await H().kv.get('bankov.' + which, {})) || {};
    return this._ov[which];
  },
  /* 把覆盖套回原文，拼成当前生效的词库全文 */
  async text(which){
    const base = await this.base(which);
    const ov = await this.ov(which);
    const { lines, cats } = this.split(base);
    if(!Object.keys(ov).length) return base;
    const used = new Set();
    const out = [];
    for(const c of cats){
      out.push('【' + c.name + '】');
      used.add(c.name);
      const body = ov[c.name] !== undefined ? ov[c.name] : lines.slice(c.from, c.to).map(s => s.trim()).filter(Boolean);
      for(const l of body) out.push(l);
    }
    for(const k of Object.keys(ov)) if(!used.has(k) && ov[k] !== null){ out.push('【' + k + '】'); for(const l of ov[k]) out.push(l); }
    return out.join('\n');
  },
  /* 按分类切片，编辑器一次只改一个分类，不把 2.27MB 塞进一个 textarea */
  split(txt){
    const out = []; let cur = null;
    const lines = String(txt).split('\n');
    for(let i = 0; i < lines.length; i++){
      const m = /^【(.+)】$/.exec(lines[i].trim());
      if(m){ cur = { name: m[1], from: i + 1, to: i + 1 }; out.push(cur); continue; }
      if(cur) cur.to = i + 1;
    }
    if(!out.length) out.push({ name:'（无分类）', from:0, lines:[] });
    return { lines, cats: out };
  },
  async cats(which){
    const base = await this.base(which);
    const ov = await this.ov(which);
    const { lines, cats } = this.split(base);
    const names = cats.map(c => c.name);
    for(const k of Object.keys(ov)) if(!names.includes(k)) names.push(k);
    return names.map((n, i) => ({
      name:n, edited: ov[n] !== undefined, added: !cats.some(c => c.name === n),
      lines: () => ov[n] !== undefined ? ov[n] : (cats[i] ? lines.slice(cats[i].from, cats[i].to).map(s => s.trim()).filter(Boolean) : [])
    }));
  },
  /* 【大类.中类.小类】里的点号就是一层，深度不限（押韵那份用到四层）。
     父级自己也是个分类时，这个节点既能点开又能选。
     顺序跟着文件里的出现顺序走，不重排；分组节点带整棵子树的条数和"下面改过没有"。 */
  async tree(which){
    const root = [], idx = new Map();
    for(const c of await this.cats(which)){
      const parts = String(c.name).split('.').filter(s => s !== '');
      let level = root, path = '';
      for(let i = 0; i < parts.length; i++){
        path = i ? path + '.' + parts[i] : parts[i];
        let node = idx.get(path);
        if(!node){ node = { name:path, label:parts[i], depth:i, kids:[], cat:null, edited:false, count:0 }; idx.set(path, node); level.push(node); }
        if(i === parts.length - 1) node.cat = c;
        level = node.kids;
      }
    }
    for(const n of root) this.treeStat(n);
    return root;
  },
  /* 父级自己也是一类时，它的条数只算自己那一类，count 是整棵子树的总数；
     子孙里谁改过，一路把 edited 带上去，折叠着的分支也能看见那个点。 */
  treeStat(n){
    let c = 0, e = false;
    if(n.cat){ c += n.cat.lines().length; e = n.cat.edited; }
    for(const k of n.kids){ c += this.treeStat(k).count; if(k.edited) e = true; }
    n.count = c; n.edited = e; return n;
  },
  async catLines(which, name){
    const ov = await this.ov(which);
    if(ov[name] !== undefined) return ov[name].slice();
    const base = await this.base(which);
    const { lines, cats } = this.split(base);
    const c = cats.find(x => x.name === name);
    return c ? lines.slice(c.from, c.to).map(s => s.trim()).filter(Boolean) : [];
  },
  /* 打包原文里这一类长什么样：编辑器拿它判断"改过没有"、"填入原文" */
  async catBase(which, name){
    const base = await this.base(which);
    const { lines, cats } = this.split(base);
    const c = cats.find(x => x.name === name);
    return c ? lines.slice(c.from, c.to).map(s => s.trim()).filter(Boolean) : [];
  },
  /* 保存一个分类 → 让所有读这个词库的生成器实例立刻重解析 */
  async setCat(which, name, linesArr){
    const ov = await this.ov(which);
    ov[name] = (linesArr || []).map(s => String(s).trim()).filter(Boolean);
    await H().kv.put('bankov.' + which, ov);
    this._live[which] = (this._live[which] || 0) + 1;
    return ov[name];
  },
  async clearCat(which, name){
    const ov = await this.ov(which);
    delete ov[name];
    await H().kv.put('bankov.' + which, ov);
    this._live[which] = (this._live[which] || 0) + 1;
  },
  /* 改名：自建分类挪走覆盖键即可；自带分类改名会把原名清空，内容整体挪到新名 */
  async renameCat(which, from, to){
    const ov = await this.ov(which);
    const lines = (ov[from] || await this.catLines(which, from)).slice();
    ov[to] = lines;
    if((await this.catBase(which, from)).length) ov[from] = [];
    else delete ov[from];
    await H().kv.put('bankov.' + which, ov);
    this._live[which] = (this._live[which] || 0) + 1;
  },
  /* 整枝改名（右键点树上那种只管分层、自己不是分类的节点）：
     底下每一条分类一路跟着挪，规则和 renameCat 一样 —— 自带那份留个空壳，新名接走内容。 */
  async renameTree(which, from, to){
    const ov = await this.ov(which);
    const moved = [];
    for(const c of await this.cats(which)){
      const n = c.name;
      let nn = '';
      if(n === from) nn = to;
      else if(n.startsWith(from + '.')) nn = to + n.slice(from.length);
      if(!nn || ov[nn] !== undefined) continue;
      ov[nn] = (ov[n] || await this.catLines(which, n)).slice();
      if((await this.catBase(which, n)).length) ov[n] = [];
      else delete ov[n];
      moved.push({ from:n, to:nn });
    }
    await H().kv.put('bankov.' + which, ov);
    this._live[which] = (this._live[which] || 0) + 1;
    return moved;
  },
  async reset(which){
    this._ov[which] = {};
    await H().kv.del('bankov.' + which);
    this._live[which] = (this._live[which] || 0) + 1;
  },
  async editedCount(which){ return Object.keys(await this.ov(which)).length; },
  /* Flow-Desk 程序：把当前生效的整份词库写回同目录那个 txt，写成功就把覆盖层清空（文件成了唯一一份）。
     本地开发那台服务器没接这条，返回 null，改动继续留在覆盖层里。 */
  async writeFile(which){
    if(!(window.FD_APP && window.FD_APP.root && window.FD_APP.writePageFile)) return null;
    const rel = this.path(which);
    try{
      const txt = await this.text(which);
      await window.FD_APP.writePageFile(rel, txt);
      this._ov[which] = {}; this._base[which] = txt;
      await H().kv.put('bankov.' + which, {});
      return { ok:true, file: rel.replace(/^(\.\.\/)+/, '') };
    }catch(e){ return { ok:false, file: rel.replace(/^(\.\.\/)+/, ''), err: (e && e.message) || String(e) }; }
  },
  /* 生成器注册进来，编辑保存后由这里统一广播。同一份词库只挂一次：
     几家宿主模块都可能先绑上，重复绑会让一次保存重解析好几遍。 */
  bind(bank){
    this._bound = this._bound || new Set();
    if(this._bound.has(bank.which)) return;
    this._bound.add(bank.which);
    this._live[bank.which] = this._live[bank.which] || 0;
    Bus.on('bank-saved', async w => { if(w === bank.which) await bank.reload(); });
  },
  async saved(which){ const w = await this.writeFile(which); Bus.emit('bank-saved', which); return w; }
};

/* 每个数据文件一个独立实例，同一份只建一次，编辑器与生成器拿到的是同一个对象 */
const BANK_INS = {};
function mkBank(which){
  if(BANK_INS[which]) return BANK_INS[which];
  const b = {
    which, get file(){ return Banks.path(this.which); }, text:null, loaded:false, ver:0, cats:new Map(),
    async load(){
      if(this.loaded) return this;
      this.parse(await Banks.text(this.which));
      this.loaded = true;
      return this;
    },
    /* 词库编辑器保存后调这个：重新取文重解析，生成器不用刷新页面 */
    async reload(){ this.parse(await Banks.text(this.which)); this.ver++; Bus.emit('bank:' + this.which, this); return this; },
    parse(txt){
      this.cats = new Map();
      let cur = null;
      for(const line of String(txt).split('\n')){
        const s = line.trim();
        const m = /^【(.+)】$/.exec(s);
        if(m){ cur = m[1]; if(!this.cats.has(cur)) this.cats.set(cur, []); continue; }
        if(!cur || !s) continue;
        this.cats.get(cur).push(s);
      }
      return this;
    },
    /* 原样：不去 随机、不拆行 */
    raw(cat){ return this.cats.get(cat) || []; },
    /* 下拉用：随机永远排第一，词库里的 随机 不重复出现 */
    opts(cat){
      const out = ['随机'];
      for(const w of this.raw(cat)) if(w !== '随机') out.push(w);
      return out;
    },
    /* 抽取用：随机不参与 */
    pool(cat){ return this.raw(cat).filter(w => w !== '随机'); },
    /* 某一类下面有哪几个子类，照词库里的先后列出来，名字就是【父类.名字】里那个名字。
       界面上"分几档、每档叫什么"的下拉用它，别再往代码里抄一份档位名 ——
       词库加一档、改个称呼，这里立刻跟着变。 */
    subs(parent){
      const pre = String(parent || '') + '.';
      const out = [];
      for(const c of this.cats.keys()){
        if(!c.startsWith(pre)) continue;
        const sub = c.slice(pre.length);
        if(sub && sub.indexOf('.') < 0 && out.indexOf(sub) < 0) out.push(sub);
      }
      return out;
    },
    names(){ return [...this.cats.keys()].sort() }
  };
  BANK_INS[which] = b;
  return b;
}
