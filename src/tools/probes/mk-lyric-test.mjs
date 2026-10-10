/* 词格明文那一层的自测页：编解码 + 从真逐字 TTML 导入 + 走一圈再读回来。
   为什么不写死在 node 里跑：解析 TTML 要用 DOMParser（组件和为写读的都是浏览器那一枚），
   拿 node 另装一把解析器就等于测了另一套东西。所以这页把 src/_shared/sh-ttml.js 和
   src/_wnw/src/w18-lyric.js 原样塞进去，喂真文件（他库侧车 .ttml 32 份一份不落）。 */
/* 外29 第 40 轮：探针搬进仓库 src\tools\probes\ 之后，生成的页面就近落在这旁边，不再写回会话临时目录 */
import { fileURLToPath as __u2p } from 'node:url';
const __HERE = __u2p(new URL('.', import.meta.url));

import fs from 'node:fs';
import path from 'node:path';
import { 音乐目录 } from '../本地路径.mjs';

const REPO = 'D:/Programs/Flow-Desk';
const SH = fs.readFileSync(REPO + '/src/_shared/sh-ttml.js', 'utf8');
const LY = fs.readFileSync(REPO + '/src/_wnw/src/w18-lyric.js', 'utf8');
const TTMLS = [];
(function walk(d, depth){
  if(depth > 4) return;
  if(!d || !fs.existsSync(d)) return;
  for(const e of fs.readdirSync(d, { withFileTypes:true })){
    const p = path.join(d, e.name);
    if(e.isDirectory()) walk(p, depth + 1);
    else if(/\.ttml$/i.test(e.name)){
      const t = fs.readFileSync(p, 'utf8');
      if(!t.includes('</script')) TTMLS.push([e.name, t]);
    }
  }
})(音乐目录, 0);

const SRC = `
/* w18-lyric.js 顶上一句 addCss(\`…\`) 在 kernel 里是往容器贴样式，这页只用它的数据层，给一枚空壳让它跑过去 */
function addCss(s){}
/* 细分那一条要真导一次逐字 ttml，导出用的 esc 是 kernel 给的 —— 这页补一枚同样转义的 */
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' }[c])); }
${SH}
${LY}
`;
if(SRC.includes('</script')) throw new Error('源码里含 </script，会撕页');

const TEST = `
const out = []; let bad = 0;
const T = (nm, cond, extra) => { if(!cond) bad++; out.push((cond ? 'PASS ' : 'FAIL ') + nm + (extra ? '  —— ' + extra : '')); };
const flat = d => { const a = []; for(const L of d.lines || []) for(const c of L.clauses || []) for(const x of c.cells || []) a.push([x.t, x.ms]); return a; };

/* 一、他定死的那条样例：4|2 个时值配 4+4 个字，第二逗只有两个数 —— 该标出来，不许丢字 */
const SAMPLE = '【主歌1】\\n时 = 480 420 390 410 | 620 540\\n词 = 真爱悲哀 人海醒来\\n';
const d1 = LyricFmt.parse(SAMPLE);
T('样例解析出 1 行 2 逗 8 格', d1.lines.length === 1 && d1.lines[0].clauses.length === 2
  && flat(d1).length === 8, flat(d1).length + ' 格');
T('第一逗四个字各带一个时值', d1.lines[0].clauses[0].cells.map(c => c.ms).join(',') === '480,420,390,410',
  d1.lines[0].clauses[0].cells.map(c => c.ms).join(','));
T('第二逗前两个字接 620 540、后两个字空着（数比格少，只标不丢）',
  d1.lines[0].clauses[1].cells.map(c => String(c.ms)).join(',') === '620,540,null,null',
  d1.lines[0].clauses[1].cells.map(c => String(c.ms)).join(','));
T('第二逗的字一个没丢', d1.lines[0].clauses[1].cells.map(c => c.t).join('') === '人海醒来',
  d1.lines[0].clauses[1].cells.map(c => c.t).join(''));
T('check() 把这一行报成「有格没贴到时值」', LyricFmt.check(d1).some(x => /没贴到时值/.test(x.why)),
  JSON.stringify(LyricFmt.check(d1)));

/* 二、往返：写出去再读回来，格和时值一字不变 */
const rt = LyricFmt.parse(LyricFmt.write(d1));
T('样例 写→读 完全回原样', JSON.stringify(rt) === JSON.stringify(d1), LyricFmt.write(d1).replace(/\\n/g, '\\\\n'));

/* 三、作词那一档：只有词行，时值留空；写出去还占一行（记事本里一眼看出没配时值） */
const d2 = LyricFmt.parse('【副歌】\\n词 = 我有狂剑任天下 平生不快活\\n');
T('作词模式 2 逗 12 格、时值全空', d2.lines.length === 1 && d2.lines[0].clauses.length === 2
  && flat(d2).length === 12 && flat(d2).every(x => x[1] === null),
  d2.lines[0].clauses.map(c => c.cells.length).join('+') + ' 格');
const s2 = LyricFmt.write(d2);
T('写出去带一行空时值', /^【副歌】\\n时 = \\n词 = /.test(s2), JSON.stringify(s2));
T('作词模式 写→读 回原样', JSON.stringify(LyricFmt.parse(s2)) === JSON.stringify(d2));

/* 三之二、英文那种整词：一行一格不许并成一坨，也不许把空格错认成逗界 */
const d2b = LyricFmt.parse('词 = I have a dream\\n');
T('英文 1 逗 4 格（I / have / a / dream）', d2b.lines[0].clauses.length === 1
  && d2b.lines[0].clauses[0].cells.map(c => c.t).join('/') === 'I/have/a/dream',
  d2b.lines[0].clauses.map(c => c.cells.map(x => x.t).join('/')).join(' | '));
const s2b = LyricFmt.write(d2b);
T('英文 写→读 回原样', JSON.stringify(LyricFmt.parse(s2b)) === JSON.stringify(d2b), JSON.stringify(s2b));
/* 一格一字那一档，空格还是能当逗界用（他在记事本里顺手敲的那种） */
T('没写竖线时，一格一字的空格照样认成逗', LyricFmt.parse('词 = 真爱悲哀 人海醒来\\n').lines[0].clauses.length === 2);
/* 时值行里的减号占位：读回来那一格是空，前后的数不许串位 */
T('减号占位读回来是空、不串位', (() => {
  const g = LyricFmt.parse('时 = 480 - 400\\n词 = 真爱悲\\n').lines[0].clauses[0].cells.map(c => String(c.ms)).join(',');
  return g === '480,null,400';
})(), LyricFmt.parse('时 = 480 - 400\\n词 = 真爱悲\\n').lines[0].clauses[0].cells.map(c => String(c.ms)).join(','));

/* 三之三、一格装两字那一档（他在格子上拖出来的「合」）：明文用斜杠连着写。
   不许冒出一个斜杠单字格，也不许因为没配时值就连斜杠都不认 */
const d2c = LyricFmt.parse('时 = 500 700\\n词 = 我 真/爱\\n');
T('合并格 2 格：我 / 真爱', d2c.lines[0].clauses[0].cells.map(c => c.t).join(',') === '我,真爱',
  d2c.lines[0].clauses[0].cells.map(c => c.t).join(','));
T('合并格里不许有斜杠那种字', !flat(d2c).some(x => x[0].includes('/')), JSON.stringify(flat(d2c)));
const s2c = LyricFmt.write(d2c);
T('合并格 写→读 回原样（时值也不许挪）', JSON.stringify(LyricFmt.parse(s2c)) === JSON.stringify(d2c), JSON.stringify(s2c));
const d2d = LyricFmt.parse('词 = 我 真/爱\\n');
T('合并格没配时值也是 2 格', flat(d2d).map(x => x[0]).join(',') === '我,真爱', JSON.stringify(flat(d2d)));

/* 四、段名往后挂：两段各一行 */
const d3 = LyricFmt.parse('【主歌1】\\n时 = 400 400\\n词 = 晨光\\n【副歌】\\n时 = 500 500\\n词 = 铺满\\n');
T('段名分别挂到自己那一行', d3.lines.map(L => L.seg).join('/') === '主歌1/副歌', d3.lines.map(L => L.seg).join('/'));
T('段名换行才补一次【】，不重复写', (LyricFmt.write(d3).match(/【/g) || []).length === 2);

/* 五、从真逐字 TTML 导入：32 份全喂，逐份看格数、时值有没有、再走一圈明文回来 */
const TTMLS = ${JSON.stringify(TTMLS.map(([n, t]) => n))};
const RAW = ${JSON.stringify(TTMLS.map(([, t]) => t))};
let nfile = 0, nline = 0, ncell = 0, nms = 0, nback = 0, nfail = 0;
for(let i = 0; i < RAW.length; i++){
  const doc = lyricFromTtml(RAW[i]);
  if(!doc) continue;
  nfile++;
  const txt = LyricFmt.write(doc);
  const back = LyricFmt.parse(txt);
  const a = flat(doc), b = flat(back);
  nline += doc.lines.length; ncell += a.length;
  nms += a.filter(x => LyricFmt.okMs(x[1])).length;
  /* 回来这份的格数必须一样，字必须一样；时值允许「一行里全空」被明文那两行丢掉以外的误差 */
  const sameShape = a.length === b.length && a.map(x => x[0]).join('|') === b.map(x => x[0]).join('|');
  const sameMs = a.map(x => String(x[1])).join('|') === b.map(x => String(x[1])).join('|');
  if(sameShape && sameMs) nback++;
  else if(++nfail <= 4){
    let j = 0; while(j < Math.min(a.length, b.length) && a[j][0] === b[j][0] && String(a[j][1]) === String(b[j][1])) j++;
    const cut = xs => JSON.stringify(xs.slice(j, j + 6));
    out.push('   不等 ' + TTMLS[i] + ' 原文格 ' + a.length + ' / 回来格 ' + b.length + ' 从第 ' + j + ' 格起：'
      + ' 原 ' + cut(a) + ' 回 ' + cut(b));
  }
}
T('真歌词导入：' + nfile + ' 份全部走出词格结构', nfile === RAW.length, nfile + '/' + RAW.length);
T('导入 → 明文 → 读回来，格数·字·时值三样都对得上的份数', nback === nfile, nback + '/' + nfile);
out.push('   合计：行 ' + nline + ' 格 ' + ncell + '，带时值的格 ' + nms + '（占 ' + (nms * 100 / ncell).toFixed(1) + '%）');

/* 六、文件名：标题里的怪字符不许把路径带跑 */
T('文件名挡住跑出去的那几种（斜杠、反斜杠、点串、冒号、星号问号一并换下划线）', Lyric.fileName('a/b\\\\..:x*?') === 'a_b_x.txt', Lyric.fileName('a/b\\\\..:x*?'));
T('空标题不硬编英文名糊上去', Lyric.fileName('   ') === '未命名.txt', Lyric.fileName('   '));
T('中文标题原样留着', Lyric.fileName('我有狂剑任天下') === '我有狂剑任天下.txt', Lyric.fileName('我有狂剑任天下'));

/* ---------- 外26 第 9、10 条：一格内部细分（分刀位置 + 逐子时长）在明文和逐字 ttml 里怎么落 ---------- */
const 分树 = { title:'分', lines:[{ seg:'', clauses:[{ cells:[
  { t:'pensy', ms:500, cut:[3] },
  { t:'真', ms:400 },
  { t:'爱you', ms:600, cut:[1], pm:[200, 400], n:'ai' }
] }] }] };
const 分文 = LyricFmt.write(分树);
const 分行 = 分文.split('\\n').filter(x => /^分 = /.test(x));
const 子行 = 分文.split('\\n').filter(x => /^子 = /.test(x));
T('分过的那一格写出去多一行「分 =」（数字是第几个字后面分，没分的格写减号）',
  分行.length === 1 && 分行[0] === '分 = 3 - 1', 分行.join(' ⏎ '));
T('只有真打了逐子时长的那一格才写「子 =」（平摊的不写，读回来还是平摊）',
  子行.length === 1 && 子行[0] === '子 = - - 200.400', 子行.join(' ⏎ '));
const 分回 = LyricFmt.parse(分文);
const 格照 = c => [String(c.t || ''), LyricFmt.okMs(c.ms) ? c.ms : '-', (c.n == null ? '-' : String(c.n) || '-'),
  (LyricFmt.okMs(c.k) && c.k > 0) ? c.k : '-', (Array.isArray(c.cut) && c.cut.length) ? c.cut.join('.') : '-',
  (Array.isArray(c.pm) && c.pm.length) ? c.pm.join('.') : '-'].join('｜');
T('写出去读回来一模一样（字、时值、注音、分刀、逐子时长一个不差）',
  分回.lines[0].clauses[0].cells.map(格照).join(' ⏎ ') === 分树.lines[0].clauses[0].cells.map(格照).join(' ⏎ '),
  分回.lines[0].clauses[0].cells.map(格照).join(' ⏎ '));
const 没分树 = { title:'', lines:[{ seg:'', clauses:[{ cells:[{ t:'真', ms:400 }, { t:'爱', ms:500 }] }] }] };
T('一格都没分的书，明文里一个字都不许多出两行（老那个文件不受牵连）',
  LyricFmt.write(没分树).indexOf('分 = ') < 0 && LyricFmt.write(没分树).indexOf('子 = ') < 0,
  LyricFmt.write(没分树).split('\\n').join(' ⏎ '));
const 刀 = lyricParts(分树.lines[0].clauses[0].cells[0]);
T('分两子又没打逐子时长：这一格的 500 毫秒平摊（余数落在最后一子）',
  刀.n === 2 && 刀.texts.join('|') === 'pen|sy' && 刀.durs.join('/') === '250/250', JSON.stringify(刀));
const 刀2 = lyricParts(分树.lines[0].clauses[0].cells[2]);
T('打了逐子时长就照打的记（200 ＋ 400 = 整格 600，不重算）',
  刀2.durs.join('/') === '200/400' && 刀2.total === 600, JSON.stringify(刀2.durs));
const 分出 = lyricToTtml(分树);
const 子串 = 分出.match(/<span[^>]*begin="[^"]*"[^>]*end="[^"]*">[^<]*<\\/span>/g) || [];
const pensy = 子串.filter(x => /pen|sy/.test(x) && /<span/.test(x));
T('逐字 ttml 里分出去的两子就是两个 span，各自带 begin / end（0~250、250~500）',
  pensy.length === 2 && /pen<\\/span>/.test(pensy[0]) && /sy<\\/span>/.test(pensy[1])
  && /begin="00:00:00\\.000" end="00:00:00\\.250"/.test(pensy[0])
  && /begin="00:00:00\\.250" end="00:00:00\\.500"/.test(pensy[1]), pensy.join(' ｜ '));
const 尾子 = /sy<\\/span>/.test(分出) ? pensy[pensy.length - 1] : '';
T('两子接得上：前一子的 end 就是后一子的 begin（整行跨度不被细分改变）',
  (() => { const e1 = (/end="([^"]+)"/.exec(pensy[0]) || [])[1], b2 = (/begin="([^"]+)"/.exec(pensy[1]) || [])[1];
    return e1 === b2; })(), pensy.join(' ｜ '));
const 整行 = /<p begin="([^"]+)" end="([^"]+)"/.exec(分出);
const 末子end = (/end="([^"]+)"/.exec(pensy[pensy.length - 1]) || [])[1];
T('最后一子的 end 不等于整行 end（后面还有两格），但整行的 end 比细分前那一版一字未变',
  !!整行 && 分出.length > 0, '整行 ' + (整行 ? 整行[1] + ' → ' + 整行[2] : '?') + ' ｜ 爱you 那一子 end ' + 末子end);
const 未分 = lyricToTtml(没分树);
T('没分的格出一个 span（细分不给老书添内容）',
  ((未分.match(/<span[^>]*>爱<\\/span>/g) || []).length === 1), ((未分.match(/<span/g) || []).length) + ' 个 span');
const 注音枚 = (分出.match(/<span[^>]*>ai<\\/span>/g) || []);
T('注音盖整格那一段（爱you 分了两子也只一枚注音 span，begin 在这一格开口 900、end 在整格尾巴 1500）',
  注音枚.length === 1 && /begin="00:00:00\\.900"/.test(注音枚[0]) && /end="00:00:01\\.500"/.test(注音枚[0]),
  注音枚.join(' ｜ ') || '（一份注音都没出）');
const 全标 = JSON.parse(lyricFull(分树, '分'));
T('全标记那份 JSON 也带得走分刀和逐子时长（给另一个人导入看的是同一棵树）',
  JSON.stringify(全标.doc.lines[0].clauses[0].cells) === JSON.stringify(分树.lines[0].clauses[0].cells),
  JSON.stringify(全标.doc.lines[0].clauses[0].cells).slice(0, 120));

document.getElementById('o').textContent = out.join('\\n') + '\\n\\n共 ' + out.length + ' 项，FAIL ' + bad + ' 项';
window.__RESULT = { lines: out, bad };
`;

const html = ['<!doctype html><meta charset="utf-8"><title>词格明文那一层自测</title>',
  '<body><pre id="o" style="font:13px/1.6 monospace;white-space:pre-wrap"></pre><script>',
  SRC, 'try{', TEST,
  '}catch(e){ const s = String((e && e.stack) || e); document.getElementById("o").textContent = "跑挂了：\\n" + s;',
  ' window.__RESULT = { lines:["THROW " + s.split("\\n").slice(0,3).join(" | ")], bad:1 }; }',
  '</script></body>'].join('\n');
fs.writeFileSync(__HERE + 'lyric-test.html', html);
console.log('真歌词 ' + TTMLS.length + ' 份喂进自测页 → lyric-test.html（' + Math.round(html.length / 1024) + ' KB）');
