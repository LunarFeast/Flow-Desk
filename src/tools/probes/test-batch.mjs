/* 外29 第 31 轮自检 · 色卡图一次挑多张
   ----------
   盯的是那几条只有批量才会出的路：
     A 一张坏了（读不开、或没数出色块）不许把整批带倒 —— 其余张认到的照样上清单，坏的那张在小标题里点名
     B 几张的色块并成一份清单，勾着的走一次进池；两张上有同一个色号时池子里只攒一个
     C 全部都空 → 该报错报错（不弹一张空清单糊弄过去）
     D 只挑一张时，标题和小标题都跟从前一样，不多余一行「一张一组」的帽子
   swatchDlg 那份是从 fd4-builtin.js 里整段抠出来跑的（不抄第二份），DOM、选文件、认色块三样给假的，
   解色号和色卡池那两份用真的。 */
import fs from 'node:fs';
import vm from 'node:vm';
const ROOT = 'D:/Programs/Flow-Desk/';
const read = p => fs.readFileSync(ROOT + p, 'utf8');
const builtin = read('src/_fd/src/fd4-builtin.js');
const i = builtin.indexOf('async function swatchDlg(');
const j = builtin.indexOf('/* ---------- 新建配色', i);
if(i < 0 || j < 0) throw new Error('没抠到 swatchDlg 那一段');
const fn = builtin.slice(i, j).trimEnd();
/* swatchDlg 末尾那句报话用到了同一份里那个共用小函数，一并抠真的进来（不自己重写一份） */
const 池尾行 = builtin.match(/^const 池尾 = [^\n]+/m);
if(!池尾行) throw new Error('没找到 池尾 那一行');
const 池尾源 = 池尾行[0];

const col = read('src/_shared/sh-color.js');
const lib = read('src/_fd/src/fd3-lib.js');
const cards = read('src/_fd/src/fd11-cards.js');
function grab(name, from){
  const k = from.indexOf('const ' + name + ' = {');
  if(k < 0) throw new Error('找不到 ' + name);
  let d = 0, p = from.indexOf('{', k);
  for(; p < from.length; p++){
    if(from[p] === '{') d++;
    else if(from[p] === '}'){ d--; if(!d) return from.slice(k, p + 1) + ';'; }
  }
  throw new Error(name + ' 花括号没配平');
}

/* ---------- 三样假的：选文件、认色块、弹窗；h 给一个够用的小 DOM ---------- */
const 架 = { 挑: [], 读: async () => ({ list: [], ocr: false, why: '' }), 开: null, 报: [], 勾: [] };
const el = at => {
  const n = { children: [], style:{}, value:(at && at.value) || '', textContent:'', tag:(at && at.tag) || '', type:(at && at.type) || '' };
  Object.assign(n, at || {});
  if(n.type === 'checkbox') n.checked = !!at.checked;          /* 只有勾选框才有 checked 这一档，别混进色号那几行 */
  n.appendChild = c => { n.children.push(c); return c; };
  n.addEventListener = () => {};
  return n;
};
const ctx = {
  console, Math, JSON, String, Number, Object, Array, RegExp, Set, Map, isNaN, parseFloat, parseInt, Date, Promise,
  h: (tag, at, 娃) => {                                     /* 真那个 h：第三个参数可以是子节点数组，也可以是一段字 */
    const n = Object.assign(el(at), { tag });
    if(Array.isArray(娃)) 娃.forEach(c => { if(c) n.appendChild(c); });
    else if(娃 !== undefined && 娃 !== null) n.textContent = String(娃);
    if(at && at.type === 'checkbox') 架.勾.push(n);
    return n;
  },
  toast: t => 架.报.push(t),
  pickFiles: async () => 架.挑,
  SwatchTheme: { read: (f, p) => 架.读(f, p) },
  Modal: { open: (title, body, btns) => { 架.开 = { title, body, btns }; }, close(){ 架.开 = null; } },
  window: { FD_APP: { pathOf: handle => (handle && handle.路径) || '' } },
  FD_APP: { pathOf: handle => (handle && handle.路径) || '' },   /* 浏览器里 window 上的那个就是全局那一份 */
  LibStore:{ fetchRaw:async()=>'', putRaw:async()=>true, later(){} }, State:{ get:async(k,d)=>d, set:async()=>true },
};
vm.createContext(ctx);
vm.runInContext(grab('LibYml', lib) + '\n' + col + '\n' + cards + '\n' + 池尾源 + '\n' + fn +
  '\n;globalThis.__x = { CardPool, swatchDlg, 池尾 };', ctx);
const { CardPool, swatchDlg, 池尾 } = ctx.__x;
CardPool.ready = true; CardPool.tuneOn = false;

let pass = 0, fail = 0;
const ok = (n, c, extra) => { if(c){ pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (extra ? ' · ' + extra : '')); } };
/* 清单里那一行行的色号输入框（一个色块一行） */
const 色行 = body => { const out = []; const walk = n => {
  if(n.tag === 'input' && /^#[0-9a-f]{6}$/i.test(String(n.value || ''))) out.push(n);
  (n.children || []).forEach(walk); }; walk(body); return out; };
/* 每张顶上那一行小标题（只有批量才有） */
const 帽 = body => { const out = []; const walk = n => {
  if(n.tag === 'div' && (n.class || '').includes('fd-hint') && n.children.length === 0 && /·/.test(n.textContent || '')) out.push(n.textContent);
  (n.children || []).forEach(walk); };
  (body.children || []).forEach(walk); return out; };

const 块 = hex => ({ hex, raw:hex, code:'', txt:'' });

/* ---------- A · 三张里一张读不开、一张没数出色块 ---------- */
架.挑 = [{ file:{ name:'甲.png' }, handle:{ 路径:'D:\\甲.png' } },
        { file:{ name:'乙.png' }, handle:{ 路径:'D:\\乙.png' } },
        { file:{ name:'坏.png' }, handle:null }];
架.读 = async f => {
  if(f.name === '坏.png') throw new Error('这张图解不开');
  if(f.name === '乙.png') return { list:[], ocr:false, why:'色块之间没有分隔' };
  return { list:[块('#3b6cb5'), 块('#2e8b57')], ocr:true, why:'' };
};
await swatchDlg(() => {});
ok('A1 三张里两张没认出来，这一批不整批返工（弹窗照常开）', !!架.开);
ok('A2 标题点名几张、认出几个块、几张空（' + (架.开 && 架.开.title) + '）',
   /3 张/.test(架.开.title) && /认出 2 个色块/.test(架.开.title) && /2 张没认出色块/.test(架.开.title));
const 帽A = 帽(架.开.body);
ok('A3 读不开的那张在清单里点得到名（那两句：' + 帽A.join(' ‖ ') + '）',
   帽A.some(s => s.includes('坏.png') && /读不开/.test(s)));
ok('A4 没数出色块那张也点得到名（写的是它自己的那一句原因）',
   帽A.some(s => s.includes('乙.png') && /没有分隔/.test(s)));
ok('A5 坏的那几张不占色块行（清单里两个）', 色行(架.开.body).length === 2);
架.开.btns[1].onclick();                                 /* 点「勾中的进池」 */
ok('A6 勾中的进池：池子里 ' + CardPool.count() + ' 个 · 来源记色卡', CardPool.count() === 2 && CardPool.items.every(c => c.source === 'swatch'));

/* ---------- B · 两张上有同一个色号 ---------- */
CardPool.items = [];
架.挑 = [{ file:{ name:'甲.png' }, handle:null }, { file:{ name:'丙.png' }, handle:null }];
架.读 = async f => ({ list: f.name === '甲.png' ? [块('#3b6cb5'), 块('#111111')] : [块('#3b6cb5'), 块('#222222')], ocr:false, why:'' });
await swatchDlg(() => {});
const 框B = 架.开;                                        /* 点进池那一下会把弹窗收掉，先把手上这一份留住 */
ok('B1 两张并成一份清单（四行色块）', 色行(框B.body).length === 4);
ok('B3 没读回图上的字那一张，顶上小标题写的是「只采样」（不假装读了字）',
   帽(框B.body).some(s => /只采样/.test(s)), 帽(框B.body).join(' ‖ '));
框B.btns[1].onclick();
ok('B2 同一个色号只攒一个：进池 ' + CardPool.count() + ' 个', CardPool.count() === 3, CardPool.hexes().join(' '));

/* ---------- C · 全部都空 ---------- */
CardPool.items = [];
架.挑 = [{ file:{ name:'甲.png' }, handle:null }, { file:{ name:'乙.png' }, handle:null }];
架.读 = async () => ({ list:[], ocr:false, why:'色块之间没有分隔' });
架.开 = { 哨兵:true };
let 抛 = '';
try{ await swatchDlg(() => {}); }catch(e){ 抛 = e.message; }
ok('C1 两张都空 → 报的是那两句合起来（' + 抛 + '）', /都没数出色块/.test(抛) && 抛.includes('色块之间没有分隔'), 抛);
ok('C2 报错了就不弹窗（不摆一张空清单）', 架.开.哨兵 === true);

/* ---------- D · 只挑一张（批量那几顶帽子不该出现） ---------- */
CardPool.items = [];
架.挑 = [{ file:{ name:'甲.png' }, handle:null }];
架.读 = async () => ({ list: [块('#abcdef')], ocr:true, why:'' });
架.开 = null;
await swatchDlg(() => {});
ok('D1 一张时标题不带「N 张 ·」（' + 架.开.title + '）', !/张 ·/.test(架.开.title) && /认出 1 个色块/.test(架.开.title));
ok('D2 一张时清单顶上不多那一行文件名帽子', 帽(架.开.body).filter(s => s.includes('甲.png')).length === 0);
架.开.btns[1].onclick();
ok('D3 一张照样进池一个', CardPool.count() === 1 && CardPool.hexes()[0] === '#abcdef');

/* ---------- E · 一个都没勾 → 不进池也不关窗 ---------- */
CardPool.items = [];
架.勾 = [];                                              /* 这一趟新建的勾选框都记在这一串里 */
架.挑 = [{ file:{ name:'甲.png' }, handle:null }];
架.读 = async () => ({ list: [块('#abcdef')], ocr:false, why:'' });
架.开 = null;
await swatchDlg(() => {});
ok('E1 清单上每一个色块都带一枚勾选框、出厂都勾着', 架.勾.length === 1 && 架.勾.every(x => x.checked === true));
架.勾.forEach(x => { x.checked = false; });
架.开.btns[1].onclick();
ok('E2 一个都没勾 → 不写盘、不关窗（池子还是 0 个，弹窗还开着）', CardPool.count() === 0 && !!架.开, CardPool.count());

/* ---------- F · 只挑一张、而那张是「读不开」（审查第 43 条那句拼坏的） ---------- */
{
  let 抛 = '';
  架.挑 = [{ file:{ name:'坏.png' }, handle:null }];
  架.读 = async () => { throw new Error('这张图解不开'); };
  try{ await swatchDlg(() => {}); }catch(e){ 抛 = e.message; }
  ok('F1 单张读不开时那句读得通（现在报的是：' + 抛 + '）',
     抛 === '这张图读不开：这张图解不开' && !/这张图里这张/.test(抛), 抛);
  抛 = '';
  架.挑 = [{ file:{ name:'甲.png' }, handle:null }, { file:{ name:'坏.png' }, handle:null }];
  架.读 = async f => { if(f.name === '坏.png') throw new Error('这张图解不开'); return { list:[], ocr:false, why:'' }; };
  try{ await swatchDlg(() => {}); }catch(e){ 抛 = e.message; }
  ok('F2 两张都空时报的是逐张点名（现在报的是：' + 抛 + '）',
     /都没数出色块/.test(抛) && 抛.includes('甲.png：没数出色块') && 抛.includes('坏.png：读不开'), 抛);
}

/* ---------- G · 报话和落盘对上（审查第 41 条，第 34 轮那句共用的 池尾） ---------- */
{
  CardPool.ready = true;
  ok('G1 连得上文件 → 报话末尾不多那半句（现在报的是："' + 池尾() + '"）', 池尾() === '');
  CardPool.ready = false;
  const 句 = 池尾();
  ok('G2 连不上文件 → 末尾带上那半句，说明只记在内存、重启就没了（现在报的是："' + 句 + '"）',
     /没连上/.test(句) && /内存/.test(句) && /重启/.test(句));
  const 处 = (builtin.match(/\+ 池尾\(\)/g) || []).length;
  ok('G3 fd4-builtin.js 里每一条「进色卡 / 存成一组 / 从图上取到色」的报话末尾都带着那半句（数到 ' + 处 + ' 处，' +
    '外32 那一枚「挑中的进色卡」是循环、整个撤了，外34 图8 又撤了「小企鹅配色进色卡」「内置配色 v1 进色卡」两枚；' +
    '「挑中的进入方案」建的是配色不是色卡，不该带这一句）', 处 === 7);
  CardPool.ready = true;
}

console.log('\n' + pass + ' 过 ' + fail + ' 不过');
process.exit(fail ? 1 : 0);
