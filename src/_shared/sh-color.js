/* ============================================================
   配色引擎（中立模块）· FD 和 WNW 共用这一份
   1) 色值换算 cv_*：移植自 RP 1.0 那一份 analyzeScheme（同一口径），FD 与打字练习共用这一份
   2) 输入解析：RGB（#hex / rgb() / 逗号三值 / Weasel 的 0x[AA]BBGGRR）与 CMYK（cmyk() / 百分比四值），CMYK→RGB 三标准可切换并标注来源
   3) 自动定角色：用户只给 1~5 个色号，后台推出 底色/卡面/正文/主强调/次强调，再派生整套 token
   4) 明暗判定（口径固定）：识别出来的底色对正文比 WCAG 相对亮度，字亮 = 黑暗系、字暗 = 明亮系，
      不拿「背景的绝对亮度配阈值」猜；两头都勉强就不下结论（见文件中段那一段）
   5) 识别方案四套可切换（甲 / 乙 / 丙 / 丁）：切换值住存档 look.scheme，开机读回来，默认 甲
      —— 每一套只管「哪个输入色当哪个角色」和卡面的来路，往下派生和复检仍共用这一份
   ============================================================ */
const CV = {
  clamp255(v){ return Math.max(0, Math.min(255, Math.round(v))); },
  hexRgb(hex){ const h = hex.replace('#', ''); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]; },
  rgbHex(rgb){ const f = n => CV.clamp255(n).toString(16).padStart(2,'0'); return '#' + f(rgb[0]) + f(rgb[1]) + f(rgb[2]); },
  rgbHsl(rgb){
    const r = rgb[0]/255, g = rgb[1]/255, b = rgb[2]/255;
    const mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx - mn;
    let h = 0;
    if(d){ h = mx===r ? ((g-b)/d + (g<b?6:0)) : mx===g ? (b-r)/d + 2 : (r-g)/d + 4; h /= 6; }
    const l = (mx + mn)/2;
    const s = d ? (l > .5 ? d/(2-mx-mn) : d/(mx+mn)) : 0;
    return [h, s, l];
  },
  hslRgb(hsl){
    const [h, s, l] = hsl;
    if(!s) { const v = Math.round(l*255); return [v,v,v]; }
    const q = l < .5 ? l*(1+s) : l+s-l*s, p = 2*l - q;
    const f = t => { t = (t%1+1)%1;
      if(t < 1/6) return p + (q-p)*6*t;
      if(t < 1/2) return q;
      if(t < 2/3) return p + (q-p)*(2/3-t)*6;
      return p; };
    return [Math.round(f(h+1/3)*255), Math.round(f(h)*255), Math.round(f(h-1/3)*255)];
  },
  mix(a, b, t){ const A = CV.hexRgb(a), B = CV.hexRgb(b); return CV.rgbHex(A.map((x,i)=>x + (B[i]-x)*t)); },
  adjust(hex, dl, ds){ const h = CV.rgbHsl(CV.hexRgb(hex)); h[1] = Math.max(0,Math.min(1,h[1]*ds)); h[2] = Math.max(0,Math.min(1,h[2]+dl)); return CV.rgbHex(CV.hslRgb(h)); },
  lum(hex){ const [r,g,b] = CV.hexRgb(hex).map(v=>{ v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }); return 0.2126*r + 0.7152*g + 0.0722*b; },
  contrast(a, b){ const l1 = CV.lum(a), l2 = CV.lum(b); return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); },
  /* 把前景朝亮/暗两个方向推，直到与背景对比度达标；推不动就换成纯黑或纯白 */
  /* 把前景朝对比更高的那个极端推，直到与背景对比度达标；推不动就取三种里最优的 */
  ensure(fg, bg, target){
    if(CV.contrast(fg,bg) >= target) return fg;
    const cands = [fg, '#ffffff', '#1a1a1a'];
    const towardWhite = CV.contrast('#ffffff',bg) >= CV.contrast('#1a1a1a',bg);
    let cur = fg, bestC = CV.contrast(cur,bg);
    for(let i=0;i<24;i++){
      cur = CV.adjust(cur, towardWhite ? 0.035 : -0.035, 1);
      const c = CV.contrast(cur,bg);
      if(c > bestC){ bestC = c; cands.push(cur); }
      if(c >= target) return cur;
    }
    return cands.sort((a,b) => CV.contrast(b,bg) - CV.contrast(a,bg))[0];
  },
  hslOf(hex){ return CV.rgbHsl(CV.hexRgb(hex)); }
};

/* ============================================================
   明暗判定（外13-A）· 口径固定，不许改
   ------------------------------------------------------------
   拿「识别出来的背景」和「正文」各算一次 WCAG 相对亮度，比个高低：
     字比底亮 → 黑暗系；字比底暗 → 明亮系。
   为什么不用「背景自己的绝对亮度配一个阈值」：那一条在中明度的底上会猜反 ——
   背景相对亮度 .21 那一档（老口径的阈值是 .22）压白字明明是黑暗系，阈值算它是浅底，
   于是整套界面按浅底的公式派生，卡面被往白里混、字又被推深，看着就是灰扑扑一片。
   两个数挨得太近（相对亮度差不到 .02）、两头都说不准时这里不硬判，回空串：
   这种配色本来就不配有结论，交给自检里那条对比下限（正文 ≥4.5）去拦。
   ------------------------------------------------------------
   识别方案四套（外13-A）：切换值落在存档 data\appearance.json 的 look.scheme，
   开机由外壳 setPalScheme() 读回来；没读过就是默认的 甲，界面不会因为换了程序而变样子。
   ============================================================ */
const MD_GAP = .02;
const MD_NAME = { dark:'黑暗', light:'明亮' };
function hex6(v){
  const s = String(v || '').trim();
  if(/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  if(/^#[0-9a-f]{3}$/i.test(s)){ const c = s.slice(1); return ('#' + c[0] + c[0] + c[1] + c[1] + c[2] + c[2]).toLowerCase(); }
  return '';
}
/* 交回 'dark' / 'light' / ''（'' = 两头都勉强，不硬判） */
function mingDark(bg, text){
  const a = hex6(bg), b = hex6(text);
  if(!a || !b) return '';
  let la, lb;
  try{ la = CV.lum(a); lb = CV.lum(b); }catch(e){ return ''; }
  if(Math.abs(la - lb) < MD_GAP) return '';
  return lb > la ? 'dark' : 'light';
}
/* 判定那一句话：给自检和界面用，说得出为什么 */
function mingDarkWhy(bg, text){
  const a = hex6(bg), b = hex6(text);
  if(!a || !b) return { k:'', why:'底色或正文没识别出来，判不了' };
  const md = mingDark(a, b);
  const la = CV.lum(a), lb = CV.lum(b);
  if(!md) return { k:'', why:'底 ' + la.toFixed(3) + ' 与文 ' + lb.toFixed(3) + ' 亮度差不到 ' + MD_GAP + '，两头都勉强，不硬判' };
  return { k:md, why:'正文 ' + lb.toFixed(3) + (md === 'dark' ? ' 比底色 ' + la.toFixed(3) + ' 亮 → 黑暗系'
    : ' 比底色 ' + la.toFixed(3) + ' 暗 → 明亮系') };
}

/* ---------- 四套识别方案 ---------- */
const PAL_SCHEMES = [
  { k:'a', name:'甲 · 语义认领', back:'同色相暗一档',
    tip:'按 HSL 的饱和度和明度认领四个角色：最不饱和又亮的当底，同族里饱和度不超过 0.55、与底色对比不到 2 的余色当卡面，最暗的中性色当正文，彩度最高的当强调。卡面掺墨走的是卡面自己那个色相、暗一档。' },
  { k:'b', name:'乙 · 明度排序', back:'纯黑 / 纯白',
    tip:'只把输入色按明度排一条队：最亮当背景、第二亮当卡面、最暗当正文，中间最艳的那一个当强调，全程不看饱和度也不看语义。规则最短，代价是浅底配色里第二亮的那个常常正是强调色。' },
  { k:'c', name:'丙 · 双锚插值', back:'纯黑 / 纯白',
    tip:'只认两个锚：最亮那个是底、最暗那个是墨。带彩度的输入一律降级成强调和点缀，卡面不从输入里取，由「底 → 墨」那条线上插出来（插到与底差 4~28 个明度点那一档），输入色永远不会变成卡面。' },
  { k:'d', name:'丁 · 输入法老口径', back:'纯黑 / 纯白',
    tip:'照打字练习从前自己那一份 analyzeScheme（src\\_build\\p6.js）：卡面永远由底色混白算出（浅底混 62% 白、深底混 5% 白），正文取与卡面对比最高的那个，强调按「彩度 ×（与卡面对比过 1.4 才不折价）」打分且明度要在 .25~.85 之间。' },
];
const PAL_SCHEME_BACK = PAL_SCHEMES[0].k;
let PAL_SCHEME = PAL_SCHEME_BACK;
function palScheme(){ return PAL_SCHEME; }
function palSchemeDef(k){ return PAL_SCHEMES.find(x => x.k === k) || null; }
/* 认不得的名字一律落回默认那一档（存档被手工改坏、或者别的程序播过来一个没听过的方案） */
function setPalScheme(k){ PAL_SCHEME = (palSchemeDef(k) || palSchemeDef(PAL_SCHEME_BACK)).k; return PAL_SCHEME; }
/* 界面名单用：只认名字，找不着回 null */
function palSchemeByName(n){ return PAL_SCHEMES.find(x => x.name === n) || null; }

/* ---------- 卡面掺墨的那一块墨：按识别方案分两路 ----------
   甲 = 2026-10-05 那一条：拿卡面自己那个色相往暗（深底往亮）推一档，
        带色相的浅蓝 / 浅米卡面掺完还带着色相，不会一起拖成灰；
   乙 / 丙 / 丁 = 退回从前那一档：浅底掺纯黑、深底掺纯白。
   sh-look.js 的 readable() 只问这一句要墨，不再自己写第二套判断，两边不会跑偏。 */
CV.cardInk = function(card, dk, scheme){
  const k = (palSchemeDef(scheme || PAL_SCHEME) || palSchemeDef(PAL_SCHEME_BACK)).k;
  if(k !== 'a') return dk ? '#ffffff' : '#000000';
  try{
    const [h, s, l] = CV.hslOf(card);
    const nl = dk ? Math.min(1, l + .25) : Math.max(0, l - .25);
    return CV.rgbHex(CV.hslRgb([h, s, nl]));
  }catch(e){ return dk ? '#ffffff' : '#000000'; }
};

/* 丁的真身还带一份「微调」函数：cv_ensure —— 从 src\_build\p6.js 第 276~281 行原样搬来。
   它和上面 CV.ensure 的分别是真的，不是换个数：
     方向 —— 只认一头：底（这里是被压字的那块卡面）相对亮度 <0.5 就朝纯白推，否则朝纯黑推（p6.js 第 278 行）；
     步子 —— 每一步是朝那一头混 12%（p6.js 第 279 行的 cv_mix(out,toward,.12)），不是改明度 ±0.035；
     收场 —— 最多 30 步，推不动就停在推出去的当前色，不换纯黑纯白兜底（CV.ensure 会）。
   真身用它复检两处：正文 cv_ensure(text,cardBg,4.6)（p6.js 第 310 行）、
   强调 cv_ensure(accent,cardBg,2.2)（p6.js 第 320 行）。丁认领完角色往下派生时必须走这一条，
   走 CV.ensure 出来的正文 / 强调色号和真身不是同一批 —— 2026-10-05 逐色核对时抓出来的。 */
CV.ensureRime = function(fg, bg, target){
  if(CV.contrast(fg, bg) >= target) return fg;
  const toward = CV.lum(bg) < 0.5 ? '#ffffff' : '#000000';
  let out = fg;
  for(let i = 0; i < 30 && CV.contrast(out, bg) < target; i++) out = CV.mix(out, toward, .12);
  return out;
};

/* ---------- CMYK → RGB：三种印刷标准的近似换算 ---------- */
/* 矩阵法：先按通用减色模型 R=(1-C)(1-K) 求值，再按各标准的油墨/纸白特性做线性校正。
   不是真 ICC 渲染（真 ICC 需嵌入配置文件 + wasm，约 600KB），所以界面上必须标注"近似换算"。 */
const CMYK_STANDARDS = {
  gracol:  { name:'GRACoL2013（美国/欧标常纸）',  bias:[0.982,1.000,1.024], lift:[2,0,6] },
  swop:    { name:'SWOP v2（美国胶版）',          bias:[1.010,1.000,0.962], lift:[4,1,0] },
  japan:   { name:'Japan Color 2001 Coated（日标铜版）', bias:[0.972,0.994,1.036], lift:[0,0,9] }
};
function cmykToRgb(c, m, y, k, std){
  const p = CMYK_STANDARDS[std] || CMYK_STANDARDS.gracol;
  const base = [ (1-c)*(1-k), (1-m)*(1-k), (1-y)*(1-k) ];
  return CV.rgbHex(base.map((v,i)=>CV.clamp255((v*p.bias[i])*255 + p.lift[i])));
}

/* ---------- 输入解析 ----------
   format 传 'auto'|'rgb'|'cmyk'：auto 下 #hex 与 rgb() 走 RGB，cmyk() 或四个数字走 CMYK、三个数字走 RGB。
   CMYK 允许 0~1 或 0~100（含 %）两种写法，按是否有大于 1 的数判定量纲。 */
const NUM_RE = /(-?[\d.]+)\s*%?/g;
function numsOf(s){ return (s.match(NUM_RE) || []).map(Number); }
function parseColor(raw, format){
  const s = (raw || '').trim();
  if(!s) return null;
  const fmt = format || 'auto';
  /* Weasel 的 0x[AA]BBGGRR：蓝在前红在后，和 RP 的 hex0x 同一口径 */
  if(/^0x[0-9a-f]{6,8}$/i.test(s) && fmt !== 'cmyk'){
    let h = s.slice(2);
    if(h.length === 8) h = h.slice(2);
    return { hex:('#' + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2)).toLowerCase(), format:'rgb', raw:s };
  }
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) && !/[（(]/.test(s);
  if(hex && fmt !== 'cmyk'){
    let h = s.replace('#','');
    if(h.length === 3) h = h.split('').map(c => c + c).join('');
    return { hex:'#' + h.toLowerCase(), format:'rgb', raw:s };
  }
  const wantCmyk = /^cmyk/i.test(s) || fmt === 'cmyk';
  const ns = numsOf(s);
  if(wantCmyk){
    if(ns.length < 4) return null;
    /* 0~1 与 0~100 两种写法统一成百分比 */
    return { cmyk: ns.slice(0,4).map(x => Math.max(0, Math.min(100, x > 1 ? x : x * 100))), format:'cmyk', raw:s };
  }
  if(ns.length >= 3) return { hex:CV.rgbHex(ns.slice(0,3).map(CV.clamp255)), format:'rgb', raw:s };
  return null;
}
/* 统一换算成 RGB 十六进制；CMYK 记录所用标准，供界面标注来源 */
function resolveColor(c, std){
  if(!c) return null;
  if(c.format === 'rgb') return { hex:c.hex, source:'RGB', note:'' };
  return { hex:cmykToRgb(c.cmyk[0]/100, c.cmyk[1]/100, c.cmyk[2]/100, c.cmyk[3]/100, std),
    source:'CMYK', note:'近似换算 · 标准：' + (CMYK_STANDARDS[std] || CMYK_STANDARDS.gracol).name };
}

/* ---------- 自动定角色：1~5 个色号 → 语义角色 ---------- */
/* 四套口径由上面的识别方案切换，各套只负责「哪个输入色当哪个角色」，
   派生那一段公式除了卡面的来路（丙 / 丁 不认领输入色当卡面）都共用同一份。 */
function assignRoles(list, scheme){
  const k = (palSchemeDef(scheme) || palSchemeDef(PAL_SCHEME)).k;
  if(k === 'b') return rolesByLum(list);
  if(k === 'c') return rolesByAnchor(list);
  if(k === 'd') return rolesByRime(list);
  return rolesByMeaning(list);
}

/* 甲：现实现（2026-10-05 那一版，卡面认领上限 0.55） */
function rolesByMeaning(list){
  const info = list.map(hex => { const [h,s,l] = CV.hslOf(hex); return { hex, h, s, l, lum:CV.lum(hex) }; });
  const sorted = info.slice().sort((a,b) => a.lum - b.lum);
  const pale = info.slice().sort((a,b) => a.s - b.s);
  const R = {};
  /* 底：最不饱和的那个；两个色都为高饱和时，取较亮者当底（深底全屏刺眼） */
  R.bg = (pale[0].s < .3 ? pale[0] : sorted[sorted.length-1]).hex;
  if(CV.lum(R.bg) < .3 && info.every(c => c.l < .5)) R.bg = sorted[sorted.length-1].hex;
  const nonBg = info.filter(c => c.hex !== R.bg);
  /* 强调：非底色里饱和度最高、且亮度在可用区间的那个（同 RP 的打分口径） */
  let acc = null, best = -1;
  for(const c of nonBg){ const ct = CV.contrast(c.hex, R.bg); const sc = c.s * (ct > 1.4 ? 1 : .3);
    if(sc > best && c.l > .2 && c.l < .88){ best = sc; acc = c; } }
  R.accent = (acc || nonBg[0] || info[0]).hex;
  const usedOf = (R) => [R.bg, R.accent, R.card, R.text].filter(Boolean);
  if(list.length >= 2){
    const cand = nonBg.filter(c => c.hex !== R.accent);
    /* 卡面认领「与底色同族、饱和度不太高」的余色：上限 0.55。
       从前卡在 0.35，蓝精灵那套的 #e0edf5（S=0.53）被挡掉、近白 #f6f6f6（S=0）捡漏当卡面，
       整套界面就成了一片灰（2026-10-05 他截图问「为什么这套白蓝配色还是灰扑扑的」）。
       放到 0.55 之后带色相的浅彩（浅蓝 / 浅米 / 浅薄荷）能正常当卡面；
       真正的高饱和彩（#1778bf 那一档 S=0.79）仍然被挡在外面，不会把整张卡面染成大红大蓝。
       与底色对比 < 2 那条留着：卡面不能比页面深太多，否则一开页就看见一块补丁。 */
    const neutral = cand.find(c => c.s < .55 && CV.contrast(c.hex, R.bg) < 2);
    R.card = neutral ? neutral.hex : '';
  }
  if(list.length >= 3){
    const ref = CV.lum(R.card || R.bg);
    /* 文字同样只认领中性色：整屏卡片上盖一个高饱和色当正文并不好看 */
    const cand = info.filter(c => !usedOf(R).includes(c.hex) && c.s < .45);
    if(cand.length) R.text = cand.sort((a,b) => Math.abs(b.lum-ref) - Math.abs(a.lum-ref))[0].hex;
  }
  if(list.length >= 4){
    const cand = info.filter(c => !usedOf(R).includes(c.hex));
    if(cand.length) R.accent2 = cand[0].hex;
  }
  return R;
}

/* 乙：明度排一条队，不问色相也不问语义 */
function rolesByLum(list){
  const seen = [];
  const info = [];
  for(const hex of list){
    if(seen.includes(hex)) continue;
    seen.push(hex);
    const [h,s,l] = CV.hslOf(hex);
    info.push({ hex, h, s, l, lum:CV.lum(hex) });
  }
  const R = { card:'', text:'', accent:'', accent2:'' };
  if(!info.length) return R;
  const byLum = info.slice().sort((a,b) => b.lum - a.lum);        /* 亮 → 暗 */
  R.bg = byLum[0].hex;
  const rest = byLum.slice(1);
  /* 第二亮当卡面：只剩两个色时那个就是正文，不硬塞 */
  R.card = rest.length > 1 ? rest[0].hex : '';
  const body = rest.slice(R.card ? 1 : 0);
  R.text = body.length ? body[body.length - 1].hex : '';
  /* 强调取「中间那一档里最艳的」；中间没有色了就退回除去底色和正文的那一串 */
  const mid = body.slice(0, Math.max(0, body.length - 1));
  const pool = (mid.length ? mid : rest).filter(c => c.hex !== R.bg && c.hex !== R.text);
  const bySat = pool.slice().sort((a,b) => b.s - a.s);
  R.accent = bySat.length ? bySat[0].hex : '';
  R.accent2 = bySat.length > 1 ? bySat[1].hex : '';
  return R;
}

/* 丙：双锚（最亮 = 底、最暗 = 墨），带彩度的输入一律降级成强调 / 点缀；卡面不认领输入色 */
function rolesByAnchor(list){
  const seen = [], info = [];
  for(const hex of list){
    if(seen.includes(hex)) continue;
    seen.push(hex);
    const [h,s,l] = CV.hslOf(hex);
    info.push({ hex, h, s, l, lum:CV.lum(hex) });
  }
  const R = { card:'', accent:'', accent2:'' };
  if(!info.length) return R;
  const byLum = info.slice().sort((a,b) => b.lum - a.lum);
  R.bg = byLum[0].hex;
  R.text = byLum.length > 1 ? byLum[byLum.length - 1].hex : '';
  /* 「带彩度」的线：饱和度 ≥ .18 就不许当卡面也不许当正文，只配当点缀。
     底色和正文那两个锚先摘出去，剩下的按彩度从高到低排。 */
  const pool = info.filter(c => c.hex !== R.bg && c.hex !== R.text);
  const chroma = pool.filter(c => c.s >= .18).sort((a,b) => b.s - a.s);
  R.accent = chroma.length ? chroma[0].hex : (pool.length ? pool[0].hex : '');
  R.accent2 = chroma.length > 1 ? chroma[1].hex : '';
  /* 中性余色（s < .18 又排在两个锚中间）这一套不用：再捡回来当卡面，
     就走回「一个近白把整屏顶成灰」那条老路了 */
  return R;
}

/* 丁：打字练习从前那一份 analyzeScheme 的认领口径（那一份 2026-10-08 从 src\_build\p6.js 里撤了，
   练习器从此吃这一份；撤之前它的算法就在 p6.js 的 283~327 行）。
   那一份的输入是 weasel 的字段名（back_color / text_color / candidate_text_color …），
   色卡这一头只有排好序的色号、字段名拿不到，所以按库里的书面次序对位：
   第一条色号当底色（那是 weasel 的 back_color 在库里的位置），其余按老那两条打分挑。
   卡面：老口径从来不认领任何输入色当卡面，永远由底色混白派生 → R.card 留空，公式在派生那一头。 */
function rolesByRime(list){
  const seen = [], info = [];
  for(const hex of list){
    if(seen.includes(hex)) continue;
    seen.push(hex);
    const [h,s,l] = CV.hslOf(hex);
    info.push({ hex, h, s, l, lum:CV.lum(hex) });
  }
  const R = { card:'', text:'', accent:'', accent2:'' };
  if(!info.length) return R;
  R.bg = list[0] && seen.includes(list[0]) ? list[0] : info[0].hex;
  const non = info.filter(c => c.hex !== R.bg);
  /* 老口径的深浅判定就是这一条绝对阈值（这里是「挑角色」，不是界面上的明暗结论）：
     它拿它算的是卡面该混白还是混黑；界面上「这套算黑暗还是明亮」一律走上面那一条底色对正文的判定。 */
  const dk0 = CV.lum(R.bg) < .22;
  const cardRef = dk0 ? CV.mix(R.bg, '#ffffff', .05) : CV.mix(R.bg, '#ffffff', .62);
  /* 正文：与那块卡面对比最高的那一个（老口径排的是 candText/text/selText/hiliteText/label 五个字段，
     字段名拿不到，就按同一个打分口径在色号里挑） */
  if(non.length) R.text = non.slice().sort((a,b) => CV.contrast(b.hex, cardRef) - CV.contrast(a.hex, cardRef))[0].hex;
  /* 强调：彩度打分，明度必须落在 .25~.85 之间，与卡面对比不到 1.4 的打三折。
     照搬 p6.js 第 312~318 行的循环本体（score=s*(ct>1.4?1:0.3)，条件 l>0.25 && l<0.85）；
     真身逐个打分、一个都不排除 —— 从前这里多跳过了一个「已被选作正文的」，那是把 FD 的
     主次分色心思安到真身头上，2026-10-05 逐色核对时去掉。
     second / R.accent2 是 FD 这头为组件色槽加的延伸（真身没有这一段），不参与五档结论。 */
  let acc = null, best = -1, second = null, best2 = -1;
  for(const c of non){
    if(c.l <= .25 || c.l >= .85) continue;
    const sc = c.s * (CV.contrast(c.hex, cardRef) > 1.4 ? 1 : .3);
    if(sc > best){ best2 = best; second = acc; best = sc; acc = c; }
    else if(sc > best2){ best2 = sc; second = c; }
  }
  /* 真身 p6.js 第 319 行：`!accent || best<0.05` 两种都退回正文。
     这里交回空串，由 deriveTokens 的 roles.accent || text 走那一步退回 ——
     从前只判了「一个都没挑着」，漏了 best<0.05 这道分数下限（灰蒙蒙一片的低彩输入
     在真身里宁可正文顶上也绝不当强调），2026-10-05 逐色核对时补上。 */
  R.accent = acc && best >= .05 ? acc.hex : '';
  R.accent2 = second ? second.hex : '';
  return R;
}

/* 丙的卡面：底 → 墨 那条线上取一档，取到与底差进 4~28 个明度点那一档为止
   （自检里「卡面与背景的明度差」用的就是这个数，单位是 HSL 明度的百分点） */
function interpCard(bg, ink){
  const L = v => CV.hslOf(v)[2];
  const base = L(bg);
  let t = .06, out = CV.mix(bg, ink, t);
  for(let i = 0; i < 24; i++){
    const d = Math.abs(L(out) - base) * 100;
    if(d >= 4 && d <= 28) return out;
    t = d < 4 ? Math.min(1, t + .03) : Math.max(.01, t - .02);
    out = CV.mix(bg, ink, t);
  }
  return out;
}

/* ---------- 派生整套 token ---------- */
function deriveTokens(roles, scheme){
  const sch = (palSchemeDef(scheme) || palSchemeDef(PAL_SCHEME)).k;
  const bg0 = roles.bg || '#f3f4f6';
  /* 明暗判定走文件顶上那一条固定口径：识别出来的底色对正文比相对亮度。
     只给一两个色号、连正文都认不出来的时候（md 是空串），这里退回老那一条
     「底色自己的绝对亮度 < .22」猜一次派生方向 —— 它只挑公式，不当界面结论；
     界面上的明暗一律由 Theme.dark() 现算，自检里那条下限负责把这种配色拦下来。 */
  const md = mingDark(bg0, roles.text);
  /* 丁的深浅判定照真身 p6.js 第 293 行：一律拿底色自己的相对亮度对 .22，不走「字底比亮度」那一条 ——
     它挑的是「卡面混 62% 白还是 5% 白」这一对公式的方向，必须和 rolesByRime 挑角色时的 dk0
     （p6.js 第 292~293 行那份底色）是同一个数，否则选正文、选强调参照的那块卡面和画下去的卡面不是一张。
     界面上的明暗结论不受这一条管，一律走 Theme.dark() 的 mingDark。其余三案仍按上面的固定口径。 */
  const dark = sch === 'd' ? CV.lum(bg0) < .22 : (md ? md === 'dark' : CV.lum(bg0) < .22);
  /* 整屏底色不能像 RP 那样往黑里压：深底一压就掉进纯黑、丢了色相。
     丁 除外 —— 它的真身压的就是这一档：p6.js 第 296 行 cv_adjust(bg0,-0.06,0.6)（浅底那条
     第 301 行 +0.02 / ×0.5 和共用公式本来就一致），2026-10-05 逐色核对时照真身改回来。 */
  let pageBg = sch === 'd'
    ? CV.adjust(bg0, dark ? -.06 : .02, dark ? .6 : .5)
    : CV.adjust(bg0, dark ? .03 : .02, dark ? .8 : .5);
  /* 卡面的来路分三档：
     丙 = 底 → 墨 那条线上插出来（输入色永远不会变成卡面）；
     丁 = 老口径那两条系数，永远由底色混白算出来（浅底混 62% 白、深底混 5% 白）；
     甲 / 乙 = 认领得到就用认领那张中性卡，认不到才现派生。 */
  let cardBg;
  if(sch === 'c') cardBg = interpCard(bg0, roles.text || (dark ? '#ffffff' : '#1a1a1a'));
  else if(sch === 'd') cardBg = dark ? CV.mix(bg0, '#ffffff', .05) : CV.mix(bg0, '#ffffff', .62);
  else cardBg = roles.card || (dark ? CV.mix(pageBg, '#ffffff', .09) : CV.mix(bg0, '#ffffff', .62));
  /* 卡面与底太接近会糊成一片：小步往亮推，一次混太多会掉色相变成死灰。
     丙 / 丁 不走这一步：丙 的卡面由 interpCard 自己按明度差挑档（见那里），
     丁 的老口径里从头就没有这一条，补上去就不是那一份了。 */
  if(sch !== 'c' && sch !== 'd')
    for(let i = 0; i < 6 && CV.contrast(cardBg, pageBg) < 1.13; i++) cardBg = CV.mix(cardBg, '#ffffff', .07);
  /* 输入框底：比卡面再亮一档就够了，从前浅底掺到 85% 白，出来的几乎是一个纯白色号 ——
     带色相的那几套配色（琥珀竹烟、青梧雨这类）里它就是 #4 说的「没有融入配色」的那块白斑。
     掺到 .55 仍然比卡面亮（往白混只可能变亮，正文在上面的对比只会更高、不会掉到线下），
     但留着这套配色的色相；深底那一路本来就往黑压，不动。
     丁 那一档退回老口径的 85%（那是它自己的一份数，不跟这一条统一）。 */
  const inputBg = sch === 'd'
    ? (dark ? CV.mix(bg0, '#000000', .14) : CV.mix(bg0, '#ffffff', .85))
    : (dark ? CV.mix(cardBg, '#000000', .14) : CV.mix(cardBg, '#ffffff', .55));
  const border = CV.mix(cardBg, dark ? '#ffffff' : '#000000', dark ? .14 : .1);
  let text = roles.text || (dark ? '#ffffff' : '#1a1a1a');
  /* 正文先按 7.0 要：设计指南那条「正文用墨色那一端，不许拿浅灰当正文」。
     这块卡面够不着 7.0 就退到推得到的最高点，再低也保住 4.6 那条底线。
     为什么要多要这一截：次级文字的下限抬到 4.5 之后，主次两档在 4.6 这一档上挤在一起，
     按 7.0 要之后 54 套里主次并色的从 13 套降到 10 套（剩下那 10 套是卡面本身就偏中性灰，属配色层的事）。
     丁 那一档照真身：p6.js 第 310 行 cv_ensure(text, cardBg, 4.6) 就这一条 ——
     推的公式也要照那份微调函数（CV.ensureRime，从 p6.js 第 276~281 行搬来），
     从前这里拿共用的 CV.ensure 顶了一遍，推出来的正文色号和真身不是同一批。 */
  if(sch === 'd'){ text = CV.ensureRime(text, cardBg, 4.6); }
  else{
    text = CV.ensure(text, cardBg, 7);
    if(CV.contrast(text, cardBg) < 4.6) text = CV.ensure(text, cardBg, 4.6);
  }
  /* 次级文字不再固定掺 42%：这一档实测 12.57–14.3px，按条款就是普通小字，得够 4.5（从前只保 3.0）。
     掺得越少主次分得越开，所以掺入量取「0.42」和「这块底上还能撑到 4.5 的最大掺入量」里小的那一个；
     掺不动才并成卡面色 —— 宁可少一层字色，也不留一片读不动的小字。
     丁 那一档照老口径：固定掺 42%，不足由自检那一条报出来。 */
  let tl = .42;
  if(sch !== 'd')
    while(tl > 0 && CV.contrast(CV.mix(text, cardBg, tl), cardBg) < 4.5) tl = Math.round((tl - .01) * 100) / 100;
  const textLight = tl > 0 ? CV.mix(text, cardBg, tl) : cardBg;
  /* 强调色下限 2026-10-04 从 2.2 抬到 3.0：这一档不只管按钮底和辉光那一圈描边的浓淡，
     从前工具条上那个焦点框唯一可见的落点就是这道强调色边框（无障碍 C-6），2.2 够不着条款
     给非文本边界的 3.0。抬上去之后辉光那圈也一并达标。
     丁 那一档不跟着抬：真身 p6.js 第 320 行就是 cv_ensure(accent, cardBg, 2.2)，
     且推的公式走那份微调函数（CV.ensureRime）——「输入法老口径」这一案要的就是逐色复现那一份，
     2026-10-05 从前一版「统一按 3.0 复检」的说法作废；界面可读性另有自检里那条下限拦着。 */
  let accent = sch === 'd' ? CV.ensureRime(roles.accent || text, cardBg, 2.2)
    : CV.ensure(roles.accent || text, cardBg, 3);
  const accentLight = CV.mix(cardBg, accent, dark ? .22 : .16);
  /* 按钮底跟着配色走：写死纯白，在任何带色相的卡面上都是一块白斑。
     丁 那一档退回老口径：深底是卡面混 5% 白、浅底就是纯白。 */
  const btnBg = sch === 'd' ? (dark ? CV.mix(cardBg, '#ffffff', .05) : '#ffffff')
    : CV.mix(cardBg, accent, dark ? .18 : .10);
  const selBg = accent;
  const selText = CV.ensure(CV.lum(selBg) > .5 ? '#1a1a1a' : '#ffffff', selBg, 4.6);
  /* 分段选择那一格的底（槽）：未选项的字按这一块推，不按卡面推 ——
     从前跟着 --text-light 走，落在比卡面深一档的槽里就少了一截对比。 */
  const candBg = CV.mix(cardBg, dark ? '#ffffff' : '#000000', dark ? .07 : .045);
  /* 组件强调色槽：以主强调为基准做色相旋转，亮度锁定在卡面可读区间 */
  const [ah, as] = CV.hslOf(accent);
  const slots = [0, 34, -42, 168, 214].map((d, i) => {
    const src = i === 1 && roles.accent2 ? roles.accent2 : null;
    let hex = src || CV.rgbHex(CV.hslRgb([(ah + d/360)%1, Math.max(.28, as*.9), dark ? .58 : .46]));
    return CV.ensure(hex, cardBg, 1.9);
  });
  const tk = {
    '--page-bg':pageBg, '--card-bg':cardBg, '--card-border':border,
    '--text':text, '--text-light':textLight, '--accent':accent, '--accent2':slots[1],
    '--accent-light':accentLight, '--loaded-bg':accentLight, '--loaded-border':accent,
    '--candidate-bg':candBg,
    /* 未选项的字：从次级文字出发，按槽底再推一次 4.5（浅底那几套槽比卡面深，一推就够） */
    '--seg-text':CV.ensure(textLight, candBg, 4.5),
    '--input-bg':inputBg, '--btn-bg':btnBg, '--sel-bg':selBg, '--sel-text':selText,
    '--input-border':CV.mix(cardBg, text, .22),
    '--scrollbar':CV.mix(cardBg, text, dark?.32:.28), '--scrollbar-hover':CV.mix(cardBg, text, dark?.48:.42),
    /* 状态色下限 3.0 → 4.5：这三色在界面上既当图标色也当文字色（成功 / 失败 / 警告那一行小字），
       按 3.0 只够大图形那一档，落在 12–14px 的说明字上就读不动了。参照底由 sh-look.js 那一头复检合成后那块。 */
    '--ok':CV.ensure(CV.rgbHex(CV.hslRgb([.36,.55,dark?.5:.36])), cardBg, 4.5),
    '--bad':CV.ensure(CV.rgbHex(CV.hslRgb([.02,.6,dark?.58:.42])), cardBg, 4.5),
    '--warn':CV.ensure(CV.rgbHex(CV.hslRgb([.11,.62,dark?.58:.4])), cardBg, 4.5),
    '--wall-a':CV.mix(pageBg, accent, dark?.1:.06),
    '--wall-b':CV.mix(pageBg, dark?'#ffffff':'#000000', dark?.06:.1),
    /* 卡片那层皮（边框、投影、发光）全在 _shared/sh-look.js 里算，配色这一头不再掺和：
       从前这里的 --card-sheen / --card-edge 是给"纯色玻璃"仿的，那一套已经撤了。
       --card-line 留着：它是分隔线和拖拽辅助线用的，四档外观模式都不动它。 */
    '--card-line':dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)'
  };
  slots.forEach((c, i) => tk['--slot-' + (i+1)] = c);
  return tk;
}

/* 供 RP 回灌校验：输入 weasel 风格的角色色，直接走同一派生函数 */
function themeFromRoles(roles){ return deriveTokens(roles); }

/* ---------- 两套内置方案：FD 首页和组件独立外观页共用 ----------
   这里只给"能一眼认出是明亮/黑暗"的主干 token，其余全部由 deriveTokens 补齐。
   --btn-bg 不在这里出现：按钮底必须跟着配色走，写死白色在有色卡面上就是白斑。
   --text-light 也不在这里出现（2026-10-04 从这张表里摘掉）：次级文字的掺入量由派生那一头按
   「这块底上还能撑到 4.5 的最大值」算，表里钉死一个浅灰就把那条下限顶掉了 ——
   从前内置的 #8a8f99 压在 #ffffff 上只有 2.9 的对比，整屏说明小字读不动就是从这一个数来的。 */
const PRESETS = {
  light:{'--page-bg':'#f3f4f6','--card-bg':'#ffffff','--card-border':'#e1e4ea','--text':'#2f3338',
    '--accent':'#3b6cb5','--accent-light':'#e8f0fc','--loaded-bg':'#ebf2fc',
    '--loaded-border':'#b3c9ee','--candidate-bg':'#f0f2f5','--input-bg':'#ffffff',
    '--sel-bg':'#3b6cb5','--sel-text':'#ffffff','--input-border':'#c9ccd4','--scrollbar':'#c4c9d3','--scrollbar-hover':'#a7adb8'},
  dark:{'--page-bg':'#1b1d22','--card-bg':'#26292f','--card-border':'#3a3e46','--text':'#e6e8ec',
    '--accent':'#7aa7e8','--accent-light':'#2c3543','--loaded-bg':'#2c3848',
    '--loaded-border':'#44587a','--candidate-bg':'#33373f','--input-bg':'#26292f',
    '--sel-bg':'#7aa7e8','--sel-text':'#101318','--input-border':'#454a55','--scrollbar':'#484d58','--scrollbar-hover':'#5d636f'}
};
/* 手改过 palette.json 的 mode 可能谁都认不得：兜回明亮，别让人打不开设置 */
function presetOf(mode){ return PRESETS[mode] || PRESETS.light; }
/* 一套方案 → 整套 token：内置走预设表，自定义色号先定角色再派生
   scheme 不传就认当前那一档（palScheme()），自检脚本会逐套传一遍 */
function tokensOf(entry, scheme){
  const sch = (palSchemeDef(scheme) || palSchemeDef(PAL_SCHEME)).k;
  if(!entry || entry.mode !== 'custom'){
    const base = PRESETS[(entry && entry.mode) || 'light'] || PRESETS.light;
    const d = deriveTokens({ bg:base['--page-bg'], card:base['--card-bg'], text:base['--text'], accent:base['--accent'] }, sch);
    return { tokens:{ ...d, ...base }, roles:null, notes:[] };
  }
  const hexes = [], notes = [];
  for(const c of (entry.colors || [])){
    const p = parseColor(c.raw, c.format || 'auto');
    if(!p) continue;
    const r = resolveColor(p, entry.std || 'gracol');
    hexes.push(r.hex);
    if(r.note && !notes.includes(r.note)) notes.push(r.note);
  }
  if(!hexes.length) return { tokens:deriveTokens({}, sch), roles:null, notes };
  const roles = assignRoles(hexes, sch);
  return { tokens:deriveTokens(roles, sch), roles, notes, hexes };
}
/* 一套配色在界面上算黑暗还是明亮：拿派生完的底色和正文走那一条固定判定。
   色卡 明暗 那一栏写的就是这个数（甲 那一档的现算结果），运行时不拿它当结论。 */
function paletteMingDark(entry, scheme){
  const t = tokensOf(entry, scheme || 'a').tokens;
  return mingDark(t['--page-bg'], t['--text']);
}
function paletteMingDarkWhy(entry, scheme){
  const t = tokensOf(entry, scheme || 'a').tokens;
  return mingDarkWhy(t['--page-bg'], t['--text']);
}
