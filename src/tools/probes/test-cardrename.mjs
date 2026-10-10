/* 外30 甲组 · 图4「卡片重命名失败」：先量，再改。
   这一台不改任何代码，只把真源码里那一条路（CardView.boot 的订阅 + dirty 那 600ms + titleBox 的
   input/blur + Cards.put/index/taken + DB）原样切进 node:vm，配一层会记焦点的假 DOM 和一个可控时钟，
   把他那一句「重命名失败」能走到的每一种走法都跑一遍，看名字最后落在库里是什么。
   边界上才使替身：IndexedDB（mkKv）、弹窗、高亮同步（CardHl）、Desk / CardNames 那几个壳。 */
import vm from 'node:vm';
import { rd, 切, 切方法, 记账 } from './lib-slice.mjs';

const R = 记账('test-cardrename');
/* 让一串 await 走完：微任务连排 30 轮（比数 setImmediate 稳，DB 那几层壳套得深） */
const 静 = async (n = 30) => { for(let i = 0; i < n; i++) await Promise.resolve(); };
const W7 = rd('src/_wnw/src/w7-data.js');
const W10 = rd('src/_wnw/src/w10-cards.js');
const CV = W10.indexOf('class CardView{');
if(CV < 0) throw new Error('找不到 class CardView');

/* ---------- 一、切真源码（一颗都不许手抄）：拼回两个对象，Cards 那一头、CardView 这一头 ---------- */
const C7 = W7.indexOf('const Cards = {');
const 界 = (src, 起) => { const n = src.indexOf('\nconst ', 起); const k = src.indexOf('\nclass ', 起);
  return [n, k].filter(x => x > 起).sort((a, b) => a - b)[0] || src.length; };
const 止7 = 界(W7, C7), 止10 = 界(W10, CV);
const 卡法 = ['  async get(id){', '  async put(c, keepAt){', '  async index(c){', '  async all(){',
  '  async forBook(bid){', '  async taken(name, exceptId, bookId){'].map(头 => 切方法(W7, 头, C7, 止7));
const 视图法 = ['  async boot(){', '  async reload(){', '  dirty(立){', '  markSaved(){', '  foot(msg){', '  titleBox(){']
  .map(头 => 切方法(W10, 头, CV, 止10));
const 拼 = `
${切(W7, 'DB')}
${切(W7, 'isTrackField')}
${切(W7, 'hasTrackField')}
${切(W7, 'bookTitle')}
${切(W10, 'syncCardHl')}
const Cards = {
${卡法.join(',\n')}
};
class CardView{
  constructor(host, ctx){ this.host = host; this.ctx = ctx; this.c = null; }
${视图法.join('\n')}
  /* 真 draw() 要整屏的控件（属性、关联、封面、图标那一摊），这一台不测那些：
     只保留「重画会把标题那一格换掉」这一件对改名有影响的事 —— 用真 titleBox 造新格，
     listBox 也照真身那条规矩挂上（有追踪属性时真 draw 会指着待办那一列的容器）。 */
  async draw(){ this.画过 = (this.画过 || 0) + 1; this.host.innerHTML = '';
    if(hasTrackField(this.c)) this.listBox = h('div', { class:'wnw-col' });
    this.status = h('span', { class:'wnw-hint' }, '');
    this.title = this.titleBox(); this.host.appendChild(this.status); this.host.appendChild(this.title); }
};
this.件 = { DB, Cards, CardView, hasTrackField };
`;

/* ---------- 二、假 DOM（会记焦点）+ 可控时钟 ---------- */
const 替 = `
var 时钟 = { t:0, 队:[], id:1 };
function setTimeout(f, ms){ const h = 时钟.id++; 时钟.队.push({ 到:时钟.t + (ms || 0), f, h }); return h; }
function clearTimeout(h){ const i = 时钟.队.findIndex(x => x.h === h); if(i >= 0) 时钟.队.splice(i, 1); }
var requestAnimationFrame = f => setTimeout(f, 16);
var 焦点 = null;
var document = { get activeElement(){ return 焦点; } };
function 元素(标记, at){
  const el = { 标记, at:at || {}, kids:[], value:(at && at.value !== undefined) ? String(at.value) : '',
    textContent:'', title:(at && at.title) || '', checked:false,
    appendChild(x){ this.kids.push(x); x.父 = this; return x; },
    addEventListener(k, f){ (this.听 = this.听 || {})[k] = f; return f; },
    发(k, e){ const f = this.听 && this.听[k]; if(!f) return undefined; return f.call(this, Object.assign({ target:this,
      stopPropagation(){}, preventDefault(){} }, e || {})); },
    contains(x){ if(x === this) return true; return this.kids.some(k => k.contains && k.contains(x)); },
    focus(){ 焦点 = this; if(this.听 && this.听.focus) this.发('focus'); },
    blur(){ if(焦点 !== this) return; 焦点 = null; if(this.听 && this.听.blur) this.发('blur'); },
    set className(v){ this.类 = v; }, get className(){ return this.类 || ''; },
    set innerHTML(v){ if(v === '') this.kids = []; } };
  return el;
}
var h = (标记, at, kids) => {
  const el = 元素(标记, at);
  if(typeof kids === 'string') el.textContent = kids;
  else for(const x of (kids === undefined ? [] : kids)) if(x) el.appendChild(x);
  return el;
};
var toast = (m, bad) => { 报话.push(String(m)); };
var 报话 = [];
var Bus = { map:{}, on(k, f){ (this.map[k] = this.map[k] || []).push(f); return () => {}; },
  emit(k, a){ (this.map[k] || []).slice().forEach(f => { try{ f(a); }catch(e){ 抛错.push(e); } }); },
  播:[] };
var 抛错 = [];
var Desk = { noteRecent(){}, addTab(){}, setTitle:0 };
var CardNames = { async sync(){}, get(id){ return '卡' + id; } };
var CardHl = { async sync(){ 高亮同步++; } };
var 高亮同步 = 0;
var Work = { book:{ id:'b1', title:'测试书' } };
/* bookTitle 切的是真身那一句，它查的是书架内存里的那份名单 —— 名单本身是边界，给三本 */
var Shelf = { data:{ books:[{ id:'b1', title:'测试书' }, { id:'b2', title:'另一本' }, { id:'b9', title:'第三本' }] } };
var Storage = { warn(){} };
/* IndexedDB 那一头：给一个内存版 kv（DB 那一句 mkKv 是真身吃的边界） */
var 库表 = new Map();
async function mkKv(){ return { kind:'idb',
  async get(k){ return 库表.has(k) ? JSON.parse(库表.get(k)) : undefined; },
  async put(k, v){ 库表.set(k, JSON.stringify(v)); return true; },
  async del(k){ 库表.delete(k); },
  async keys(pre){ return [...库表.keys()].filter(k => !pre || k.startsWith(pre)); } }; }
var confirm = () => true;
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
    while(沙.时钟.队.some(x => x.到 <= 标) && 圈++ < 500){
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

/* 造两张卡进库：甲（本书）、乙（本书），再来一张别书的丙，一张公共的丁 */
async function 铺(沙, 张){
  for(const x of 张){
    const c = { id:x.id, bookId:x.bookId === undefined ? 'b1' : x.bookId, tpl:'', tplName:'空白',
      title:x.title, aliases:x.aliases || [], at:1, created:1, groups:[], color:'', tags:[], resp:'high', links:[], ok:{} };
    await 沙.Cards.put(c);
  }
  await 静();
}
function 打开(沙, id){
  const host = 沙.h('div');
  const v = new 沙.CardView(host, { ref:id, on(k, f){ 沙.Bus.on(k, f); }, setTitle(t){ 沙.标题 = t; } });
  v.boot();
  return v;
}
/* titleBox() 交回的是套着的那一层（.wnw-card-title），真格子是里面那一个 input —— 先摸到它再打字 */
function 标题格(v){
  const 找 = el => el && el.标记 === 'input' ? el : (el && el.kids ? el.kids.map(找).find(x => x) : null);
  return 找(v.title);
}
async function 打字(沙, v, 字){
  const inp = 标题格(v);
  if(!inp) throw new Error('这一屏没摸到标题格（titleBox 换了形状？）');
  inp.focus();
  inp.value = 字;
  await inp.发('input');
  await 静();
}
async function 落定(沙, v){
  const inp = 标题格(v);
  if(inp){ inp.focus(); await inp.发('blur'); }
  await 静();
  await 沙.跑(1500);          /* 走开之后把那 600 毫秒放完：真身里回滚那一笔是排在这后面的 */
}
const 库里名 = async (沙, id) => {
  const idx = await 沙.DB.get('cards.idx', []);
  const row = idx.find(x => x.id === id);
  const doc = await 沙.Cards.get(id);
  return { 名单:row ? row.title : '(没这行)', 正文:doc ? doc.title : '(没这张)' };
};
/* 整张名单里有没有两张同名（别名占着同一个字也算） */
const 重名 = async 沙 => {
  const idx = await 沙.DB.get('cards.idx', []);
  const 见 = new Map(), 重 = [];
  for(const m of idx){
    for(const n of [m.title].concat(m.aliases || [])){
      if(!n) continue;
      if(见.has(n)) 重.push(n + '（' + 见.get(n) + ' 和 ' + m.id + '）');
      else 见.set(n, m.id);
    }
  }
  return 重;
};

/* ---------- 一、正常改名（打字 → 600 毫秒落盘 → 走开） ---------- */
R.题('一、正常一条路：打字、等落盘、走开');
{
  const 沙 = 台(); await 铺(沙, [{ id:'A', title:'甲' }, { id:'B', title:'乙' }]);
  const v = 打开(沙, 'A');
  await 静();
  R.判('开机第一画就摆出了标题那一格（input），里面是「甲」',
    !!标题格(v) && 标题格(v).标记 === 'input' && 标题格(v).value === '甲', 标题格(v) && 标题格(v).value);
  await 打字(沙, v, '甲乙丙');
  await 沙.跑(700);
  const 中 = await 库里名(沙, 'A');
  R.判('打字之后还没走开，600 毫秒那一下已经把「甲乙丙」写进库（名单 + 正文两处）',
    中.名单 === '甲乙丙' && 中.正文 === '甲乙丙', 中.名单 + ' / ' + 中.正文);
  await 落定(沙, v);
  const 后 = await 库里名(沙, 'A');
  R.判('走开（blur）之后还是「甲乙丙」，没被回滚', 后.名单 === '甲乙丙' && 后.正文 === '甲乙丙', 后.名单);
  R.数('这一趟整屏重画了几遍', v.画过);
}

/* ---------- 二、打字途中外面来一次 desk:cards（另一张卡保存了） ---------- */
R.题('二、正在标题格里打字，别处保存了一张卡（desk:cards 到）');
{
  const 沙 = 台();
  /* 甲带一条追踪属性：真身里只有带追踪的卡会在 desk:cards 到达时整屏重画（那道闸认的是待办那一列里有没有焦点） */
  await 铺(沙, [{ id:'A', title:'甲' }, { id:'B', title:'乙' }]);
  const a = await 沙.Cards.get('A');
  a.groups = [{ name:'线索', items:[{ id:'f1', name:'进度', type:'track', todos:[], values:[] }] }];
  await 沙.Cards.put(a);
  const v = 打开(沙, 'A');
  await 静();
  R.判('这一张确实带追踪属性（hasTrackField 真值），重画那一道闸才轮得到它', 沙.hasTrackField(v.c) === true, String(沙.hasTrackField(v.c)));
  const 旧格 = 标题格(v);
  await 打字(沙, v, '甲乙');
  R.判('打字时焦点在标题格上', 沙.document.activeElement === 旧格, String(沙.document.activeElement && 沙.document.activeElement.value));
  /* 另一张卡保存：走真 Cards.put + 真 Bus.emit('desk:cards') */
  const b = await 沙.Cards.get('B'); b.color = '#123456'; await 沙.Cards.put(b); 沙.Bus.emit('desk:cards');
  await 静();
  R.数('desk:cards 到之后整屏重画了几遍', v.画过);
  const 被换 = 标题格(v) !== 旧格;
  R.判('正在标题格里打字，别处保存了一张卡：这一格不许被换掉（换了就等于把光标从字里抢走，改名走到一半断掉）',
    !被换, 被换 ? '被换成了新一格' : '还是原来那一格');
  R.判('焦点还在原来那一格上', 沙.document.activeElement === 旧格, String(沙.document.activeElement && 沙.document.activeElement.value));
  R.数('这一趟整屏重画次数（不抢焦点的话应当还是 1）', v.画过);
}

/* ---------- 三、撞名回滚 ---------- */
R.题('三、改成别人占着的名字');
{
  const 沙 = 台(); await 铺(沙, [{ id:'A', title:'甲' }, { id:'B', title:'乙' }]);
  const v = 打开(沙, 'A');
  await 静();
  await 打字(沙, v, '乙');
  await 沙.跑(700);
  const 抢 = await 库里名(沙, 'A');
  R.数('打字途中（还没走开）库里已经写成：', 抢.名单);
  const 重 = await 重名(沙);
  R.判('撞着别人那一下不许先落库：库里任何时刻都不该有两张同名（量到 ' + (重.join('、') || '没有') + '）',
    重.length === 0, 重.join('、'));
  await 落定(沙, v);
  const 后 = await 库里名(沙, 'A');
  R.判('走开时认出撞名，报了一句「已经占了这个名」，还说清是谁占的',
    沙.报话.some(x => /已经占了这个名/.test(x)) && 沙.报话.some(x => /乙/.test(x)), 沙.报话.join('|'));
  R.判('回滚之后库里两处都回到「甲」', 后.名单 === '甲' && 后.正文 === '甲', 后.名单 + ' / ' + 后.正文);
  R.判('屏幕上那一格也回到「甲」', 标题格(v).value === '甲', 标题格(v).value);
  R.判('回滚那一笔是当场写的（不是再等 600 毫秒）：走开之后立刻读就是「甲」',
    后.名单 === '甲', 后.名单);
}

/* ---------- 四、别名占名 / 自己的别名 / 空串 ---------- */
R.题('四、别名、自己占名、空串这三种');
{
  const 沙 = 台(); await 铺(沙, [{ id:'A', title:'甲', aliases:['老甲'] }, { id:'B', title:'乙' }]);
  const v = 打开(沙, 'A');
  await 静();
  await 打字(沙, v, '老甲'); await 沙.跑(700); await 落定(沙, v);
  R.判('改成自己的别名：不算撞名（这一张自己占的字除外），库里就是「老甲」',
    (await 库里名(沙, 'A')).名单 === '老甲', (await 库里名(沙, 'A')).名单);
  await 打字(沙, v, ''); await 沙.跑(700);
  R.判('标题格清空：不落「未命名」也不落空串，库里还是「老甲」，底下一句说清楚（量到 ' + (await 库里名(沙, 'A')).名单 + '）',
    (await 库里名(沙, 'A')).名单 === '老甲', (await 库里名(沙, 'A')).名单);
  R.判('空着那一下底下一句说清楚（不是没反应）：' + v.status.textContent, /空着不算改名/.test(v.status.textContent), v.status.textContent);
  await 落定(沙, v);
  R.判('空串走开：回到上一个名字，不写空', (await 库里名(沙, 'A')).名单 === '老甲', (await 库里名(沙, 'A')).名单);
}

/* ---------- 五、跨书与公共卡的口径 ---------- */
R.题('五、别的书的卡、公共卡撞名怎么算');
{
  const 沙 = 台();
  await 铺(沙, [{ id:'A', title:'甲', bookId:'b1' }, { id:'X', title:'别书乙', bookId:'b2' }, { id:'P', title:'公共乙', bookId:'' }]);
  const v = 打开(沙, 'A');
  await 静();
  await 打字(沙, v, '别书乙'); await 沙.跑(700); await 落定(沙, v);
  R.判('本书卡改成别本书的卡名：不拦（各书各的名单），库里就是「别书乙」',
    (await 库里名(沙, 'A')).名单 === '别书乙', (await 库里名(沙, 'A')).名单);
  await 打字(沙, v, '公共乙'); await 沙.跑(700); await 落定(沙, v);
  R.判('本书卡改成公共卡的名字：拦住回滚（公共卡每本书都看得见）',
    (await 库里名(沙, 'A')).名单 === '别书乙', (await 库里名(沙, 'A')).名单);
  R.判('那一句报话把来路说清了（不是光秃秃一个名字）：' + (沙.报话[沙.报话.length - 1] || ''),
    /公共卡，每本书里都看得见/.test(沙.报话.join('|')), 沙.报话.join('|'));
  const p = 打开(沙, 'P');
  await 静();
  await 打字(沙, p, '别书乙'); await 沙.跑(700); await 落定(沙, p);
  R.数('公共卡改成别本书私有的名字，拦不拦：', (await 库里名(沙, 'P')).名单);
}

/* ---------- 六、改名和 600 毫秒那一下抢顺序 ---------- */
R.题('六、改完立刻走开（600 毫秒还没到）');
{
  const 沙 = 台(); await 铺(沙, [{ id:'A', title:'甲' }, { id:'B', title:'乙' }]);
  const v = 打开(沙, 'A');
  await 静();
  await 打字(沙, v, '新甲');
  const 格 = 标题格(v); 格.focus(); await 格.发('blur'); await 静();
  const 早 = await 库里名(沙, 'A');      /* 走开之后一秒都不等 */
  await 沙.跑(2000);                      /* 再把那 600 毫秒放完 */
  const 晚 = await 库里名(沙, 'A');
  R.判('走开那一下当场就落盘（不再排在 600 毫秒后面，改名不会卡在两次写之间）：早读 = ' + 早.名单,
    早.名单 === '新甲' && 早.正文 === '新甲', 早.名单 + ' / ' + 早.正文);
  R.判('等那一下跑完还是「新甲」（没有第二笔把它盖回去）', 晚.名单 === '新甲' && 晚.正文 === '新甲', 晚.名单 + ' / ' + 晚.正文);
}

/* ---------- 七、删了一张卡，名字腾出来了 ---------- */
R.题('七、删卡之后撞名还拦不拦');
{
  const 沙 = 台(); await 铺(沙, [{ id:'A', title:'甲' }, { id:'B', title:'乙' }]);
  const 名 = await 沙.Cards.taken('乙', 'A', 'b1');
  R.判('删之前：「乙」被 B 占着（taken 交回 ' + 名 + '）', 名 === '乙', 名);
  const idx = await 沙.DB.get('cards.idx', []);
  await 沙.DB.put('cards.idx', idx.filter(x => x.id !== 'B'));
  const 名2 = await 沙.Cards.taken('乙', 'A', 'b1');
  R.判('删之后（名单跟着少一行）：「乙」空出来了，taken 交回空', 名2 === '', 名2);
}

/* ---------- 八、咬口：把承重那两句改坏，第二、三条的判法必须不过 ---------- */
R.题('八、咬口（把承重那一句改坏，判法必须当场失效）');
{
  /* 咬口一：拿掉「撞名这一笔先不落盘」那一句 —— 第三条量的「库里不许出现两张同名」必须变红 */
  const 坏一 = 拼.replace("if(r.dup){ this.foot('「' + r.dup + '」' + r.主 + '已经占了这个名，这一笔先不落盘'); return; }",
    "c.title = n; this.dirty();");
  if(坏一 === 拼) R.判('咬口一没咬到：源码里找不到那一句「这一笔先不落盘」', false, '');
  else {
    const 沙 = 台(坏一); await 铺(沙, [{ id:'A', title:'甲' }, { id:'B', title:'乙' }]);
    const v = 打开(沙, 'A');
    await 静();
    await 打字(沙, v, '乙'); await 沙.跑(700);
    const 重 = await 重名(沙);
    R.判('咬口一：拿掉那一句之后，打字途中库里真的两张同名了（' + (重.join('、') || '还是没有') + '）', 重.length > 0, 重.join('、'));
  }
  /* 咬口二：把重画那道闸退回「只护待办那一列」—— 第二条量的「不许抢光标」必须变红 */
  const 坏二 = 拼.replace('!this.host.contains(document.activeElement)) this.draw();',
    '!this.listBox.contains(document.activeElement)) this.draw();');
  if(坏二 === 拼) R.判('咬口二没咬到：源码里找不到那道焦点闸', false, '');
  else {
    const 沙 = 台(坏二); await 铺(沙, [{ id:'A', title:'甲' }, { id:'B', title:'乙' }]);
    const a = await 沙.Cards.get('A');
    a.groups = [{ name:'线索', items:[{ id:'f1', name:'进度', type:'track', todos:[], values:[] }] }];
    await 沙.Cards.put(a);
    const v = 打开(沙, 'A');
    await 静();
    const 旧格 = 标题格(v);
    await 打字(沙, v, '甲乙');
    const b = await 沙.Cards.get('B'); b.color = '#654321'; await 沙.Cards.put(b); 沙.Bus.emit('desk:cards');
    await 静();
    R.判('咬口二：闸口退回只护待办那一列之后，标题格又被换掉了（第二条判法当场失效）',
      标题格(v) !== 旧格, 标题格(v) === 旧格 ? '还是原来那一格' : '换成了新一格');
  }
}

/* 各台里 Bus 那一头吞掉的异常在每一块里单独数；这一行只把总账收口 */
R.收尾();
