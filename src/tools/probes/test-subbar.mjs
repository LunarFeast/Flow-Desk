/* 多级日程的画法自检（外29 第 42 轮重写）：把 schedule 组件里那几个真函数抠进沙箱跑，不抄第二份。
   上一版这台断言的是「子日程各占一条粗条」—— 那正是作者这一轮驳回的画法，所以断言跟着换成他那句话：
     只有最下级那一档是细条（一笔没动浅、做完深）；但凡底下还有子日程，这一条就走父日程外观
     （整条浅色 + 开头一道深色竖线 + 文字后一枚完成度），下级挤在这一条自己那一整段里当细条。
   三层证据：函数层（weekBars / subFracs / nodeProgress）、画法层（真 ganttBar + 真 subInBar 长出的 DOM）、
   接线层（SCH_CSS 里每一条 .sch-* 都被真写过 —— 选择器没人挂就等于没画）。 */
import fs from "node:fs";
import vm from "node:vm";

const FILE = "D:/Programs/Flow-Desk/data/plugins/schedule/main.js";
const src = fs.readFileSync(FILE, "utf8");
function grab(name){
  const i = src.indexOf("function " + name + "(");
  if(i < 0) throw new Error("找不到 " + name);
  let d = 0, j = src.indexOf("{", i);
  for(let k = j; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}'){ d--; if(!d) return src.slice(i, k + 1); }
  }
  throw new Error(name + " 花括号没配平");
}

/* ---------- 画法层要的那台假 DOM（只假到"能长出棵树"，函数体全是真的） ---------- */
function fakeEl(){
  let seq = 0;
  return function h(tag, attrs, kids){
    const n = { node:++seq, tag, attrs:attrs || {}, kids:[], text:'', style:{} };   /* style 这一层照真 DOM 给：组件往下头补让出的高度 */
    if(typeof kids === 'string' || typeof kids === 'number') n.text = String(kids);
    else if(Array.isArray(kids)) n.kids = kids.filter(Boolean).map(k => typeof k === 'string' ? { tag:'text', text:k, kids:[] } : k);
    else if(kids && typeof kids === 'object') n.kids = [kids];
    n.appendChild = c => { if(c) n.kids.push(c); return n; };
    return n;
  };
}
const cls = n => String((n.attrs && n.attrs.class) || '');
const walkAll = (n, out = []) => { out.push(n); for(const k of n.kids || []) walkAll(k, out); return out; };
const findCls = (n, c) => walkAll(n).some(x => cls(x).split(/\s+/).includes(c));
const byCls = (n, c) => walkAll(n).filter(x => cls(x).split(/\s+/).includes(c));

const ctx = { console, Date, Math, Number, String, Array, Object, JSON, RegExp };
vm.createContext(ctx);
vm.runInContext([
  "function dstr(d){ const p = n => String(n).padStart(2,'0'); return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate()); }",
  /* 组件里那个「最多几排」的数照原文搬进来，不在探针里再抄一遍数；它改名了就当场崩，不许拿探针里的假数继续绿 */
  (() => { const m = /const SUB_ROWS = \d+;/.exec(src); if(!m) throw new Error('组件里找不到 SUB_ROWS 这个数了'); return m[0]; })(),
  grab("nodeRange"), grab("nodeProgress"), grab("weekBars"), grab("subFracs"), grab("tagOf"), grab("barTitle"),
  "function barTint(){ return 'tint'; } function barText(){ return 'ink'; }",
  "const __ed = []; globalThis.__ed = __ed;",
  "function editNode(s, C, day, n){ __ed.push((n && n.title) + '@' + day); }",
  "function openDayDetail(){ __ed.push('day-detail'); }",
  "function ic(){ return ''; }",
  grab("subInBar"), grab("ganttBar"),
  "globalThis.__t = { weekBars, nodeRange, nodeProgress, ganttBar, subInBar };"
].join("\n"), ctx);
const { weekBars, nodeRange, nodeProgress, ganttBar } = ctx.__t;
const edited = ctx.__ed;

let pass = 0, fail = 0;
const ok = (n, c, extra) => { if(c){ pass++; console.log("  PASS " + n); } else { fail++; console.log("  FAIL " + n + (extra ? " · " + extra : "")); } };

/* ---------- 一、函数层：月格里只铺最上面那一层 ---------- */
const 父 = { title:'2222', start:'2026-10-03', end:'2026-10-10', progress:50, done:false, tags:[], children:[
  { title:'2323',   start:'2026-10-03', end:'2026-10-07', done:true,  progress:0, tags:[], children:[] },
  { title:'456789', start:'2026-10-03', end:'2026-10-10', done:false, progress:0, tags:[], children:[] }
]};
const s = { items:[父], tags:[] };
const wk = [3,4,5,6,7,8,9].map(n => new Date(2026, 9, n));
const bars = weekBars(s, wk, '2026-10-03', '2026-10-09');
const P0 = bars[0];
console.log("抠出来的真函数摆出来：" + bars.length + " 条，条里细条 " + (P0.subs || []).length + " 根");

ok("1 月格里只顶层占条：这一章就 1 条，2323 / 456789 不再各自摊成粗条",
   bars.length === 1 && P0.it.title === '2222');
ok("2 父条占的是并出来的那一整段（10-03 → 10-09 截断，右边露出「还没完」）",
   P0.l === 0 && P0.r === 6 && P0.openR === true, P0.l + '~' + P0.r + ' openR=' + P0.openR);
ok("3 下级进这一条自己那一整段当细条：两根", (P0.subs || []).length === 2);
const sb1 = P0.subs[0], sb2 = P0.subs[1];
ok("4 细条按各自日期实际铺开：2323（10-03→10-07）占父条宽度的 0~5/7，456789（10-03→10-10）占满 0~1 —— 长短看得出来不一样",
   Math.abs(sb1.a - 0) < 1e-9 && Math.abs(sb1.b - 5/7) < 1e-9 && Math.abs(sb2.a) < 1e-9 && Math.abs(sb2.b - 1) < 1e-9,
   sb1.a.toFixed(3) + '~' + sb1.b.toFixed(3) + ' / ' + sb2.a.toFixed(3) + '~' + sb2.b.toFixed(3));
ok("5 勾了的那个下级自己 100%、没勾的 0%（最下级那一档就是靠这两个数分深浅）",
   nodeProgress(sb1.it) === 100 && nodeProgress(sb2.it) === 0);

/* 跨到下一周：下级夹到父条边上，露头的记号只在父条上 */
const wk2 = [5,6,7,8,9,10,11].map(n => new Date(2026, 9, n));
const b2 = weekBars(s, wk2, '2026-10-05', '2026-10-11');
ok("6 换到下一周还是只 1 条，且这条左边露出「前面还有」", b2.length === 1 && b2[0].openL === true && b2[0].l === 0);
const q1 = b2[0].subs[0];
ok("7 2323 在这一周只剩 10-05~10-07 那一截：父条被截成 6 格宽（10-05~10-10），所以它占 0~3/6 = 0.5（比例是按父条那一段算，不是整周）",
   Math.abs(q1.a) < 1e-9 && Math.abs(q1.b - 0.5) < 1e-9, q1.a.toFixed(3) + '~' + q1.b.toFixed(3));

/* 他给的递归样例：1 管 11/12/13/14，每个又管 111-114…，其中 114 / 124 / 134 / 144 未完成 → 全是 75% */
const leaf = (t, done) => ({ title:t, start:'2026-10-03', end:'2026-10-03', done, progress:0, tags:[], children:[] });
const mid = (t, k) => ({ title:t, start:'2026-10-03', end:'2026-10-03', done:false, progress:0, tags:[],
  children:[ leaf(t+'1', true), leaf(t+'2', true), leaf(t+'3', true), leaf(t+'4', false) ] });
const top75 = { title:'1', start:'2026-10-03', end:'2026-10-03', done:false, progress:0, tags:[],
  children:[ mid('11'), mid('12'), mid('13'), mid('14') ] };
ok("8 他那张 75% 表：1 → 75%、11 → 75%、111 → 100%",
   nodeProgress(top75) === 75 && nodeProgress(top75.children[0]) === 75 && nodeProgress(top75.children[0].children[0]) === 100,
   nodeProgress(top75) + ' / ' + nodeProgress(top75.children[0]) + ' / ' + nodeProgress(top75.children[0].children[0]));

/* ---------- 二、画法层：真 ganttBar 长出来的 DOM ---------- */
const C = { el:fakeEl(), icon:() => '' };
const barNode = ganttBar(s, C, P0, 1);
const pn = byCls(barNode, 'sch-bar')[0];
ok("9 底下有人的那一条吃父日程外观：class 带 parent（那道深色竖线和整条浅色归它）",
   !!pn && cls(pn).split(/\s+/).includes('parent'), pn ? cls(pn) : '没长出 .sch-bar');
const pct = byCls(barNode, 'sch-pct');
ok("10 父日程文字后面那一枚完成度小标签写的是 50%（它自己那一段不拿深色压在字底下）",
   pct.length === 1 && pct[0].text === '50%', pct.length + ' 枚 / ' + (pct[0] || {}).text);
ok("11 父条里没有 .sch-fill 那一截深色", !findCls(barNode, 'sch-fill'));
const inb = byCls(barNode, 'sch-inbar');
ok("12 条底那一排细条在：.sch-inbar 里两根 i", inb.length === 1 && inb[0].kids.length === 2,
   inb.length + ' 个 / ' + (inb[0] ? inb[0].kids.length : 0) + ' 根');
const thin = inb[0] ? inb[0].kids : [];
ok("13 最下级那根勾了的 → class 带 full（整根深色）；没勾的那根既不满、底下也没人 → 不带 full 也不带 has",
   cls(thin[0]).split(/\s+/).includes('full') && !cls(thin[1]).split(/\s+/).includes('full') && !cls(thin[1]).split(/\s+/).includes('has'),
   cls(thin[0]) + ' / ' + cls(thin[1]));
const midBars = ganttBar({ items:[top75], tags:[] }, C, weekBars({ items:[top75], tags:[] }, wk, '2026-10-03', '2026-10-09')[0], 1);
const midThin = (byCls(midBars, 'sch-inbar')[0] || { kids:[] }).kids;
ok("14 1 的四个下级 11/12/13/14 自己底下也有人 → 四根都带 has（吃父外观的缩影：一道深色小竖线）、一根都不带 full（各自 75%）",
   midThin.length === 4 && midThin.every(x => cls(x).split(/\s+/).includes('has') && !cls(x).split(/\s+/).includes('full')),
   midThin.length + ' 根 / ' + midThin.map(x => cls(x)).join(' | '));
ok("15 中间那一档的细条里头填到 75%：有一根 b，宽度写着 75%",
   walkAll(midThin[0]).some(x => x.tag === 'b' && /width:75%/.test(String(x.attrs.style || ''))),
   JSON.stringify(midThin.map(x => cls(x))));
ok("20 细条只铺直接下级这一层：第三级不再往里塞（一根 has 的细条底下没有第二个 .sch-inbar）",
   !findCls(midThin[0], 'sch-inbar'));

/* 顶层没下级的那一条：还是整条双色，不吃 parent */
const only = { items:[{ title:'一个人的', start:'2026-10-04', end:'2026-10-04', done:false, progress:40, tags:[], children:[] }], tags:[] };
const ob = weekBars(only, wk, '2026-10-03', '2026-10-09');
const oneNode = ganttBar(only, C, ob[0], 1);
ok("16 底下没人的那一条：不带 parent、没有小标签，条里那一截深色按自己的 40% 填",
   !cls(byCls(oneNode, 'sch-bar')[0]).split(/\s+/).includes('parent') && !findCls(oneNode, 'sch-pct') &&
   walkAll(oneNode).some(x => cls(x).split(/\s+/).includes('sch-fill') && /width:40%/.test(String(x.attrs.style || ''))));

/* 点细条要走的是那一条子日程的编辑窗 */
const click = thin[1].attrs.onclick;
click({ stopPropagation(){} });
ok("17 点一根细条 = 开这一条子日程自己的编辑窗（不是开父级、也不是绕到树视图）",
   edited.length === 1 && /^456789@/.test(edited[0]), JSON.stringify(edited));

/* ---------- 三、接线层：SCH_CSS 里那几条选择器，页面真挂出去了没有 ---------- */
const cssBlock = /const SCH_CSS = `([\s\S]*?)`;/.exec(src);
ok("18 组件里找得到 SCH_CSS 那一块", !!cssBlock);
if(cssBlock){
  const body = cssBlock[1].replace(/\/\*[\s\S]*?\*\//g, ' ');
  const sels = [...new Set([...body.matchAll(/\.([a-z][\w-]*)/g)].map(x => x[1]))];
  /* 挂没挂出去：把 SCH_CSS 那一块自己挖掉，剩下的源码里有没有一段引号里写着这个名字
     （`class:'sch-bar …'`、`+ (kids.length ? ' parent' : '')` 这两种写法都算） */
  const bare = src.replace(cssBlock[0], ' ');
  const 没挂 = sels.filter(c => !new RegExp("['\"][^'\"]*\\b" + c + "\\b[^'\"]*['\"]").test(bare));
  ok("19 SCH_CSS 里 " + sels.length + " 条选择器全部在 main.js 里被挂出去过（没人挂的那条等于没画）",
     没挂.length === 0, 没挂.join(' '));
}

/* ---------- 四、条底细条撞在同一头上不许叠成一坨（2026-10-07 真页面上量到的） ---------- */
const same = { title:'同头', start:'2026-10-03', end:'2026-10-10', tags:[], children:[
  { title:'a', start:'2026-10-05', end:'2026-10-10', done:false, progress:0, tags:[], children:[] },
  { title:'b', start:'2026-10-05', end:'2026-10-10', done:false, progress:0, tags:[], children:[] },
  { title:'c', start:'2026-10-05', end:'2026-10-10', done:false, progress:0, tags:[], children:[] },
  { title:'d', start:'2026-10-05', end:'2026-10-10', done:false, progress:0, tags:[], children:[] }
]};
const sameBar = ganttBar({ items:[same], tags:[] }, C,
  weekBars({ items:[same], tags:[] }, wk, '2026-10-03', '2026-10-09')[0], 1);
const sameThin = byCls(sameBar, 'sch-inbar')[0];
const bottoms = sameThin.kids.map(x => /bottom:(-?\d+)px/.test(String(x.attrs.style)) ? RegExp.$1 : '0');
ok("21 四根同一段的细条分排往上摞，不再四根都压在 bottom:0",
  sameThin.kids.length === 4 && new Set(bottoms).size > 1, bottoms.join(','));
ok("22 最多三排：第四根并进最后一排（bottom 0 / 3 / 6 / 6 像素）", bottoms.join(',') === '0,3,6,6', bottoms.join(','));
ok("23 排数多了，条底让出来的高度跟着长（细条那一排 8px + 底下留 10px，字压不上去）",
  /height:8px/.test(String(sameThin.attrs.style)) && sameBar.style.paddingBottom === '10px',
  String(sameThin.attrs.style) + ' / ' + sameBar.style.paddingBottom);
const spread = { title:'分开', start:'2026-10-03', end:'2026-10-05', tags:[], children:[
  { title:'x', start:'2026-10-03', end:'2026-10-03', done:true, progress:0, tags:[], children:[] },
  { title:'y', start:'2026-10-04', end:'2026-10-05', done:false, progress:0, tags:[], children:[] }
]};
const spreadBar = ganttBar({ items:[spread], tags:[] }, C,
  weekBars({ items:[spread], tags:[] }, wk, '2026-10-03', '2026-10-09')[0], 1);
const spreadThin = byCls(spreadBar, 'sch-inbar')[0];
ok("24 不撞的几根仍是一排：都贴在 bottom:0、自己不带高度（吃样式里那 4px 的粗度，没为分排把常态做矮）",
  /height:4px/.test(String(spreadThin.attrs.style)) &&
  spreadThin.kids.every(x => /bottom:0px/.test(String(x.attrs.style)) && !/height:/.test(String(x.attrs.style))),
  String(spreadThin.attrs.style) + ' / ' + spreadThin.kids.map(x => x.attrs.style).join(' | '));
ok("25 底下只有一排的时候不额外加内边距（不吃样式里那 5px 之外的数）",
  String(spreadBar.style.paddingBottom || '') === '', String(spreadBar.style.paddingBottom));
/* 真页面上量到过的一件事：样式里同时写 top:0 和高度，行号是靠 bottom 排出来的 —— 三个都钉住时浏览器忽略 bottom，
   四根细条又叠回同一行。所以这一排的定位只许用 bottom，探针把这条钉死。 */
ok("26 SCH_CSS 里 .sch-inbar>i 不许钉 top（钉了 inline 的 bottom 会被浏览器忽略，分排白做）",
  !/\.sch-inbar>i\{[^}]*top:/.test(cssBlock[1]) && thin.every(x => /bottom:0px/.test(String(x.attrs.style)) || /bottom:\d+px/.test(String(x.attrs.style))),
  /\.sch-inbar>i\{[^}]*\}/.exec(cssBlock[1])[0]);

console.log("\n" + pass + " 过 " + fail + " 不过");
process.exit(fail ? 1 : 0);
