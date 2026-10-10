/* ============================================================
   FD · 中立工具的宿主适配
   _shared/ 里那几份中立模块只认几个全局名，
   WNW 有 WNW 的实现，FD 在这里给出 FD 的一份：
     State / TOOL_HOST / registerTool
   （randInt·pickOne·shuffle 从前这里也有一份，外27 全清第 1 条并进了 _shared/sh-rand.js，两家同一份。）
   registerTool 在 WNW 挂成停靠标签，在这里挂成桌面组件：
   卡片里就是原生插件本身，整块内容跟着卡片大小等比缩，点开 ⛶ 铺满封面。
   词库读的是同级目录那一份 data.txt，和 WNW 用的是同一个文件。
   ============================================================ */

/* ---------- 存东西的小KV：和 FD 设置同库，IDB 递不动时先落内存（这一轮里看得见，重启就没） ---------- */
const ToolKv = {
  mem:{},
  async get(k, fb){
    try{ const v = await IDB.get(META.db, META.store, 'set-' + k); return v === undefined ? (k in this.mem ? this.mem[k] : fb) : v; }
    catch(e){ return k in this.mem ? this.mem[k] : fb; }
  },
  async put(k, v){ this.mem[k] = v; try{ await IDB.put(META.db, META.store, v, 'set-' + k); }catch(e){} },
  async del(k){ delete this.mem[k]; try{ await IDB.del(META.db, META.store, 'set-' + k); }catch(e){} }
};

/* 工具的表单记忆：和 WNW 的 State 同签名（get 是 Promise，set 立刻返回） */
const State = {
  mem:null, timer:null,
  async load(){ if(!this.mem) this.mem = (await ToolKv.get('tools-state', {})) || {}; },
  async get(key, fb){ await this.load(); return this.mem[key] === undefined ? fb : this.mem[key]; },
  set(key, val){ this.load().then(() => {
    this.mem[key] = val;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => ToolKv.put('tools-state', this.mem), 400);
  }); }
};

/* 词库编辑器（BankDlg）在 _shared/sh-bank-ui.js，两个宿主同一份；
   FD 这边只把它挂到对话框上：Modal 标题栏已经有关闭钮，第四个参数（WNW 的宽窄）这里用不上。 */

/* 中立引擎里的「复制」按钮靠这两个函数；FD 外壳原本没有同名件，自己补一套 */
function copyText(text){
  const v = String(text == null ? '' : text);
  if(navigator.clipboard && window.isSecureContext)
    return navigator.clipboard.writeText(v).then(() => true).catch(() => legacyCopy(v));
  return Promise.resolve(legacyCopy(v));
}
function legacyCopy(v){
  try{
    const ta = h('textarea', { style:'position:fixed;left:-9999px;top:0' }); ta.value = v;
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove(); return ok;
  }catch(e){ return false; }
}
function copyBtn(text, label){
  return h('button', { class:'wnw-btn mini', onclick:async () => {
    const v = await (typeof text === 'function' ? text() : text);
    toast(await copyText(v) ? '已复制到剪贴板' : '复制失败，请手动选中');
  }}, label || '复制');
}

/* ---------- 中立词库层要的宿主接口 ----------
   这一串前缀两种开法都要管，取的值不一样：
     · Flow-Desk 程序（fdapp://）：页面在 pages\，词库、配方、生成记录都在隔壁 data\，
       所以往上跳一级再进 data\（fdapp://app/data/…）；
     · 本地开发那台服务器（fd-serve）：地址栏那一级就是 pages\，服务器在页面层找不到这份文件时
       会自动往数据层再找一次，所以前缀留空就能够到同一批明文。
   这两个值不只是网址：写盘那几条（FD_APP.writePageFile / writePageBytes）拿的也是这一串，
   主进程按「页面文件所在的位置」去解它，所以两种开法各要各的跳法，合不成一条。
   把 html 双击直接打开那一种已经废止 —— 组件由 Flow-Desk 程序加载，那种开法里根本没有组件。
   哪份词库归哪个包、明文落在哪儿，写在包的插件清单里（bank.user），这儿不再硬点名。 */
const DATA_PRE = (window.FD_APP && location.protocol === 'fdapp:') ? '../data/' : '';
window.TOOL_HOST = {
  id:'fd',
  get kv(){ return ToolKv; },
  /* 自建词库、包自带底本和生成器配方都落在数据层 */
  bankDir:DATA_PRE, components:DATA_PRE + 'plugins/', logDir:DATA_PRE + 'gen-log/',
  async picked(which){ return await ToolKv.get('banktxt.' + which, null); },
  dlg:{ open(t, b, f, opt){ Modal.open(t, b, f, null, opt); }, close(){ Modal.close(); } },
  pick(which){ return pickBank(which); },
  /* 完全删除一个配方组件：注册表那一格和首页上用它的卡一起摘掉 */
  unregister(id){
    const key = 'tool-' + id;
    Registry.delete(key);
    if(Shell.layout && Shell.layout.items.some(i => i.widget === key)){
      Shell.layout.items = Shell.layout.items.filter(i => i.widget !== key);
      Shell.save();
    }
  }
};
async function pickBank(which){
  const [h] = await window.showOpenFilePicker({ multiple:false, types:[{ description:'词库明文', accept:{ 'text/plain':['.txt'] } }] });
  const txt = await (await h.getFile()).text();
  if(!/^【.+】$/m.test(txt)) throw new Error('这份文件里没有【分类】打头的行，不像词库');
  await ToolKv.put('banktxt.' + which, txt);
  Banks._base[which] = null;
  await mkBank(which).reload();
  toast('词库已换成所选文件');
}

/* ---------- registerTool：工具定义 → 桌面组件 ---------- */
const TOOL_W = 760;      /* 工具铺开时的设计宽度，卡片比它小就整体缩 */
/* 开机第一份定义单独留一格：改代码之后重载会把 Registry 里那一格顶掉，这一格不动 ——
   设置入口找兜底要看的是第一份，不是重载之后的那一份 */
const TOOL_DEFS = new Map();
/* 词库读到了给 null，读崩了才把错本身递下去 —— 光 catch 会把成功那一头的返回值也当成错 */
function registerTool(def){
  if(!TOOL_DEFS.has(def.id)) TOOL_DEFS.set(def.id, def);
  const ready = Promise.resolve(def.ready).then(() => null, e => e);
  const c = def.card || {};
  registerWidget({
    id:'tool-' + def.id, name:def.name, noName:c.noName, minW:c.minW || 6, minH:c.minH || 5,
    def:{ w:(c.def && c.def.w) || 16, h:(c.def && c.def.h) || 12 },
    expand(){ openToolFull(def, ready); },
    async mount(body, ctx){ return mountToolCard(def, body, ready, ctx && ctx.expanded); }
  });
}
function toolBase(id){ return TOOL_DEFS.get(id); }
/* 改代码要找的「内置那一份」：先认功能（_shared 那三件和配方），再认桌面组件（便签、日程这些） */
function baseDef(id){
  if(TOOL_DEFS.has(id)) return { id:id, via:'tool', def:TOOL_DEFS.get(id) };
  const w = WIDGET_BASE.get(id);
  return w ? { id:id, via:'widget', def:w } : null;
}
async function mountToolCard(def, body, ready, expanded){
  const box = h('div', { class:'sh-box' });
  const host = h('div', { class:'sh-tools' });
  const hint = h('div', { class:'fd-empty' }, (def.card && def.card.wait) || '正在读词库…');
  box.appendChild(hint); box.appendChild(host);
  body.appendChild(box);
  const err = await ready;
  hint.remove();
  if(err){ box.appendChild(toolError(def, err)); return { unmount(){} }; }
  /* 自己管排版的组件（音乐控件）：卡片多大就铺多大，字号用 fitBox 缩，不整体 scale */
  if(def.card && def.card.native){
    box.classList.add('sh-fill'); host.classList.add('sh-fill', 'fd-fit');
    if(expanded) host.dataset.scroll = '1';
    def.mount(host, { expanded:!!expanded });
    return expanded ? { unmount(){} } : fitLive(host);
  }
  /* 展开够大：左右两栏各滚各的；小卡仍然整块等比缩到 9px 截断 */
  if(expanded){
    box.classList.add('sh-fill'); host.dataset.scroll = '1';
    def.mount(host);
    return { unmount(){} };
  }
  def.mount(host);
  return scaleToFit(box, host);
}
/* native 卡里的内容自己会重画（歌词一句句换）：量一遍字号之后还得盯着子树。
   但只量一次那一档 —— 字号钉死，换句换歌不再重算（opt.pin，音-8）。 */
function fitLive(host){
  let queued = false;
  const raf = () => {
    if(queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; if(host.isConnected) fitBox(host, { pin:true }); });
  };
  const fb = fitBox(host, { pin:true });
  const mo = new MutationObserver(raf);
  mo.observe(host, { childList:true, subtree:true });
  return { unmount(){ mo.disconnect(); fb.dispose(); } };
}
/* 词库读不到时不报错刷屏，给一句白话和一个选文件的按钮 */
function toolError(def, err){
  const line = (err && err.message) || String(err);
  return h('div', { class:'fd-empty' }, [
    h('div', {}, def.name + '的词库没读到'),
    h('div', { style:'font-size:.86em;opacity:.75;margin-top:4px' }, line),
    h('button', { class:'fd-btn', style:'margin-top:8px', onclick:() => pickBank(def.id).catch(e => toast(e.message || String(e))) }, '选一次词库文件')
  ]);
}
function openToolFull(def, ready){
  const host = h('div', { class:'sh-tools', style:'flex:1 1 auto;min-width:0', 'data-scroll':'1' });
  const wrap = h('div', { class:'sh-cover sh-fill' }, host);
  Cover.openNode(def.name, coverWrap(wrap));
  /* 声明了 band 的那一家（音乐遥控器）：封面这一层收成中间一条竖带，两边归遮罩。
     开关由组件在 def.card 里声明，宿主只是照办，插件自己去摸宿主那一层是越界。 */
  const cov = wrap.closest('.fd-cover');
  const band = !!(cov && def.card && def.card.band);
  cov.classList.toggle('fd-cover-band', band);
  if(band) bandMode(cov);
  ready.then(err => { if(err) { wrap.innerHTML = ''; wrap.appendChild(toolError(def, err)); } else def.mount(host, { expanded:true }); });
}
/* ---------- 竖带那一档的横向拉宽（外17 乙-3） ----------
   把手贴在带的右缘，拖出去整条带子变宽（居中，所以拖一点、两边各让一点）。
   宽度记在 %userData%\ui-band.json 那一行明文里，下次开还是这个宽。
   把手挂在 .fd-cover-body 里：关封面那一格被清空，把手跟着没，不留没人认账的节点。 */
const BAND_KEY = 'ui-band.json', BAND_MIN = 320;
function bandPx(px){
  const max = Math.max(BAND_MIN, Math.round(innerWidth * 0.94));
  return Math.max(BAND_MIN, Math.min(max, Math.round(px)));
}
function bandMode(cov){
  const body = cov.querySelector('.fd-cover-body');
  if(!body) return;
  const A = window.FD_APP;
  try{ if(A && A.dataRead) A.dataRead(BAND_KEY).then(t => {
    const n = Number(t && JSON.parse(t).w);
    if(n) cov.style.setProperty('--fd-band-w', bandPx(n) + 'px');
  }).catch(() => {}); }catch(e){}
  const grip = h('div', { class:'fd-band-grip', title:'按住左右拖：这一条带子多宽' });
  body.appendChild(grip);
  grip.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    try{ grip.setPointerCapture(ev.pointerId); }catch(e){}
    const start = body.getBoundingClientRect().width, x0 = ev.clientX;
    const mv = e => cov.style.setProperty('--fd-band-w', bandPx(start + (e.clientX - x0) * 2) + 'px');
    const up = () => {
      grip.removeEventListener('pointermove', mv);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      const w = bandPx(body.getBoundingClientRect().width);
      cov.style.setProperty('--fd-band-w', w + 'px');
      try{ if(A && A.dataWrite) A.dataWrite(BAND_KEY, JSON.stringify({ w, at:new Date().toISOString() }, null, 2)); }catch(e){}
    };
    grip.addEventListener('pointermove', mv);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  });
}

/* ---------- 整块等比缩：卡片多大就按多大摆，缩到 9px 封顶，再小就只露出上面那截 ---------- */
function scaleToFit(box, host){
  let busy = false;
  const fit = () => {
    if(busy) return;
    const aw = box.clientWidth, ah = box.clientHeight;
    if(!aw || !ah) return;
    busy = true;
    host.style.transform = 'none';
    host.style.width = TOOL_W + 'px';
    host.style.height = 'auto';
    const nh = Math.max(host.scrollHeight, 1);
    const base = parseFloat(getComputedStyle(host).fontSize) || 14;
    let f = Math.min(1, aw / TOOL_W, ah / nh);
    const min = FIT_MIN_PX / base;
    if(f < min) f = min;
    host.style.width = Math.round(aw / f) + 'px';
    host.style.height = Math.round(ah / f) + 'px';
    host.style.transform = 'scale(' + f.toFixed(3) + ')';
    busy = false;
    const card = box.closest('.fd-card');
    const fade = card && card.querySelector('.fd-cut');
    if(fade) fade.style.opacity = (nh * f > ah + 1) ? 1 : 0;
  };
  const raf = () => requestAnimationFrame(fit);
  const ro = new ResizeObserver(raf); ro.observe(box);
  /* 工具每次重画都换掉整棵子树，尺寸跟着变，所以要盯着内容再量一遍 */
  const mo = new MutationObserver(raf); mo.observe(host, { childList:true, subtree:true });
  fit();
  return { dispose(){ ro.disconnect(); mo.disconnect(); } };
}

document.head.appendChild(h('style', { html:`
.sh-box{position:relative;flex:1 1 auto;min-height:0;overflow:hidden}
.sh-box > .sh-tools{position:absolute;left:0;top:0;transform-origin:0 0}
.sh-cover{height:100%;overflow:auto;padding:2px}
/* 展开态不整块缩放：工具铺满卡面，滚动交给左右两栏自己 */
.sh-box.sh-fill{display:flex}
.sh-box.sh-fill > .sh-tools{position:static;flex:1 1 auto;min-height:0;width:auto;height:auto;transform:none}
.sh-cover.sh-fill{overflow:hidden;display:flex;flex-direction:column}
/* 竖带右缘那一枚拉宽的把手：平时几乎看不见，压上去和拖的时候亮出来（单层、不画提示符号） */
.fd-band-grip{position:absolute;top:0;bottom:0;right:0;width:9px;cursor:ew-resize;z-index:3;
  background:transparent;transition:background .15s;}
.fd-band-grip:hover,.fd-band-grip:active{background:var(--accent-light)}
/* 工具区里的那些类原本只在 WNW 外壳里定义，FD 这边由 _shared/sh-style.js 补一份 */
`}));
