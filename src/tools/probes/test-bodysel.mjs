/* 外30 丁组（图13/14）：关联正文从「整段打勾」改成「自由选字」——
   段里选几个字选得动、按住拖过几段也选得动；存下来的是一条关联带若干片段 {pid, from, to}，
   偏移按 p.t 数（和批注、修订痕迹同一口径），老那批只有段号的记录读出来当整段。
   跑的是仓库里那两份原文（w7-data 那三颗 + w10-cards 那一框），不抄第二份；
   DOM 只假到能摆一行字、能挂一个选区为止。 */
import vm from 'node:vm';
import { 切, 记账, rd } from './lib-slice.mjs';

const Z = 记账('test-bodysel');
const W7 = rd('src/_wnw/src/w7-data.js');
const W10 = rd('src/_wnw/src/w10-cards.js');
const await0 = () => new Promise(r => setTimeout(r, 0));

/* ---------------- 一、存法那一头：三颗真的从 w7-data 切出来 ---------------- */
const 存 = {}; vm.createContext(存);
vm.runInContext([切(W7, 'linkParts'), 切(W7, 'linkSig'), 切(W7, 'trackTodos')].join('\n')
  + '\n;globalThis.__S = { linkParts, linkSig, trackTodos };', 存);
const S = 存.__S;

Z.题('一、一条关联的片段怎么读（新的带片段、老的只有段号）');
Z.判('1 老记录读出来当整段（一段、from/to 都空），不动存档也接得上新的那条路',
  JSON.stringify(S.linkParts({ chId:'chA', pid:'p1', t:'床前' })) === JSON.stringify([{ pid:'p1', from:null, to:null }]),
  S.linkParts({ chId:'chA', pid:'p1', t:'床前' }));
Z.判('2 段号都没有就是空的，不编出一段来',
  JSON.stringify(S.linkParts({ chId:'chA', t:'床前' })) === '[]', S.linkParts({ chId:'chA', t:'床前' }));
Z.判('3 新记录带几段就是几段，顺序原样、偏移照数',
  JSON.stringify(S.linkParts({ chId:'chA', pid:'p1', parts:[{ pid:'p2', from:3, to:7 }, { pid:'p3' }] }))
  === JSON.stringify([{ pid:'p2', from:3, to:7 }, { pid:'p3', from:null, to:null }]));
Z.判('4 半截存档：片段里混 null、缺号、偏移写成字、写成乱字 —— 能用的洗出来，不能用的当整段',
  JSON.stringify(S.linkParts({ chId:'chA', pid:'p9', parts:[null, { pid:'' }, { pid:'p2', from:'3', to:'7' }, { pid:'p3', from:'abc', to:null }] }))
  === JSON.stringify([{ pid:'p2', from:3, to:7 }, { pid:'p3', from:null, to:null }]),
  S.linkParts({ chId:'chA', pid:'p9', parts:[null, { pid:'' }, { pid:'p2', from:'3', to:'7' }, { pid:'p3', from:'abc', to:null }] }));
Z.判('5 段号只当兜底：有片段就不看它（跨段那条的首段号不等于整条）',
  S.linkParts({ chId:'chA', pid:'p1', parts:[{ pid:'p2', from:0, to:5 }] }).length === 1
  && S.linkParts({ chId:'chA', pid:'p1', parts:[{ pid:'p2', from:0, to:5 }] })[0].pid === 'p2');
Z.判('6 同章同段同偏移才算同一条；段内挪一个字就是新的一条',
  S.linkSig({ chId:'chA', parts:[{ pid:'p1', from:2, to:6 }] }) !== S.linkSig({ chId:'chA', parts:[{ pid:'p1', from:3, to:6 }] })
  && S.linkSig({ chId:'chA', parts:[{ pid:'p1', from:2, to:6 }] }) === S.linkSig({ chId:'chA', parts:[{ pid:'p1', from:2, to:6 }] }));
Z.判('7 跨两段和只选头一段不撞号（从前拿 chId|pid 当号，这两条会并成一条）',
  S.linkSig({ chId:'chA', pid:'p1', parts:[{ pid:'p1', from:0, to:5 }, { pid:'p2', from:0, to:6 }] })
  !== S.linkSig({ chId:'chA', pid:'p1', parts:[{ pid:'p1', from:0, to:5 }] }));
Z.判('8 换一章换一个号（不同章里同样的段号不撞）',
  S.linkSig({ chId:'chA', parts:[{ pid:'p1' }] }) !== S.linkSig({ chId:'chB', parts:[{ pid:'p1' }] }));

Z.题('二、下游那条路：待办读一份要读得动新旧两种');
const 读 = S.trackTodos({ todos:[{ id:'t1', text:'写第三章', done:false, cards:['c1'], paras:[
  { chId:'chA', chTitle:'第一章', pid:'p1', at:111, t:'整段的老记录' },
  { chId:'chA', chTitle:'第一章', pid:'p2', parts:[{ pid:'p2', from:2, to:6 }, { pid:'p3', from:0, to:7 }], at:222, t:'床前明月' }
]}]})[0];
Z.判('9 老那一条过了闸还在，并且补成整段一个片段（段号、显示字都没丢）',
  读.paras.length === 2 && 读.paras[0].pid === 'p1' && 读.paras[0].t === '整段的老记录'
  && JSON.stringify(读.paras[0].parts) === JSON.stringify([{ pid:'p1', from:null, to:null }]), 读.paras[0]);
Z.判('10 新那一条片段原样带过去，段号也齐（读 p.pid 的老地方不会拿到空）',
  JSON.stringify(读.paras[1].parts) === JSON.stringify([{ pid:'p2', from:2, to:6 }, { pid:'p3', from:0, to:7 }])
  && 读.paras[1].pid === 'p2', 读.paras[1]);
Z.判('11 坏数据不炸：paras 不是数组当空的、混 null 的那条丢掉、缺的字段补空串',
  JSON.stringify(S.trackTodos({ todos:[{ id:'x', paras:'不是数组' }] })[0].paras) === '[]'
  && S.trackTodos({ todos:[{ id:'y', paras:[null, { chId:'chA', pid:'p1' }] }] })[0].paras.length === 1);

/* ---------------- 三、那一框：真源码 + 只够挂选区的 DOM ---------------- */
const 托话 = [];
const 托 = { box:null, foot:[] };
const 章 = {
  chA:{ id:'chA', title:'第一章', paras:[
    { id:'p1', t:'床前明月光，', rev:[] }, { id:'p2', t:'疑是地上霜。', rev:[] }, { id:'p3', t:'举头望明月，', rev:[] },
    { id:'p4', t:'', rev:[] },
    { id:'p5', t:'删光了的一句', rev:[{ status:'open', op:'del', at:0, text:'删光了的一句' }] } ] },
  chB:{ id:'chB', title:'第二章', paras:[{ id:'q1', t:'第二张的第一段', rev:[] }] }
};
let 区 = null;
const 假 = {
  console, h, toast:m => 托话.push(String(m)),
  Overlay:{ open(t, box, foot){ 托.box = box; 托.foot = foot || []; }, close(){} },
  Work:{ book:{ id:'bk1', chs:[{ id:'chA', title:'第一章' }, { id:'chB', title:'第二章' }] },
    ch:async id => 章[id] || null },
  window:{ getSelection:() => 区 ? { isCollapsed:false, rangeCount:1, getRangeAt:() => 区 }
                                    : { isCollapsed:true, rangeCount:0, getRangeAt:() => null } },
  Date, Math, Number, String, Array, Object, JSON, Set, Map, Boolean, isNaN, parseInt, parseFloat, Promise
};
vm.createContext(假);
vm.runInContext([切(W10, 'cut'), 切(W7, 'delRanges'), 切(W7, 'cleanText'), 切(W10, 'bodyPickDlg'),
  切(W7, 'linkParts'), 切(W7, 'linkSig')].join('\n') + '\n;globalThis.__pick = bodyPickDlg;', 假);

/* DOM：一行 = 一个元素 + 一个文本节点，够 Range 的两端各落在上面 */
function 文本(v, 爸){ return { nodeType:3, nodeValue:String(v), parentElement:爸, 爸 }; }
function 造(tag, props){
  const e = {
    nodeType:1, tag, class:'', style:'', attrs:{}, 手:{}, kids:[], value:'',
    appendChild(x){
      if(typeof x === 'string' || typeof x === 'number') e.kids.push(文本(x, e));
      else if(Array.isArray(x)) x.forEach(k => e.appendChild(k));
      else if(x){ x.爸 = e; e.kids.push(x);
        /* select 的 value 由「哪一项 selected」定，和真 DOM 同一口径 */
        if(x.nodeType === 1 && x.tag === 'option' && x.attrs.selected) e.value = x.value; }
      return x;
    },
    addEventListener(k, f){ (e.手[k] = e.手[k] || []).push(f); },
    get firstChild(){ return e.kids[0] || null; },
    get innerHTML(){ return ''; },
    set innerHTML(v){ if(v === '') e.kids = []; },
    get textContent(){ return e.kids.map(k => k.nodeType === 3 ? k.nodeValue : k.textContent).join(''); },
    set textContent(v){ e.kids = [文本(v, e)]; },
    closest(){ let n = e; while(n){ if(n.attrs && n.attrs['data-pid'] !== undefined) return n; n = n.爸; } return null; },
    classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } }
  };
  for(const k in (props || {})){
    const v = props[k];
    if(k === 'class') e.class = v;
    else if(k === 'style') e.style = v;
    else if(/^on[a-z]+$/i.test(k)) e.手[k.slice(2).toLowerCase()] = [v];
    else if(k === 'value') e.value = v;
    else e.attrs[k] = v;
  }
  return e;
}
function h(tag, props, kids){
  const e = 造(tag, (props && typeof props === 'object' && !Array.isArray(props)) ? props : null);
  e.appendChild(kids === undefined ? '' : kids);
  return e;
}
const 发 = (e, k) => (e.手[k] || []).slice().forEach(f => f({ stopPropagation(){} }));
function 找(e, cls){
  for(const k of e.kids) if(k.nodeType === 1){
    if(k.class.split(' ').includes(cls)) return k;
    const r = 找(k, cls); if(r) return r;
  }
  return null;
}
/* 只认 button 那一层：整行 div 的文字里也含这几个字，不卡住标签就会点到整行 */
function 找钮(where, 字){
  for(const k of (Array.isArray(where) ? where : where.kids)) if(k && k.nodeType === 1){
    if(k.tag === 'button' && String(k.textContent).includes(字)) return k;
    const r = 找钮(k, 字); if(r) return r;
  }
  return null;
}

async function 开框(){
  托话.length = 0; 区 = null; 托.box = null; 托.foot = [];
  let 出 = null;
  假.__pick('bk1', arr => { 出 = arr; }, '挑正文');
  await await0();
  const box = 托.box, list = 找(box, 'wnw-bp-list');
  const 行 = () => list.kids.filter(k => k.nodeType === 1 && k.attrs['data-pid'] !== undefined);
  const 提示 = () => { const t = 找(box, 'wnw-hint'); return t ? String(t.textContent) : ''; };
  const 交 = async () => { 发(找钮(box, '收进关联'), 'click'); await await0(); };
  return {
    box, list, 行, 提示, 出:() => 出,
    /* 拖：两端给「第几行 + 第几个字」；形 = '整行' 时两端都落在行元素上（拖到行边上） */
    拖: async (si, a, ei, b, 形) => {
      const s = 行()[si], e = 行()[ei];
      区 = 形 === '整行'
        ? { startContainer:s, startOffset:0, endContainer:e, endOffset:1 }
        : { startContainer:s.kids[0], startOffset:a, endContainer:e.kids[0], endOffset:b };
      发(list, 'mouseup'); await 交();
    },
    空拖: async () => { 区 = null; 发(list, 'mouseup'); await await0(); },
    /* 起点跑到终点之后：Range 不该有这种，但手一抖就该不收，不该凑出半个片段 */
    倒拖: async () => { const r = 行(); 区 = { startContainer:r[2].kids[0], startOffset:1, endContainer:r[0].kids[0], endOffset:3 };
      发(list, 'mouseup'); await 交(); },
    外拖: async () => { const 外 = 文本('框外的字', null);
      区 = { startContainer:外, startOffset:1, endContainer:外, endOffset:2 }; 发(list, 'mouseup'); await 交(); },
    双击: async i => { 发(行()[i], 'dblclick'); await await0(); },
    切章: async id => { const s = 找(box, 'wnw-input'); s.value = id; 发(s, 'change'); await await0(); },
    保存: () => { 发(找钮(托.foot, '保存'), 'click'); return 出; },
    取消: () => { 发(找钮(托.foot, '取消'), 'click'); return 出; }
  };
}

Z.题('三、段内选几个字');
{
  const d = await 开框();
  Z.判('1 摆出来的只有写了字的段：空段和整句被痕迹盖住的那条都不进这一屏',
    d.行().map(x => x.attrs['data-pid']).join(',') === 'p1,p2,p3', d.行().map(x => x.attrs['data-pid']));
  Z.判('2 行号写在 data-no 里、不进文本节点（偏移才和 p.t 一个字不错位）',
    d.行()[1].attrs['data-no'] === '2' && d.行()[1].kids.length === 1 && d.行()[1].kids[0].nodeValue === '疑是地上霜。',
    [d.行()[1].attrs['data-no'], d.行()[1].kids.length]);
  Z.判('3 还没拖时那一句教的是怎么个选法', /拖鼠标选字/.test(d.提示()), d.提示());
  await d.拖(0, 2, 0, 6);
  const a = d.保存();
  Z.判('4 段里选第 3~6 个字：存的就是这一截，段号、两头都对',
    a.length === 1 && a[0].chId === 'chA' && JSON.stringify(a[0].parts) === JSON.stringify([{ pid:'p1', from:2, to:6 }]), a[0] && a[0].parts);
  Z.判('5 抄进 t 的就是那四个字往后那一截（cut 折空白，显示不再读盘）', a[0].t === '明月光，', a[0].t);
  Z.判('6 章名抄一条存着、时戳给上（显示那一行不用再回章里查）', a[0].chTitle === '第一章' && typeof a[0].at === 'number', a[0]);
  Z.判('7 段内一条只算一个片段，提示里不写「跨」', a[0].parts.length === 1 && !/跨/.test(d.提示()), [a[0].parts.length, d.提示()]);
}

Z.题('四、按住拖过几段');
{
  const d = await 开框();
  await d.拖(0, 2, 2, 4);
  const a = d.保存();
  Z.判('8 从第 1 段中间拖到第 3 段中间：三个片段，头一段留尾巴、中间整段、末一段取头',
    a.length === 1 && JSON.stringify(a[0].parts) === JSON.stringify([
      { pid:'p1', from:2, to:6 }, { pid:'p2', from:0, to:6 }, { pid:'p3', from:0, to:4 }]), a[0] && a[0].parts);
  Z.判('9 首段号填的是这一条的头一段（还读 p.pid 的老地方不会拿到空号）', a[0].pid === 'p1', a[0].pid);
  Z.判('10 提示报出跨了几段、跨到章里第几段（不是屏上第几行）',
    /跨 3 段/.test(d.提示()) && /第 1 ~ 3 段/.test(d.提示()), d.提示());
  const e = await 开框();
  await e.拖(0, 0, 1, 6, '整行');
  const b = e.保存();
  Z.判('11 两端都落在行元素上（拖到行边上、整行高亮）：按整行首尾算，两头各占一行',
    b.length === 1 && JSON.stringify(b[0].parts) === JSON.stringify([{ pid:'p1', from:0, to:6 }, { pid:'p2', from:0, to:6 }]),
    b[0] && b[0].parts);
}

Z.题('五、拖得不像样子的几种');
{
  const d = await 开框();
  await d.空拖();
  Z.判('12 没选中就点收进关联：不收，提示回到那句教的话', d.保存().length === 0 && /拖鼠标选字/.test(d.提示()), d.提示());
  await d.外拖();
  Z.判('13 选区落在这一屏之外：整趟不算，不收', d.保存().length === 0, d.保存());
  await d.倒拖();
  Z.判('14 起点跑到终点之后：不硬凑片段出来', d.保存().length === 0);
}

Z.题('六、整段那两条路 + 重复挑选');
{
  const d = await 开框();
  await d.双击(1);
  const a = d.保存();
  Z.判('15 双击那一行＝整段收进来（从 0 数到段尾）',
    a.length === 1 && JSON.stringify(a[0].parts) === JSON.stringify([{ pid:'p2', from:0, to:6 }]) && a[0].t === '疑是地上霜。', a[0]);
  Z.判('16 收了就给一声话（不然不知道那一下点到没有）', 托话.some(x => /整段收了进来/.test(x)), 托话);
  const e = await 开框();
  await e.拖(0, 2, 0, 6); 托话.length = 0; await e.拖(0, 2, 0, 6);
  Z.判('17 同一处收两遍：只留一条，并且当场说「这一处已经收过了」',
    e.保存().length === 1 && 托话.some(x => /这一处已经收过了/.test(x)), [e.保存().length, 托话]);
  const f = await 开框();
  await f.拖(0, 2, 0, 6); await f.拖(0, 3, 0, 6);
  const g = f.保存();
  Z.判('18 同一段里挪一个字：算两处（从前整段打勾那把号会把它并成一条）',
    g.length === 2 && g[0].pid === 'p1' && g[1].pid === 'p1'
    && JSON.stringify(g[0].parts) === JSON.stringify([{ pid:'p1', from:2, to:6 }])
    && JSON.stringify(g[1].parts) === JSON.stringify([{ pid:'p1', from:3, to:6 }]), g.map(x => x.parts));
}

Z.题('七、换章和两个出口');
{
  const d = await 开框();
  await d.拖(0, 1, 0, 5);
  await d.切章('chB');
  const a = d.保存();
  Z.判('19 切章：那一屏换成那章的段，已经收进来的那条留着',
    a.length === 1 && a[0].chId === 'chA' && d.行().map(x => x.attrs['data-pid']).join(',') === 'q1',
    [a.map(x => x.chId), d.行().map(x => x.attrs['data-pid'])]);
  await d.拖(0, 0, 0, 3);
  const b = d.保存();
  Z.判('20 切过去之后收的那一条认新章的段号、章名',
    b.length === 2 && b[1].chId === 'chB' && b[1].chTitle === '第二章' && b[1].pid === 'q1'
    && JSON.stringify(b[1].parts) === JSON.stringify([{ pid:'q1', from:0, to:3 }]), b[1]);
  const e = await 开框();
  await e.双击(0);
  e.取消();
  Z.判('21 按取消：那颗出口一条都不交出去（出还是没人交过的那种空）', e.出() === null, e.出());
  const f = await 开框();
  await f.切章('没有这一章');
  Z.判('22 章读不出来时不炸，那一屏给一句实话', /读不出来/.test(f.list.textContent), f.list.textContent);
}

Z.题('八、源码那几笔账（旧那一套不许留一半）');
const 框 = 切(W10, 'bodyPickDlg');
Z.判('23 旧的整段打勾那一框删干净：全仓再没有 paraPickDlg 这个名字',
  !/paraPickDlg/.test(rd('src/_wnw/src/w10-cards.js')) && !/paraPickDlg/.test(rd('src/_wnw/src/w11-board.js'))
  && !/paraPickDlg/.test(rd('src/_wnw/src/w8-write.js')) && !/paraPickDlg/.test(rd('src/_wnw/src/w7-data.js')));
Z.判('24 那颗按钮不再写「段落」写的是「选字」；数目从「N 段」换成「N 处」',
  /icoMarkup\('plus'\) \+ '选字'/.test(W10) && /t\.paras\.length \+ ' 处'/.test(W10) && !/t\.paras\.length \+ ' 段'/.test(W10));
Z.判('25 耳子只挂在这一屏的 mouseup 上，没有 document 的 selectionchange（浮层右上角「关闭」绕过页脚，挂了摘不掉）',
  /list\.addEventListener\('mouseup', readSel\)/.test(框) && !/document\.addEventListener/.test(框));
Z.判('26 去重那把尺用的是新号 linkSig，旧的 chId|pid 那一把已经不在',
  /t\.paras\.map\(linkSig\)/.test(W10) && !/p\.chId \+ '\|' \+ p\.pid/.test(W10));
Z.判('27 段行放开鼠标选字（全局那一身不放开就拖不出字）',
  /\.wnw-bp-p\{[^}]*user-select:text/.test(W10.replace(/\n\s*/g, '')));
Z.判('28 跨段的在关联列表里标「跨 N 段」，整段那条不标',
  /n > 1 \? h\('span', \{ class:'wnw-hint' \}, '跨 ' \+ n \+ ' 段'\)/.test(W10));
Z.判('29 偏移那一头有两个来源都要认：文本节点用它的偏移，行元素按行首行尾算',
  /if\(tn && n === tn\) return Math\.max\(0, Math\.min\(at, len\)\)/.test(框) && /return at <= 0 \? 0 : len/.test(框));
Z.判('30 一条待办上的关联正文过 w7-data 那道闸，读出来带 parts（不是只带段号）',
  /parts/.test(切(W7, 'trackTodos')));

Z.收尾();
