/* 外30 图17 · 填时间那一格，把对面那一处已经写过的时间列出来给他对着看
   他这一条定死了三件事：① 手动填写，程序不许替他写一个字；② 不做任何推断（不许靠词库、名字去猜
   「宝物 5 年离开 a 地 ⇒ 转移就在 5 年」）；③ 写在已列的那些时间以内还是以外，一律不管。
   中途他驳回来一次：不许要求「先把卡片关联到节点上」—— 所以这两颗取数看的是整本书，不挑不筛。
   这台不改代码：把真源码里三颗（w11 的 卡片写过的时间 / 看板写过的时间、w3 的 TimeHint）原样切进来跑，
   只在边界上使替身：卡片库（linkRows 交一份现成的关联行）、看板库（Boards.all/get）、假 DOM。
   末了静态钉一遍：三处挂点真挂了、这一条路上一个字都不往格子里写、也不判读法。 */
import vm from 'node:vm';
import { rd, 切, 记账 } from './lib-slice.mjs';

const R = 记账('test-timehint');
const 静 = async (n = 40) => { for(let i = 0; i < n; i++) await Promise.resolve(); };

const W3 = rd('src/_wnw/src/w3-shell.js');
const W10 = rd('src/_wnw/src/w10-cards.js');
const W11 = rd('src/_wnw/src/w11-board.js');
const W0 = rd('src/_wnw/src/w0-skin.js');

/* ---------- 一台假 DOM：够提示框量方框、贴上去、收回来 ---------- */
function 元(tag, attrs, kids){
  const arr = Array.isArray(kids) ? kids : (kids === null || kids === undefined ? [] : [kids]);
  const e = {
    tag, className: (attrs && attrs.class) || '', attrs: attrs || {}, style: {}, children: [], 父: null,
    textContent: '', isConnected: true, offsetWidth: 120, offsetHeight: 40, 耳: {}, scrollTop: 0,
    appendChild(c){ if(c){ this.children.push(c); c.父 = this; } return c; },
    remove(){ const p = this.父; if(p) p.children = p.children.filter(x => x !== this); this.父 = null; this.isConnected = false; },
    addEventListener(t, f){ (this.耳[t] = this.耳[t] || []).push(f); },
    removeEventListener(t, f){ this.耳[t] = (this.耳[t] || []).filter(x => x !== f); },
    getBoundingClientRect(){ return { left:10, top:20, right:130, bottom:44, width:120, height:24 }; },
    发(t, ev){ (this.耳[t] || []).forEach(f => f(ev || { preventDefault(){ this.挡 = (this.挡 || 0) + 1; } })); },
    全话(){ let s = this.textContent; for(const c of this.children) s += c.全话(); return s; }
  };
  for(const k of arr){ if(typeof k === 'string') e.textContent += k; else if(k) e.appendChild(k); }
  return e;
}
const h = (tag, attrs, kids) => 元(tag, attrs, kids);
const 新格 = (值 = '') => { const e = 元('input', { class:'wnw-input' }); e.value = 值; return e; };

/* ---------- 递进虚拟机的一切：真三颗 + 只在边界上的替身 ---------- */
const 卡库 = { 行: [], 叫过: [] };
const 板库 = { 目: [], 全: {}, 开过: [] };
const 沙 = {
  h,
  linkRows: async (书) => { 卡库.叫过.push(书); return 卡库.行.map(x => Object.assign({}, x)); },
  CardNames: { get: id => ({ k1:'宝物', k2:'a地', k3:'b地', k4:'夺者' })[id] || '' },
  Boards: { all: async () => 板库.目, get: async id => { 板库.开过.push(id); return 板库.全[id] || null; } },
  框: { w: 600, h: 400 },
  根: 元('div', { class:'wnw-root' })
};
沙.wnwRoot = () => 沙.根;
沙.wnwBox = () => 沙.框;
沙.wnwLocal = (x, y) => ({ x, y });

const 三颗 = { 卡片写过的时间: 切(W11, '卡片写过的时间'), 看板写过的时间: 切(W11, '看板写过的时间'), TimeHint: 切(W3, 'TimeHint') };
const ctx = vm.createContext(沙);
vm.runInContext([
  切(W11, 'T_MODES'), 切(W11, 'modeName'),
  切(W10, 'LINK_CATS'), 切(W10, 'OLD_CAT'), 切(W10, 'catKey'), 切(W10, 'catName'), 切(W10, 'linkDesc'),
  三颗.卡片写过的时间, 三颗.看板写过的时间, 三颗.TimeHint,
  'this.卡片写过的时间 = 卡片写过的时间; this.看板写过的时间 = 看板写过的时间; this.TimeHint = TimeHint;'
].join('\n'), ctx);
const { 卡片写过的时间, 看板写过的时间, TimeHint } = ctx;
/* 换一颗改过的进同一台虚拟机（咬口用）：改了哪一句，就把那一颗重新端出来。
   注意末尾那对括号 —— 少了它交回来的是「装着那颗函数的壳」本身，不是里面那颗：
   第一版就是这么把咬口一糊过去的（函数自己的 length 正好是 2，判法照旧报 PASS）。 */
const 换 = (名, 文) => vm.runInContext('(function(){\n' + 文 + '\nreturn ' + 名 + ';\n})()', ctx);
const 亮框 = () => 沙.根.children.filter(x => x.isConnected);
const 清场 = () => { TimeHint.收(); 沙.根 = 元('div', { class:'wnw-root' }); };

/* ---------- 一、卡片那边列什么 ---------- */
R.题('一、卡片上写过的时间（一条关联的起始 / 结束）');
{
  卡库.行 = []; 卡库.叫过 = [];
  R.判('这本书里一条时间都没写过 → 空着手回来（不摆空框）', (await 卡片写过的时间('b1')).length === 0, '');
  卡库.叫过 = [];
  await 卡片写过的时间('b1'); await 卡片写过的时间('');
  R.判('问的是这本书（书号原样交给卡片库；书号空着才问全书）', 卡库.叫过.join(',') === 'b1,__ALL__', 卡库.叫过);

  卡库.行 = [
    { from:'k1', fromTitle:'宝物', to:'k2', cat:'tl', rel:'持有', mode:'fake', t0:'3年', t1:'5年', way:'自始持有' },
    { from:'k1', fromTitle:'宝物', to:'k3', cat:'tl', rel:'持有', mode:'fake', t0:'5年', t1:'7年', way:'抢夺' },
    { from:'k1', fromTitle:'宝物', to:'k4', cat:'pp', rel:'被夺于', mode:'real', t0:'', t1:'', way:'' },
    { from:'k2', fromTitle:'a地', to:'k3', cat:'ol', rel:'辖', mode:'fake', t0:'1年', t1:'', way:'' }
  ];
  const 出 = await 卡片写过的时间('b1');
  R.判('凡是写了起始 / 结束时间的行都列（三条），没写时间那条（被夺于）不列', 出.length === 3, 出.map(x => x.话));
  R.判('左头写的是「谁 → 谁」，两张卡名都在', 出[0].谁 === '宝物 → a地', 出[0].谁);
  R.判('右头那条白话带着起止、读法和来路（3年 ~ 5年（架空） · 自始持有）',
    /3年 ~ 5年（架空）/.test(出[0].话) && /自始持有/.test(出[0].话), 出[0].话);
  R.判('只写了起始、结束空着的也列，白话里补「不限」（a地 → b地 · 1年 ~ 不限）',
    出.some(x => x.话.includes('1年 ~ 不限')), 出.map(x => x.话));
  R.判('跟你要填的那张卡没关系的行也照列 —— 不挑不筛（他驳的就是这一条）',
    出.some(x => x.谁 === 'a地 → b地'), 出.map(x => x.谁));

  卡库.行 = [
    { from:'k1', fromTitle:'宝物', to:'k4', cat:'pp', rel:'同盟', mode:'real', t0:'2年', t1:'', way:'', bi:true },
    { from:'k4', fromTitle:'夺者', to:'k1', cat:'pp', rel:'同盟', mode:'real', t0:'2年', t1:'', way:'', bi:true, rev:true }
  ];
  R.判('双向那一条正反两趟只列一次（认两张卡号 + 起止 + 关系 + 来路）',
    (await 卡片写过的时间('b1')).length === 1, await 卡片写过的时间('b1'));
}

/* ---------- 二、看板那边列什么 ---------- */
R.题('二、看板上写过的时间（节点的）');
{
  板库.目 = [ { id:'d1', title:'主线板', bookId:'b1' }, { id:'d2', title:'别人的板', bookId:'b9' }, { id:'d3', title:'公共板', bookId:'' } ];
  板库.全 = {
    d1: { title:'主线板', bookId:'b1', ttracks:[{ id:'t1', name:'主时间', mode:'fake' }],
      nodes:[ { id:'n1', label:'宝物被夺', t:'5年', tt:'t1', cards:[] },
              { id:'n2', label:'没写时间', t:'', tt:'t1', cards:['k1'] },
              { id:'n3', label:'哪张卡都没挂', t:'9年', tt:'t1' } ] },
    d2: { title:'别人的板', bookId:'b9', ttracks:[{ id:'t1', mode:'real' }],
      nodes:[ { id:'n4', label:'别本书的事', t:'2026-01-01', tt:'t1' } ] },
    d3: { title:'公共板', bookId:'', ttracks:[{ id:'t1', mode:'origin' }],
      nodes:[ { id:'n5', label:'零点前', t:'3天前', tt:'t1' } ] }
  };
  板库.开过 = [];
  const 出 = await 看板写过的时间('b1');
  R.判('这本书写了时间的节点都列（宝物被夺 5年、哪张卡都没挂 9年 都算）；公共板（哪本书都不属）跟着列 —— 和卡片库 forBook 同一口径',
    出.length === 3 && 出.some(x => /宝物被夺/.test(x.谁)) && 出.some(x => /公共板 › 零点前/.test(x.谁 + '＝' + x.话)),
    出.map(x => x.谁 + '＝' + x.话));
  R.判('不要求节点挂着卡片 —— 一颗卡都没挂的节点也照列', 出.some(x => x.谁.includes('哪张卡都没挂')), 出.map(x => x.谁));
  R.判('左头带上是哪块板（主线板 › 宝物被夺）', 出.some(x => x.谁 === '主线板 › 宝物被夺'), 出.map(x => x.谁));
  R.判('右头带上这一轨的读法（5年（架空））', 出.some(x => x.话 === '5年（架空）'), 出.map(x => x.话));
  R.判('时间空着的节点不列', !出.some(x => /没写时间/.test(x.谁)), 出.map(x => x.谁));
  R.判('别本书的板不去打开（别人的板那一块连读都不读）；公共板跟着列',
    板库.开过.indexOf('d2') < 0 && 板库.开过.indexOf('d1') >= 0 && 板库.开过.indexOf('d3') >= 0, 板库.开过);
  R.判('一块板读不出来（半截存档）就跳过，不抛错也不列鬼话',
    (板库.全 = { d1:{ title:'读不出', bookId:'b1', nodes:[] }, d3:null }, (await 看板写过的时间('')).length === 0), '');
}

/* ---------- 三、提示框：什么时候出、长什么样、什么时候收 ---------- */
R.题('三、提示框：出的条件、长的样子、收的时机');
{
  清场();
  const 条 = [{ 谁:'宝物 → a地', 话:'持有 · 3年 ~ 5年（架空） · 自始持有' }, { 谁:'宝物 → b地', 话:'持有 · 5年 ~ 7年（架空） · 抢夺' }];
  TimeHint.给(新格(), '卡片上写过的时间', []);
  R.判('一条都没有 → 什么都不摆（没东西可列就不立一个空框）', 亮框().length === 0, 沙.根.children.length);
  TimeHint.给(null, '卡片上写过的时间', 条);
  R.判('那一格不存在（弹窗已经换了）→ 不摆', 亮框().length === 0, 沙.根.children.length);
  const 离 = 新格(); 离.isConnected = false;
  TimeHint.给(离, '卡片上写过的时间', 条);
  R.判('那一格被换掉了 → 不摆（重画之后旧格子不挂框）', 亮框().length === 0, 沙.根.children.length);

  清场();
  沙.框 = { w: 600, h: 400 };
  TimeHint.给(新格(), '卡片上写过的时间', 条);
  const 框 = 亮框();
  R.判('两条都摆 → 只有一个框，挂在 wnw-root 那一层上', 框.length === 1, 沙.根.children.length);
  R.判('框里第一行是标题，往后一条时间占一行，一行两格（左谁右话）',
    框[0].children.length === 3 && 框[0].children[0].textContent === '卡片上写过的时间' &&
    框[0].children[1].children.length === 2 && 框[0].children[1].children[0].textContent === '宝物 → a地' &&
    /3年 ~ 5年/.test(框[0].children[1].children[1].textContent) &&
    框[0].children[2].children[1].textContent.includes('7年'), 框[0].全话());
  R.判('带上了 wnw-time-hint 这个名字（皮肤里那一档就是给它开滚轮的）', /wnw-time-hint/.test(框[0].className), 框[0].className);
  TimeHint.给(新格(), '卡片上写过的时间', 条.slice(0, 1));
  R.判('再摆一次先把上一个收掉（换一档读法不叠第二个）', 亮框().length === 1, 沙.根.children.length);

  /* 条目多到装不下：给一个高度上限，超出靠滚轮翻（滚轮由根上那颗耳子接） */
  清场();
  const 根上原有 = (沙.根.耳.wheel || []).length;
  沙.框 = { w: 600, h: 300 };
  TimeHint.给(新格(), 'T', Array.from({ length: 30 }, (x, i) => ({ 谁:'第' + i + '条', 话:'5年' })));
  R.判('容器 300 高 → 框的高度上限跟着收（300-24＝276），不是顶出窗外', parseFloat(亮框()[0].style.maxHeight) === 276, 亮框()[0].style.maxHeight);
  /* 真页面上这一框正压在下一格「结束时间」上：它一吃鼠标，那一格就点不到了（探针浏览器真点那一下被挡下来过）。
     所以这一框跟着 .wnw-tip 不吃鼠标，长名单要翻靠外面那颗滚轮 —— 下面判的就是这两件。 */
  R.判('这一框身上没有「按下」那颗耳子（不吃鼠标，正下面那一格照样点得到）',
    !亮框()[0].耳.mousedown, Object.keys(亮框()[0].耳));
  R.判('皮肤里 .wnw-time-hint 没把 pointer-events 改回 auto（跟着 .wnw-tip 的 none 走）',
    !/\.wnw-root \.wnw-time-hint\{[^}]*pointer-events\s*:\s*auto/.test(W0),
    (W0.match(/\.wnw-root \.wnw-time-hint\{[^}]*\}/) || ['没这一档'])[0]);
  const 滚里 = { clientX:60, clientY:30, deltaY:53, 挡:0, preventDefault(){ this.挡++; } };
  沙.根.发('wheel', 滚里);
  R.判('滚轮落在这框范围内 → 翻这一框（scrollTop 加上 53），并且挡住底下那层不许跟着滚',
    亮框()[0].scrollTop === 53 && 滚里.挡 === 1, 亮框()[0].scrollTop + ' / 挡 ' + 滚里.挡);
  const 滚外 = { clientX:60, clientY:300, deltaY:77, 挡:0, preventDefault(){ this.挡++; } };
  沙.根.发('wheel', 滚外);
  R.判('滚轮落在这框外头 → 不碰这一框、也不挡（底下那层照旧滚）',
    亮框()[0].scrollTop === 53 && 滚外.挡 === 0, 亮框()[0].scrollTop + ' / 挡 ' + 滚外.挡);
  R.判('摆这一框在根上挂的那颗滚轮耳子只有一颗（不吃鼠标的框自己接不到滚动；一框一颗，不许攒）',
    根上原有 === 0 && (沙.根.耳.wheel || []).length === 1, (沙.根.耳.wheel || []).length);
  TimeHint.收();
  R.判('收掉这一框把根上那颗滚轮耳子一起摘了（不许留一颗找不到框的）',
    (沙.根.耳.wheel || []).length === 0, (沙.根.耳.wheel || []).length);
  清场();

  /* 摆的位置：这一格下沿 → 底下装不下翻到上沿 → 最后拿容器顶当闸 */
  沙.框 = { w: 600, h: 400 };
  TimeHint.给(新格(), 'T', [{ 谁:'a', 话:'b' }]);
  R.判('底下装得下 → 贴在这一格下沿（那一格底 44 + 8 = 52）', parseFloat(亮框()[0].style.top) === 52, 亮框()[0].style.top);
  沙.框 = { w: 600, h: 70 };
  TimeHint.给(新格(), 'T', [{ 谁:'a', 话:'b' }]);
  R.判('底下装不下 → 不许出顶（夹到 6）', parseFloat(亮框()[0].style.top) === 6, 亮框()[0].style.top);
  沙.框 = { w: 600, h: 100 };
  TimeHint.给(新格(), 'T', [{ 谁:'a', 话:'b' }]);
  R.判('容器够高时不许被底部那道闸顶上去（还是 52）', parseFloat(亮框()[0].style.top) === 52, 亮框()[0].style.top);
  沙.框 = { w: 120, h: 400 };
  TimeHint.给(新格(), 'T', [{ 谁:'a', 话:'b' }]);
  R.判('右边窄 → 不许飞出窗外（夹到下限 6）', parseFloat(亮框()[0].style.left) === 6, 亮框()[0].style.left);

  /* 耳子：光标进去就列（空着的、正在改的都算）、走开就收、打字期间不收 */
  清场();
  const 已有 = 新格('5年');
  let 叫 = 0;
  TimeHint.挂(已有, 'T', () => { 叫++; return Promise.resolve([{ 谁:'a', 话:'b' }]); });
  已有.发('focus'); await 静();
  R.判('这一格里已经有字也算「在填写时间」→ 照样列出来（他驳过只提空格子那一版）',
    叫 === 1 && 亮框().length === 1, 叫 + ' / 框 ' + 亮框().length);

  const 空1 = 新格('');
  let 放 = null;
  TimeHint.挂(空1, 'T', () => new Promise(res => { 放 = res; }));
  /* 上一格（已有字那一格）的框还挂着：先收干净，下面这条才判的是「这一格自己还没答回来」 */
  清场();
  空1.发('focus'); await 静();
  R.判('还没答回来之前先不摆（不摆半张）', 亮框().length === 0, '');
  空1.发('blur');
  放([{ 谁:'a', 话:'b' }]); await 静();
  R.判('走开之后晚到的答案不许再摆（那一格早就不亮了）', 亮框().length === 0, 沙.根.children.length);

  const 空2 = 新格('');
  TimeHint.挂(空2, 'T', () => Promise.resolve([{ 谁:'a', 话:'b' }]));
  空2.发('focus'); await 静();
  R.判('空着的那一格 → 光标进去就列', 亮框().length === 1, '');
  空2.发('input');
  R.判('列出来之后接着打字不收这一框（那一份就是拿来对着写的）', 亮框().length === 1, '');
  R.判('这一格身上只有「进去」和「走开」两只耳子（没有偷偷加第三只）',
    Object.keys(空2.耳).sort().join(',') === 'blur,focus', Object.keys(空2.耳));
  空2.发('blur');
  R.判('走开 → 当场收掉', 亮框().length === 0, 沙.根.children.length);
}

/* ---------- 四、静态钉：三处真挂了、而且一个字都不往格子里写 ---------- */
R.题('四、接线与「不代填、不校验、不要求先关联」');
{
  const 三 = 三颗.卡片写过的时间 + 三颗.看板写过的时间 + 三颗.TimeHint;
  R.判('节点详情那一格挂了（递的是这块板的书号，不递卡号）',
    /TimeHint\.挂\(t, '卡片上写过的时间', \(\) => 卡片写过的时间\(b\.bookId \|\| Work\.book\.id\)\)/.test(W11), '');
  R.判('加节点那一格也挂了（新建时同样先列，不要求先把卡片关联上来）',
    /TimeHint\.挂\(t, '卡片上写过的时间', \(\) => 卡片写过的时间\(b\.bookId \|\| Work\.book\.id\)\)/.test(W11),
    (W11.match(/TimeHint\.挂/g) || []).length);
  R.判('卡片那两格（起始时间 / 结束时间）共用一颗 mk，每格各挂一次',
    /TimeHint\.挂\(i, '看板上写过的时间', \(\) => 看板写过的时间\(书\)\)/.test(W10), '');
  R.判('取数那两颗眼里没有「卡号」这一说：不许出现 n.cards、也不许按卡号筛（他驳的就是这一步）',
    !/n\.cards|号们|\.has\(r\.from/.test(三颗.卡片写过的时间 + 三颗.看板写过的时间),
    (三颗.卡片写过的时间 + 三颗.看板写过的时间).match(/n\.cards|号们|\.has\(r\.from/g));
  R.判('这一条路上一个字都不往格子里写：三颗里不许有「格.value =」这种代填',
    !/\.value\s*=[^=]/.test(三), (三.match(/\.value\s*=/g) || []));
  R.判('两边都不写对方：取数那两颗只读不写（Cards.put / Boards.put / State.set / dirty 一次都不叫）',
    !/Cards\.put|Boards\.put|State\.set|dirty\(/.test(三颗.卡片写过的时间 + 三颗.看板写过的时间), '');
  R.判('长名单靠滚轮翻：皮肤里 .wnw-root .wnw-time-hint 开着 overflow-y:auto，摆的那一颗给框上了高度上限',
    /\.wnw-root \.wnw-time-hint\{overflow-y:auto;\}/.test(W0) && /窗\.style\.maxHeight = Math\.max\(80, b\.h - 24\)/.test(三颗.TimeHint),
    (W0.match(/\.wnw-root \.wnw-time-hint\{[^}]*\}/) || ['没这一档'])[0]);
  R.判('滚轮那颗耳子挂在根上、收框时摘掉（不吃鼠标的那一框自己接不到滚动，留着空耳子就是漏）',
    /wnwRoot\(\)\.addEventListener\('wheel', 轮, true\)/.test(三颗.TimeHint) &&
    /this\.摘 = \(\) => wnwRoot\(\)\.removeEventListener\('wheel', 轮, true\)/.test(三颗.TimeHint), '');
  R.判('取数那两颗不判读法（fakeTime / realTime / originTime / linkVal 一次都不叫）：对不对归那一格自己报',
    !/fakeTime|realTime|originTime|linkVal/.test(三颗.卡片写过的时间 + 三颗.看板写过的时间), '');
  R.判('关窗这一框跟着收（Overlay.close 里头有一颗 TimeHint.收()）',
    /close\(\)\{[\s\S]{0,140}TimeHint\.收\(\)/.test(W3), '');
  R.判('卡片那边念的是现成的关联白话、看板那边念的是节点自己写的那句（洗过首尾空格）+ 轨的读法：不新造一套话',
    /linkDesc\(r\)/.test(三颗.卡片写过的时间) && /String\(n\.t \|\| ''\)\.trim\(\)/.test(三颗.看板写过的时间) &&
    /modeName\(tr\.mode \|\| 'real'\)/.test(三颗.看板写过的时间), '');
}

/* ---------- 五、四处咬口：拿掉哪一句，上面哪条判法当场失效 ---------- */
R.题('五、咬口（确认这些判法真咬得住）');
{
  卡库.行 = [
    { from:'k1', fromTitle:'宝物', to:'k4', cat:'pp', rel:'同盟', mode:'real', t0:'2年', t1:'', way:'', bi:true },
    { from:'k4', fromTitle:'夺者', to:'k1', cat:'pp', rel:'同盟', mode:'real', t0:'2年', t1:'', way:'', bi:true, rev:true }
  ];
  const 不重 = await 换('卡片写过的时间', 三颗.卡片写过的时间.replace(/if\(见\.has\(键\)\) continue;/, ''));
  R.判('咬口一：拿掉「见过就跳过那一句」→ 同一件事列了两条（第一条判法当场失效）',
    (await 不重('b1')).length === 2, await 不重('b1'));

  const 空壳 = await 换('TimeHint', 三颗.TimeHint.replace('if(!格 || !格.isConnected || !条目 || !条目.length) return;', 'if(!格 || !格.isConnected) return;'));
  清场();
  空壳.给(新格(), 'T', []);
  R.判('咬口二：拿掉「没条目就 return」→ 真立了一个只有标题的空框（第三节那条当场失效）',
    亮框().length === 1 && 亮框()[0].全话() === 'T', 亮框().length);
  空壳.收();

  const 不滚 = await 换('TimeHint', 三颗.TimeHint.replace("class:'wnw-tip wnw-time-hint'", "class:'wnw-tip'"));
  清场();
  不滚.给(新格(), 'T', [{ 谁:'a', 话:'b' }]);
  R.判('咬口三：把 wnw-time-hint 那个名字摘掉 → 第三节那条名字的判法、第四节那档滚轮的皮肤都落空',
    亮框().length === 1 && !/wnw-time-hint/.test(亮框()[0].className), 亮框()[0].className);
  不滚.收();

  /* 咬口四：摘掉整句落点闸（只摘头一个条件不算 —— 那一串是 || 起来的，剩下三条照样拦） */
  清场();
  const 没闸 = 换('TimeHint', 三颗.TimeHint.replace(
    'if(ev.clientX < q.left || ev.clientX > q.right || ev.clientY < q.top || ev.clientY > q.bottom) return;', ''));
  没闸.给(新格(), 'T', [{ 谁:'a', 话:'b' }]);
  const 外 = { clientX:60, clientY:300, deltaY:44, 挡:0, preventDefault(){ this.挡++; } };
  沙.根.发('wheel', 外);
  R.判('咬口四：摘掉那一句落点闸 → 光标在框外头滚一下也把这一框翻走（第三节「外头不碰」那条当场失效）',
    亮框().length === 1 && 亮框()[0].scrollTop === 44 && 外.挡 === 1,
    亮框().length + ' / ' + 亮框()[0].scrollTop + ' / 挡 ' + 外.挡);
  没闸.收();
}

R.数('卡片库被问了几趟', 卡库.叫过.length);
R.数('看板被打开了几块', 板库.开过.length);
R.收尾();
