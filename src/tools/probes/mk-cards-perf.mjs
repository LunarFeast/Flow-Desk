/* 第 37 轮量的一台：色卡那一屏一次摆 211 个（点一次「小企鹅配色进池」的最坏情况）到底多重。
   源码全是切真身，不抄第二份：h、cardPoolDlg、segCtrl、CardPool、那把解色号的尺、真 CSS 两块（template.html 的 style + fd3-shell 注入块）。
   只有弹窗（Modal）给的是薄薄一层假壳：真 Modal 要 dom 那一大摊（#wall 那些），这一台只需要「body 真挂进文档、能算布局」。 */
/* 外29 第 40 轮：探针搬进仓库 src\tools\probes\ 之后，生成的页面就近落在这旁边，不再写回会话临时目录 */
import { fileURLToPath as __u2p } from 'node:url';
const __HERE = __u2p(new URL('.', import.meta.url));

import fs from 'node:fs';

const REPO = 'D:/Programs/Flow-Desk';
const L = s => s.split(/\r?\n/);
function tillBrace(src, head){
  const i = src.indexOf(head);
  if(i < 0) throw new Error('源码里找不到「' + head + '」');
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(!d){ j++; break; } }
  }
  return src.slice(i, j);
}
function tillSemi(src, head){
  const i = src.indexOf(head);
  if(i < 0) throw new Error('源码里找不到「' + head + '」');
  return src.slice(i, src.indexOf('\n', i));
}

/* ---------- 一、真 CSS 两块（顺序和真页面一致） ---------- */
const SH = L(fs.readFileSync(REPO + '/src/_fd/src/fd3-shell.js', 'utf8'));
const c0 = SH.findIndex(l => l.includes("h('style', { html:`"));
const c1 = SH.findIndex((l, i) => i > c0 && /^\s*`\s*\}\)\);/.test(l));
if(c0 < 0 || c1 < 0) throw new Error('没圈住 fd3-shell.js 的 CSS 字面量');
const 剔 = [];
const CSS = SH.slice(c0 + 1, c1).filter(l => {
  if(l.indexOf('${') < 0) return true;
  剔.push(l.trim()); return false;
}).join('\n');
if(剔.length !== 1 || 剔[0].indexOf('font-family:var(--fd-font') < 0) throw new Error('剔的行不合规：' + JSON.stringify(剔));
for(const 条 of ['.fd-dots{', '.fd-dot{']) if(CSS.indexOf(条) < 0) throw new Error('切进来的 CSS 里没有「' + 条 + '」');

const TPL = fs.readFileSync(REPO + '/src/_fd/template.html', 'utf8');
const t0 = TPL.indexOf('<style>'), t1 = TPL.indexOf('</style>', t0);
const TPLCSS = TPL.slice(t0 + 7, t1);
if(TPLCSS.indexOf('${') >= 0) throw new Error('template.html 的 style 里有 ${}');

/* ---------- 二、真源码那几块 ---------- */
const SHELL = fs.readFileSync(REPO + '/src/_fd/src/fd3-shell.js', 'utf8');
const LIB = fs.readFileSync(REPO + '/src/_fd/src/fd3-lib.js', 'utf8');
const COL = fs.readFileSync(REPO + '/src/_shared/sh-color.js', 'utf8');
const CARDS = fs.readFileSync(REPO + '/src/_fd/src/fd11-cards.js', 'utf8');
const BUILT = fs.readFileSync(REPO + '/src/_fd/src/fd4-builtin.js', 'utf8');
const RIME = fs.readFileSync(REPO + '/src/_fd/src/fd12-rime-colors.js', 'utf8');

const H = tillBrace(SHELL, 'function h(tag, props, kids)');
/* 2026-10-09：色卡那一屏从一只框里搬到了「方案资源」那一页上，函数改名 cardPoolBox（交回一个块，不开框）。
   这一台量的是「几百颗圆点一次摆开要多久」，那一条和摆在哪里没关系 —— 这里补一层薄壳，
   把交回来的块塞进假 Modal，底下那些 call site 一个字不用改。 */
const POOLDLG = tillBrace(BUILT, 'function cardPoolBox(after)') +
  "\nconst cardPoolDlg = after => Modal.open('色卡', cardPoolBox(after), []);\n";
const SEG = tillBrace(BUILT, 'function segCtrl(opts, get, set)');
const CHIWEI = tillSemi(BUILT, 'const 池尾 =');
const LIBYML = tillBrace(LIB, 'const LibYml = {');
const RIMEHEX = (RIME.match(/const RIME_HEXES = \[[\s\S]*?\];/) || [null])[0];
if(!RIMEHEX) throw new Error('没抓到 RIME_HEXES');
if(POOLDLG.indexOf('fd-dots') < 0) throw new Error('切出来的 cardPoolBox 里没有 .fd-dots，切错了');
/* 真Txt那一份 + 他磁盘上那一份清单（h 里每一枚 title/placeholder 都过它一遍，空清单和有清单是两条不同的路） */
const SHTEXT = fs.readFileSync(REPO + '/src/_shared/sh-text.js', 'utf8');
const UIEXTXT = fs.readFileSync(REPO + '/data/ui-text.yaml', 'utf8');
if(SHTEXT.indexOf('const Txt = {') < 0) throw new Error('没切到 Txt');

const STUB = `
const out = []; let bad = 0;
const T = (nm, cond, extra) => { out.push((cond ? 'PASS ' : 'FAIL ') + nm + (extra == null ? '' : '  —— ' + extra)); if(!cond) bad++; };
const 记 = (k, v) => { out.push('· ' + k + '：' + v); };
document.documentElement.style.cssText = '--accent:#2f7d7d;--ok:#2e8b57;--face-solid:#f7f7f5;--card-bg:#ffffff;' +
  '--text:#222222;--text-light:#8a8a8a;--hair:#dddddd;--r-card:6px;--bw:1px;--page-bg:#f4f4f2';
/* 弹窗壳：只把 body 真挂进文档（要的是布局和绘制），按钮那一排照抄形状 */
const 架 = { 开:null, 体:null };
const Modal = { open(title, body, btns){ if(架.体) 架.体.remove();
    const 壳 = h('div', { style:'position:fixed;left:16px;top:16px;width:680px;background:var(--card-bg);padding:12px' },
      [h('b', {}, title), body, h('div', { class:'fd-row' }, btns || [])]);
    document.body.appendChild(壳); 架.体 = 壳; 架.开 = { title, body }; },
  close(){ if(架.体) 架.体.remove(); 架.体 = null; 架.开 = null; } };
const toast = () => {};
const fdAsk = async () => true;
const icoMarkup = () => '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor"/></svg>';
const Theme = { applied:{} };
const pickFiles = async () => [];
const SwatchTheme = { read: async () => ({ list:[], ocr:false }) };
const ImageTheme = { colors: async () => [] };
const FD_APP = { pathOf: () => '' };
`;

const SRC = 'const CSS_TEXT = ' + JSON.stringify(CSS) + ';\n' +
  'const TPL_TEXT = ' + JSON.stringify(TPLCSS) + ';\n' +
  'const UI_TEXT_YAML = ' + JSON.stringify(UIEXTXT) + ';\n' +
  'const LibStore = { fetchRaw: async () => "", putRaw: async () => true, later(){} };\n' +
  'const State = { get: async (k, d) => d, set: async () => true };\n' +
  COL + '\n' + SHTEXT + '\n' + LIBYML + '\n' + H + '\n' + SEG + '\n' + CARDS + '\n' + CHIWEI + '\n' + RIMEHEX + '\n' + POOLDLG + '\n';

const TEST = `
{ const a = document.createElement('style'); a.textContent = TPL_TEXT; document.head.appendChild(a);
  const b = document.createElement('style'); b.textContent = CSS_TEXT; document.head.appendChild(b); }
document.body.style.cssText = 'margin:0;font:15px/1.6 system-ui;background:var(--page-bg);color:var(--text);padding:8px';
const 等一拍 = () => new Promise(r => setTimeout(r, 0));
const 数节点 = el => el.querySelectorAll('*').length;
/* 这一台跑在后台标签里：requestAnimationFrame 不推进（上一批量过渡就是这么卡住的），
   所以「到下一帧画完」这一档量不了，改成同步逼一遍布局（getBoundingClientRect + 读 offsetHeight），
   建节点和排版这两笔是真钱，量得到；绘制那一笔要看得在真程序里点一趟。 */
const 逼布局 = el => { el.getBoundingClientRect(); el.offsetHeight;
  const last = el.lastElementChild; if(last) last.getBoundingClientRect(); return Math.round(el.scrollHeight); };
const 找管理钮 = () => [...document.querySelectorAll('.fd-btn.mini')].find(b => b.textContent === '颜色管理');

CardPool.ready = true; CardPool.tuneOn = false; CardPool.items = [];
const 一共 = RIME_HEXES.length;

/* ---------- 零、真清单先挂上（h 里每一枚 title/placeholder 都过 Txt.out 一遍） ---------- */
Txt.use({ prog:'Flow-Desk', read: async () => ({ text: UI_TEXT_YAML, file:'data/ui-text.yaml' }) });
await Txt.boot();
记('清单这一份', '读回 ' + UI_TEXT_YAML.length + ' 字符 · Txt.has=' + Txt.has +
  ' · 盯着新节点的 MutationObserver = ' + (Txt._watching ? '开着（和真页面一样）' : '没开'));

/* ---------- 一、211 个一组：首次摆开 ---------- */
CardPool.addAll(RIME_HEXES, 'rime');
const 个数 = CardPool.count();
let t0 = performance.now();
cardPoolDlg(() => {});
const 体 = 架.开.body;
const 高 = 逼布局(体);
let t1 = performance.now();
记('首次摆开 ' + 个数 + ' 个（一组、来源全记 Rime）', '建节点+挂文档+逼一遍布局 ' + (t1 - t0).toFixed(1) +
  ' ms · 节点 ' + 数节点(体) + ' 个 · 内容高 ' + 高 + 'px · 窗口高 ' + window.innerHeight + 'px');
T('A1 池子里真摆了 ' + 个数 + ' 个（一个一个 button.fd-dot，不是空气）',
  数节点(体) > 0 && 体.querySelectorAll('button.fd-dot').length === 个数, 体.querySelectorAll('button.fd-dot').length);
T('A2 那一串一共 ' + 一共 + ' 个色号，进池 ' + 个数 + ' 个（同色不攒第二个，所以两个数该一样）', 一共 === 个数, 一共 + ' vs ' + 个数);
await 等一拍();
记('A3 首屏这一趟之外还欠一笔', '绘制那一笔这台量不了（后台标签 rAF 不推进）—— 要看得在真程序里点一趟');

/* ---------- 二、点一个 = draw() 整屏重建，连点 50 趟 ---------- */
const 只JS = [], 带布局 = [];
for(let i = 0; i < 50; i++){
  const 钮 = document.querySelectorAll('button.fd-dot')[i % 个数];
  const a = performance.now(); 钮.dispatchEvent(new MouseEvent('click', { bubbles:true }));
  const b = performance.now(); 逼布局(架.开.body);
  只JS.push(b - a); 带布局.push(performance.now() - b);
}
只JS.sort((x, y) => x - y); 带布局.sort((x, y) => x - y);
记('点一个（整屏重建 ' + 个数 + ' 个）· 50 趟',
  'JS 那一趟中位 ' + 只JS[25].toFixed(2) + ' ms（最快 ' + 只JS[0].toFixed(2) + ' · 最慢 ' + 只JS[49].toFixed(2) + '）' +
  ' · 再逼一遍布局中位 ' + 带布局[25].toFixed(2) + ' ms（最慢 ' + 带布局[49].toFixed(2) + '）' +
  ' · 两笔合起来中位 ' + (只JS[25] + 带布局[25]).toFixed(2) + ' ms');
T('B1 点一个「JS + 布局」两笔合起来在一帧之内（一帧 16.7 ms）· 中位 ' + (只JS[25] + 带布局[25]).toFixed(1) + ' ms',
  只JS[25] + 带布局[25] < 16.7, (只JS[25] + 带布局[25]).toFixed(2));

/* ---------- 三、开「颜色管理」那一趟（每个多挂一枚小叉） ---------- */
{ const 钮 = 找管理钮(); T('C1 「颜色管理」那个在位', !!钮);
  const 前 = 数节点(体);
  const a = performance.now(); 钮.dispatchEvent(new MouseEvent('click', { bubbles:true }));
  const 新体 = 架.开 && 架.开.body;
  记('开管理态：整屏重建（每个多一枚小叉）', (performance.now() - a).toFixed(1) +
    ' ms · 节点 ' + 数节点(新体) + ' 个（只挑色那一趟是 ' + 前 + ' 个）· 内容高 ' + 逼布局(新体) + 'px');
  T('C2 管理态每个多一枚小叉（整屏节点数比只挑色那一趟多）', 数节点(新体) > 前, 数节点(新体) + ' vs ' + 前); }
{ const a = performance.now(); 找管理钮().dispatchEvent(new MouseEvent('click', { bubbles:true }));
  记('关管理态：又整屏重建一趟', (performance.now() - a).toFixed(1) + ' ms'); }

/* ---------- 四、30 / 60 / 120 / 211 四档（看是不是一条直线） ---------- */
const 档 = [];
for(const N of [30, 60, 120, 211]){
  CardPool.items = []; CardPool.ready = true; CardPool.tuneOn = false;
  CardPool.addAll(RIME_HEXES.slice(0, N), 'rime');
  Modal.close();
  const a = performance.now(); cardPoolDlg(() => {}); 逼布局(架.开.body); 档.push({ N, 首屏: performance.now() - a });
  const 钮 = document.querySelectorAll('button.fd-dot')[0];
  const c = performance.now(); 钮.dispatchEvent(new MouseEvent('click', { bubbles:true }));
  const d = performance.now(); 逼布局(架.开.body);
  档[档.length - 1].点击 = (d - c) + (performance.now() - d);
  档[档.length - 1].JS = d - c;
  档[档.length - 1].节点 = 数节点(架.开.body);
}
档.forEach(x => 记(x.N + ' 个那一档', '首屏 ' + x.首屏.toFixed(1) + ' ms · 点一个（JS+布局）' + x.点击.toFixed(2) +
  ' ms（其中 JS ' + x.JS.toFixed(2) + '）· 节点 ' + x.节点 + ' 个'));
const 倍 = 档[3].N / 档[0].N;
T('D1 是一条直线（个数 ' + 倍 + ' 倍，首屏和点一个都不超过 ' + 倍 + ' 倍再多一倍）',
  档[3].首屏 / 档[0].首屏 < 倍 * 2 && 档[3].点击 / 档[0].点击 < 倍 * 2,
  JSON.stringify(档.map(x => [x.N, +x.首屏.toFixed(1), +x.点击.toFixed(2)])));

/* ---------- 五、同样 211 个分 7 组摆（多 7 个组头） ---------- */
CardPool.items = []; CardPool.ready = true; CardPool.tuneOn = false;
CardPool.addAll(RIME_HEXES, 'rime');
const 组名 = ['日常', '冷', '暖', '中性', '灰', '强调', '其他'];
CardPool.items.forEach((c, i) => CardPool.setGroup(c.code, 组名[i % 7]));
Modal.close();
{ const a = performance.now(); cardPoolDlg(() => {});
  记('211 个分 7 组摆', '首屏 ' + (performance.now() - a).toFixed(1) + ' ms · 组 ' + CardPool.groups().length +
    ' 摊 · 内容高 ' + 逼布局(架.开.body) + 'px（一组那一趟是 ' + 高 + 'px）'); }

/* ---------- 六、同一趟，清单开着 vs 短路（差多少就是 Txt.out 那一查的钱） ---------- */
CardPool.items = []; CardPool.ready = true; CardPool.tuneOn = false;
CardPool.addAll(RIME_HEXES, 'rime');
Modal.close();
{ const a = performance.now(); cardPoolDlg(() => {}); 逼布局(架.开.body);
  const 开 = performance.now() - a;
  const 留 = Txt.has; Txt.has = false;
  Modal.close();
  const c = performance.now(); cardPoolDlg(() => {}); 逼布局(架.开.body);
  const 短 = performance.now() - c;
  Txt.has = 留; Modal.close();
  const e = performance.now(); cardPoolDlg(() => {}); 逼布局(架.开.body);
  const 重开 = performance.now() - e;
  记('211 个首屏 · 清单开/短路/再开', 开.toFixed(1) + ' ms ／ ' + 短.toFixed(1) + ' ms ／ ' + 重开.toFixed(1) + ' ms（差 ' + (开 - 短).toFixed(1) + ' ms）');
  Modal.close(); }

window.__RESULT = { lines: out, bad };
`;

const html = ['<!doctype html><meta charset="utf-8"><title>第 37 轮 · 色卡那一屏摆 211 个有多重</title>',
  '<body><pre id="o" style="font:13px/1.7 monospace;white-space:pre-wrap"></pre><script>',
  STUB, SRC, '(async()=>{ try{', TEST,
  '}catch(e){ const sp = String((e && e.stack) || e); window.__RESULT = { lines: out.concat(["THROW " + sp.split("\\n").slice(0,4).join(" | ")]), bad: bad + 1 }; } })();',
  '</script></body>'].join('\n');
if((STUB + SRC + TEST).includes('</script')) throw new Error('源码含 </script，会撕页');
const DST = __HERE + 'cards-perf.html';
fs.writeFileSync(DST, html);
console.log('写了 cards-perf.html（' + Math.round(html.length / 1024) + ' KB）｜ CSS ' + CSS.length +
  ' ｜ cardPoolBox ' + POOLDLG.length + ' ｜ segCtrl ' + SEG.length + ' ｜ 色卡池 ' + CARDS.length + ' ｜ RIME ' + RIMEHEX.length);
