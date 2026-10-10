/* 外32 图11：词格导入新增「从歌曲标签提取歌词」。
   这一台盯的是那条路接没接通、剥时间戳那一只手咬不咬得住，不去重测音乐遥控器那一份字节解析
   （ID3 / Vorbis / MP4 / Matroska 那些判法在 USLT 那一台里，见 docs\述职.md 外30 第 13 条那一段）。
   ----------
   源码全是切真身，不抄第二份：LyricFmt（明文那一份的读者）、lyricTagLines（标签那份 → 「词 = 」行）、
   MusTag（_shared 那一格）、sh-load 发下去的那一句、music-remote 挂上来的那一句、词格那一排新按钮。 */
import fs from 'node:fs';
import { 探针沙盒 } from '../本地路径.mjs';

const ROOT = 'D:/Programs/Flow-Desk/';
const rd = p => fs.readFileSync(ROOT + p, 'utf8');
function tillBrace(src, head){
  const i = src.indexOf(head); if(i < 0) throw new Error('源码里找不到「' + head + '」');
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
function tillFuncEnd(src, head){
  const i = src.indexOf(head); if(i < 0) throw new Error('源码里找不到「' + head + '」');
  let d = 0, j = src.indexOf('{', i), 起 = i;
  for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d) return src.slice(起, j + 1); } }
  throw new Error('函数没收口：' + head);
}

const LYR = rd('src/_wnw/src/w18-lyric.js');
const MUS = rd('src/_shared/sh-mus.js');
const LOAD = rd('src/_shared/sh-load.js');
const TOF = rd('data/plugins/music-remote/main.js');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if(c){ pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (extra ? ' · ' + extra : '')); } };

/* ---------- 一、那条路接没接通（四段各钉一处） ---------- */
ok('1 共用那一格在：MusTag 有 use / ready / from 三样，from 没挂上读者时回 null 而不是抛',
  /const MusTag = \{/.test(MUS) && /use\(o\)\{ if\(o && typeof o\.from === 'function'\) this\.r = o/.test(MUS) &&
  /get ready\(\)\{ return !!this\.r; \}/.test(MUS) &&
  /from\(fh, name\)\{ return this\.r \? this\.r\.from\(fh, name\) : Promise\.resolve\(null\); \}/.test(MUS));
ok('2 组件那头收得到这一格：sh-load 把 MusTag 发进 ctx（和 MusClock 同一条路，组件拿不到整页作用域的顶层名字）',
  /if\(typeof MusTag !== 'undefined'\) ctx\.tag = MusTag;/.test(LOAD));
ok('3 音乐遥控器起来那一趟把自己的读者挂上来，挂的是那一份 MusEmb（不是另写一份解析）',
  /if\(K\.tag\) K\.tag\.use\(MusEmb\);/.test(TOF) && /const MusEmb = \{/.test(TOF));
ok('4 词格那一排多了「从歌曲标签」这一枚，开的是音频那只挑文件窗（不是原来挑 ttml 的那一只）',
  /btn\('从歌曲标签'/.test(LYR) && /audio\.click\(\)/.test(LYR) &&
  /const audio = h\('input', \{ type:'file', accept:'\.mp3,\.m4a/.test(LYR) &&
  /const file = h\('input', \{ type:'file', accept:'\.ttml,\.xml,\.json,\.txt'/.test(LYR));
{ const 段 = tillFuncEnd(LYR, 'async importTag(f){');
  ok('5 importTag 那一手：没连上那一家先说实话（不假装读到空歌词）、递的是只读区间的口子（不整首读进内存）、' +
     '铺法走现成的明文那一条（LyricFmt.parse），不另建一套文档形状',
    /没连上音乐遥控器/.test(段) && /readRange:async/.test(段) && /f\.slice\(s, s \+ l\)/.test(段) &&
    /lyricTagLines\(原文\)/.test(段) && /LyricFmt\.parse\(句\)/.test(段) && /this\.push\(\)/.test(段), 段.slice(0, 90)); }

/* ---------- 二、真跑一遍：标签那份文本 → 一格一字的行 ---------- */
/* 顶层那几枚 LYRIC_* 常量：一行一个的照行取，对象那种（LYRIC_EXPORTS 那一串）要连整个块一起取，
   只掐头一行会把后面那半截语法撕烂 */
const 常量 = [...LYR.matchAll(/^const (LYRIC_[A-Z0-9_]+) = /gm)].map(m => {
  const 头 = m[0];
  return LYR[m.index + 头.length] === '{' ? tillBrace(LYR, 头) : LYR.slice(m.index, LYR.indexOf('\n', m.index));
}).join('\n');
const 剥 = tillFuncEnd(LYR, 'function lyricTagLines(text){');
const FMT = tillBrace(LYR, 'const LyricFmt = {');
/* 临时那份落在他的探针沙盒里，不落仓库 —— 仓库那一棵只收源码，跑完就删。
   那一格住哪儿写在 src\tools\本地路径.cjs（那颗不进仓）；没配就这一台自己不跑 */
if(!探针沙盒){ console.log('这台作废：没配探针沙盒（src\\tools\\本地路径.cjs 里那一格），临时那份没地方放'); process.exit(77); }
const mod = 探针沙盒 + '/_taglyric-tmp.mjs';
fs.writeFileSync(mod, 常量 + '\n' + FMT + '\n' + 剥 + '\nexport { LyricFmt, lyricTagLines };\n');
try{
  const { LyricFmt, lyricTagLines } = await import('file:///' + encodeURI(mod.replace(/\\/g, '/')));
  const 标签原文 = ['[00:00.00]', '[ti:青空]', '[ar:某人]', '[00:12.34]第一句词',
    '[00:15.00][00:15.50]两个戳一句词', '最后一行没戳', '  ', '[01:02.00] 尾行带空格'].join('\n');
  const 句 = lyricTagLines(标签原文);
  ok('6 剥得干净：元数据行、只有时间戳那一行（间奏）、空白行都不成句；一句一行，戳全掉了',
    句.length === 4 && 句[0] === '第一句词' && 句[1] === '两个戳一句词' && 句[2] === '最后一行没戳' && 句[3] === '尾行带空格',
    JSON.stringify(句));
  const d = LyricFmt.parse(句.map(s => '词 = ' + s).join('\n'));
  const 每行 = d.lines.map(L2 => L2.clauses.reduce((a, c) => a.concat(c.cells.map(x => x.t)), []));
  ok('7 铺得对：四行、一格一个字，字里不残留方括号和数字',
    d.lines.length === 4 && 每行[0].join('') === '第一句词' && 每行[0].length === 4 &&
    每行.every(cs => cs.length && cs.every(t => t.length === 1 && !/[\[\]:]/.test(t))), JSON.stringify(每行));
  const 英 = lyricTagLines('[00:12.34]hello blue world');
  const de = LyricFmt.parse(英.map(s => '词 = ' + s).join('\n'));
  const 词 = de.lines[0].clauses.flatMap(c => c.cells.map(x => x.t));
  ok('8 英文那一种按词成格，不劈字母、不吞空格：hello blue world → 三格（一格一个词）',
    词.length === 3 && 词[0] === 'hello' && 词[1] === 'blue' && 词[2] === 'world', JSON.stringify(词));
  ok('9 一个戳都不剩：拿剥完的那四句再剥一遍还是那四句（幂等，不会剥出半个括号）',
    lyricTagLines(句.join('\n')).join('\n') === 句.join('\n'));
}catch(e){ ok('10 真跑这一段没崩', false, String((e && e.message) || e)); }
finally{ fs.rmSync(mod, { force:true }); }

console.log('\ntest-taglyric：' + pass + ' 过 ' + fail + ' 不过');
process.exit(fail ? 1 : 0);
