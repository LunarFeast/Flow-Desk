/* 第二张对照页：验「LRC / eLRC 那条路 + 转发接线」。
   上一版按函数名猜着切，漏了 musLrcMs —— 两边都抛同一个错，a === b 就成了，12 项「PASS」其实是都没跑到。
   这一版改两件事：① 按段切（一、时间 + 三、LRC 整段），不猜名字；② 加一道闸，两边同时报错的那一项单独记「没跑到」，
   并且当场要求 parseLrc 真交出结构（行数 > 0 或明说没戳），共用层那枚 musClose 必须被叫到。 */
/* 外29 第 40 轮：探针搬进仓库 src\tools\probes\ 之后，生成的页面就近落在这旁边，不再写回会话临时目录 */
import { fileURLToPath as __u2p } from 'node:url';
const __HERE = __u2p(new URL('.', import.meta.url));

import fs from 'node:fs';
import path from 'node:path';
import { 音乐目录 } from '../本地路径.mjs';
import { spawnSync } from 'node:child_process';

const REPO = 'D:/Programs/Flow-Desk';
const HEAD = spawnSync('git', ['-C', REPO, 'show', 'HEAD:data/plugins/music-remote/main.js'], { encoding:'buffer' }).stdout.toString('utf8');
const NOW = fs.readFileSync(REPO + '/data/plugins/music-remote/main.js', 'utf8');
const SHARED = fs.readFileSync(REPO + '/src/_shared/sh-ttml.js', 'utf8');
const L = s => s.split('\n');

/* 按段整切：一、时间 → 三、LRC 结束（四、内嵌歌词 那一行之前），两边各按自己的行号 */
function sliceBySection(src, marks){
  const ls = L(src);
  const a = ls.findIndex(l => l.startsWith(marks[0]));
  if(a < 0) throw new Error('找不到起点段标记 ' + marks[0]);
  const stop = ls.findIndex((l, i) => i > a && l.startsWith(marks[1]));
  if(stop < 0) throw new Error('找不到段尾标记 ' + marks[1]);
  return ls.slice(a, stop).join('\n');
}
const OLD = sliceBySection(HEAD, ['/* ---------- 一、时间', '/* ---------- 四、内嵌歌词']);
const NEWBODY = sliceBySection(NOW, ['/* ---------- 一、时间', '/* ---------- 四、内嵌歌词']);
/* 新那一份里已经不含 TTML 与时间算式，得把共用层那份拼进来，再补一份 K 桩（close 带计数器） */
const FORW = L(NOW).filter(l => (l.startsWith('const mus') && l.includes('K.ttml')) || l.startsWith('const parseTtml ='));
if(FORW.length !== 2) throw new Error('转发枚数不对，现在是 ' + FORW.length + ' 行：' + FORW.join(' / '));
const NEW = `window.__hits = 0;
const K = { ttml:{ ms:shTtmlMs, flow:shTtmlFlow,
  close:(...a) => { window.__hits++; return shTtmlClose(...a); },
  parse:(...a) => shTtmlParse(...a) } };
` + SHARED + '\n' + NEWBODY;
console.log('OLD 段 ' + L(OLD).length + ' 行 / NEW 段 ' + L(NEW).length + ' 行（含共用层 ' + L(SHARED).length + ' 行）');
console.log('转发枚：\n  ' + FORW.join('\n  '));

const REAL = [];
(function walk(d, depth){
  if(depth > 4) return;
  if(!d || !fs.existsSync(d)) return;
  for(const e of fs.readdirSync(d, { withFileTypes:true })){
    const p = path.join(d, e.name);
    if(e.isDirectory()) walk(p, depth + 1);
    else if(/\.(lrc|elrc)$/i.test(e.name)){
      const t = fs.readFileSync(p, 'utf8');
      if(t.includes('</script')) continue;
      REAL.push(['真文件 · ' + e.name, t]);
    }
  }
})(音乐目录, 0);
const SYN = [
  ['多个时间戳同一句', '[00:10.00][01:20.00]同一句在两个地方\n[00:12.00]下一句\n'],
  ['eLRC 逐字打点', '[00:10.00]<00:10.00>晨<00:10.40>光<00:10.90>铺<00:11.20>满<00:11.60>长<00:12.00>江\n[00:14.00]下一句\n'],
  ['元数据 + offset（正值提前）', '[ti:题]\n[ar:人]\n[by:某]\n[offset:300]\n[00:10.00]甲\n[00:13.00]乙\n'],
  ['同戳两行（原文 + *注）', '[00:10.00]原文一行\n[00:10.00]*一条注释\n[00:14.00]下一句\n'],
  ['没一个时间戳（纯文本）', '这一行没戳\n这一行也没有\n'],
  ['全角冒号那种怪写法', '[00：10.00]怪写法\n[00:13.00]正常写法\n'],
  ['末尾没换行 + 中间空行', '[00:01.00]头\n\n[00:05.00]尾'],
  ['同一戳挂三行（原文 / 译文 / 注）', '[00:20.00]原文\n[00:20.00]译文\n[00:20.00]*注一条\n[00:25.00]下一句\n']
];
const CASES = SYN.concat(REAL);
for(const [tag, s] of [['OLD', OLD], ['NEW', NEW], ['CASES', JSON.stringify(CASES)]])
  if(s.includes('</script')) throw new Error(tag + ' 里含 </script，会撕开对照页');

const html = ['<!doctype html><meta charset="utf-8"><title>LRC 那条路前后对照</title>',
  '<body><pre id="o" style="font:13px/1.6 monospace;white-space:pre-wrap"></pre><script>',
  'function oldScope(){', OLD, '  return { lrc:parseLrc, sniff:musSniff };', '}',
  'function newScope(){', NEW, '  return { lrc:parseLrc, sniff:musSniff };', '}',
  'const O = oldScope(), N = newScope();',
  'const CASES = ' + JSON.stringify(CASES) + ';',
  'const out = []; let bad = 0, errs = 0, ran = 0;',
  'for(const [nm, txt] of CASES){',
  '  let a, b, sa, sb;',
  '  try{ a = JSON.stringify(O.lrc(txt)); }catch(e){ a = "ERR " + e.message; }',
  '  try{ b = JSON.stringify(N.lrc(txt)); }catch(e){ b = "ERR " + e.message; }',
  '  try{ sa = String(O.sniff(txt)); }catch(e){ sa = "ERR " + e.message; }',
  '  try{ sb = String(N.sniff(txt)); }catch(e){ sb = "ERR " + e.message; }',
  '  const errBoth = /^ERR/.test(String(a)) || /^ERR/.test(String(b));',
  '  let n = "?"; try{ const j = JSON.parse(a); n = (j && j.lines ? j.lines.length : 0) + " 行" + (j && j.timed ? "" : "（没戳）"); }catch(e){}',
  '  if(!errBoth) ran++;',
  '  const ok = a === b && !errBoth;',
  '  if(!ok) bad++; if(errBoth) errs++;',
  '  out.push((ok ? "PASS " : (errBoth ? "没跑到 " : "FAIL ")) + nm + "  嗅 " + sa + "  " + n',
  '    + (ok ? "" : "\\n  搬前：" + String(a).slice(0, 700) + "\\n  搬后：" + String(b).slice(0, 700)));',
  '}',
  'const hh = window.__hits || 0;',
  /* 三道总闸：一项没跑到都不算过 */
  'out.push((hh > 0 ? "PASS " : "FAIL ") + "共用层那枚 musClose 真被叫到：这一趟 " + hh + " 次");',
  'out.push((errs === 0 ? "PASS " : "FAIL ") + "没有一项是两边同时报错（真跑出结构的 " + ran + " / " + CASES.length + " 条）");',
  'if(hh <= 0 || errs > 0) bad++;',
  'document.getElementById("o").textContent = out.join("\\n") + "\\n\\n共 " + out.length + " 项，FAIL " + bad + " 项（用例 " + CASES.length + " 条）";',
  'window.__RESULT = { lines: out, bad, errs };',
  '</script></body>'].join('\n');
fs.writeFileSync(__HERE + 'lrc-equiv.html', html);
console.log('真 LRC ' + REAL.length + ' 份 + 手写 ' + SYN.length + ' 条 → lrc-equiv.html');
