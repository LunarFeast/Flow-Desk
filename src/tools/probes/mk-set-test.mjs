/* 外25 五组自测页：① 浮层固定尺寸（Overlay 的 fix 那一档）② 高亮规则谁能删、删了还回不回得来
   ③「可用的正则写法」那一张摆的是什么。
   三样都是从源码里原样切下来塞进浏览器的：Overlay 整只、HL_SEED / isLockedRule / WriteCfg 整只、
   hlRegexHelp 整只，CSS 那几条也从 w0-skin.js 原样搬 —— 不另写一份假的来自己给自己看。 */
/* 外29 第 40 轮：探针搬进仓库 src\tools\probes\ 之后，生成的页面就近落在这旁边，不再写回会话临时目录 */
import { fileURLToPath as __u2p } from 'node:url';
const __HERE = __u2p(new URL('.', import.meta.url));

import fs from 'node:fs';

const REPO = 'D:/Programs/Flow-Desk';
const W3 = fs.readFileSync(REPO + '/src/_wnw/src/w3-shell.js', 'utf8');
const W8 = fs.readFileSync(REPO + '/src/_wnw/src/w8-write.js', 'utf8');
const W0 = fs.readFileSync(REPO + '/src/_wnw/src/w0-skin.js', 'utf8');

function pick(src, head, stopAt){
  const i = src.indexOf(head);
  if(i < 0) throw new Error('源码里找不到「' + head + '」');
  const b = src.indexOf('{', i);
  let d = 0, j = b;
  for(; j < src.length; j++){ const c = src.charCodeAt(j); if(c === 123) d++; else if(c === 125){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
const SRC = {
  Overlay: pick(W3, 'const Overlay = {'),
  HL_SEED: pick(W8, 'const HL_SEED = ['),
  WriteCfg: pick(W8, 'const WriteCfg = {'),
  hlRegexHelp: pick(W8, 'function hlRegexHelp')
};
/* HL_SEED 那一段切出来是以 [ 开头的数组字面量：pick 找的是第一个 { —— 这里改成按分号收尾更稳 */
SRC.HL_SEED = (() => {
  const i = W8.indexOf('const HL_SEED = [');
  const j = W8.indexOf('\n];', i);
  if(i < 0 || j < 0) throw new Error('没切到 HL_SEED');
  return W8.slice(i, j + 3);
})();
/* 锁与判法那两行紧跟在 HL_SEED 后面，一并搬过来 */
SRC.HL_LOCK = (() => {
  const i = W8.indexOf('const HL_LOCK =');
  const j = W8.indexOf('\n', W8.indexOf('isBuiltinRule', i));
  if(i < 0 || j < 0) throw new Error('没切到 HL_LOCK 那两行');
  return W8.slice(i, j + 1);
})();
/* CSS：面板与浮层那几条原样搬（fix 那一档量的是真排版，抽掉规则就是自欺） */
function cssSlice(){
  const a = W0.indexOf('/* 浮层和小菜单原来是 fixed');
  const b = W0.indexOf('.wnw-root .wnw-panel-head');
  const c = W0.indexOf('/* 「可用的正则写法」那一张');
  const d = W0.indexOf('\n', W0.indexOf('.wnw-hl-re-row .ds', c));
  if(a < 0 || b < 0 || c < 0) throw new Error('没切到浮层 / 正则说明那两段 CSS');
  const s = W0.slice(a, b) + W0.slice(c, d);
  if(s.includes('${')) throw new Error('切到的 CSS 里有模板插值');
  return s;
}

const STUB = `
function h(tag, props, kids){
  const el = document.createElement(tag);
  if(props) for(const k in props){
    const v = props[k];
    if(v == null || v === false) continue;
    if(k === 'class') el.className = v;
    else if(k === 'style') el.setAttribute('style', v);
    else if(k === 'html') el.innerHTML = v;
    else if(k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if(k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v);
  }
  const put = x => { if(x == null || x === false) return;
    if(Array.isArray(x)) x.forEach(put);
    else if(x instanceof Node) el.appendChild(x);
    else el.appendChild(document.createTextNode(String(x))); };
  if(kids != null) put(kids);
  return el;
}
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }
function icoMarkup(){ return ''; }
const ROOT = document.createElement('div');
ROOT.className = 'wnw-root';
ROOT.style.cssText = 'position:relative;width:900px;height:520px;border:1px solid #ccc;overflow:hidden;margin:10px';
document.body.appendChild(ROOT);
function wnwRoot(){ return ROOT; }
function wnwBox(){ const r = ROOT.getBoundingClientRect(); return { w:r.width, h:r.height }; }
const STATE = {};
const State = { async get(k, fb){ return (k in STATE) ? JSON.parse(STATE[k]) : fb; },
  set(k, v){ STATE[k] = JSON.stringify(v); return Promise.resolve(true); } };
const BUS = [];
const Bus = { emit(k){ BUS.push(k); }, on(){ } };
let UID = 0;
function uid(p){ return p + (++UID); }
function hlCss(st){ return st ? 'x' : ''; }
function markCount(){ return 6; }
`;

const BODY = STUB + SRC.Overlay + '\n' + SRC.HL_SEED + '\n' + SRC.HL_LOCK + '\n' + SRC.WriteCfg + '\n' + SRC.hlRegexHelp + '\n';
if(BODY.includes('</script')) throw new Error('源码里含 </script，会撕页');

const TEST = `
const out = []; let bad = 0;
const T = (nm, cond, extra) => { out.push((cond ? 'PASS ' + nm + (extra == null ? '' : '  ·  ' + extra) : 'FAIL ' + nm + (extra == null ? '' : '  ·  ' + extra))); if(!cond) bad++; };
/* 量的是当前露出来的那一张：底下藏着的那些还挂在树上（display:none），得从 Overlay.node 拿 */
const 尺 = () => { const p = Overlay.node && Overlay.node.querySelector('.wnw-panel'); if(!p) return null;
  const r = p.getBoundingClientRect(); return { w:Math.round(r.width), h:Math.round(r.height) }; };
const 高 = n => h('div', { style:'height:' + n + 'px' }, 'x');
const 关干净 = () => { let n = 0; while(Overlay.node && n < 8){ Overlay.close(); n++; } };

/* 一、同一档浮层尺寸不许来回变（fix 那一档），不同档各管各的 */
Overlay.open('甲', 高(60), null, { fix:'词格' });
const 甲 = 尺();
Overlay.open('乙', 高(300), null, { fix:'词格' });
const 乙 = 尺();
Overlay.open('丙', 高(60), null, { fix:'词格' });
const 丙 = 尺();
关干净();
T('开第二张会撑到内容那么大', 乙.h > 甲.h, '甲 ' + 甲.w + 'x' + 甲.h + ' → 乙 ' + 乙.w + 'x' + 乙.h);
T('第三张内容小了，窗口尺寸照旧（不缩回去）', 丙.w === 乙.w && 丙.h === 乙.h, '丙 ' + 丙.w + 'x' + 丙.h + ' ｜ 乙 ' + 乙.w + 'x' + 乙.h);
Overlay.open('丁', 高(40), null, { fix:'高亮' });
const 丁 = 尺();
关干净();
T('另一档（高亮）不受这一档影响，按自己的内容来', 丁.h < 甲.h, '丁 ' + 丁.w + 'x' + 丁.h + ' ｜ 词格那一档 ' + 乙.w + 'x' + 乙.h);
Overlay.open('戊', 高(80), null);
const 戊 = 尺();
关干净();
T('没点 fix 的窗口照旧按自己的内容（既不缩到 40 那一号，也不吃任何一档记住的 328）',
  戊.h < 乙.h && 戊.h > 丁.h, '戊（内容 80）' + 戊.w + 'x' + 戊.h + ' ｜ 高亮那一档记的 ' + 丁.h + ' ｜ 词格那一档记的 ' + 乙.h);

/* 二、规则谁能删、删了还回不回得来 */
(async () => {
  await WriteCfg.load();
  T('出厂六条都在', WriteCfg.rules.length === 6, WriteCfg.rules.map(r => r.id).join(','));
  T('书名号、关键词表拆不动', WriteCfg.delRule('book') === false && WriteCfg.delRule('keyword') === false &&
    WriteCfg.rules.length === 6, WriteCfg.rules.length + ' 条');
  T('其余四条拆得动（说话先拆一条）', WriteCfg.delRule('dialog') === true && WriteCfg.rules.length === 5, WriteCfg.rules.length + ' 条');
  WriteCfg.rules.find(r => r.id === 'place').src = '[\\\\u4e00-\\\\u9fa5]{2,4}市';
  WriteCfg.rules.find(r => r.id === 'pivot').on = true;
  await WriteCfg.save();
  T('删掉的那条记进 hl-gone 这一笔账', STATE['hl-gone'] && JSON.parse(STATE['hl-gone']).join(',') === 'dialog', String(STATE['hl-gone']));
  WriteCfg.rules = []; WriteCfg.gone = [];
  await WriteCfg.load();
  T('重新开机：删掉的那条不再补回来（五条，不含说话）',
    WriteCfg.rules.length === 5 && !WriteCfg.rules.some(r => r.id === 'dialog'), WriteCfg.rules.map(r => r.id).join(','));
  T('改过的式子与开关回得来（地名那条吃的是存下来那份）',
    WriteCfg.rules.find(r => r.id === 'place').src === '[\\\\u4e00-\\\\u9fa5]{2,4}市' &&
    WriteCfg.rules.find(r => r.id === 'pivot').on === true,
    WriteCfg.rules.find(r => r.id === 'place').src + ' ｜ 转折词 on=' + WriteCfg.rules.find(r => r.id === 'pivot').on);
  T('钉死那两条永远在（哪怕 hl-gone 里被塞了它们的名字）',
    WriteCfg.rules.some(r => r.id === 'book') && WriteCfg.rules.some(r => r.id === 'keyword'));
  /* 编译那一条：坏式子只作废自己，别的一条不连累 */
  WriteCfg.rules.find(r => r.id === 'place').src = '([0-9';
  WriteCfg.rules.find(r => r.id === 'place').on = true;
  WriteCfg.compile();
  T('式子写坏了：这一条不进编译，其余照旧', !WriteCfg.re.some(x => x.slot === 2) && WriteCfg.re.length >= 1,
    '编译进去 ' + WriteCfg.re.length + ' 条');
  WriteCfg.rules.find(r => r.id === 'place').src = '[0-9]{3}';
  WriteCfg.compile();
  const 中 = WriteCfg.spans('一共 123456 元', null, 'write');
  T('改完的式子真的能命中（[0-9]{3} 在 123456 里挑到段）', 中.length >= 2, '命中 ' + 中.length + ' 段');

  /* 三、「可用的正则写法」那一张 */
  hlRegexHelp();
  const p = Overlay.node.querySelector('.wnw-panel');
  const rows = Array.from(p.querySelectorAll('.wnw-hl-re-row'));
  const codes = rows.map(r => String(r.querySelector('code').textContent));
  const 分组 = Array.from(p.querySelectorAll('.wnw-hl-re-grp')).map(x => x.textContent);
  T('那张窗口有标题、有分组', /可用的正则写法/.test(p.textContent) && 分组.length === 3, 分组.join(' ／ '));
  T('记号、例子、注意一共 ' + rows.length + ' 行，每行都有式子', rows.length >= 16 && codes.every(c => c.length > 0),
    '记号 ' + (rows.length - 5 - 2) + ' 行 + 出厂例子 5 条 + 注意 2 行');
  const 出厂 = WriteCfg.rules.filter(r => r.src).map(r => r.src);
  T('出厂那几条的式子一条条列在上面（能直接抄）',
    codes.filter(c => c.indexOf('{') >= 0 || c.indexOf('|') >= 0).length >= 5 &&
    /省\\|市\\|县/.test(JSON.stringify(codes)), codes.slice(-6).join(' ｜ '));
  T('写了「能空着的式子别这么写」那一条提醒', /一格一格亮成一片/.test(p.textContent));
  Overlay.close();
  T('这一张也归「高亮」那一档尺寸（和外观那一张同进退）', Overlay.sizes['高亮'] && Overlay.sizes['高亮'].h > 200,
    JSON.stringify(Overlay.sizes));
  window.__RESULT = { lines:out, bad };
})();
`;

const HTML = '<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>外25 五组 · 浮层尺寸与高亮规则</title><style>' +
  ':root{--text:#222;--text-light:#888;--accent:#2f7d7d;--accent-text:#1f5d5d;--card-bg:#fff;--card-border:#ddd;' +
  '--btn-bg:#eef2fa;--input-bg:#fff;--input-border:#b9bec7;--ctl-edge:#b9bec7;--candidate-bg:#f0f2f5;' +
  '--hair:1px solid #eee;--gap:8px;--gap-blk:14px;--r-panel:10px;--bad:#c0392b;--ff-code:ui-monospace,Consolas,monospace}' +
  'body{font:14px/1.6 system-ui,sans-serif;margin:0;padding:8px;background:#fff;color:var(--text)}' +
  '.wnw-btn{border:1px solid var(--ctl-edge);background:var(--btn-bg);border-radius:4px;padding:2px 8px;font:inherit}' +
  '.wnw-input{border:1px solid var(--ctl-edge);background:var(--input-bg);padding:2px 6px;font:inherit}' +
  '.wnw-col{display:flex;flex-direction:column}' +
  '.wnw-row{display:flex;gap:8px;align-items:center}' +
  '.wnw-hint{color:var(--text-light);font-size:.86em;line-height:1.6}' +
  cssSlice() +
  '</style></head><body><script>' + BODY + TEST + '</script></body></html>';

fs.writeFileSync(__HERE + 'set-test.html', HTML);
console.log('写了 set-test.html：' + (HTML.length / 1024).toFixed(0) + ' KB · CSS 段 ' + cssSlice().split('\n').length + ' 行');
