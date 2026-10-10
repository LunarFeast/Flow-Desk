/* 渐变分型口径的落地前体检（开发用，不进产物）
   ----------
   要回答的问题只有一个：《配色原则与渐变规则》里那五条渐变类型，拿现成的配色库跑一遍，
   是真的把库里那些套分开，还是绕了一圈又全落在同一格里（那就是「一套模板套所有配色」，他要拦的那件事）。
   ----------
   分型和画法都不在这里另写一份：跑的是产物里那同一份真身（_shared/sh-look.js 的 gradRead /
   gradKindOf / gradDraw），这里只负责「读库 → 派生 → 交给真身 → 把落点摊开看」。
   三个跨度（带彩度的锚几个 / 色相跨度 / 明度跨度）的算法也在那一份里，理由同前：不抄第二遍。
   ----------
   顺手跑的两条硬核查（文档第三节的头两条，界面上拦不到、只有批量跑数才看得出来）：
     1) 明暗结论不许被渐变翻面 —— 每一个停靠点拿 mingDark(那一点, 正文) 和页面底的结论对一遍；
     2) 停靠点只准取这套已经派生出来的色号（含「页面底挪几个明度点」那一种），不许凭空多第四个颜色。
   跑法：node src/_fd/grad-survey.mjs [一份 palettes.yaml 的路径]
   不传路径就读 data\palettes.yaml（现在库里只剩内置两套）；要复查搬走的那 54 套就传：
     node src/_fd/grad-survey.mjs "备份/2026-10-05-撤Rime配色/palettes.yaml" */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const read = p => fs.readFileSync(path.isAbsolute(p) ? p : path.join(ROOT, p), 'utf8');

/* ---------- 配色引擎 + 外观层喂进一个没有 document 的上下文（和 look-check.mjs 同一台喂法） ---------- */
const ctx = vm.createContext({ Math, JSON, String, Number, Object, Array, RegExp, isNaN, parseFloat, parseInt, console });
vm.runInContext(read('src/_shared/sh-color.js'), ctx, { filename: 'sh-color.js' });
vm.runInContext(read('src/_shared/sh-look.js'), ctx, { filename: 'sh-look.js' });
vm.runInContext('globalThis.__api = { CV, tokensOf, mingDark, setPalScheme, gradRead, gradKindOf, gradDraw, gradTune, gradDef, GRAD_KINDS };', ctx);
const { CV, tokensOf, mingDark, setPalScheme, gradRead, gradKindOf, gradDraw, gradTune, gradDef } = ctx.__api;
setPalScheme('a');                                   /* 分型只按默认那一套（甲 · 语义认领）算一遍 */

/* ---------- palettes.yaml → 条目（照 look-check.mjs 里同一份读法，只留这里用得着的字段） ---------- */
const MODE_BACK = { '明亮': 'light', '黑暗': 'dark', '自定义色号': 'custom', '自定义': 'custom' };
const STD_BACK = { GRACOL: 'gracol', SWOP: 'swop', 'JAPAN COLOR': 'japan', JAPAN: 'japan' };
function ymlVal(s){
  const t = String(s === undefined || s === null ? '' : s).trim();
  if(/^".*"$/.test(t)){ try{ return JSON.parse(t); }catch(e){ return t.slice(1, -1); } }
  if(/^'.*'$/.test(t)) return t.slice(1, -1).replace(/''/g, "'");
  return t.replace(/\s+#.*$/, '').trim();
}
function parsePalettes(text){
  const secs = [], seen = new Set();
  let cur = null, listKey = '';
  for(const raw of String(text || '').split(/\r?\n/)){
    const line = String(raw).replace(/^﻿/, '');
    if(!line.trim() || /^\s*#/.test(line)) continue;
    const ind = (line.match(/^\s*/)[0] || '').length;
    const body = line.trim();
    if(body[0] === '-'){
      if(!cur || !listKey) continue;
      if(!Array.isArray(cur.fields[listKey])) cur.fields[listKey] = [];
      cur.fields[listKey].push(ymlVal(body.slice(1)));
      continue;
    }
    const m = body.match(/^("(?:[^"\\]|\\.)*")\s*:(.*)$/) || body.match(/^(.+?):(.*)$/);
    if(!m) continue;
    const k = ymlVal(m[1]), v = ymlVal(m[2]);
    if(ind === 0 && v === ''){
      if(seen.has(k)){ cur = null; continue; }
      seen.add(k); cur = { name:k, fields:{} }; listKey = '';
      secs.push(cur); continue;
    }
    if(!cur) continue;
    cur.fields[k] = v;
    listKey = (v === '') ? k : '';
  }
  return secs.map(sec => {
    const f = sec.fields;
    const list = Array.isArray(f.色号) ? f.色号 : (f.色号 ? [f.色号] : []);
    return { name:sec.name, mode:MODE_BACK[f.基调] || 'custom',
      std:STD_BACK[String(f.换算 || '').toUpperCase()] || 'gracol',
      colors:list.filter(Boolean).map(raw => ({ raw:String(raw), format:/^cmyk\(/i.test(String(raw)) ? 'cmyk' : 'auto' })) };
  });
}

/* ---------- 交给真身：分型 + 按默认可调项画一条出来，顺手跑那两条硬核查 ---------- */
function survey(t){
  const sp = gradRead(t);
  const kind = gradKindOf(sp);
  const draw = gradDraw(kind, t, sp, gradTune({}));
  const bad = [];
  if(kind !== 'none'){
    if(!draw.image || /NaN|undefined/.test(draw.image)) bad.push('画不出：' + draw.image.slice(0, 60));
    /* 停靠点只认这套色号：允许「页面底挪明度」和「两两相混」，但不许冒出库里一个都没有的色相族 */
    for(const c of draw.stops){
      const g = mingDark(c, sp.text);
      if(g && g !== sp.base) bad.push('渐变把明暗翻面了（' + c + ' 判成' + g + '，页面底判' + sp.base + '）');
    }
  }
  return { dH:sp.dH, dL:sp.dL, k:sp.k, g:kind + '（' + gradDef(kind).name + '）', bad, image:draw.image };
}

/* ---------- 跑一遍并打印 ---------- */
const file = process.argv[2] || 'data/palettes.yaml';
const entries = parsePalettes(read(file));
const rows = entries.map(e => {
  const t = tokensOf(e.mode === 'custom' ? e : { mode:e.mode }, 'a').tokens;
  return { name:e.name, n:(e.colors || []).length, ...survey(t) };
});
const by = {};
for(const r of rows) by[r.g] = (by[r.g] || 0) + 1;
console.log('清单：' + file + ' · 共 ' + rows.length + ' 套\n');
console.log('分型落点');
for(const [g, n] of Object.entries(by).sort((a, b) => b[1] - a[1]))
  console.log('  ' + String(n).padStart(3) + ' 套 · ' + g + ' ' + (rows.length ? '(' + (n / rows.length * 100).toFixed(0) + '%)' : ''));
console.log('\n逐套（ΔH 色相跨度 · ΔL 卡面与页底明度差 · 带彩度的锚几个）');
for(const r of rows)
  console.log('  ' + r.name.padEnd(26, ' ') + ' 色号 ' + String(r.n).padStart(2) +
    ' · 锚 ' + r.k + ' · ΔH ' + r.dH.toFixed(0).padStart(3) + '° · ΔL ' + r.dL.toFixed(1).padStart(5) + ' → ' + r.g);
/* 一条硬核查：同一格里如果塞了超过六成的套，这份规则就退化成「一套模板套所有配色」。
   库太少时这条不判 —— 内置只剩 2 套，怎么分都是 100%，报出来只会淹掉真结论。 */
const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
console.log('\n最大一格：' + top[0] + ' · ' + top[1] + ' 套（' + (top[1] / rows.length * 100).toFixed(0) + '%）');
if(rows.length < 10) console.log('（本库只有 ' + rows.length + ' 套，六成分布这条不判）');
else console.log(top[1] / rows.length <= .6 ? 'OK · 分型把库拉开了，没有塌成一格' : '注意 · 有格子吃掉六成以上，规则要再分细');
/* 两条硬核查的结论：任何一套有问题都要单独列出来，不许被绿字盖掉 */
const bad = rows.filter(r => r.bad.length);
console.log('\n停靠点复核（明暗翻面 / 画不出）：' + (bad.length ? '不通过 ' + bad.length + ' 套' : '全过 · ' + rows.length + ' 套'));
for(const r of bad) console.log('  ' + r.name + ' → ' + r.bad.join(' / '));
/* 每种落点打一条真画出来的值，看着像不像那一个形状 */
console.log('\n各档样例（按默认可调项画的值，就是根元素上 --wall-grad 那一条）');
const seen = new Set();
for(const r of rows){
  if(seen.has(r.g)) continue; seen.add(r.g);
  console.log('  [' + r.g + '] ' + r.name + '\n    ' + (r.image || '（这一档不画，背景按纯色铺）').slice(0, 220));
}
