/* 戊组自检（外29 第 53 轮）：日程卡大卡那两档「显眼 / 详细」。
   作者的话：「日程样式对了，就是不够显眼 / 卡片小时可以这样简略，大时做一档/几档显眼/详细一些的展示」
   —— 所以第一档（出厂 7 × 8）一个字不许动，放大只发生在手拉大之后。
   这一台整份组件源码搬进 vm 跑真函数（tierOf / laneMax / packLanes / monthGrid / ganttBar），
   不另抄第二份；样式层那半生成一份页面（同目录 mk-schtier-test.html），我自己开探针浏览器量计算值。 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = 'D:/Programs/Flow-Desk';
const SRC = fs.readFileSync(path.join(ROOT, 'data/plugins/schedule/main.js'), 'utf8');
const SHELL = fs.readFileSync(path.join(ROOT, 'src/_fd/src/fd3-shell.js'), 'utf8');
const YAML = fs.readFileSync(path.join(ROOT, 'data/card-size.yaml'), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if(c){ pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (extra ? ' · ' + extra : '')); } };

/* ---------- 一、整份组件源码进 vm，拿真函数跑 ---------- */
function fakeEl(){
  const mk = (tag, props, kids) => {
    const n = { tag, class:props && props.class || '', style:{}, attrs:{}, kids:[], text:'', onclick:null };
    Object.defineProperty(n.style, 'setProperty', { value:(k, v) => { n.style[k] = v; }, enumerable:false });
    n.appendChild = (x) => { n.kids.push(x); return x; };
    if(props) for(const k in props){ if(k === 'class' || k === 'style' || k === 'kids') continue;
      if(k === 'html') n.html = props[k];
      else if(k === 'onclick') n.onclick = props[k];
      else if(k === 'text') n.text = props[k];
      else n.attrs[k] = props[k]; }
    if(props && typeof props.style === 'string') n.styleText = props.style;
    if(props && props.text !== undefined && kids === undefined) n.text = props.text;
    const list = kids === undefined ? (props && Array.isArray(props.kids) ? props.kids : []) : kids;
    (Array.isArray(list) ? list : [list]).filter(Boolean).forEach(x => n.appendChild(typeof x === 'string' || typeof x === 'number' ? { tag:'#t', text:String(x) } : x));
    return n;
  };
  return mk;
}
const el = fakeEl();
const walk = (n, out = []) => { if(!n) return out; out.push(n); (n.kids || []).forEach(k => walk(k, out)); return out; };
const cls = (n) => ' ' + String(n.class || '') + ' ';
const find = (root, c) => walk(root).filter(n => cls(n).includes(' ' + c + ' '));
const txt = (n) => walk(n || { kids:[] }).filter(x => x.tag === '#t').map(x => x.text).join('');
const MOD = SRC.replace(/^export default \{/m, 'const EXP = {') +
  '\n;this.__x = { tierOf, laneMax, packLanes, monthGrid, ganttBar, dayNum, weekRow, TIERS, LANE_MAX, MONTH_MIN_ROWS, SCH_CSS, EXP };';
const pad2 = n => String(n).padStart(2, '0');
/* 宿主那一包东西的替身：只给这一台真要走到的那几件，名字和签名照真的给（组件吃的是 P.fmtDate 这一类） */
const HOST = { el, settings:{ get:(k, d) => d }, icon:() => '',
  fmtDate:(d) => { const x = new Date(d); return x.getFullYear() + '-' + pad2(x.getMonth() + 1) + '-' + pad2(x.getDate()); },
  parseDate:(v) => new Date(String(v) + 'T00:00:00'),
  addDays:(d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; },
  toast(){}, store:{ get:() => null, set:() => Promise.resolve() }, bus:{ on(){}, emit(){}, map:{} },
  dialog:{ open(){}, close(){} }, ask:() => Promise.resolve(true), theme:{}, palette:{}, slotColor:() => '#c0552e', fitBox(){} };
const sb = { console, JSON, Math, Number, String, Array, Object, Boolean, Date, RegExp, isNaN, parseInt, parseFloat, el, HOST, pad2 };
vm.createContext(sb);
vm.runInContext(MOD, sb);
/* 插件自己那句 `let P = null` 是顶层词法绑定，会把沙箱上的同名属性盖掉 ——
   所以这份「宿主给插件的那一包东西」得在虚拟机里头交给它，跟真机上 init(ctx) 那一手同一个位置。 */
vm.runInContext('P = HOST;', sb);
const X = vm.runInContext('__x', sb);
ok('0 整份组件源码搬进虚拟机跑通了（顶层没一条语句抛错，导出的那几件真东西都在）',
  !!X && typeof X.tierOf === 'function' && typeof X.monthGrid === 'function' && Array.isArray(X.TIERS) && X.TIERS.length === 3,
  X ? Object.keys(X).join(',') : '没拿到');

/* ---------- 二、档的判定：吃的是卡片自己占的那一格 ---------- */
ok('1 出厂那一张（7 × 8 = 56 格）还是第一档，简略版一个字不动', X.tierOf(7, 8) === 0, '实得 ' + X.tierOf(7, 8));
ok('2 拉大才升档：12 × 13（156 格）第二档、16 × 19（304 格）第三档',
  X.tierOf(12, 13) === 1 && X.tierOf(16, 19) === 2, X.tierOf(12, 13) + ' / ' + X.tierOf(16, 19));
ok('3 只宽不高不算大卡：38 × 8（同样是 304 格）留在第一档 —— 条跟着行高长，硬放大只会挤掉行',
  X.tierOf(38, 8) === 0 && X.tierOf(20, 10) === 1, '38×8→' + X.tierOf(38, 8) + ' · 20×10→' + X.tierOf(20, 10));
ok('4 三档的轨道上限一路放开：10 → 12 → 14（小卡那 10 行封顶没改）',
  X.laneMax(0) === X.LANE_MAX && X.laneMax(1) === X.LANE_MAX + 2 && X.laneMax(2) === X.LANE_MAX + 4,
  [X.laneMax(0), X.laneMax(1), X.laneMax(2)].join(' → '));
/* 可达性：拿两份真数代一遍（日程自己那张出厂大小、外壳那三个常量），不许是自造的假场景 */
const GC = Number(/const GRID_COLS = (\d+), GRID_ROWS = (\d+)/.exec(SHELL)[1]);
const GR = Number(/const GRID_COLS = \d+, GRID_ROWS = (\d+)/.exec(SHELL)[1]);
const EA = Number(/const EXPAND_AREA = ([\d.]+)/.exec(SHELL)[1]);
const EXPAND_AT = GC * GR * EA;
const factory = (() => { const seg = /日程:\n\s+出厂: *(\d+) *× *(\d+)/.exec(YAML); return seg ? (+seg[1]) * (+seg[2]) : -1; })();
ok('5 这两档出厂走得到的路上摆（日程出厂 ' + factory + ' 格 < 150 < 300 < 放大那一条闸 ' + EXPAND_AT + ' 格，桌面共 ' + GC + ' × ' + GR + '）',
  factory === 56 && X.TIERS[1].at > factory && X.TIERS[2].at < EXPAND_AT && X.TIERS[2].at <= GC * GR, factory + ' / ' + EXPAND_AT);
ok('6 判定只吃 C.item 那一格，没有第二套量像素的口径',
  /tierOf\(C\.item\.w, C\.item\.h\)/.test(SRC) && !/getBoundingClientRect\(\)\.width *>=? *\d+.*tier/i.test(SRC));

/* ---------- 三、轨道：同一堆压在一起的日程，小卡藏起来、大卡摆出来 ---------- */
const wide = (n) => Array.from({ length:n }, (_, i) => ({ l:0, r:6 }));
const L0 = X.packLanes(wide(13)), L2 = X.packLanes(wide(13), X.laneMax(2));
const hasFake = (lanes) => lanes.some(ln => ln.some(b => b.it && b.it.fake));
ok('7 十三行压在一起的日程：第一档藏到「+n」那一行（' + L0.length + ' 行，末尾那行是 +n），第三档铺满不藏（' + L2.length + ' 行）',
  L0.length === X.LANE_MAX && hasFake(L0) && L2.length === 13 && !hasFake(L2), L0.length + ' / ' + L2.length);
ok('8 第一档那头一个字节没动：packLanes 不传上限时吃的是原来那个 LANE_MAX',
  X.packLanes(wide(20)).length === X.LANE_MAX);

/* ---------- 四、两档各多出来什么（真画一遍月历） ---------- */
const s = { items:[
    { id:'a', title:'写第三卷', start:'2026-10-01', end:'2026-10-05', slot:1, tags:['t1'],
      children:[{ id:'a1', title:'草稿', start:'2026-10-01', end:'2026-10-02', done:true },
                { id:'a2', title:'改', start:'2026-10-03', done:false },
                { id:'a3', title:'定', start:'2026-10-04', progress:50 },
                { id:'a4', title:'交', start:'2026-10-05', done:true }] }],
  tags:[{ id:'t1', name:'写作', color:'#c0552e' }] };
const C = { el, settings:{ get:(k, d) => d }, icon:() => '', slotColor:() => '#c0552e' };
const weeks = [[null, null, null, null, null, null, null],
  [new Date(2026, 9, 1), new Date(2026, 9, 2), new Date(2026, 9, 3), new Date(2026, 9, 4), new Date(2026, 9, 5), new Date(2026, 9, 6), new Date(2026, 9, 7)]];
const g0 = X.monthGrid(s, C, weeks, 0), g2 = X.monthGrid(s, C, weeks, 2);
const pct = (n) => txt(find(n, 'sch-pct')[0]);
const tagNames = (n) => find(n, 'sch-tag').map(txt).join('|');
const dots = (n) => find(n, 'sch-dot').length;
const cnts = (n) => find(n, 'sch-cnt').length;
ok('9 第一档：条上只有百分数（"' + pct(g0) + '"）、标签是圆点（' + dots(g0) + ' 枚）、没有当天条数 —— 出厂样子没动',
  pct(g0) === '63%' && dots(g0) === 1 && cnts(g0) === 0 && tagNames(g0) === '' && find(g0, 'sch-tag').length === 0,
  pct(g0) + ' / dot ' + dots(g0) + ' / cnt ' + cnts(g0));
ok('10 第三档：百分数后面补上「完成几 / 共几 项」（"' + pct(g2) + '"）',
  pct(g2) === '63% · 2/4 项', pct(g2));
ok('11 第三档：标签由圆点换成带名字的短签，名字就是标签自己那个（"' + tagNames(g2) + '"）',
  tagNames(g2) === '写作' && dots(g2) === 0, tagNames(g2) + ' / dot ' + dots(g2));
ok('12 第三档：每一天在日期号后面写当天压着几条（十月初那几天各 1 条）',
  cnts(g2) === 5, '实得 ' + cnts(g2) + ' 枚');
ok('13 第二档只放大、不加字：既不写「x/y 项」也不写当天条数', (() => {
  const g1 = X.monthGrid(s, C, weeks, 1);
  return pct(g1) === '63%' && cnts(g1) === 0 && find(g1, 'sch-tag').length === 0 && find(g1, 'sch-dot').length === 1; })());
ok('14 放大系数只从一个名字走：壳里三处（条上的字、色位圆点的宽、高），组件里六处（日期号、星期抬头、当天条数、短签的字、短签前那枚色点的宽高）',
  (SHELL.match(/var\(--sch-big,1\)/g) || []).length === 3 && (SRC.match(/var\(--sch-big,1\)/g) || []).length === 6,
  '壳 ' + (SHELL.match(/var\(--sch-big,1\)/g) || []).length + ' · 组件 ' + (SRC.match(/var\(--sch-big,1\)/g) || []).length);
ok('15 那两档的放大数只写在一处（组件那份 SCH_CSS 里两条），外壳里一个具体数都没有',
  (SRC.match(/--sch-big:1\.\d+;/g) || []).length === 2 && !/--sch-big:/.test(SHELL));

/* ---------- 五、样式层那份页面（真浏览器量计算值，两份 CSS 都从原文件搬，没手抄） ---------- */
const barRule = /\.sch-bar\{[^}]*\}/.exec(SHELL)[0];
const dotRule = /\.sch-dot\{[^}]*\}/.exec(SHELL)[0];
const css = barRule + '\n' + dotRule + '\n' + X.SCH_CSS;
const opens = (css.match(/\{/g) || []).length, closes = (css.match(/\}/g) || []).length;
ok('16 搬进页面的样式花括号配平（' + opens + ' 开 ' + closes + ' 闭）—— 配不平浏览器会成片吞规则，量到的全是假的',
  opens === closes && opens > 12);
const one = (t) => '<div class="' + t + '" style="width:420px"><div class="sch-bar" style="position:relative;background:#eee">' +
  '<span>写第三卷</span><i class="sch-pct">50%</i><i class="sch-dot" style="background:#c0552e"></i>' +
  '<span class="sch-tag" style="--c:#c0552e">写作</span></div></div>';
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'mk-schtier-test.html');
fs.writeFileSync(out, '<!doctype html><meta charset="utf-8"><title>戊组 · 大卡两档</title>' +
  /* <style> 必须排在 <script> 前面：脚本在样式进层之前跑，量到的每一条都是没放大那一版（丙组刚踩过） */
  '<style>:root{--text:#222;--text-light:#777;--accent:#2e7d6b;--fit:1;--vsc:1}' + css + '</style>' +
  '<body style="font-size:16px">' + one('') + one('sch-t2') + one('sch-t3') +
  '<script>function fs(s){return getComputedStyle(document.querySelector(s)).fontSize}' +
  'function w(s){const e=document.querySelector(s);return e?getComputedStyle(e).width:"没这个元素"}' +
  'window.R={t1:{bar:fs("body > div:nth-child(1) .sch-bar"),dot:w("body > div:nth-child(1) .sch-dot")},' +
  't2:{bar:fs("body > div:nth-child(2) .sch-bar"),dot:w("body > div:nth-child(2) .sch-dot"),tag:fs("body > div:nth-child(2) .sch-tag")},' +
  't3:{bar:fs("body > div:nth-child(3) .sch-bar"),dot:w("body > div:nth-child(3) .sch-dot"),tag:fs("body > div:nth-child(3) .sch-tag")},' +
  'big:[...document.querySelectorAll("body > div")].map(d=>getComputedStyle(d).getPropertyValue("--sch-big").trim() || "1")};' +
  'document.title=JSON.stringify(window.R);<\/script>');
ok('17 样式层那份页面生成了（壳里 .sch-bar / .sch-dot 两条 + 组件整份 SCH_CSS 原样搬）', fs.existsSync(out), out);

/* ---------- 六、这一家自己那份样式里，没有一条是挂了名字没人用的 ---------- */
const CSS_BLOCK = /const SCH_CSS = `([\s\S]*?)`;/.exec(SRC)[1];
const OUTSIDE = SRC.split(CSS_BLOCK).join('');   /* 把样式那一摞本身剔掉，剩下的部分才说明"有没有人挂" */
const sels = [...new Set((CSS_BLOCK.match(/\.[a-z][-\w]*/g) || []).map(x => x.slice(1)).filter(x => /^sch-/.test(x)))];
const unused = sels.filter(x => !OUTSIDE.includes(x));
ok('18 组件那份样式里 ' + sels.length + ' 条 .sch-* 全在源码里被挂出去过（没人用 ' + unused.length + ' 条：' + unused.join(',') + '）',
  sels.length >= 9 && unused.length === 0, unused.join(','));

console.log('\n' + pass + ' 过 ' + fail + ' 不过');
console.log('样式层那半我自己开探针浏览器量（绝不动他正开着那一家）：' + out);
console.log('  读 window.R：bar 字号 / 圆点宽 / 短签字号 三档应当是 1 : 1.18 : 1.34 的比，big 数组 = ["1","1.18","1.34"]');
process.exit(fail ? 1 : 0);
