/* 外27 丁组自检：图4（展开档开头那行歌名歌手）· 图5（时间偏移归零那个按钮）· 图12（拉宽时歌词区跟着变宽）
   CSS 用真的：从 src\_shared\sh-style.js 抠 .wnw-btn 那两条、从组件里抠整段 mu 样式；
   几何在浏览器里量，图4 那一条是查源码里小账清在哪一步。 */
/* 外29 第 40 轮：探针搬进仓库 src\tools\probes\ 之后，生成的页面就近落在这旁边，不再写回会话临时目录 */
import { fileURLToPath as __u2p } from 'node:url';
const __HERE = __u2p(new URL('.', import.meta.url));

import fs from 'node:fs';

const MU = 'D:/Programs/Flow-Desk/data/plugins/music-remote/main.js';
const SH = 'D:/Programs/Flow-Desk/src/_shared/sh-style.js';
const mu = fs.readFileSync(MU, 'utf8'), sh = fs.readFileSync(SH, 'utf8');

/* ---- 图4：源码层 —— draw() 里必须在重建节点之前把文本小账清掉 */
const d0 = mu.indexOf('\n  draw(){');
const d1 = mu.indexOf('\n  }', d0 + 100);
const drawBody = mu.slice(d0, d1);
const cacheAt = drawBody.indexOf('this.cache = {}');
const updateAt = drawBody.indexOf('this.update()');
const tElAt = drawBody.indexOf("this.tEl = h('div'");
const checks = [];
const ok = (c, m) => checks.push((c ? 'PASS ' : 'FAIL ') + m);
ok(cacheAt >= 0 && updateAt >= 0 && cacheAt < updateAt,
  '图4：draw() 里 this.cache = {} 排在 this.update() 之前（位置 ' + cacheAt + ' < ' + updateAt + '）');
ok(cacheAt >= 0 && tElAt >= 0 && cacheAt < tElAt, '图4：清账也排在造新节点之前，新节点一定被写过一次');
ok(/setText\(k, el, v\)\{\s*\n?\s*if\(this\.cache\[k\] === v\) return;/.test(mu),
  '图4：setText 仍是「和上次一样就不写」—— 所以清账这一步是必要的，不是装饰');

/* ---- 图5 / 图12：浏览器层 */
function rule(src, sel){
  const i = src.indexOf('\n' + sel + '{');
  if(i < 0) throw new Error('找不到规则：' + sel);
  return src.slice(i + 1, src.indexOf('}', i) + 1);
}
const btnRules = ['.wnw-btn', '.wnw-btn.mini'].map(s => { try{ return rule(sh, s); }catch(e){ return ''; } }).join('\n');
const cssStart = mu.lastIndexOf('const MUS_CSS = `');
const css = mu.slice(cssStart + 'const MUS_CSS = `'.length, mu.indexOf('`;', cssStart));
const rstTxt = (mu.match(/'aria-label':'时间偏移归零'[\s\S]{0,200}?\}, '([^']+)'\)/) || [])[1] || '';
const rstCls = (mu.match(/const rst = h\('button', \{ class:'([^']+)'/) || [])[1] || '';
ok(rstTxt === '时间偏移归零', '图5：那个按钮上写的字 = 「' + rstTxt + '」');
ok(/wnw-btn/.test(rstCls) && /mini/.test(rstCls), '图5：那个按钮用的是上面那一排同一种 class（' + rstCls + '）');
ok(!/\.mu-lag-rst\{[^}]*font-size/.test(css) && !/\.mu-lag-rst\{[^}]*padding/.test(css),
  '图5：CSS 里不再单独压那个的高矮（font-size / padding 都撤了）');
ok(!/max-width:calc\(46em/.test(css), '图12：歌词那一列 46em 那道上限没了');

const page = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;font:14px/1.45 "Segoe UI",system-ui,sans-serif;color:#111;--text:#111;--text-light:#666;
--accent:#0a7;--hair-color:#ddd;--card-border:#ddd;--muted:#777;--btn-bg:#eef2fa;--input-bg:#fff;--r-btn:5px}
${btnRules}
${css}
.panel{width:900px;outline:1px dashed #bbb}
.panel.wide{width:1400px}
</style></head><body><div id="host"></div><scr${''}ipt>
window.__ERR = null;
try{
function h2(t, p, k){ const n = document.createElement(t);
  if(p) for(const x in p){ if(x === 'class') n.className = p[x]; else n.setAttribute(x, p[x]); }
  (Array.isArray(k) ? k : k == null ? [] : [k]).forEach(c => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return n; }
function h(t, p, k){ return h2(t, p, k); }
const out = [];
const ok = m => out.push('PASS ' + m), bad = m => out.push('FAIL ' + m);
const host = document.getElementById('host');

/* 一副遥控器：上面那一排清秀按钮 + 滑杆那一排（照 setTools 的摆法），下面歌词那一列 */
function make(cls){
  const p = h2('div', { class:'panel ' + cls });
  const tools = h2('div', { class:'mu mu-full' });
  const bar = h2('div', { class:'mu-tools' });
  ['音乐目录：Music', '重扫目录', '选歌词文件', '字'].forEach(t => bar.appendChild(h2('button', { class:'wnw-btn mini' }, t)));
  const wrap = h2('span', { class:'mu-lag-wrap' });
  const rng = h2('input', { class:'mu-lag-r', type:'range', min:'-800', max:'800', value:'0' });
  wrap.appendChild(h2('label', { class:'mu-lag' }, [rng, h2('span', { class:'mu-lag-t' }, '歌词对齐')]));
  wrap.appendChild(h2('button', { class:'${rstCls} mu-lag-rst', type:'button' }, '${rstTxt || '时间偏移归零'}'));
  bar.appendChild(wrap);
  tools.appendChild(bar);
  const list = h2('div', { class:'mu-list' });
  for(let i = 0; i < 3; i++) list.appendChild(h2('div', { class:'mu-line mu-left' }, '这一行歌词用来量字面的宽度，' + '很长'.repeat(6) + i));
  tools.appendChild(list);
  const shell = h2('div', { class:'mu-shell mu-shell-full' });
  shell.appendChild(h2('div', { class:'mu-cover' })); shell.appendChild(tools);
  p.appendChild(shell); host.appendChild(p);
  return { p, list, bar };
}

/* 图5：那个按钮的高矮要和上面那一排同一种按钮一模一样 */
const a = make('');
const kin = Array.from(a.bar.querySelectorAll('.wnw-btn.mini')).slice(0, 4).map(x => Math.round(x.getBoundingClientRect().height * 10) / 10);
const rstEl = a.bar.querySelector('.mu-lag-rst');
const rstH = Math.round(rstEl.getBoundingClientRect().height * 10) / 10;
const same = kin.every(x => Math.abs(x - rstH) < 0.6);
(same ? ok : bad)('图5：时间偏移归零那个高 ' + rstH + 'px，上面那一排清秀按钮 ' + kin.join('/') + 'px');
const fs0 = getComputedStyle(a.bar.querySelector('.wnw-btn.mini')).fontSize;
const fs1 = getComputedStyle(rstEl).fontSize;
(fs0 === fs1 ? ok : bad)('图5：字号也同为 ' + fs0);
const label = rstEl.textContent;
(label === '时间偏移归零' ? ok : bad)('图5：按钮上写的是「' + label + '」');

/* 图12：面板从 900 拉到 1400，歌词那一列要跟着宽 500 */
const w1 = Math.round(a.list.getBoundingClientRect().width * 10) / 10;
const b = make('wide');
const w2 = Math.round(b.list.getBoundingClientRect().width * 10) / 10;
const d = Math.round((w2 - w1) * 10) / 10;
(Math.abs(d - 500) < 1 ? ok : bad)('图12：面板 900 → 1400，歌词那一列 ' + w1 + ' → ' + w2 + '，跟着宽了 ' + d + 'px');
/* 字面能用的宽 = 那一列的可视宽减掉左右内边距（歌词行是按内容收的 shrink-to-fit，量它自己量不出来） */
const face = x => { const cs = getComputedStyle(x.list); return Math.round((x.list.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * 10) / 10; };
const f1 = face(a), f2 = face(b);
(Math.abs((f2 - f1) - 500) < 1 ? ok : bad)('图12：字面能用的宽 ' + f1 + ' → ' + f2 + '，跟着宽了 ' + Math.round((f2 - f1) * 10) / 10 + 'px');
/* 窄的那一副不许被撑破（横向不出现滚动条） */
(a.list.scrollWidth <= Math.ceil(a.list.clientWidth) ? ok : bad)
  ('图12：900px 那一副里歌词没有撑出横向滚动（内容 ' + a.list.scrollWidth + ' ≤ 可视 ' + a.list.clientWidth + '）');
window.__RESULT = out.join('\\n');
}catch(e){ window.__ERR = String(e && e.stack || e); window.__RESULT = 'ERROR ' + e; }
</` + `script></body></html>`;

fs.writeFileSync(__HERE + 'ding-test.html', page);
console.log(checks.join('\n'));
console.log('写了 ding-test.html（' + page.length + ' 字符）· CSS ' + css.length + ' 字符 · wnw-btn 规则 ' + btnRules.length + ' 字符');
