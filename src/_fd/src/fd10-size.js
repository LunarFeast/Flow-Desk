/* ============================================================
   卡片默认大小清单（#251）· 运行时这一半
   ----------
   清单存在 数据\card-size.yaml，YAML · 按页分组：段首一行是「哪个程序的哪一页」，
   底下缩进两格一张卡片，卡片名下面两行 —— 出厂（程序原来给的大小）和你要（你要的大小）。
   这一份管三件事：
     1 读清单 → 记下哪张卡片要摆多大（按卡片名认，宽 × 高，单位是桌面上的格）
     2 盖过注册表里的出厂默认：新摆的卡片、第一次开机的自动落位都吃新大小；
       桌上已经摆着、而且你从来没亲手拉过大小的卡片也跟着变 —— 亲手拉过的不动
     3 设置里那一行：重新读一遍、把改动写进程序（跟界面文字那一行同一套做法；改大小去开发期那个独立工具）
   ----------
   读的就是磁盘上那一个文件：Flow Desk 程序里由主进程在第一次开机时从出厂那层落到 数据\，
   本地开发那台服务器直接从 数据\ 发 —— 程序读的、他改的、写回源码的是同一份，没有第二套真相。
   启动流程里 SizeList.boot() 排在组件加载之前，注册那一刻就能盖上（见 _fd/src/fd6-boot.js）。
   只有 Flow Desk 有桌面卡片：这一份只进 Flow Desk 的产物，Why Not Write、Rime Practice 用不到。
   ============================================================ */
const SizeList = {
  ov:new Map(),              /* 卡片名 → { oldW, oldH, w, h }：只记「你要」真写了的那几张 */
  fb:null,                   /* 「其他卡片」那一张：改它要在写进程序、重新生成页面之后才落进底子 */
  base:new Map(),            /* def.id → { w, h }：出厂默认快照，清单撤了改动要盖回去 */
  host:null,
  file:'',
  use(h){ this.host = h; if(h && h.prog) this.prog = h.prog; return this; },
  /* 大小那一栏：宽 × 高；他手写时 x / X / * 也认 */
  sizeOf(s){
    const m = /^\s*(\d{1,3})\s*(?:×|[xX*])\s*(\d{1,3})\s*$/.exec(String(s || ''));
    if(!m) return null;
    const w = +m[1], h = +m[2];
    if(!(w >= 1 && w <= 64 && h >= 1 && h <= 36)) return null;
    return { w, h };
  },
  /* ---------- 读清单（YAML） ----------
     顶格那行是「程序 · 页名」，桌面卡片只有 Flow Desk 有，所以只认「Flow Desk · 桌面」那一段；
     缩进两格是卡片名，卡片名底下缩进四格那两行是出厂 / 你要。
     值两种写法都认：裸写的、用引号包起来的（清单写出去时名字里带冒号井号的会裹引号）。
     一行一行为政：认不动的那一行跳过，只坏那一行，其余照常生效。 */
  yunq(s){
    const t = String(s);
    if(t[0] === '"'){ try{ const v = JSON.parse(t); return typeof v === 'string' ? v : t; }catch(e){ return t; } }
    if(t[0] === "'" && /'$/.test(t)) return t.slice(1, -1).replace(/''/g, "'");
    const c = t.search(/\s#/);
    return (c < 0 ? t : t.slice(0, c)).trim();
  },
  /* 一行里的「冒号分隔」：找第一个后面跟着空格（或到行尾）的冒号 */
  colonAt(line){
    for(let i = 0; i < line.length; i++){
      if(line[i] !== ':') continue;
      if(i + 1 >= line.length || line[i + 1] === ' ') return i;
    }
    return -1;
  },
  /* 拆开一行 key: value；不是这个形状的回 null。key 带引号的按引号里头尾算，不挨冒号 */
  kvOf(line){
    const s = String(line);
    if(s[0] === '"' || s[0] === "'"){
      let i = 1, esc = false;
      while(i < s.length){
        const c = s[i];
        if(esc) esc = false;
        else if(c === '\\' && s[0] === '"') esc = true;
        else if(c === s[0]){ if(s[0] === "'" && s[i + 1] === "'"){ i++; } else break; }
        i++;
      }
      if(i >= s.length) return null;
      const key = this.yunq(s.slice(0, i + 1));
      let j = i + 1; while(j < s.length && s[j] === ' ') j++;
      if(s[j] !== ':') return null;
      return { key, val:this.yunq(s.slice(j + 1).trim()) };
    }
    const k = this.colonAt(s);
    if(k < 0) return null;
    return { key:this.yunq(s.slice(0, k).trim()), val:this.yunq(s.slice(k + 1).trim()) };
  },
  parse(text){
    const rows = [];
    let prog = '', page = '', name = '', cur = null;
    const flush = () => {
      /* 段名跟着程序名换过（外40 搬家），旧写法那一行读回来照认，别把他「你要」那一栏丢了 */
      if(cur && name && (prog === 'Flow-Desk' || prog === 'Flow Desk') && page === '桌面'){
        const f = this.sizeOf(cur.old);
        let to = (cur.new || '').trim();
        if(f){
          if(to && !this.sizeOf(to)) to = '';            /* 「你要」写坏了：这一张算没改 */
          if(to === cur.old) to = '';
          const t = to ? this.sizeOf(to) : null;
          rows.push({ name, from:cur.old, to, oldW:f.w, oldH:f.h, w:t ? t.w : 0, h:t ? t.h : 0 });
        }
      }
      cur = null;
    };
    for(const raw of String(text || '').split(/\r?\n/)){
      const s = raw.trimEnd();
      if(!s.trim() || s.trimStart().startsWith('#')) continue;
      const ind = /^\s*/.exec(s)[0].replace(/\t/g, '  ').length;
      const kv = this.kvOf(s.trim());
      if(!kv){ if(ind === 0) page = ''; continue; }     /* 认不动的这一行跳过：只坏这一行 */
      if(ind === 0){ flush(); const t = String(kv.key).split(' · ');
        prog = t[0].trim(); page = (t[1] || '').trim(); name = ''; continue; }
      if(ind <= 2){ flush(); name = kv.key; continue; }
      if(!name) continue;
      if(!cur) cur = { old:'', new:'' };
      if(kv.key === '出厂') cur.old = kv.val;
      else if(kv.key === '你要') cur.new = kv.val;
    }
    flush();
    return rows;
  },
  /* 读一份清单：盖新默认之前先把上一轮盖掉的还原回出厂那一份，删行、清空都等于恢复 */
  set(text){
    this.ov = new Map(); this.fb = null;
    for(const r of this.parse(text)){
      if(!r.to || r.bad) continue;
      const e = { oldW:r.oldW, oldH:r.oldH, w:r.w, h:r.h };
      if(r.name === '其他卡片') this.fb = e; else this.ov.set(r.name, e);
    }
    /* 第一次读（boot 里那一趟）注册表还是空的，盖不上也不用回灌；
       之后每一轮先把上一轮盖掉的还原，再按新清单盖一遍 —— 删一张卡、清空「你要」都等于恢复 */
    if(this.ov.size || this.appliedOnce) this.reapply();
    this.appliedOnce = this.ov.size > 0;
    return this;
  },
  /* 注册那一刻就被调用（fd3-shell 的 registerWidget）：先留出厂快照，再按清单盖新大小 */
  register(def){
    if(def.def) this.base.set(def.id, { w:def.def.w, h:def.def.h });
    this.patch(def);
  },
  patch(def){
    const o = this.ov.get(def.name);
    if(!o) return;
    def.def = { w:Math.max(o.w, def.minW || 1), h:Math.max(o.h, def.minH || 1) };
  },
  /* 新摆上桌的那一张：它的大小是清单盖出来的，就在布局里记一笔 sizeFrom ——
     以后改清单它还跟着变，只有他亲手拉过的那一下才让它定下来（拉的那一下会把这一笔抹掉）。 */
  stamp(it, def){
    if(!it || !def) return it;
    if(!this.ov.get(def.name)) return it;
    if(def.def && def.def.w === it.w && def.def.h === it.h) it.sizeFrom = { w:it.w, h:it.h };
    return it;
  },
  /* 清单换了：注册表里每张卡片先还原再按新清单盖一遍；桌上的卡没拉过的跟着变 */
  reapply(){
    try{
      for(const [id, d] of this.base){
        const def = typeof Registry !== 'undefined' ? Registry.get(id) : null;
        if(def) def.def = { w:d.w, h:d.h };
      }
      if(typeof Registry !== 'undefined') for(const def of Registry.values()) this.patch(def);
      if(this.resizeLive() && typeof Shell !== 'undefined' && Shell.layout && Shell.layout.items){
        Shell.save(); Shell.render();
      }
    }catch(e){ console.warn('卡片大小没盖上：' + (e && e.message || e)); }
  },
  /* 桌上已经摆着的：这张卡当下这个大小要么还是出厂那一个，要么就是上一轮清单盖上去的
     （盖的那一刻在布局里记了一笔 sizeFrom）—— 这两种都算「用户没亲手拉过」，跟着清单走；
     对不上号的才是他拉过的，一个字不动。清单里这一张撤了（「你要」清空或整段删掉）
     → 目标回到出厂大小，同样盖回去，那笔 sizeFrom 跟着抹掉。 */
  resizeLive(){
    if(typeof Shell === 'undefined' || !Shell.layout || !Shell.layout.items) return false;
    let n = 0;
    for(const it of Shell.layout.items){
      if(typeof it.w !== 'number' || typeof it.x !== 'number') continue;
      const def = Registry.get(it.widget); if(!def) continue;
      const b = this.base.get(it.widget) || def.def || {};
      if(typeof b.w !== 'number' || typeof b.h !== 'number') continue;
      const o = this.ov.get(def.name);
      const tw = o ? Math.max(o.w, def.minW || 1) : b.w, th = o ? Math.max(o.h, def.minH || 1) : b.h;
      const from = it.sizeFrom;
      /* 记过那一笔就按那一笔认（重启回来也认得这张是被清单盖大的）；没记过的按出厂认 */
      const free = from ? (it.w === from.w && it.h === from.h)
                        : (it.w === (o ? o.oldW : b.w) && it.h === (o ? o.oldH : b.h));
      if(!free || (it.w === tw && it.h === th)) continue;
      if(Shell.fits({ x:it.x, y:it.y, w:tw, h:th }, it)){
        it.w = tw; it.h = th;
        if(o) it.sizeFrom = { w:tw, h:th }; else delete it.sizeFrom;
        n++; continue;
      }
      /* 原位挤不下：把它从桌上暂时摘出来，找个第一块放得下的空地再落位 */
      const at = Shell.layout.items.indexOf(it);
      Shell.layout.items.splice(at, 1);
      const f = Shell.firstFit(tw, th);
      if(f){
        it.x = f.x; it.y = f.y; it.w = tw; it.h = th;
        if(o) it.sizeFrom = { w:tw, h:th }; else delete it.sizeFrom;
        n++;
      }
      Shell.layout.items.push(it);
    }
    return n > 0;
  },
  /* ---------- 取清单原文：宿主 read() 回 {text,file}；
     问不到主进程这一层（本地开发那台服务器）就从服务器根上取那一份明文，它发的就是 数据\ 里那一个文件 ---------- */
  async fetch(){
    if(this.host && this.host.read){
      try{
        const r = await this.host.read();
        const t = typeof r === 'string' ? r : (r && r.text) || '';
        if(t){ this.file = (r && r.file) || ''; return t; }
      }catch(e){}
    }
    try{
      const r = await fetch('/card-size.yaml', { cache:'no-store' });
      if(r.ok){ this.file = '这台机器上的 数据\\card-size.yaml'; return await r.text(); }
    }catch(e){}
    this.file = '这台机器上还没有 数据\\card-size.yaml';
    return '';
  },
  async boot(){
    this.set(await this.fetch());
    if(this.host && this.host.onChange){
      try{ this.host.onChange(t => this.set(typeof t === 'string' ? t : (t && t.text) || '')); }catch(e){}
    }
    return this;
  },
  async reload(){ this.set(await this.fetch()); },
  async fileInfo(){
    const text = await this.fetch();
    const rows = this.parse(text);
    return { text, rows:rows.length, edited:rows.filter(r => r.to).length };
  },
  /* 关窗口问「是否保存后再关闭」那条：这一行不留编辑框了，没有没存的东西 */
  async saveNow(){ return { ok:true, msg:'' }; }
};
/* ---------- 设置里那一行（跟界面文字那一行同一套做法） ----------
   摆两个按钮：重新读一遍、把改动写进程序。
   同样不显示文件路径、不提供「打开清单」按钮，也不在这里摆编辑框 ——
   一行一行改是开发期那个独立工具干的事（见 Tools Folder\aitools）。写进程序办完问一句：立刻重启还是稍后自己重启。 */
const SizeCfg = {
  settingsRow(opt){
    const B = (opt && opt.base) || {};
    const me = this;
    const status = h('div', { class:B.hint || 'hint' });
    const fill = async () => {
      const info = await SizeList.fileInfo();
      status.textContent = info.rows ? '这一份里有 ' + info.rows + ' 张卡片 · 你写了 ' + info.edited + ' 处改动' : '';
    };
    const box = h('div', { style:'display:grid;gap:6px' }, [
      status,
      h('div', { class:B.row || 'row' }, [
        h('button', { class:B.btn || 'btn', onclick:async () => {
          await SizeList.reload(); await fill(); toast('重新读了一遍');
        }}, '重新读一遍'),
        h('button', { class:B.btn || 'btn', onclick:() => me.writeIntoProgram(opt) }, '把改动写进程序')
      ])
    ]);
    fill();
    return box;
  },
  /* 「把改动写进程序」：先问主进程要一份改动清单，摆给用户看，点头才真写 */
  async writeIntoProgram(opt){
    const B = (opt && opt.base) || {};
    if(!SizeList.host || !SizeList.host.plan){ toast('这台机器连不上源码那一层，这一份写不进去'); return; }
    if(!SizeList.host.apply){ toast('写回源码的通道没接上'); return; }
    let p = null;
    try{ p = await SizeList.host.plan(); }catch(e){ toast('问不动主进程：' + (e && e.message || e)); return; }
    const list = (p && p.list) || [];
    const miss = (p && p.miss) || [];
    if(!list.length){
      toast(miss.length ? '有 ' + miss.length + ' 张卡片在源码里认不出这个名字（先点「重新读一遍」）' : '清单里没有改动：右边那一栏还都空着，或者写得和左边出厂那一栏一样');
      return;
    }
    const body = h('div', { style:'display:grid;gap:6px;max-height:360px;overflow:auto' });
    for(const e of list){
      body.appendChild(h('div', { style:'display:grid;gap:2px;padding:6px 0;border-bottom:var(--hair)' }, [
        h('div', {}, [h('b', {}, e.name), '：' + e.from + ' → ', h('b', { style:'color:#3a8f4a' }, e.to)]),
        h('div', { class:B.hint || 'hint', style:'opacity:.75' }, (e.at || []).join('、'))
      ]));
    }
    if(miss.length)
      body.appendChild(h('div', { class:B.hint || 'hint', style:'color:#b04a2a' },
        '另有 ' + miss.length + ' 行在源码里认不出那张卡片（多半是功能卸了），这一趟不动它们：' + miss.map(x => x.name).join('、')));
    body.appendChild(h('div', { class:B.hint || 'hint' }, '确认了才动源码：上面这些默认大小在源码里改掉，重新生成页面，清单里出厂那一行跟着变成新的大小。'));
    const go = await (opt.dlg || (async () => true))('把改动写进程序', body, '确认写进程序');
    if(!go) return;
    toast('正在改源码、重新生成页面…');
    let r = null;
    try{ r = await SizeList.host.apply(list); }catch(e){ r = { ok:false, msg:String((e && e.message) || e) }; }
    if(!r || !r.ok){ toast('没写成：' + ((r && r.msg) || '主进程没回话')); return; }
    toast(r.msg || '已经写进程序');
    if(SizeList.host.reload) await SizeList.reload();
    if(opt.askRestart){
      try{
        const when = await opt.askRestart(r.msg || '改动已经写进程序');
        if(when === 'now' && opt.restart) await opt.restart();
      }catch(e){}
    }
  }
};
/* 清单不再有内嵌那份：启动流程里 SizeList.boot() 从磁盘读这一份（读它排在组件加载之前，
   新摆的卡片注册那一刻就吃到清单里的新默认），之后磁盘那份一变靠广播跟上。 */
