/* 外观层数值自检（开发用，不进产物）
   把 data\palettes.yaml 里每一套配色 × 四套识别方案（甲 / 乙 / 丙 / 丁）× 四档外观模式
   ×（不铺纹理 / 铺上一张平铺图）全部过一遍 _shared/sh-look.js 的 readable()。
   外13-A 起这一份按点名的五道硬指标拦（GATE 那一段）：
     正文对比 ≥4.5、次级文字对比 ≥4.5、强调色对比 ≥3.0、控件描边对比 ≥3:1、
     卡面与背景的明度差落在 4~28 之间；四条对比的参照底都是真实被画出来的那一块面
     （--face-solid，掺完墨复检完的那一块），不是配色表里那个没掺墨的 --card-bg。
   原有那份更细的下限表（FLOOR 那一摊：正文 4.6 / 铺纹理 5.5、次级 4.5 / 5.4、分段未选项 4.5、
   状态色 4.5、色位圆点 3.0、日程条上的字 4.5、按钮的字按按钮自己那块底 4.6（A-1）、
   主按钮反白字按强调色底 4.6（A-2）、菜单与下拉那两层底 4.6 / 4.6（A-3）、强调色当文字色 4.5（A-4）、
   状态色和色位反过来当底 4.5）连同结构检查、幂等检查继续跑，跟五道硬指标分开计数、分开打印，
   免得两个数混成一个看不出头。
   2026-10-04 撤掉「材质」那一档（拟液态玻璃 / 凝态 / 霜态 三档 + 真液态折射开关）和外观模式里的浮雕之后，
   这份自检跟着没对象的有四摊：玻璃的门槛一／二／三（浅底卡面不许比页面暗、深底卡面要比页面亮 1.15 倍、
   这块面得给正文留 6.0 余量、材质吃掉配色自己那份「卡面÷页面」的分别多少）、降级那一档
   （浏览器不认 backdrop-filter 时，透底推出来的字色在退化面上够不够线）、真液态那一段、
   材质表与强度表自身的死检查。卡片只有实色，底下铺不铺画面都不影响压在字底下那块面，
   「纯色底 / 透底」这一趟分叉也一起并成一条道。
   留下的还是两类数：色号（FLOOR + GATE 那两摊）+ 样式表拿到的那一份变量本身（四档模式各自该画什么、
   该留空什么：三档高度的影子、外框、分隔线粗细、标题光晕、纹理那一层的透明度）。
   跑完另外打一张「库内配色的明暗判定表」：判定用 sh-color.js 的 mingDark / mingDarkWhy
   （底色 vs 正文比相对亮度），不在这里写第二套亮度阈值；判不出结论的单列成待人工复核。
   2026-10-05 加「渐变 × 16×9 采样」那一摊（《配色原则与渐变规则.md》第三节三条口径）：
   识别方案 × 配色 ×（自动判出来的那一档 + 五档画法各一遍）按 1920×1080 名义画幅采 144 点，
   只硬拦第一条「任何一点把明暗结论翻面」；第二条（卡面与脚下那一点的明度差落在 4~28）和
   第三条（压在渐变上的字 ≥4.5）先印数不拦——文档给第二条的治法是「推那一张卡的卡面，
   不改整屏渐变」，那一步动的是卡片渲染、不在这一批点名的范围里，所以这里只按文档那条
   （混 7% 白 / 黑最多六次）模拟一遍，把「推完还剩几个点出界」也印出来，等拍板。
   跑法：node src/_fd/look-check.mjs
   最后一行给 PASS / FAIL；FAIL 时把出界的那几组名字印出来。 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* ---------- 把两份 _shared 脚本喂进一个没有 document 的上下文 ---------- */
const ctx = vm.createContext({ Math, JSON, String, Number, Object, Array, RegExp, isNaN, parseFloat, parseInt, console });
vm.runInContext(read('src/_shared/sh-color.js'), ctx, { filename: 'sh-color.js' });
/* 纹理图地址在这份自检里必然读不到真 icons，给一个永远答「有」的替身：
   readable() 只看这一句有没有返回值，用来决定要不要把文字下限抬到 5.5 / 5.4。
   图标那一层把图片库那一张表念作 images-<文件名>，替身就照这个形状回。 */
vm.runInContext('var Ico = { url: () => "images-stub.png" };', ctx);
vm.runInContext(read('src/_shared/sh-look.js'), ctx, { filename: 'sh-look.js' });
vm.runInContext('globalThis.__api = { CV, tokensOf, Look, LOOK_MODES, LOOK_TEX_GRAY, LOOK_DEFAULT, lookMode, lookTex, lookTexSet, mingDark, mingDarkWhy, MD_NAME, PAL_SCHEMES, palScheme, palSchemeDef, setPalScheme, paletteMingDark, paletteMingDarkWhy, gradRead, gradKindOf, gradDraw, gradTune, gradDef, GRAD_KINDS, gradColorAt, gradGrid };', ctx);
const { CV, tokensOf, Look, LOOK_MODES, LOOK_TEX_GRAY, LOOK_DEFAULT, lookMode, lookTex, lookTexSet,
  /* 外13-A：这份自检要按四套识别方案各跑一遍，并把明暗判定结果打出来。
     下面这几个都是配色引擎那一头的现成口子，自检只调用，不在这里另写一套阈值或规则 ——
     尤其是明暗判定，一律走 mingDark / mingDarkWhy（原口径：底色对正文比 WCAG 相对亮度）。
     渐变那一段（外13-R D3）同理：分型、画法、按点取色全部调 sh-look.js 的真身，
     这里只负责把 16×9 那一次采样摊成两条结论，不在自检里抄第二份规则。 */
  mingDark, mingDarkWhy, MD_NAME, PAL_SCHEMES, palScheme, palSchemeDef, setPalScheme, paletteMingDark, paletteMingDarkWhy,
  gradRead, gradKindOf, gradDraw, gradTune, gradDef, GRAD_KINDS, gradColorAt, gradGrid } = ctx.__api;
/* 卡面掺墨那一档只有一个来源（LOOK_INK），这里从 eff() 取，不在自检里抄第二份写死的数 */
const INK = Look.eff({}).ink;

/* ---------- palettes.yaml → 配色条目（照 fd3-lib.js 里 PalLib.entry 那一份字段对应） ----------
   2026-10-05 修一处读法：色号那一栏在库里是「一行一个、行首一个 - 」的列表写法，
   从前的正则要求行里带冒号，那种行整个匹配不上 → 每一套自定义配色都读成「一个色号也没有」，
   tokensOf({}) 只交回一组中性默认色，于是 456 组自检从头到尾量的其实是同一组数，
   自定义配色那一摊等于没查。现在照 LibYml.parse（运行时真正读这份库的那一个）同一套写法：
   列表行认行首的 - ，段名与字段名先试整对引号、再退回第一个冒号前算名字，重名段只认头一段。 */
const MODE_BACK = { '明亮': 'light', '黑暗': 'dark', '自定义色号': 'custom', '自定义': 'custom' };
const STD_BACK = { GRACOL: 'gracol', SWOP: 'swop', 'JAPAN COLOR': 'japan', JAPAN: 'japan' };
/* 值：外层成对引号去掉；没引号的把行尾说明切掉（和 LibYml.val 同一条） */
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
    return {
      name: sec.name,
      mode: MODE_BACK[f.基调] || 'custom',
      std: STD_BACK[String(f.换算 || '').toUpperCase()] || 'gracol',
      colors: list.filter(Boolean).map(raw => ({ raw: String(raw), format: /^cmyk\(/i.test(String(raw)) ? 'cmyk' : 'auto' })),
    };
  });
}
const entries = parsePalettes(read('data/palettes.yaml'));
/* 写着「自定义色号」却一个色号都没读回来的那些 = 库里那段没读对（不是配色本身的问题），
   单独报出来，别让它们混在配色名单里当"通过" */
const noColor = entries.filter(e => e.mode === 'custom' && !e.colors.length).map(e => e.name);

/* ---------- 逐项对下限 ---------- */
const FLOOR = { text: 4.6, textTex: 5.5, sub: 4.5, subTex: 5.4, seg: 4.5, status: 4.5, edge: 3.0, dot: 3.0, barText: 4.5,
  /* 按钮上的字按按钮自己那块底量（不是卡面）—— A-1；主按钮那个反白字按强调色底量 —— A-2 */
  btn: 4.6, sel: 4.6,
  /* 菜单 / 下拉那一层的底不是合成后的面，字得在它那两块底上也够 —— A-3 */
  menu: 4.6, slot: 4.6,
  /* 状态色 / 色位反过来当底用的那几处（删除按钮悬停、为写警告横条、练习记录暂停按钮、书封），
     字从前一律写死纯白 —— 第 4 条说的「没融入配色」。这两档量的是「字压在那一块纯色上」。 */
  onStatus: 4.5, onSlot: 4.5 };
const worst = { text: [99, ''], textLight: [99, ''], seg: [99, ''], status: [99, ''], edgeFace: [99, ''], edgeInput: [99, ''],
  edgeSlot: [99, ''], ringOnAccent: [99, ''], hair: [99, ''], btn: [99, ''], sel: [99, ''], menu: [99, ''], slot: [99, ''], accentText: [99, ''],
  dot: [99, ''], barText: [99, ''], onStatus: [99, ''], onSlot: [99, ''],
  faceVsInput: [99, ''], faceVsPage: [99, ''] };
const fails = [];
const note = (k, v, tag) => {
  if(!isFinite(v)) return;
  if(v < worst[k][0]) worst[k] = [+v.toFixed(3), tag];
  return v;
};
const hex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

/* ---------- 五道硬指标（外13-A 点名的那几条，按识别方案各拦一遍） ----------
   正文对比 ≥4.5、次级文字对比 ≥4.5、强调色 ≥3.0、控件描边 ≥3:1、
   卡面与背景的明度差落在 4~28 之间（后者是 interpCard 那条插值的目标区间，也是眼睛能
   把卡面和页面分开、又不至于两层像两张纸的下限）。
   这四条对比都拿「真实被画出来的那一块面」当参照底 —— 也就是外观层 readable() 掺完墨、
   复检完文字之后的 --face-solid，不是配色表里那个没掺墨的 --card-bg。 */
const GATE = [
  { k:'text',   lbl:'正文对比',    min:4.5, fg:'--text',       bg:'--face-solid' },
  { k:'sub',    lbl:'次级文字对比', min:4.5, fg:'--text-light', bg:'--face-solid' },
  { k:'accent', lbl:'强调色对比',   min:3.0, fg:'--accent',     bg:'--face-solid' },
  { k:'edge',   lbl:'描边对比',    min:3.0, fg:'--ctl-edge',   bg:'--face-solid' },
];
const CARD_L_GAP = [4, 28];
const cardLDelta = (card, bg) => Math.abs(CV.hslOf(card)[2] - CV.hslOf(bg)[2]) * 100;

/* ---------- 自检跑四套识别方案：甲 / 乙 / 丙 / 丁各一遍 ----------
   方案切换值本来住存档（appearance.json 的 look.scheme），这里直接走引擎的 setPalScheme()：
   sh-look.js 的 readable() 调 CV.cardInk(card, dk) 时没带方案参数，吃的是模块级当前那一档，
   所以每换一套方案必须先 setPalScheme()，否则卡面掺墨还是上一套的口径，数就是假的。
   跑完把当前档放回默认那一套（甲），免得这份自检的副作用影响同进程后面的读取。 */
const SCHEMES = PAL_SCHEMES.map(s => s.k);
const schemeName = k => palSchemeDef(k).name;
/* 每套方案各自：组合总数、不通过组合数、五道硬指标各自的名单（同一套配色在同一档指标上
   只留最难过的那一次，八档外观模式 / 纹理里挑最差值，免得名单被重复行塞满） */
const perScheme = {};
for(const k of SCHEMES) perScheme[k] = { sch:k, combos:0, failCombos:0, palSet:{}, items:{}, worst:{} };
/* 不通过名单按「配色 × 指标」归并：同一套配色在同一档指标上，八档外观模式 / 纹理里
   只留最难过的那一次（差得最多的那个实测值），名单不会被重复行塞满。
   bad = 离下限还差多少（越大越糟）；取不到色号按 99 记，一定排在最前。 */
function gFail(P, pal, gk, detail, tag, bad){
  const key = pal + ' | ' + gk;
  const lbl = (GATE.find(g => g.k === gk) || { lbl:'卡面与背景的明度差' }).lbl;
  const cur = P.items[key];
  if(!cur || bad > cur.bad) P.items[key] = { pal, gk, lbl, detail, tag, bad };
  if(!P.worst[gk] || bad > P.worst[gk].bad) P.worst[gk] = { pal, bad, detail, tag };
}

/* ---------- 模式表自己的死检查（跟配色无关，一处越界就是表写错了） ----------
   四档只动边框 / 影子 / 发光那三样，卡片底色一律不碰。bw 给 0 的那一档必须同时是「不画边框」，
   不然就是表写反了：质感靠影子分高低，外框收成 0 是这一档的定义，不是漏。 */
{
  const ks = LOOK_MODES.map(m => m.k);
  if(new Set(ks).size !== ks.length) fails.push('模式表有重复档位：' + ks.join('/'));
  /* 已经撤掉的档位不许再回表里：浮雕 emboss 是 2026-10-04 那一轮删的，
     材质那四档（实色 / 拟液态 / 凝态 / 霜态）根本不属于模式这一摊。 */
  for(const gone of ['emboss', 'solid', 'liquid', 'condense', 'frost'])
    if(ks.indexOf(gone) >= 0) fails.push('模式表里还留着已撤掉的档位：' + gone);
  for(const m of LOOK_MODES){
    const bad = msg => fails.push('模式表 ' + msg + '　' + m.name);
    if(['none', 'line', 'glow'].indexOf(m.border) < 0) bad('border 不是 none / line / glow：' + m.border);
    if(m.bw !== 0 && m.bw !== 1) bad('bw 不是 0 或 1：' + m.bw);
    if(['lift', 'glow', 'none'].indexOf(m.shadow) < 0) bad('shadow 不是 lift / glow / none：' + m.shadow);
    if((m.border === 'none') !== (m.bw === 0)) bad('bw ' + m.bw + ' 和 border ' + m.border + ' 对不上');
    if(!m.name || !m.tip) bad('缺中文名或界面那句说明');
  }
  /* 存档里写着已撤掉的档位时不许报错、也不许留空：认不出就落回默认那一档（质感）。
     这一条就是「不用迁移旧存档」的凭据 —— looks.yaml 和别的程序播过来的配置里那种 emboss 自己会归位。 */
  for(const gone of ['emboss', '', undefined, null, 'glass'])
    if(lookMode(gone).k !== LOOK_MODES[0].k) fails.push('已撤掉的档位 ' + String(gone) + ' 没落回默认那一档');
  if(LOOK_DEFAULT.mode !== LOOK_MODES[0].k) fails.push('默认档位和 LOOK_MODES[0] 不是同一个：' + LOOK_DEFAULT.mode);
  /* 强度那一档整串撤了（作者的话：删除纹理强度系列设置）：eff() 手里只剩「铺不铺、去不去色」两样 */
  const g0 = Look.eff({ mode:'material', tex:'img-a1', texGray:true });
  if(g0.ink !== INK) fails.push('卡面掺墨那一档不是只有 LOOK_INK 一个来源：' + g0.ink);
  if(g0.tex !== 'img-a1' || g0.texGray !== true) fails.push('eff() 没把铺哪张、去不去色交回原样：' + JSON.stringify(g0));
  if(Look.eff({ mode:'material' }).texGray !== false) fails.push('没说过色那一档不该当成去色');
  /* 纹理名单现在只有一条来路：图片库把「当纹理用的那几张」递进来（lookTexSet）。
     界面上的中国话和清单上的英文键都得认（从前就是拿中文名去拼，一直铺不上那张小图） */
  const 名册 = [{ k:'img-a1', name:'水磨石' }, { k:'img-b2', name:'宣纸纹' }];
  lookTexSet(名册);
  for(const it of 名册){
    if(!lookTex(it.k)) fails.push('图片库递进来的名单自己读不回来：' + it.k);
    if(Look.url(it.name) !== 'images-stub.png') fails.push('中国话名字换不成清单上的键：' + it.name);
    if(Look.url(it.k) !== 'images-stub.png') fails.push('英文键自己认不出自己：' + it.k);
  }
  if(Look.url('') !== '') fails.push('「不用纹理」也去拼了图地址');
  if(Look.url('没导过的名字') !== '') fails.push('名单上没有的那一个名字还拼得出地址');
}

/* ---------- 纹理那一层：只有「铺不铺」和「去色 / 直接使用」两档，别的一律不许跟着动 ---------- */
{
  const base = Look.vars({ mode:'material', tex:'' }, false);
  for(const 铺 of [{ tex:'', 灰:false, 名:'不铺' }, { tex:'img-a1', 灰:false, 名:'直接使用' }, { tex:'img-a1', 灰:true, 名:'去色' }]){
    const css = Look.vars({ mode:'material', tex:铺.tex, texGray:铺.灰 }, false);
    const bad = msg => fails.push('纹理表 ' + msg + '　' + 铺.名);
    if(!铺.tex){
      if(css['--tex-image'] !== 'none') bad('没挑图还在铺平铺图：' + css['--tex-image']);
      if(+css['--tex-opacity'] !== 0) bad('没挑图透明度不是 0：' + css['--tex-opacity']);
      if(css['--tex-filter'] !== 'none') bad('没挑图还带着滤镜：' + css['--tex-filter']);
    } else if(铺.灰){
      if(!/^url\("images-stub\.png"\)$/.test(String(css['--tex-image']))) bad('没铺上平铺图：' + css['--tex-image']);
      if(+css['--tex-opacity'] !== LOOK_TEX_GRAY) bad('去色那一档的透明度不是 LOOK_TEX_GRAY：' + css['--tex-opacity']);
      if(css['--tex-filter'] !== 'grayscale(1)') bad('去色那一档没洗成灰的：' + css['--tex-filter']);
    } else {
      if(!/^url\("images-stub\.png"\)$/.test(String(css['--tex-image']))) bad('没铺上平铺图：' + css['--tex-image']);
      if(+css['--tex-opacity'] !== 1) bad('直接使用那一档原图就该顶满，透明度应为 1：' + css['--tex-opacity']);
      if(css['--tex-filter'] !== 'none') bad('直接使用那一档不该动图的颜色：' + css['--tex-filter']);
    }
    /* 除了这三样，其余变量必须和「不铺纹理」那一趟一模一样 */
    for(const k of new Set([...Object.keys(base), ...Object.keys(css)]))
      if(k !== '--tex-image' && k !== '--tex-opacity' && k !== '--tex-filter' && String(base[k]) !== String(css[k]))
        bad('顺手改了不该改的变量 ' + k + '：' + css[k]);
  }
}

let combos = 0;
/* 同一套配色 × 四套识别方案 × 四档外观模式 ×（不铺纹理 / 铺一张平铺图）：
   方案换了，「哪个输入色当哪个角色」和卡面的来路就换了，往下派生与复检仍是同一份 */
for(const e of entries){
  const tks = {};
  for(const sch of SCHEMES) tks[sch] = (tokensOf(e, sch) || {}).tokens;
  const base0 = tks[SCHEMES[0]];
  if(!base0 || !hex(base0['--page-bg']) || !hex(base0['--card-bg'])) continue;
  for(const sch of SCHEMES)
  for(const mode of LOOK_MODES) for(const 铺纹理 of ['', 'img-a1']){
    const tk = tks[sch];
    if(!tk || !hex(tk['--page-bg'])) continue;
    /* readable() 里卡面掺墨那一档问的是模块级当前方案（CV.cardInk 没带方案参数），
       所以每换一套方案都得先把这一档落定，不然推出来的面还是上一套的口径 */
    setPalScheme(sch);
    /* 深浅这一档要和 readable() 内部那一次同口径：它拿的是「底色 vs 正文」那一对亮度
       （mingDark 判得出就用它，判不出才退回背景的绝对亮度），第二个参数漏传就会走错那一支 */
    const dk = Look.darkOf(tk['--page-bg'], tk['--text']);
    combos++;
    const P = perScheme[sch];
    const cfg = { mode: mode.k, tex: 铺纹理 };
    const fix = Look.readable(tk, cfg) || {};
    const m = Object.assign({}, tk, fix);
    const face = m['--face-solid'];
    const tag = e.name + ' · ' + schemeName(sch) + ' · ' + mode.name + (铺纹理 ? ' · 铺纹理' : '');
    const tex = !!铺纹理;
    const chk = (k, bg, min, bucket) => {
      if(!hex(m[k]) || !hex(bg)) return;
      const v = CV.contrast(m[k], bg);
      note(bucket, v, tag);
      if(v < min - 1e-9) fails.push(bucket + ' ' + m[k] + ' 压 ' + bg + ' = ' + v.toFixed(2) + ' < ' + min + '　' + tag);
    };
    /* ---------- 五道硬指标（点名的那几条，一套方案一份名单） ---------- */
    P.combos++;
    P.palSet[e.name] = (P.palSet[e.name] || 0) + 1;
    let comboBad = false;
    for(const g of GATE){
      const a = m[g.fg], b = m[g.bg];
      if(!hex(a) || !hex(b)){
        comboBad = true;
        gFail(P, e.name, g.k, g.lbl + '「取不到色号」：' + a + ' / ' + b, tag, 99);
        continue;
      }
      const v = CV.contrast(a, b);
      if(v < g.min - 1e-9){
        comboBad = true;
        gFail(P, e.name, g.k, g.lbl + ' 实测 ' + v.toFixed(2) + '（下限 ' + g.min + '，差 ' + (g.min - v).toFixed(2) + '）'
          + '　' + a + ' 压 ' + b, tag, g.min - v);
      }
    }
    {
      const d = cardLDelta(tk['--card-bg'], tk['--page-bg']);
      const bad = d < CARD_L_GAP[0] ? CARD_L_GAP[0] - d : (d > CARD_L_GAP[1] ? d - CARD_L_GAP[1] : 0);
      if(bad > 1e-9){
        comboBad = true;
        gFail(P, e.name, 'cardL', '卡面与背景的明度差 ' + d.toFixed(1) + ' 个点（要落在 ' + CARD_L_GAP[0] + '~' + CARD_L_GAP[1]
          + '，' + (d < CARD_L_GAP[0] ? '还差 ' + bad.toFixed(1) : '超了 ' + bad.toFixed(1)) + '）　卡面 '
          + tk['--card-bg'] + ' / 背景 ' + tk['--page-bg'], tag, bad);
      }
    }
    if(comboBad) P.failCombos++;
    if(!hex(face)) fails.push('--face-solid 不是色号：' + face + '　' + tag);
    /* 掺墨方向按深浅分：浅底收暗、深底提亮，挑错整套数就反了 ——
       从前「深浅挑错行（材质表的两行）」那一条的位置由这一条接上。
       2026-10-05 起甲 那一档的墨色不再拿纯黑 / 纯白，是 --card-bg 同色相 ±25% L
       （见 sh-look.js 顶上那条例外），乙 / 丙 / 丁 退回纯黑 / 纯白；
       这一条按点名的口径独立复算一遍（不调 CV.cardInk，那是被测的那一个），
       否则四套方案 × 全组都会报"方向不对"。 */
    if(hex(face)){
      let wantInk = dk ? '#ffffff' : '#000000';
      if(sch === 'a'){
        try{
          const [h, s, l] = CV.hslOf(tk['--card-bg']);
          wantInk = CV.rgbHex(CV.hslRgb([h, s, dk ? Math.min(1, l + .25) : Math.max(0, l - .25)]));
        }catch(err){ /* 复算不了就停在上头那句纯黑 / 纯白 */ }
      }
      const wantFace = CV.mix(tk['--card-bg'], wantInk, INK / 100);
      if(wantFace.toLowerCase() !== face.toLowerCase())
        fails.push('卡面掺墨方向或幅度不对（' + schemeName(sch) + ' 这一套 ' + (dk ? '深' : '浅') + '底，墨色应为 ' + wantInk + '、卡面应为 ' + wantFace + '）：' + face + '　' + tag);
      if(m['--card-ink-mix'] && m['--card-ink-mix'].toLowerCase() !== wantInk.toLowerCase())
        fails.push('--card-ink-mix 没吃这一套方案该吃的那一档：' + m['--card-ink-mix'] + ' ≠ ' + wantInk + '　' + tag);
    }
    chk('--text', face, tex ? FLOOR.textTex : FLOOR.text, 'text');
    chk('--text-light', face, tex ? FLOOR.subTex : FLOOR.sub, 'textLight');
    chk('--seg-text', tk['--candidate-bg'], tex ? FLOOR.subTex : FLOOR.seg, 'seg');
    chk('--seg-text', face, tex ? FLOOR.subTex : FLOOR.seg, 'seg');
    for(const k of ['--ok', '--bad', '--warn']) chk(k, face, FLOOR.status, 'status');
    /* 这三色当底用的那几处：字压在自己那一块纯色上，按 4.5 量（第 4 条「纯白不融入配色」） */
    for(const k of ['--ok', '--bad', '--warn'])
      chk(k + '-text', m[k], FLOOR.onStatus, 'onStatus');
    chk('--ctl-edge', face, FLOOR.edge, 'edgeFace');
    chk('--ctl-edge', tk['--input-bg'], FLOOR.edge, 'edgeInput');
    /* 分隔线那一条 2026-10-04 也归到同一个下限：它由 readable() 现算，参照底只有这一块面。 */
    chk('--hair-color', face, FLOOR.edge, 'hair');
    /* 焦点框那条细边不止要压得住卡面和输入框底，分段槽（往里画那 2px）也是它真实相邻的面
       —— 出处：无障碍走查 C-4。强调色底那一类不放进 edge() 的参照名单（一块线做不到同时离
       深卡面和亮强调色都 3:1），坐在强调色底上的那几个改用反白字当焦点框颜色，量那一条。 */
    chk('--ctl-edge', tk['--candidate-bg'], FLOOR.edge, 'edgeSlot');
    chk('--sel-text', tk['--accent'], FLOOR.edge, 'ringOnAccent');
    /* 按钮的字按按钮那块底量（readable() 已把 --btn-bg 改成跟着合成后的面走，同一块底）。
       那块底是一个不透明色号，纹理铺在控件底下压不到字，所以这一档不跟纹理抬 —— A-1 */
    chk('--text', m['--btn-bg'], FLOOR.btn, 'btn');
    /* 主按钮 = 强调色底 + 反白字，这块底不随外观模式变，按配色自己那一档量 —— A-2 */
    chk('--sel-text', tk['--sel-bg'], FLOOR.sel, 'sel');
    /* 菜单 / 下拉弹层、下拉触发器那两处底不是合成后的面（各是 --card-bg 和 --candidate-bg），
       坐在上面的正文也得够线 —— A-3。未选项的字早就按槽底量过（上面 'seg' 那两条），不重复量。 */
    chk('--text', tk['--card-bg'], FLOOR.text, 'menu');
    chk('--text', tk['--candidate-bg'], FLOOR.slot, 'slot');
    /* 强调色当文字用的那几处走 --accent-text：浅强调底那一层是不透明的（纹理压不到字底下），
       卡面那一层会铺纹理，所以下限跟分段未选项一路走。 —— A-4 */
    chk('--accent-text', face, tex ? FLOOR.subTex : FLOOR.sub, 'accentText');
    chk('--accent-text', tk['--accent-light'], FLOOR.sub, 'accentText');
    for(let i = 1; i <= 5; i++){
      chk('--slot-' + i + '-dot', face, FLOOR.dot, 'dot');
      chk('--slot-' + i + '-bar-text', m['--slot-' + i + '-bar'], FLOOR.barText, 'barText');
      /* 书封吃的是这一块纯色（外观层为「封面上那两个字」推过深浅的那一块），字按同一块底量 */
      chk('--slot-' + i + '-cover-ink', m['--slot-' + i + '-cover'], FLOOR.onSlot, 'onSlot');
    }
    if(hex(m['--input-bg'])) note('faceVsInput', CV.contrast(face, m['--input-bg']), tag);
    /* 卡面和页面的「对比度」分别只印数不拦：那是配色自己给的（再加上掺墨那 20%），
       纯平 / 无界这两档本来就允许卡片和页面同色，分别交给空处。
       点名的第五条硬指标拦的是另一件事 —— 两个色号的 HSL 明度点差要落在 4~28（上面 GATE 那一段），
       那是 interpCard 那条插值的目标区间，跟这里的对比度不是同一个量。 */
    if(hex(face)) note('faceVsPage', CV.contrast(face, tk['--page-bg']), tag);
    /* 同一套色号跑第二遍必须一个数都不改：宿主自己调过 readable、apply 里再兜一遍就是这条路 */
    const again = Look.readable(m, cfg) || {};
    for(const k of ['--text', '--text-light', '--face-solid', '--ctl-edge'])
      if(hex(again[k]) && hex(m[k]) && again[k].toLowerCase() !== m[k].toLowerCase())
        fails.push('第二遍又推了一次（不是幂等）：' + k + ' ' + m[k] + ' → ' + again[k] + '　' + tag);
    /* ---------- 上面这一趟只管色号，下面这几条管「样式表拿到的那一份变量本身」 ----------
       玻璃三件套（外投影 + 边缘亮环 + 卡面比页面亮或暗）跟着材质撤了：卡片实色，
       剩下只有「这一档模式该不该画影子」这一个问题。模糊 / 饱和 / 折射那几条同理没有对象。 */
    const css = Look.vars(cfg, dk);
    const NIL = '0 0 0 0 transparent';
    /* --card-ink-mix 不在 vars() 的名单里：它由 readable() 按 --card-bg 同色相推一档明度算出来，
       vars() 拿不到 card-bg，硬写会顶掉 readable() 那一份（见 sh-look.js vars 里那一段说明）。
       上面那一段已经查过 readable() 的 --card-ink-mix 与 wantInk 一致，这里不再重复。 */
    for(const k of ['--card-ink', '--card-face', '--bw', '--card-border', '--hair-w', '--hair-color', '--hair',
      '--sh-ctl', '--sh-card', '--sh-float', '--look-glow', '--tex-image', '--tex-opacity'])
      if(String(css[k] === undefined ? '' : css[k]).trim() === '')
        fails.push('变量 ' + k + ' 是空的（拼进逗号列表会让整条 box-shadow 作废）　' + tag);
    /* 三档高度的影子：画影子那两档必须真画；「什么都不画」那一档三条都得是零尺寸透明占位。
       不能写 none —— 样式表里 box-shadow 是逗号列表，列表里出现一个 none 会让整条作废。 */
    const hasShadow = mode.shadow !== 'none';
    for(const k of ['--sh-ctl', '--sh-card', '--sh-float']){
      const v = String(css[k]);
      if(!hasShadow){
        if(v !== NIL) fails.push('这一档不画影子，可 ' + k + ' 不是零尺寸占位：' + v + '　' + tag);
        continue;
      }
      if(v === NIL) fails.push('这一档该画影子却画了一条空的：' + k + '　' + tag);
      if(v.indexOf('none') >= 0) fails.push('影子逗号列表里塞了 none（整条会作废）：' + k + '　' + tag);
      if(v.indexOf('-calc(') >= 0) fails.push('负偏移写成 -calc(… )，CSS 认不下：' + k + '　' + tag);
      if(!/rgba|color-mix/.test(v)) fails.push('影子里没有颜色：' + k + ' ' + v + '　' + tag);
      if(v.indexOf('var(--ck') < 0) fails.push('影子没乘 --ck（小卡会顶着为大卡算的那一层大晕）：' + k + '　' + tag);
      const px = [].concat(v.match(/[\d.]+px/g) || []).map(x => +x.slice(0, -2));
      if(px.some(x => x > 24)) fails.push('影子的偏移或模糊超过 24px：' + k + ' ' + v + '　' + tag);
      if(mode.k === 'glow' && px.some(x => x > 20))
        fails.push('辉光的模糊超过 20px（静态光晕的上限）：' + k + ' ' + v + '　' + tag);
    }
    /* 外框：--bw 和 --card-border 跟着模式走；分隔线那一条永远 1px、四档一个样
       （线色由 readable() 现算，参照底只有这一块面）。 */
    if(css['--bw'] !== mode.bw + 'px') fails.push('--bw 不是这一档的数：' + css['--bw'] + '　' + tag);
    if(css['--hair-w'] !== '1px') fails.push('分隔线粗细跟着外框一起塌了：' + css['--hair-w'] + '　' + tag);
    if(mode.border === 'none' && css['--card-border'] !== 'transparent')
      fails.push('这一档不画外框，可 --card-border 有色：' + css['--card-border'] + '　' + tag);
    if(mode.border === 'line' && !/var\(--text\)/.test(String(css['--card-border'])))
      fails.push('描边那一档的外框不吃文字色：' + css['--card-border'] + '　' + tag);
    if(mode.border === 'glow' && !/var\(--accent\)/.test(String(css['--card-border'])))
      fails.push('辉光的外框不吃强调色：' + css['--card-border'] + '　' + tag);
    /* 标题光晕只在辉光 + 深底那一路画（浅底上它会把字糊成一团） */
    const wantGlow = mode.k === 'glow' && dk;
    if((String(css['--look-glow']) !== 'none') !== wantGlow)
      fails.push('标题光晕画错对象（该' + (wantGlow ? '画' : '不画') + '）：' + css['--look-glow'] + '　' + tag);
    /* 卡面掺墨那两个数只有一处来源；深浅方向由 readable() 按 --card-bg 同色相那一档算，
       上面那一段（wantInk / --card-ink-mix 一致）已经钉过方向，这里只查 vars() 的 --card-ink 幅度。 */
    if(String(css['--card-ink']) !== INK + '%') fails.push('--card-ink 不是 LOOK_INK：' + css['--card-ink'] + '　' + tag);
    if(!/var\(--card-ink[,)]/.test(String(css['--card-face'])))
      fails.push('--card-face 没吃掺墨那两个数：' + css['--card-face'] + '　' + tag);
    /* 样式表里不许再出现玻璃那三样的变量名（材质撤了就没人再读它们，留着就是死码） */
    for(const k of ['--card-blur', '--card-ring', '--card-drop', '--card-alpha', '--card-alpha-plain'])
      if(k in css) fails.push('变量表里还留着已撤掉的 ' + k + '　' + tag);
  }
}

/* ---------- 渐变那五档要重对的两条口径（外13-R D3 · 文档《配色原则与渐变规则.md》第三节）----------
   两条共用同一串数：把画出来的那条渐变按 16×9 网格采一遍样。画法、分型、按点取色全部调
   _shared/sh-look.js 的真身（gradRead / gradKindOf / gradDraw / gradTune / gradGrid），
   这份自检里不抄第二套规则 —— 抄一份就得两头维护，早先 grad-survey 那份私货就是这么去掉的。
   窗口取 1920×1080 那一档名义画幅：径向和弥散的半径按 vw 走，画幅变了数也会变，
   这里钉一个固定值，为的是同一份配色每次跑出自检来是同一个数。
     第一条（硬拦）明暗不许翻面：每一个采样点当成「字底下那块底」和正文比 WCAG 相对亮度，
       任何一点把整套配色的明暗结论翻到另一头 → 这组渐变不通过，进 fails。
     第二条（先量后推）卡面与脚下那一点的明度差落在 4~28：每一个采样点当成「卡片正下方那一点」，
       拿 --card-bg 和它比明度点差 —— 尺子和上面五道硬指标里那一条是同一把，只把「页面底」换成那一点。
       文档给的处置是推那一张卡的卡面（复用引擎现成那一步：混 7% 白、最多六次），不改整屏渐变，
       所以这里报「有多少个点需要被推」和「推满六次还剩几个」，不直接把整组判死。 */
const GRID_W = 1920, GRID_H = 1080;
const gradRows = [];
for(const sch of SCHEMES){
  setPalScheme(sch);
  for(const e of entries){
    const t = tokensOf(e.mode === 'custom' ? e : { mode:e.mode }, sch).tokens;
    const sp = gradRead(t);
    if(!sp.page || !sp.card) continue;
    const kinds = [...new Set([gradKindOf(sp), ...GRAD_KINDS.filter(x => x.k !== 'none').map(x => x.k)])];
    for(const k of kinds){
      const d = gradDraw(k, t, sp, gradTune({}));
      if(!d.geom) continue;
      const cs = gradGrid(d.geom, GRID_W, GRID_H);
      let flip = 0, out = 0, outLow = 0, outHigh = 0, still = 0;
      for(const c of cs){
        const g = sp.text ? mingDark(c, sp.text) : '';
        if(g && g !== sp.base) flip++;
        const dl = cardLDelta(sp.card, c);
        let ok = dl >= CARD_L_GAP[0] && dl <= CARD_L_GAP[1];
        if(!ok){
          out++;
          if(dl < CARD_L_GAP[0]) outLow++; else outHigh++;
          /* 文档那条处置：推这张卡的卡面，混 7% 白、最多六次。方向跟着「差的是哪一头」走 ——
             差得太小就往离开脚下的那一点推，超了 28 就往贴近脚下的那一点推。
             「离开 / 贴近」落到混白还是混黑，看卡面本来在脚下那一点的上面还是下面。 */
          let face = sp.card;
          const spread = dl < CARD_L_GAP[0];
          for(let i = 0; i < 6 && !ok; i++){
            const above = CV.hslOf(face)[2] >= CV.hslOf(c)[2];
            const wantWhite = spread ? above : !above;
            face = CV.mix(face, wantWhite ? '#ffffff' : '#000000', .07);
            const n = cardLDelta(face, c);
            ok = n >= CARD_L_GAP[0] && n <= CARD_L_GAP[1];
          }
          if(!ok) still++;
        }
      }
      gradRows.push({ sch, pal:e.name, k, n:cs.length, flip, out, outLow, outHigh, still });
      if(flip) fails.push('渐变把明暗翻面了：' + schemeName(sch) + ' × ' + e.name + ' × ' + gradDef(k).name
        + '　16×9 里 ' + flip + '/' + cs.length + ' 个采样点翻到另一头');
    }
  }
}
setPalScheme(SCHEMES[0]);
console.log('');
console.log('【渐变 × 16×9 采样】窗口按 ' + GRID_W + '×' + GRID_H + ' 名义画幅，识别方案 × 配色 × 五档画法各采 144 点');
console.log('　明暗翻面：' + (gradRows.reduce((a, r) => a + r.flip, 0)) + ' 点（硬拦，任何一点翻面这组渐变就不通过）');
const byKind = {};
for(const r of gradRows) (byKind[r.k] = byKind[r.k] || []).push(r);
for(const k of GRAD_KINDS.map(x => x.k).filter(x => x !== 'none')){
  const rs = byKind[k] || [];
  if(!rs.length) continue;
  const pts = rs.reduce((a, r) => a + r.n, 0);
  const out = rs.reduce((a, r) => a + r.out, 0);
  console.log('　' + gradDef(k).name + '　共 ' + rs.length + ' 组：明度差出 ' + CARD_L_GAP[0] + '~' + CARD_L_GAP[1] +
    ' 的采样点 ' + out + '/' + pts + '（低于下限 ' + rs.reduce((a, r) => a + r.outLow, 0) +
    '、高于上限 ' + rs.reduce((a, r) => a + r.outHigh, 0) + '）；按文档推卡面混 7% 白最多六次之后还剩 '
    + rs.reduce((a, r) => a + r.still, 0) + ' 个');
  const worst = rs.filter(r => r.out).sort((a, b) => b.out - a.out)[0];
  if(worst) console.log('　　　最多的一组：' + schemeName(worst.sch) + ' × ' + worst.pal + ' × ' + gradDef(worst.k).name
    + '　' + worst.out + '/' + worst.n + ' 点，其中 ' + worst.outLow + ' 点差得太小（卡片和脚下分不开）');
}

/* ---------- 跑完把当前识别方案放回默认那一档（甲）----------
   这份自检和界面共用同一份模块级变量（readable() 问的就是它），
   把最后一趟的档留在原地，同进程后面再读一次就是脏数。 */
setPalScheme(SCHEMES[0]);

const shadowModes = LOOK_MODES.filter(m => m.shadow !== 'none').map(m => m.name).join(' / ');
const flatModes = LOOK_MODES.filter(m => m.shadow === 'none').map(m => m.name).join(' / ');
const nominal = SCHEMES.length * LOOK_MODES.length * 2 * entries.length;
console.log('识别方案 ' + SCHEMES.length + ' 套 × 外观模式 ' + LOOK_MODES.length + ' 档 ×（不铺纹理 / 铺一张平铺图）× 配色 '
  + entries.length + ' 套 = ' + nominal + ' 组，实际跑过 ' + combos + ' 组（底色或卡面认不出色号的套数不入库）');
console.log('卡片只有实色这一档（2026-10-04 撤掉材质那四档和真液态折射开关）：底下铺不铺画面都是同一块面，不再量玻璃那三摊门槛');
console.log('画影子的外观模式：' + shadowModes + '　不画的：' + flatModes + '　卡面掺墨 ' + INK + '%（甲 用卡面同色相推一档，乙 / 丙 / 丁 用纯黑 / 纯白）');
console.log('五道硬指标：' + GATE.map(g => g.lbl + ' ≥' + g.min).join('、')
  + '、卡面与背景的明度差落在 ' + CARD_L_GAP[0] + '~' + CARD_L_GAP[1] + ' 之间（四条对比的参照底都是真实压在字底下那块面 --face-solid）');

/* ---------- 每套方案各自的不通过名单 + 通过/不通过总数 ---------- */
let gateCombos = 0, gateBadCombos = 0;
for(const sch of SCHEMES){
  const P = perScheme[sch], d = palSchemeDef(sch);
  const items = Object.keys(P.items).map(k => P.items[k]).sort((a, b) => b.bad - a.bad);
  gateCombos += P.combos; gateBadCombos += P.failCombos;
  console.log('');
  console.log('【' + d.name + '】卡面来路：' + d.back + '　→　' + P.combos + ' 组，五道硬指标不通过 ' + P.failCombos
    + ' 组，通过 ' + (P.combos - P.failCombos) + ' 组，名单 ' + items.length + ' 条（同一套配色 × 同一档指标只留最差那一档，八档模式/纹理里挑）');
  if(!items.length) console.log('　这一套：五道硬指标全过');
  for(const it of items) console.log('　不通过　' + it.lbl + '：' + it.detail + '　（出现在 ' + it.tag + '）');
}
console.log('');
console.log('五道硬指标总数：' + gateCombos + ' 组中通过 ' + (gateCombos - gateBadCombos) + ' 组、不通过 ' + gateBadCombos + ' 组');
for(const sch of SCHEMES){
  const P = perScheme[sch];
  const parts = GATE.concat([{ k:'cardL', lbl:'明度差' }]).map(g => {
    const w = P.worst[g.k];
    return g.lbl + '：' + (w ? w.pal + '（离线 ' + w.bad.toFixed(2) + '）' : '全过');
  });
  console.log('　最差一档　' + schemeName(sch) + '　' + parts.join('　|　'));
}

/* ---------- 汇总：行是四套方案，列是那五道硬指标 ----------
   格子里是不通过的配色套数（同一套配色在这一档指标上八档模式/纹理只算一套），
   并附这一格最差一例（配色名 + 实测值 + 门槛值，取 gFail 里离线最大的那条）。
   后面跟每套方案的不通过配色名单（一行一套，括号里写它栽在哪几道指标上）与通过套数。 */
{
  const cols = GATE.concat([{ k:'cardL', lbl:'卡面与背景明度差 4~28' }]);
  console.log('');
  console.log('【方案 × 指标汇总】格子 = 不通过配色套数 / 该方案实测配色套数（括号 = 该格最差一例）');
  for(const sch of SCHEMES){
    const P = perScheme[sch];
    const palsAll = Object.keys(P.palSet);
    const items = Object.values(P.items);
    const palGates = {};
    for(const it of items) (palGates[it.pal] = palGates[it.pal] || []).push(it);
    console.log('■ ' + schemeName(sch));
    for(const g of cols){
      const set = {};
      for(const it of items) if(it.gk === g.k) set[it.pal] = it;
      const w = P.worst[g.k];
      console.log('　' + g.lbl + '　不通过 ' + Object.keys(set).length + '/' + palsAll.length
        + (w ? '（最差：' + w.pal + '，' + w.detail.replace(/　.*$/, '') + '）' : ''));
    }
    const bad = Object.keys(palGates).sort();
    console.log('　通过配色 ' + (palsAll.length - bad.length) + '/' + palsAll.length + '，不通过 ' + bad.length + ' 套：');
    for(const n of bad) console.log('　　' + n + '（' + palGates[n].map(i => i.lbl).join('、') + '）');
  }
}

/* ---------- 库内配色的明暗判定表（外13-A 第二摊）----------
   判定一律走 sh-color.js 的 mingDark / mingDarkWhy：底色对正文比 WCAG 相对亮度，
   字亮 = 黑暗、字暗 = 明亮，两个数挨得太近就回空串不硬判 —— 这里不写第二套亮度阈值。
   data\palettes.yaml 的「明暗」那一栏写的是 甲 那一档的现算结果（跟 fd3-lib.js 那条例定一致：
   判定跟着默认那一套识别方案走，不认当前切到哪一套）。判不准的那些不塞进明亮或黑暗，
   库里写「判不准」，下面单列一张待人工复核的名单。 */
const mdLabel = k => (k === 'dark' || k === 'light') ? MD_NAME[k] : '判不准';
console.log('');
console.log('【' + entries.length + ' 套配色的明暗判定表】每套一行：左边四格是四套识别方案各判一次，最后一句为什么（按甲那一档，也就是写进库里的那一份依据）');
const mdUnknown = [];
const mdDiff = [];
for(const e of entries){
  const cells = SCHEMES.map(s => mdLabel(paletteMingDark(e, s)));
  const w = paletteMingDarkWhy(e, 'a');
  if(!w.k) mdUnknown.push(e.name);
  if(new Set(cells).size > 1) mdDiff.push(e.name + '（甲=' + cells[0] + ' 乙=' + cells[1] + ' 丙=' + cells[2] + ' 丁=' + cells[3] + '）');
  console.log('　' + e.name + '　|　' + cells.join(' / ') + '　|　' + w.why);
}
console.log('　判不准（两头都勉强，需人工复核，库里那一栏写「判不准」）：' + (mdUnknown.length ? mdUnknown.join(' / ') : '无'));
console.log('　四套方案判定互相不一致的配色 ' + mdDiff.length + ' 套：' + (mdDiff.length ? '\n　　' + mdDiff.join('\n　　') : '无'));
console.log('　汇总：黑暗 ' + entries.filter(e => paletteMingDark(e, 'a') === 'dark').length
  + ' 套、明亮 ' + entries.filter(e => paletteMingDark(e, 'a') === 'light').length
  + ' 套、判不准 ' + mdUnknown.length + ' 套');

for(const k of Object.keys(worst)) console.log('最差 ' + k.padEnd(15) + ' = ' + (Math.abs(worst[k][0]) === 99 ? 'n/a' : worst[k][0]) + '　' + worst[k][1]);
/* 其余细目（原有那份更严的下限：正文 4.6 / 铺纹理 5.5、次级 4.5 / 5.4、按钮 4.6 …）、
   掺墨方向、结构检查、幂等，都攒在 fails 里，跟五道硬指标分开计数，免得两边混成一个数看不出头 */
console.log('其余细目与结构检查（不在上面那五条里）：' + fails.length + ' 条');
if(fails.length) console.log(fails.slice(0, 60).join('\n') + (fails.length > 60 ? '\n…（其余 ' + (fails.length - 60) + ' 条同类）' : ''));
const bad = gateBadCombos || fails.length;
console.log(bad ? 'FAIL　五道硬指标不通过 ' + gateBadCombos + ' 组　其余细目越界 ' + fails.length + ' 条'
  : 'PASS　四套识别方案 × 四档外观模式 × 纹理两档 × 全部配色：五道硬指标都在线上，其余细目与第二遍幂等也都没越界');
process.exitCode = bad ? 1 : 0;
