/* ============================================================
   界面文字映射（批⑤ 第 6 项）· 运行时这一半
   ----------
   清单存在 数据\ui-text.yaml，YAML · 按页分组：段首一行是哪个程序的哪一页，
   底下缩进两格一行一个地方，冒号左边是界面上原来那句话，右边写你要的字。
   这一份负责三件事：
     1 读清单 → 记下哪一句要换成哪一句（按出处里那一页分开记，同一个字在不同页可以各换各的）
     2 界面上现出来的字当场换掉，存盘就变、不用重启（新长出来的节点由 MutationObserver 补上，
       换过的节点把原来的字留着，清单再改也认得回来）
     3 设置里那一行：清单文件在哪、打开它、还有「把改动写进程序」那个按钮（先出改动清单，确认才落笔）
   ----------
   拼接出来的句子在清单里是模板（一共 {1} 项）：界面上是填好数的成品，
   所以按模板现拼一个匹配式认出来，再把值填回用户写的那一句。
   ----------
   三端共用：Flow-Desk、Why Not Write、Rime Practice 的产物里都有这一份。
   宿主用 Txt.use({prog, read, onChange}) 报上自己是谁、清单从哪读、清单变了叫谁；
   读的这一份是磁盘上那一个文件（Flow-Desk 程序里由主进程在第一次开机时从出厂那层落到 数据\，
   本地开发那台服务器直接从 数据\ 发），所以「改清单」和「程序读的」永远是同一份，没有第二套真相。
   ============================================================ */
const Txt = {
  prog:'',
  pageNow:'',
  m:{ byPage:new Map(), byFrom:new Map(), tpl:[] },
  has:false,
  ready:false,
  painted:new Set(),              /* 已经换过字的节点：{node, kind, attr, orig, page} */
  host:null,
  file:'',                        /* 清单落在磁盘上的位置（设置那一行要说给用户） */
  use(host){ this.host = host; if(host && host.prog) this.prog = host.prog; return this; },
  /* 统一取清单原文：宿主 read() 可能回 {text,file}，也可能直接回一个字符串（RP 那份接法）。
     问不到主进程这一层（本地开发那台服务器）就从服务器根上取那一份明文 —— 它发的就是 数据\ 里那一个文件。 */
  async fetch(){
    if(this.host && this.host.read){
      try{
        const r = await this.host.read();
        const t = typeof r === 'string' ? r : (r && r.text) || '';
        if(t){ this.file = (r && r.file) || ''; return t; }
      }catch(e){}
    }
    try{
      const r = await fetch('/ui-text.yaml', { cache:'no-store' });
      if(r.ok){ this.file = '这台机器上的 数据\\ui-text.yaml'; return await r.text(); }
    }catch(e){}
    this.file = '这台机器上还没有 数据\\ui-text.yaml';
    return '';
  },
  async boot(){
    this.set(await this.fetch());
    this.watchDom();
    if(this.host && this.host.onChange){
      try{ this.host.onChange(t => this.set(typeof t === 'string' ? t : (t && t.text) || '')); }catch(e){}
    }
    return this;
  },
  /* ---------- 读清单（YAML） ----------
     认三种行：顶格那行是「程序 · 页名:」，缩进两格那行是「原来那句话: 你要的字」，
     冒号右边空着就是没改。值两种写法都认：裸写的一行、用双引号包起来的（清单自己写出去时
     只有绝不会被 YAML 认错的才裸写，带冒号、井号、引号、花括号的都裹了引号 —— 界面上那些字什么符号都有）。
     一行一行为政：认不动的那一行跳过，只坏那一行，其余照常生效。 */
  yunq(s){
    const t = String(s);
    if(t[0] === '"'){ try{ const v = JSON.parse(t); return typeof v === 'string' ? v : t; }catch(e){ return t; } }
    if(t[0] === "'" && /'$/.test(t)) return t.slice(1, -1).replace(/''/g, "'");
    /* 裸写的值：YAML 规矩是「空格 + #」往后是行内注释 */
    const c = t.search(/\s#/);
    return (c < 0 ? t : t.slice(0, c)).trim();
  },
  /* 一行里的「冒号分隔」：找第一个后面跟着空格（或到行尾）的冒号 —— 「00:02 开始」这种不算 */
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
      const rest = s.slice(j + 1).trim();
      /* 冒号右边就一对空引号 —— 那是「这句不要了」的写法，和什么都不写（不改）得分开认 */
      return { key, val:this.yunq(rest), del:rest === '""' || rest === "''" };
    }
    const k = this.colonAt(s);
    if(k < 0) return null;
    const rest = s.slice(k + 1).trim();
    return { key:this.yunq(s.slice(0, k).trim()), val:this.yunq(rest), del:rest === '""' || rest === "''" };
  },
  parse(text){
    const rows = [];
    let prog = '', page = '';
    for(const raw of String(text || '').split(/\r?\n/)){
      const s = raw.trimEnd();
      if(!s.trim() || s.trimStart().startsWith('#')) continue;
      const ind = /^\s*/.exec(s)[0].replace(/\t/g, '  ').length;
      const kv = this.kvOf(s.trim());
      if(!kv){ if(ind === 0){ prog = ''; page = ''; } continue; }     /* 认不动的这一行跳过：只坏这一行 */
      /* 段名是「程序 · 页名」：只按头一个分隔符切 —— 页名自己也可能带「 · 」，比如「设置 · 快捷键」 */
      if(ind === 0){ const i = kv.key.indexOf(' · '); prog = i < 0 ? kv.key.trim() : kv.key.slice(0, i).trim(); page = i < 0 ? '' : kv.key.slice(i + 3).trim(); continue; }
      if(!prog || !kv.key) continue;
      let to = kv.val.trim();
      if(to === kv.key) to = '';
      rows.push({ prog, page, from:kv.key, to, del:!!kv.del });
    }
    return rows;
  },
  set(text){
    const rows = this.parse(text);
    const byPage = new Map(), byFrom = new Map(), tpl = [];
    for(const r of rows){
      /* 「这句不要了」的那一行 r.to 是空的，靠 r.del 认；两种都得进表 */
      if(!r.to && !r.del) continue;
      if(!byFrom.has(r.from)) byFrom.set(r.from, []);
      byFrom.get(r.from).push(r);
      const pk = r.page + '\u0000' + r.from;
      if(!byPage.has(pk)) byPage.set(pk, r.to);
      if(/\{\d+\}/.test(r.from)) tpl.push({ r, re:this.reOf(r.from), val:r.to });
    }
    tpl.sort((a, b) => b.re.source.length - a.re.source.length);   /* 长的先认，别让短的抢走 */
    this.m = { byPage, byFrom, tpl };
    this.has = byFrom.size > 0;
    this.ready = true;
    this.repaint();
    return rows;
  },
  escRe(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); },
  /* '改了 {1} 处' → /^改了 ([\s\S]*?) 处$/ */
  reOf(key){
    const bits = String(key).split(/\{(\d+)\}/);
    let src = '^';
    for(let i = 0; i < bits.length; i += 2){
      src += this.escRe(bits[i]);
      if(i + 1 < bits.length) src += '([\\s\\S]*?)';
    }
    return new RegExp(src + '$');
  },
  fill(val, caps){
    return String(val).replace(/\{(\d+)\}/g, (s, n) => caps[+n - 1] === undefined ? '' : caps[+n - 1]);
  },
  /* 是哪一页先认哪一页；这一页没有，再认「同一个字在别处写的那一份」 */
  mine(r){
    const p = this.prog;
    if(!p) return true;
    if(r.prog === p) return true;
    /* 共用模块、功能包、主进程这几处是三个程序共用的底子，哪一端都算 */
    return /^(共用模块|功能包|Flow-Desk 主进程)/.test(r.prog);
  },
  pick(text, page){
    if(!this.has || !text) return null;
    const hit = page ? this.m.byPage.get(page + '\u0000' + text) : null;
    if(hit !== undefined && hit !== null) return hit;    /* 「这句不要了」存的就是空字符串，不能拿有没有值来认 */
    const list = this.m.byFrom.get(text);
    if(list){ for(const r of list) if((r.to || r.del) && this.mine(r)) return r.del ? '' : r.to; }
    for(const e of this.m.tpl){
      if(!this.mine(e.r)) continue;
      const mt = e.re.exec(text);
      if(mt) return this.fill(e.val, mt.slice(1));
    }
    return null;
  },
  /* ---------- 换字 ---------- */
  out(text, page){
    const s = typeof text === 'string' ? text : String(text === undefined || text === null ? '' : text);
    if(!this.has || !s) return s;
    const v = this.pick(s, page === undefined ? this.pageNow : page);
    return v === null ? s : v;
  },
  /* 当前是哪一页：设置里切一档、插件里各页各报一次 */
  page(name){ this.pageNow = name || ''; return this; },
  /* ---------- 界面上现成的字：新长出来的补上，清单改了重来 ---------- */
  watchDom(){
    const me = this;
    if(!document || !document.body || me._watching) return;
    me._watching = true;
    const ob = new MutationObserver(ms => {
      if(!me.has) return;
      for(const mo of ms){
        for(const n of mo.addedNodes) me.paintNode(n);
        if(mo.type === 'characterData'){
          const n = mo.target;
          if(n.__t0 === undefined) me.paintNode(n);
          else { const v = me.pick(n.__t0, n.__tp); if(v !== null && n.nodeValue !== v) n.nodeValue = v; }
        }
      }
    });
    ob.observe(document.body, { childList:true, subtree:true, characterData:true });
    me.paintNode(document.body);
  },
  pageOf(node){
    let el = node.nodeType === 1 ? node : node.parentElement;
    el = el && el.closest ? el.closest('[data-txp]') : null;
    return el ? el.getAttribute('data-txp') : this.pageNow;
  },
  paintNode(node){
    if(!this.has || !node || node.nodeType === 3 && node.__t0 !== undefined) return;
    if(node.nodeType === 3){
      const page = this.pageOf(node);
      const v = this.pick(node.nodeValue, page);
      if(v !== null && node.nodeValue !== v){
        node.__t0 = node.nodeValue; node.__tp = page;
        this.painted.add({ node, kind:'text' });
        node.nodeValue = v;
      }
      return;
    }
    if(node.nodeType !== 1) return;
    for(const k of ['title', 'placeholder', 'aria-label']){
      const raw = node.getAttribute && node.getAttribute(k);
      if(!raw || raw === String(node.__txAttr && node.__txAttr[k] || '')) continue;
      const page = this.pageOf(node);
      const v = this.pick(raw, page);
      if(v !== null && v !== raw){
        node.__txAttr = node.__txAttr || {}; node.__txAttr[k] = raw;
        this.painted.add({ node, kind:'attr', attr:k });
        node.setAttribute(k, v);
      }
    }
    for(let c = node.firstChild; c; c = c.nextSibling) this.paintNode(c);
  },
  /* 清单存盘 → 界面上立刻跟着变：换过的先按原来那一句重算，没换过的现扫一遍 */
  repaint(){
    if(!this.ready) return;
    for(const e of [...this.painted]){
      if(!e.node || (e.kind === 'text' ? !e.node.isConnected : !(e.node.isConnected || document.contains(e.node)))){ this.painted.delete(e); continue; }
      if(!this.has){
        if(e.kind === 'text') e.node.nodeValue = e.node.__t0;
        else e.node.setAttribute(e.attr, (e.node.__txAttr || {})[e.attr] || '');
        continue;
      }
      if(e.kind === 'text'){
        const v = this.pick(e.node.__t0, e.node.__tp);
        e.node.nodeValue = v === null ? e.node.__t0 : v;
      } else {
        const o = (e.node.__txAttr || {})[e.attr] || '';
        const v = this.pick(o, this.pageOf(e.node));
        e.node.setAttribute(e.attr, v === null ? o : v);
      }
    }
    if(this.has && document.body) this.paintNode(document.body);
  },
  /* ---------- 设置里那一行 ---------- */
  /* opt = { base:{ row, btn, hint }, dlg, askRestart, restart } —— 类名和对话框各端自己给，这一段只管内容。
     摆两个按钮：重新读一遍、把改动写进程序。
     按他的要求：这一行不显示文件路径、不提供「打开清单」按钮，也不在这里摆编辑框 ——
     一行一行改字是开发期那个独立工具干的事（见 Tools Folder\aitools），产品里不留这一道。
     「把改动写进程序」办完后问一句：立刻重启 Flow-Desk，还是稍后自己重启（askRestart 回 'now' 就走 restart）。 */
  settingsRow(opt){
    const B = (opt && opt.base) || {};
    const me = this;
    const status = h('div', { class:B.hint || 'hint' });
    const fill = async () => {
      const info = await me.fileInfo();
      status.textContent = info.rows ? '这一份里有 ' + info.rows + ' 行 · 你写了 ' + info.edited + ' 处改动' : '';
    };
    const box = h('div', { style:'display:grid;gap:6px' }, [
      status,
      h('div', { class:B.row || 'row' }, [
        h('button', { class:B.btn || 'btn', onclick:async () => {
          await me.reload(); await fill(); toast('重新读了一遍');
        }}, '重新读一遍'),
        h('button', { class:B.btn || 'btn', onclick:() => me.writeIntoProgram(opt) }, '把改动写进程序')
      ])
    ]);
    fill();
    return box;
  },
  /* 重新读磁盘那一份（设置里的「重新读一遍」和外部改动之后都走这条） */
  async reload(){
    this.set(await this.fetch());
  },
  /* 关窗口问「是否保存后再关闭」那条：这一行不留编辑框了，没有没存的东西，回一句没有就完事 */
  async saveNow(){ return { ok:true, msg:'' }; },
  async fileInfo(){
    const text = await this.fetch();
    const rows = this.parse(text);
    return { text, file:this.file, rows:rows.length, edited:rows.filter(r => r.to).length };
  },
  /* 「把改动写进程序」：先问主进程要一份改动清单，摆给用户看，点头才真写 */
  async writeIntoProgram(opt){
    const B = opt.base || {};
    if(!this.host || !this.host.plan){ toast('这台机器连不上源码那一层，这一份写不进去'); return; }
    if(!this.host.apply){ toast('写回源码的通道没接上'); return; }
    let p = null;
    try{ p = await this.host.plan(); }catch(e){ toast('问不动主进程：' + (e && e.message || e)); return; }
    const list = (p && p.list) || [];
    const miss = (p && p.miss) || [];
    if(!list.length){
      toast(miss.length ? '有 ' + miss.length + ' 处在源码里没找到原话（清单太旧，先点「重新读一遍」）' : '清单里没有改动：冒号右边还都空着，或者写得和左边一样');
      return;
    }
    const body = h('div', { style:'display:grid;gap:6px;max-height:360px;overflow:auto' });
    for(const e of list){
      body.appendChild(h('div', { style:'display:grid;gap:2px;padding:6px 0;border-bottom:var(--hair)' }, [
        h('div', {}, [h('b', {}, e.from), ' → ', h('b', { style:'color:#3a8f4a' }, e.to)]),
        h('div', { class:B.hint || 'hint', style:'opacity:.75' }, e.prog + ' · ' + e.page + ' · 源码 ' + e.at.join('、'))
      ]));
    }
    if(miss.length)
      body.appendChild(h('div', { class:B.hint || 'hint', style:'color:#b04a2a' },
        '另有 ' + miss.length + ' 处在源码里找不到这句原话，这一趟不动它们：' + miss.map(x => x.from).join('、')));
    body.appendChild(h('div', { class:B.hint || 'hint' }, '确认了才动源码：上面这些句子在源码里改掉，重新生成页面，清单里左边那句跟着变成新的字。'));
    const go = await (opt.dlg || (async () => true))('把改动写进程序', body, '确认写进程序');
    if(!go) return;
    toast('正在改源码、重新生成页面…');
    let r = null;
    try{ r = await this.host.apply(list); }catch(e){ r = { ok:false, msg:String((e && e.message) || e) }; }
    if(!r || !r.ok){ toast('没写成：' + ((r && r.msg) || '主进程没回话')); return; }
    toast(r.msg || '已经写进程序');
    if(this.host.reload) await this.host.reload();
    /* 源码改了、页面重新生成了，可各窗口里跑的还是开机那一刻的旧页面：
       问一句要不要立刻重启 Flow-Desk —— 选立刻就把整个程序重开一遍，选稍后就等各窗口自己刷新。 */
    if(opt.askRestart){
      try{
        const when = await opt.askRestart(r.msg || '改动已经写进程序');
        if(when === 'now' && opt.restart) await opt.restart();
      }catch(e){}
    }
  }
};
/* ---------- 旧「提示语」那一半的收摊留名 ----------
   第 14 条的 Phrase（逐句覆盖表 + 设置里那个页面）整个退休，界面上改字改走这一份清单。
   源码里还有几处直接喊 Phrase.out 的（散在各视图现挂的悬停说明），留这一小段顶名：
   喊出来的还是换字后的字，走的却是清单这条路。用不到的口子给空壳，不报错也不干活。 */
const Phrase = {
  out(t){ return Txt.out(t); },
  use(){ return this; },
  ensure(){ return Promise.resolve(); },
  last:''
};
