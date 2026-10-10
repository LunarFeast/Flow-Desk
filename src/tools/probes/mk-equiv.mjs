/* 生成一张对照页：同一批 TTML 用例分别喂「搬走前那一份」（git HEAD 里的 main.js）和
   「搬完那一份」（src/_shared/sh-ttml.js），两边结果逐字节比。
   只搬名字不改写法 —— 这一条不靠我说，靠这张页跑出来的结果说。 */
/* 外29 第 40 轮：探针搬进仓库 src\tools\probes\ 之后，生成的页面就近落在这旁边，不再写回会话临时目录 */
import { fileURLToPath as __u2p } from 'node:url';
const __HERE = __u2p(new URL('.', import.meta.url));

import fs from 'node:fs';
import path from 'node:path';
import { 音乐目录 } from '../本地路径.mjs';
import { spawnSync } from 'node:child_process';

const REPO = 'D:/Programs/Flow-Desk';
const show = spawnSync('git', ['-C', REPO, 'show', 'HEAD:data/plugins/music-remote/main.js'], { encoding:'buffer' });
if(show.status !== 0) throw new Error('git show 没拿到上一版');
const oldLines = show.stdout.toString('utf8').split('\n');
const OLD = [oldLines.slice(31, 45), oldLines.slice(57, 95), oldLines.slice(96, 266)].map(a => a.join('\n')).join('\n');
const NEWFILE = fs.readFileSync(REPO + '/src/_shared/sh-ttml.js', 'utf8');
const NEW = NEWFILE.split('\n').slice(9).join('\n');       /* 前 9 行是这张文件自己的抬头注释 */

/* 反向自查：把新文件的改名表倒回去，应该正好等于老的那一段 —— 这证明"只改了名字" */
const MAP = [['shTtmlParse', 'parseTtml'], ['shTtmlLine', 'musTtmlLine'], ['shTtmlAttrs', 'musAttrs'],
  ['shTtmlKids', 'musKids'], ['shTtmlKid', 'musKid'], ['shTtmlClose', 'musClose'], ['shTtmlFlow', 'musFlow'],
  ['shTtmlMs', 'musMs'], ['shTtmlLname', 'lname']];
let back = NEW;
for(const [a, b] of MAP) back = back.replace(new RegExp('(?<![\\w$])' + a + '(?![\\w$])', 'g'), b);
const same = back.replace(/\s+/g, ' ').trim() === OLD.replace(/\s+/g, ' ').trim();
console.log('改名倒回去和原文逐字一致：' + (same ? '是' : '不！'));
if(!same){
  const A = OLD.replace(/\s+/g, ' ').trim(), B = back.replace(/\s+/g, ' ').trim();
  let i = 0; while(i < A.length && A[i] === B[i]) i++;
  console.error('首个不同处 ' + i + '\n原文：' + JSON.stringify(A.slice(Math.max(0, i - 90), i + 90)) +
    '\n搬后：' + JSON.stringify(B.slice(Math.max(0, i - 90), i + 90)));
  process.exit(1);
}
for(const [tag, s] of [['OLD', OLD], ['NEW', NEW]]){
  if(/<\/script/i.test(s)) throw new Error(tag + ' 里含 </script，会撕开对照页的脚本块');
  /* 这两段是靠 ${OLD} 运行时插值进模板的，值里的反引号和 ${ 不会被再解析一遍，不必转义 */
}

/* 用例：从这两把尺各自的规矩里挑 —— 覆盖有 end / 没 end / 同戳多行 / 逐字 span /
   音节格并回整词 / 和声 x-bg / 行内翻译 / 罗马音 / 文件头注音 + 两行翻译 / 声部交替 / 裸空格文本节点 */
const CASES = [
  ['最小一行', `<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="0:01.000" end="0:03.500"><span begin="0:01.000" end="0:02.000">晨光</span><span begin="0:02.000" end="0:03.500">铺满</span></p></div></body></tt>`],
  ['p 没 end（行尾接下一个时刻）', `<tt><body><p begin="0:04.000"><span begin="0:04.000">A</span></p><p begin="0:09.000"><span begin="0:09.000">B</span></p></body></tt>`],
  ['末行没 end（补四秒）', `<tt><body><p begin="0:20.000"><span begin="0:20.000">尾</span></p></body></tt>`],
  ['同戳三行（原文 / 翻译 / *注）', `<tt><body><p begin="0:05.000" end="0:08.000"><span begin="0:05.000">原文</span></p><p begin="0:05.000" end="0:08.000"><span begin="0:05.000">译文</span></p><p begin="0:05.000" end="0:08.000"><span begin="0:05.000">*一条注释</span></p></body></tt>`],
  ['英文音节格并回整词', `<tt><body><p begin="0:01.000" end="0:05.000"><span begin="0:01.000" end="0:02.000">bu</span><span begin="0:02.000" end="0:03.000">sy</span> <span begin="0:03.000" end="0:04.000">bee</span><span begin="0:04.000" end="0:05.000">e</span></p></body></tt>`],
  ['撇号被单拆一格', `<tt><body><p begin="0:01.000" end="0:06.000"><span begin="0:01.000" end="0:02.000">that</span> <span begin="0:02.000" end="0:03.000">’</span><span begin="0:03.000" end="0:06.000">ll</span></p></body></tt>`],
  ['和声与翻译同排', `<tt><body><p begin="0:02.000" end="0:04.000"><span begin="0:02.000">主</span><span begin="0:03.000">唱</span><span ttm:role="x-bg" begin="0:02.000" end="0:04.000">和声字</span><span ttm:role="x-translation" begin="0:02.000">lead</span></p></body></tt>`],
  ['罗马音两副面孔', `<tt><body><p begin="0:01.000" end="0:02.000"><span begin="0:01.000">字</span><span ttm:role="x-roman" begin="0:01.000">ji</span></p><p begin="0:03.000" end="0:04.000"><span begin="0:03.000">词</span><span ttm:role="x-roman" begin="0:03.000">*这里是注释</span></p></body></tt>`],
  ['文件头注音 + 两行翻译', `<tt xmlns:itunes="http://music.apple.com/lyric-ttml-internal"><head><iTunesMetadata><transliterations><transliteration text="t1"><span begin="0:01.000" end="0:01.500">ni</span><span begin="0:01.500" end="0:02.000">hao</span></transliteration></transliterations><translations><translation text="t1">第一行译法</translation><translation text="t1">*一条注释</translation></translations></iTunesMetadata></head><body><p begin="0:01.000" end="0:03.000" itunes:key="t1"><span begin="0:01.000" end="0:01.500">你</span><span begin="0:01.500" end="0:02.000">好</span></p></body></tt>`],
  ['注音段数对不上（按时间戳归属）', `<tt><head><iTunesMetadata><transliterations><transliteration text="k1"><span begin="0:00.500">a</span><span begin="0:02.500">b</span><span begin="0:09.000">c</span></transliteration></transliterations></iTunesMetadata></head><body><p begin="0:01.000" end="0:03.000" itunes:key="k1"><span begin="0:01.000">一</span><span begin="0:02.000">二</span></p></body></tt>`],
  ['两个声部交替 + 对唱', `<tt><head><ttm:agent type="person" xml:id="v1"><ttm:name>甲</ttm:name></ttm:agent><ttm:agent type="other" xml:id="v2"><ttm:name>乙</ttm:name></ttm:agent></head><body><p begin="0:01.000" end="0:02.000" ttm:agent="v1"><span begin="0:01.000">A</span></p><p begin="0:02.000" end="0:03.000" ttm:agent="v2"><span begin="0:02.000">B</span></p><p begin="0:02.500" end="0:04.000" ttm:agent="v1"><span begin="0:02.500">C</span></p></body></tt>`],
  ['一个声部（不该摆声部名册）', `<tt><head><ttm:agent type="person" xml:id="v1"><ttm:name>独</ttm:name></ttm:agent></head><body><p begin="0:01.000" end="0:02.000" ttm:agent="v1"><span begin="0:01.000">只</span></p><p begin="0:03.000" end="0:04.000" ttm:agent="v1"><span begin="0:03.000">一个</span></p></body></tt>`],
  ['span 缺 begin / 缺 end（musFlow 两头补）', `<tt><body><p begin="0:10.000" end="0:14.000"><span>甲</span><span begin="0:12.000">乙</span><span begin="0:13.000">丙</span></p></body></tt>`],
  ['裸文本开头就没有字（不成行）', `<tt><body><p begin="0:01.000" end="0:02.000">   </p><p begin="0:03.000" end="0:04.000"><span begin="0:03.000">有字</span></p></body></tt>`],
  ['秒数写法与长写法混着', `<tt><body><p begin="65.120" end="0:01:10.500"><span begin="65.120">混</span><span begin="0:01:08.000" end="70.500">合</span></p></body></tt>`]
];

/* 真料：他库里那些侧车 .ttml 一份不落，全都塞进对照页逐首比 —— 手写用例只当补边缘，
   不能拿它替代真文件（一共不到 1MB，跑得动）。那一格住哪儿写在 src\tools\本地路径.cjs（不进仓）。 */
const REAL = [];
(function walk(d, depth){
  if(depth > 4) return;
  if(!d || !fs.existsSync(d)) return;
  for(const e of fs.readdirSync(d, { withFileTypes:true })){
    const p = path.join(d, e.name);
    if(e.isDirectory()) walk(p, depth + 1);
    else if(/\.ttml$/i.test(e.name)){
      const t = fs.readFileSync(p, 'utf8');
      if(t.includes('</script')) { console.log('跳过（含 </script 会撕页）：' + e.name); continue; }
      REAL.push(['真文件 · ' + e.name, t]);
    }
  }
})(音乐目录, 0);
console.log('真歌词塞进对照页：' + REAL.length + ' 份');

const ALL = CASES.concat(REAL);
const html = `<!doctype html><meta charset="utf-8"><title>TTML 搬迁前后对照</title>
<body><pre id="o" style="font:13px/1.6 monospace;white-space:pre-wrap"></pre>
<script>/* ===== 搬走前那一份（git HEAD 的 main.js 里原样切的） ===== */
function oldScope(){
${OLD}
  return { parse:parseTtml, ms:musMs, flow:musFlow, close:musClose };
}
/* ===== 搬完后那一份（src/_shared/sh-ttml.js 原样切的，名字是 shTtml*） ===== */
function newScope(){
${NEW}
  return { parse:shTtmlParse, ms:shTtmlMs, flow:shTtmlFlow, close:shTtmlClose };
}
const O = oldScope(), N = newScope();
const CASES = ${JSON.stringify(ALL)};
const out = [];
let bad = 0, errs = 0;
for(const [nm, txt] of CASES){
  let a, b;
  try{ a = JSON.stringify(O.parse(txt)); }catch(e){ a = 'ERR ' + e.message; }
  try{ b = JSON.stringify(N.parse(txt)); }catch(e){ b = 'ERR ' + e.message; }
  const errBoth = /^ERR/.test(String(a)) || /^ERR/.test(String(b));
  let n = '?';
  try{ const j = JSON.parse(a); n = (j && j.lines ? j.lines.length : 0) + ' 行' + (j && j.timed ? (j.worded ? ' 逐字' : ' 整行') : ' 没戳'); }catch(e){}
  const ok = a === b && !errBoth;
  if(!ok) bad++;
  if(errBoth) errs++;
  out.push((ok ? 'PASS ' : (errBoth ? '没跑到 ' : 'FAIL ')) + nm + '  ' + n + (ok ? '' : '\\n  搬前：' + String(a).slice(0, 700) + '\\n  搬后：' + String(b).slice(0, 700)));
}
/* 三枚公用的尺单独也各测一发（parseLrc 那条路靠它们，不走 parse）。
   每一发都包 try： fixture 自己写坏了要报 FAIL，不许把整张页带停（第一版就是这么栽的 —— musClose 要 words）。 */
for(const [nm, arg] of [['ms：0:25.535', ['0:25.535']], ['ms：65.120', ['65.120']], ['ms：0:01:10.500', ['0:01:10.500']], ['ms：空', ['']], ['ms：乱写', ['abc']]]){
  let a, b;
  try{ a = String(O.ms.apply(null, arg)); }catch(e){ a = 'ERR ' + e.message; }
  try{ b = String(N.ms.apply(null, arg)); }catch(e){ b = 'ERR ' + e.message; }
  if(a !== b){ bad++; out.push('FAIL ms ' + nm + ' 搬前 ' + a + ' / 搬后 ' + b); } else out.push('PASS ms ' + nm + ' → ' + a);
}
const L = [{ ms:1000, words:[] }, { ms:1000, words:[] }, { ms:2500, words:[] }, { ms:9000, words:[] }];
let LA, LB;
try{ LA = JSON.stringify(O.close(L.map(x => ({ ...x, words:[] })))); }catch(e){ LA = 'ERR ' + e.message; }
try{ LB = JSON.stringify(N.close(L.map(x => ({ ...x, words:[] })))); }catch(e){ LB = 'ERR ' + e.message; }
if(LA !== LB){ bad++; out.push('FAIL close 同戳多行\\n  ' + LA + '\\n  ' + LB); } else out.push('PASS close 同戳多行 → ' + LA);
const F = [{ ms:NaN, ms2:NaN, text:'甲' }, { ms:2000, ms2:NaN, text:'乙' }, { ms:NaN, ms2:NaN, text:'丙' }];
let FA, FB;
try{ FA = JSON.stringify(O.flow(F.map(x => ({ ...x })), 1000, 5000)); }catch(e){ FA = 'ERR ' + e.message; }
try{ FB = JSON.stringify(N.flow(F.map(x => ({ ...x })), 1000, 5000)); }catch(e){ FB = 'ERR ' + e.message; }
if(FA !== FB){ bad++; out.push('FAIL flow\\n  ' + FA + '\\n  ' + FB); } else out.push('PASS flow → ' + FB);
document.getElementById('o').textContent = out.join('\\n') + '\\n\\n共 ' + (CASES.length + 8) + ' 项，其中 FAIL ' + bad + ' 项（两边同时报错、根本没跑到的 ' + errs + ' 项）';
window.__RESULT = { lines: out, bad };
</script></body>`;
fs.writeFileSync(__HERE + 'ttml-equiv.html', html);
console.log('对照页已写出：ttml-equiv.html（' + CASES.length + ' 个 parse 用例 + 8 项公用尺单测）');
