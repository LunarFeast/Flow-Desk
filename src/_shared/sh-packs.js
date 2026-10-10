/* ============================================================
   插件契约（中立模块）· FD 和 WNW 共用这一份

   外壳是一副空骨架，功能全在 data\plugins\<id>\ 里。
   页面开机时由加载器（_shared/sh-load.js）按 off.json 那份「卸掉的」名单，
   一家家 import 各自的 main.js，顺手把说明书（id / 名字 / 作者 / 来源 / 版本 / 数据文件）
   填进下面这份 PACK_META —— 说明书不再拼进产物，名单里没它、这一轮就没加载它，功能就没有。

   这一节只提供三种底座能力：
   1) Packs      —— 问"这个功能装了吗 / 它的说明书怎么写"
   2) SetupTabs  —— 设置面板左边那一列标签的登记表，功能想加一档就来自注册，
                    外壳不再硬写一张名单（硬写的名单会把功能的代码拽进外壳）
   3) 共用小工具  —— 色位、组件名这些被两个以上功能借走的东西，放底座，不放某个包里
   ============================================================ */

/* 说明书表：运行时由加载器一家家填进来（填的字段和构建那把尺 _build/packs.mjs 同一个口径）。
   没加载上的时候它就是空的（这一轮名单里没有这几家），
   空的意思是"什么都不拦"，方便直接改代码玩，不至于把外壳跑不起来 */
const PACK_META = {};

const Packs = {
  has(id){ return !!PACK_META[id]; },
  info(id){ return PACK_META[id] || null; },
  /* 当前产物里装了哪些：按 order 排，同序按 id，界面列出来永远是同一个次序 */
  list(){
    return Object.keys(PACK_META).map(k => Object.assign({ id:k }, PACK_META[k]))
      .sort((a, b) => (a.order - b.order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  },
  /* 这个功能在 userdata 里占了哪几个键，删除时勾了「同步清除数据」才用得上 */
  dataKeys(id){ const m = this.info(id); return (m && m.dataKeys) || []; },
  kvKeys(id){ const m = this.info(id); return (m && m.kvKeys) || []; },
  /* 数据层根（data\）那一侧、由这一家自带的路径 —— 自带词库那种（<包名>-bank/data.txt）。
     词库跟着功能走：功能从产物里摘掉了，勾了同步清除数据才把这些一起带走。 */
  sharedKeys(id){ const m = this.info(id); return (m && m.sharedKeys) || []; },
  /* 备份 / 搬家要带上哪些明文文件：外壳自己的那几个由调用方给，
     后面加上每个装着的包自己点名的。外壳不认识「便签」「日程」这些名字，
     也就不会因为哪个包被卸了还去读它的文件。 */
  dataFiles(base){
    const out = (base || []).slice();
    for(const m of this.list()) for(const k of (m.dataKeys || [])) if(!out.includes(k)) out.push(k);
    return out;
  },
  /* 名字：包的说明书最准，其次问注册表，最后退回 id 本身 */
  name(id){
    const m = this.info(id); if(m && m.name) return m.name;
    const t = (typeof Registry !== 'undefined' ? Registry.get('tool-' + id) : null)
      || (typeof Registry !== 'undefined' ? Registry.get(id) : null);
    return (t && t.def && t.def.name) || id;
  }
};

/* ---------- 设置面板的标签登记 ----------
   add 的第三参：order 决定这一档排在哪儿（外壳给常驻那几档留了 10 的档距，
   功能包挑一个空档插进去就行）；when 是这道档该不该露面，每次开面板现问。
   row 不另开一档，只往已有那档下面垫一段 —— 「组件」这一档里的 RP 地址、
   音乐文件夹就是各家的包自己垫进来的，外壳不知道有几家、叫什么。 */
const SETUP_TABS = [];
const SETUP_ROWS = [];
const SetupTabs = {
  add(name, build, opt){
    const o = opt || {};
    if(!SETUP_TABS.some(t => t.name === name)) SETUP_TABS.push({ name, build, order:o.order || 0, when:o.when || null });
    return this;
  },
  row(tab, build, opt){
    const o = opt || {};
    SETUP_ROWS.push({ tab, build, order:o.order || 0, when:o.when || null });
    return this;
  },
  list(){
    return SETUP_TABS.filter(t => !t.when || t.when())
      .slice().sort((a, b) => a.order - b.order);
  },
  rowsOf(tab){
    return SETUP_ROWS.filter(r => r.tab === tab && (!r.when || r.when()))
      .slice().sort((a, b) => a.order - b.order);
  }
};

/* ---------- 被两个以上功能借走的共用小件 ---------- */
/* ---------- 标记色（外13-N）----------
   用户在 设置 · 外观 里自己定的那一串颜色，数量 3~20，住在 Flow-Desk 的 外观存档 里
   （不在 色卡、也不在 外观方案 里 —— 换配色、换外观模式、换明暗都不会重算它，这是这一档的立身之本）。
   真身是色号，界面上取的是根元素上那串 --mark-N：由 Flow-Desk 那头 Theme.apply 一次写一遍
   （fd3-shell.js 的 Marks），这里只负责「取值 + 宿主还没钉上时退回配色里那五个强调位」，
   免得单独开的那一页、或标记色还没落值的第一帧，圆点和条子空成一片白。
   色位（slotColor）走的是同一个口径：日程的轨道色、便签的左边一条、WNW 的标签色点都借它，
   所以标记色一定义，这几处当场跟着换成用户自己挑的那一串。 */
const MARK_MIN = 3, MARK_MAX = 20;
/* 配色方案里强调位的个数（--slot-1 … --slot-5）。从前这个 5 和「那一排取值串」在为写那边硬抄了两份
   （书架封面钉色一排、设定卡挑色一排），改一处只生效一半，所以个数和那一排都收在这一处。 */
const ACCENT_N = 5;
/* 从宿主那一头问当前这一串标记色的色号；问不到（没定过 / 不在 Flow-Desk 里）回空数组 */
function markHexes(){
  const M = typeof window !== 'undefined' ? window.FD_MARKS : null;
  const raw = M && typeof M.hexes === 'function' ? M.hexes() : [];
  return (Array.isArray(raw) ? raw : []).filter(x => /^#[0-9a-f]{6}$/i.test(String(x))).slice(0, MARK_MAX);
}
/* 当前有几个：一个也没定过时按配色那五个强调位摆，名单不能空 */
function markCount(){ return markHexes().length || ACCENT_N; }
/* 第 k 个（从 1 数）标记色在用户定下来之前接在配色第几号强调位后面 */
function markBase(k){ return ((k - 1) % ACCENT_N) + 1; }
/* 第 i 个（从 0 数起）的取值那一句。本体 --mark-N 写的就是用户存的那个色号，永远不经过派生，
   所以「标记色不随方案变动」这条不受影响；取不到时接配色那一档的强调位 --slot-M 兜底。
   dflt 是两层都取不到时兜底的那一句（组件里老算式 color-mix 那一档要留在最里层）。
   从前这儿还带一个 kind 参数去取同伴那一档（-dot / -bar / -bar-text / -cover / -cover-ink），
   全代码没有一处传过它，也没有一处读 --mark-N 带后缀的那几枚变量 ——
   每回上色白推几十档对比度。外27 全清第 6、10 条把那一整档撤了；
   色位那一头的同伴（--slot-N-dot 等）有人吃，仍由 sh-look.js 照常算。 */
function markVar(i, dflt){
  const n = markCount();
  const k = ((Math.max(0, Math.round(+i || 0)) % n) + 1);
  const inner = 'var(--slot-' + markBase(k) + (dflt ? ', ' + dflt : '') + ')';
  return 'var(--mark-' + k + ', ' + inner + ')';
}
/* markIndexOf(存过的取值串)：把从前钉过 'var(--slot-3)' 那一种老串、或 1 起的编号数字，
   一律归成「当前这一串标记色里的第几个」（0 起），认不出来回 -1。
   它只是挑色界面判断「哪一个正亮着」用的读数器——不改写存档、不迁移老数据（老串照旧能画，
   因为配色那一档的 --slot-N 永远由外观层钉着）。用户在这儿新挑一个时，存下去的是 markVar 生成的
   那一句 var(--mark-N …)，于是这个跟着全局走。 */
function markIndexOf(v){
  if(typeof v === 'number' && isFinite(v)) return ((Math.max(1, Math.round(v)) - 1) % markCount());
  if(typeof v !== 'string' || !v) return -1;
  const m = /--(?:mark|slot)-(\d+)/.exec(v);
  if(!m) return -1;
  const n = markCount();
  return ((Math.max(1, +m[1]) - 1) % n);
}
/* 一整排可选的标记色（挑色那几处界面直接摊开这一串用） */
function markSlots(){ return Array.from({ length:markCount() }, (x, i) => markVar(i)); }
/* 一整排配色方案的强调位取值。和上面那排标记色两回事：标记色是用户自己定的、换配色方案不重算，
   这一排换方案就跟着换 —— 存进存档的就是这一排的串。
   从前为写那边把它硬抄了两份（书架封面钉色一排、设定卡挑色一排），现在都吃这一个。 */
function accentSlotVars(){ return Array.from({ length:ACCENT_N }, (x, i) => 'var(--slot-' + (i + 1) + ')'); }
/* 色位：日程的轨道色、便签的左边一条、WNW 的标签色点都吃这一个口径（外13-N 起吃的是标记色） */
function slotColor(i){ return markVar(i); }
/* slotHex(i)：和 slotColor 同一个口径、同一个编号（从 0 数、绕回）的另一半 —— 回的是「具体色号」，
   不是 var(--mark-N, …) 那一句 CSS 取值串。为什么要它：有的组件存的就是色号本身（比如日程「新建标签」
   的默认色，存下后还能单独改），那句 CSS 串存不得；从前宿主只开了 slotColor，组件只好去配色强调位抠。
   兜底跟 markVar 同一个思路：先问用户定的那一串（markHexes，宿主明面的通道，组件不许自己抓）；
   宿主还没钉上 / 那一串没定时按 markBase 接在配色强调位后面；连配色都读不着就回一个画得出来的出厂强调色 ——
   永远回合法色号，不回 undefined、不抛错。Theme.tokens() 两端口径不一样：FD 回 {tokens:{…}}，为写直接回平表。 */
function slotHex(i){
  const n = markCount();
  const k = ((Math.max(0, Math.round(+i || 0)) % n) + 1);
  const xs = markHexes();
  if(xs[k - 1]) return xs[k - 1];
  try{
    const T = typeof Theme !== 'undefined' ? Theme : null;
    const q = T && typeof T.tokens === 'function' ? T.tokens() : null;
    const t = q && (q.tokens || q);
    const hex = v => /^#[0-9a-f]{3,6}$/i.test(String(v || '')) ? String(v) : null;
    return hex(t && t['--slot-' + markBase(k)]) || hex(t && t['--accent']) || '#7aa7e8';
  }catch(e){ return '#7aa7e8'; }
}

/* ============================================================
   装 / 卸 · 页面只认这一条通道（FD 卡和 WNW 停靠共用，两端对等）

   改的是那一份名单：data\plugins\off.json —— 记的是「被卸掉的」那几家，不是「装了哪些」。
   代码不拼在产物里（运行时一家家 import），所以名单只管「这一轮加载不加载它」：
   名字在 off 里的那一家，下一次开机不 import 它的 main.js —— 桌面上那张卡、设置里它垫的那几行跟着没了，
   包本身一个字不动地留在 data\plugins\<id>\ 里，随时装得回来。
   反过来也成立：往 data\plugins\ 里丢一个文件夹（或一个 zip，开机由主进程摊开），重启就生效，不用在这儿点一次。

   两步连着一趟：改名单 → 刷新这一页。重新生成页面那一趟只留给改了 src\ 的情况，装卸不叫它。
   ----------
   两条通道做的是同一件事，落在同一层（data\plugins\）：
     · Flow-Desk 程序 → 主进程的 packList / packSet / packImport / packWipe；
     · 本地开发那台 http 服务器 → 同一个 comp-files.cjs 挂在 /_comp 上（下面 DevPacks 那一份）。
   装卸走的名单在磁盘上，两条通道改的是同一份文件。
   ============================================================ */
/* 开发那台服务器的两条通道：递过去的形状和主进程那两条回的一模一样，页面不用分叉 */
async function compPost(body){
  try{
    const r = await fetch('/_comp', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body) });
    return await r.json();
  }catch(e){ return { ok:false, msg:'本地服务器没接上：' + ((e && e.message) || e) }; }
}
const DevPacks = {
  packList(){ return compPost({ op:'dirs' }); },
  /* 传 null = 删掉这份名单文件（没这份文件就全当装了）：主进程那条也是这个口径 */
  packSet(ids){ return compPost({ op:'installed', set:ids === null ? null : Array.from(ids || []) }); }
  /* 导入（要解压 zip）和清数据（要删 plugins 之外的文件）这两条只挂在主进程那边：
     插件导入请用 Flow-Desk 程序 —— 开发服务器只把这一格里的代码读写和名单接了出来。 */
};
const PackOps = {
  host(){
    const A = window.FD_APP;
    if(A && typeof A.packList === 'function' && typeof A.packSet === 'function') return A;
    return DevPacks;
  },
  can(){ return !!this.host(); },
  /* 导入这一条只有主进程有：开发服务器只接了名单和这一格的文件，那两个选文件的按钮不摆 */
  canImport(){ const A = this.host(); return !!(A && typeof A.packImport === 'function'); },
  /* 这一页是哪个宿主：两个程序扫的是同一批目录，各自只挑 host 里写了自己的那几个 */
  self(){
    const w = String((window.FD_APP && window.FD_APP.which) || '').toLowerCase();
    if(w.indexOf('wnw') >= 0) return 'wnw';
    if(w.indexOf('rp') >= 0 || w.indexOf('rime') >= 0) return 'rp';
    return (typeof PackLoader !== 'undefined' && PackLoader.host) || 'fd';
  },
  forHost(m){ const h = (m && m.host) || ['fd']; return h.indexOf(this.self()) >= 0; },
  /* 磁盘上这一层有什么：{ dir, packs:[{id,kind,manifest}], off:[…] }；读不到回 null */
  async disk(){
    const A = this.host(); if(!A) return null;
    const r = await A.packList();
    if(!r || r.ok === false || r.error) return null;
    return r;
  },
  /* 这一轮该加载的那几家 = 这一层里有的、又不排在 off 里的。
     off 缺省（还没装卸过）= 一家都没卸，扫到的全生效 —— 新克隆的那一棵不该缺东西。 */
  async ids(){
    const d = await this.disk(); if(!d) return null;
    const off = new Set((Array.isArray(d.off) ? d.off : []).map(String));
    return (d.packs || []).filter(p => !off.has(String(p.id))).map(p => String(p.id));
  },
  /* 这一层里有、这一轮没加载的那些包 —— 「装上」列出来的就是它们 */
  async installable(){
    const d = await this.disk(); if(!d) return [];
    const inLoad = new Set(Packs.list().map(m => m.id));
    const out = [];
    for(const p of d.packs){
      const m = p.manifest; if(!m || inLoad.has(p.id)) continue;
      if(m.host && m.host.indexOf(this.self()) < 0) continue;
      out.push({ id:p.id, name:m.name || p.id, author:m.author || '', source:m.source || '',
        version:m.version || '', desc:m.desc || '', icon:m.icon || '', order:m.order,
        dataKeys:m.dataKeys || [], kvKeys:m.kvKeys || [], sharedKeys:m.sharedKeys || [],
        bank:m.bank || null, assets:m.assets || {}, host:m.host || [],
        where:p.kind === 'zip' ? p.id + '.zip' : p.id + '/', kind:p.kind });
    }
    return out;
  },
  /* ---------- 顶上那条进度条：单例，装卸这两步各占一格 ---------- */
  bar: {
    el:null, fill:null, txt:null, off:null,
    ensure(){
      if(this.el && document.body.contains(this.el)) return this.el;
      const f = document.createElement('i');
      f.style.cssText = 'display:block;height:100%;width:0%;background:var(--accent,#4a7ad0);border-radius:inherit;transition:width .25s';
      const t = document.createElement('span');
      t.style.cssText = 'font-size:12px;line-height:1.4;color:var(--text,#111);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60vw';
      const el = document.createElement('div');
      el.setAttribute('data-packbar', '1');   /* 探针认这个，不靠位置猜 */
      el.style.cssText = 'position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:2147483000;' +
        'display:grid;gap:6px;padding:9px 14px;border-radius:var(--r-card,5px);background:var(--card-bg,rgba(255,255,255,.94));' +
        'box-shadow:var(--sh-float,0 10px 30px rgba(0,0,0,.22));pointer-events:none';
      el.appendChild(t);
      const rail = document.createElement('div');
      rail.style.cssText = 'height:4px;border-radius:var(--r-pill,5px);background:var(--hair-color,var(--line,rgba(0,0,0,.12)));overflow:hidden';
      rail.appendChild(f); el.appendChild(rail);
      document.body.appendChild(el);
      this.el = el; this.fill = f; this.txt = t;
      return el;
    },
    show(text, pct){
      const el = this.ensure();
      this.txt.textContent = text || '处理中…';
      this.fill.style.width = Math.max(2, Math.min(100, pct || 0)) + '%';
      el.style.display = '';
    },
    hide(){ if(this.el) this.el.style.display = 'none'; }
  },
  /* 刷新这一页：名单改了、插件自己的代码存了，都靠这一趟落地 */
  reloadPage(note){
    this.bar.show(note || '这就刷新这一页', 100);
    setTimeout(() => { this.bar.hide(); location.reload(); }, 500);
  },
  /* 只写名单、不刷新这一页：新建 / 导入那一路自己会重载那一家，不用整页翻 */
  async write(ids){
    const A = this.host();
    try{ return (await A.packSet(Array.from(new Set(ids)))) || { ok:false, msg:'没回话' }; }
    catch(e){ return { ok:false, msg:String((e && e.message) || e) }; }
  },
  /* 写名单 + 刷新这一页，一步到位；成功返回 true（页面马上就刷新了，调用方不用再画） */
  async apply(ids, note){
    const A = this.host();
    this.bar.show(note || '改名单…', 20);
    let r = { ok:false, msg:'没接上' };
    try{ r = (await A.packSet(Array.from(new Set(ids)))) || r; }
    catch(e){ r = { ok:false, msg:String((e && e.message) || e) }; }
    if(!r || r.ok === false){ this.bar.hide(); toast('名单没写进去：' + ((r && r.msg) || '')); return false; }
    this.reloadPage('名单改好了 · 这就刷新这一页');
    return true;
  },
  /* 勾了「同步清除数据」才走到这儿：包自己点名的明文文件 + 它占的那几个键，一样样清。
     包本身（data\plugins\<id>\ 或 <id>.zip）一个字都不动。
     sharedKeys 走主进程另一把尺（数据层根那一侧，词库底本那种），plugins\ 它不碰。 */
  async wipe(id, meta){
    const A = this.host();
    const keys = (meta && meta.dataKeys) || Packs.dataKeys(id);
    const kvs = (meta && meta.kvKeys) || Packs.kvKeys(id);
    const shared = (meta && meta.sharedKeys) || Packs.sharedKeys(id);
    if(A && typeof A.packWipe === 'function' && (keys.length || shared.length)){
      const r = await A.packWipe(keys, shared);
      if(r && r.ok === false) toast('数据没清干净：' + (r.msg || ''));
    } else if(keys.length || shared.length){
      toast('清数据这一条只在 Flow-Desk 程序里有 · 那 ' + (keys.length + shared.length) + ' 份还留着，名单已经改好');
    }
    if(kvs.length && typeof H === 'function'){
      for(const k of kvs){ try{ await H().kv.del(k); }catch(e){} }
    }
  },
  /* 卸掉一个：名单里去掉它，顺手（按勾选项）清数据，然后刷新这一页 */
  async uninstall(id, opt){
    const o = opt || {};
    const cur = await this.ids();
    if(!cur){ toast('插件名单读不到 · 这台机器上还没有装过插件'); return false; }
    if(o.wipe) await this.wipe(id);
    return this.apply(cur.filter(x => x !== id), '卸掉「' + Packs.name(id) + '」· 改名单…');
  },
  /* 装回来一个：名单里加上它 */
  async install(id){
    const cur = await this.ids();
    if(!cur){ toast('插件名单读不到 · 这台机器上还没有装过插件'); return false; }
    const nm = Packs.name(id);
    return this.apply(cur.concat([id]), '装上「' + nm + '」· 改名单…');
  },
  /* 导入一个包：一条通道，压好的 zip 和解开的文件夹都认（看挑到的那一个长什么样） */
  async importOne(kind){
    const A = this.host();
    if(!this.canImport()){ toast('导入插件只在 Flow-Desk 程序里有'); return false; }
    let h = null;
    try{
      h = kind === 'dir'
        ? (window.showDirectoryPicker ? await window.showDirectoryPicker({ id:'fd-pack-dir' }) : null)
        : (await window.showOpenFilePicker({ multiple:false, excludeAcceptAllOption:false })).find(Boolean);
    }catch(e){ return false; }   /* 用户按了取消 */
    if(!h){ toast('这一版选不了' + (kind === 'dir' ? '文件夹' : '文件')); return false; }
    const src = (typeof A.pathOf === 'function' && A.pathOf(h)) || h._p || '';
    if(!src){ toast('拿不到那份东西的真路径'); return false; }
    this.bar.show('在把这个包收进插件库…', 6);
    const r = await A.packImport({ src });
    if(!r || r.ok === false){ this.bar.hide(); toast('导入没成：' + ((r && r.msg) || '')); return false; }
    /* #298：这一家落盘了先扫它自己那一格 —— 用到了库里没有的功能模块 / 判断逻辑就问一句要不要提取，
       问完再改名单刷新（刷新会把这一页整页换掉，所以必须排在前面） */
    if(typeof genPendingScanPack === 'function'){
      try{ await genPendingAsk(await genPendingScanPack(r.id)); }catch(e){}
    }
    /* 导入即装上：名单里补上这一个，然后刷新这一页（加载器下一轮就 import 它） */
    const cur = (await this.ids()) || [];
    if(cur.includes(r.id)){ this.reloadPage('导入好了 · 这就刷新这一页'); return true; }
    return this.apply(cur.concat([r.id]), '导入「' + (r.name || r.id) + '」· 改名单…');
  },
  /* ---------- 列表里那几个共用的小按钮 ----------
     「装上」用在没装的那一个上；「卸掉」用在正在加载的那一个上。
     Flow-Desk 和 Why Not Write 各自的组件列表都调这两个，两边的入口一个都不差。 */
  installButton(id, name){
    if(!this.can()) return null;
    return h('button', { class:'wnw-btn mini', title:'把这份装回来（写进名单 + 刷新这一页）',
      onclick:async () => { await this.install(id); } }, '装上' + (name ? ' · ' + name : ''));
  },
  uninstallButton(id, after){
    if(!this.can()) return null;
    return h('button', { class:'wnw-btn mini', title:'停止加载这一段代码（包留在插件库里，随时装回来）',
      onclick:() => this.uninstallAsk(id, after) }, '卸掉');
  },
  /* 删除确认：说清楚这是停止加载、数据默认留着，勾上那一句才一起清 */
  uninstallAsk(id, after){
    const nm = Packs.name(id);
    const info = Packs.info(id) || {};
    const keys = (info.dataKeys || []).concat(info.kvKeys || []);
    const shared = (info.sharedKeys || []).length ? (info.sharedKeys || []) : Packs.sharedKeys(id);
    const all = keys.concat(shared);
    const cb = h('input', { type:'checkbox' });
    const box = h('div', { class:'wnw-col' });
    box.appendChild(h('div', { class:'wnw-hint' },
      '「' + nm + '」是插件。卸掉 = 改名单 + 刷新这一页：这一轮不再加载它，桌上那张卡和它自己那份设置跟着没了。'));
    box.appendChild(h('div', { class:'wnw-hint' },
      '包还收在插件库里 · 想用了在「添加插件」里装回来就是。'));
    if(all.length) box.appendChild(h('label', { class:'wnw-switch' },
      [cb, h('span', {}, '同步清除数据 · ' + all.length + ' 份（' + all.join('、') + '）')]));
    else box.appendChild(h('div', { class:'wnw-hint' }, '这一家没在说明书里点名要存什么东西，数据这块没什么可清的。'));
    H().dlg.open('卸掉插件 · ' + nm, box, [
      h('button', { class:'wnw-btn primary', onclick:async () => {
        H().dlg.close();
        await this.uninstall(id, { wipe:cb.checked });
      }}, '卸掉'),
      h('button', { class:'wnw-btn mini', onclick:() => { H().dlg.close(); if(after) after(); } }, '取消')
    ]);
  },
  /* 导入那一个：一条口子两种形状都收 —— 压好的 zip（别人传给你的成品包）
     和解开的文件夹（本地开发、两台机器之间拷图纸）。挑完交给主进程落地，紧接着写进名单、刷新这一页。 */
  importAsk(after){
    if(!this.canImport()){ toast('导入插件只在 Flow-Desk 程序里有'); return; }
    const btn = (txt, kind, tip) => h('button', { class:'wnw-btn', title:tip, onclick:async () => {
      H().dlg.close(); await this.importOne(kind); if(after) after();
    }}, txt);
    const box = h('div', { class:'wnw-col' });
    box.appendChild(h('div', { class:'wnw-hint' },
      '挑一样东西放进来：压好的压缩包，或者解开的那个文件夹（里面得带着说明书）。'));
    box.appendChild(h('div', { class:'wnw-hint' },
      '收进来一律是解开的样子（压缩包只是运输形状，进门就摊开，方便直接看每一段代码、就地改）。同名已经在那儿就退回不动，不悄悄盖掉你原有的包。导入即装上：写进名单，然后刷新这一页。'));
    H().dlg.open('导入插件', box, [
      btn('选一个 zip', 'zip', '压好的成品包，一个文件带齐说明书和代码'),
      btn('选一个文件夹', 'dir', '解开的样子：本地开发就是这样改的'),
      h('button', { class:'wnw-btn mini', onclick:() => { H().dlg.close(); if(after) after(); } }, '取消')
    ]);
  },
  /* 「这一家是什么来头」：说明书里那几项摆成一页 —— 作者和来源是包里自己带的标记，
     导入进来的第三方包就靠这两行认人。没装的那一个走 diskInfoAsk，形状同一页。 */
  infoAsk(id){
    const m = Packs.info(id) || {};
    this.infoBox({ name:m.name || Packs.name(id), id, version:m.version, author:m.author, source:m.source,
      where:m.where, desc:m.desc, host:m.host, dataKeys:m.dataKeys, kvKeys:m.kvKeys,
      sharedKeys:m.sharedKeys, bank:m.bank, assets:m.assets, inProd:true });
  },
  diskInfoAsk(p){ this.infoBox(Object.assign({ inProd:false }, p)); },
  infoBox(m){
    const line = (k, v) => h('div', { class:'wnw-row', style:'gap:10px' }, [
      h('span', { class:'wnw-hint', style:'min-width:5.5em' }, k), h('span', {}, String((v && v.length) ? v : '—'))]);
    const box = h('div', { class:'wnw-col', style:'gap:7px' });
    box.appendChild(line('名字', m.name));
    box.appendChild(line('代号', m.id));
    box.appendChild(line('作者', m.author));
    box.appendChild(line('来源', m.source));
    box.appendChild(line('版本', m.version));
    box.appendChild(line('住在', (m.inProd ? '这一版产物里有它' : '还没装')));
    box.appendChild(line('给谁用', (m.host || []).join(' / ')));
    box.appendChild(line('存的东西', ((m.dataKeys || []).concat(m.kvKeys || [])).join('、')));
    /* 词库跟着功能走：底本就压在这个包里，卸掉包 = 这段代码和这份底本一起走（用户改过的那份另说） */
    const carries = [];
    if(m.bank && m.bank.which) carries.push((m.bank.name || m.bank.which) + '（跟着这个包一起带的那一份）');
    for(const k of Object.keys(m.assets || {})) carries.push(m.assets[k]);
    box.appendChild(line('自带', carries.join('、')));
    box.appendChild(line('数据层那一侧', (m.sharedKeys || []).join('、')));
    box.appendChild(line('说明', m.desc));
    const ops = [];
    if(!m.inProd && PackOps.can()) ops.push(h('button', { class:'wnw-btn primary',
      onclick:async () => { H().dlg.close(); await PackOps.install(m.id); } }, '装上'));
    ops.push(h('button', { class:'wnw-btn mini', onclick:() => H().dlg.close() }, '关掉'));
    H().dlg.open('插件信息 · ' + (m.name || m.id), box, ops);
  }
};

