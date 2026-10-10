/* 外37 · 悬浮摘要 / 最近打开那一枚 / 看板三条
   作者原话：
     「亮了，没有悬浮」
     「最近打开可以删除了，但是删除中有闪烁/跳动」
     「看板很多bug，排序/自动排序，轨道的顺序，连线功能」
   规矩照这一仓来：切仓库里那一份原文进 node:vm 跑（CardTip 是真的那颗、逐枚摆 × 的那一段循环是真的那一段、
   事件带内那一堆兄弟的次序走的是真 bandTree、轨道换序走的是真 grabHead 里那三行），只在边界使替身
   （假元素、假时钟、假浮层、假存档）。每条都报数，最后咬三口。 */
import vm from 'node:vm';
import { rd, 切, 切方法, 记账 } from './lib-slice.mjs';

const R = 记账('test-w37');
const W3 = rd('src/_wnw/src/w3-shell.js'), W10 = rd('src/_wnw/src/w10-cards.js'),
      W11 = rd('src/_wnw/src/w11-board.js');
const 底 = { console, Math, JSON, Object, Array, String, Number, RegExp, isNaN, parseInt, parseFloat,
  Set, Map, Date, Promise };

/* 一枚假元素：只长这几颗测试要摸的（closest / remove / children / 位置），别的都不给 */
function el(标记, 类, at){
  const e = { 标记, 类, at:at || {}, kids:[], style:{}, isConnected:true, 父:null,
    offsetWidth:120, offsetHeight:40, textContent:'',
    appendChild(x){ this.kids.push(x); x.父 = this; return x; },
    remove(){ if(this.父) this.父.kids = this.父.kids.filter(k => k !== this); this.父 = null; this.isConnected = false; },
    get children(){ return this.kids; },
    getAttribute(n){ return this.at[n] === undefined ? null : String(this.at[n]); },
    setAttribute(n, v){ this.at[n] = String(v); },
    closest(s){ return s === '[data-card]' && this.at['data-card'] ? this : null; },
    getBoundingClientRect(){ return { left:100, top:200, right:220, bottom:222 }; } };
  return e;
}
const 静 = async (n = 60) => { for(let i = 0; i < n; i++) await Promise.resolve(); };

/* ---------- 一、鼠标停在卡名上：真 CardTip ---------- */
R.题('一、正文停在卡名上浮出那张卡（真 CardTip + 可控时钟）');
{
  const 沙 = {};
  vm.createContext(沙);
  vm.runInContext(`
var 挂 = []; var 根 = { kids:[], appendChild(x){ this.kids.push(x); x.父 = this; return x; } };
function wnwOn(t, k, fn, o){ 挂.push([k, fn, o]); return fn; }
function wnwRoot(){ return 根; }
function wnwBox(){ return { w:800, h:600 }; }
function wnwLocal(x, y){ return { x, y }; }
function h(标记, at, kids){ const e = globalThis.造(标记, at && at['class'], at);
  if(typeof kids === 'string') e.textContent = kids;
  else for(const k of (kids || [])) if(k) e.appendChild(k);
  return e; }
var CardHl = { brief:async id => ({ id, title:'前辈', resp:'高响应', rows:[['身份','宗门前辈']] }) };
var 钟 = [], 时 = 0, 号 = 0;
function setTimeout(fn, ms){ 号++; const t = { fn, 到:时 + (ms || 0), 号 }; 钟.push(t); return 号; }
function clearTimeout(n){ 钟 = 钟.filter(t => t.号 !== n); }
function 拨(ms){ 时 += ms; const 到 = 钟.filter(t => t.到 <= 时); 钟 = 钟.filter(t => t.到 > 时); 到.forEach(t => t.fn()); }
function 听(k){ return 挂.filter(x => x[0] === k).map(x => x[1]); }
${切(W10, 'CardTip')}
this.件 = { CardTip, 挂, 听, 拨, 根, 静:() => 钟.length };
`, 沙);
  沙.造 = el;
  Object.assign(沙, 沙.件);
  const T = 沙.CardTip, 根 = 沙.根;
  T.init({ addEventListener(){} });        /* 真身为写那一副骨架时就是这么把容器递给它的 */
  const 浮 = () => 根.kids.filter(x => x.类 === 'wnw-tip');
  const 停 = id => { for(const fn of 沙.听('mouseover')) fn({ target: el('span', '', { 'data-card':id }) }); };
  R.判('监听收在容器上，没有再挂 document / window（mouseover / scroll / pointerdown 三串）',
    沙.挂.length === 3 && 沙.挂.map(x => x[0]).join(',') === 'mouseover,scroll,pointerdown',
    沙.挂.map(x => x[0]).join(','));
  停('k9');
  R.判('刚停上去那一瞬还不浮（280 毫秒的等待是真的）', 浮().length === 0 && 沙.静() === 1, '排着 ' + 沙.静() + ' 发');
  沙.拨(280); await 静();
  R.判('停够 280 毫秒：浮出一枚摘要，里头是那张卡的 name / 响应度 / 头几条属性',
    浮().length === 1 && 浮()[0].kids[0].textContent === '前辈' && 浮()[0].kids[1].textContent === '高响应',
    JSON.stringify(浮().map(x => x.类)));
  R.判('浮窗摆在容器内（absolute 那一套坐标口径：量的是视口、摆的是容器）',
    浮()[0].style.left !== undefined && 浮()[0].style.top !== undefined);
  /* 挪开：不该留一枚孤零零的浮窗 */
  for(const fn of 沙.听('mouseover')) fn({ target: el('span', '', {}) });
  R.判('指针挪到不是卡名的字上：浮窗当场收掉', 浮().length === 0);
  /* 停够之前挪走：不能事后又冒出来 */
  停('k9'); 沙.拨(100);
  for(const fn of 沙.听('mouseover')) fn({ target: el('span', '', {}) });
  沙.拨(400); await 静();
  R.判('只停了一百毫秒就走：那一发到点也不浮（计时器跟着撤了）', 浮().length === 0);
  /* 滚一下 / 点一下都收 */
  停('k9'); 沙.拨(280); await 静();
  const 有了 = 浮().length === 1;
  for(const fn of 沙.听('scroll')) fn({});
  R.判('正文一滚就收（浮窗还挂在老位置上就是错的）', 有了 && 浮().length === 0);
  停('k9'); 沙.拨(280); await 静();
  for(const fn of 沙.听('pointerdown')) fn({});
  R.判('点一下就收（切完标签浮窗不该还挂在老位置）', 浮().length === 0);
  /* 开→关→再开：同一枚卡名第一次停上去也要浮（旧 id 不能留到下一回） */
  沙.拨(500); await 静();
  const 再开 = 沙.CardTip; 再开.init({ addEventListener(){} });
  停('k9'); 沙.拨(280); await 静();
  R.判('拆掉再开：停在上一回那枚同名的卡名上，第一次就浮（不是非要先挪开再回来）', 浮().length === 1);
  /* 咬口：把 hide() 里那句抹 id 加回去 —— 就是本轮修的那个 bug 的原样；同一副假件先跑一遍没改坏的做正对照 */
  const 新文 = 切(W10, 'CardTip');
  const 旧文 = 新文.replace('hide(){ clearTimeout(this.timer); if(this.node)',
    'hide(){ clearTimeout(this.timer); this.id = \'\'; if(this.node)');
  if(旧文 === 新文) throw new Error('咬口没抓到 hide() 那一句（它的写法改了，这台要跟着改）');
  const 浮不出 = async 文本 => {
    const 沙2 = vm.createContext(Object.assign({}, 底, { 造:el, setTimeout, clearTimeout }));
    vm.runInContext(`
var 挂 = []; var 根 = { kids:[], appendChild(x){ this.kids.push(x); x.父 = this; return x; } };
function wnwOn(t, k, fn, o){ 挂.push([k, fn]); return fn; }
function wnwRoot(){ return 根; } function wnwBox(){ return { w:800, h:600 }; } function wnwLocal(x, y){ return { x, y }; }
function h(标记, at, kids){ const e = globalThis.造(标记, at && at['class'], at);
  if(typeof kids === 'string') e.textContent = kids; else for(const k of (kids || [])) if(k) e.appendChild(k); return e; }
var CardHl = { brief:async id => ({ id, title:'前辈', resp:'高响应', rows:[] }) };
${文本}
this.件 = { CardTip, 挂, 根 };
`, 沙2);
    Object.assign(沙2, 沙2.件);
    沙2.CardTip.init({ addEventListener(){} });
    for(const fn of 沙2.挂.filter(x => x[0] === 'mouseover').map(x => x[1]))
      fn({ target: 沙2.造('span', '', { 'data-card':'k9' }) });
    await new Promise(r => setTimeout(r, 320)); await 静();
    return 沙2.根.kids.filter(x => x.类 === 'wnw-tip').length;
  };
  const 正对照 = await 浮不出(新文);
  const 咬 = await 浮不出(旧文);
  R.数('同一副假件：仓库里这一份浮几枚 / 把 hide() 抹 id 加回去浮几枚', 正对照 + ' 枚 ｜ ' + 咬 + ' 枚');
  R.判('正对照：同一副假件、没改坏的那一份确实浮出一枚（下面那条不是因为假件跑不起来）', 正对照 === 1, 正对照 + ' 枚');
  R.判('咬口过：hide() 里一加回「顺手抹掉这一记」，浮窗就一次也不出了 —— 这正是他报的「没有悬浮」',
    正对照 === 1 && 咬 === 0, 咬 + ' 枚');
}

/* ---------- 二、最近打开摘掉一枚：真那一段逐枚摆 × 的循环 ---------- */
R.题('二、去掉一笔只摘这一枚（真那一段循环 + 假 DOM）');
{
  const 起 = W3.indexOf('      for(const rc of recent){');
  if(起 < 0) throw new Error('找不到最近打开那一段循环');
  let k = W3.indexOf('{', 起), d = 0;
  while(k < W3.length){ const c = W3[k]; if(c === '{') d++; else if(c === '}'){ d--; if(!d) break; } k++; }
  const 段 = W3.slice(起, k + 1);
  R.判('这一段里不再重跑那张列表（没有 innerHTML 重铺、也没有再叫一次 draw / fill）',
    !/innerHTML/.test(段) && !/\bdraw\(\)/.test(段) && !/\bfill\(\)/.test(段),
    (段.match(/innerHTML|\bdraw\(\)|\bfill\(\)/g) || []).join(' '));
  const 沙 = vm.createContext(Object.assign({}, 底, { 造:el }));
  vm.runInContext(`
var Overlay = { close(){ 关++; } }; var 关 = 0;
function icoMarkup(n){ return '<svg/>'; }
var 交 = [];
async function recentDrop(rc){ 交.push(rc); }
function h(标记, at, kids){ const e = globalThis.造(标记, at && at['class'], at);
  if(at) for(const k of Object.keys(at)) if(k !== 'class' && !/^on/.test(k)) e.at[k] = at[k];
  if(at){ if(at.onclick) e.at.onclick = at.onclick; if(at.oninput) e.at.oninput = at.oninput; }
  if(typeof kids === 'string') e.textContent = kids; else for(const x of (kids || [])) if(x) e.appendChild(x);
  return e; }
function 摆(rr, recent, target){
${段}
}
function 看关(){ return 关; }
this.件 = { 摆, 交, h };
`, 沙);
  const rr = el('div', 'wnw-pick-row');
  const 名单 = [{ kind:'ch', ref:'c1', label:'第七章' }, { kind:'card', ref:'k1', label:'前辈' },
    { kind:'ch', ref:'c2', label:'第二章' }];
  沙.摆(rr, 名单, { dock:false });
  R.判('三笔摆三枚，每一枚两顆钮（名字那一颗 + 后头那颗 ×）',
    rr.children.length === 3 && rr.children.every(x => x.children.length === 2),
    rr.children.map(x => x.children.length).join(','));
  const 第一枚 = rr.children[0], 第二枚 = rr.children[1], 第三枚 = rr.children[2];
  const 去 = 第一枚.children[1];
  R.判('那颗 × 的门牌和话术都在（title / aria-label 都写着「从最近打开里去掉」）',
    去.at.title === '从最近打开里去掉' && 去.at['aria-label'] === '从最近打开里去掉');
  await 去.at.onclick({ stopPropagation(){} });
  R.判('点第一枚的 ×：只剩它自己没了，另外两枚还是原来那两枚对象（没重铺，所以不会闪、不会跳）',
    rr.children.length === 2 && rr.children[0] === 第二枚 && rr.children[1] === 第三枚,
    rr.children.map(x => x === 第一枚 ? '被点的' : x === 第二枚 ? '第二枚' : x === 第三枚 ? '第三枚' : '新造的').join(','));
  R.判('被摘掉那一枚自己也当场从它爹身上解下来（不留半截节点挂在树里）', 第一枚.父 === null);
  R.判('落盘走的是那一笔（recentDrop 收到的是被点的那一枚，一次就够）',
    沙.交.length === 1 && 沙.交[0].ref === 'c1', JSON.stringify(沙.交.map(x => x.ref)));
  R.判('摘 × 不关那张列表（点 × 不该把整个浮层带走）', 沙.看关() === 0, '关了 ' + 沙.看关() + ' 回');
  await rr.children[0].children[1].at.onclick({ stopPropagation(){} });
  await rr.children[0].children[1].at.onclick({ stopPropagation(){} });
  R.判('最后一枚也摘掉之后，那一行补一句「还没有打开过内容」（不空成一格）',
    rr.children.length === 1 && rr.children[0].类 === 'wnw-hint' &&
    rr.children[0].textContent === '还没有打开过内容', JSON.stringify(rr.children.map(x => x.类)));
}

/* ---------- 三、看板：事件带内那一堆兄弟的次序 ---------- */
R.题('三、看板事件带：兄弟次序（真 bandTree）');
{
  const 沙 = vm.createContext(Object.assign({}, 底));
  vm.runInContext(`
${切(W11, 'seqParts')}
${切(W11, 'cmpSeq')}
${切(W11, 'rated')}
${切(W11, 'rowRank')}
class 板 {
${切方法(W11, '  trackNodes(')}
${切方法(W11, '  bandNodes(')}
${切方法(W11, '  bandTree(')}
}
this.件 = { 板, seqParts, cmpSeq };
`, 沙);
  Object.assign(沙, 沙.件);
  const 结 = (id, seq, ev) => ({ id, seq, et:'e1', ev:ev === undefined ? '' : ev, label:id });
  /* 他报的那个形状：三枚里有一枚没填评级 —— 按对定方向时正好转出一个环 */
  const 混 = [结('A', '1', '3'), 结('B', '2', '1'), 结('C', '1.5', ''), 结('D', '3', '2'),
    结('E', '4', ''), 结('F', '5', '4'), 结('G', '6', ''), 结('H', '7', '2')];
  /* 画布那一列的读法 = 按行号从上往下（和 bandNodes 同一把尺，两边才可比） */
  const 摆 = 序 => new 沙.板().bandTree(序.map(i => 混[i])).placed.slice().sort((a, z) => a.d - z.d).map(p => p.n.id).join('');
  const 准 = 摆([0, 1, 2, 3, 4, 5, 6, 7]);
  R.数('混着填的一堆（A 评3 B 评1 C 没填 D 评2 E 没填 F 评4 G 没填 H 评2）排出来', 准);
  const 换序 = [[7, 6, 5, 4, 3, 2, 1, 0], [2, 5, 0, 7, 1, 4, 6, 3], [4, 3, 2, 1, 0, 5, 6, 7]]
    .map(序 => 摆(序));
  R.数('把传进去的次序打乱三遍再排', 换序.join(' ｜ '));
  R.判('同一堆兄弟，不管以什么次序送进去，落位只有一个（旧那把按对定方向时这里会翻脸）',
    换序.every(x => x === 准), 准 + ' vs ' + 换序.join(','));
  R.判('有一枚没填评级 → 整堆照序号走（A1 · C1.5 · B2 · D3 · E4 · F5 · G6 · H7，父在上子紧跟其后）',
    准 === 'ACBDEFGH', 准);
  const 全填 = [结('A', '1', '3'), 结('B', '2', '1'), 结('D', '3', '2'), 结('F', '4', '4')];
  const 排全填 = new 沙.板().bandTree(全填).placed.map(p => p.n.id).join('');
  R.判('全都填了评级 → 按评级从小到大（小的在上）：' + 排全填, 排全填 === 'BD A F'.replace(/ /g, ''), 排全填);
  R.判('没序号的那些不进带（bandTree 不收它们，另有一条「未编号」带管）',
    new 沙.板().bandTree([结('X', '', '1'), 结('Y', '1', '')]).placed.length === 1);
  /* 精简版那一列（右栏窄的时候看到的）和画布必须是同一个次序 */
  const 板2 = new 沙.板();
  板2.b = { mode:'event', nodes:混.map(x => 结(x.id, x.seq, x.ev)), ttracks:[], etracks:[{ id:'e1', name:'主线' }] };
  const 列 = 板2.bandNodes('e1').map(n => n.id).join('');
  R.数('精简版那一列拿到的次序', 列 + ' ｜ 画布那一列 ' + 准);
  R.判('精简版和画布同一棵树同一个次序（从前这里拿的是 b.nodes 的录入序，两边对不上号）', 列 === 准, 列);
}

/* ---------- 四、看板：轨道换序的落点（真 grabHead 里那三行） ---------- */
R.题('四、轨道换序：落点认带子、不认裸下标（真 grabHead）');
{
  const 沙 = vm.createContext(Object.assign({}, 底));
  vm.runInContext(`
var 挂 = {};
function wOn(a, b){ 挂.mv = a; 挂.up = b; } function wUn(){ 挂.mv = null; }
var 板 = { ${切方法(W11, '  grabHead(')} };
this.grabHead = 板.grabHead;
this.挂 = 挂;
`, 沙);
  const 轨 = n => Array.from({ length:n }, (x, i) => ({ id:'t' + i, name:'轨' + i }));
  function 跑(几轨, 拖哪条, 指针y, 每带高){
    const list = 轨(几轨), tr = list[几轨 ? 拖哪条 : 0];
    const 板 = {
      b:{ zoom:1 }, cv:{ getBoundingClientRect:() => ({ top:0 }) },
      tracks:() => list,
      dirty(){}, paint(){ 板.L.bands = list.map((t, i) => ({ tr:t, y:i * 每带高 - 30, pitch:每带高 })); },
      L:{ bands:list.map((t, i) => ({ tr:t, y:i * 每带高 - 30, pitch:每带高 })) }
    };
    板.grabHead = 沙.grabHead;
    板.grabHead({ button:0, preventDefault(){}, stopPropagation(){} }, tr);
    挂(指针y);
    return list.map(t => t.id).join(',');
    function 挂(y){ 沙.挂.mv({ clientY:y }); }
  }
  /* 四条轨、每条带高 100：拖第 1 条（t1）落到第 3 条那块带（y=250 → 压着 t3 那一格的上半之前） */
  const 下 = 跑(4, 1, 260, 100);
  R.数('把 t1 往下拖到第三条带上：落出来的次序', 下);
  R.判('往下拖一格就挪一格（t1 落在 t3 之前，不会多越过一条 —— 旧那把两头的下标都照同一份表算，正好越过一条）',
    下 === 't0,t2,t1,t3', 下);
  const 上 = 跑(4, 3, 10, 100);
  R.数('把 t3 往上拖到第一条那一格：落出来的次序', 上);
  R.判('往上拖也一样只挪一格（t3 插到 t0 之前）', 上 === 't3,t0,t1,t2', 上);
  const 原地 = 跑(4, 1, 110, 100);
  R.判('指针还压在它自己那一格里：次序一动不动（不会自己抖）', 原地 === 't0,t1,t2,t3', 原地);
}

/* ---------- 五、看板：连线那几处（静态口径，逐条对着代码量） ---------- */
R.题('五、连线：画法一颗、断一对、层序压回节点底下');
{
  const 跟 = 切方法(W11, '  follow(');
  R.判('拖动那一帧走的也是 linkGeom 那一颗（图18 那条直线分支和字样锚点都跟着，不再自己另写一遍曲线）',
    /linkGeom\(A\.ax, A\.ay, B\.ax, B\.ay\)/.test(跟) && /text-anchor/.test(跟) && !/' C' \+ mx/.test(跟),
    (跟.match(/linkGeom|text-anchor/g) || []).join(' '));
  R.判('双向那条是两枚：断开走一对（认的是两头对调的那一枚 + twin 记号），不会剩半根孤线',
    /const 伴 = x => x !== lk && \(x\.twin \|\| lk\.twin\) && x\.a === lk\.b && x\.b === lk\.a;/.test(W11) &&
    /this\.b\.links = this\.b\.links\.filter\(x => x !== lk && !伴\(x\)\)/.test(W11));
  R.判('那条「正看着的线」在浮层关掉之后的第一趟重画里自己灭掉（不再一直亮到点开下一条）',
    /if\(this\.hotLink && !Overlay\.node\) this\.hotLink = '';/.test(W11));
  R.判('连线模式那颗钮跟着亮跟着灭（toggleLink 会去改它，不必等整屏重画）',
    /this\.relBtn = h\('button'/.test(W11) && /this\.relBtn\.classList\.toggle\('on', this\.linkMode\)/.test(W11));
  const 缝 = /\.wnw-bd-seam\{[^}]*\}/.exec(W11)[0], 点 = /\.wnw-bd-node\{[^}]*\}/.exec(W11);
  const 缝z = +(缝.match(/z-index:(\d+)/) || [0, 0])[1], 点z = 点 ? +(点[0].match(/z-index:(\d+)/) || [0, 0])[1] : 0;
  R.数('缝那一层 / 节点那一层的 z-index', 缝z + ' ｜ ' + 点z);
  R.判('缝压在节点底下（两轨挤成 0 时那 16 像素正好盖在最下一排节点身上，从前它在上头，那一条边点不开）',
    缝z > 0 && 点z > 缝z, 缝z + ' < ' + 点z);
  R.判('精简版那一列走的是 bandNodes（事件线跟画布同一棵序号树、按行号从上往下读），不再拿 b.nodes 的录入序',
    /bandNodes\(tid\)/.test(W11) && /this\.bandNodes\(tr\.id\)/.test(W11) &&
    /this\.bandTree\(ns\)\.placed\.slice\(\)\.sort\(\(a, z\) => a\.d - z\.d\)\.map\(p => p\.n\)/.test(W11));
}

R.收尾();
