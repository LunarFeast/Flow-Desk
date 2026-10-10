/* 外29 色卡池自检：把 fd11-cards.js 那份真源码 + 真 YAML 那台 + 真解色号那把尺搬进沙箱跑，
   判的是「写出去那份文件，读回来一不一样」和「同色会不会攒第二个」。 */
import fs from "node:fs";
import vm from "node:vm";
const R = "D:/Programs/Flow-Desk/src/";
const src = fs.readFileSync(R + "_fd/src/fd11-cards.js", "utf8");
const lib = fs.readFileSync(R + "_fd/src/fd3-lib.js", "utf8");
const col = fs.readFileSync(R + "_shared/sh-color.js", "utf8");

function grab(name, from){
  const i = from.indexOf("const " + name + " = {");
  if(i < 0) throw new Error("找不到 " + name);
  let d = 0, k = from.indexOf("{", i);
  for(; k < from.length; k++){
    if(from[k] === '{') d++;
    else if(from[k] === '}'){ d--; if(!d) return from.slice(i, k + 1) + ";"; }
  }
  throw new Error(name + " 花括号没配平");
}
/* 真解色号那两个函数：从 sh-color.js 里按名字抠，抠不到就直接整份搬（那份不碰界面） */
let pc = col.match(/function parseColor[\s\S]*?\n\}/)?.[0] || '';
let rc = col.match(/function resolveColor[\s\S]*?\n\}/)?.[0] || '';
if(!pc || !rc){
  const i = col.indexOf("function parseColor"), j = col.indexOf("const CV = {");
  pc = col.slice(i, j); rc = '';
}

let file = null;
const ctx = { console, Date, Math, Number, String, Array, Object, JSON, RegExp, Set, Map, isNaN, parseInt, parseFloat,
  LibStore:{ fetchRaw:async()=>file, putRaw:async(n,t)=>{ file = t; return true; }, later(n,t){ file = t; } }, State:{ get:async(k,d)=>(k in (ctx.__s||{}) ? ctx.__s[k] : d), set:async(k,v)=>{ (ctx.__s = ctx.__s||{}); ctx.__s[k]=v; return true; } } };
vm.createContext(ctx);
const look = fs.readFileSync(R + "_shared/sh-look.js", "utf8");
vm.runInContext(grab("LibYml", lib) + "\n" + col + "\n" + look + "\n" + src +
  "\n;globalThis.__x = { CardPool, LibYml };" +
  "\n;globalThis.__api = { tokensOf, Look };", ctx);
const { CardPool } = ctx.__x;

let pass = 0, fail = 0;
const ok = (n, c, extra) => { if(c){ pass++; console.log("  PASS " + n); } else { fail++; console.log("  FAIL " + n + (extra ? " · " + extra : "")); } };

CardPool.ready = true;
console.log("色卡池那份档（data\\cards.yaml）· 真源码搬进沙箱\n");

const n1 = CardPool.addAll(['#3b6cb5', '#2e8b57', '#c0c0c0', '#3B6CB5', '', '不是色'], 'image');
ok("1 一串色各自进池：4 个里同色和坏的不算，添了 " + n1 + " 个", n1 === 3 && CardPool.count() === 3);
ok("2 同色再来一趟不攒第二个", CardPool.addAll(['#3b6cb5'], 'swatch') === 0 && CardPool.count() === 3);

const g = CardPool.addGrad(['#3b6cb5', '#2e8b57', '#f0a'], '我配的');
ok("3 三个基础色攒成一组进池（色号 " + (g ? g.colors.length : 0) + " 档 · 组 " + (g ? g.group : '') + " · 那个不带画法字段：" + (g ? String(g.grad) : '') + "）",
   g && g.colors.length === 3 && g.group === '我配的' && g.grad === undefined);
ok("4 只给一个攒不成一组（交回空，不脏池子）", CardPool.addGrad(['#ffffff']) === null && CardPool.count() === 4);

const 文本 = CardPool.text();
const 头几行 = 文本.split('\n').filter(l => l && !l.startsWith('#')).slice(0, 8);
console.log("  写出去那份（去掉说明行，头八行）：\n    " + 头几行.join("\n    "));

/* 读回来：清空、从那份文本重认一遍，逐项对 */
const 原 = JSON.parse(JSON.stringify(CardPool.items));
CardPool.items = [];
const 认回 = CardPool.adopt(文本);
ok("5 写出去几个、读回来几个（" + 认回 + "）", 认回 === 原.length);
ok("6 每一个的色号、组、来源、代码全对得上",
   JSON.stringify(CardPool.items) === JSON.stringify(原),
   "\n     应 " + JSON.stringify(原[3]) + "\n     实 " + JSON.stringify(CardPool.items[3]));

ok("7 管理态：改组名整组跟着走", CardPool.renameGroup('未分组', '日常') === 3 && CardPool.groups().find(x => x[0] === '日常')[1].length === 3);
CardPool.setGroup(CardPool.items[0].code, '我配的');
ok("8 单个挪组生效（那一组现在有 " + CardPool.groups().find(x => x[0] === '我配的')[1].length + " 个）",
   CardPool.groups().find(x => x[0] === '我配的')[1].length === 2);
ok("9 删一个", CardPool.remove(CardPool.items[0].code) === true && CardPool.count() === 3);
CardPool.addAll(['#123456'], 'custom');   /* 不填组的那一个落在 未分组 里 */
ok("10 未分组永远排在最后（组序：" + CardPool.groups().map(x => x[0]).join(' / ') + "）",
   CardPool.groups()[CardPool.groups().length - 1][0] === '未分组');

/* 色卡摊开那一串：一个一个色号、按色相排（跟配色池那一头同一把尺） */
const hs = CardPool.hexes();
const hueOf = s => { const m = /^#(..)(..)(..)$/.exec(s), [r,g2,b] = m.slice(1).map(v => parseInt(v,16)/255);
  const mx = Math.max(r,g2,b), mn = Math.min(r,g2,b); if(mx === mn) return -1; const d = mx - mn;
  return mx === r ? ((g2-b)/d + 6) % 6 : mx === g2 ? (b-r)/d + 2 : (r-g2)/d + 4; };
const 序 = hs.map(hueOf);
ok("11 色卡摊开那一串 " + hs.length + " 个、一个一个色号、按色相排（" + hs.join(' ') + "）",
   hs.length === CardPool.count() && hs.every(x => /^#[0-9a-f]{6}$/.test(x)) && 序.every((x, i) => i === 0 || 序[i-1] <= x));

/* 开机：文件读不回来时不许往回盖 */
CardPool.ready = true; CardPool.items = []; file = null;
await CardPool.boot();
ok("12 读写那一层没连上 → 不盖文件（ready 还是没点亮）", CardPool.ready === false && file === null);

/* ---------- 一键微调那枚开关（外29 第 27 轮） ---------- */
CardPool.tuneOn = true;
const t1 = CardPool.tune(['#3b6cb5', '#3b6db6', '#c0c0c0']);
ok("13 微调开着：两个几乎一样的并掉（三个进去 " + t1.length + " 个出来）", t1.length === 2 && t1.includes('#3b6cb5') && t1.includes('#c0c0c0'));
const t2 = CardPool.tune(['#0a0a0a']);
const li = x => { const m = /^#(..)(..)(..)$/.exec(x), v = m.slice(1).map(y => parseInt(y,16)/255); return Math.max(...v); };
ok("14 过暗那一个被推回能用的档（" + t2[0] + "，原来 #0a0a0a）", t2[0] !== '#0a0a0a' && li(t2[0]) > li('#0a0a0a'));
const t3 = CardPool.tune(['#ffffff']);
ok("15 过亮那一个也往回推一档（" + t3[0] + "）", t3[0] !== '#ffffff' && li(t3[0]) < 1);
CardPool.tuneOn = false;
ok("16 开关关掉 → 一个不动（取到什么存什么）", JSON.stringify(CardPool.tune(['#0a0a0a', '#3b6cb5', '#3b6db6'])) === JSON.stringify(['#0a0a0a', '#3b6cb5', '#3b6db6']));
CardPool.tuneOn = true;

/* ---------- 当前方案在用的色进池（外29 第 29 轮） ----------
   名单里每一个名字都得是配色那一趟真钉得出去的变量名 —— 名字打错不会报错，只会静悄悄少一个。
   这里不查字符串（--slot-0 那一串是循环里拼出来的，源码里查不到字面），直接拿真派生机跑一套配色，
   看它交回来的那一叠变量里有没有这 15 个名字。 */
const 派生 = ctx.__api;
const 一套真 = 派生.tokensOf({ mode:'light' }, 'a');
const 一套全 = Object.assign({}, 一套真.tokens, 派生.Look.readable(一套真.tokens, { mode:'material', scheme:'a' }) || {});
const 缺名 = CardPool.SCHEME_KEYS.filter(k => !/^#[0-9a-f]{6}$/i.test(String(一套全[k] || '')));
ok("17 名单 " + CardPool.SCHEME_KEYS.length + " 个名字，真派生一套配色下来每一个都钉得出六字体色的色号（缺的是：" + (缺名.join(',') || '无') + "）",
   缺名.length === 0, 缺名.join(','));

CardPool.items = []; file = '';
const 一套 = { '--page-bg':'#f6f6f4', '--card-bg':'#ffffff', '--face-solid':'#f0f0ee', '--text':'#232323',
  '--text-light':'#6a6a66', '--accent':'#3b6cb5', '--accent2':'#8a5cc0', '--ok':'#2e8b57', '--bad':'#c0492a',
  '--warn':'#c9a227', '--slot-1':'#3a9e6f', '--slot-2':'#d05f5f', '--slot-3':'#4f8fd6',
  '--slot-4':'#c9c25a', '--slot-5':'#7bc47f', '--wall-a':'color-mix(in srgb,#fff 40%,#3b6cb5)',
  '--input-bg':'#e9e9e6', '--card-line':'', '--nope':'#111111' };
const n2 = CardPool.fromScheme(一套);
ok("18 十五个锚进去、一个不并（审查第 38 条改完之后，那对绿的直差 5.35 度但明度差 6.1 个点，两条要同时够才算同一个）→ 添了 " + n2 + " 个",
   n2 === 15 && CardPool.count() === 15, n2 + '/' + CardPool.count());
ok("18a 色相那一头绕回算对了：#ff0000（0 度）和 #ff0008（358.1 度）真实只差 1.9 度 → 并掉",
   CardPool.tune(['#ff0000', '#ff0008']).length === 1, CardPool.tune(['#ff0000', '#ff0008']).join(' '));
ok("18b 门槛真是 6 度不是 36 度：#ff0000 和 #ff0033 差 12 度 → 不并（改之前这对照样会被并掉）",
   CardPool.tune(['#ff0000', '#ff0033']).length === 2, CardPool.tune(['#ff0000', '#ff0033']).join(' '));
ok("18c 明度那一档还是照旧：过暗的 #0a0a0a 挨着 #3b6cb5 也照样各自留一个",
   CardPool.tune(['#0a0a0a', '#3b6cb5']).length === 2);
ok("18f 名单外的那几个不算进池（--wall-a 那条 color-mix、--input-bg、--nope）",
   !CardPool.items.filter(c => c.source === 'scheme').some(c => /111111|e9e9e6/.test(c.colors[0].raw)));
ok("19 记的来源是「方案」，界面上那一栏写得出来", CardPool.items.every(c => c.source === 'scheme' && c.group === '未分组'));
ok("20 再来一趟不攒第二个（同色一个就够）", CardPool.fromScheme(一套) === 0 && CardPool.count() === 15);
ok("21 名单里缺几个就少几个，不报错也不塞空色",
   CardPool.fromScheme({ '--page-bg':'#fafafa', '--text':'#222222' }) === 2);
ok("22 传进来是空的（开机头一趟还没 apply 过）→ 0 个，不脏池子",
   CardPool.fromScheme(null) === 0 && CardPool.fromScheme({}) === 0);
const 写出去 = CardPool.text(), 进池前 = CardPool.items.map(c => c.colors.map(x => x.raw));
CardPool.items = [];
CardPool.adopt(写出去);
ok("23 方案那几个写出去读回来一样（档里根本没有「渐变」那一栏：画法不存池子）",
   JSON.stringify(CardPool.items.map(c => c.colors.map(x => x.raw))) === JSON.stringify(进池前)
   && !/渐变:/.test(写出去) && !/grad/.test(写出去));

/* ---------- 一组基础色的查重（审查第 39 条 + 他给的口径：池子只存料，不存画法） ---------- */
{
  const 前 = CardPool.count();
  const a = CardPool.addGrad(['#3b6cb5', '#2e8b57'], 'linear', '我配的');
  const 中 = CardPool.count();
  const b = CardPool.addGrad(['#3b6cb5', '#2e8b57'], 'linear', '我配的');
  const 后 = CardPool.count();
  ok("24 同一串基础色再来一趟不攒第二个（添了 " + (中 - 前) + " 个，第二趟 " + (后 - 中) + " 个 · 交回的是同一个：" +
     (a && b && a.code === b.code) + "）", 中 === 前 + 1 && 后 === 中 && !!a && !!b && a.code === b.code);
  const 再前 = CardPool.count();
  const c = CardPool.addGrad(['#3b6cb5', '#2e8b57'], '我配的');
  ok("25 档里没地方存画法：同一串再来一趟，交回的还是那一个、那个没有 grad 这一项",
     CardPool.count() === 再前 && !!c && c.grad === undefined && !!a && c.code === a.code);
  const 三 = CardPool.addGrad(['#2e8b57', '#3b6cb5'], '我配的');
  ok("26 档的先后换了（绿在前、蓝在后）算另一个 —— 那几行的顺序就是渐变从哪头渐到哪头", CardPool.count() === 再前 + 1 && !!三);
  /* 单色和渐变分开比（他定的口径）：一个渐变里当过档的那个色，不挡同一个纯色进池，反过来也一样。
     这里全用池子里没出现过的三个新色，免得跟前面那 15 个锚撞车。 */
  const 紫 = '#7a1f9e', 青 = '#0f8a8d', 黄 = '#c9a227';
  const 单前 = CardPool.count();
  const 添渐 = CardPool.addGrad([紫, 青], 'mesh', '我配的');
  ok("26a 先攒一组「紫→青」进池（添了 1 个）", !!添渐 && CardPool.count() === 单前 + 1);
  const 添单 = CardPool.addAll([青], 'image');
  ok("26b 一组里当过档的那个青，不挡同一个纯色进池（一组不挡单个）· 添了 " + 添单 + " 个",
     添单 === 1 && CardPool.count() === 单前 + 2);
  const 添渐二 = CardPool.addGrad([青, 黄], 'linear', '我配的');
  ok("26c 那个纯青也不挡新的一「青→黄」进池（单个不挡一组）", !!添渐二 && CardPool.count() === 单前 + 3);
  const 单重 = CardPool.addAll([青], 'swatch');
  ok("26d 单个之间照样查重：那个纯青再来一趟不攒第二个（添了 " + 单重 + " 个）", 单重 === 0 && CardPool.count() === 单前 + 3);
}

/* ---------- 两种零分得开（审查第 42 条，第 34 轮拆出来的 schemePicks） ----------
   界面那句靠的是「认到几个」和「添进几个」这两个数：两个都是 0 才是「一个都没认到」，
   认到 > 0 而添进 0 是「都已经有了」。这里直接量那两个数不相等。 */
{
  const 认到 = CardPool.schemePicks(一套);
  const 添进 = CardPool.addAll(认到, 'scheme');
  ok("27 池子里全有了这一种：认到 " + 认到.length + " 个、添进 " + 添进 + " 个 —— 两个数不相等，界面才分得开这句话",
     认到.length === 15 && 添进 === 0);
  ok("28 一个都没认到这一种：schemePicks 交回空（{} 和 null 都是），这时候 addAll 那个 0 是同一个意思",
     CardPool.schemePicks({}).length === 0 && CardPool.schemePicks(null).length === 0);
  ok("29 schemePicks 交回的都是小写六位色号（大写写法进来也统一，比较那一路才不会漏）",
     CardPool.schemePicks({ '--page-bg':'#FAFAFA', '--text':'#222222' }).every(x => /^#[0-9a-f]{6}$/.test(x))
     && CardPool.schemePicks({ '--page-bg':'#FAFAFA' })[0] === '#fafafa');
}

console.log("\n" + pass + " 过 " + fail + " 不过");
process.exit(fail ? 1 : 0);
