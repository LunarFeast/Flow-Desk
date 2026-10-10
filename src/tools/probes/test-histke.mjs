/* 甲组自检（外29 第 50 轮）：逐字记录到底上没上屏。
   上一版这一屏只有两版快照对照、没动的行折成一句「…… 中间 8 行没动」，
   「放一遍」在两版之间跳 —— 逐字那 120 笔一直在写，可全仓没有一个界面读过它（KLog.decode 只在数笔数时顺手跑一遍）。
   这台断的是：① 每一笔都能拿到"那一笔之后的整章全文"；② 一行都不折；③ 提醒那一栏不许是 0；
   ④ 清理那份排法真的"每一章都留得住"。跑的都是真源码（两份文件整份搬进沙箱），不抄第二份。 */
import fs from 'node:fs';
import vm from 'node:vm';

const KSRC = fs.readFileSync('D:/Programs/Flow-Desk/src/_wnw/src/w20-keystroke.js', 'utf8');
const HSRC = fs.readFileSync('D:/Programs/Flow-Desk/src/_wnw/src/w15-hist.js', 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, extra) => { if(c){ pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (extra ? ' · ' + extra : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- 一、逐字那头：真源码 + 假磁盘 ---------------- */
let buf = '';
const WNW_DATA_PRE = '';
const FD_APP = { appendPageFile:async(rel, t) => { buf += t; },
  readPageFile:async() => buf, pageFileExists:async() => buf.length > 0 };
const kctx = { console, DB:{}, Blob, crypto, TextEncoder, WNW_DATA_PRE, Img:{ dir:() => '测试书' },
  Hist:{ dirOf:ch => WNW_DATA_PRE + '测试书' + '/history/' + ch },
  Work:{ book:{ id:'bk1' } }, location:{ protocol:'fdapp:' }, FD_APP, window:{ FD_APP } };
vm.createContext(kctx);
vm.runInContext(KSRC + '\n;globalThis.__K = KLog;', kctx);
const KLog = kctx.__K;

const CH = 'chA';
let ps = [''], seed = 7; const rnd = () => ((seed = seed * 1103515245 + 12345 & 0x7fffffff) / 0x7fffffff);
const 词 = ['床前', '明月', '光', '，', '疑是', '地上', '霜', 'a\\b', 'x|y'];
async function step(fn){ const was = ps.slice(); fn(); await KLog.diff(CH, was, ps); await sleep(1); }
const type = (pi, w) => step(() => { ps[pi] = (ps[pi] || '') + w; });
const erase = (pi, n) => step(() => { ps[pi] = [...ps[pi]].slice(0, Math.max(0, [...ps[pi]].length - n)).join(''); });
const split = (pi, at) => step(() => { const t = [...ps[pi]].slice(at).join(''); ps[pi] = [...ps[pi]].slice(0, at).join(''); ps.splice(pi + 1, 0, t); });
const join = pi => step(() => { ps[pi - 1] = ps[pi - 1] + ps[pi]; ps.splice(pi, 1); });

await type(0, '床前'); await type(0, '明月'); await type(0, '光'); await split(0, 2);
await type(1, '疑是'); await type(1, '地上'); await type(1, '霜'); await erase(1, 1);
await type(1, '霜'); await join(1); await type(0, '，');

const S = await KLog.steps(CH);
const D = await KLog.decode(CH);
const st2 = await KLog.stats(CH);

ok('1 逐笔那一列真出得来：' + S.steps.length + ' 笔，和数笔数那一条路报的同一个数（' + st2.n + '）',
  S.steps.length === st2.n && S.n === st2.n && st2.n > 0);
ok('2 每一笔都带着"这一笔之后的整章全文"（ps 是数组，不是空）',
  S.steps.every(s => Array.isArray(s.ps) && s.ps.every(x => typeof x === 'string')));
ok('3 最后一笔之后的全文 = 这一章现在的样子（逐笔走到底和整档重放逐字相同）',
  JSON.stringify(S.steps[S.steps.length - 1].ps) === JSON.stringify(D.paras),
  JSON.stringify(S.steps[S.steps.length - 1].ps) + ' vs ' + JSON.stringify(D.paras));
ok('4 插入那一笔标的落点正好是那几个字（界面按 op.pi / op.at 上色，标错就等于骗人）',
  S.steps.filter(s => s.op.ins !== undefined).every(s => {
    const ch = [...(s.ps[s.op.pi] || '')], a = [...String(s.op.ins)].length;
    return ch.slice(s.op.at, s.op.at + a).join('') === String(s.op.ins).replace(/\\\\/g, '\\');
  }));
ok('5 分段 / 合段那两笔：行数跟着变（界面那一行「全文 N 行」吃的就是这个）',
  (() => { const sp = S.steps.findIndex(s => s.op.split), jn = S.steps.findIndex(s => s.op.join);
    return sp > 0 && jn > 0 && S.steps[sp].ps.length === S.steps[sp - 1].ps.length + 1
      && S.steps[jn].ps.length === S.steps[jn - 1].ps.length - 1; })());
ok('6 每一笔都带着隔了多久（放一遍的节奏就是这个数，界面上写的也是它）',
  S.steps.every(s => typeof s.op.gap === 'number'));
ok('7 不传那个出口时老调用一点没变（数笔数那一条路不该被带倒）',
  D.n === st2.n && D.bytes === st2.bytes && typeof D.paras.join === 'function');

/* ---------------- 二、历史那一屏：整份真源码进沙箱 ---------------- */
const mk = (tag, props, kids) => {
  if(typeof props === 'string') kids = props, props = null;
  const el = { tag:tag || 'div', class:(props && props.class) || '', style:'', children:[], textContent:'',
    appendChild(x){ if(typeof x === 'string') this.textContent += x; else if(x) this.children.push(x); return x; },
    querySelectorAll(){ return []; } };
  if(kids === undefined || kids === null) return el;
  (Array.isArray(kids) ? kids : [kids]).forEach(x => el.appendChild(x));
  return el;
};
const seen = [];
const hctx = { console, h:mk, addCss:s => seen.push(s), toast:() => {}, cut:(s, n) => String(s || '').slice(0, n),
  State:{ get:async(k, d) => d, set:() => {} }, DB:{ get:async() => '', keysWith:async() => [] },
  Img:{ dir:() => '测试书' }, Work:{ book:{ id:'bk1' }, saveCh:async() => {} },
  WNW_DATA_PRE:'', location:{ protocol:'fdapp:' }, FD_APP:null, window:{},
  Trace:{ ranges:() => [] }, BLOCK_MAP:new Map(), Overlay:{ open:() => {} }, KLog, fmtMB:null, Blob, JSON, Math, Number, Date, Set, Map, Array, Object, String, Promise, Intl };
vm.createContext(hctx);
vm.runInContext(HSRC + '\n;globalThis.__H = { Hist, diffNodes, diffLines, fmtGap, keGap, keWhat, VER_NAME, HistDlg };', hctx);
const H = hctx.__H;
/* 注释先抹掉再查：那两把删除的刀是以「这里原来有 drop() / dropAll()」这种说明留在文件里的，
   连着注释一起查就会自己咬自己（第 41 轮第一节那台踩过同一手，改的是先抹注释）。 */
const 代码 = HSRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

ok('8 出厂默认 2048 MB，界面上那一栏填不到 0（min 和回弹两处都钉着）',
  H.Hist.warnMB === 2048 && /type:'number', min:'1'/.test(HSRC) && /v >= 1 \? v : 2048/.test(HSRC));
ok('9 提醒那一条路里再没有「0 就当不提醒」那一手',
  !/if\(!this\.warnMB/.test(HSRC) && /v >= 1 \? v : 2048/.test(HSRC));
ok('10 那一屏真的去取逐笔（不是只数笔数）：KLog.steps 被调用、KLog.stats 不再出现在界面里',
  /await KLog\.steps\(c\.id\)/.test(HSRC) && !/KLog\.stats\(/.test(HSRC));
const 节奏 = [ H.keGap(0) === 40, H.keGap(5000) === 1200, H.keGap(200, 4) === 50,
  H.keGap(5000, 8) === 150, H.keGap(40, 8) === 6, H.keGap(200, 'x') === 200 ];
ok('11 「放一遍」按笔走、节奏吃记下来的毫秒隔（先夹在 40 毫秒到 1.2 秒，再除倍速档，最快不低于 6 毫秒）',
  /K\.steps\[i\]\.op\.gap/.test(HSRC)
  && /setTimeout\(tick, keGap\(K\.steps\[i\]\.op\.gap, Hist\.rate\)\)/.test(HSRC)
  && 节奏.every(Boolean),
  '真算下来：' + [0, 5000, 200, 5000, 40, 200].map((m, i) => m + '@' + [1,1,4,8,8,'乱'][i] + '→' + H.keGap(m, [1,1,4,8,8,'乱'][i])).join(' '));

/* 一行都不折：30 行只改中间一行 —— 改的那一行拆成「删一行 + 加一行」，所以出 31 行 */
const a = Array.from({ length:30 }, (_, i) => '第' + (i + 1) + '行'), b = a.slice();
b[15] = '第16行改了';
const dn = H.diffNodes(H.diffLines(a, b));
ok('12 改动行前后不再折：30 行进、31 行出（改的那一行是「删一行 + 加一行」两行，一个都不折）',
  dn.length === 31 && !/中间.*行没动/.test(代码), dn.length + ' 个节点');
ok('13 没改的行也一律摆着（class 还是 same，字色淡一档）',
  dn.filter(x => x.class === 'ln same').length === 29 && dn.filter(x => x.class === 'ln add').length === 1);

/* 清理那份排法 */
const mkv = (i, kind) => ({ at:1000 + i, kind, note:'' });
const vs = [mkv(0, 'auto'), mkv(1, 'auto'), mkv(2, 'manual'), ...Array.from({ length:25 }, (_, i) => mkv(3 + i, 'auto')), mkv(28, 'rev-proc'), mkv(29, 'auto')];
const sizes = {}; vs.forEach(v => { sizes[v.at + '.json'] = 1024; });
const p = H.Hist.sweep(vs, sizes);
ok('14 清理建议：最早那一版留、最近 ' + H.Hist.KEEP_LAST + ' 版留、手动版和修订版一律留',
  p.keep.some(x => x.at === 1000) && p.keep.some(x => x.at === 1002) && p.keep.some(x => x.at === 1028) &&
  !p.moves.some(x => x.at === 1000 || x.at === 1002 || x.at === 1028));
ok('15 可挪的只有中间那些自动版：' + p.moves.length + ' 份 · 一共 ' + p.freed + ' 字节（每章都还留着一大截，谁也没被清空）',
  p.moves.every(x => x.kind === 'auto') && p.moves.length === vs.length - p.keep.length &&
  p.freed === p.moves.length * 1024 && p.keep.length >= H.Hist.KEEP_LAST + 2);
/* 注释早在文件开头就抹过了（同一个 `代码`），这里直接查干净的代码 */
ok('16 程序一根手指都不碰文件：抹掉注释之后，这一份里查不到删除或改写历史的调用',
  !/pageUnlink|deletePageFile|fs:unlink/.test(代码) && !/\bdrop\s*\(|dropAll\s*\(/.test(代码));

/* 样式挂出去过没有（接线层：CSS 里写的类，源码里得有人挂） */
const css = seen.join('\n');
const cls = [...css.matchAll(/\.wnw-hist \.([a-z-]+)/g)].map(m => m[1]);
const 没挂 = cls.filter(x => !new RegExp("[\"'` ]" + x + "[\"'` ]|[.] " + x + "\\b|'ln ' \\+|class:'[a-z ]*" + x).test(HSRC));
ok('17 这一屏样式里 ' + cls.length + ' 个类，源码里全部挂出去过（死样式一条不剩）',
  没挂.length === 0, 没挂.join('、'));
ok('18 逐笔那一列、行号、改动着色这四样在样式里有名（.tl-h / .gap / .no / .mk）',
  ['tl-h', 'gap', 'no', 'mk'].every(x => new RegExp('\\.' + x + '\\b').test(css)),
  ['tl-h', 'gap', 'no', 'mk'].filter(x => !new RegExp('\\.' + x + '\\b').test(css)).join('、'));

console.log('\n' + pass + ' 过 ' + fail + ' 不过');
process.exit(fail ? 1 : 0);
