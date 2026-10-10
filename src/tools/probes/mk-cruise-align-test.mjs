/* 外27 丙组 · 图9（单词之间的缝）+ 图10（注音一一对应）
   把 w19-cruise.js 里真的 CSS、真的 wordShow / 显注音 / 藏注音 / alignCells 抠出来铺成一页，
   在浏览器里真排版量落点 —— 这两条是几何问题，node 里算不出来。
   抠出来的源码直接拼进页面当代码用，不在页面里 eval。 */
/* 外29 第 40 轮：探针搬进仓库 src\tools\probes\ 之后，生成的页面就近落在这旁边，不再写回会话临时目录 */
import { fileURLToPath as __u2p } from 'node:url';
const __HERE = __u2p(new URL('.', import.meta.url));

import fs from 'node:fs';

const CRUISE = 'D:/Programs/Flow-Desk/src/_wnw/src/w19-cruise.js';
const CORE = 'D:/Programs/Flow-Desk/src/_wnw/src/w1-core.js';
const c = fs.readFileSync(CRUISE, 'utf8'), k = fs.readFileSync(CORE, 'utf8');

function srcLine(start, strip){
  const i = c.indexOf(start);
  if(i < 0) throw new Error('找不到：' + start);
  const s = c.slice(i, c.indexOf('\n', i));
  return strip ? s.slice(strip.length) : s;
}
/* 类里的方法：单行的抠到行尾，多行的抠到 '\n  }'；抠出来加 function 前缀当独立函数用 */
function method(name){
  const i = c.indexOf('\n  ' + name + '(');
  if(i < 0) throw new Error('找不到方法：' + name);
  const nl = c.indexOf('\n', i + 1);
  const first = c.slice(i + 1, nl);
  const body = /}\s*$/.test(first) ? first : c.slice(i + 1, c.indexOf('\n  }', i) + 4);
  return 'function ' + body.trim();
}
function topFn(name, src){
  const i = src.indexOf('\nfunction ' + name);
  return src.slice(i + 1, src.indexOf('\n}\n', i) + 2);
}
const cssStart = c.lastIndexOf('addCss(`');
const css = c.slice(cssStart + 'addCss(`'.length, c.indexOf('`);', cssStart));

const code = [
  topFn('h', k),
  method('wordShow'),
  method('alignCells'),
  'const 显注音 = ' + srcLine('const 显注音 = ', 'const 显注音 = '),
  'const 藏注音 = ' + srcLine('const 藏注音 = ', 'const 藏注音 = '),
  /* alignCells 是从类里抠出来的独立函数，真代码里读的是 this.set.romW；这一档已经删掉，桩给它一个空 set */
  'const 藏原文 = 藏注音;\n' +
'const G = { set:{} };'
].join('\n');

const page = '<!doctype html><html><head><meta charset="utf-8">' +
'<style>body{margin:0;font:14px/1.45 "Segoe UI",system-ui,sans-serif;background:#fff;color:#111}' +
'#host{width:420px;padding:8px}</style><style id="injected"></style></head><body>' +
'<div id="host"></div><scr' + 'ipt>' +
'window.__ERR = null;\ntry{\n' +
'document.getElementById("injected").textContent = ' + JSON.stringify(css) + ';\n' +
'const LyricFmt = { okMs:function(v){ return Number(v) > 0; } };\n' +
'const Txt = { out:function(s){ return s; }, pageNow:"" };\n' +
code + '\n' +
`
const CS = [
  {t:'un', n:'ʌn', ms:120},
  {t:'mistakably', n:'ˌmɪsˈteɪkəbli', ms:400},
  {t:'sweat', n:'swɛt', ms:566},
  {t:'ev', n:'ɪv', ms:80},
  {t:'rything', n:'ˈɛriθɪŋ', ms:300},
  {t:'a', n:'ə', ms:60},
  {t:'', n:'ət', ms:90},
  {t:'down', n:'daʊn', ms:210},
  {t:'the', n:'ðə', ms:70},
  {t:'street', n:'striːt', ms:330}
];
cs = CS;
const out = [];
const ok = m => out.push('PASS ' + m), bad = m => out.push('FAIL ' + m);
const center = x => Math.round((x.getBoundingClientRect().left + x.getBoundingClientRect().right) / 2 * 10) / 10;
/* 第几排：只能按这一排内部的相对位置数，注音那一整排本来就摆在原文那一整排上面，绝对 top 天生不同 */
function lineIdx(row){
  const tops = [...new Set(Array.from(row.children).map(x => Math.round(x.getBoundingClientRect().top)))].sort((a, b) => a - b);
  return Array.from(row.children).map(x => tops.indexOf(Math.round(x.getBoundingClientRect().top)));
}
const gapOf = s => { const n = document.querySelector(s); return n ? getComputedStyle(n).columnGap : '没这排'; };

function build(width, 显原文){
  const host = document.getElementById('host');
  host.innerHTML = '';
  const card = h('div', { class:'wnw-czcard' });
  if(width) card.style.width = width;
  host.appendChild(card);
  const 音 = 显注音();
  const 词 = 显原文 ? wordShow(cs) : 藏原文();
  card.appendChild(音); card.appendChild(词);
  G.alignCells = alignCells; G.alignCells(音, 词, cs);
  return { 音, 词, card };
}
/* 列间距当场量这一对卡片里的两排，别拿上一次留下的 */
function colGap(row){ return getComputedStyle(row).columnGap; }
function pairs(a, b, name){
  const A = Array.from(a.children), B = Array.from(b.children);
  if(A.length !== cs.length || B.length !== cs.length) return bad(name + '：两排格数不对 ' + A.length + '/' + B.length);
  const la = lineIdx(a), lb = lineIdx(b);
  let worst = 0, wi = -1, cross = 0;
  for(let i = 0; i < A.length; i++){
    const d = Math.abs(center(A[i]) - center(B[i]));
    if(d > worst){ worst = d; wi = i; }
    if(la[i] !== lb[i]) cross++;
  }
  (worst <= 0.6 && !cross ? ok : bad)(name + '：最歪的是第 ' + (wi + 1) + ' 格，差 ' + worst + 'px，注音和原文落到不同横排的格 ' + cross + ' 格');
}

let r = build(null, true);
const gw = colGap(r.词), gr = colGap(r.音);
(gw === gr ? ok : bad)('原文那一排的列间距 ' + gw + ' ＝ 注音那一排的列间距 ' + gr);
/* 一个字母多宽：照原文那一排的字号量一枚 'n'，不能用 .c（它自己带 min-width，量到的是框不是字） */
const csFont = getComputedStyle(r.词.firstChild).fontSize;
const probe = h('span', { style:'font-size:' + csFont }, 'n');
r.词.appendChild(probe);
const letter = Math.round(probe.getBoundingClientRect().width * 10) / 10;
probe.remove();
(parseFloat(gw) >= letter ? ok : bad)('单词之间的缝 ' + gw + ' ≥ 一个字母的宽 ' + letter + 'px（' + csFont + ' 字号下的 n）');
pairs(r.音, r.词, '显原文 ＋ 显注音');

r = build(null, false);
const gh = colGap(r.词);
(gh === gr ? ok : bad)('原文藏着那一排（空框）的列间距 ' + gh + ' ＝ 注音排 ' + gr);
pairs(r.音, r.词, '显注音 ＋ 藏原文');

r = build('260px', true);
const lines = Math.max.apply(null, lineIdx(r.词).concat([0])) + 1;
(lines > 1 ? ok : bad)('窄卡片（' + Math.round(r.card.getBoundingClientRect().width) + 'px）换成了 ' + lines + ' 行');
pairs(r.音, r.词, '窄卡片换行后');
/* 单格那一档一张卡就一格：显注音/藏注音 用的是外层那个 cs，所以这一档要把 cs 换成单格再摆 */
cs = [CS[2]];
r = build(null, true);
const oneR = 显注音(), one = wordShow(cs);
r.card.innerHTML = ''; r.card.appendChild(oneR); r.card.appendChild(one);
G.alignCells(oneR, one, cs);
(oneR.children.length === 1 && one.children.length === 1 &&
  Math.abs(center(oneR.firstChild) - center(one.firstChild)) <= 0.6 ? ok : bad)(
  '单格那张卡：注音 ' + oneR.children.length + ' 格 / 原文 ' + one.children.length + ' 格，中心差 ' +
  Math.abs(center(oneR.firstChild) - center(one.firstChild)) + 'px');

window.__RESULT = out.join('\\n');
window.__STATS = { gw, gr, gh, letter, lines, width:document.querySelector('.wnw-czcard').getBoundingClientRect().width };
}catch(e){ window.__ERR = String(e && e.stack || e); window.__RESULT = 'ERROR ' + e; }
` + '</scr' + 'ipt></body></html>';

fs.writeFileSync(__HERE + 'cruise-align.html', page);
console.log('写好了 cruise-align.html（' + page.length + ' 字符）');
console.log('--- 抠出来的四片 ---\n' + code.split('\n').slice(0, 3).join('\n') + '\n…');
console.log(code.split('\n').filter(l => /显注音 =|藏注音 =/.test(l)).join('\n'));
