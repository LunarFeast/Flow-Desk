/* 外30 乙组 · 图10「批注不要这种弹窗，要类似 word 的侧边栏批注填写」+ 图11「缺少指示批注原文的连线、和批注原文的突出格式」
   这一台不改代码：把真源码里这一整条路（三个入口 newAnno / annoBtn / ParaEd.annoDlg → addAnno → drawSide → annoCard
   的草稿那一格 → 走开收回 → dirty → save → 落盘，加上 CeEd.paint 给原文挂号、syncLinks 量两头画折线）
   原样切进 node:vm，配一层会记焦点、会报方框位置的假 DOM 和可控时钟。
   只在边界上使替身：修订痕迹（Trace.ranges 交空 —— 那一摊有 test-marks 管）、高亮规则（WriteCfg.开=false）、
   批注显示开关（AnnoView.on=true，出厂默认）、图标（icoMarkup）、弹框问答（wnwAsk）、逐字记录（KLog）、
   落盘（Work.saveCh 收进内存数组）、字数（parasCount 交 0 —— 页脚那行字数不归这一台量）。 */
import vm from 'node:vm';
import { rd, 切, 切方法, 记账 } from './lib-slice.mjs';

const R = 记账('test-annodraft');
const 静 = async (n = 30) => { for(let i = 0; i < n; i++) await Promise.resolve(); };

const W8 = rd('src/_wnw/src/w8-write.js');
const W7 = rd('src/_wnw/src/w7-data.js');
const W10 = rd('src/_wnw/src/w10-cards.js');
const W1 = rd('src/_wnw/src/w1-core.js');
const W12 = rd('src/_wnw/src/w12-rich.js');
const W18 = rd('src/_wnw/src/w18-lyric.js');
const CV = W8.indexOf('class ChView{');
const CE = W8.indexOf('class CeEd{');
const PE = W8.indexOf('class ParaEd{');
if(CV < 0 || CE < 0 || PE < 0) throw new Error('找不到那三家 class');
const 界 = (src, 起) => { const n = src.indexOf('\nconst ', 起), k = src.indexOf('\nclass ', 起), f = src.indexOf('\nfunction ', 起);
  return [n, k, f].filter(x => x > 起).sort((a, b) => a - b)[0] || src.length; };
const 止CV = 界(W8, CV), 止CE = 界(W8, CE), 止PE = 界(W8, PE);

const 章法 = ['  sideOn(){', '  drawSide(){', '  syncLinksSoon(){', '  syncLinks(){', '  annoCard(a){', '  revCard(it){',
  '  openRevs(){', '  newAnno(sl){', '  async addAnno(a){', '  annoBtn(el){', '  dirty(){', '  logKeys(){',
  '  async save(manual){', '  drawFoot(msg){'].map(头 => 切方法(W8, 头, CV, 止CV));
const 拼 = `
${切(W8, 'locateAnno')}
${切(W10, 'cut')}
${切(W1, 'esc')}
${切(W7, 'uid')}
${切(W18, 'LYRIC_MODE')}
${切(W12, 'Spans')}
const AnnoView = { on:true };
const WriteCfg = { 开:false };
const Trace = { ranges:() => [], trim:x => x };
const BLOCK_MAP = new Map();
const parasCount = () => ({ han:0, w:0 });
/* mdOf 只在笔记模式下被 lineOf / paint 那一句三元取走，这一台全程停在写作模式：给一个最窄替身 */
const mdOf = p => p.t || '';
const ChView = class ChView{
  constructor(host, ctx){ this.host = host; this.ctx = ctx; this.c = null; }
${章法.join('\n')}
  /* 真 olCount / buildBody / head 那一摊要整屏控件，这一台只走批注这条路：给一个不重画的替身 */
  redraw(){ this.重画 = (this.重画 || 0) + 1; }
  acceptAll(){ this.全接受 = (this.全接受 || 0) + 1; }
};
/* 正文那一头（contenteditable）：真 marked 交回带 span 的串 */
const CeEd = class CeEd{
${切方法(W8, '  lineOf(p){', CE, 止CE)}
${切方法(W8, '  marked(p){', CE, 止CE)}
};
/* 章纲那一头（一段一个 textarea）：真 paint 把串塞进 r.hl.innerHTML */
const ParaEd = class ParaEd{
${切方法(W8, '  paint(r){', PE, 止PE)}
${切方法(W8, '  annoDlg(){', PE, 止PE)}
  fit(r){}
};
this.件 = { ChView, CeEd, ParaEd, locateAnno, cut, uid };
`;

/* ---------- 假 DOM：记焦点、报方框、认 [attr="x"]、svg 走 createElementNS ---------- */
const 替 = `
var 时钟 = { t:0, 队:[], id:1 };
function setTimeout(f, ms){ const h = 时钟.id++; 时钟.队.push({ 到:时钟.t + (ms || 0), f, h }); return h; }
function clearTimeout(h){ const i = 时钟.队.findIndex(x => x.h === h); if(i >= 0) 时钟.队.splice(i, 1); }
function requestAnimationFrame(f){ return setTimeout(f, 16); }
var 焦点 = null;
function 方框(e){ const r = e.矩 || { left:0, top:0, width:0, height:0 };
  return { left:r.left, top:r.top, width:r.width, height:r.height, right:r.left + r.width, bottom:r.top + r.height }; }
function 元素(标记, at){
  const el = { 标记, 属:{}, kids:[], style:{}, 类:'', value:'', textContent:'',
    get firstChild(){ return this.kids[0] || null; },
    appendChild(x){ this.kids.push(x); x.父 = this; return x; },
    removeChild(x){ const i = this.kids.indexOf(x); if(i >= 0) this.kids.splice(i, 1); return x; },
    setAttribute(k, v){ this.属[k] = String(v); },
    getAttribute(k){ return this.属[k]; },
    addEventListener(k, f){ this.听 = this.听 || {}; (this.听[k] = this.听[k] || []).push(f); return f; },
    发(k, e){ for(const f of ((this.听 && this.听[k]) || [])) f.call(this, Object.assign({ target:this,
      stopPropagation(){}, preventDefault(){} }, e || {})); },
    contains(x){ if(x === this) return true; return this.kids.some(k => k.contains && k.contains(x)); },
    querySelector(sel){ const m = /^\\[([\\w-]+)="([^"]*)"\\]$/.exec(sel); if(!m) throw new Error('这台不认这个选择器：' + sel);
      const 找 = e => { if(e.属 && e.属[m[1]] === m[2]) return e; for(const k of e.kids){ const r = 找(k); if(r) return r; } return null; };
      return 找(this); },
    querySelectorAll(sel){ const 收 = [], 走 = e => { const q = e.querySelector(sel); if(q) 收.push(q); e.kids.forEach(走); };
      this.kids.forEach(走); return 收; },
    focus(){ 焦点 = this; this.发('focus'); },
    blur(){ if(焦点 !== this) return; 焦点 = null; this.发('blur'); },
    set className(v){ this.类 = v; }, get className(){ return this.类 || ''; },
    get classList(){ const e = this; return { add(c){ e.类 = (e.类 + ' ' + c).trim(); }, remove(){} } },
    set innerHTML(v){ this.内 = v; if(v === '') this.kids = []; }, get innerHTML(){ return this.内 || ''; },
    getBoundingClientRect(){ return 方框(this); } };
  Object.assign(el.属, at || {});
  if(at && at.class) el.类 = at.class;
  if(at && at.style) el.style = at.style;
  for(const k of Object.keys(at || {})){ if(k === 'class' || k === 'style') continue;
    if(/^on[a-z]+$/.test(k)) el.addEventListener(k.slice(2), at[k]); else el.属[k] = at[k]; }
  if(at && at.title) el.属.title = at.title;
  return el;
}
var h = (标记, at, kids) => {
  const el = 元素(标记, at);
  if(typeof kids === 'string') el.textContent = kids;
  else if(Array.isArray(kids)) for(const x of kids) if(x) el.appendChild(x);
  return el;
};
var document = { get activeElement(){ return 焦点; },
  createElementNS(ns, 标记){ const e = 元素(标记, {}); e.namespaceURI = ns; return e; } };
var 弹框 = [];
var Overlay = { open(t){ 弹框.push(String(t)); }, close(){} };
var 报话 = [];
var toast = m => { 报话.push(String(m)); };
var Bus = { map:{}, on(k, f){ (this.map[k] = this.map[k] || []).push(f); return () => {}; },
  emit(k, a){ (this.map[k] || []).slice().forEach(f => { try{ f(a); }catch(e){ 抛错.push(e); } }); } };
var 抛错 = [];
var 左栏画过 = 0;
var Desk = { emit(k){ 这章事件.push('desk:' + k); Bus.emit('desk:' + k); }, drawLeft(){ 左栏画过++; } };
var 这章事件 = [];
var KLog = { 记:0, async diff(){ KLog.记++; } };
var 存过 = [];
var Work = { book:{ id:'b1', title:'测试书' }, totalWords:() => 0, todayWords:() => 0,
  async saveCh(c){ 存过.push(JSON.parse(JSON.stringify({ id:c.id, annos:c.annos }))); } };
var Occur = { cells:[], async load(){ Occur.Load = (Occur.Load || 0) + 1; } };
var icoMarkup = n => '<i class="ico-' + n + '"></i>';
var wnwAsk = async () => true;
var confirm = () => true;
var Menu = { under(el, items){ Menu.最后一次 = items; 菜单开过++; } };
var 菜单开过 = 0;
var State = { async get(k, d){ return d; }, async set(){} };
`;

function 台(码){
  const 沙 = { R };
  vm.createContext(沙);
  vm.runInContext(替, 沙);
  vm.runInContext(码 || 拼, 沙);
  Object.assign(沙, 沙.件);
  沙.跑 = async ms => {
    const 标 = 沙.时钟.t + ms;
    let 圈 = 0;
    while(沙.时钟.队.some(x => x.到 <= 标) && 圈++ < 800){
      const xs = 沙.时钟.队.filter(x => x.到 <= 标).sort((a, b) => a.到 - b.到);
      沙.时钟.t = xs[0].到;
      沙.时钟.队 = 沙.时钟.队.filter(x => x.到 > 标);
      for(const x of xs){ x.f(); await new Promise(r => setImmediate(r)); }
    }
    沙.时钟.t = 标;
    await new Promise(r => setImmediate(r));
    await new Promise(r => setImmediate(r));
  };
  return 沙;
}

/* 一章两段 + 一套画好的架子（flow / svg / edHost / sideBox），方框位置全在这里给定 */
function 开章(沙, 段文){
  const c = { id:'ch1', mode:'write', title:'第一章', annos:[], outline:[],
    paras:(段文 || ['白衣下了桥。', '桥下水声不响。']).map((t, i) => ({ id:'p' + i, k:'p', t, done:false })) };
  const v = new 沙.ChView(沙.h('div'), { ref:'ch1' });
  v.c = c;
  v.kWas = c.paras.map(p => p.t);
  v.showSide = true;
  v.flow = 沙.h('div', { class:'wnw-flow' });  v.flow.矩 = { left:0, top:0, width:900, height:500 };
  v.linkSvg = 沙.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  v.edHost = 沙.h('div', { class:'wnw-body' }); v.edHost.矩 = { left:20, top:20, width:600, height:460 };
  v.olSlot = 沙.h('div', { class:'wnw-olcard' }); v.olSlot.矩 = { left:20, top:0, width:0, height:0 };
  v.sideBox = 沙.h('div', { class:'wnw-side' }); v.sideBox.矩 = { left:660, top:20, width:220, height:460 };
  v.sideTab = 沙.h('button', { class:'wnw-side-tab' });
  v.foot = 沙.h('div', { class:'wnw-doc-foot' });
  v.flow.appendChild(v.edHost); v.flow.appendChild(v.sideBox);
  /* 正文那一头的替身：paintAll 只数次数；sel() 交出「选中的那几个字」，号由真 paint 挂 */
  v.画上 = 0;
  v.ed = { paintAll(){ v.画上++; }, sel:() => v.选 || null };
  return v;
}
/* 把正文里被批的那几个字摆进 edHost（真身是 CeEd.paint 造的串，这里按同一个号摆一个带方框的替身） */
function 摆原文(沙, v, 号, 矩){
  const s = 沙.h('span', { class:'anno-on', 'data-anno':号 }); s.矩 = 矩 || { left:100, top:60, width:80, height:20 };
  v.edHost.appendChild(s);
  return s;
}
const 草稿格 = v => {
  const 找 = e => e.标记 === 'textarea' ? e : (e.kids || []).reduce((a, k) => a || 找(k), null);
  return 找(v.sideBox);
};
const 卡 = (v, 号) => v.sideBox.querySelector('[data-anno-card="' + 号 + '"]');
const 线 = v => (v.linkSvg.kids || []).map(p => p.属.d);

/* ---------- 一、三个入口都不开弹框，只在栏里挂一条空的 ---------- */
R.题('一、三个入口：右键「添加批注」／工具栏「批注」钮／章纲那头');
{
  const 沙 = 台(); const v = 开章(沙);
  const p = v.c.paras[0];
  v.选 = { p, from:0, to:2, quote:'白衣' };
  v.newAnno(v.选);
  await 静();
  R.判('右键那条路一个弹框都没开（Overlay 开过 ' + 沙.弹框.length + ' 次）', 沙.弹框.length === 0, 沙.弹框.join('|'));
  R.判('批注挂上了 1 条，里面文字还是空的（等人在栏里写）', v.c.annos.length === 1 && v.c.annos[0].text === '',
    JSON.stringify(v.c.annos.map(a => a.text)));
  R.判('号、段落、偏移、原话四项都齐', !!v.c.annos[0].id && v.c.annos[0].para === 'p0'
    && v.c.annos[0].at === 0 && v.c.annos[0].quote === '白衣', JSON.stringify(v.c.annos[0]));
  const 格 = 草稿格(v);
  R.判('栏里立刻出现可写的那一格（textarea），并且带着这一条的号', !!格 && !!卡(v, v.c.annos[0].id), 格 ? '有' : '没有');
  R.判('那一格只说自己是干什么的，不带解释小字：「' + (格 && 格.属.placeholder) + '」',
    !!格 && 格.属.placeholder === '写下你的批注', 格 && 格.属.placeholder);
  await 沙.跑(20);
  R.判('光标自己走进那一格（不用手再点一下）', 沙.document.activeElement === 格, String(沙.document.activeElement && 沙.document.activeElement.标记));

  const 沙2 = 台(); const v2 = 开章(沙2);
  v2.选 = { p:v2.c.paras[1], from:0, to:2, quote:'桥下' };
  const 钮 = 沙2.h('button', {});
  v2.annoBtn(钮);
  await 静();
  R.判('工具栏「批注」钮：有选区时走的是同一条路（不开弹框、菜单也不出，量到菜单开过 ' + 沙2.菜单开过 + ' 次）',
    沙2.弹框.length === 0 && 沙2.菜单开过 === 0 && v2.c.annos.length === 1, 沙2.弹框.length + '/' + 沙2.菜单开过 + '/' + v2.c.annos.length);
  v2.选 = null; v2.annoBtn(钮);
  R.判('没选区时那个钮开的是那份菜单（显示 / 隐藏 / 删除），不是批注弹框', 沙2.菜单开过 === 1 && 沙2.弹框.length === 0, 沙2.菜单开过 + '');

  const 沙3 = 台(); const v3 = 开章(沙3);
  const pe = new 沙3.ParaEd();
  const ta = 沙3.h('textarea'); ta.value = '白衣下了桥'; ta.selectionStart = 0; ta.selectionEnd = 2; ta.focus();
  pe.rows = [{ ta, p:v3.c.paras[0] }]; pe.api = v3;
  pe.annoDlg();
  await 静();
  R.判('章纲那头那一条路也不开弹框，交回的是空批注', 沙3.弹框.length === 0 && v3.c.annos.length === 1
    && v3.c.annos[0].text === '' && v3.c.annos[0].quote === '白衣', 沙3.弹框.length + ' / ' + JSON.stringify(v3.c.annos));
  v3.c.annos = []; pe.rows = []; pe.annoDlg();
  R.判('章纲那头没选字：报一句「先在正文里选中」，一条都不挂', v3.c.annos.length === 0
    && 沙3.报话.some(x => /先在正文里选中/.test(x)), 沙3.报话.join('|'));
}

/* ---------- 二、写完走开：存住 ---------- */
R.题('二、写完走开（blur）：存住，还跟着 1.2 秒那一趟落进盘');
{
  const 沙 = 台(); const v = 开章(沙);
  v.选 = { p:v.c.paras[0], from:0, to:2, quote:'白衣' };
  v.newAnno(v.选); await 静();
  const 格 = 草稿格(v); await 沙.跑(20);
  格.value = '这一处和后文的桥下对得上';
  格.blur();
  await 静();
  R.判('走开那一下把字写进这一条（a.text）并记了时刻（at2）', v.c.annos[0].text === '这一处和后文的桥下对得上'
    && !!v.c.annos[0].at2, JSON.stringify([v.c.annos[0].text, v.c.annos[0].at2]));
  R.判('这一条不再是草稿形状：栏里那一格没有 textarea 了', !草稿格(v) && !!卡(v, v.c.annos[0].id), 草稿格(v) ? '还在' : '没了');
  const 前 = 沙.存过.length;
  await 沙.跑(1500);
  const 末 = 沙.存过[沙.存过.length - 1];
  R.判('真 dirty → 1.2 秒 → save 这条路走通，落盘那一份带着这条字（这一趟存了 ' + (沙.存过.length - 前) + ' 次）',
    沙.存过.length > 前 && 末 && 末.annos.length === 1 && 末.annos[0].text === '这一处和后文的桥下对得上',
    末 ? JSON.stringify(末.annos) : '(一次都没存)');
  R.判('落盘那一份里没有空批注', (末.annos || []).every(a => a.text), JSON.stringify(末.annos));
  R.数('正文那头重画了几遍（paintAll 计数）', v.画上);
  R.数('页脚写的是', v.foot.textContent || (v.foot.kids || []).map(x => x.textContent).join(''));
}

/* ---------- 三、空着走开 / 按 Esc：整条收回 ---------- */
R.题('三、一个字没写就走开 / 按 Esc：整条收回，不留空批注');
{
  const 沙 = 台(); const v = 开章(沙);
  v.选 = { p:v.c.paras[0], from:0, to:2, quote:'白衣' };
  v.newAnno(v.选); await 静();
  const 格 = 草稿格(v); await 沙.跑(20);
  格.value = '   ';
  格.blur();
  await 静();
  R.判('只输了空格：走开之后这一条整个没了（批注数 ' + v.c.annos.length + '）', v.c.annos.length === 0, v.c.annos.length + '');
  v.选 = { p:v.c.paras[0], from:0, to:2, quote:'白衣' };
  v.newAnno(v.选); await 静();
  const 格2 = 草稿格(v); await 沙.跑(20);
  格2.发('keydown', { key:'Escape' });
  await 静();
  R.判('按 Esc 走的是同一条收回的路（批注数 ' + v.c.annos.length + '）', v.c.annos.length === 0, v.c.annos.length + '');
  const 前 = 沙.存过.length;
  await 沙.跑(1500);
  const 末 = 沙.存过[沙.存过.length - 1];
  R.判('收回之后落盘那一份也是空的（不是盘上还剩一条空批注）', 沙.存过.length > 前 && 末 && 末.annos.length === 0,
    末 ? JSON.stringify(末.annos) : '(一次都没存)');
}

/* ---------- 四、Ctrl+Enter 当场定稿 ---------- */
R.题('四、Ctrl+Enter：不挪光标也当场存住');
{
  const 沙 = 台(); const v = 开章(沙);
  v.选 = { p:v.c.paras[1], from:0, to:4, quote:'桥下水声' };
  v.newAnno(v.选); await 静();
  const 格 = 草稿格(v); await 沙.跑(20);
  格.value = '这里收一句';
  格.发('keydown', { key:'Enter', ctrlKey:true });
  await 静();
  R.判('按 Ctrl+Enter 之后 a.text 已经是写的字', v.c.annos[0].text === '这里收一句', JSON.stringify(v.c.annos[0].text));
  R.判('当场就不许焦点还留在那一格（走开了才收回的规矩不能反过来卡人）', 沙.document.activeElement !== 格,
    String(沙.document.activeElement && 沙.document.activeElement.标记));
}

/* ---------- 五、上一次没写完留下的空条：再画一遍不抢光标 ---------- */
R.题('五、没写完就切走（盘上留了一条空的），下一次打开不许抢光标');
{
  const 沙 = 台(); const v = 开章(沙);
  v.c.annos = [{ id:'a9', para:'p0', at:0, quote:'白衣', text:'', replies:[], paraIdx:0 }];
  const 编辑 = 沙.h('textarea'); 编辑.focus();
  v.草稿 = null;
  v.drawSide();
  await 沙.跑(20);
  const 格 = 草稿格(v);
  R.判('空的那一条照样摆在栏里（能点进去接着写）', !!格 && !!卡(v, 'a9'), 格 ? '有' : '没有');
  R.判('但不自动把光标抢过去（焦点还在正文那一头）', 沙.document.activeElement === 编辑,
    String(沙.document.activeElement && 沙.document.activeElement.标记));
  格.focus(); 格.value = '接着写完了'; 格.blur();
  await 静();
  R.判('点进去认领之后走开一样存住', v.c.annos[0].text === '接着写完了', JSON.stringify(v.c.annos[0].text));
}

/* ---------- 六、焦点闸：正在栏里写，别处的重画不许换掉这一格 ---------- */
R.题('六、正在那一格里打字时来了一趟重画（dirty / 保存 / 事件）');
{
  const 沙 = 台(); const v = 开章(沙);
  v.选 = { p:v.c.paras[0], from:0, to:2, quote:'白衣' };
  v.newAnno(v.选); await 静();
  const 旧格 = 草稿格(v); await 沙.跑(20);
  旧格.value = '写到一';
  v.dirty();                       /* 每敲一下都会走的那一趟 */
  await 静();
  const 被换 = 草稿格(v) !== 旧格;
  R.判('这一格没被换掉（换了就等于把光标从字里抢走，批注写到一半断掉）', !被换, 被换 ? '换成了新一格' : '还是原来那一格');
  R.判('焦点还在原来那一格上', 沙.document.activeElement === 旧格, String(沙.document.activeElement && 沙.document.activeElement.value));
  await 沙.跑(1500);               /* 那一趟自动保存也照样不许换（存的是「写到一」之前的空草稿以外的那一条） */
  R.数('保存之后栏里有没有被换（量到的这一格是不是原来那一个）', 草稿格(v) === 旧格);
  旧格.value = '写到一半'; 旧格.blur();
  await 静();
  R.判('最后走开照样存住（中途没被打断）', v.c.annos[0].text === '写到一半', JSON.stringify(v.c.annos[0].text));
}

/* ---------- 七、图11 前半：正文那几个字带上号（两头各量一遍真渲染） ---------- */
R.题('七、原文突出：被批的那几个字（正文 CeEd.marked + 章纲 ParaEd.paint 两条真渲染）');
{
  const 沙 = 台(); const v = 开章(沙);
  const a = { id:'a1', para:'p0', at:0, quote:'白衣', text:'桥下那句和它对', replies:[] };
  v.c.annos = [a];
  const ce = new 沙.CeEd();
  ce.mode = 'write'; ce.api = { annos:() => v.c.annos, hlExtra:() => [] };
  const 串 = ce.marked(v.c.paras[0]);
  R.判('正文那一头：那几个字被 class="anno-on" 的 span 包住（底色 + 下边线那一档）',
    /<span class="anno-on"[^>]*>白衣<\/span>/.test(串), 串);
  R.判('这一个 span 同时带着这条批注的号（折线才找得到两头）', /data-anno="a1"/.test(串), 串);
  const pe = new 沙.ParaEd();
  pe.mode = 'write'; pe.showRev = false; pe.showAnno = true; pe.api = { annos:() => v.c.annos, revOn:false };
  pe.rows = [];
  const hl = 沙.h('div', { class:'wnw-hl' });
  pe.paint({ p:v.c.paras[0], hl });
  R.判('章纲那一头同样：串里带 anno-on + 号', /class="anno-on"/.test(hl.innerHTML) && /data-anno="a1"/.test(hl.innerHTML), hl.innerHTML);
  R.判('号不是瞎挂的：偏移挪歪了照样按原话找回来（把 at 挪到 99，原话改成「下了桥」）',
    (() => { const b = { id:'a2', para:'p0', at:99, quote:'下了桥', text:'x', replies:[] };
      ce.api = { annos:() => [b], hlExtra:() => [] };
      const s2 = ce.marked(v.c.paras[0]);
      return /data-anno="a2"/.test(s2) && />下了桥</.test(s2); })(), 串);
  R.判('原话在正文里找不到时不硬亮（交回的串里没有 anno-on）',
    (() => { const b = { id:'a3', para:'p0', at:0, quote:'这句字根本不在', text:'x', replies:[] };
      ce.api = { annos:() => [b], hlExtra:() => [] };
      return !/anno-on/.test(ce.marked(v.c.paras[0])); })(), '');
  /* 上一轮真页面点这一条时量出来：span 挂上了号，可那四个字一点底色都没有 —— 查下去是配那一头的
     选择器写成了一头的 .wnw-root.anno-on（要求同一个元素既是根又带这个类），而 paint 交回的是
     根里头的 <span class="anno-on">，一辈子配不上。修订痕迹那三条同一个毛病，一并改回「根里头」。 */
  {
    const 态 = ['rv-ins', 'rv-del', 'rv-fmt', 'anno-on'];
    const 死的 = 态.filter(c => new RegExp('\\.wnw-root\\.' + c + '\\{').test(W8));
    const 活的 = 态.filter(c => new RegExp('\\.wnw-root \\.' + c + '\\{').test(W8));
    R.判('突出这一档真配得上正文里那个 span（四条都是「.wnw-root 里头」，不写成同一元素的两类）',
      死的.length === 0 && 活的.length === 4, '配不上的：' + (死的.join('/') || '无') + ' · 配得上的：' + 活的.join('/'));
    R.判('类名两头对得上：paint 挂号用的那四个名字就是 CSS 里那四个',
      /cls:g\.op === 'ins' \? 'rv-ins'/.test(W8) && /cls:'anno-on'/.test(W8), '');
  }
  /* 替身边界记账：这一台把 AnnoView 钉在 on:true（出厂默认那一档），「关掉批注显示」那一档不在这一台量 */
}

/* ---------- 八、图11 后半：折线的两头坐标 ---------- */
R.题('八、连线：原文右沿 → 栏里那一条的左沿');
{
  const 沙 = 台(); const v = 开章(沙);
  const a = { id:'a1', para:'p0', at:0, quote:'白衣', text:'对桥下那句', replies:[] };
  v.c.annos = [a];
  摆原文(沙, v, 'a1');                       /* 原文：left100 top60 宽80 高20 → 右沿 180、中线 70 */
  v.drawSide(); await 沙.跑(20);
  const 卡片 = 卡(v, 'a1');
  卡片.矩 = { left:660, top:70, width:220, height:60 };   /* 栏里那一条：左沿 660、中线 100 */
  v.syncLinks();
  R.判('两头齐时画出 1 条折线', 线(v).length === 1, 线(v).join(' || '));
  R.判('折线三段的位置：从原文右沿 180.0 起、中间 420.0 拐弯（两头正中间）、接到卡片左沿 660.0，横平竖直',
    线(v)[0] === 'M180.0 70.0 H420.0 V100.0 H660.0', 线(v)[0]);
  R.判('折线上带着这一条的号（将来点了要能认回来）', (v.linkSvg.kids[0].属['data-anno'] || '') === 'a1', v.linkSvg.kids[0].属['data-anno']);
  R.判('这一层不吃鼠标（CSS 里 .wnw-link 那一条写着 pointer-events:none，正文照旧能选字）',
    /\.wnw-link\{[^}]*pointer-events:none/.test(W8), /\n\.wnw-link\{[^\n]*/.exec(W8));

  R.判('画出来的是横平竖直的折线（只有 M/H/V 三种走法，没有斜拉）',
    /^[MHV][\d.\s MHV-]+$/.test(线(v)[0] || ''), 线(v)[0]);

  卡片.矩 = { left:182, top:70, width:220, height:60 };
  v.syncLinks();
  R.判('两头贴得不到 8 像素（栏收着、窄窗口）：不画，画出来是一团', 线(v).length === 0, 线(v).join(' || '));

  卡片.矩 = { left:660, top:70, width:220, height:60 };
  v.edHost.kids[0].矩 = { left:100, top:-260, width:80, height:20 };
  v.syncLinks();
  R.判('原文滚出屏了：这一条先不画（滚回来跟着滚动那一趟再画）', 线(v).length === 0, 线(v).join(' || '));
  v.edHost.kids[0].矩 = { left:100, top:60, width:80, height:20 };

  v.syncLinksSoon(); await 沙.跑(20);
  R.判('syncLinksSoon 排在下一帧，一趟里点两次只算一遍', 线(v).length === 1, 线(v).length + '');

  v.showSide = false;
  v.drawSide(); await 沙.跑(20);
  R.判('栏一收起：这一趟就把折线清干净（svg 交回 display:none，里面 0 条）',
    v.linkSvg.style.display === 'none' && 线(v).length === 0, v.linkSvg.style.display + ' / ' + 线(v).length);
  v.showSide = true; v.drawSide(); await 沙.跑(20);
  卡(v, 'a1').矩 = { left:660, top:70, width:220, height:60 };   /* 重画过，卡片是新一格，方框得重新摆 */
  v.syncLinks();
  R.判('再展开：折线又回来了', 线(v).length === 1, 线(v).join(' || '));
}

/* ---------- 九、咬口：把承重那几句改坏，判法必须当场失效 ---------- */
R.题('九、咬口（改坏一句，上面相应那条必须变红）');
{
  /* 咬口一：拿掉 drawSide 的焦点闸 —— 第六条量的「不许换掉正在写的那一格」必须变红 */
  const 坏一 = 拼.replace('if(box.contains(document.activeElement)) return;', 'if(false) return;');
  if(坏一 === 拼) R.判('咬口一没咬到：源码里找不到那道焦点闸', false, '');
  else {
    const 沙 = 台(坏一); const v = 开章(沙);
    v.选 = { p:v.c.paras[0], from:0, to:2, quote:'白衣' };
    v.newAnno(v.选); await 静();
    const 旧格 = 草稿格(v); await 沙.跑(20);
    v.dirty(); await 静();
    R.判('咬口一：闸拆掉之后，正在写的那一格确实被换掉了（第六条判法当场失效）',
      草稿格(v) !== 旧格, 草稿格(v) === 旧格 ? '还是原来那一格' : '换成了新一格');
  }
  /* 咬口二：拿掉「空着走开就把这一条摘掉」那一句 —— 第三条量的「批注数为 0」必须变红 */
  const 坏二 = 拼.replace('else this.c.annos = (this.c.annos || []).filter(x => x !== a);', 'else { /* 收回没做 */ }');
  if(坏二 === 拼) R.判('咬口二没咬到：源码里找不到那一句收回', false, '');
  else {
    const 沙 = 台(坏二); const v = 开章(沙);
    v.选 = { p:v.c.paras[0], from:0, to:2, quote:'白衣' };
    v.newAnno(v.选); await 静();
    const 格 = 草稿格(v); await 沙.跑(20); 格.blur(); await 静();
    await 沙.跑(1500);
    const 末 = 沙.存过[沙.存过.length - 1];
    R.判('咬口二：不收回之后，盘上真的留了一条空批注（第三条判法当场失效）',
      !!末 && 末.annos.length === 1 && !末.annos[0].text, 末 ? JSON.stringify(末.annos) : '(没存)');
  }
  /* 咬口三：把 newAnno 退回弹框那条路 —— 第一条量的「一个弹框都没开」必须变红 */
  const 坏三 = 拼.replace('  newAnno(sl){', '  newAnno(sl){ Overlay.open("新建批注", h("div"), []);');
  if(坏三 === 拼) R.判('咬口三没咬到：找不到 newAnno 那一颗', false, '');
  else {
    const 沙 = 台(坏三); const v = 开章(沙);
    v.选 = { p:v.c.paras[0], from:0, to:2, quote:'白衣' };
    v.newAnno(v.选); await 静();
    R.判('咬口三：换回弹框之后确实开了一个（第一条判法当场失效）', 沙.弹框.length === 1, 沙.弹框.join('|'));
  }
  /* 咬口四：拿掉 syncLinks 里「两头缺一就不画」那句 —— 栏里少摆一条（超过 120 条时被裁、孤条）时，
     真身应当安静跳过，改坏之后要么画出鬼线要么当场抛错 */
  const 坏四 = 拼.replace('      if(!头 || !尾) continue;', '      if(false) continue;');
  if(坏四 === 拼) R.判('咬口四没咬到：找不到那句「两头缺一就不画」', false, '');
  else {
    const 沙 = 台(坏四); const v = 开章(沙);
    v.c.annos = [{ id:'a1', para:'p0', at:0, quote:'白衣', text:'x', replies:[] }];
    摆原文(沙, v, 'a1');
    v.drawSide(); await 沙.跑(20);
    v.sideBox.innerHTML = '';                    /* 栏里这一条没摆上（真身里过 120 条会裁掉） */
    let 抛 = null;
    try{ v.syncLinks(); }catch(e){ 抛 = e.message; }
    R.判('咬口四：卡片那一头不存在时，去掉这一句要么当场抛错要么画出鬼线（量到：' + (抛 || 线(v).join(' ') || '都没') + '）',
      !!抛 || 线(v).length > 0, 抛 || 线(v).join(' || '));
    const 沙好 = 台(); const v好 = 开章(沙好);
    v好.c.annos = [{ id:'a1', para:'p0', at:0, quote:'白衣', text:'x', replies:[] }];
    摆原文(沙好, v好, 'a1'); v好.drawSide(); await 沙好.跑(20); v好.sideBox.innerHTML = '';
    v好.syncLinks();
    R.判('同一场景走真身：安静跳过，一条都不画（这才对得上「栏里少摆一条」）', 线(v好).length === 0, 线(v好).join(' || '));
  }
}

{
  const 沙 = 台(); const v = 开章(沙);
  v.选 = { p:v.c.paras[0], from:0, to:2, quote:'白衣' };
  v.newAnno(v.选); await 沙.跑(2000);
  R.判('整条路走一遍不吞异常、也照样朝外面报了一句（Bus / Desk 那几处回调抛的错都收在 抛错 里，量到 '
    + 沙.抛错.length + ' 个 / 报了 ' + 沙.这章事件.length + ' 声）',
    沙.抛错.length === 0 && 沙.这章事件.join(',') === 'desk:anno', 沙.抛错.join('|') + ' / ' + 沙.这章事件.join(','));
}

R.收尾();
