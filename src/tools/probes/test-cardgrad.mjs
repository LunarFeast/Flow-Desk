/* 外29 第 28 轮自检 · 渐变铺在卡片展开之后那一张面
   ----------
   跑的是产物里那同一份真身（src/_shared/sh-look.js 的 grad / readable），不抄第二份算法。
   这里只复现 Theme.apply 那一段的三步：
     1) 背景那一趟：wall = Look.grad(tokens, cfg)
     2) 卡面：face = Look.readable() 推出来的 --face-solid（样式表里卡片实际铺的那一块）
     3) 卡片那一趟：把 tokens 里的页面底换成 face、形状照壁背景认下来的那一档递过去
   盯的三件事（他这条要求里唯一能量化的风险）：
     A 两块面形状一致（不然就是叠了一层对不上的渐变）
     B 卡片那一条每一个停靠点上正文都读得动（4.5:1），且不被明暗翻面
     C 卡片那一条是围着卡面挪的窄幅扫动，不是把背景那一整条搬进卡片 */
import fs from 'node:fs';
import vm from 'node:vm';
const ROOT = 'D:/Programs/Flow-Desk/';
const read = p => fs.readFileSync(ROOT + p, 'utf8');

const ctx = vm.createContext({ Math, JSON, String, Number, Object, Array, RegExp, isNaN, parseFloat, parseInt, console });
vm.runInContext(read('src/_shared/sh-color.js'), ctx, { filename: 'sh-color.js' });
vm.runInContext(read('src/_shared/sh-look.js'), ctx, { filename: 'sh-look.js' });
vm.runInContext('globalThis.__api = { CV, Look, mingDark, setPalScheme };', ctx);
const { CV, Look, mingDark, setPalScheme } = ctx.__api;
setPalScheme('a');

let pass = 0, fail = 0;
const ok = (n, c, extra) => { if(c){ pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (extra ? ' · ' + extra : '')); } };
const L = x => CV.hslOf(x)[2] * 100;

/* 一套配色摆出来只需要那几个色号（grad 只读这些，其余一律不参与） */
const PAL = {
  '明亮 · 深浅没结论（认成不给渐变）': { '--page-bg':'#f6f6f4', '--card-bg':'#fbfbfa', '--text':'#232323',
    '--accent':'#5c5c58', '--accent2':'#8a8a84' },
  '明亮 · 只往明暗走': { '--page-bg':'#f2f2ef', '--card-bg':'#ffffff', '--text':'#242422',
    '--accent':'#6a6a64', '--accent2':'#9a9a94' },
  '明亮 · 同族二档': { '--page-bg':'#f4f6f8', '--card-bg':'#ffffff', '--text':'#1f2731',
    '--accent':'#3b6cb5', '--accent2':'#4f7fc4' },
  '明亮 · 色相跨度大到径向': { '--page-bg':'#f6f5f2', '--card-bg':'#ffffff', '--text':'#22241f',
    '--accent':'#2f6cb5', '--accent2':'#c08a2a' },
  '明亮 · 四锚带彩度（弥散）': { '--page-bg':'#f5f4f1', '--card-bg':'#ffffff', '--text':'#22231f',
    '--accent':'#2f6cb5', '--accent2':'#c0492a', '--slot-0':'#3a9e6f', '--slot-1':'#8a5cc0', '--slot-2':'#c9a227' },
  '黑暗 · 强调牵引': { '--page-bg':'#161821', '--card-bg':'#222531', '--text':'#e6e8ee',
    '--accent':'#7aa7e8', '--accent2':'#5f86bd', '--wall-a':'#1b2030', '--wall-b':'#101219' },
  '黑暗 · 弥散': { '--page-bg':'#14151a', '--card-bg':'#1f222b', '--text':'#e8e8ea',
    '--accent':'#e0a24a', '--accent2':'#5ea88f', '--slot-0':'#d05f5f', '--slot-1':'#4f8fd6', '--slot-2':'#7bc47f', '--slot-3':'#c9c25a' },
  /* 色相互补的两个锚：dH 折到 180°，判定表第一条命中的就是弥散 */
  '明亮 · 互补双锚（认成弥散）': { '--page-bg':'#f5f4f0', '--card-bg':'#ffffff', '--text':'#222320',
    '--accent':'#cc3333', '--accent2':'#33cccc' },
  /* 连深浅都没结论：卡面和页面底同一个色、两个锚都是中性灰 → 自动档认成「不给渐变」 */
  '明亮 · 无结论（认成不给渐变）': { '--page-bg':'#f2f2f0', '--card-bg':'#f2f2f0', '--text':'#262626',
    '--accent':'#7c7c78', '--accent2':'#9a9a96' },
};

/* 界面能改口指定的那五档（「不给渐变」不在这一行里，那是背景那一档的事） */
const KINDS = ['luma', 'family', 'accent', 'radial', 'diffuse'];
const hexes = s => (String(s || '').match(/#[0-9a-f]{6}/gi) || []).map(x => x.toLowerCase());

const rows = [];
for(const [name, base] of Object.entries(PAL)){
  const cfg = { mode:'material', scheme:'a', wall:'gradient', grad:{} };
  const tokens = Object.assign({ '--slot-3':'#7a7a72', '--slot-4':'#6f6f68' }, base);
  const fix = Look.readable(tokens, cfg) || {};
  const t = Object.assign({}, tokens, fix);
  const face = t['--face-solid'] || t['--card-bg'];
  const wall = Look.grad(t, cfg);
  const ccfg = Object.assign({}, cfg, { grad:Object.assign({}, cfg.grad, { kind:wall.kind }) });
  const card = wall.kind === 'none' ? null : Look.grad(Object.assign({}, t, { '--page-bg':face }), ccfg);
  const text = t['--text'];
  const pts = card ? hexes(card.image) : [];
  const ct = pts.map(c => CV.contrast(text, c));
  const min = ct.length ? Math.min(...ct) : NaN;
  const drift = pts.length ? Math.max(...pts.map(c => Math.abs(L(c) - L(face)))) : 0;
  const flipped = pts.filter(c => mingDark(c, text) !== mingDark(face, text));
  rows.push({ name, auto:wall.autoName, kind:wall.kind, 卡片铺:card && card.image ? '铺' : '不铺',
    停靠点:pts.length, 最低对比:Number.isFinite(min) ? min.toFixed(2) : '-', 最大挪动:drift.toFixed(1), 翻面:flipped.length });
  ok(name + ' · 形状和背景一致（' + wall.kind + '）', !card || card.kind === wall.kind, card && card.kind);
  ok(name + ' · 卡片上每一个停靠点正文都读得动（最低 ' + (Number.isFinite(min) ? min.toFixed(2) : '-') + ':1）',
    !pts.length || min >= 4.5, min);
  ok(name + ' · 卡片那一条没把明暗结论翻面（翻面 ' + flipped.length + ' 个点）', flipped.length === 0, flipped.join(','));
  ok(name + ' · 卡片那一条是围着卡面挪的窄幅扫动（最大挪 ' + drift.toFixed(1) + ' 个明度点，顶 8）', drift <= 8, drift);
  /* 背景那一趟自己也得还是好的（这一轮动的是卡片，不许把背景碰坏） */
  const wpts = hexes(wall.image), wct = wpts.map(c => CV.contrast(text, c));
  ok(name + ' · 背景那一条照旧读得动（' + wpts.length + ' 个点 · 最低 ' +
    (wct.length ? Math.min(...wct).toFixed(2) : '-') + ':1）', !wpts.length || Math.min(...wct) >= 4.5);
}
/* ---------- 认成「不给渐变」那套：卡片这一头跟着不铺 ---------- */
{
  const base = PAL['明亮 · 无结论（认成不给渐变）'];
  const cfg = { mode:'material', scheme:'a', wall:'gradient', grad:{} };
  const tokens = Object.assign({ '--slot-3':'#7a7a72', '--slot-4':'#6f6f68' }, base);
  const t = Object.assign({}, tokens, Look.readable(tokens, cfg) || {});
  const wall = Look.grad(t, cfg);
  ok('1 这套配色自动认成「不给渐变」（认下来是 ' + wall.kind + '）', wall.kind === 'none' && !wall.image, wall.kind);
  ok('2 背景不铺时卡片那一串也画不出东西（image 空 → 落地钉 none、data-cgrad 落 off）',
    Look.grad(Object.assign({}, t, { '--page-bg':t['--face-solid'] }),
      Object.assign({}, cfg, { grad:{ kind:wall.kind } })).image === '');
}
/* ---------- 改口指定弥散：复杂那一档也得能铺到展开卡面上，且不越出那两条硬核查 ---------- */
{
  const worst = { ct:99, drift:0, flip:0, kinds:[] };
  for(const [name, base] of Object.entries(PAL)){
    const cfg = { mode:'material', scheme:'a', wall:'gradient', grad:{ kind:'diffuse', blobR:22, blobMix:20 } };
    const tokens = Object.assign({ '--slot-3':'#7a7a72', '--slot-4':'#6f6f68' }, base);
    const t = Object.assign({}, tokens, Look.readable(tokens, cfg) || {});
    const face = t['--face-solid'] || t['--card-bg'];
    const card = Look.grad(Object.assign({}, t, { '--page-bg':face }), cfg);
    const pts = hexes(card.image), ct = pts.map(c => CV.contrast(t['--text'], c));
    if(card.kind !== 'diffuse') continue;
    worst.kinds.push(name + '→' + pts.length + '个');
    if(ct.length) worst.ct = Math.min(worst.ct, Math.min(...ct));
    worst.drift = Math.max(worst.drift, ...pts.map(c => Math.abs(L(c) - L(face))));
    worst.flip += pts.filter(c => mingDark(c, t['--text']) !== mingDark(face, t['--text'])).length;
  }
  ok('3 指定弥散那几套都真画出了弥散（' + worst.kinds.length + ' 套）', worst.kinds.length >= 6, worst.kinds.join(' / '));
  ok('4 指定弥散时展开卡片上最吃紧那一点仍然读得动（最低 ' + worst.ct.toFixed(2) + ':1）', worst.ct >= 4.5, worst.ct);
  ok('5 弥散铺在卡面上最大只挪 ' + worst.drift.toFixed(1) + ' 个明度点（团色掺入顶格 20% 的那一套）', worst.drift <= 10, worst.drift);
  ok('6 弥散在卡面上没把明暗结论翻面（翻面 ' + worst.flip + ' 个点）', worst.flip === 0, worst.flip);
}
console.table(rows);

/* ---------- 接线四条：这三处漏一处，屏幕上就是「改了等于没改」 ---------- */
const shell = read('src/_fd/src/fd3-shell.js'), tpl = read('src/_fd/template.html'), css = read('src/_shared/sh-look.js');
ok('7 背景不铺渐变（纯色 / 图片 / 判成不给渐变）时，卡片那一串钉 none 且 data-cgrad 落 off',
  /wallKind === 'gradient' && face \? Look\.grad/.test(shell)
  && /setProperty\('--card-grad', cg && cg\.image \? cg\.image : 'none'\)/.test(shell)
  && /dataset\.cgrad = cg && cg\.image \? 'on' : 'off'/.test(shell));
ok('8 样式表只给展开的卡片挂这一条，选择器认的是 .fd-card.expanded',
  /html\[data-cgrad="on"\] \.fd-card\.expanded\{background-image:var\(--card-grad,none\);\}/.test(tpl));
ok('9 首页缩小那些卡片仍然只有一句实色卡面（没给 .fd-card 加过渐变）',
  !/\.fd-card:not\(\.expanded\)[^{]*background-image/.test(tpl + shell) && !/\.fd-card\{[^}]*background-image/.test(tpl));
ok('10 卡片面吃的是掺完墨那一块（--face-solid），不是没掺墨的原始卡面',
  /t\['--face-solid'\] \|\| t\['--card-bg'\]/.test(shell) && /out\['--face-solid'\] = face/.test(css));

console.log('\n' + pass + ' 过 ' + fail + ' 不过');
process.exit(fail ? 1 : 0);
