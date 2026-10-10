/* 乙组自检（外29 第 51 轮）：正文那两处 —— 聚焦不许隔离、Ctrl+A 要能选整章。
   他给的原话：「让你聚焦没让你隔离！」「为什么 ctrl a 只能选一段选不了全文？」
   跑的是真源码：CSS 那两条、FocusLook 那一个对象、CeEd 里那一支 Ctrl+A，全从文件里原样搬进沙箱，不抄第二份。 */
import fs from 'node:fs';
import vm from 'node:vm';

const W8 = fs.readFileSync('D:/Programs/Flow-Desk/src/_wnw/src/w8-write.js', 'utf8');
const W3 = fs.readFileSync('D:/Programs/Flow-Desk/src/_wnw/src/w3-shell.js', 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if(c){ pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (extra ? ' · ' + extra : '')); } };

/* ---------- 一、出厂不描边（样式层） ---------- */
const css = /\/\* 段落聚焦的长相五项[\s\S]*?\n\.wnw-ce:focus[^}]*}/.exec(W8);
ok('1 段落聚焦那一条 CSS 找到了（找不到就说明它改名或挪了，这台跟着改）', !!css);
ok('2 描边宽度兜的是 0，不是 1px —— 一段不被画个框摆在那儿', /outline:var\(--fc-bw,0\)/.test(css ? css[0] : ''), css ? css[0].slice(0, 120) : '');
ok('3 底色出厂还是留空（不填满整段），文字色也没动', /background:var\(--fc-bg,transparent\)/.test(css ? css[0] : '') && /color:var\(--fc-text,inherit\)/.test(css ? css[0] : ''));
const def = /const FOCUS_DEF = \{[^}]*\}/.exec(W8);
ok('4 出厂那五项：边框粗细 0（要框的人自己拉回来），其余四项照旧留空',
  !!def && /bw:0/.test(def[0]) && /text:''/.test(def[0]) && /bg:''/.test(def[0]) && /bd:''/.test(def[0]), def ? def[0] : '没抓到 FOCUS_DEF');
ok('5 那一档没被撤：设置里的边框粗细滑块还是 0~6 给拉（不画框是出厂，不是不许画）',
  /fcSlide\('bw', 0, 6\)/.test(W3) && /fcSlide\('r', 0, 24\)/.test(W3));

/* ---------- 二、FocusLook 真跑：出厂写空、拉回 2 又写回来 ---------- */
const apply = (() => { const i = W8.indexOf('  apply(){', W8.indexOf('const FocusLook')); let d = 0, j = W8.indexOf('{', i);
  for(let k = j; k < W8.length; k++){ if(W8[k] === '{') d++; else if(W8[k] === '}'){ d--; if(!d) return W8.slice(i, k + 1); } } throw new Error('FocusLook.apply 花括号没配平'); })();
/* FOCUS_DEF 那一项一项抠出来（不用 eval：拿字符串当代码跑，改一个字就可能悄悄跑别的东西） */
const defObj = {};
for(const m of def[0].matchAll(/(\w+)\s*:\s*('([^']*)'|[\d.]+)/g)) defObj[m[1]] = m[2][0] === "'" ? m[2].slice(1, -1) : Number(m[2]);
function run(st){
  const box = { style:{ props:{}, setProperty(k, v){ this.props[k] = v; } } };
  const ctx = { console, FOCUS_DEF:defObj, Object, String, Number };
  vm.createContext(ctx);
  ctx.__r = box;
  /* 那一个函数要问容器要一枚能写样式的节点：给它一个假的，函数体一个字不改 */
  vm.runInContext('const wnwRoot = () => globalThis.__r;\nglobalThis.__o = { ' + apply + ' };', ctx);
  ctx.__o.st = st; ctx.__o.apply();
  return box.style.props;
}
const p0 = run({ text:'', bg:'', bd:'', bw:0, r:8 });
ok('6 出厂那一趟：--fc-bw 被摘掉（写空串），于是 CSS 兜的 0 顶上来 → 界面上没有那一圈框',
  p0['--fc-bw'] === '', JSON.stringify(p0));
const p2 = run({ text:'', bg:'', bd:'', bw:2, r:8 });
ok('7 他把粗细拉到 2 那一趟：变量真写出去了（2px），那一项能力还在', p2['--fc-bw'] === '2px', JSON.stringify(p2));

/* ---------- 三、Ctrl+A 那一支：位置 + 真跑 ---------- */
const ce0 = W8.indexOf('class CeEd'), pe0 = W8.indexOf('class ParaEd');
const iKey = W8.indexOf("if(mod && k === 'a' && !e.altKey && !e.shiftKey){");
ok('8 Ctrl+A 那一支落在正文那一家（CeEd）里面，章纲和笔记那一家（ParaEd）没被牵连',
  iKey > ce0 && (pe0 < ce0 || iKey > pe0), 'CeEd 在 ' + ce0 + '、ParaEd 在 ' + pe0 + '、那一支在 ' + iKey);
ok('9 只有一段时不插手（浏览器自己那条就是全选），两段以上才铺满', /if\(els\.length < 2\) return;/.test(W8));

const branch = (() => { let d = 0, j = iKey + 3;
  for(let k = W8.indexOf('{', iKey); k < W8.length; k++){ if(W8[k] === '{') d++; else if(W8[k] === '}'){ d--; if(!d) return W8.slice(iKey, k + 1); } }
  throw new Error('Ctrl+A 那一支花括号没配平'); })();
function tryAll(rows){
  let prevented = false; const ranges = [];
  const el = t => ({ tag:t, childNodes:{ length:2 } });
  const rs = rows.map(t => ({ el:el(t) }));
  const ctx = { console, e:{ preventDefault(){ prevented = true; } }, mod:true, k:'a',
    document:{ contains:() => true, createRange:() => ({ setStart(a, b){ this.s = [a, b]; }, setEnd(a, b){ this.e2 = [a, b]; },
      get startEl(){ return this.s && this.s[0]; }, get endEl(){ return this.e2 && this.e2[0]; } }) },
    window:{ getSelection:() => ({ removeAllRanges(){}, addRange(r){ ranges.push(r); } }) },
    __rows:rs };
  vm.createContext(ctx);
  /* 那一支原样搬进来，外面只套一层能跑的外壳（return 在顶层不合法），函数体一个字不改 */
  vm.runInContext('const this2 = { rows:__rows };\nglobalThis.__f = function(){ ' + branch.replace(/\bthis\./g, 'this2.') + ' };', ctx);
  ctx.__f();
  return { prevented, ranges };
}
const one = tryAll(['甲']);
ok('10 一段的时候没抢浏览器那条（不 preventDefault、也不设范围）', !one.prevented && one.ranges.length === 0);
const three = tryAll(['甲', '乙', '丙']);
ok('11 三段的时候抢下来并铺满：preventDefault 调了、范围交出去了', three.prevented && three.ranges.length === 1);
ok('12 范围是从第一段开头到第三段末尾（不是只到第二段 —— 选完再删才不会剩一截）',
  three.ranges.length === 1 && three.ranges[0].startEl.tag === '甲' && three.ranges[0].endEl.tag === '丙',
  three.ranges.length ? String(three.ranges[0].startEl.tag) + ' → ' + String(three.ranges[0].endEl.tag) : '没交范围');

console.log('\n' + pass + ' 过 ' + fail + ' 不过');
process.exit(fail ? 1 : 0);
