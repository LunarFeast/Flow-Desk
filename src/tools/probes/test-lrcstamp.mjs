/* 审查第 21 条：词格导出逐句 LRC 那三位毫秒。
   跑的是 src\_wnw\src\w18-lyric.js 里那份真 lyricToLrc + 真 LyricFmt + src\_shared\sh-ttml.js 里那把真尺，
   不抄第二份产品代码；「旧算法」只作为对照出现在断言里（用来说明这一格确实坏过）。 */
import fs from "node:fs";
import vm from "node:vm";
const R = "D:/Programs/Flow-Desk/src/";
const w18 = fs.readFileSync(R + "_wnw/src/w18-lyric.js", "utf8");
const ttml = fs.readFileSync(R + "_shared/sh-ttml.js", "utf8");

function grabObj(name, from){
  const i = from.indexOf("const " + name + " = {");
  if(i < 0) throw new Error("找不到 " + name);
  let d = 0, k = from.indexOf("{", i);
  for(; k < from.length; k++){
    if(from[k] === '{') d++;
    else if(from[k] === '}'){ d--; if(!d) return from.slice(i, k + 1) + ";"; }
  }
  throw new Error(name + " 花括号没配平");
}
function grabFn(name, from){
  const i = from.indexOf("function " + name + "(");
  if(i < 0) throw new Error("找不到 " + name);
  let d = 0, k = from.indexOf("{", i);
  for(; k < from.length; k++){
    if(from[k] === '{') d++;
    else if(from[k] === '}'){ d--; if(!d) return from.slice(i, k + 1) + "\n"; }
  }
  throw new Error(name + " 花括号没配平");
}

const ctx = { console, Math, Number, String, Array, Object, JSON, RegExp, isFinite, isNaN, parseInt, parseFloat,
  LYRIC_LAT: /[A-Za-z\u00C0-\u024F]/ };
vm.createContext(ctx);
vm.runInContext(
  grabFn("shClockPad", ttml) + grabFn("shLrcClock", ttml) + "\n" +
  grabObj("LyricFmt", w18) + "\n" + grabFn("lyricToLrc", w18) +
  "\n;globalThis.__x = { lyricToLrc, shLrcClock, shClockPad };", ctx);
const { lyricToLrc, shLrcClock, shClockPad } = ctx.__x;

let pass = 0, fail = 0;
const ok = (n, c, extra) => { if(c){ pass++; console.log("  PASS " + n); } else { fail++; console.log("  FAIL " + n + (extra ? " · " + extra : "")); } };
/* 一行一句、开口就是那一个时刻（cell 时长给 0，不让它往下累加） */
const 一行 = ms => ({ lines: [{ at: ms, clauses: [{ cells: [{ t: '词', ms: 0 }] }] }] });
const 头 = ms => /^\[([^\]]+)\]/.exec(lyricToLrc(一行(ms), ''))[1];
/* 改之前那一行的算法（写在这里只为对照，产品里已经没有它了） */
const 旧头 = ms => { const sec = ms / 1000;
  return shClockPad(Math.floor(sec / 60)) + ':' + shClockPad(Math.floor(sec % 60)) + '.' +
    shClockPad(Math.round(sec * 100 % 100)); };

console.log("词格导出逐句 LRC 的时标（真 lyricToLrc 搬进沙箱）\n");

/* ---------- 那几枚挨着的时刻（审查里点的 995~999 那一格） ---------- */
const 挨着 = [995, 996, 997, 998, 999];
挨着.forEach(ms => ok("1 " + ms + " 毫秒写成两位百分秒（新 " + 头(ms) + " · 旧 " + 旧头(ms) + "）",
  头(ms) === '00:00.99' && 旧头(ms) === '00:00.100'));
ok("2 旧算法在这五枚上全都写出三位小数（对照成立，说明这一格确实坏过）",
  挨着.every(ms => /^\d\d:\d\d\.100$/.test(旧头(ms))));
[[1995, '00:01.99'], [59999, '00:59.99'], [60999, '01:00.99'], [1234567, '20:34.56'], [0, '00:00.00'], [10, '00:00.01'], [9, '00:00.00']]
  .forEach(([ms, 应]) => ok("3 时刻 " + ms + " → [" + 头(ms) + "]（应 [" + 应 + "]）", 头(ms) === 应, 头(ms) + ' ≠ ' + 应));

/* ---------- 全扫：0~20000 毫秒一个不漏 ---------- */
const 不合 = [], 旧不合 = [];
for(let ms = 0; ms <= 20000; ms++){
  const s = 头(ms);
  if(!/^\d{2}:\d{2}\.\d{2}$/.test(s)) 不合.push(ms + '→' + s);
  if(!/^\d{2}:\d{2}\.\d{2}$/.test(旧头(ms))) 旧不合.push(ms);
}
ok("4 新写法 20,001 个时刻每一个都是 [mm:ss.xx]（不合法的 " + 不合.length + " 个）", 不合.length === 0, 不合.slice(0, 6).join(' '));
ok("5 同一万里旧算法有 " + 旧不合.length + " 个不合法（每一千毫秒里 995~999 那五格，理论 100 个；8995、9995 那两枚被浮点噪声凑回 99，实测 98）",
  旧不合.length === 98 && 旧不合[0] === 995 && 旧不合[旧不合.length - 1] === 19999 &&
  旧不合.every(ms => ms % 1000 >= 995), 旧不合.length);

/* ---------- 和共用那把尺对上（分钟补零这一头之外，百分秒必须是同一档） ---------- */
const 差 = [];
for(let ms = 0; ms <= 20000; ms += 7){
  const 尺 = shLrcClock(ms, 2);                              /* 尺给的是 m:ss.xx（分钟不补零） */
  const 新 = 头(ms);                                          /* 产品给的是 mm:ss.xx */
  const 同 = 新.replace(/^0(?=\d:)/, '');                     /* 只把补掉的那个 0 还原 */
  if(同 !== 尺) 差.push(ms + '：产品 ' + 新 + ' / 尺 ' + 尺);
}
ok("6 每一刻和 shLrcClock(ms,2) 算出的是同一个百分秒档（差 " + 差.length + " 个）", 差.length === 0, 差.slice(0, 5).join(' ‖ '));

/* ---------- 整份文件：多段、多行、带「起」的行、缺 at 的行、间奏空档 ---------- */
const doc = { lines: [
  { at: 995,  clauses: [{ cells: [{ t: '我', ms: 300 }, { t: '们', ms: 695 }] }] },              /* 一句走完正好 995 */
  { at: null, clauses: [{ cells: [{ t: '接', ms: 1000 }] }] },                                   /* 没「起」：吃上一句尾巴 → 1995 */
  { at: 60999, clauses: [{ cells: [{ t: '间', ms: 1 }] }, { cells: [{ t: '奏', ms: 0 }] }] },     /* 带「起」的那句照它本来的开口 */
  { at: 61999, clauses: [{ cells: [{ t: '后', ms: 0 }] }] } ] };
const 文本 = lyricToLrc(doc, '测试一首');
const 列 = 文本.split('\n');
console.log("  整份导出（头 + " + 列.length + " 行）：\n    " + 列.join('\n    '));
ok("7 头部只有 [ti:] 一行，整份不带 [by:] 署名（外40 他给的口径）",
  列[0] === '[ti:测试一首]' && !/\[by:/.test(文本) && /^\[00:0/.test(列[1]), 列[0] + ' / ' + 列[1]);
/* 头部有几行是口径的事，往下数句子的位置不该跟着漂 —— 只挑带时标的那几行来量。 */
const 句 = 列.filter(x => /^\[\d/.test(x));
ok("8 四句的开口：995 / 1995（接上一句尾巴）/ 60999（带「起」不硬接）/ 61999",
  句[0].startsWith('[00:00.99]') && 句[1].startsWith('[00:01.99]') && 句[2].startsWith('[01:00.99]') && 句[3].startsWith('[01:01.99]'),
  句.join(' '));
ok("9 词文本没被这一下改动带歪（每一句还是原来那几个字）",
  句[0].endsWith('我们') && 句[1].endsWith('接') && 句[2].endsWith('间 奏') && 句[3].endsWith('后'), 句.join(' '));
ok("10 整份里找不出一枚三位小数的时标", !/\.\d{3}\]/.test(文本));
ok("11 末尾一个换行、没有空行尾巴", 文本.endsWith('\n') && !文本.endsWith('\n\n'));

/* ---------- 坏值不许写负时刻 ---------- */
const 负 = lyricToLrc({ lines: [{ at: -5000, clauses: [{ cells: [{ t: '负', ms: 0 }] }] }] }, '');
ok("12 at 是负数时按 0 走，不写 [-0:00.-50]（现在写的是 " + 负.trim() + '）',
  负.trim() === '[00:00.00]负' && !/-/.test(负.trim().slice(1, 10)), 负.trim());
const 空 = lyricToLrc({ lines: [] }, '');
ok("13 空词格交回空串（不报一句带时标的空行）", 空 === '');

console.log("\n" + pass + " 过 " + fail + " 不过");
process.exit(fail ? 1 : 0);
