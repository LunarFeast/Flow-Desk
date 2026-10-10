/* 外29 第 30 轮自检 · 小企鹅（Weasel）那一批色号提取进软件
   ----------
   这台盯四件事：
     A 反序反对了（那份文件里 0x[AA]BBGGRR 是蓝在前红在后，反过才是屏幕上的色号）——
       拿 yaml 里三处当场挑出来的原值和它该变成的色号对，反了和没反是两种结果，一测就分得开。
     B 生成那份里每一个都真在那份 yaml 里出现过（把色号再反回 0x 那一头去文件里找）。
     C 一个不漏：文件里出现过的色号去重之后有多少个，生成那份就得有多少个。
     D 进池那一步真走通：把 fd11-cards.js 和生成那份一起搬进沙箱，点一次「小企鹅配色进池」那一下
       走的调用（addAll(RIME_HEXES,'rime','小企鹅')），看来源记成 Rime、组落成 小企鹅、再点一趟不攒第二个。
   跑法：node test-rime.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
const ROOT = 'D:/Programs/Flow-Desk/';
const YAML = (process.env.APPDATA || '') + '/Rime/build/weasel.yaml';
const GEN = ROOT + 'src/_fd/src/fd12-rime-colors.js';

let pass = 0, fail = 0;
const ok = (n, c, extra) => { if(c){ pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (extra ? ' · ' + extra : '')); } };

if(!fs.existsSync(YAML)){ console.log('  SKIP 这台机器上没有那份 weasel.yaml（' + YAML + '），A/B/C 三条量不了'); }
const gen = fs.readFileSync(GEN, 'utf8');
const 池 = [...gen.matchAll(/(#[0-9a-f]{6})/g)].map(m => m[1]);

/* ---------- A 反序：色卡池那一份 + 生成那份都在，先核最硬的一条 ---------- */
const col = fs.readFileSync(ROOT + 'src/_shared/sh-color.js', 'utf8');
const ctx = vm.createContext({ Math, JSON, String, Number, Object, Array, RegExp, isNaN, parseFloat, parseInt, console });
vm.runInContext(col, ctx, { filename:'sh-color.js' });
vm.runInContext('globalThis.__c = { parseColor };', ctx);
const flip = v => ctx.__c.parseColor(v, 'auto').hex;
ok('1 反序用的是那把尺本身（0xF0F8FF → #fff8f0，不是原样 #f0f8ff）',
   flip('0xF0F8FF') === '#fff8f0' && flip('0x98C8B8') === '#b8c898', flip('0xF0F8FF'));
ok('2 带 Alpha 那一种（0x[AA]BBGGRR 八位）也反对、Alpha 不掉进色号里',
   flip('0xFF336655') === '#556633', flip('0xFF336655'));

if(fs.existsSync(YAML)){
  const text = fs.readFileSync(YAML, 'utf8');
  const 原值 = [...text.matchAll(/:\s*(0x[0-9a-f]{6,8})\b/ig)].map(m => m[1]);
  const 该有 = [...new Set(原值.map(flip))];
  ok('3 那份文件里 ' + 原值.length + ' 行色号，反序去重之后 ' + 该有.length + ' 个 —— 生成那份正好这么多（' + 池.length + '）',
     该有.length === 池.length, 池.length);
  const 少 = 该有.filter(h => !池.includes(h));
  const 多 = 池.filter(h => !该有.includes(h));
  ok('4 一个不漏、一个不多（缺 ' + 少.length + ' 个 · 多 ' + 多.length + ' 个）', !少.length && !多.length,
     '缺 ' + 少.slice(0, 6).join(' ') + ' 多 ' + 多.slice(0, 6).join(' '));
  /* 反序核到「每一个都该在」这一层就够了：上面第 4 条已经把两头都封住（少一个、多一个都过不了）。
     这一条改成核另一件真会错的事：只收带 color 的那个键名，别把 style / font 那类键上的数也扫进来。 */
  const 非色键 = [...text.matchAll(/^(\s*)(?!.*[Cc]olor)([A-Za-z_0-9]+):\s*(0x[0-9a-f]{6,8})\b/igm)].map(m => flip(m[3]));
  const 无据 = [...new Set(非色键)].filter(h => 池.includes(h) && !该有.includes(h));
  ok('5 只收键名里带 color 的那几行（非 color 键上出现过的 0x 值 ' + 非色键.length + ' 行，跟着进池的 ' + 无据.length + ' 个）',
     无据.length === 0, 无据.slice(0, 6).join(' '));
}

/* ---------- D 进池那一步：真源码 + 生成那份，一起搬进沙箱 ---------- */
const lib = fs.readFileSync(ROOT + 'src/_fd/src/fd3-lib.js', 'utf8');
const cards = fs.readFileSync(ROOT + 'src/_fd/src/fd11-cards.js', 'utf8');
function grab(name, from){
  const i = from.indexOf('const ' + name + ' = {');
  if(i < 0) throw new Error('找不到 ' + name);
  let d = 0, k = from.indexOf('{', i);
  for(; k < from.length; k++){
    if(from[k] === '{') d++;
    else if(from[k] === '}'){ d--; if(!d) return from.slice(i, k + 1) + ';'; }
  }
  throw new Error(name + ' 花括号没配平');
}
let file = '';
const sctx = { console, Date, Math, Number, String, Array, Object, JSON, RegExp, Set, Map, isNaN, parseInt, parseFloat,
  LibStore:{ fetchRaw:async()=>file, putRaw:async(n,t)=>{ file = t; return true; }, later(n,t){ file = t; } },
  State:{ get:async(k,d)=>d, set:async()=>true } };
vm.createContext(sctx);
vm.runInContext(grab('LibYml', lib) + '\n' + col + '\n' + cards + '\n' + gen +
  '\n;globalThis.__x = { CardPool, RIME_HEXES };', sctx);
const { CardPool, RIME_HEXES } = sctx.__x;
CardPool.ready = true; CardPool.tuneOn = false;      /* 先按原样量，微调那条另有那台管 */

ok('6 生成那份交回 ' + RIME_HEXES.length + ' 个，个个是六位色号',
   RIME_HEXES.length === 池.length && RIME_HEXES.every(h => /^#[0-9a-f]{6}$/.test(h)));
const n1 = CardPool.addAll(RIME_HEXES, 'rime', '小企鹅');
ok('7 点一下进池：添了 ' + n1 + ' 个，池子里也是 ' + CardPool.count() + ' 个', n1 === RIME_HEXES.length && CardPool.count() === n1);
ok('8 来源记成 Rime、组落成 小企鹅（界面上「颜色管理」开起来才挪得动）',
   CardPool.items.every(c => c.source === 'rime' && c.group === '小企鹅'),
   JSON.stringify(CardPool.items[0]));
ok('9 再点一趟不攒第二个', CardPool.addAll(RIME_HEXES, 'rime', '小企鹅') === 0 && CardPool.count() === n1);
ok('10 写出去读回来一样（一段一个、色号一行）', (() => {
  const t = CardPool.text(), 前 = CardPool.items.map(c => c.colors.map(x => x.raw));
  CardPool.items = []; CardPool.adopt(t);
  return JSON.stringify(CardPool.items.map(c => c.colors.map(x => x.raw))) === JSON.stringify(前);
})());
CardPool.tuneOn = true;
CardPool.items = [];
const n2 = CardPool.addAll(RIME_HEXES, 'rime', '小企鹅');
ok('11 一键微调开着点这一批：' + RIME_HEXES.length + ' 个进去、' + n2 + ' 个出来（挨得太近的那些并掉了）', n2 < RIME_HEXES.length && n2 > 0);

console.log('\n' + pass + ' 过 ' + fail + ' 不过');
process.exit(fail ? 1 : 0);
