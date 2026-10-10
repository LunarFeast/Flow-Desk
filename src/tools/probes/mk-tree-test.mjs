/* 外25 三组自测页：章节大纲那一列（字数、拖拽排序、模式图标）。
   不吃整个面板 —— 只把源码里那几段真函数和真 CSS 切出来塞进浏览器：
   cntTxt / modeShown / lyricFilled / chWords 和 Work 的 reorderCh / reorderVol / moveChToVol / orderedChs / totalWords
   都是从 D:\Programs\Flow-Desk\src\_wnw\src\ 那两份文件原样切下来的，一行都不重写；
   CSS 也是原样那一段（先验它不含 ${，切一半的模板字面量会造出假样）。
   为什么要在浏览器里跑：右对齐、等宽数字、模式图标占位这三条全靠真排版，node 量不出来。 */
/* 外29 第 40 轮：探针搬进仓库 src\tools\probes\ 之后，生成的页面就近落在这旁边，不再写回会话临时目录 */
import { fileURLToPath as __u2p } from 'node:url';
const __HERE = __u2p(new URL('.', import.meta.url));

import fs from 'node:fs';

const REPO = 'D:/Programs/Flow-Desk';
const W7 = fs.readFileSync(REPO + '/src/_wnw/src/w7-data.js', 'utf8');
const W8 = fs.readFileSync(REPO + '/src/_wnw/src/w8-write.js', 'utf8');

/* 从源码里切一个函数：从头那一句起到它自己那对花括号闭合。
   这几段里没有字符串内的花括号，注释里也没有，数括号的尺够用（用到新函数上要先确认这一条）。 */
function pick(src, head, where){
  const i = src.indexOf(head);
  if(i < 0) throw new Error('源码里找不到「' + head + '」（' + where + '）');
  const b = src.indexOf('{', i);
  let d = 0, j = b;
  for(; j < src.length; j++){
    const c = src.charCodeAt(j);
    if(c === 123) d++;
    else if(c === 125){ d--; if(!d){ j++; break; } }
  }
  return src.slice(i, j);
}
/* CSS 那一段：从「左侧章节面板」那句注释起到 .wnw-bookhead 为止，整段原样搬 */
function cssSlice(){
  const a = W8.indexOf('/* 左侧章节面板 */');
  const b = W8.indexOf('.wnw-bookhead{', a);
  if(a < 0 || b < 0) throw new Error('没切到章节面板那段 CSS');
  const s = W8.slice(a, b);
  if(s.includes('${')) throw new Error('切到的 CSS 里有模板插值，这页装不下');
  return s;
}

const F = {
  chWords: pick(W7, 'function chWords', 'w7-data'),
  lyricFilled: pick(W7, 'function lyricFilled', 'w7-data'),
  modeShown: pick(W7, 'function modeShown', 'w7-data'),
  cntTxt: pick(W8, 'function cntTxt', 'w8-write'),
  reorderCh: pick(W7, 'async reorderCh', 'w7-data'),
  reorderVol: pick(W7, 'async reorderVol', 'w7-data'),
  moveChToVol: pick(W7, 'async moveChToVol', 'w7-data'),
  orderedChs: pick(W7, 'orderedChs()', 'w7-data'),
  totalWords: pick(W7, 'totalWords()', 'w7-data')
};

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
    else el.setAttribute(k, v);
  }
  const put = x => { if(x == null || x === false) return;
    if(Array.isArray(x)) x.forEach(put);
    else if(x instanceof Node) el.appendChild(x);
    else el.appendChild(document.createTextNode(String(x))); };
  if(kids != null) put(kids);
  return el;
}
function icoMarkup(n){ return '<span class="w-ico" data-ico="' + n + '"></span>'; }
const SAVED = [], SYNCED = [];
`;

/* Work 只补真函数要用的那几枚邻居：存盘、改正文所属卷、按 id 找章 —— 都是记账用的假壳，
   被验的那五条（reorderCh / reorderVol / moveChToVol / orderedChs / totalWords）本身一句没动。 */
const WORK = `
const Work = {
  book:null,
  ${F.reorderCh},
  ${F.reorderVol},
  ${F.moveChToVol},
  ${F.orderedChs},
  ${F.totalWords},
  async saveBook(){ SAVED.push(this.book.chs.length); },
  async syncChVid(id, vid){ SYNCED.push(id + '>' + vid); const c = CHOBJ[id]; if(c) c.vid = vid; },
  chMeta(id){ return this.book.chs.find(c => c.id === id) || null; },
  async ch(id){ return CHOBJ[id]; }
};
`;

const SRC = STUB + F.chWords + '\n' + F.lyricFilled + '\n' + F.modeShown + '\n' + F.cntTxt + '\n' + WORK + '\n';
if(SRC.includes('</script')) throw new Error('源码里含 </script，会撕页');

const TEST = `
const out = []; let bad = 0;
const T = (nm, cond, extra) => { out.push((cond ? 'PASS ' : 'FAIL ') + nm + (extra == null ? '' : '  ·  ' + extra)); if(!cond) bad++; };

/* 〇、造一本书：两卷，头卷三章、二卷两章；字数各不相同，模式也各不相同。
      c1 写作有字 · c2 笔记有字 · c3 词格有字（正文空） · c4 正文空、词格也空 · c5 词格是空壳、正文有字 */
const CHOBJ = {};
function mk(id, vid, title, w, mode, lyric){
  const paras = [];
  for(let i = 0; i < Math.max(0, w); i++) paras.push({ id:id + '_p' + i, k:'p', t:'字' });
  const c = { id, vid, title, mode, paras, lyric: lyric || null, at:0 };
  CHOBJ[id] = c;
  return { id, vid, title, w, mode, para:paras.length, ly:lyricFilled(c) ? 1 : 0 };
}
function fresh(){
  return { id:'b', title:'测试书', vols:[{ id:'v1', title:'第一卷' }, { id:'v2', title:'第二卷' }],
    chs:[ mk('c1','v1','第一章',1000,'write'), mk('c2','v1','第二章',2000,'note'),
          mk('c3','v1','第三章',0,'lyric',{ title:'', lines:[{ seg:'', clauses:[{ cells:[{ t:'爱', ms:400 }] }] }] }),
          mk('c4','v2','第四章',0,'write'),
          mk('c5','v2','第五章',500,'lyric',{ title:'', lines:[{ seg:'', clauses:[{ cells:[{ t:'', ms:null }] }] }] }) ],
    goal:0, chGoal:0, daily:{} };
}

/* 一、行尾那串数：只显数字、带比值的三种切法、和累计档共处一格 */
T('只显自己：不写「字」', cntTxt(1234, 0, null, 0) === '1234', cntTxt(1234, 0, null, 0));
T('章比卷：1234/45678', cntTxt(1234, 45678, null, 0) === '1234/45678', cntTxt(1234, 45678, null, 0));
T('比值照旧吃单章目标：600/2000 那档再跟 30%', cntTxt(600, 2000, null, 2000) === '600/2000 · 30%', cntTxt(600, 2000, null, 2000));
T('累计档没动：本行 | 累计', cntTxt(1234, 0, 98765, 0) === '1234 | 98765', cntTxt(1234, 0, 98765, 0));
T('比值 + 累计同开：三段一起排', cntTxt(1234, 45678, 98765, 20000) === '1234/45678 | 98765 · 494%', cntTxt(1234, 45678, 98765, 20000));
T('完成度封顶 999% 还在', cntTxt(1, 0, 999999, 100) === '1 | 999999 · 999%', cntTxt(1, 0, 999999, 100));
let 只数字 = true, 样例 = [];
for(const own of [0, 7, 1234, 987654]) for(const den of [0, 45678]) for(const cum of [null, 98765]) for(const g of [0, 2000]){
  const s = cntTxt(own, den, cum, g);
  if(s.indexOf('字') >= 0) 只数字 = false;
  if(样例.length < 3) 样例.push(s);
}
T('16 种组合里没有一处写「字」', 只数字, 样例.join(' | '));

/* 二、模式那一档：哪一档存着字就认哪一档 */
T('词格有字 + 正文空 → 词格', modeShown('write', false, true) === 'lyric');
T('上次用的词格空了、正文有字 → 写作', modeShown('lyric', true, false) === 'write');
T('两边都有字 → 照上次用的那一档（笔记）', modeShown('note', true, true) === 'note');
T('两边都没字 → 也照上次用的那一档', modeShown('lyric', false, false) === 'lyric');
T('笔记空、正文有字 → 还是笔记（写作和笔记吃同一份正文）', modeShown('note', true, false) === 'note');
T('写作有字 → 写作', modeShown('write', true, false) === 'write');
/* 真章对象上验 lyricFilled：一格有字才算，空壳不算（先把书造出来，CHOBJ 里才有那五章的正文） */
fresh();
T('lyricFilled 认得出真数据：c3 有字 / c5 是空壳 / c1 没词格',
  lyricFilled(CHOBJ.c3) === true && lyricFilled(CHOBJ.c5) === false && lyricFilled(CHOBJ.c1) === false,
  [lyricFilled(CHOBJ.c3), lyricFilled(CHOBJ.c5), lyricFilled(CHOBJ.c1)].join('/'));

/* 三、摆一列出来量排版：右对齐、等宽数字、模式图标占位固定 */
const root = h('div', { class:'wnw-root' });
const tree = h('div', { class:'wnw-tree' });
root.appendChild(tree); document.body.appendChild(root);
const b = Work.book = fresh();
const book = Work.totalWords();
const vsum = {};
for(const c of Work.orderedChs()) vsum[c.vid] = (vsum[c.vid] || 0) + chWords(c);
const rows = [];
for(const v of b.vols){
  tree.appendChild(h('div', { class:'wnw-vol' }, [ h('span', { class:'ttl' }, v.title),
    h('span', { class:'cnt' }, cntTxt(Work.orderedChs().filter(x => x.vid === v.id).reduce((a, x) => a + chWords(x), 0), book, null, 0)) ]));
  for(const m of Work.orderedChs().filter(x => x.vid === v.id)){
    const mk2 = modeShown(m.mode, chWords(m) > 0, m.ly == null ? m.mode === 'lyric' : !!m.ly);
    const r = h('div', { class:'wnw-ch' + (m.id === 'c1' ? ' sel' : '') }, [
      h('span', { class:'wnw-mode', html:icoMarkup(mk2 === 'lyric' ? 'music' : mk2 === 'note' ? 'list' : 'pencil') }),
      h('span', { class:'ttl' }, m.title),
      h('span', { class:'cnt' }, cntTxt(chWords(m), vsum[m.vid], null, 0))
    ]);
    tree.appendChild(r); rows.push([m, r, mk2]);
  }
}
const cs = el => getComputedStyle(el);
const cntOf = r => r.querySelector('.cnt'), modeOf = r => r.querySelector('.wnw-mode');
const right = r => Math.round(cntOf(r).getBoundingClientRect().right);
let 齐右 = true, 差最大 = 0;
const rs = rows.map(r => right(r[1]));
for(let i = 1; i < rs.length; i++){ const d = Math.abs(rs[i] - rs[0]); if(d > 差最大) 差最大 = d; if(d > 1) 齐右 = false; }
T('章那一列的数字右沿对齐（各行的字宽不同也不错开）', 齐右, '右沿 x = ' + rs.join(',') + ' · 最大差 ' + 差最大 + 'px');
T('数字用等宽字形（tabular-nums）', /tabular-nums/.test(cs(cntOf(rows[0][1])).fontVariantNumeric), cs(cntOf(rows[0][1])).fontVariantNumeric);
const volR = Array.from(tree.querySelectorAll('.wnw-vol'));
let 卷右齐 = true, 卷差 = 0;
for(const v of volR){ const d = Math.abs(Math.round(v.querySelector('.cnt').getBoundingClientRect().right) - rs[0]);
  if(d > 卷差) 卷差 = d; if(d > 1) 卷右齐 = false; }
T('卷那一行和章同一根右基线', 卷右齐, '最大差 ' + 卷差 + 'px');
let 宽固定 = true; const ws = rows.map(r => Math.round(modeOf(r[1]).getBoundingClientRect().width));
for(const w of ws) if(Math.abs(w - ws[0]) > 0.5) 宽固定 = false;
T('模式图标占位一样宽：章名不会左右跳', 宽固定, ws.join(',') + 'px');
const 图标 = rows.map(r => r[2] + ':' + modeOf(r[1]).firstChild.getAttribute('data-ico'));
T('三档各一张图：c1 写作 / c2 笔记 / c3 词格 / c4 空章照上次 / c5 词格空壳但正文有字 → 写作',
  图标.join(',') === 'write:pencil,note:list,lyric:music,write:pencil,write:pencil', 图标.join(','));
T('行上那四枚图标没了（改名/上移/下移/删除都撤了）',
  rows.every(r => r[1].querySelectorAll('button').length === 0), '每行按钮数 ' + rows.map(r => r[1].querySelectorAll('button').length).join(','));

/* 四、拖拽排序：真走一遍 Work.reorderCh / reorderVol / moveChToVol */
const ids = () => Work.orderedChs().map(c => c.id).join('');
(async () => {
  /* 章内前后插：c3 拖到 c1 后面 */
  await Work.reorderCh('c3', 'c1', 'after');
  T('c3 落到 c1 下半 = 紧跟 c1', ids() === 'c1c3c2c4c5', ids());
  T('同一卷内换序不改所属卷', Work.chMeta('c3').vid === 'v1' && CHOBJ.c3.vid === 'v1');
  /* 跨卷：c3 拖到 c5 前面 = 连带并进第二卷，正文那一份也跟着改
     （第二卷这时是 c4,c5，插在 c5 前面就成了 c4,c3,c5） */
  await Work.reorderCh('c3', 'c5', 'before');
  T('c3 落到 c5 上半 = 排它前面', ids() === 'c1c2c4c3c5', ids());
  T('跨卷那一下目录和正文都改了 vid', Work.chMeta('c3').vid === 'v2' && CHOBJ.c3.vid === 'v2',
    Work.chMeta('c3').vid + '/' + CHOBJ.c3.vid);
  /* 自己拖到自己：不许改动 */
  const before = ids();
  await Work.reorderCh('c2', 'c2', 'after');
  T('拖回自己那一行 = 一动不动', ids() === before, ids());
  /* 落到卷那一行：并进那一卷末尾（第二卷这时是 c4,c3,c5，c1 追加到它尾巴上） */
  await Work.moveChToVol('c1', 'v2');
  T('c1 并进第二卷末尾 · 而且目录里这一章还在', ids() === 'c2c4c3c5c1', ids());
  T('c1 换卷没把别的章带丢', Work.book.chs.length === 5, Work.book.chs.length + ' 条');
  /* 卷排序：v2 拖到 v1 前面 */
  await Work.reorderVol('v2', 'v1', 'before');
  const 卷序 = Work.book.vols.map(v => v.id).join('');
  T('卷落到另一卷上半 = 排它前面', 卷序 === 'v2v1', 卷序);
  T('卷一换序，全书那一列跟着换', ids() === 'c4c3c5c1c2', ids());
  await Work.reorderVol('v2', 'v1', 'after');
  T('卷落到另一卷下半 = 跟它后面', Work.book.vols.map(v => v.id).join('') === 'v1v2', Work.book.vols.map(v => v.id).join(''));
  /* 乱拖 200 趟：条数不丢不重，每卷里的章始终属于那一卷 */
  const b2 = Work.book = fresh();
  const N = b2.chs.length;
  let 乱 = 0, 坏 = 0, 丢 = 0, 自 = 0;
  for(let i = 0; i < 200; i++){
    const ms = b2.chs, vs = b2.vols;
    if(Math.random() < 0.7){
      const a = ms[Math.floor(Math.random() * N)], t = ms[Math.floor(Math.random() * N)];
      await Work.reorderCh(a.id, t.id, Math.random() < 0.5 ? 'before' : 'after'); 乱++;
      if(a.id === t.id) 自++;
    } else {
      const a = vs[Math.floor(Math.random() * vs.length)], t = vs[Math.floor(Math.random() * vs.length)];
      await Work.reorderVol(a.id, t.id, Math.random() < 0.5 ? 'before' : 'after'); 乱++;
      if(a.id === t.id) 自++;
    }
    const o = Work.orderedChs();
    if(o.length !== N){ 丢++; continue; }
    if(new Set(o.map(x => x.id)).size !== N){ 丢++; continue; }
    for(const c of o) if(c.vid !== CHOBJ[c.id].vid){ 坏++; break; }
  }
  T('乱拖 200 趟不丢章不重章', 丢 === 0, 丢 + ' 次不对');
  T('乱拖 200 趟目录的 vid 始终和正文一致', 坏 === 0, 坏 + ' 趟不一致');
  /* 落点函数被调用的次数 = 真存盘的次数：每趟只存一次，不许一趟存两回（拖回自己那一行不存，那几趟扣掉） */
  T('每一趟拖拽存盘一次', SAVED.length === 乱 - 自 + 5,
    '存盘 ' + SAVED.length + ' 次 / 拖拽 ' + 乱 + ' 趟（其中拖回自己 ' + 自 + ' 趟不存）');

  /* 五、源码那几条结构事实：改名和删除进了章那一行的右键菜单 */
  const 菜单段 = W8SRC.slice(W8SRC.indexOf('const chRowMenu'), W8SRC.indexOf('const volRowMenu'));
  T('章那一行的右键菜单里有「改名」', /label:'改名'/.test(菜单段));
  T('章那一行的右键菜单里有「删掉这一章」', /label:'删掉这一章'/.test(菜单段));
  const 树段 = W8SRC.slice(W8SRC.indexOf('const tree = (kind)'), W8SRC.indexOf('const olList'));
  T('章行不再造那四枚按钮', !/title:'改名'|title:'上移'|title:'下移'|title:'删掉这章'/.test(树段));
  T('章行挂了 draggable', /draggable/.test(W8SRC.slice(W8SRC.indexOf('const rowDrag'), W8SRC.indexOf('const tree = (kind)'))));
  T('⋮ 菜单里有三档分母', /行尾只显字数/.test(W8SRC) && /章比本卷、卷比全书/.test(W8SRC) && /章和卷都比全书/.test(W8SRC));
  T('大纲那一页（章纲）也吃同一套行数', /cntTxt\\(chWords\\(m\\), listSt\\.den/.test(W8SRC));

  window.__RESULT = { bad, out };
})();
`;

const HTML = '<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>外25 三组 · 章节大纲自测</title>' +
  '<style>' +
  ':root{--text:#222;--text-light:#888;--accent:#2f7d7d;--accent-light:#dceceb;--candidate-bg:#f2f2f2;' +
  '--card-border:#ddd;--card-bg:#fff;--hair-color:#e3e3e3;--r-card:6px;--sel-bg:#cfe3e3;--sel-text:#111}' +
  'body{font:14px/1.6 system-ui,sans-serif;margin:0;padding:10px;background:#fff;color:var(--text)}' +
  '.wnw-root{width:320px;border:1px solid var(--card-border)}' +
  '.w-ico{width:1.18em;height:1.18em;display:inline-block}' +
  cssSlice() +
  '</style></head><body><script>' +
  'const W8SRC = ' + JSON.stringify(W8) + ';\n' + SRC + TEST +
  '</script></body></html>';

fs.writeFileSync(__HERE + 'tree-test.html', HTML);
console.log('写了 tree-test.html：' + (HTML.length / 1024).toFixed(0) + ' KB · CSS 段 ' + cssSlice().split('\n').length + ' 行');
