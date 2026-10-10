/* 外26 二组第 3 条自测页：拖动起点落在可编辑区里时，选区不许一路拖到外面选成一大片。
   切的是源码原样那一支 —— wnwBindSelFence 整只 + 它依赖的 wnwOn / WNW_ON，
   再挂一排「目录」和一段正文 contenteditable，真造一次越界的选区，看它夹不夹得回来。 */
/* 外29 第 40 轮：探针搬进仓库 src\tools\probes\ 之后，生成的页面就近落在这旁边，不再写回会话临时目录 */
import { fileURLToPath as __u2p } from 'node:url';
const __HERE = __u2p(new URL('.', import.meta.url));

import fs from 'node:fs';

const REPO = 'D:/Programs/Flow-Desk';
const W0 = fs.readFileSync(REPO + '/src/_wnw/src/w0-skin.js', 'utf8');

function tillSemi(src, head){
  const i = src.indexOf(head);
  if(i < 0) throw new Error('源码里找不到「' + head + '」');
  const j = src.indexOf('\n}\n', i);
  if(j < 0) throw new Error('没找到「' + head + '」的收尾');
  return src.slice(i, j + 2);
}
const SRC = tillSemi(W0, 'function wnwBindSelFence') + '\n' +
  tillSemi(W0, 'function wnwOn(') + '\n' +
  'const WNW_ON = [];\n';

const STUB = `
const out = []; let bad = 0;
const T = (nm, cond, extra) => { out.push((cond ? 'PASS ' : 'FAIL ') + nm + (extra == null ? '' : '  —— ' + extra)); if(!cond) bad++; };
const 在块里 = (块, nd) => !!nd && (块 === nd || 块.contains(nd.nodeType === 3 ? nd.parentNode : nd));
`;

const TEST = `
document.body.innerHTML = '<div class="wnw-root">' +
  '<div class="wnw-tree wnw-nosel"><div class="row">第一章 晨海</div><div class="row">第二章 潮声</div><div class="row">第三章 归途</div></div>' +
  '<div class="wnw-ce" contenteditable="true">正文那一段：真爱人海</div>' +
  '</div>';
const 树 = document.querySelector('.wnw-tree'), 正文 = document.querySelector('.wnw-ce');
wnwBindSelFence();
const S = () => window.getSelection();
const 拖一趟 = (起, 止) => {
  起.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true, clientX:10, clientY:10 }));
  /* 真按浏览器的说法造一次「从正文起手、拖到目录上」的选区：base 在正文、extent 在目录
     （目录排在正文前面，所以拿 createRange 摆会摆成倒着的区间 —— 这里用 setBaseAndExtent 才是浏览器那一份） */
  S().setBaseAndExtent(起.firstChild, 1, 止.lastChild.firstChild || 止.lastChild, 2);
  const 越界前 = { 头: 在块里(正文, S().getRangeAt(0).startContainer), 尾: 在块里(正文, S().getRangeAt(0).endContainer) };
  window.dispatchEvent(new MouseEvent('mousemove', { bubbles:true, clientX:400, clientY:400 }));
  const r = S().getRangeAt(0);
  return { 越界前: 越界前, 头: 在块里(正文, r.startContainer), 尾: 在块里(正文, r.endContainer), 长: String(S().toString()) };
};
T('源码里那三支切进来了（wnwBindSelFence / wnwOn / WNW_ON）',
  typeof wnwBindSelFence === 'function' && typeof wnwOn === 'function' && Array.isArray(WNW_ON),
  typeof wnwBindSelFence + ' ｜ ' + typeof wnwOn);
T('Chromium 这边 user-select:contain 不认（所以只能自己夹）', (() => {
  const d = document.createElement('div'); d.style.userSelect = 'contain'; document.body.appendChild(d);
  const 计 = getComputedStyle(d).userSelect; d.remove(); return 计 !== 'contain';
})(), '计算值 = ' + (() => { const d = document.createElement('div'); d.style.userSelect = 'contain'; document.body.appendChild(d);
  const v = getComputedStyle(d).userSelect; d.remove(); return v; })());

const 越界 = 拖一趟(正文, 树);
T('先在浏览器里确认这一趟真的越了界（不然测的是空气）', !越界.越界前.头 || !越界.越界前.尾, JSON.stringify(越界.越界前));
T('正文里起手、尾巴拖到目录上：夹回来之后两头都落在正文这一段里', 越界.头 && 越界.尾, JSON.stringify(越界));
T('夹回来的选区里只有正文的字，一个都没沾上「第一章 晨海」那行',
  越界.长.length > 0 && 越界.长.indexOf('晨海') < 0 && 越界.长.indexOf('潮声') < 0,
  '选到的是「' + 越界.长 + '」');
const 里头 = (() => {
  正文.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true }));
  const r = document.createRange(); r.setStart(正文.firstChild, 3); r.setEnd(正文.firstChild, 5);
  S().removeAllRanges(); S().addRange(r);
  window.dispatchEvent(new MouseEvent('mousemove', { bubbles:true }));
  return { 文本: S().toString(), 起: S().getRangeAt(0).startOffset, 止: S().getRangeAt(0).endOffset };
})();
T('没越界的时候一个字都不动（段里正常选词不受这条影响）',
  里头.起 === 3 && 里头.止 === 5 && 里头.文本.length === 2, JSON.stringify(里头));
const 头出 = (() => {
  正文.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true }));
  const r = document.createRange(); r.setStart(树.firstChild, 0); r.setEnd(正文.firstChild, 3);
  S().removeAllRanges(); S().addRange(r);
  window.dispatchEvent(new MouseEvent('mousemove', { bubbles:true }));
  return { 头: 在块里(正文, S().getRangeAt(0).startContainer), 尾: 在块里(正文, S().getRangeAt(0).endContainer) };
})();
T('反着来也夹得住：头在目录、尾在正文 —— 头被收到本段开头', 头出.头 && 头出.尾, JSON.stringify(头出));
const 松手 = (() => {
  正文.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true }));
  S().setBaseAndExtent(正文.firstChild, 0, 树.lastChild, 1);
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles:true }));
  const r = S().getRangeAt(0);
  return { 尾: 在块里(正文, r.endContainer), 头: 在块里(正文, r.startContainer) };
})();
T('松手那一下也夹一次（只挂 mousemove 会漏掉拖到边界就松手的那一趟）', 松手.尾 && 松手.头, JSON.stringify(松手));
const 二次 = (() => {
  const before = WNW_ON.length;
  正文.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true }));
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles:true }));
  正文.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true }));
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles:true }));
  return { 多出来的订阅: WNW_ON.length - before };
})();
T('拖完把临时那两枚监听摘掉，不越拖越攒（全局账本 WNW_ON 一枚都没多）', 二次.多出来的订阅 === 0, JSON.stringify(二次));

window.__RESULT = { lines: out, bad };
`;

const html = ['<!doctype html><meta charset="utf-8"><title>选区关在段里</title>',
  '<body style="font:15px/1.6 system-ui"><pre id="o" style="font:13px/1.6 monospace;white-space:pre-wrap"></pre><script>',
  STUB, SRC, '(async()=>{ try{', TEST,
  '}catch(e){ const s = String((e && e.stack) || e); document.getElementById("o").textContent = "跑挂了：\\n" + s; window.__RESULT = { lines:["THROW " + s.split("\\n").slice(0,3).join(" | ")], bad:1 }; } })();',
  '</script></body>'].join('\n');
if((STUB + SRC + TEST).includes('</script')) throw new Error('源码含 </script，会撕页');
fs.writeFileSync(__HERE + 'sel-test.html', html);
console.log('写了 sel-test.html（' + Math.round(html.length / 1024) + ' KB）｜ 切进来的源码 ' + SRC.length + ' 字符');
