/* ============================================================
   FD 外壳 v0.2：全局色卡、64×36 相对网格（吸附切两半 = 128×72）、长按拖拽缩放、卡片与设置骨架
   外壳 HTML/CSS 是只读的，本版本新增的样式全部由 injectShellCss() 注入
   ============================================================ */
const GRID_COLS = 64, GRID_ROWS = 36, GRID_PAD = 1;
/* ---------- 吸附精度：一格切几份 ----------
   格子还是 64×36 那一套（老布局存的整数照旧能用），但拖和拉只按半格落位，
   等价于 128×72 的细网格。背景那些线跟着密一倍，看到的线就是能贴的边。
   GRID_STEP 那一位现在只当「横轴那一口 = 半格」的基准，实际步长由 snapQ 按两轴像素算（外33 第 2 条）。 */
const GRID_STEP = 2;
/* 拖和拉的这一步在两个轴上必须是同一个像素数（外33 第 2 条）。
   从前横着按 --cw 折半格、竖着按 --ch 折半格，两个轴各吃各自的半格 ——
   可格子本身两轴就不等边（700×1400 探针实测一格 10.61 × 38.30 像素，3.61 倍）：
   横着一口 5.3 像素、竖着一口 19.1 像素。捏着右下角往下拉，指针走 15 像素竖边纹丝不动，
   再走 4 像素整格跳过去，横边却跟着指针走得又细又密 —— 他报的「操作漂移」就是这一笔。
   步长取「较小那格的半格」，两轴各自折回格数时归到 1/8 格这一档（落盘的数还是干净分数，
   横轴在等边格子上折回来正好是 0.5，跟从前一个字都不差）。 */
const snapQ = (步, cell) => Math.max(1 / (GRID_STEP * 4), Math.round(步 / cell * GRID_STEP * 4) / (GRID_STEP * 4));
const snapDelta = (px, cell, 步) => snapQ(步, cell) * Math.round(px / cell / snapQ(步, cell));
/* 卡片面积到页面这个比例就算「展开」，组件在卡内直接给全部功能。
   说明书里点了 noExpanded 的那一家不吃这一档（日程：任意大小都照卡面那一格画，全览只走 ⛶）。 */
const EXPAND_AREA = .25;
const isExpanded = (def, it) => !def.noExpanded && it.w * it.h >= GRID_COLS * GRID_ROWS * EXPAND_AREA;
/* 字号基准：格子短边 58px 时字号 1.0 */
const VSC_BASE = 58;

/* 两套内置方案（PRESETS）和派生函数都在 _shared/sh-color.js，WNW 用同一份 */

/* ---------- 全局色卡 ----------
   池里每一项 = 一套完整方案。来源三种：内置预设 / FD 自定义色号 / 托管 RP 的输入法配色。
   自定义项可删，预设与输入法来源的不可删。任意处切换 = 改全局。
   存档和下面那些观感设置是同一份 appearance.json（见 LookStore），不再各存各的。 */
/* 一套外观就一份文件：色卡（原来 palette.json）+ 卡片质感 / 背景 / 圆角 / 字体
   （原来只存在 IndexedDB 镜像里的那份 theme 设置）合成 data\appearance.json。
   第一次开机自动把旧的并进这一份，旧的 palette.json 和那份 IDB 设置都原样留着不动。 */
const LOOK_FILE = 'appearance.json';
/* 材质那一档整个撤了（2026-10-04）：卡片底只有实色，没有第二档可换，
   存档里旧的那两档玻璃名字（glass / clear）和后来加的 fx 一律不再读，开机清掉。 */
const LookStore = {
  data:null,
  /* 出厂默认：质感模式 + 纯色背景 + 全局圆角 5px（卡片、控件两档都是 5）+ 模板自带那套字体。
     外观模式 / 纹理这两样归 _shared/sh-look.js 算样式，这里只管存。
     背景这一层（外29 丁组改过一次）：
       wall          这一层此刻铺什么：solid 纯色 / gradient 渐变 / image 一张背景图
       wallImg       那一张背景图 = 图片库（data\images.yaml）里的名字，由方案递过来（方案文件才是真身，这里只是生效值）
       wallBlur      背景图糊 0~24 像素（只糊这一层，卡片不跟着糊）
       wallTint      压在壁纸上的那一层调子（0~30，空串 = 按明暗取出厂的 6 / 14）
       texCell       纹理那张「一张占几 × 几格」（最小格位），null = 按图自己的像素铺
     从前还有一层「四方连续壁纸」（tileFile / tileBlur / tileCell）：2026-10-08 作者把纹理和四方连续图
     定成同一样东西（「纹理/四方连续图会进入所有的FD背景、卡片背景、展开后的组件背景等」），
     那一层就并进纹理这一档了 —— 存档里还挂着那一条句柄的，开机搬进图片库当一张纹理用，搬完这一档就没了。
     明暗那一轴（外13-M）跟着住在同一节里，五样：
       mingMode  三档：auto 跟随系统 / time 按一日内时间切换 / manual 手动设置
       mingPick  手动那一档定的死轴（light / dark）；开机第一次落值 = 当前这套配色的判定结果
       mingLightAt / mingDarkAt  按时间那一档的两个时刻（默认 06:30 转明亮、18:30 转黑暗）
       mingLast  上一回真正落在界面上的那一轴：跟随系统却没问到系统深浅、按时间却把两个时刻设成
                 相等这两种时候拿它兜底，不硬判
     默认是 manual 而不是「跟随系统」，为什么这么定见 Ming 那一段的抬头说明。 */
  defaults:{ mode:'material', tex:'', fontLangs:{}, texCell:null, texGray:false,   /* texOn（纹理强度）2026-10-08 整串撤了 */
             wall:'solid', wallImg:'', wallFile:'', wallBlur:0, wallTint:'',
             radiusCard:5, radiusCtl:5, gap:0, font:'', weight:'', scheme:'a',
             mingMode:'manual', mingPick:'', mingLightAt:'06:30', mingDarkAt:'18:30', mingLast:'' },
  async load(){
    if(this.data) return this.data;
    let d = await Store.loadJSON(LOOK_FILE, null);
    const look = Object.assign({}, this.defaults, (d && d.look) || {});
    if(!d){
      /* 老得不能再老的两份：色卡那一份 palette.json + 只存在镜像里的 theme 设置，第一次开机并进来 */
      const pool = await Store.loadJSON('palette.json', null);
      const old = await Store.loadSetting('theme', null);
      d = { items:(pool && Array.isArray(pool.items)) ? pool.items : [],
            cur:(pool && pool.cur) || 'preset-light',
            look:Object.assign({}, look, old || {}) };
    }
    d.look = look;
    d.items = Array.isArray(d.items) ? d.items : [];
    /* 标记色：2026-10-08 起这一串住在方案文件里（looks.yaml 的 标记色 那一栏）。
       顶上这一节是从前那一份「所有方案共用一串」，读回来先洗一遍（认不得的色号丢掉、超过上限的截掉），
       交给 Marks.boot() 认下来当「沿用的那一串」，认完由它把这一节让位掉 —— 只搬一次，不留两个口径。 */
    d.marks = marksNorm(d.marks);
    /* 存档里如果还写着已经撤掉的材质档（fx）和那个折射开关（real），清一次落定，
       不每次都换算；外观模式认不出来的值由 Look.eff 落回默认那一档，这里不另写一份判定。 */
    const dirty = d.look.fx !== undefined || d.look.real !== undefined;
    delete d.look.fx; delete d.look.real;
    /* 配色识别方案（外13-A）：这一档和上面那些观感设置住在同一节里。读回来立刻告诉配色引擎，
       后面每一次派生都按它走；认不得的值（手工改坏的、别的程序播过来的）由 setPalScheme 落回
       默认那一档（甲），落回来的那一个名字再写回 cfg —— 界面下拉读的就是 cfg.scheme，
       两边必须同一个值，不然下拉显示的和实际跑的不是同一套。 */
    const rawScheme = d.look.scheme;
    if(typeof setPalScheme === 'function') d.look.scheme = setPalScheme(d.look.scheme);
    if(dirty || rawScheme !== d.look.scheme) this.save(d);
    this.data = d;
    return d;
  },
  /* #291 #292：这套外观的东西搬进 数据\ 那两份 YAML 之后，这一份只记状态 ——
     此刻用哪一套配色（cur + curName）、用哪一套外观方案（lookCur）、加上不进方案的那几样（壁纸）。
     cur 那一串 id 只在页面开着的时候有用，重启之后色卡整个从文件里认（id 就是 p:+段名），
     所以当前那一条同时按名字记一份 curName：文件里的顺序挪一挪、段名没动，用的还是原来那套。
     色卡和方案本身不再抄一份在这儿：两份真相迟早对不上。 */
  slim(d){
    const x = d || this.data || {};
    const out = { cur:x.cur || '', curName:x.curName || '', lookCur:x.lookCur || '',
      /* 色卡向存档补齐那一趟的记号：钉过就不再补，你从文件里删掉的一条不会复活 */
      palMigrated:!!x.palMigrated,
      /* 标记色（外13-N）：和 cur / lookCur 同一层的单独一节，不属于 look 那一节 ——
         外观方案 snapshot 只抄 look，所以这一串不会被任何一套方案带走或覆盖。 */
      marks:marksNorm(x.marks),
      look:Object.assign({}, this.defaults, x.look || {}) };
    /* 记号还没钉上（补齐那一步还没写成功，或者压根没跑成）就继续抄着这一份色卡：
       老存档升上来、写盘那一趟又没成，抹掉就是那几十套配色整个没了，第二天开机只剩文件里两条 */
    if(!x.palMigrated && Array.isArray(x.items) && x.items.length) out.items = x.items;
    return out;
  },
  save(d){ Store.saveJSON(LOOK_FILE, this.slim(d)); }
};
/* ============================================================
   明暗那一轴（外13-M）· 纯换算这一段
   ----------
   这一段只做换算、不碰界面也不读存档，临时脚本拿 node 的 vm 单捞这一段就能验算。
   口径说明：
   · 一池里有哪些配色 = 读 数据\palettes.yaml 里那一栏 明暗（fd3-lib.js 读回来挂在 e.md 上）。
     那一栏缺失的（运行时刚建、还没在文件里绕一圈的那套）才现算一次，现算用的还是
     sh-color.js 的 paletteMingDark —— 同一个口径，文件和代码不会各说一套。
     明暗 那栏写着「判不准」的（e.md 为空）两池都不归，界面上不摆出来。
   · 按时间那一档不做日出日落：没有经纬度也没有天文算法，就是两个可改的时刻把一天切成两段，
     明亮那一段从 明亮时刻 起到 黑暗时刻 止（跨过午夜就是 22:00 → 06:30 那种写法）。
   ============================================================ */
/* MING-PURE-BEGIN */
const MING_DAY = 1440;                       /* 一天的分钟数 */
const MING_NAME = { light:'明亮', dark:'黑暗' };
const MING_MODES = [{ k:'auto', name:'跟随系统' }, { k:'time', name:'按一日内时间切换' }, { k:'manual', name:'手动设置' }];
/* 此刻落在界面上的那一轴（'' = 还没定下来）。单独一个变量摆在这儿，是为了让 Theme.apply
   在任何时候读它都读得到（不依赖下面那个 Ming 对象的定义位置）。 */
let MING_AXIS = '';
/* '06:30' → 390；认不得的写法回 null（调用方兜回默认值，不拿 NaN 去比大小） */
function mingMinutes(t){
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t == null ? '' : t).trim());
  if(!m) return null;
  const hh = +m[1], mm = +m[2];
  if(hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}
/* 这一时刻落在哪一段：L<D 时明亮段是 [L,D)；L>D 是跨午夜那一段 [L,24:00)+[00:00,D)；
   L===D 时这段没有长度也没有缺口 —— 不下结论，回空串让上面那层说清为什么 */
function mingTimeAt(nowMs, lightAt, darkAt){
  const L = mingMinutes(lightAt), D = mingMinutes(darkAt);
  if(L === null || D === null || L === D) return '';
  const d = new Date(nowMs);
  const n = d.getHours() * 60 + d.getMinutes();
  return (L < D ? (n >= L && n < D) : (n >= L || n < D)) ? 'light' : 'dark';
}
/* 离下一个要换轴的时刻还有多久（毫秒）；排不上队（同一时刻 / 写法认不得 / 这一档没开）回 0。
   只算「下一个」，到点那一路会再排一次，所以机器睡过一整夜醒来也只会被这一个定时器领回来一趟。 */
function mingNextMs(nowMs, lightAt, darkAt){
  const L = mingMinutes(lightAt), D = mingMinutes(darkAt);
  if(L === null || D === null || L === D) return 0;
  const d = new Date(nowMs);
  const cur = d.getHours() * 60 + d.getMinutes() + (d.getSeconds() * 1000 + d.getMilliseconds()) / 60000;
  const wait = m => { const w = (m - cur) * 60000; return w > 0 ? w : w + MING_DAY * 60000; };
  return Math.max(1000, Math.min(wait(L), wait(D)));
}
/* 一套配色归哪一池：'light' / 'dark' / ''（'' = 判不准，两池都不归） */
function mingPoolOf(e){
  if(!e) return '';
  if(e.md === 'dark' || e.md === 'light') return e.md;
  /* 文件里那一栏还没写上来（运行时刚建的那套）、或者写着「判不准」：
     拿同一个口径现算一次。现算判得出就用，判不出来这条就不归任何一池，界面不摆它。 */
  try{ return typeof paletteMingDark === 'function' ? (paletteMingDark(e) || '') : ''; }
  catch(err){ return ''; }
}
/* 色环上两个色调之间的距离（绕一圈算短的） */
function mingHueDist(a, b){ const d = Math.abs(a - b); return d > .5 ? 1 - d : d; }
/* 跨池时挑「最接近当前色调」的那一套：
   主强调的色调差为主（灰accent 权重自动压低），底色那块再补色调差 + 明度差；
   先按名字排一遍再取严格更小，平手时永远落在名字靠前的那一套，结果可复现 */
function mingNearest(items, cur, md){
  const list = (items || []).filter(e => mingPoolOf(e) === md)
    .slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  if(!list.length) return null;
  if(!cur || typeof tokensOf !== 'function' || typeof CV === 'undefined') return list[0];
  const hsl = hex => { try{ return CV.rgbHsl(CV.hexRgb(String(hex))); }catch(err){ return [0, 0, 0]; } };
  let t0 = null;
  try{ t0 = tokensOf(cur).tokens; }catch(err){ t0 = null; }
  if(!t0) return list[0];
  const a0 = hsl(t0['--accent']), b0 = hsl(t0['--page-bg']);
  const score = e => {
    let t = null;
    try{ t = tokensOf(e).tokens; }catch(err){ return Infinity; }
    if(!t) return Infinity;
    const a1 = hsl(t['--accent']), b1 = hsl(t['--page-bg']);
    /* 饱和度两头都低时色调说不清话，把这一项往 0 压；灰accent 的两套不该因为色调随机差 180° 就被判很远 */
    const sat = Math.min(1, (a0[1] + a1[1]) / 2 + .15);
    const hue = mingHueDist(a0[0], a1[0]) * 2 * sat;
    const bg = mingHueDist(b0[0], b1[0]) * 2 + Math.abs(b0[2] - b1[2]);
    return hue * 1.4 + bg;
  };
  let best = null, bs = Infinity;
  for(const e of list){ const s = score(e); if(s < bs - 1e-9){ bs = s; best = e; } }
  return best;
}
/* MING-PURE-END */

/* ---------- 配色：色卡这一头交给色卡（fd3-lib.js） ----------
   #291 起，一套一套的配色住在 数据\palettes.yaml，appearance.json 里那 items 一份只是
   这文件没认下来之前的临时样子。Palette.save() 从此两边都写：
   存档记「此刻用哪一套」，文件记「有哪些套」。 */
const Palette = {
  get data(){ return LookStore.data; },
  async init(){
    await LookStore.load();
    /* 早先抓 RP 皮肤提不到主题名，就拿主色 hex 编了一个「输入法配色 · #3B6CB5」塞进色卡。
       现在改由 RP 自己报名字，这批假名的先清掉：不清的话同色去重会让假名一直留着、真名永远进不来。 */
    if(this.data.items.some(x => x.source === 'rp' && /^输入法配色/.test(x.name || ''))){
      this.data.items = this.data.items.filter(x => !(x.source === 'rp' && /^输入法配色/.test(x.name || '')));
      LookStore.save();
    }
    /* 内置那两条只在色卡还空着的时候补（外34 图2：「配色要允许删除」）。
       从前是「缺了就补」—— 删掉 RP 明亮，下次开机它又回来，那删除就是假的。
       搬家之后色卡里那条的 id 成了「p:RP 明亮」，所以补的时候仍按 id 和名字两头认，别塞出两套同名的。 */
    if(!this.data.items.length){
      this.data.items = [
        { id:'preset-light', name:'RP 明亮', source:'preset', mode:'light', colors:[], std:'gracol' },
        { id:'preset-dark', name:'RP 黑暗', source:'preset', mode:'dark', colors:[], std:'gracol' }
      ];
    }
    /* 色卡排在补完这两条预设之后：第一次开机要写的就是「一条不落地全进库」，
       明暗两套、从图里取的、手动设过的，全在这一趟里写进文件（第 8 条）。 */
    try{ await PalLib.boot(); }catch(e){ console.warn('色卡没认下来，先按存档里那份跑：' + ((e && e.message) || e)); }
    /* 色卡一条也没有（存档是空的、文件也读不回来）时不能碰 items[0] —— 那是 undefined，取 .id 就整个 init 抛出去 */
    if(this.data.items.length && !this.data.items.find(x => x.id === this.data.cur))
      this.data.cur = this.data.items[0].id;
  },
  /* 存：改过色卡（加一套、删一套、改名、改色号）之后都走这一条。
     PalLib 没就绪之前只落存档，免得把还没认完的文件原样写回去盖掉。 */
  save(){ PalLib.persist(); },
  get items(){ return this.data.items; },
  get cur(){ return this.data.items.find(x => x.id === this.data.cur) || this.data.items[0]; },
  select(id){
    this.data.cur = id; this.save(); Theme.apply(); Shell.refreshSoon(); Bus.emit('theme');
    /* 明暗那一轴（外13-M）：任何一条路挑中一套不归当前这一池的配色（新建了一套别的池的色、
       从图里取了一张深色图、手工改过 明暗 栏）都不许悄悄留着，就地按色调就近换回本池那套并说一句。
       开机那一路不触发：MING_AXIS 在 Ming.boot 落值之前是空串，那一趟不该拿还没定的轴去换色。 */
    if(MING_AXIS) { try{ Ming.check(); }catch(e){ console.error(e); } }
  },
  /* 新色号进色卡：同一组色已存在就复用那条，不重复建卡。
     #291 之后名字是色卡里的段名，撞名就等于两套并成一套 —— 进来先让名字不撞。 */
  record(entry){
    const same = this.data.items.find(x => Palette.sameRoles(x, entry));
    if(same) return same;
    const it = Object.assign({ id:Palette.newId(), source:'custom', locked:false }, entry);
    it.name = PalLib.ready ? PalLib.uniqueName(it.name) : (String(it.name || '').trim() || '未命名配色');
    this.data.items.push(it); this.save();
    return it;
  },
  /* id 必须带随机尾巴：一回批量收色是同步循环连着 record 的，只按 Date.now() 取名
     会让整批新卡撞成同一个 id —— 色卡里一选点亮一串，同 id 的其余张还点不动 */
  newId(){ return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); },
  /* 老数据里那批同 id 的配色就地重编；当前生效那条不动，免得看着像被换了配色 */
  dedupeIds(){
    const seen = new Set(); const fixed = [];
    for(const it of this.data.items){
      if(!seen.has(it.id)){ seen.add(it.id); continue; }
      it.id = this.newId(); while(seen.has(it.id)) it.id = this.newId();
      seen.add(it.id); fixed.push(it);
    }
    if(fixed.length) this.save();
    return fixed.length;
  },
  add(entry){ const it = this.record(entry); this.select(it.id); return it; },
  /* 删一套配色（外34 图2：「配色要允许删除」）。两道从前拦路的规矩一起撤了：
     ① 内置那两条不再免删（配套改在 init 那一段：预设只在色卡空着的时候补，删了就不会回来）；
     ② 指着这一套配色的外观方案不再留在半空 —— 从前只把「正在用的那一套」改口，
        于是删一次就把别的方案指没了，那些方案在两个池里都数不着（图13 那句「外观方案 1 套」就是这么来的）。 */
  remove(id){
    const it = this.data.items.find(x => x.id === id);
    if(!it || this.data.items.length < 2) return false;   /* 最后一套不许删：删光就没有可显示的颜色了 */
    const 同池 = Ming.pool(mingPoolOf(it)).filter(x => x.id !== id);
    const 换 = 同池[0] || this.data.items.find(x => x.id !== id);
    this.data.items = this.data.items.filter(x => x.id !== id);
    if(!this.data.items.find(x => x.id === this.data.cur)) this.data.cur = this.data.items[0].id;
    if(换) LookLib.repoint(it.name, 换.name);
    this.save(); return true;
  },
  /* 四个主角色（底/卡/文/强）当身份：预置方案与 RP 抓来的同一套主题不该占两个位子。
     用户输入颜色的先后不影响归属，所以比的是排序后的集合。 */
  roleHexes(e){
    if(e.mode !== 'custom'){
      const p = PRESETS[e.mode];
      return p ? [p['--page-bg'], p['--card-bg'], p['--text'], p['--accent']].map(x => x.toLowerCase()).sort() : null;
    }
    const h = Palette.hexesOf(e);
    return h.length >= 4 ? h.slice(0, 4).map(x => x.toLowerCase()).sort() : null;
  },
  /* 四个主角色（底/卡/文/强）当身份；色数不到 4 的（比如只给了两个色的简配方案）
     退一步比整套色号集合，不然每次重读都会多出一张重复卡 */
  sameRoles(a, b){
    const x = Palette.roleHexes(a), y = Palette.roleHexes(b);
    if(x && y) return x.join() === y.join();
    const p = Palette.hexesOf(a), q = Palette.hexesOf(b);
    return p.length === q.length && p.map(s => s.toLowerCase()).sort().join() === q.map(s => s.toLowerCase()).sort().join();
  },
  hexesOf(e){
    const out = [];
    for(const c of (e.colors || [])){
      const p = parseColor(c.raw, c.format || 'auto');
      if(!p) continue;
      const r = resolveColor(p, e.std || 'gracol');
      if(r) out.push(r.hex);
    }
    return out;
  },
  tokens(){ return tokensOf(this.cur); }
};

const Theme = {
  /* 这里只放全局观感；颜色本身归色卡。圆角两档：卡片和控件各一条，0~30px。
     font 是全站那一份字体：空字符串 = 用模板原本那套栈。
     这一串住在 appearance.json 的 look 那一节里，和色卡同一份文件（见 LookStore）。 */
  get cfg(){ return LookStore.data.look; },
  /* 背景那一张图（外29 丁组）：这一层现在只有一个来路 —— 方案从图片库里挑的那一张。
     从前它是「用户在设置里选一个文件，程序记下手柄，开机重新读成 blob 地址」，图不进程序、
     名字也不跟着方案走（换方案壁纸不换）。现在名字写在方案文件里、字节在 数据\images\ 里，
     地址和字节都由图片库那一头现给（和纹理那一批走的是同一张「名字 → 地址」的表）。
     wallUrl / wallBlob 这两个名字留着（壁纸那一层的样式、等效底复核、取色进色卡三处都在读），
     只是里头的内容改成由 wallSync() 从图库取 —— 换方案、换那一张图、图库文件动了，都走这一句。 */
  wallUrl:'', wallBlob:null,
  /* 地址这一半是同步的（图标那张表就在手边）：上色每一趟都要现读一次，方案换了当场跟上 */
  wallRead(){
    const t = ImgLib.find(this.cfg.wallImg || '');
    this.wallUrl = t ? imgUrl(t) : '';
    return this.wallUrl;
  },
  /* 字节这一半要 fetch 一跳（取色进色卡、糊完那一次等效底复核吃的是原图字节）：谁要用谁 await 这一句 */
  async wallSync(){
    const u = this.wallRead();
    this.wallBlob = u ? await imgBlob(ImgLib.find(this.cfg.wallImg || '')) : null;
    return u;
  },
  /* 开机这一趟只把存档读回来。背景那一张图不在这里定：图要先进图片库（ImgLib.boot）、
     方案要先进方案库（LookLib.boot），那两趟完事了才轮到 wallLift / wallSync（在 bootLibs 里）。 */
  async init(){
    await LookStore.load();
    document.documentElement.dataset.wall = this.cfg.wall;
  },
  /* 旧档案里挂着「普通图片 / 四方连续」那两层的手柄：把它们搬进图片库，接着交回方案那一栏。
     搬完就把手柄和存档里那两条名字一起抹掉 —— 屏幕上这一层从此只有一条路（图库），
     不留「旧手柄一套读法、图库另一套读法」。搬不动（文件被挪走 / 外置盘没插）也只抹掉名字，
     界面上那一档跟着退回没有这一层，不摆一条挑上什么都不铺的假名字。 */
  async wallLift(){
    for(const kind of ['wall', 'tile']){
      const key = kind + '-file';
      let hd = null;
      try{ hd = await IDB.get(META.db, META.store, key) || null; }catch(e){ hd = null; }
      const file = this.cfg[kind + 'File'];
      if(!hd && !file) continue;
      let name = '';
      if(hd && hd.getFile){
        try{
          const f = await hd.getFile();
          const ext = (/\.[a-z0-9]+$/i.exec(f.name || '') || ['.png'])[0].toLowerCase();
          const base = 'img-' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36) + ext;
          const put = await ImgLib.putBytes(base, new Uint8Array(await f.arrayBuffer()));
          if(put && put.ok !== false){
            /* 普通图片搬进去当背景图；四方连续那一层并进纹理（作者的话：纹理 / 四方连续图是同一样的东西） */
            name = ImgLib.add(String(f.name || '原来那张图').replace(/\.[^.]+$/, ''),
              base, kind === 'wall' ? '背景图' : '纹理·四方连续图', '');
          }
        }catch(e){}
      }
      try{ await IDB.del(META.db, META.store, key); }catch(e){}
      this.cfg[kind + 'File'] = '';
      if(name){
        const s = LookLib.get();
        if(s){
          if(kind === 'wall'){ s.背景图 = name; if(this.cfg.wall === 'image') this.cfg.wall = 'image'; }
          else { s.纹理 = name; s.texKey = imgKey((ImgLib.find(name) || {}).文件); if(this.cfg.wall === 'tile') this.cfg.wall = 'solid'; }
          LookLib.overwrite();
        }
        if(kind === 'wall') this.cfg.wallImg = name;
      } else if(kind === 'wall') this.cfg.wallImg = '';
      if(kind === 'tile'){ this.cfg.wall = this.cfg.wall === 'tile' ? 'solid' : this.cfg.wall; }
    }
    this.save();
    try{ await Ico.reloadList(); }catch(e){}
  },
  save(){ LookStore.save(); },
  /* 糊完那一次「等效底」复核：换图 / 拖模糊滑杆 / 换格位 / 调动子之后各跑一次。
     拿这条数只为说一句提示（卡面和壁纸差几个明度点、压在壁纸上的那两档字读不读得动），
     不拦任何操作 —— 文档第三节写死了：两条里任何一条不满足时，把「再糊一点」这条路继续留着，
     因为糊本身就是解决"图片太花、字读不动"的手段，拦下来等于把人往回赶。 */
  async wallRecheck(){
    const w = this.wallInfo;
    if(!w || !w.layer){ this.wallBase = null; return null; }
    /* 这一层只剩「一张背景图」一种铺法（四方连续那一档 2026-10-08 并进纹理了，
       屏幕上那一层由 --tex-* 那一串铺，见 sh-look.js），所以等效底量的就是这张图 cover 铺满整屏那一块 */
    this.wallBase = await Look.wallBase(this.wallUrl, w.blur, 'image', w.tint, this.dark(), 0);
    return this.wallBase;
  },
  /* ---------- 最小格位（外13-R D3-c）：四方连续壁纸 + 无缝纹理才有这一档 ----------
     基准由图源自己的比例定（1:1→1×1、4:3→4×3、16:9→16×9），只能按整数倍往上放大，
     倍数的顶 = 放到铺满整屏那一档。约分和档位表都在 sh-look.js（那边是真身），这一头只管取。
     图没读回来 / 纹理没铺时一律回 1×1，界面上那一行本来也不会摆出来。 */
  imgCellBase(url){
    return new Promise(res => {
      if(!url || typeof lookAspectCells !== 'function') return res({ w:1, h:1 });
      const im = new Image();
      im.onload = () => res(lookAspectCells(im.naturalWidth, im.naturalHeight));
      im.onerror = () => res({ w:1, h:1 });
      im.src = url;
    });
  },
  /* 一张图的格位档位表（1× 到铺满整屏）；UI 那一行要摆的就是这一串 */
  cellSteps(base){ return typeof lookCellSteps === 'function' ? lookCellSteps(base) : [base]; },
  setCell(kind, cell){
    this.cfg.texCell = cell;   /* 只剩纹理这一档有格位（四方连续那一档并进来了），存档里那个 tileCell 跟着撤 */
    this.save(); this.apply();
  },
  tokens(){ return Palette.tokens(); },
  /* 明暗判定（外13-A）：认的是「识别出来的背景」和「正文」这两块 WCAG 相对亮度谁高谁低 ——
     字比底亮就是黑暗系，字比底暗就是明亮系。不再拿背景自己的绝对亮度配一个阈值来猜：
     那一条在中明度的底上会猜反（背景 .21 的深蓝配白字明明是黑暗系，阈值那边算它是浅底）。
     两个数挨得太近、两头都说不准时这里不下结论，交给自检里那条对比下限去拦。
     规则只写在配色引擎那一份（sh-color.js 的 mingDark）里，这一头只管用，不再抄第二遍。 */
  dark(){
    const t = this.applied || this.tokens().tokens;
    return this.mingDark(t['--page-bg'], t['--text']) === 'dark';
  },
  /* 给定底色和文字色回 'dark' / 'light' / ''（'' = 两头都勉强，不硬判） */
  mingDark(bg, text){ return typeof mingDark === 'function' ? mingDark(bg, text) : ''; },
  /* 判定那一句话（界面和自检用）：底色对正文，说得出为什么 */
  mingDarkWhy(bg, text){ return typeof mingDarkWhy === 'function' ? mingDarkWhy(bg, text) : { k:'', why:'' }; },
  /* 切换识别方案：存档、配色引擎、重画一遍，三处一起走。
     传进来认不得的值由 setPalScheme 落回默认那一档（甲），存档跟着写那一个落回来的。 */
  setScheme(k){
    const real = (typeof setPalScheme === 'function') ? setPalScheme(k) : 'a';
    this.cfg.scheme = real;
    this.save(); this.apply();
    return real;
  },
  apply(){
    const t = Object.assign({}, this.tokens().tokens);
    /* 卡面是配色那张卡面掺过墨的那一块（掺多少由外观层定），和配色算对比时用的原始卡面
       不是一个色：字底下那块按 --face-solid 算，读不动的正文色和次正文色由 Look.readable 推回来
       （分工在 sh-look.js 里）。推完的这套色号记在 applied 上，往外递给为写的也是它，不是推之前的那份。
       钉在真根元素上 = 整张页都吃这一套，声笔输入法练习那一格也一样（2026-10-08「打字练习取消独立外观、
       独立字体设置，跟随全局外观、字体」；它从前在同一个位置重钉一份自己的色号，谁后跑谁赢）。 */
    const fix = Look.readable(t, this.cfg);
    if(fix) Object.assign(t, fix);
    this.applied = t;
    for(const k in t) document.documentElement.style.setProperty(k, t[k]);
    document.documentElement.style.setProperty('--radius-card', clampRadius(this.cfg.radiusCard) + 'px');
    document.documentElement.style.setProperty('--radius', clampRadius(this.cfg.radiusCtl) + 'px');
    /* 圆角就这一处真身：卡片一档、控件一档，其余名字（--r-card / --r-btn / --r-pill）全是这两个的别名。
       界面里所有两边相接形成角的位置——标签轮廓、chip、按钮、输入框、卡片、下拉、对话框、色块、
       进度条端头、分段控件、徽标、勾选框——都只吃这些名字，不许再写死 px。
       「胶囊」那一档以前钉死 99px，现在跟着控件那一档走：圆角归一个值，不再一半圆一半方。 */
    document.documentElement.style.setProperty('--r-card', clampRadius(this.cfg.radiusCard) + 'px');
    document.documentElement.style.setProperty('--r-btn', clampRadius(this.cfg.radiusCtl) + 'px');
    document.documentElement.style.setProperty('--r-pill', clampRadius(this.cfg.radiusCtl) + 'px');
    /* 全局字体：整站吃这一串，卡片自己钉过字体的在 cardFor 里覆盖掉 */
    /* 全局字体这一句是唯一的出口：按语言钉过的那几档排在最前（一个假名 + 每一条 @font-face
       自己的 unicode-range，浏览器按这个字落在哪一段自己挑），后面接这套方案钉的那一个，再接底子。
       卡片那一头读的还是同一个 --fd-font，不另起第二条路。 */
    document.documentElement.style.setProperty('--fd-font',
      Fonts.langStack(this.cfg.fontLangs, ffStack(this.cfg.font, FF_BASE_FD)));
    /* 等宽那一串也钉在根元素上：打字练习那一页的码号、公式、按键名吃的是这一个变量
       （它从前自己挂两个字体文件走 CustomENFont 那条路，2026-10-08 作者把那一摊撤了，跟着全局走）。 */
    document.documentElement.style.setProperty('--fd-mono', FF_MONO);
    /* 全局字重（外31 二组）：就写一个数，让浏览器自己挑这一家底下那一张真脸；
       没钉过就不写这一句 —— 样式表里那条兜底是 400（标准），跟着上面那个字体家走。
       写在这儿的值会被 body 那一条吃到，往下所有没自己写 font-weight 的地方都跟着变；
       自己写了 600 / 700 / 800 的那些（选中态、标题、统计数字）不吃这一句，它们照旧往上一层挑真脸。
       --fd-synth 跟着这一家底下真有几张脸走：不止一张就关掉假粗（往那一张更粗的真脸上挑），
       只有一张的留着假粗 —— 认的是本地字体清单（点「重读系统字体」才更新），清单没读到时按一张算，等于今天的样子。 */
    if(this.cfg.weight) document.documentElement.style.setProperty('--fd-weight', this.cfg.weight);
    else document.documentElement.style.removeProperty('--fd-weight');
    document.documentElement.style.setProperty('--fd-synth',
      Fonts.weightsOf(Fonts.nowFamily(this.cfg)).length > 1 ? 'none' : 'auto');
    /* 背景渐变（外13-R D3）：五档里的哪一档由这套配色自己认（带彩度的锚几个 / 色相跨度 / 明度跨度），
       用户在 设置·外观 里可以改口指定一档。认下来是「不给渐变」时背景按纯色铺 ——
       一套连深浅都没结论（或明度也拉不开）的配色，不该被硬拉出一条它自己不需要的光带；
       那一档此刻即便停在「渐变」上也不给它画一条假的，样式表按纯色走（data-wall 写成 solid）。
       停靠点全部取自这套已经派生出来的色号，每一点都复核过「不许把明暗结论翻面」（真身在 sh-look.js）。 */
    const gd = Look.grad(t, this.cfg);
    this.gradInfo = gd;
    document.documentElement.style.setProperty('--wall-grad', gd.image || 'none');
    document.documentElement.dataset.dark = this.dark() ? '1' : '0';
    /* 明暗那一轴（外13-M）：这一行钉的是「用户此刻要的是明亮还是黑暗」，
       和上面 data-dark（这套配色铺开之后看着是深是浅）不是一回事 —— 两者正常是一致的，
       真不一致只会在配色那头的 明暗 栏和这条轴挑的色卡对不上时出现，那种时候
       Ming.enforce 已经先把配色换成同池的那一套了。样式表目前不吃这个标记，留着它是要
       CSS 哪天按轴微调一处两处分得开明亮池和黑暗池，不必再往根上塞第二个名字。 */
    document.documentElement.dataset.ming = MING_AXIS || '';
    /* 背景这一层（外29 丁组）：一张图 center/cover 铺满 + 一根模糊 + 一根压暗提亮，
       全部由 Look.wallVars 现算成变量，样式表只吃变量。图归方案（从图片库里挑的那一张），
       这一头只管把名字换成地址。图库里那张读不回来时（文件被划掉、外置盘没插）按纯色铺：
       挂空的背景比朴素的纯色难看，也不给「渐变」那一档抢位置。 */
    /* 地址在这儿现读一遍（同步那半截）：方案刚换过 背景图 那一栏，屏幕上就得跟着换；
       字节那一半（wallBlob）留给取色和等效底那两趟异步去取（见 wallSync）。 */
    const has = this.cfg.wall === 'image' ? !!this.wallRead() : true;
    let wallKind = has ? this.cfg.wall : 'solid';
    if(wallKind === 'gradient' && gd.kind === 'none') wallKind = 'solid';
    document.documentElement.dataset.wall = wallKind;
    /* 渐变铺在哪几块面（外29 补充）：Flow-Desk 的背景，加上卡片展开之后那一张面，只这两块。
       缩小在首页的卡片不铺 —— 小卡底下已经压着整屏渐变，自己再来一条就叠成两层，字读不动。
       展开那一张画的不是把背景那一串照抄：是「先把页面底换成卡面，再照同一套规则算一遍」，
       于是每个停靠点都围着卡面那一个色挪，明暗那条复核比的也是字底下这一个方向 ——
       铺了渐变，字底下那块面的对比不会因为渐变而变差。背景此刻不铺渐变（纯色 / 图片 / 判成不给渐变），
       这一串就钉成 none，展开的卡片跟着回到实色。 */
    const face = t['--face-solid'] || t['--card-bg'];
    /* 形状由背景那一趟定下来再递过去：不递的话这一趟会拿卡面自己重判一次自动档 ——
       卡面和页面底本来就是「浮起来」那一点差，判出来的形状能跟背景错开（背景画明度微渐、卡片画同族线性），
       两块面各走各的，看着就是叠了一层对不上的渐变。 */
    const ccfg = Object.assign({}, this.cfg,
      { grad:Object.assign({}, this.cfg.grad, { kind:gd.kind }) });
    const cg = wallKind === 'gradient' && face ? Look.grad(Object.assign({}, t, { '--page-bg':face }), ccfg) : null;
    document.documentElement.style.setProperty('--card-grad', cg && cg.image ? cg.image : 'none');
    document.documentElement.dataset.cgrad = cg && cg.image ? 'on' : 'off';
    const wl = Look.wallVars(Object.assign({}, this.cfg, { wall:wallKind }), this.dark(),
      { wall:this.wallUrl });
    this.wallInfo = wl;
    for(const k in wl.vars) document.documentElement.style.setProperty(k, wl.vars[k]);
    /* 外观模式 + 纹理：排在配色之后写，这一句也顺手把 data-mode / data-tex 钉在根元素上。 */
    Look.apply(this.cfg);
    /* 标记色（外13-N）：排在所有派生之后原样重钉一遍。上面这一趟（tokens + Look.readable +
       Look.apply）算的全是 --slot-N 那一串，--mark-N 是用户自己在 设置·外观 里定的那一串色号，
       换配色 / 换外观模式 / 换明暗都不参与换算，这里只负责把它照存的本子再写一次。 */
    Marks.paintVars();
    /* 开着的代码框重新认一次明暗：着色两组挂在编辑器容器上，改类就够，不重建 */
    icodeRetone();
    this.pushToFrames();
  },
  refresh(){ Palette.save(); this.save(); this.apply(); Shell.render(); },
  /* 开着的展开页自己决定跟不跟：这里只播，不压。
     过去 FD 往 iframe 里塞一张 !important 样式表，和插件自己的配色互相顶，
     换色时看着就是卡顿、甚至没反应 —— 三层模型定死"取消 FD 对配色的跟随"。
     为写搬进这一张页之后（#343），再没有第二份文档：它的换色监听就挂在这同一个窗口上，
     就地发一遍才收得到。只在真开着为写那一格时发，不给页面留没用的消息。
     声笔输入法练习（打字练习）这一路外13-A 起已经断开：它不再收 FD 的配色，
     两边的接线（这一句的接收方、它那一侧的开关）都拆干净了，不再留半截。 */
  pushToFrames(){
    /* 播出去的是色号、两档圆角、字体和字体那张全局表。外观模式 / 纹理不在这一串里 ——
       为写拼在同一张页里之后，根元素就是这一个，宿主自己那一趟 Look.apply 已经钉好，
       它跟着吃就行，不需要也不该再收一份配置自己钉第二遍。 */
    const msg = { fd:'palette', id:Palette.data.cur, tokens:this.applied || this.tokens().tokens,
      radius:{ card:clampRadius(this.cfg.radiusCard), ctl:clampRadius(this.cfg.radiusCtl) },
      font:this.cfg.font || '', ff:Fonts.table(),
      /* 明暗那一轴（外13-M）：为写自己那一池配色要按同一条轴筛，所以轴本身也要递过去。
         递的是此刻落在界面上的那一个值（'' = 还没定下来），它那边认不到就按自己判的走。
         打字练习（声笔输入法练习）不收这一串 —— 它的配色从外13-A 起就归它自己管。 */
      ming:MING_AXIS || '' };
    if(this.openWnwRoot()){ try{ window.postMessage(msg, '*'); }catch(e){} }
  },
  /* 挂着内核的那一格：封面里、卡片里都算；一家也没有就回 null */
  openKernelRoot(){ return document.querySelector('#fdCoverBody .rp-root, #fdCoverBody .wnw-root, .fd-card .rp-root, .fd-card .wnw-root'); },
  /* 只认「为写」开着的那一格 —— FD 的配色现在只有它一家在跟。 */
  openWnwRoot(){ return document.querySelector('#fdCoverBody .wnw-root, .fd-card .wnw-root'); }
  /* 从前这里还有一条反向的路 Theme.scrapeRp()：把挂在封面上的声笔输入法练习那一层内联样式上的
     小企鹅皮肤色抓回来登记进全局色卡。件-9 整条撤下 Rime 配色，这条「收进来」的路跟着撤了 ——
     打字练习的配色归它自己管（外13-A），不该再往宿主这边灌。 */
};
function clampRadius(v){ return Math.max(0, Math.min(30, Math.round(+v || 0))); }
/* ============================================================
   标记色（外13-N · 2026-10-08 起住进方案）
   ----------
   用户在 设置 · 外观 · 方案编辑 里自己定的一串颜色：最少 3 个、最多 20 个，全局凡是「要挑一个标记色」的
   地方都吃这一串（写作器高亮、白板节点与连线、日程色条与标签、便签左边那一条、卡片的选项色）。
   ----------
   住哪儿：跟着方案走 —— 一串色号写在 数据\looks.yaml 里这一套方案的 标记色 那一栏。
   作者的话：「标记色改了，换方案标记色跟着换，只不过如果新的方案没有单独选择标记色，会沿用之前的标记色」。
   所以两条规矩：
     · 那一套自己钉过一串 → 换成它那一串；
     · 那一栏空着（没在那一套里单独选过）→ 屏幕上这一串一个字不动，接着用上一套的。
     沿用不是替他钉上：这一趟不写文件，等他在界面上真动了一笔（挑一个 / 加一个 / 改一个色号）才写进那一套。
   ----------
   不派生：界面上取的是 --mark-N，Marks.paintVars() 原样把他存的那一个色号写上根元素，
   不经过 deriveTokens / assignRoles / Look.readable 任何一条 —— 换配色、换外观模式、换明暗，
   重算的都是 --slot-N 那一串，--mark-N 还是那一个色号。
   自由设色（作者的话：「标记色可以取色器+色号自由设色」）：取色器、手写色号、从色卡挑三条路都开着。
   只有一条规矩留着：这一串里的色号不会因为当过标记色就自己跑进色卡 —— 要进色卡得他按「进色卡」那一句。
   ============================================================ */
const MARK_SEED_BACK = ['#3b6cb5', '#5ea36a', '#c1663f', '#8a5cb5', '#3a9aa3'];
/* 一串颜色 ↔ 存下来的那一节：只认合法色号、去重、封顶 MARK_MAX，别的一律丢掉不报错。
   从前这里还跟着一个「定色来路」（自由设色 / 从色卡选）的开关，那是我自己加的一档，作者没定过：
   2026-10-08 他明说「标记色可以取色器+色号自由设色，只不过标记色的色号不会自动进入色卡」，
   两条路本来就该同时开着，那一个开关整个作废 —— 存档里万一还留着 mode 那一格，读时照样忽略。 */
function marksNorm(m){
  const raw = m && Array.isArray(m.colors) ? m.colors : [];
  const out = [];
  for(const x of raw){
    const h = String(x || '').trim().toLowerCase();
    if(/^#[0-9a-f]{6}$/.test(h) && !out.includes(h)) out.push(h);
    if(out.length >= MARK_MAX) break;
  }
  return { colors:out };
}
const Marks = {
  /* 屏幕上此刻活着的那一串（唯一的真身在这一套方案文件的 标记色 那一栏；
     这一格只是它生效之后的那一份内存值，换方案、开机、他动一笔都往里落） */
  live:[],
  /* 当前这一串的色号（给组件那头经 window.FD_MARKS 问，也给自己写变量用）。
     还没定过的时候回空数组 —— 界面上退回配色的五个强调位，不硬造一套。 */
  hexes(){ return this.live.slice(); },
  count(){ return this.live.length; },
  slots(){ return markSlots(); },
  /* 正用着的这一套方案（文件还没认下来时回 null：那一趟界面上这一排锁着，不让他改一份读不着的东西） */
  scheme(){ return typeof LookLib !== 'undefined' && LookLib.ready ? LookLib.get() : null; },
  /* 落成一串生效值。写不写回方案文件由第二个参数说清楚：
     他在界面上动了一笔 = 写（钉进这一套方案的 标记色 那一栏）；
     换方案带的、开机认的 = 不写（沿用那一套没钉过的，不该悄悄替他钉上）。 */
  落成(list, 写回){
    const out = marksNorm({ colors:list }).colors;
    this.live = out;
    const s = this.scheme();
    if(写回 && s){ s.标记色 = out.slice(); try{ LookLib.saveNow(); }catch(e){} }
    this.paintVars(); Theme.apply(); Bus.emit('theme'); Shell.refreshSoon();
    return out;
  },
  /* 换方案那一趟叫的（LookLib.apply）：钉过就跟着换，空着就沿用现在这一串、一个字不写 */
  随方案(list){
    const out = marksNorm({ colors:list }).colors;
    if(!out.length) return false;
    this.落成(out, false);
    return true;
  },
  set(i, hex){
    const h = String(hex || '').trim().toLowerCase();
    if(!/^#[0-9a-f]{6}$/.test(h)) return false;
    if(i < 0 || i >= this.live.length) return false;
    const a = this.hexes(); a[i] = h;
    this.落成(a, true);
    return true;
  },
  add(hex){
    if(this.live.length >= MARK_MAX){ toast('标记色最多 ' + MARK_MAX + ' 个'); return false; }
    const h = /^#[0-9a-f]{6}$/i.test(String(hex || '')) ? String(hex).trim().toLowerCase() : this.nextHex();
    const a = this.hexes(); a.push(h);
    this.落成(a, true);
    return true;
  },
  remove(i){
    if(this.live.length <= MARK_MIN){ toast('标记色最少留 ' + MARK_MIN + ' 个'); return false; }
    const a = this.hexes(); a.splice(i, 1);
    this.落成(a, true);
    return true;
  },
  /* 加一个时给个起点色：从当前配色里挑一个还没用过的，全用过了就回第一个。
     可以递一份「这些别给」的名单 —— 添够再切 那一屏编的是他要切过去的那一套自己的那一串，
     不是屏幕上这一串，不给这一份名单它就会连着两次回同一个色（重色在这一串里是不成立的）。 */
  nextHex(排除){
    const pool = this.seedPool();
    const used = Array.isArray(排除) ? 排除 : this.hexes();
    return pool.find(h => !used.includes(h)) || pool[0] || MARK_SEED_BACK[0];
  },
  /* 种子和「照当前配色重取一遍」都问这里：当前这套配色派生出来的那五个强调位 */
  seedPool(){
    const t = (typeof tokensOf === 'function' && Palette.cur) ? tokensOf(Palette.cur).tokens : null;
    const hs = t ? [1, 2, 3, 4, 5].map(i => String(t['--slot-' + i] || '').toLowerCase()) : [];
    const ok = hs.filter(x => /^#[0-9a-f]{6}$/.test(x));
    return ok.length >= MARK_MIN ? ok : MARK_SEED_BACK.slice();
  },
  /* 开机（排在两份库都认下来之后、第一次上色之前）：三选一，从上往下认 ——
     1) 这一套方案自己钉过 → 用它那一串；
     2) 从前那一节（所有方案共用一串，住在外观存档顶上 marks）有值 → 认下来当沿用的那一串；
     3) 两头都没有（新机器）→ 照屏幕上正在用的那五个强调位落一串种子。
     认完把顶上那一节让位掉：从此前途只有方案文件那一条路，不留「方案一个串、存档顶上一个串」两个口径。
     方案文件这一趟没认下来（读不到 looks.yaml）时绝不动那一节 —— 抹了就是把他那一串真丢了。 */
  boot(){
    const s = this.scheme();
    const 顶上 = marksNorm(LookStore.data && LookStore.data.marks).colors;
    const 钉过 = s && Array.isArray(s.标记色) ? marksNorm({ colors:s.标记色 }).colors : [];
    let 起 = [];
    if(钉过.length) 起 = 钉过;
    else if(顶上.length) 起 = 顶上;
    else 起 = this.seedPool().slice(0, MARK_MAX);
    this.live = marksNorm({ colors:起 }).colors;
    if(s && LookStore.data && LookStore.data.marks){ LookStore.data.marks = null; LookStore.save(); }
    this.paintVars();
    return true;
  },
  /* 用户按的那一个：把这一串整个换成当前配色的强调位（写进这一套方案） */
  reseed(){ this.落成(this.seedPool().slice(0, MARK_MAX), true); },
  /* 写进根元素：用户存的那个色号原样写，不派生、不复检、不掺色。
     从前这里还跟着写一整套同伴档（--mark-N-dot / -bar / -bar-text / -cover / -cover-ink），
     算的是 Look.barTints 那一套，全代码却没有一处取值 —— 每次上色白算几十档对比度、
     往根元素多塞几十枚变量，外27 全清第 6、10 条把这一块和 markVar 的 kind 参数一起撤了。
     色位那一档的同伴（--slot-N-dot 等）由外观层 sh-look.js 照常算，那儿有人吃。 */
  paintVars(){
    const el = document.documentElement, hs = this.hexes();
    for(let i = 1; i <= MARK_MAX; i++){
      const name = '--mark-' + i, v = i <= hs.length ? hs[i - 1] : '';
      if(v) el.style.setProperty(name, v); else el.style.removeProperty(name);
    }
  },
};
/* 从前这儿还有一个 pool()：把每一套配色里出现过的色号全捞出来，当第二家候选和色卡并列摆着挑。
   2026-10-08 作者把那两家并成一家（原话：「不存在色卡池、配色库两个东西！这是一个东西！…统一一下，就叫色卡」），
   挑色那一屏从此只吃色卡那一份，这一头再没人叫 —— 整段撤。
   「照当前配色重取一遍」那一样另有 seedPool()（只取当前这套配色的五个强调位），和这一份不是一件事。 */
/* 递给这一张页里所有宿主和插件的通道（为写、日程、便签都问这一个，不各抄一份名单）。
   只读：写只走 设置 · 外观 那一档，别处改不了它。 */
window.FD_MARKS = {
  hexes:() => Marks.hexes(),
  count:() => Marks.count(),
  slots:() => Marks.slots(),
  min:MARK_MIN, max:MARK_MAX
};
/* ---------- 首帧前的一份配色 ----------
   为写在自己那一层打头要先画一帧：过去这一帧只能用模板里那套兜底色，等 Theme.init 读完存档、
   再等 FD 那边推过来的那一句才变成 FD 这一套 —— 明亮模式进为写就先黑一下，
   走的正是「兜底 → 自己池里那条 → FD 的」这两跳。
   搬进这一张页之后，它的开机那一段就在这同一个窗口里跑，起手同步调这个函数就能把色
   写在自己那一层身上，一跳都不多。
   postMessage 那条路照旧留着：那是换色时的增量推送，不是首帧。
   声笔输入法练习（打字练习）从外13-A 起不再问这两个入口，它那一页的配色由它自己出。 */
window.FD_PALETTE_SNAPSHOT = () => {
  const it = Palette.cur;
  if(!it) return null;
  return {
    id:Palette.data.cur,
    tokens:tokensOf(it).tokens,
    radius:{ card:clampRadius(Theme.cfg.radiusCard), ctl:clampRadius(Theme.cfg.radiusCtl) },
    font:Theme.cfg.font || '',
    ff:Fonts.table(),
    ming:MING_AXIS || ''            /* 外13-M：首帧就把轴递给为写，它不必等 postMessage 那一句 */
  };
};
/* ---------- 明暗那一轴（外13-M）· 界面这一头 ----------
   三档模式（跟随系统 / 按一日内时间切换 / 手动设置）落在这里，纯换算在文件上面那一段。
   这条轴只管「能挑哪些套配色、哪些外观方案」，配色本身长什么样还是色卡管。
   ----------
   为什么不轮询（这条有历史追责）：
     跟随系统 —— 开机问主进程一次（FD_APP.systemMing），往后只听它推的 ming:system 事件；
       主进程那侧是 nativeTheme.on('updated')，机器睡醒 / 解锁屏幕也由 powerMonitor 在那头
       同一条广播里推过来（页面这一侧不需要知道自己是不是刚从睡眠里回来）。
     按时间 —— 只排一个「离下一个换轴时刻还有多久」的 setTimeout，到点醒来重新算、重新排；
       睡醒那一路由上面那条广播领回来重算一次，所以中间睡掉几个小时也不会走偏。
   默认值为什么是「手动 + 初始值按当前这套配色的判定结果」，不是需求里那句「跟随系统」：
     他这机器上此刻正用自己挑好的那套配色。开机就跟随系统 = 第一次打开程序就把他挑的那套
     按另一池的名单换成颜色接近的那一套，屏幕当场变脸，而他没要求过这件事。
     默认手动 + 初始值现判，看到的东西和昨天一模一样；想跟随系统就在 设置 · 外观 里点一下，
     那里三档都在，一次点击的距离。这一条取舍写进了交付报告。
   ============================================================ */
const Ming = {
  sys:'',         /* 主进程报回来的系统那一轴：'light' / 'dark' / ''（还没问到 / 问不到） */
  axis:'',        /* 此刻落在界面上的那一轴 */
  why:'',         /* 这一轴是哪来的（界面那一行念给用户看） */
  note:'',        /* 最近一次跨池换色的说明（切过一次就摆在那儿，不静默） */
  timer:0,
  fans:[],
  get cfg(){ return LookStore.data.look; },
  save(){ LookStore.save(); },
  mode(){ const k = this.cfg.mingMode; return MING_MODES.some(x => x.k === k) ? k : 'manual'; },
  modeName(){ return (MING_MODES.find(x => x.k === this.mode()) || MING_MODES[2]).name; },
  pick(){ return this.cfg.mingPick === 'dark' ? 'dark' : 'light'; },
  timeOr(k, dflt){ const v = String(this.cfg[k] || '').trim(); return mingMinutes(v) === null ? dflt : v; },
  lightAt(){ return this.timeOr('mingLightAt', '06:30'); },
  darkAt(){ return this.timeOr('mingDarkAt', '18:30'); },
  /* 上一回落在界面上的那一轴：存档里那一份跨得开重启 */
  last(){ const v = this.axis || this.cfg.mingLast; return v === 'dark' || v === 'light' ? v : ''; },
  /* 这一档现在该是哪一轴 + 一句话说明（不含「当前配色不在这池里」那一层处理） */
  want(){
    const m = this.mode();
    if(m === 'manual') return { a:this.pick(), why:'手动设置的' };
    if(m === 'auto')
      return this.sys
        ? { a:this.sys, why:'系统此刻是' + MING_NAME[this.sys] }
        : { a:this.last() || this.pick(), why:'系统的深浅没问到（这一层不在的时候是正常的），先按上一回那一轴' };
    const a = mingTimeAt(Date.now(), this.lightAt(), this.darkAt());
    if(a) return { a, why:'此刻 ' + nowText() + '，在明亮段 ' + this.lightAt() + ' → ' + this.darkAt() + ' 里' };
    return { a:this.last() || this.pick(), why:'两个时刻设成了同一个，这一档整天不会换轴' };
  },
  /* 当前轴下的那一池配色 */
  pool(a){ const k = a || this.axis || this.want().a; return (Palette.items || []).filter(e => mingPoolOf(e) === k); },
  poolCount(a){ return this.pool(a).length; },
  /* 一套外观方案归哪一池（外34 图12）：方案自己写了 明暗 就照它钉住；
     写着「自动」或那一栏空着（老文件）才现算它 配色 指着的那套配色。
     两头都指不着的（配色 那一栏在色卡里找不到、又没钉死明暗）才不归任何一池 —— 判不出来就不硬判。 */
  lookPool(s){
    if(!s) return '';
    if(s.明暗 === '明亮') return 'light';
    if(s.明暗 === '黑暗') return 'dark';
    const e = (Palette.items || []).find(x => x.name === s.配色);
    return e ? mingPoolOf(e) : '';
  },
  lookPoolList(a){ const k = a || this.axis || ''; return (LookLib.list || []).filter(s => this.lookPool(s) === k); },
  /* 此刻正在用的那一套外观方案（按方案名认，段名就是身份） */
  curLook(){
    const n = LookLib.cur;
    return n ? (LookLib.list || []).find(x => x.方案名 === n) : null;
  },
  setMode(k){
    const m = MING_MODES.find(x => x.k === k); if(!m) return false;
    this.cfg.mingMode = k; this.save();
    return this.apply('模式改成「' + m.name + '」');
  },
  setPick(v){
    this.cfg.mingPick = v === 'dark' ? 'dark' : 'light'; this.save();
    return this.apply('手动定成' + MING_NAME[this.cfg.mingPick]);
  },
  setTime(k, v){
    if(mingMinutes(v) === null) return false;
    this.cfg[k] = v; this.save();
    return this.apply('换轴时刻改到 ' + v);
  },
  /* 跨池那一笔：正用的那套配色不属于新的那一池时，就近换一套并说清楚，不留跨池配色、不静默 */
  enforce(a){
    const cur = Palette.cur;
    if(!cur) return false;
    if(mingPoolOf(cur) === a) return false;
    const name = cur.name;
    const nt = mingNearest(Palette.items, cur, a);
    if(!nt){
      this.note = '切到' + MING_NAME[a] + '：这一池里一套配色也没有（色卡里 明暗 那一栏没有一条写着「'
        + MING_NAME[a] + '」），没有可换的目标，配色先原地不动。';
      toast(this.note, true);
      return false;
    }
    this.note = '切到' + MING_NAME[a] + '：正用的「' + name + '」不归这一池，已按色调就近换成同池的「' + nt.name + '」。';
    /* 当前那套外观方案 配色 那一栏还指着旧段名：跟着改口，否则下次挑回这套方案又把人拉回跨池那一套。
       只改这一栏的值，文件里那几条字段结构一个字不动。 */
    try{
      const s = this.curLook();
      if(s && s.配色 === name){ s.配色 = nt.name; LookLib.save(); }
    }catch(e){}
    Palette.select(nt.id);          /* 这一趟自己会上色、重排桌面、播给为写 */
    toast(this.note, true);
    return true;
  },
  /* 正在用的那一套外观方案本身也可能不归这一池：它 配色 那一栏指着另一池那套的时候，
     方案下拉按色卡筛就摆不出正在用的这一套（名单整个空掉），挑回它还会把人拉回另一池。
     这里把那一栏改成此刻在用的这一套（上面 enforce 已经保证它在池里），只改值不动字段结构。 */
  alignScheme(a){
    const s = this.curLook();
    if(!s || this.lookPool(s) === a) return false;
    const cur = Palette.cur;
    if(!cur || mingPoolOf(cur) !== a) return false;   /* 本池一套配色也没有、配色没换成功时不动方案 */
    const before = s.配色;
    s.配色 = cur.name;
    try{ LookLib.save(); }catch(e){}
    const add = '外观方案「' + s.方案名 + '」原来带着「' + before + '」，不归' + MING_NAME[a]
      + '这一池，已把它 配色 那一栏换成此刻在用的「' + cur.name + '」。';
    this.note = add;
    toast(add, true);
    return true;
  },
  /* 到点重排：只此一个定时器，模式不是「按时间」时它压根不存在 */
  arm(){
    clearTimeout(this.timer); this.timer = 0;
    if(this.mode() !== 'time') return;
    const w = mingNextMs(Date.now(), this.lightAt(), this.darkAt());
    if(!w) return;
    this.timer = setTimeout(() => { this.timer = 0; this.apply('时刻到了'); }, w);
  },
  /* 挑完一套配色之后补一句账（Palette.select 那一路叫的）：不归当前这一池就就近换回来。
     就近那一趟自己会再叫一次 select，第二次进来已经在池里，直接收住，不会绕圈。 */
  check(){ const a = this.axis || this.want().a; if(a && mingPoolOf(Palette.cur) !== a) this.enforce(a); },
  /* 把这一轴重新算一遍并落下去；返回有没有真的变 */
  apply(why){
    const w = this.want();
    if(!w.a){ this.arm(); return false; }
    const changed = this.axis !== w.a;
    this.axis = w.a; MING_AXIS = w.a; this.why = w.why;
    if(this.cfg.mingLast !== w.a){ this.cfg.mingLast = w.a; this.save(); }
    const moved = this.enforce(w.a);
    const aligned = this.alignScheme(w.a);
    this.arm();
    if(changed || moved || aligned){
      /* moved 那一趟 Palette.select 已经把上色、播给为写、重排桌面全走完了，这里不补第二遍；
         只换了轴、配色本来就在那一池里的时候才自己上色一趟（data-ming 这一记要重新钉） */
      if(!moved){ Theme.apply(); Bus.emit('theme'); }
      this.shout();
      Shell.refreshSoon();
    }
    if(changed) toast('界面切到' + MING_NAME[w.a] + '（' + this.modeName() + '：' + w.why + '）', true);
    return changed || moved || aligned;
  },
  /* 外观那一屏订这一头：到点 / 系统变了 / 跨池换了配色都要重画一遍，下拉名单跟着色卡走 */
  onChange(fn){ if(typeof fn === 'function') this.fans.push(fn); return () => { const i = this.fans.indexOf(fn); if(i >= 0) this.fans.splice(i, 1); }; },
  shout(){ for(const fn of this.fans.slice()){ try{ fn(); }catch(e){ console.error(e); } } },
  /* 系统那条广播：主进程一次开机问一次 + 之后 nativeTheme / powerMonitor 都推这一路 */
  onSystem(d){
    if(!d || typeof d.dark !== 'boolean') return;
    this.sys = d.dark ? 'dark' : 'light';
    /* 不跟随系统的时候也要走这一趟：睡醒 / 解锁那一路靠它把「按时间」那个定时器重新对齐 */
    this.apply(String(d.why || '') || '系统深浅变了');
  },
  async boot(){
    const c = this.cfg;
    /* 初始值：这一轴以前没有过（老存档升上来），按当前正在用的那套配色的判定结果落一次；
       判不准才兜回明亮 —— 和配色那头「别让人打不开设置」的兜底口径一致 */
    if(c.mingPick !== 'dark' && c.mingPick !== 'light'){
      c.mingPick = mingPoolOf(Palette.cur) || 'light';
      this.note = '这一轴第一次开：按正在用的「' + ((Palette.cur || {}).name || '') + '」判出 '
        + MING_NAME[c.mingPick] + '，先按手动设在 ' + MING_NAME[c.mingPick] + ' 落脚，屏幕看着和昨天一样。';
    }
    if(!c.mingMode) c.mingMode = 'manual';
    this.save();
    const A = window.FD_APP;
    if(A){
      if(typeof A.onSystemMing === 'function'){ try{ A.onSystemMing(d => this.onSystem(d)); }catch(e){} }
      if(typeof A.systemMing === 'function'){
        /* 问一次就收手：这一句排在开机那一路第一次上色之前，等它回话最多等一拍，
           问不到（不在 exe 里开）就安静按上一回那一轴走，不重试、不追问 */
        try{
          this.sys = await Promise.race([
            Promise.resolve(A.systemMing()).then(r => (r && typeof r.dark === 'boolean') ? (r.dark ? 'dark' : 'light') : ''),
            new Promise(res => setTimeout(() => res(''), 1200))
          ]);
        }catch(e){ this.sys = ''; }
      }
    }
    this.apply('开机');
    return this;
  }
};
/* 界面上念时刻用的（HH:MM，不吃系统区域设置） */
function nowText(){ const d = new Date(); const p = n => String(n).padStart(2, '0'); return p(d.getHours()) + ':' + p(d.getMinutes()); }
/* Rime 配色那台读取机（从前叫 RimeTheme：读 weasel yaml、记住选过的那个配色文件、开机自动重读）
   在 件-9 整条撤下 —— Flow-Desk 不再从小企鹅的预设配色表里往色卡灌东西，
   负责解析那份 yaml 的 _shared/sh-rime.js 也一并移出构建。
   底下 pickFile 是「从图取色」「铺壁纸」共用的，跟这条线无关，留着。 */
/* 选一个文件：拿得到 FileSystemFileHandle 就顺手存进 IndexedDB，下次开机不用再问。
   Flow-Desk 程序和本地开发那台服务器两种开法里 showOpenFilePicker 都可用；真没有就走 <input type=file>，只是记不住句柄。 */
async function pickFile(accept, id){
  const exts = Object.values(accept).flat().join(',');
  if(window.showOpenFilePicker){
    let hs;
    try{ hs = await showOpenFilePicker({ multiple:false, id, types:[{ description:'配色文件', accept }] }); }
    catch(e){ if(e && e.name === 'AbortError') return null; throw e; }
    if(!hs || !hs.length) return null;
    return { file: await hs[0].getFile(), handle: hs[0] };
  }
  return await new Promise(res => {
    const inp = h('input', { type:'file', accept:exts, hidden:true });
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      inp.remove(); res(f ? { file:f, handle:null } : null);
    });
    inp.addEventListener('cancel', () => { inp.remove(); res(null); });
    document.body.appendChild(inp);
    inp.click();
  });
}
/* 选多张图（外29 第 31 轮 · 色卡图批量取色那一路）：和上面那一条同一个 accept 写法，
   只是 multiple 放开、交回一个数组（取消就是空数组，调用方不必再判 null 和 length 两套）。
   没有 showOpenFilePicker 时兜底用 <input type=file multiple>：那种开法拿不到句柄，
   色号照采样，只是读不了图上印的那串字（OCR 要绝对路径）。 */
async function pickFiles(accept, id){
  const exts = Object.values(accept).flat().join(',');
  if(window.showOpenFilePicker){
    let hs;
    try{ hs = await showOpenFilePicker({ multiple:true, id, types:[{ description:'配色文件', accept }] }); }
    catch(e){ if(e && e.name === 'AbortError') return []; throw e; }
    const out = [];
    for(const x of (hs || [])) out.push({ file: await x.getFile(), handle:x });
    return out;
  }
  return await new Promise(res => {
    const inp = h('input', { type:'file', accept:exts, multiple:true, hidden:true });
    inp.addEventListener('change', () => {
      const 挑 = [...(inp.files || [])].map(f => ({ file:f, handle:null }));
      inp.remove(); res(挑);
    });
    inp.addEventListener('cancel', () => { inp.remove(); res([]); });
    document.body.appendChild(inp);
    inp.click();
  });
}
/* ---------- 背景图取色：缩到 64×64 数像素，取最肥的几桶 ---------- */
const ImageTheme = {
  async colors(file, want){
    const url = URL.createObjectURL(file);
    const img = new Image();
    try{
      await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('这张图读不出来')); img.src = url; });
    } finally{ setTimeout(() => URL.revokeObjectURL(url), 5000); }
    const N = 64, cv = document.createElement('canvas');
    cv.width = N; cv.height = N;
    const g = cv.getContext('2d', { willReadFrequently:true });
    g.drawImage(img, 0, 0, N, N);
    const d = g.getImageData(0, 0, N, N).data;
    const bins = new Map();
    let seen = 0;
    for(let i = 0; i < d.length; i += 4){
      if(d[i + 3] < 128) continue;
      seen++;
      const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
      const b = bins.get(key) || { n:0, r:0, g:0, bl:0 };
      b.n++; b.r += d[i]; b.g += d[i + 1]; b.bl += d[i + 2];
      bins.set(key, b);
    }
    const out = [];
    /* 缩放时色块边上会糊出一圈过渡色，占比不到 2% 的桶是糊出来的，不当主色 */
    for(const b of [...bins.values()].sort((x, y) => y.n - x.n)){
      if(b.n < seen * 0.02) break;
      const rgb = [b.r, b.g, b.bl].map(v => Math.round(v / b.n));
      const hex = CV.rgbHex(rgb);
      /* 相邻桶往往只差一点，离已选色太近的算同一个 */
      if(out.some(x => Math.hypot(...CV.hexRgb(x).map((v, i) => v - rgb[i])) < 46)) continue;
      out.push(hex);
      if(out.length >= (want || 5)) break;
    }
    return out;
  }
};
/* ---------- 色卡图：先数块，再按数取色 ----------
   色卡的照片好认的地方在于"块和块之间隔着纸"，所以第一步不是看颜色像不像，
   而是从图四周那一圈纸起把纸长大成一片，纸上剩下的每一块连通区就是**一个**色块，块数当场数出来；
   第二步才是每块取自己的众数色：块内按 4 一档分桶，占得最多那桶的平均色就是这块的颜色 ——
   块上印的深色字、色块里嵌的白孔都只是这一片里的零散像素，盖不住众数。
   过去这里加了一道"团内方差 >6 就整块扔掉"，小红书那种每块都印字的色卡就是这么丢的，已删。
   图上有字就交给 Windows 自带的离线 OCR 读回来，和采样色对得上就用印的色号，
   对不上（糊了、OCR 把 0 认成 O）就退回采样色并标一句「（采样）」。 */
const SwatchTheme = {
  SIDE: 900,     // 认色块用的图，最长边
  BG: 18,        // 纸的容差：相邻像素色差这么多以内算同一片纸，一层层长，顶得住照片四角发暗
  GAP: 26,       // 色块挨着色块（没纸可分）时，退回按色差分块的容差
  STEP: 14,      // 同上，但管"一步一步"：相邻像素色差超过这么多就断，五格相近的红不至于一路连成一格
  FLAT: 12,      // "平"的尺子：离这块起点色差这么小以内算同一个色
  EVEN: 0.55,    // 按色差分块那一趟：一块里至少 55% 的像素贴着起点色才算一块。
                 // 渐变照片的块是被 ±GAP 那圈色差框住的，天生只有约一半贴色，实测 0.48；
                 // 光照不匀的真色块实测 0.60~0.85，平色块 1.00。
  MIN: 0.0025,   // 一块至少占全图 0.25%（字上的笔画芯比这还小）
  THIN: 0.015,   // 一块最短边至少到图长边的 1.5%：渐变照片两端"烧成一片"的那条窄边就是这么来的
  FILL: 0.55,    // 块要"实"：至少占自己外接矩形的 55%，一行字是虚的、色块是实的
  DUP: 16,       // 两块离得这么近算同一个色（原来 46 会把一卡上相近的红色并掉；宁可多列一格也不漏块）
  CLOSE: 90,     // 印的色号换算出来离采样色多远还算对得上
  CAP: 24,       // 一张色卡最多收这么多块
  async bitmap(file, side){
    const url = URL.createObjectURL(file);
    const img = new Image();
    try{
      await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('这张图读不出来')); img.src = url; });
    } finally{ setTimeout(() => URL.revokeObjectURL(url), 5000); }
    const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
    const k = Math.min(1, (side || this.SIDE) / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * k)), h = Math.max(1, Math.round(ih * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d', { willReadFrequently:true });
    g.drawImage(img, 0, 0, w, h);
    return { d:g.getImageData(0, 0, w, h).data, w, h };
  },
  dist(a, b){ const x = CV.hexRgb(a), y = CV.hexRgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); },
  /* 纸：从四边同时往外长，每一步只和"刚收进来的那个像素"比色，所以白纸拍成渐变也连成一片。
     透明 PNG 的空底同样从边上长掉，不当色块。
     dom 是四边那一圈里"和这圈的中位色对得上"的比例 —— 不到一半就说明边上贴着的是好几块色，
     不是纸，这趟就不能用（否则第一块会被当成纸吃掉）。 */
  paper(im){
    const { d, w, h } = im, N = w * h;
    const bg = new Uint8Array(N), st = new Int32Array(N), ring = [];
    let head = 0, tail = 0;
    const push = p => { if(!bg[p]){ bg[p] = 1; st[tail++] = p; ring.push(p); } };
    for(let x = 0; x < w; x++){ push(x); push((h - 1) * w + x); }
    for(let y = 0; y < h; y++){ push(y * w); push(y * w + w - 1); }
    const same = (a, b) => Math.abs(d[a] - d[b]) <= this.BG && Math.abs(d[a + 1] - d[b + 1]) <= this.BG
      && Math.abs(d[a + 2] - d[b + 2]) <= this.BG && Math.abs(d[a + 3] - d[b + 3]) <= this.BG;
    while(head < tail){
      const p = st[head++], px = p % w, py = (p - px) / w, o = p * 4;
      if(px > 0 && !bg[p - 1] && same(o, o - 4)) push(p - 1);
      if(px + 1 < w && !bg[p + 1] && same(o, o + 4)) push(p + 1);
      if(py > 0 && !bg[p - w] && same(o, o - w * 4)) push(p - w);
      if(py + 1 < h && !bg[p + w] && same(o, o + w * 4)) push(p + w);
    }
    const mid = c => { const a = ring.map(p => d[p * 4 + c]).sort((x, y) => x - y); return a[a.length >> 1]; };
    const m0 = mid(0), m1 = mid(1), m2 = mid(2);
    let on = 0;
    for(const p of ring){ const o = p * 4;
      if(Math.abs(d[o] - m0) <= this.BG && Math.abs(d[o + 1] - m1) <= this.BG && Math.abs(d[o + 2] - m2) <= this.BG) on++; }
    return { mask:bg, share: tail / N, dom: on / ring.length };
  },
  /* 一遍扫描 + 手工栈把连通区数出来，顺手把外接框、众数桶、"平不平"攒着。
     byColor 那一趟才讲"像不像"：既要不离起点太远（GAP），也要一步一步长（STEP）——
     只看起点的话，一卡上挨着摆的五个相近的红会一路并成一个块。 */
  regions(im, skip, byColor){
    const { d, w, h } = im, N = w * h;
    const seen = new Uint8Array(N), st = new Int32Array(N), out = [];
    for(let s = 0; s < N; s++){
      if(seen[s] || skip[s]) continue;
      const o0 = s * 4;
      d._sr = d[o0]; d._sg = d[o0 + 1]; d._sb = d[o0 + 2]; d._sa = d[o0 + 3];
      const near = o => Math.abs(d[o] - d._sr) <= this.GAP && Math.abs(d[o + 1] - d._sg) <= this.GAP
        && Math.abs(d[o + 2] - d._sb) <= this.GAP && Math.abs(d[o + 3] - d._sa) <= this.GAP;
      const step = (o, q) => Math.abs(d[q] - d[o]) <= this.STEP && Math.abs(d[q + 1] - d[o + 1]) <= this.STEP
        && Math.abs(d[q + 2] - d[o + 2]) <= this.STEP && Math.abs(d[q + 3] - d[o + 3]) <= this.STEP;
      let head = 0, tail = 0, n = 0, sa = 0, sc = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
      const bins = new Map();
      seen[s] = 1; st[tail++] = s;
      while(head < tail){
        const p = st[head++], px = p % w, py = (p - px) / w, o = p * 4;
        n++; sa += d[o + 3];
        /* 离这块的起点色差多少：真正的色块整片都贴着一个色，渐变照片是一路滑过去的 */
        if(Math.abs(d[o] - d._sr) <= this.FLAT && Math.abs(d[o + 1] - d._sg) <= this.FLAT
          && Math.abs(d[o + 2] - d._sb) <= this.FLAT && Math.abs(d[o + 3] - d._sa) <= this.FLAT) sc++;
        if(px < x0) x0 = px; if(px > x1) x1 = px;
        if(py < y0) y0 = py; if(py > y1) y1 = py;
        const key = ((d[o] >> 2) << 12) | ((d[o + 1] >> 2) << 6) | (d[o + 2] >> 2);
        let bin = bins.get(key);
        if(!bin){ bin = [0, 0, 0, 0]; bins.set(key, bin); }
        bin[0]++; bin[1] += d[o]; bin[2] += d[o + 1]; bin[3] += d[o + 2];
        const grow = (q, qo) => { if(seen[q] || skip[q]) return; if(byColor && (!near(qo) || !step(o, qo))) return; seen[q] = 1; st[tail++] = q; };
        if(px > 0) grow(p - 1, o - 4);
        if(px + 1 < w) grow(p + 1, o + 4);
        if(py > 0) grow(p - w, o - w * 4);
        if(py + 1 < h) grow(p + w, o + w * 4);
      }
      let top = null;
      for(const bin of bins.values()) if(!top || bin[0] > top[0]) top = bin;
      out.push({ x:x0, y:y0, w:x1 - x0 + 1, h:y1 - y0 + 1, n,
        a:sa / n, share: top[0] / n, flat: sc / n,
        hex:CV.rgbHex([top[1], top[2], top[3]].map(v => Math.round(v / top[0]))) });
    }
    return out;
  },
  /* 数块 → 挑块。认得出纸的那一趟，一块是被纸围出来的，本身就是一块：
     光照不匀、块上印字都不该因此漏块（他这次报的就是漏块），只讲够不够大、够不够实。
     色块铺满整张图、纸认不出时退回按色差分块，那一趟没有纸做凭据，才加"平不平"这一道。 */
  blocks(im){
    const N = im.w * im.h, pp = this.paper(im);
    let list = pp.dom >= 0.5 ? this.regions(im, pp.mask, false) : [];
    const big = list.reduce((m, b) => Math.max(m, b.n), 0);
    /* 边上认不出纸（色块贴着图边铺满）、或者剩下的全连成了一大片 —— 退回按色差分块 */
    const cp = !list.length || pp.share < 0.1 || big > N * 0.7;
    if(cp) list = this.regions(im, new Uint8Array(N), true);
    /* 一整张图大半都落在"不平"的大片里 —— 这是渐变/照片，不是一块一块的色卡：
       它两端总会压出一小片看着很平的颜色（黑到发灰那几列），别拿它当一块报给用户。 */
    if(cp && list.reduce((s, b) => s + (b.flat < this.EVEN ? b.n : 0), 0) > N * 0.5) return [];
    const f = b => b.n >= N * this.MIN && b.a >= 128 && b.n / (b.w * b.h) >= this.FILL
      && Math.min(b.w, b.h) >= Math.max(im.w, im.h) * this.THIN;
    return list.filter(b => f(b) && (!cp || b.flat >= this.EVEN));
  },
  /* 阅读顺序：先按行分堆（竖直中心挨得够近算同一行），行内从左到右 */
  order(list){
    const rows = [];
    for(const b of list.slice().sort((x, y) => (x.y + x.h / 2) - (y.y + y.h / 2))){
      const cy = b.y + b.h / 2, r = rows[rows.length - 1];
      if(r && Math.abs(cy - r.cy) <= Math.max(b.h, r.hh) * 0.6){
        r.items.push(b); r.cy = (r.cy * (r.items.length - 1) + cy) / r.items.length;
        r.hh = Math.max(r.hh, b.h);
      } else rows.push({ items:[b], cy, hh:b.h });
    }
    const out = [];
    for(const r of rows) out.push.apply(out, r.items.sort((x, y) => x.x - y.x));
    return out;
  },
  tidy(list){
    const out = [];
    for(const b of list){
      if(out.some(x => this.dist(x.hex, b.hex) < this.DUP)) continue;
      out.push(b);
      if(out.length >= this.CAP) break;
    }
    return out;
  },
  /* 一行字里挑色号：整行先试，再一个词一个词试（逗号是 RGB 的写法，不切），
     最后再试一遍把 O/I 换回 0/1 的写法。色卡上同时印 RGB 和 CMYK 时取 RGB（屏幕上直接能用）；
     同一批里给了采样色就再挑贴它最近的那串 —— 一行既有编号又有 RGB 时不至于认错串。 */
  parse(txt, near){
    const t = String(txt || '').trim();
    if(!t) return null;
    const cand = [], seen = new Set();
    /* 拍摄日期、时间这类一串数字最容易被当成颜色，先挡掉 */
    const junk = /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4}|\d{1,2}:\d{2}(:\d{2})?)$/;
    const add = s => {
      if(!s || junk.test(s) || seen.has(s)) return;
      seen.add(s);
      /* 四个数一排、又没写 RGB 字样的，是 CMYK 不是色值前三位 */
      const nums = (s.match(/\d+(?:\.\d+)?/g) || []).length;
      const fmt = /^cmyk/i.test(s) || nums >= 4 ? 'cmyk' : 'auto';
      const p = parseColor(s, fmt);
      if(!p) return;
      const r = resolveColor(p, 'gracol');
      if(r && r.hex) cand.push({ raw:s, format:p.format, hex:r.hex });
    };
    add(t);
    for(const w of t.split(/[\s,;、|·]+/)) add(w);
    /* 逗号是 RGB 的写法本身（59,108,181），不能当分隔符切：再照「只按空格切」过一遍 */
    for(const w of t.split(/[\s;、|·]+/)){
      add(w);
      if(w) add(w.replace(/O/g, '0').replace(/[lI]/g, '1'));
    }
    for(const w of t.replace(/[()（）\[\]]/g, ' ').split(/[\s,;、|·]+/)){
      if(!w) continue;
      add(w.replace(/O/g, '0').replace(/[lI]/g, '1'));
    }
    /* 先按老规矩认 RGB 优先（色卡上两种都印时 RGB 是屏幕上直接能用的那个），
       同一种写法里再挑贴采样色最近的 —— 一行既有编号又有 RGB 时不至于认错串。 */
    const rgb = cand.filter(c => c.format === 'rgb');
    const pool = near ? (rgb.length ? rgb : cand) : cand;
    if(near && pool.length){
      let best = pool[0];
      for(const c of pool) if(this.dist(c.hex, near) < this.dist(best.hex, near)) best = c;
      return best;
    }
    return rgb[0] || cand[0] || null;
  },
  /* 两个矩形之间的距离：横竖分开算，某一侧重叠就是 0 */
  gap(a, b){
    const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
    const dy = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
    return Math.hypot(dx, dy);
  },
  label(b, lines){
    let best = null;
    for(const l of lines){
      const g = this.gap(b, l);
      if(g > Math.max(b.w, b.h) * 1.2) continue;
      const p = this.parse(l.t, b.hex);
      if(!p) continue;
      if(!best || g < best.g) best = { g, p, t:l.t };
    }
    return best;
  },
  /* 一条色卡图走完整套：认块 → 读字 → 对色号。path 是图片的绝对路径，没有就只采样 */
  async read(file, path){
    const im = await this.bitmap(file);
    const list = this.tidy(this.order(this.blocks(im)));
    let ocr = null, why = '';
    if(list.length && path && window.FD_APP && FD_APP.ocrSwatch) ocr = await FD_APP.ocrSwatch(path);
    if(path && !ocr) why = '没读图上的字';
    else if(ocr && !ocr.ok) why = ocr.msg || '读图上的字失败';
    else if(ocr) why = '';
    const lines = (ocr && ocr.ok ? (ocr.lines || []) : []).map(l => ({
      t:l.t, x:l.x * im.w / (ocr.ow || im.w), y:l.y * im.h / (ocr.oh || im.h),
      w:(l.w || 0) * im.w / (ocr.ow || im.w), h:(l.h || 0) * im.h / (ocr.oh || im.h)
    }));
    for(const b of list){
      const m = lines.length ? this.label(b, lines) : null;
      /* 图上印的那串和采样色对得上才敢用；差得远说明读糊了（或者色卡偏色），退回采样 */
      b.txt = m ? m.t : '';
      b.code = (m && this.dist(m.p.hex, b.hex) <= this.CLOSE) ? m.p.raw : '';
      b.format = m && b.code ? m.p.format : 'rgb';
      b.raw = b.code || b.hex;
    }
    return { list, im, why, ocr:!!(ocr && ocr.ok), lang:ocr && ocr.lang || '' };
  }
};

/* RP 侧将来若主动发消息，走这两个口子 */
addEventListener('message', ev => {
  const d = ev.data;
  if(!d || typeof d !== 'object') return;
  if(d.fd === 'pick' && Palette.items.some(x => x.id === d.id)) Palette.select(d.id);
});

/* ---------- 小工具 ---------- */
function h(tag, props, kids){
  const n = document.createElement(tag);
  if(props) for(const k in props){
    if(k === 'class') n.className = props[k];
    else if(k === 'style') n.style.cssText = props[k];
    else if(k === 'html') n.innerHTML = props[k];
    else if(k.startsWith('on')) n.addEventListener(k.slice(2), props[k]);
    else if(k === 'checked' || k === 'disabled' || k === 'selected' || k === 'value' || k === 'indeterminate') n[k] = props[k];
    /* 界面文字清单（批⑤-6）：悬停说明和输入框里的灰字先过一道 Txt ——
       没改过就是原句，一次查表都不多做；顺手把当前页名钉在 data-txp 上，清单按页分着改字才认得准 */
    else if(k === 'title' || k === 'placeholder') n.setAttribute(k, Txt.out(props[k]));
    else if(props[k] !== undefined && props[k] !== null) n.setAttribute(k, props[k]);
  }
  if(Txt.pageNow) n.setAttribute('data-txp', Txt.pageNow);
  (Array.isArray(kids) ? kids : kids === undefined || kids === null ? [] : [kids]).forEach(c => {
    if(c === null || c === undefined || c === false) return;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return n;
}
let toastTimer = null;
function toast(msg, urgent){
  const t = document.getElementById('toast');
  /* 弹出来的短句得让读屏器收得到（WCAG 4.1.3 状态消息，走查 AA-5）：
     模板里那个节点写的是 aria-live="polite"，删掉一类「等念完再说就晚了」的句子临时换成 assertive。
     换属性要在填字之前换，填完再换浏览器就不一定补念这一句了。 */
  t.setAttribute('aria-live', urgent ? 'assertive' : 'polite');
  /* 界面文字清单：弹出来的短句先过一道 Txt，清单里写过的那句在这儿换 */
  t.textContent = Txt.out(msg); t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
}
/* ---------- 界面文字清单的宿主接线（批⑤-6） ----------
   清单在 数据\ui-text.yaml：按「程序 · 页名」分段，段里一行一个地方，冒号左边是原来的字，右边写你要的字。
   Flow-Desk 程序里读写都问主进程（那边还盯着文件，一改就广播给几个程序一起换字）；
   本地开发那台服务器没有主进程这一层，就直接向服务器要这一份明文 —— 它发的还是 数据\ 里那一个文件。 */
Txt.use({
  prog:'Flow-Desk',
  read(){ return window.FD_APP && window.FD_APP.uiTextRead ? window.FD_APP.uiTextRead() : null; },
  write(t){ return window.FD_APP && window.FD_APP.uiTextWrite ? window.FD_APP.uiTextWrite(t) : { ok:false, msg:'这台机器没连上磁盘' }; },
  open(){ return window.FD_APP && window.FD_APP.uiTextOpen ? window.FD_APP.uiTextOpen() : { ok:false, msg:'要在程序里才打得开' }; },
  plan(){ return window.FD_APP && window.FD_APP.uiTextPlan ? window.FD_APP.uiTextPlan() : null; },
  apply(list){ return window.FD_APP && window.FD_APP.uiTextApply ? window.FD_APP.uiTextApply(list) : null; },
  reload(){ return Txt.reload(); },
  onChange(fn){ return window.FD_APP && window.FD_APP.onUiText ? window.FD_APP.onUiText(fn) : null; }
});
/* ---------- 卡片大小清单的宿主接线（#251） ----------
   清单在 数据\card-size.yaml：一张卡片两行，「出厂」是源码现在给的大小，「你要」写你要的大小。
   和界面文字同一套：程序里读写都问主进程（那边盯着文件，一改就广播过来）；
   本地开发那台服务器没有这一层，就直接向服务器要这一份明文，读的都是 数据\ 里那一个文件。 */
SizeList.use({
  read(){ return window.FD_APP && window.FD_APP.cardSizeRead ? window.FD_APP.cardSizeRead() : null; },
  write(t){ return window.FD_APP && window.FD_APP.cardSizeWrite ? window.FD_APP.cardSizeWrite(t) : { ok:false, msg:'这台机器没连上磁盘' }; },
  plan(){ return window.FD_APP && window.FD_APP.cardSizePlan ? window.FD_APP.cardSizePlan() : null; },
  apply(list){ return window.FD_APP && window.FD_APP.cardSizeApply ? window.FD_APP.cardSizeApply(list) : null; },
  reload(){ return SizeList.reload(); },
  onChange(fn){ return window.FD_APP && window.FD_APP.onCardSize ? window.FD_APP.onCardSize(fn) : null; }
});
/* 第 7 条：提示文字被框子切掉时，鼠标扫过给个原生 tooltip 看全文。
   文案不压短、框子不拉长 —— 装不下还是省略号收着，全文靠悬停。
   挂文档上统一处理，各视图不用每处自己记得写 title；自己写过说明的地方不覆盖。
   音乐控件、字体选择器、词库列表这些 _shared 的东西在 FD 卡片里也是这套类名，一起收进来。 */
const TIP_SEL = '.fd-hint,.tx,.nm,.ttl,.sub,.fd-addpick span,.mu-t,.mu-a,.mu-src,.mu-dirpath,.ff-cur,.ff-nm,.sh-tn .nm,[style*="text-overflow"]';
addEventListener('mouseover', ev => {
  const el = ev.target && ev.target.closest ? ev.target.closest(TIP_SEL) : null;
  if(!el) return;
  const full = (el.textContent || el.value || '').trim();
  if(!full) return;
  if(el.scrollWidth > el.clientWidth + 1){ if(!el.title) el.title = full; }
  else if(el.title === full) el.removeAttribute('title');
}, true);
/* ---------- 第 24 条：Ctrl/⌘+S 手动保存 ----------
   和 WNW 同一个口径：不挨个记谁要保存，从焦点往上找头一个装着「保存」那个按钮的容器
   （卡片、对话框、覆盖层都算一层），替用户把它按下去。
   弹层开着时优先弹层；再没有就找当前正在编辑的那张卡。
   卡片里挂内核的那两格（为写、声笔输入法练习）是各自的一份页面，那边的 Ctrl+S 由它们自己接。
   这一个只在窗口有焦点时管用 —— 程序不抢后台全局快捷键，见设置的「快捷键」那档。 */
const SAVE_TXT = /^(保存|保 存)$/;
function saveBtnAt(node){
  if(!node || !node.querySelectorAll) return null;
  for(const b of node.querySelectorAll('button'))
    if(!b.disabled && b.offsetParent && SAVE_TXT.test((b.textContent || '').trim())) return b;
  return null;
}
function saveBtnNow(){
  let el = document.activeElement;
  for(let i = 0; el && el !== document.body && i < 14; el = el.parentElement, i++){
    const hit = saveBtnAt(el);
    if(hit) return hit;
  }
  const m = document.getElementById('fdModal');
  if(m && !m.hidden){ const hit = saveBtnAt(m); if(hit) return hit; }
  const c = document.getElementById('fdCover');
  if(c && !c.hidden){ const hit = saveBtnAt(c); if(hit) return hit; }
  return null;
}
addEventListener('keydown', ev => {
  if(ev.isComposing || ev.keyCode === 229) return;
  if(!(ev.ctrlKey || ev.metaKey) || ev.altKey || ev.shiftKey) return;
  if(String(ev.key || '').toLowerCase() !== 's') return;
  if(ev.defaultPrevented) return;
  const b = saveBtnNow();
  if(!b) return;
  ev.preventDefault();
  b.click();
});
function esc(s){ return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
const pad2 = n => String(n).padStart(2, '0');
function fmtDate(d){ return d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate()); }
function parseDate(s){ const [y,m,d] = String(s).split('-').map(Number); return new Date(y, (m||1)-1, d||1); }
function addDays(d, n){ const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
function weekOfYear(d){
  const t = new Date(d.getTime()); t.setHours(0,0,0,0);
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const first = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t - first)/86400000 - 3 + ((first.getDay() + 6) % 7)) / 7);
}

/* ---------- 覆盖层 ---------- */
const Cover = {
  onClose:null,
  needRender:false,
  openNode(title, node, onClose){
    const body = document.getElementById('fdCoverBody');
    body.innerHTML = ''; body.appendChild(node); this.begin(title, onClose);
    /* 从前这里挂着四拍（0 / 500 / 1500 / 3000 毫秒）：等声笔输入法练习在那一层把小企鹅皮肤画完，
       再把那一整套色抓进全局色卡。件-9 整条撤下 Rime 配色，这四拍没有别的事要干，跟着撤了 ——
       打字练习的配色从外13-A 起就归它自己管，宿主这边只播出去、不收回来。 */
  },
  begin(title, onClose){
    this.onClose = onClose || null;
    document.getElementById('fdCoverTitle').textContent = title;
    document.getElementById('fdCover').hidden = false;
    Shell.dimTop();          /* 封面开着就是"这一张卡当屏"，顶栏那两块跟着退一层 */
  },
  close(){
    const cov = document.getElementById('fdCover');
    cov.hidden = true;
    Shell.dimTop();          /* 封面收了，顶栏那两块回到前面来 */
    /* 竖带那一档是开封面那一家留下的，关了就摘掉：下一家（为写整页）不该接着用 */
    cov.classList.remove('fd-cover-band');
    document.getElementById('fdCoverBody').innerHTML = '';
    /* 封面挡着的时候换过色，卡片没重建，这会儿补上 */
    if(this.needRender){ this.needRender = false; this.render(); }
    if(this.onClose) { const f = this.onClose; this.onClose = null; f(); }
  }
};

/* 放大视图有两种宿主：卡片撑到 25% 页面后直接嵌在卡里，⛶ 打开的封面要自己留边 */
const FULL_STYLE = 'height:100%;min-height:0;display:flex;flex-direction:column;gap:10px';
function coverWrap(node){ return h('div', { style:'height:100%;display:flex;flex-direction:column;padding:16px 20px' }, node); }

/* ---------- 弹窗 ----------
   FD 只有一层弹窗：后开的会顶掉前一个。after 记下"关掉这个之后回到哪儿"，
   这样从设置里点「新建一套」，不管按取消还是 ✕，都能回到设置面板而不是掉回桌面。 */
const Modal = {
  after:null,
  /* 打开对话框之前焦点落在那一个上，关掉就还回那一个（无障碍走查 C-2） */
  lastFocus:null,
  /* 关这一张面板之前要不要问一句：设置那一屏带着没存进方案的改动时，由它挂一个函数进来。
     requestClose() 是「用户那头」的关法（右上角关闭、完成、Esc），会先走这一句；
     close() 是给内部用的（确认框自己关掉自己），不拦 —— 不然拦套拦，出不来。 */
  guard:null,
  requestClose(){
    const g = this.guard;
    if(!g){ this.close(); return; }
    g(() => { this.guard = null; this.close(); });
  },
  /* 一层套一层：底下那一栏连同它的关闭回调一起收进 stack，关掉上面这层就原样还回去。
     还的是活节点（不是重新解析的 HTML），所以列表里的按钮、滚动位置都还在。 */
  stack:[],
  open(title, body, foot, onClosed, opt){
    const d = document.getElementById('fdDialog'), m = document.getElementById('fdModal');
    /* 先照老规矩把当前这一份（连同它的尺寸档位）收进 stack，再抹掉档位：
       上一次留下的尺寸不抹的话，子对话框（比如从设置里点「色卡图」）会顶着 1080×680 开 */
    const had = { vwide:d.classList.contains('vwide'), set:d.classList.contains('set') };
    /* redraw：还是这一张面板，只是内容整个重画（组件定制改一下参数就整块重建）。
       这种一律不当成「又开了一层」：既不往 stack 里堆那份过期的（不然改几回就要按几回关闭，
       每按一回还退回一张旧草稿），也不许像 replace 那样把底下那层一起扔掉（底下是设置面板）。 */
    const isRedraw = !!(opt && opt.redraw) && !m.hidden && d.childNodes.length;
    if(isRedraw){
      /* 什么都不做，下面直接拿新的顶上去：还是这一张面板，连「关掉之前问一句」那一层也不动 */
    }
    else {
      if(!m.hidden && d.childNodes.length){
        if(opt && opt.replace) this.stack.length = 0;    /* 重开同一张列表：旧那份过期了，不还 */
        else this.stack.push({ kids:[...d.childNodes], vwide:had.vwide, set:had.set, after:this.after, guard:this.guard, focus:this.lastFocus });
      }
      this.guard = (opt && opt.guard) || null;
    }
    /* 记住走进来这一刻焦点在哪个上，关掉时还回哪儿（无障碍走查 C-2 / WCAG 2.4.3）。
       套一层时这个就在底下那张面板里，而 stack 还的是同一批活节点，引用不断。 */
    if(!isRedraw) this.lastFocus = document.activeElement;
    d.classList.remove('vwide', 'set');
    this.after = onClosed || null;
    d.innerHTML = '';
    /* vwide 只有组件定制用：词库编辑器、生成库那些对话框宽度照旧，别跟着变 */
    d.classList.toggle('vwide', !!(opt && opt.vwide));
    /* set 只有设置用：定死 1080×680，切标签时窗口不跟着内容长短抖 */
    d.classList.toggle('set', !!(opt && opt.set));
    d.appendChild(h('div', { class:'fd-dialog-head' }, [h('span', { id:'fd-dialog-title' }, title), h('span',{class:'sp'}),
      h('button', { class:'fd-tool w-txt', html:icoMarkup('close') + '关闭', onclick:() => Modal.requestClose() })]));
    /* 这是模态框就得说得出来（WCAG 4.1.2，走查 A-3）：从前这一层就是个 DIV，
       读屏器走到里面也不知道自己在一个弹窗上、更不知道这个弹窗叫什么。
       名字指着标题那句，靠 aria-labelledby 关联，不再抄一份文字。 */
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-modal', 'true');
    d.setAttribute('aria-labelledby', 'fd-dialog-title');
    d.appendChild(h('div', { class:'fd-dialog-body' }, body));
    if(foot) d.appendChild(h('div', { class:'fd-dialog-foot' }, foot));
    m.hidden = false;
    /* 后面那页在对话框开着的时候不参与键盘：Tab 走不出去，读屏器也读不到（2.1.2）。
       #fdModal 和 toast 这两个除外 —— toast 是弹短句的落点，冻住它就没声了。 */
    this.setBackground(true);
    const first = this.focusables()[0];
    if(first) first.focus();
  },
  /* 对话框里能按的按 Tab 顺序排出来：隐藏的先去掉，disabled 的、写了 tabindex="-1" 的不要 */
  focusables(){
    const d = document.getElementById('fdDialog');
    return [...d.querySelectorAll('a[href],button,input,select,textarea,[tabindex],[contenteditable="true"]')]
      .filter(n => !n.disabled && n.getAttribute('tabindex') !== '-1' && (n.offsetWidth || n.offsetHeight));
  },
  setBackground(v){
    for(const n of document.body.children){
      if(n.id === 'fdModal' || n.id === 'toast') continue;
      if(v) n.setAttribute('inert', '');
      else n.removeAttribute('inert');
    }
  },
  /* Tab 走到最后一个就绕回第一个，反向同理。绑在 #fdDialog 这一个固定节点上，
     内容整块重画也不用重新绑（无障碍走查 C-2）。 */
  trap(e){
    if(e.key !== 'Tab') return;
    const list = this.focusables();
    if(!list.length){ e.preventDefault(); return; }
    const first = list[0], last = list[list.length - 1], cur = document.activeElement;
    const out = !document.getElementById('fdDialog').contains(cur);
    if(e.shiftKey){ if(cur === first || out){ e.preventDefault(); last.focus(); } }
    else if(cur === last || out){ e.preventDefault(); first.focus(); }
  },
  close(){
    const d = document.getElementById('fdDialog'), p = this.stack.pop();
    const f = this.after;
    this.after = p ? p.after : null;
    this.guard = p ? p.guard : null;    /* 上面那层对话框关掉，底下这张面板的「关之前问一句」要跟着回来 */
    d.innerHTML = '';
    if(p){
      p.kids.forEach(k => d.appendChild(k));
      d.classList.toggle('vwide', p.vwide);
      d.classList.toggle('set', !!p.set);
    } else {
      document.getElementById('fdModal').hidden = true;
      this.setBackground(false);
    }
    /* 焦点回到走进来之前的那一个（无障碍走查 C-2 / WCAG 2.4.3）：
       · 底下还有面板 —— 回到「打开上面这层的那一个」，它就在恢复出来的那张面板里；
         那一个已经不在了（列表重画过）才退到面板里第一个，不让焦点掉到页面上无处可去；
       · 这是最后一层 —— 还连得上就还给走进来之前的那个（顶栏那个按钮），
         还连不上（比如是从卡片里打开、卡片已经被删掉）就不硬抢，焦点留在页面上随它去。 */
    const back = this.lastFocus;
    this.lastFocus = p ? p.focus : null;
    if(!document.getElementById('fdModal').hidden)
      (back && back.isConnected && d.contains(back) ? back : this.focusables()[0])?.focus();
    else if(back && back.isConnected) back.focus();
    if(f) f();
  }
};
document.getElementById('fdDialog').addEventListener('keydown', e => Modal.trap(e));

/* 删之前问一句：全站共用这一张「请确认」小框，问话的排版和那两个钮只在这一处定形状。
   接口是等回来的那种 —— after 回调在 ✕ / 取消 / 确认任何一条关法上都会走一回，
   没按确认就等回 false，删的那一笔不往下走。 */
function fdAsk(q, yes){
  return new Promise(res => {
    let v = false;
    Modal.open('请确认', h('div', { style:'line-height:1.8;white-space:pre-wrap' }, q), [
      h('button', { class:'fd-btn', onclick:() => Modal.close() }, '取消'),
      h('button', { class:'fd-btn primary', onclick:() => { v = true; Modal.close(); } }, yes || '删除')
    ], () => res(v));
  });
}

/* ---------- 组件注册表 ---------- */
const Registry = new Map();
/* 出厂那一份另存一格：改代码重载会重新注册、顶掉 Registry 里的，改代码的预置要看的是前者 */
const WIDGET_BASE = new Map();
function registerWidget(def){
  /* def: {id,name,noTitle,minW,minH,def:{w,h},expand(ctx),mount(el,ctx)} */
  if(!def.id || !def.mount) throw new Error('widget 定义不完整：' + def.id);
  def.def = def.def || { w:5, h:3 };
  def.minW = def.minW || 1; def.minH = def.minH || 1;
  /* 卡片大小清单（#251）：记下出厂默认，清单里这张卡片改了大小就当场盖上去 */
  try{ if(typeof SizeList !== 'undefined') SizeList.register(def); }catch(e){}
  Registry.set(def.id, def);
  if(!WIDGET_BASE.has(def.id)) WIDGET_BASE.set(def.id, def);
}
function widgetBase(id){ return WIDGET_BASE.get(id); }

const Bus = {
  map:{},
  on(k, fn){ (this.map[k] = this.map[k] || []).push(fn); },
  emit(k, data){ (this.map[k] || []).forEach(fn => { try{ fn(data); }catch(e){ console.error(e); } }); }
};

/* ---------- 外壳 ---------- */
const Shell = {
  layout:{ items:[] },
  mounted:new Map(),
  cellW:60, cellH:57, gap:10,
  async init(){
    injectShellCss();
    this.layout = await Store.loadJSON('layout.json', { items:[] });
    if(!this.layout.items.length) this.layout.items = this.firstRunCards();
    /* 包 id 改名那趟搬家要在「认不出的卡就剪掉」之前跑，不然旧名那几张会被当成卸了包直接抹掉 */
    this.改名搬家();
    /* 卸掉的包那段代码已经不在产物里了，桌上那张卡也就没了 */
    this.pruneMissing();
    /* v0.1 的 size 档位制作废，缺显式坐标的一律重新落位 */
    if(this.layout.items.some(it => typeof it.x !== 'number')) this.autoPlaceAll();
    this.mergeDupWidgets();
    this.migrateWnwCard();
    Store.saveJSON('layout.json', this.layout);
    this.render();
    this.bindTop();
    this.tickClock(); setInterval(() => this.tickClock(), 30000);
    addEventListener('resize', () => { this.fitGrid(); });
  },
  /* 全新桌面摆哪几张卡：外壳不认识任何一个插件的名字，只问说明书 ——
     包在 manifest 里写了 first（一个序号）就说明它要求出厂摆一张，按序号排下来。
     说明书是空的（没走构建、直接翻源码看的那一回）退回注册表顺序，别把桌面开成一片白。
     卸载掉的包不在说明书里，自然也就不会自己长回来。 */
  firstRunCards(){
    const want = Packs.list().filter(m => typeof m.first === 'number')
      .sort((a, b) => a.first - b.first);
    if(!want.length) return [...Registry.keys()].map(w => ({ id:w, widget:w }));
    const out = [];
    for(const m of want){
      const w = Registry.has(m.id) ? m.id : (Registry.has('tool-' + m.id) ? 'tool-' + m.id : null);
      if(w) out.push({ id:m.id, widget:w });
    }
    return out;
  },
  /* 桌面不留孤卡：包卸了，那张卡对应的定义就不在产物里了 */
  pruneMissing(){
    const keep = this.layout.items.filter(it => Registry.has(it.widget));
    if(keep.length !== this.layout.items.length) this.layout.items = keep;
  },
  autoPlaceAll(){
    const keep = this.layout.items; this.layout.items = [];
    for(const it of keep){
      const def = Registry.get(it.widget); if(!def) continue;
      const r = this.firstFit((def.def && def.def.w) || 5, (def.def && def.def.h) || 3);
      if(!r) continue;
      it.x = r.x; it.y = r.y; it.w = r.w; it.h = r.h; delete it.size;
      this.layout.items.push(it);
    }
  },
  /* 一类只留一张：老布局里同插件的重复卡合并掉，位置取第一张，数据文件不动 */
  mergeDupWidgets(){
    const seen = new Set();
    const keep = this.layout.items.filter(it => {
      if(seen.has(it.widget)) return false;
      seen.add(it.widget); return true;
    });
    if(keep.length !== this.layout.items.length) this.layout.items = keep;
  },
  /* 包 id 搬家那一张表（同步 GitHub 第 3 条 · 2026-10-09 定「改程序、代码命名（本体名字和各处引用）」）。
     表由生成那一趟写在页顶（var PACK_RENAME，真身在 src\_build\pack-rename.mjs，node 那头
     src\_tools\rename-packs.mjs 共用同一份），这一趟只动桌面上那个 widget 名：
     · 卡片号 it.id 一个字不动 —— 那是宿主发的号，组件按「id 打头」那一条认自己的表单键，
       动它就要动 IndexedDB 里那一堆键，而那棵树在程序外面量不到（探针里读不出键名），
       所以号留着旧前缀，widget 换新的：两边都还在，谁也不用猜。
     · tool- 那一档跟着换（工具卡的名字是 'tool-' + id 现拼的，见 fd8-tools.js）。
     · 只搬一次，记在设置里；搬之前先确认新名字注册得上、旧名字已经没了 ——
       旧名字还注册着就说明那一家没搬走（有人手动放回了旧包），这一趟不动它。
     kv / 表单键这一趟不用搬：现场量过，六家组件没有一家写 ctx.kv（0 处），
     唯一用 ctx.state 的是音乐遥控器那 16 处，键全是 music-* 打头，和包名无关。 */
  改名搬家(){
    if(Settings.get('packRenameDone', false)) return 0;
    const 表 = (typeof PACK_RENAME === 'object' && PACK_RENAME) || {};
    let 搬 = 0;
    for(const it of this.layout.items || []){
      const 旧 = String(it.widget || '');
      const 是工具 = 旧.startsWith('tool-');
      const 新名 = 表[是工具 ? 旧.slice(5) : 旧];
      if(!新名) continue;                       /* 不在表上的名字不归这一趟管 */
      if(Registry.has(旧)) continue;            /* 旧名字还注册着 = 那一家没搬走，别替人做决定 */
      const 新 = 是工具 ? 'tool-' + 新名 : 新名;
      if(!Registry.has(新)) continue;           /* 新的这一家没装进来，下面 pruneMissing 会按卸载处理 */
      it.widget = 新; 搬++;
    }
    if(搬) console.log('包 id 搬家：' + 搬 + ' 张卡的组件名换到新 id');
    Settings.set('packRenameDone', true);
    return 搬;
  },
  /* 老布局补一张 WNW 启动卡：只补一次，之后用户自己删掉就不会再回来。
     这张卡如今也是可选的包，产物里没有它（注册表认不出）就别硬补，顺手把这一步记成已办。 */
  migrateWnwCard(){
    if(Settings.get('wnwCardDone', false)) return;
    if(!Registry.has('why-not-write')){ Settings.set('wnwCardDone', true); return; }
    if(this.layout.items.some(it => it.widget === 'why-not-write')){ Settings.set('wnwCardDone', true); return; }
    const r = this.firstFit(5, 2);
    if(!r) return;
    this.layout.items.push(Object.assign({ id:'why-not-write-' + Date.now().toString(36),
      widget:'why-not-write', slot:this.layout.items.length % 5 }, r));
    Settings.set('wnwCardDone', true);
  },
  rect(it){ return { x:it.x, y:it.y, w:it.w, h:it.h }; },
  hits(a, b){ return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; },
  fits(rect, self){
    if(rect.x < 0 || rect.y < 0 || rect.w < 1 || rect.h < 1) return false;
    if(rect.x + rect.w > GRID_COLS || rect.y + rect.h > GRID_ROWS) return false;
    return !this.layout.items.some(it => it !== self && this.hits(rect, this.rect(it)));
  },
  /* 从左上往右下找第一块放得下的空地 */
  firstFit(w, h){
    for(let y = 0; y + h <= GRID_ROWS; y++)
      for(let x = 0; x + w <= GRID_COLS; x++){
        const r = { x, y, w, h };
        if(!this.layout.items.some(it => this.hits(r, this.rect(it)))) return r;
      }
    return null;
  },
  /* 落点被占了不再回弹（外34 第 1 条，他的原话：「我希望是真正的 Flow-Desk，所有卡片可以自由移动」）。
     规矩：先按落点把别的卡分成两堆 —— 没压着的原地不动（它们连自己那块地方都保得住），
     压着的那几张才让路：沿挤得最浅那条边推开（推的距离正好等于重叠的那几格）；
     四条边都被已定的块或桌面边界堵死，才从左上往右下找第一块空地（半格一口，和拖拽同一把尺）；
     连空地都没有就整单作废。先静后动这一趟定下来，后让的只往「已定」那一堆外面看，所以一趟就再无重叠。 */
  让位(rect, self){
    const 定 = [{ x:rect.x, y:rect.y, w:rect.w, h:rect.h }];
    const 动 = [];
    const 别 = this.layout.items.filter(it => it !== self).sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const 挡 = 别.filter(it => this.hits(定[0], this.rect(it)));
    for(const it of 别) if(挡.indexOf(it) < 0) 定.push(this.rect(it));
    for(const it of 挡){
      const r = this.rect(it);
      const 推 = this.推开(r, 定);
      if(!推) return null;
      定.push(推);
      if(推.x !== r.x || 推.y !== r.y) 动.push({ it, x:推.x, y:推.y });
    }
    return 动;
  },
  在界内(r){ return r.x >= 0 && r.y >= 0 && r.w >= 1 && r.h >= 1 && r.x + r.w <= GRID_COLS && r.y + r.h <= GRID_ROWS; },
  /* 四个方向各试一次，取推得最少那一条；都不通再找第一块空地 */
  推开(r, 定){
    const 挡 = 定.find(o => this.hits(r, o));
    const 净 = c => this.在界内(c) && 定.every(o => !this.hits(c, o));
    if(!挡) return 净(r) ? r : null;
    const 路 = [
      { x:r.x - ((r.x + r.w) - 挡.x), y:r.y }, { x:r.x + ((挡.x + 挡.w) - r.x), y:r.y },
      { x:r.x, y:r.y - ((r.y + r.h) - 挡.y) }, { x:r.x, y:r.y + ((挡.y + 挡.h) - r.y) }
    ].map(p => ({ x:p.x, y:p.y, w:r.w, h:r.h }))
     .filter(净)
     .sort((a, b) => (Math.abs(a.x - r.x) + Math.abs(a.y - r.y)) - (Math.abs(b.x - r.x) + Math.abs(b.y - r.y)));
    if(路.length) return 路[0];
    for(let y = 0; y + r.h <= GRID_ROWS; y += 0.5)
      for(let x = 0; x + r.w <= GRID_COLS; x += 0.5){
        const c = { x, y, w:r.w, h:r.h };
        if(净(c)) return c;
      }
    return null;
  },
  /* 拖出桌面以外：位置夹回来，尺寸削到桌面装得下（最小一格不动） */
  夹进(rect){
    const w = Math.min(rect.w, GRID_COLS), h = Math.min(rect.h, GRID_ROWS);
    return { x: Math.max(0, Math.min(rect.x, GRID_COLS - w)), y: Math.max(0, Math.min(rect.y, GRID_ROWS - h)), w, h };
  },
  /* 页面尺寸检测：格子边长 = 可用区 / 64 × 36，字号跟短边走 */
  fitGrid(){
    const g = document.getElementById('fdGrid');
    const top = document.querySelector('.fd-top');
    const r = document.documentElement.style;
    if(top) r.setProperty('--top-h', top.offsetHeight + 'px');
    const W = g.clientWidth, H = g.clientHeight;
    if(!(W > 320 && H > 240)) return;
    /* 四边各留 1 格，而且四边是同一个数（外32 图8）。
       从前这一档横着按 --cw 留、竖着按 --ch 留，各留半格 —— 格子本身两轴就不等边，
       窗口一拉长（500×1400 探针实测：--cw 7.692、--ch 37.838）上边那条缝就成了左边的 4.9 倍：
       左边量出来 5.9 像素 = 0.76 格，上边 20.9 像素 = 2.7 格，这就是他报的「便签 1 格、日程 3 格」，
       也是「横版正常、拉长成竖版就放不过去」的那一条 —— 横版两轴接近等边，两句才看不出来。
       现在先按短的那一轴定出一格的边长（两轴都留得下 GRID_PAD 格的那个），四边一律留它，
       剩下的再摊给 64×36：卡片占满整轴时上下左右各剩 一格 + 半个间距，不再看窗口是横是竖。 */
    const 外留 = Math.min(W / (GRID_COLS + GRID_PAD * 2), H / (GRID_ROWS + GRID_PAD * 2));
    this.cellW = (W - 外留 * 2) / GRID_COLS; this.cellH = (H - 外留 * 2) / GRID_ROWS;
    /* 间距归这一套方案（2026-10-08 作者的话：「为方案设置数据：圆角、间距数据」）：
       从前这一档读的是机器存档顶上那一个 gapFd，所有方案共用一根滑杆 —— 换方案不换间距，
       和两档圆角不是同一个待遇。现在只读方案生效下来的那一个数：0 = 跟着格子短边现算。 */
    const 钉死 = lookGap(Theme.cfg.gap);
    this.gap = 钉死 > 0 ? 钉死 : Math.max(4, Math.min(18, Math.round(Math.min(this.cellW, this.cellH) * .16)));
    r.setProperty('--cw', this.cellW.toFixed(3) + 'px');
    r.setProperty('--ch', this.cellH.toFixed(3) + 'px');
    r.setProperty('--pad-x', 外留.toFixed(3) + 'px');
    r.setProperty('--pad-y', 外留.toFixed(3) + 'px');
    r.setProperty('--gap', this.gap + 'px');
    r.setProperty('--gap-half', (this.gap / 2) + 'px');
    r.setProperty('--vsc', Math.min(1.25, Math.max(.85, Math.min(this.cellW, this.cellH) / VSC_BASE)).toFixed(3));
  },
  bindTop(){
    Title.mount();
    document.getElementById('fdAddBtn').onclick = () => this.pickWidget();
    document.getElementById('fdSetBtn').onclick = () => openSettings();
    document.getElementById('fdCoverClose').onclick = () => Cover.close();
    document.getElementById('fdCoverReload').onclick = () => {
      /* 封面里挂的是内核（为写 / 声笔输入法练习）时，「重新载入」就是把它原地拆了再开一次：
         start 收到同一个容器会先拆干净，等于从前那一下 iframe 刷新。别的组件（便签、日程这些）
         本来就没有第二份文档要刷，这一个对它们不动作。 */
      const node = Theme.openKernelRoot();
      if(!node) return;
      const rp = node.closest('.rp-root') || node.querySelector('.rp-root');
      const wnw = node.closest('.wnw-root') || node.querySelector('.wnw-root');
      const k = rp ? window.RP_KERNEL : wnw ? window.WNW_KERNEL : null;
      const host = rp || wnw;
      if(!k || !host || !k.running()) return;
      try{ Promise.resolve(k.start(host)).catch(e => toast('重新载入没走通：' + ((e && e.message) || e))); }
      catch(e){ toast('重新载入没走通：' + ((e && e.message) || e)); }
    };
    /* 遮罩上点一下不再关窗。留着这条的话，在输入框里往边上拖选文字、手一抖出了面板，
       浏览器把 click 发给按下和抬起两个点的共同上级（就是遮罩本身），窗口当场没了 ——
       日程填写框「一选中就自己退出」就是这个。出口只留三个：面板上的「关闭」，
       和页脚各自的「取消」「保存」。Esc 是键盘上主动按的，跟手滑无关，照旧能关。 */
    addEventListener('keydown', e => { if(e.key === 'Escape'){ if(!document.getElementById('fdModal').hidden) Modal.requestClose(); else if(!document.getElementById('fdCover').hidden) Cover.close(); } });
  },
  tickClock(){
    const d = new Date();
    const wk = Settings.get('weekStart', 1);
    const names = ['日','一','二','三','四','五','六'];
    document.getElementById('fdWhen').innerHTML =
      '<b>' + d.getFullYear() + ' 年 ' + (d.getMonth()+1) + ' 月 ' + d.getDate() + ' 日</b>' +
      (Settings.get('showWeek', true) ? ' 第 ' + weekOfYear(d) + ' 周' : '') + ' 星期' + names[d.getDay()] +
      ' · ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    void wk;
  },
  itemById(iid){ return this.layout.items.find(x => x.id === iid); },
  save(){ Store.saveJSON('layout.json', this.layout); },
  /* 换色 / 换圆角不必把整页卡片重建一遍：颜色全走 CSS 变量，重建只是为了让极少数
     在建卡时算死的尺寸重新量一次。拖滑块时每帧重建就是原来那个"卡顿"的根源。
     封面开着的时候首页看不见，先记一笔，关掉封面再补。 */
  refreshSoon(){
    clearTimeout(Shell._rt);
    Shell._rt = setTimeout(() => {
      if(!document.getElementById('fdCover').hidden){ Cover.needRender = true; return; }
      Shell.render();
    }, 120);
  },
  render(){
    const g = document.getElementById('fdGrid');
    this.fitGrid();
    this.mounted.forEach((m, iid) => { if(m.unmount) { try{ m.unmount(); }catch(e){} } });
    this.mounted.clear(); g.innerHTML = '';
    const guides = h('div', { class:'fd-guides' });
    g.appendChild(guides);
    for(const it of this.layout.items){
      const def = Registry.get(it.widget);
      if(!def) continue;
      g.appendChild(this.cardFor(it, def));
    }
    this.dimTop();
    this.fitGrid();
  },
  /* 图14：有卡片展开的时候，顶栏「Flow-Desk」那一块糊一层，让这一张卡当屏。
     重画每一趟、封面开开关关都过这里，所以三个口子一处不漏：render() 末尾、Cover.begin、Cover.close。 */
  dimTop(){
    const top = document.querySelector('.fd-top');
    if(!top) return;
    const cov = document.getElementById('fdCover');
    /* 展开的是哪一档，量的是界面此刻真是什么状态：封面（⛶ 打开的那一层）开着，或者哪一张卡自己带了 .expanded。
       从前这一条判的是「卡片占够 576 格」（64×36 的四分之一），拿出厂那七种大小代进去、最大的一张才 192 格 ——
       这条路一辈子走不到，样式白写着；而探针是自己把 class 挂上去再量计算值的，所以年年 PASS。 */
    const on = (!!cov && cov.hidden === false) || !!document.querySelector('.fd-card.expanded');
    top.classList.toggle('dim', on);
  },
  cardFor(it, def){
    const slotIdx = (it.slot || 0) % 5 + 1;
    const expanded = isExpanded(def, it);
    /* 没有标题的两种：noTitle 连左右内边距一起摊平，
       noName 只是不写名字，正文照旧留呼吸。
       两种都不占一行高度 —— 标题条浮在卡面上，鼠标进来才露那几个按钮。 */
    const bare = def.noTitle || def.noName;
    const card = h('section', { class:'fd-card' + (def.noTitle ? ' notitle' : def.noName ? ' noname' : '') + (expanded ? ' expanded' : ''),
      'data-iid':it.id, style:'--slot:var(--slot-' + slotIdx + '-dot,var(--slot-' + slotIdx + '))' });
    this.place(card, it);
    const tools = [
      h('button', { class:'fd-tool', title:'换强调色', html:icoMarkup('slot'), onclick:() => { it.slot = ((it.slot || 0) + 1) % 5; this.save(); this.render(); } })
    ];
    if(def.expand && !expanded) tools.push(h('button', { class:'fd-tool', title:'放大', html:icoMarkup('expand'), onclick:() => def.expand(this.ctxFor(it)) }));
    /* 每张卡顶上这几个编辑钮：改代码（铅笔图标，配方开「组件定制」，内置直接改这一家自己的 main.js）、
       设置（齿轮图标，只有说明书点了 settings 的那几家才有 —— 插件的设置回归插件自己，不再垫在「设置 · 组件」那一页）、
       词库（牌堆图标，改这个功能用的词库）。WNW 停靠标题条上同名几个，两端对等。 */
    const cid = String(def.id).startsWith('tool-') ? def.id.slice(5) : def.id;
    const setter = def.settings || (typeof TOOL_DEFS !== 'undefined' && TOOL_DEFS.get(cid) && TOOL_DEFS.get(cid).settings);
    const edits = [
      (typeof codeEntry === 'function') ? codeEntry(cid, 'fd-tool', 'pencil', '改代码 · 「' + def.name + '」',
        () => { if(typeof GenWizard !== 'undefined') GenWizard.onSaved = () => this.render(); }) : null,
      (PACK_META[cid] && PACK_META[cid].settings && typeof setter === 'function')
        ? h('button', { class:'fd-tool', title:'设置 · 「' + def.name + '」', html:icoMarkup('gear'),
            onclick:() => setter(PackLoader.ctxOf(cid) || PackCtx.make(cid)) }) : null,
      (typeof toolBankWhich === 'function' && toolBankWhich(cid) && typeof BankDlg !== 'undefined')
        ? h('button', { class:'fd-tool', title:'改「' + def.name + '」用的词库', html:icoMarkup('bank'),
            onclick:() => BankDlg.open(toolBankWhich(cid)) }) : null
    ].filter(Boolean);
    if(edits.length) tools.unshift(...edits);
    /* 每张卡一个字体钮（A 带挑脚的图标）：跟着 FD 就用全局那一款，关掉自己挑 */
    tools.push(h('button', { class:'fd-tool', title:'字体 · ' + (this.fontOf(it) || '跟随 Flow-Desk'),
      html:icoMarkup('font'), onclick:() => this.fontDlg(it) }));
    tools.push(h('button', { class:'fd-tool', title:'从桌上撤下这张卡（插件本身还在，数据和设置都不动 · 想卸掉它去「添加插件」里按卸掉）', html:icoMarkup('close'), onclick:async () => {
      if(!await fdAsk('撤下「' + def.name + '」这张卡？只是从桌上拿走 —— 插件本身还在，这一家的数据和设置都不动。\n想卸掉它，去「添加插件」里按卸掉。', '撤下')) return;
      this.layout.items = this.layout.items.filter(x => x.id !== it.id); this.save(); this.render();
    } }));
    if(bare) card.appendChild(h('div', { class:'fd-card-head float' }, [h('span',{class:'sp'}), h('span',{class:'fd-card-tools'}, tools)]));
    else card.appendChild(h('div', { class:'fd-card-head' }, [h('span',{class:'dot'}), h('span',{class:'ttl'},def.name), h('span',{class:'sp'}), h('span',{class:'fd-card-tools'}, tools)]));
    const body = h('div', { class:'fd-card-body' });
    card.appendChild(body);
    const ff = this.fontOf(it);
    if(ff) card.style.fontFamily = ffStack(ff, FF_BASE_FD);
    /* 内容缩到 9px 还塞不下时，这道渐隐告诉你下面还有东西 */
    card.appendChild(h('div', { class:'fd-cut' }));
    for(const dir of ['nw','ne','sw','se'])
      card.appendChild(h('i', { class:'fd-grip', 'data-dir':dir, title:'拖动调整大小' }));
    const api = def.mount(body, this.ctxFor(it, expanded)) || {};
    this.mounted.set(it.id, api);
    this.bindDrag(card, it, def);
    return card;
  },
  /* 这张卡实际用的字体：跟随 FD 时回空串，让 body 那一条继承下来 */
  fontOf(it){ return it.fontFollow === false && it.font ? it.font : ''; },
  fontDlg(it){
    const body = h('div', { style:'display:grid;gap:14px;min-width:min(560px,86vw)' });
    const fol = h('input', { type:'checkbox' });
    fol.checked = it.fontFollow !== false;
    const zone = h('div', {});
    const draw = () => {
      zone.innerHTML = '';
      if(fol.checked) zone.appendChild(h('div', { class:'fd-hint' }, '现在用的是 Flow-Desk 全局字体：' + (Theme.cfg.font || 'Flow-Desk 默认')));
      else zone.appendChild(Fonts.field({
        label:'这张卡', value:it.font || '', dflt:'跟随 Flow-Desk 全局（' + (Theme.cfg.font || '默认') + '）',
        onSet:f => { it.font = f; this.save(); this.render(); }
      }));
    };
    fol.addEventListener('change', () => {
      it.fontFollow = fol.checked;
      if(!fol.checked && !it.font) it.font = Theme.cfg.font || '';
      this.save(); this.render(); draw();
    });
    body.appendChild(h('label', { style:'display:flex;gap:8px;align-items:center;cursor:pointer' },
      [fol, h('span', {}, '跟随 Flow-Desk 全局字体')]));
    body.appendChild(zone);
    draw();
    Modal.open('这张卡的字体', body, [h('button', { class:'fd-btn primary', onclick:() => Modal.close() }, '好')]);
  },
  place(card, it){
    card.style.left = 'calc(' + it.x + ' * var(--cw) + var(--gap-half) + var(--pad-x, 0px))';
    card.style.top = 'calc(' + it.y + ' * var(--ch) + var(--gap-half) + var(--pad-y, 0px))';
    card.style.width = 'calc(' + it.w + ' * var(--cw) - var(--gap))';
    card.style.height = 'calc(' + it.h + ' * var(--ch) - var(--gap))';
    /* 影子的大小跟着这一张卡自己走：三档高度的偏移和模糊都乘这个系数（sh-look.js 里那条 calc）。
       从前小卡和大卡吃同一串绝对像素，两格见方的卡顶着一层 10px 偏移、24px 模糊的大晕，
       那就是「小卡顶着一层大晕」的一半原因。边长四格上下算满，越小收得越多。 */
    const side = Math.max(2, Math.min(it.w, it.h));
    card.style.setProperty('--ck', Math.max(.5, Math.min(1, (side - 2) / 3)).toFixed(2));
  },
  /* 组件请求改变自身高度（日程 6 行月要长到 9 格），只在放得下时生效 */
  setHeight(it, h){
    if(it.h === h) return h;
    const r = { x:it.x, y:it.y, w:it.w, h };
    if(!this.fits(r, it)) return it.h;
    it.h = h; this.save();
    const card = document.querySelector('.fd-card[data-iid="' + CSS.escape(it.id) + '"]');
    if(card) this.place(card, it);
    return h;
  },
  ctxFor(it, expanded){
    const shell = this;
    return {
      item:it, expanded:!!expanded, get layout(){ return shell.layout; }, saveLayout(){ shell.save(); shell.render(); },
      setHeight:(n) => shell.setHeight(it, n),
      store:Store, theme:Theme, palette:Palette, bus:Bus, toast, settings:Settings,
      modal:Modal, addDays, fmtDate, parseDate
    };
  },
  /* ---------- 拖拽：整卡长按 180ms 才起拖（抬起+阴影加深作反馈），四角手柄立刻缩放，松手吸附格边，重叠回弹 ---------- */
  bindDrag(card, it, def){
    const shell = this;
    const minW = def.minW, minH = def.minH;
    card.addEventListener('pointerdown', ev => {
      if(ev.button !== 0) return;
      const grip = ev.target.closest('.fd-grip');
      if(ev.target.closest('.fd-card-tools')) return;
      /* 组件里声明了 data-nograb 的那一块（音乐控件的进度条）按下去只归插件自己，
         连长按计时都不起 —— 免得拖到 180ms 卡片跟着跑。四角手柄不算，照样能拖。 */
      if(!grip && ev.target.closest('[data-nograb]')) return;
      /* 输入框里是光标和选字，永远不抢；按钮和链接铺满卡面（启动卡就是整张卡就是一个按钮），
         所以照样起长按计时，只是没到 180ms 就松手时得让按钮正常响应。 */
      if(!grip && ev.target.closest('input,textarea,select')) return;
      const mode = grip ? 'resize' : 'move';
      const dir = grip ? grip.dataset.dir : '';
      const onCtl = !grip && !!ev.target.closest('button,a,[data-nodrag]');
      const x0 = ev.clientX, y0 = ev.clientY, base = { x:it.x, y:it.y, w:it.w, h:it.h };
      let cur = Object.assign({}, base), started = false, hold = 0;
      /* 还没起拖的这 180ms 里，卡片没有指针捕获 —— 手在卡面外面松开时 pointerup 根本不经过这张卡，
         那枚长按计时会一路跑到点，卡片就挂着 lift 跟着没按住的鼠标跑（音乐卡上量过：按下播放钮、
         手滑出卡面松开，之后光动鼠标卡片就挪了 121px）。所以没起拖之前在窗口上盯着这次松手：
         松了就撤计时、把监听摘掉，这一单不算拖。 */
      const outUp = () => { clearTimeout(hold); hold = 0; offWindow(); };
      const onWindow = () => {
        window.addEventListener('pointerup', outUp, true);
        window.addEventListener('pointercancel', outUp, true);
      };
      const offWindow = () => {
        window.removeEventListener('pointerup', outUp, true);
        window.removeEventListener('pointercancel', outUp, true);
      };
      const step = e => {
        /* 按半格落位（原来一步一格，卡片想挪半格都挪不动），两轴吃同一个像素步长（外33 第 2 条） */
        const 步 = Math.min(shell.cellW, shell.cellH) / GRID_STEP;
        const dx = snapDelta(e.clientX - x0, shell.cellW, 步);
        const dy = snapDelta(e.clientY - y0, shell.cellH, 步);
        cur = mode === 'move'
          ? { x:base.x + dx, y:base.y + dy, w:base.w, h:base.h }
          : resizeRect(base, dir, dx, dy, minW, minH);
        shell.place(card, cur);
      };
      const eat = e => { e.stopPropagation(); e.preventDefault(); };
      const begin = () => {
        started = true;
        /* 起了拖就别让这一单再点着按钮：capture 里掐掉，click 走完立刻摘掉 */
        if(onCtl) card.addEventListener('click', eat, true);
        const s = getSelection(); if(s && s.rangeCount) s.removeAllRanges();
        card.classList.add('lift');
        document.getElementById('fdGrid').classList.add('dragging');
        document.body.classList.add('dragging');
        try{ card.setPointerCapture(ev.pointerId); }catch(e){}
        card.addEventListener('pointermove', step);
      };
      const done = () => {
        clearTimeout(hold); offWindow();
        card.classList.remove('lift');
        if(!started) return;
        card.removeEventListener('pointermove', step);
        if(onCtl) setTimeout(() => card.removeEventListener('click', eat, true), 0);
        document.getElementById('fdGrid').classList.remove('dragging');
        document.body.classList.remove('dragging');
        /* 落点被占不再回弹：把这一张钉在落下的那一块，压着的别一张张推开（外34 第 1 条）。
           只有整张桌面真装不下这么多卡时才作废回弹 —— 从前是「你这一格有人了」就弹回去。 */
        const 落 = shell.夹进(cur);
        const 动 = shell.让位(落, it);
        if(动){
          const grew = isExpanded(def, 落), was = isExpanded(def, it);
          for(const m of 动){
            m.it.x = m.x; m.it.y = m.y;
            const el = document.querySelector('[data-iid="' + m.it.id + '"]');
            if(el) shell.place(el, m.it);
          }
          /* 他亲手拉的这一下 = 这张卡归他管：把清单盖过的那一笔（sizeFrom）抹掉，以后改清单不再动它 */
          Object.assign(it, 落); delete it.sizeFrom; shell.save();
          if(动.length || mode === 'resize' || grew !== was) shell.render();
        } else {
          shell.place(card, base); toast('桌面装不下这么多了 · 已回弹');
        }
      };
      if(grip) begin(); else { hold = setTimeout(begin, 180); onWindow(); }
      card.addEventListener('pointerup', done);
      card.addEventListener('pointercancel', done);
    });
  },
  async pickWidget(){
    const hid = new Set(await toolHidden());
    let showHidden = false, q = '';
    const box = h('div', { class:'wnw-col fd-addbox' });
    const grid = h('div', { class:'fd-gridpick' });
    const draw = () => {
      const kw = q.trim().toLowerCase();
      grid.innerHTML = '';
      const onHome = new Set(this.layout.items.map(i => i.widget));
      let shown = 0;
      const covered = new Set();   /* 哪些包在这一格里已经有一行了（它的组件被列出来了） */
      for(const [id, def] of Registry){
        if(hid.has(id) !== showHidden) continue;
        if(kw && !(def.name + ' ' + id).toLowerCase().includes(kw)) continue;
        shown++;
        const has = onHome.has(id);
        /* 配方组件（Gen 那份）能整个删掉；插件走的是另一条：卸掉 = 改名单 + 刷新这一页，
           包留在 data\plugins\ 里，装得回来。两种都在这一行末尾摆各自的钮。 */
        const R = typeof Gen !== 'undefined' && typeof def.id === 'string' &&
          def.id.startsWith('tool-') ? Gen.get(def.id.slice(5)) : null;
        const pid = Packs.has(id) ? id : (typeof id === 'string' && id.startsWith('tool-') && Packs.has(id.slice(5)) ? id.slice(5) : '');
        if(pid) covered.add(pid);
        grid.appendChild(h('div', { class:'fd-additem' + (has ? ' off' : '') }, [
          h('button', { class:'fd-addpick', disabled:has, title:has ? '已经在首页了' : '放到首页',
            onclick:() => { if(!this.firstFit((def.def && def.def.w) || 5, (def.def && def.def.h) || 3)){ toast('页面已经放满了 · 先卸载或拖动腾出格子'); return; }
              this.layout.items.push({ id:def.id + '-' + Date.now().toString(36), widget:def.id, slot:this.layout.items.length % 5 });
              const it = this.layout.items[this.layout.items.length - 1];
              Object.assign(it, this.firstFit((def.def && def.def.w) || 5, (def.def && def.def.h) || 3));
              /* 这张卡是照清单的大小摆出来的：记一笔，往后改清单它还跟着变 */
              try{ SizeList.stamp(it, def); }catch(e){}
              this.save(); Modal.close(); this.render();
            }}, [h('b', {}, has ? '·' : '+'), h('span', {}, def.name)]),
          h('div', { class:'fd-addops' }, [
            h('button', { class:'wnw-btn mini ico' + (showHidden ? ' off' : ''),
              title:showHidden ? '放回列表里，数据没动过' : '只是不再出现在这张列表里，数据和设置都不动',
              'aria-label':showHidden ? '找回' : '隐藏', html:icoMarkup(showHidden ? 'eyeOff' : 'eye'),
              onclick:() => {
                toolHide(id, !showHidden).then(() => { if(showHidden) hid.delete(id); else hid.add(id); draw(); });
              } }),
            pid ? h('button', { class:'wnw-btn mini', title:'这一家住在哪 · 谁做的',
              onclick:() => PackOps.infoAsk(pid) }, 'info') : null,
            R ? h('button', { class:'wnw-btn mini', onclick:() => genExportAsk(R) }, '导出') : null,
            R ? h('button', { class:'wnw-btn mini', onclick:() => genDeleteAsk(R, draw) }, '删除') : null,
            pid ? PackOps.uninstallButton(pid, draw) : null])
        ]));
      }
      /* 有的包不占卡片：只往设置里垫几行、只加一个快捷键、只带一个后台监听。
         这种在上面那张注册表里根本没有行 —— 不补一行就再也找不到卸掉它的入口了。 */
      for(const m of Packs.list()){
        if(covered.has(m.id) || !PackOps.forHost(m)) continue;
        if(kw && !(m.name + ' ' + m.id).toLowerCase().includes(kw)) continue;
        shown++;
        grid.appendChild(h('div', { class:'fd-additem' }, [
          h('button', { class:'fd-addpick', disabled:true, title:m.desc || '',
            onclick:() => toast('这一家不摆卡片 · 要撤它就按右边的卸掉') },
            [h('span', { class:'w-mk', html:icoFor(m.id, m.icon || 'card') }), h('span', {}, m.name + '（不占卡片）')]),
          h('div', { class:'fd-addops' }, [
            h('button', { class:'wnw-btn mini', title:'这一家住在哪 · 谁做的',
              onclick:() => PackOps.infoAsk(m.id) }, 'info'),
            PackOps.uninstallButton(m.id, draw)])
        ]));
      }
      if(!shown) grid.appendChild(h('div', { class:'fd-empty' }, showHidden ? '没有已隐藏的插件' : '没有叫这个的组件'));
      if(typeof GenWizard !== 'undefined' && !showHidden && !kw)
        grid.appendChild(h('div', { class:'fd-additem new' }, [
          h('button', { class:'fd-addpick', onclick:() => { GenWizard.onSaved = () => Shell.pickWidget(); GenWizard.open(''); } },
            [h('span', { class:'w-mk', html:icoMarkup('plus') }), h('span', {}, '用组件定制做一个新组件')])]));
      /* 磁盘上有、名单里没写的那些包：这一栏给的就是「装回来」。
         名单是两边共用的，所以在这儿装上，WNW 停靠那边跟着也有。 */
      if(!showHidden) missingRow(grid, kw);
    };
    /* 没装的包那一小段：数据来自 data\plugins\，按 kw 过滤后现拼（读目录是异步的，回来直接垫在列表末尾） */
    const missingRow = async (grid, kw) => {
      const want = String(kw || '').toLowerCase();
      const hit = (await PackOps.installable()).filter(p => !want || (p.name + ' ' + p.id).toLowerCase().includes(want));
      for(const p of hit) grid.appendChild(h('div', { class:'fd-additem' }, [
        h('button', { class:'fd-addpick', title:(p.desc || '') + (p.author ? ' · 作者 ' + p.author : '') + (p.source ? ' · 来自 ' + p.source : ''),
          onclick:async () => { await PackOps.install(p.id); } },
          [h('span', { class:'w-mk', html:icoMarkup('imp') }), h('span', {}, p.name + '（没装）')]),
        h('div', { class:'fd-addops' }, [
          h('button', { class:'wnw-btn mini', onclick:() => PackOps.diskInfoAsk(p) }, 'info'),
          h('button', { class:'wnw-btn mini', onclick:async () => { await PackOps.install(p.id); } }, '装上')])
      ]));
    };
    box.appendChild(h('div', { class:'wnw-row' }, [
      h('input', { type:'search', class:'fd-input', placeholder:'搜插件名', style:'flex:1 1 auto',
        oninput:ev => { q = ev.target.value; draw(); } }),
      h('label', { class:'wnw-switch' }, [h('input', { type:'checkbox', onchange:ev => { showHidden = ev.target.checked; draw(); } }),
        h('span', {}, '显示已隐藏')]),
      typeof Gen !== 'undefined' ? h('button', { class:'wnw-btn mini', onclick:() => genImportAsk(draw) }, '导入插件') : null,
      /* 插件那一头的导入：一个 zip 或一个解开的文件夹，落地就装上 */
      PackOps.can() ? h('button', { class:'wnw-btn mini', title:'把别人给你的插件放进来（压缩包或解开的文件夹都行）',
        onclick:() => PackOps.importAsk(draw) }, '导入插件') : null
    ]));
    box.appendChild(grid);
    Modal.open('添加插件', box, null, null, { replace:true });
    draw();
  }
};
function resizeRect(base, dir, dx, dy, minW, minH){
  let { x, y, w, h } = base;
  if(dir.includes('e')) w = Math.max(minW, w + dx);
  if(dir.includes('s')) h = Math.max(minH, h + dy);
  if(dir.includes('w')){ const nx = Math.min(x + w - minW, x + dx); w = w + (x - nx); x = nx; }
  if(dir.includes('n')){ const ny = Math.min(y + h - minH, y + dy); h = h + (y - ny); y = ny; }
  return { x, y, w, h };
}

/* ---------- 新增样式：外壳 template 是只读的，这里注入 ---------- */
let shellCssOn = false;
function injectShellCss(){
  if(shellCssOn) return; shellCssOn = true;
  document.head.appendChild(h('style', { html:`
/* 全局字体：Theme.apply 把 --fd-font 写成完整那一串；没设过就是模板原本那套栈。
   卡片自己钉过字体的在 .fd-card 上直接写 font-family，比这条继承得近。
   全局字重（--fd-weight，外31 二组）：没钉过就是 400（标准）。
   --fd-synth 只管「不许拿假粗凑」：这一个字体家底下真有好几张脸时才关（关了就往那一张更粗的真脸上挑），
   只有一张脸的字体留着 auto —— 那种情况下假粗是界面上唯一的粗细对比，不是凑数。 */
body{font-family:var(--fd-font,${FF_BASE_FD});font-weight:var(--fd-weight,400);font-synthesis-weight:var(--fd-synth,auto);}
.fd-grid{position:absolute;left:0;right:0;top:var(--top-h,74px);bottom:0;display:block;padding:0;overflow:hidden;}
.fd-guides{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .12s;
  background-image:linear-gradient(to right,var(--card-line) 1px,transparent 1px),linear-gradient(to bottom,var(--card-line) 1px,transparent 1px);
  /* 线和吸附口径一样：半步一根，比原来密一倍 —— 看得见的线就是卡片能贴住的边 */
  background-size:calc(var(--cw,60px) / 2) calc(var(--ch,57px) / 2);
  background-position:var(--pad-x,0px) var(--pad-y,0px);}
.fd-grid.dragging .fd-guides{opacity:1;}
body.dragging{user-select:none;cursor:grabbing;}
.fd-card{position:absolute;display:flex;flex-direction:column;min-height:0;overflow:hidden;will-change:left,top,width,height;}
/* 卡片那层皮（底色、投影、发光、边框）全归 _shared/sh-look.js：
   这里以前自己写过 html[data-fx="glass"|"clear"|"solid"] 三条和 border:0，
   那等于把材质和外观模式两档又在自己家重画一遍 —— 选「纯平」要的那道细边框会被 border:0 抹掉，
   选「凝态 / 霜态」的模糊会被 backdrop-filter:none 顶掉。全删，只留布局。
   2026-10-04 材质那一档整档撤了（卡片底只有实色），这三条选择器再没人写，注释留在这儿说明为什么不许加回来。
   拖起来那一下的抬高手感不归外观模式管：那是这一张卡临时浮起来了，用浮层那一档的高度。 */
.fd-card.lift{transform:translateY(-3px) scale(1.006);z-index:9;box-shadow:var(--sh-float,none);}
/* 顶栏按钮：和卡片同一套 color-mix 淡底，随配色走。原来一个死白、一个全透，
   在有色卡面上一个突兀一个根本看不见。 */
.fd-top .fd-btn{background:color-mix(in srgb,var(--card-bg) 42%,transparent);
  border-color:var(--hair-color);color:var(--text);}
.fd-top .fd-btn:hover{background:color-mix(in srgb,var(--card-bg) 64%,transparent);border-color:var(--text);}
/* 图14：有一张卡铺到大半个版面（.expanded）时，顶栏「Flow-Desk」那一块往后退一层。
   只糊名字和时间，按钮不糊 —— 糊掉的按钮看着像坏了。
   也不整条加 filter：.fd-top 上是 -webkit-app-region:drag，拖动区是合成层那边算的，
   在这一层叠 filter 有把窗口拖不动的风险，糊进里面的字就绕开了这条线。
   鼠标一进顶栏立刻复原，要看清或是要够菜单都来得及。 */
.fd-brand,.fd-when{transition:filter .18s;}
.fd-top.dim .fd-brand,.fd-top.dim .fd-when{filter:blur(1.6px);}
.fd-top.dim:hover .fd-brand,.fd-top.dim:hover .fd-when{filter:none;}
.fd-card-head{cursor:grab;}
.fd-additem.off{opacity:.42;cursor:not-allowed;}
.fd-additem.off:hover{border-color:var(--hair-color);color:var(--text);}
.fd-card-head.float{position:absolute;left:0;right:0;top:0;z-index:7;padding:0;pointer-events:none;}
.fd-card-head.float .fd-card-tools{pointer-events:auto;opacity:0;}
/* 浮着的标题条归浮着：notitle（摊平）和 noname（只少个名字）都不占行高，钮悬停才露 */
.fd-card:hover .fd-card-head.float .fd-card-tools{opacity:1;}
/* 浮着的那一款自己又写了一遍 opacity:0，选择器比宿主那一条重，:focus-within 顶不住，
   所以这一款单独补一条同样加重的（无障碍走查 C-3）。 */
.fd-card:focus-within .fd-card-head.float .fd-card-tools{opacity:1;}
.fd-card.notitle .fd-card-body{padding-top:0;}
/* F1：卡面就是配色本身，里面不再垫一层白边；有标题的卡留一点左右呼吸 */
.fd-card-body{padding:0;}
.fd-card:not(.notitle) .fd-card-body{padding:0 var(--pad);}
/* 标题条浮起来以后正文顶到卡边了：只少名字那三种补一道顶部呼吸，浮着的钮不至于压着第一行字 */
.fd-card.noname .fd-card-body{padding:calc(10px * var(--vsc,1)) var(--pad) 0;}
/* 角上那个小勾（靠内画的拖动提示）撤了：四角本身已经能拖着改大小，再画一道提示反而多余。
   18×18 的透明热区和四根光标方向都得留着 —— 热区就是唯一能下手的地方，
   它背景透明、无边框，显不显形都不改画面，所以不必再靠 opacity 藏着。 */
.fd-grip{position:absolute;width:18px;height:18px;z-index:5;background:transparent;border:0;padding:0;}
/* 右上角那个 ×（还有整排按钮）压在 ne 角把手上面：谁离角近谁让路 —— 按钮是点名要按的，
   看不见的 ne 把手只留按钮圈不到的边角。以前把手 z-index 5 盖住标题条的 4，小卡上 × 永远按不着。 */
.fd-card-tools{position:relative;z-index:6;}
/* 卡面缩到一小格以后，四角那个看不见的把手会盖住插件自己的控件：便签卡 82×85 那一张里，
   输入框的左下角整个压在 sw 和 se 把手底下（elementFromPoint 在那两点上量出来上面是把手不是输入框），
   点下去只是给卡片起了一次缩放。跟右上角 × 同一处理、同一个道理 —— 控件是点名要按的，
   把手只留控件圈不到的边角。z-index 只对定位元素有效，所以静态控件先给一层 position:relative；
   这一条用 :where() 写成零特异性，插件自己写了 absolute 的控件不会被它挪位置。
   浮着的标题条跟着从 4 抬到 7：组件控件抬到 6 之后，那几个钮还得压在它们上面。 */
.fd-card-body :is(button,a,input,select,textarea,[role="button"]){z-index:6;}
.fd-card-body :where(button,a,input,select,textarea,[role="button"]){position:relative;}
/* 外13-H：四角把手从内缩 3px 改成贴死卡片最边角（像窗口边框那种）。
   热区挪偏内是之前用户点名的毛病。右上角 × 依旧点得到：
   上面 :1508/:1511 那两条压着——grip z-index 5、fd-card-tools z-index 6，
   谁压谁按老规矩（全-6 的结论），这里只挪位置不动层级。 */
.fd-grip[data-dir="nw"]{left:0;top:0;cursor:nwse-resize;}
.fd-grip[data-dir="ne"]{right:0;top:0;cursor:nesw-resize;}
.fd-grip[data-dir="sw"]{left:0;bottom:0;cursor:nesw-resize;}
.fd-grip[data-dir="se"]{right:0;bottom:0;cursor:nwse-resize;}
/* 日程卡内部结构 */
.sch-week{position:relative;display:grid;grid-template-columns:repeat(7,1fr);gap:2px;}
.sch-lanes{position:absolute;left:0;right:0;display:flex;flex-direction:column;gap:1px;}
.sch-lane{position:relative;flex:1 1 0;min-height:0;}
/* 月历是一张表格：日期不再是一个个分开的圆角块，横竖都由同一条细线隔开成格子。
   格线走 --line 这一档，不跟着外观模式那圈边框走：质感那一档把卡片边框收成 0，
   日历要是也跟着收成 0 就散成一堆浮着的色条，认不出哪天是哪天。
   这一档现在由外观层统一播（sh-look.js 的 --hair），月历只在这里把它接到 --line 这个名字上，
   省得两处各算各的色号；读不到（外观那一趟还没钉上的那一刻）就自己退回文字色掺 14%，一个数都不变。 */
.sch-cal,.sch-mini,.sch-weekv{--line:var(--hair);}
.sch-cal{border:var(--line);border-radius:calc(var(--r-card,5px) * var(--fit,1));overflow:hidden;}
.sch-cell{position:relative;overflow:hidden;cursor:pointer;padding:calc(1px * var(--fit,1)) calc(3px * var(--fit,1));
  border-right:var(--line);border-bottom:var(--line);}
.sch-cell.edgeR{border-right:0;}
.sch-cell.edgeB{border-bottom:0;}
/* 这个月之外的那几天（月初月末补白）：格子还在，点不着 */
.sch-cell.off{pointer-events:none;background:color-mix(in srgb,var(--text) 4%,transparent);}
/* 日程条是双色：开头一道深色粗线取主题强调色，后面是这一条自己的色位调出来的浅色填充。
   条上的字用正文色（浅色底上读），不再是色块里的反白。
   从上一周没画完接过来的那一条，本周这一格里没有它的开始，那道粗线就不摆。
   圆角是硬约束：这一条不吃全局圆角，钉死原来那一档（10px 按卡片缩放系数缩），
   设置里那两档拖动和它无关；左边那道强调色粗线同样不动。 */
.sch-bar{position:absolute;top:0;bottom:0;border-radius:calc(10px * var(--fit,1));overflow:hidden;display:flex;align-items:center;gap:3px;
  /* 条上的字：屏幕密度一档（--vsc）、卡片缩放一档（--fit 管间距圆角）、大卡那一档一档（--sch-big，日程插件自己给）。
     大卡档只在这里乘一次，色位圆点那一处同样乘这一个数 —— 不在每一处各写一份放大数。 */
  padding:0 calc(4px * var(--fit,1));color:var(--text);font-size:calc(.7857em * var(--vsc,1) * var(--sch-big,1));line-height:1;white-space:nowrap;cursor:pointer;
  border-left:calc(3px * var(--fit,1)) solid var(--accent);}
.sch-bar.going{border-left-width:0;}
.sch-dot{width:calc(7px * var(--vsc,1) * var(--sch-big,1));height:calc(7px * var(--vsc,1) * var(--sch-big,1));border-radius:50%;flex:0 0 auto;
  /* 从前这里手写了两道纯黑：一圈 1px 黑边加一道 2px 黑投影。浅底下这两道把色位圆点糊成一坨，
     换任何外观模式它都纹丝不动（设计债报告 5.1）。圈归到现算的那条控件细边，投影撤掉。 */
  box-shadow:0 0 0 1px var(--ctl-edge,rgba(0,0,0,.35));}
/* 周视图：左边一列时间刻度，右边周一到周日一天一栏；栏内按小时画线，日程卡叠在对应那段时间上。
   卡片还是双色那一条规矩 —— 深色粗线在左，浅色填充跟在后面。 */
.sch-tcol{position:relative;border-right:var(--line);}
.sch-tcol.edgeR{border-right:0;}
.sch-thour{border-bottom:var(--line);}
.sch-tcard{position:absolute;overflow:hidden;cursor:pointer;border-radius:calc(var(--r-btn,5px) * var(--fit,1));
  border-left:calc(3px * var(--fit,1)) solid var(--accent);padding:2px 4px;line-height:1.3;}
.sch-tcard.going{border-left-width:0;}
/* 「现在」这条线：横着压在所在的那个小时上，左端一个小圆点，右端一枚时间胶囊 */
.sch-tnow{position:absolute;left:0;right:0;height:0;border-top:2px solid var(--bad);z-index:3;pointer-events:none;}
.sch-tnow i{position:absolute;left:-1px;top:-4px;width:6px;height:6px;border-radius:50%;background:var(--bad);}
.sch-tnow b{position:absolute;right:2px;top:-.85em;font-size:.7143em;font-weight:700;color:var(--bad);
  background:color-mix(in srgb,var(--bad) 14%,var(--face-solid,var(--card-bg)));border-radius:var(--r-pill,5px);padding:0 6px;}
/* 卡片太矮塞不下整张月历时，那七列迷你竖条顶上：一列一天，条子从上往下摞，粗线在每条的头上 */
.sch-mini{display:grid;grid-template-columns:repeat(7,1fr);flex:1;min-height:0;
  border:var(--line);border-radius:calc(var(--r-card,5px) * var(--fit,1));overflow:hidden;}
.sch-mcol{display:flex;flex-direction:column;gap:calc(2px * var(--fit,1));min-height:0;padding:calc(1px * var(--fit,1)) calc(2px * var(--fit,1));
  border-right:var(--line);cursor:pointer;overflow:hidden;}
.sch-mcol.edgeR{border-right:0;}
.sch-mbar{height:calc(9px * var(--fit,1));flex:0 0 auto;border-radius:calc(2px * var(--fit,1));
  border-top:calc(3px * var(--fit,1)) solid var(--accent);}
/* F2：卡内不滚动，内容整体缩到塞得下；缩到 9px 还塞不下就截断，底部留一道渐隐。
   --fit 只乘在这一层的字号上，卡里所有 em 跟着一起缩。
   min-height 兜底：卡太矮时这一层不能被表头挤成 0，挤成 0 就整块看不见了。 */
.fd-fit{overflow:hidden;min-height:1.7em;font-size:calc(1em * var(--fit,1));}
/* 贴在卡片底边的一道渐隐，提示下面还有内容被截掉了。
   收尾那个色走 --face-solid（配色那张卡面掺过墨之后的那张脸），不走 --card-bg：
   渐隐是叠在卡面上的，配色里那张原始卡面和掺完墨的卡面不是一个色，
   跟着 --card-bg 就会在卡片内部画出一条界外色，看着像底边漏了一道。 */
.fd-cut{position:absolute;left:1px;right:1px;bottom:1px;height:16px;z-index:3;pointer-events:none;opacity:0;transition:opacity .12s;
  border-radius:0 0 var(--radius-card) var(--radius-card);
  background:linear-gradient(to top,var(--face-solid,var(--card-bg)) 40%,transparent);}
/* 骨架里写死的圆角归位到三档：工具钮和色块是控件，toast 和滚动条是胶囊 */
.fd-tool,.fd-swatch{border-radius:var(--r-btn,5px);}
/* ---------- 一块点了就能选色的色块（外13-N）----------
   根因说明：这块从前画的是 <span class="fd-swatch">，纯预览，全站没给它挂过任何点击 ——
   看着是「选色的地方」，其实点不动。现在这个是真控件：里面盖着一个透明铺满的原生取色器
   （input[type=color] 是浏览器自带的取色控件，点它 = 系统取色面板），外层这块只负责摆颜色。
   上面盖的是透明不是隐藏：键盘 Tab 也走得到它，回车/空格同样开得出取色面板。
   认不出来的那一格照旧铺条纹（说上面那个输入框还没被认出来），但一样点得动。
   圆形是 WNW #8 那一条定的规矩（挑色的一律圆形），焦点框由外观层那条 2px 描边管
   （这里只把这一个标成外观层认识的控件，不自己另写一条 outline）。 */
.fd-chip{position:relative;display:inline-block;width:26px;height:26px;flex:0 0 auto;padding:0;cursor:pointer;
  border:var(--hair);border-radius:50%;overflow:hidden;background:var(--candidate-bg);}
.fd-chip.fd-chip-none{background:repeating-linear-gradient(45deg,#ccc 0 4px,#eee 4px 8px);}
.fd-chip-in{position:absolute;inset:0;width:100%;height:100%;opacity:0;border:0;padding:0;margin:0;cursor:pointer;background:none;}
/* 标记色那一摊：一个一行（序号 + 圆形色块 + 撤掉）。
   从前每行还跟着一只色号输入框（那一档允许自己写色号），外29 丁组把定色收成「只从色卡挑」之后
   输入框没了，格子就按一行的真身宽度排（168 那一档是给「色块 + 输入框」量的，留着会空一片）。 */
.fd-marks{display:grid;gap:6px;grid-template-columns:repeat(auto-fill,minmax(236px,1fr));}
.fd-mark{display:flex;align-items:center;gap:6px;}
.fd-mark .fd-input{width:82px;flex:0 0 auto;}
.fd-mark-no{flex:0 0 auto;min-width:1.6em;text-align:right;font-size:.78em;color:var(--text-light);}
/* 一排色点里挑一个（色卡挑色、日程的色位都吃这一个）。
   选中那一个的确认样子（描边 + 内圈 + 勾）不在这里写，归外观层那一条全站共用的（外13-O），
   这里只管形状。 */
.fd-dot{position:relative;display:inline-block;width:20px;height:20px;flex:0 0 auto;padding:0;border:0;
  border-radius:50%;cursor:pointer;box-shadow:0 0 0 1px var(--ctl-edge,color-mix(in srgb,var(--text) 24%,transparent));}
/* 圆点外面那一圈选中环是画在边框之外的（box-shadow 0 0 0 3px），容器不留内边距，
   每行最左那一颗就被上一层裁掉一块（外34 图9）。留 4 像素，环完整，行与行的间距看着也不变。 */
.fd-dots{display:flex;flex-wrap:wrap;gap:7px;align-items:center;padding:4px;}
/* 图片库那一块（作者 2026-10-09：「纹理图片就这样平铺展开？？你还准备一张图一行不成？？将来更多图怎么办？
   ？现在太丑了」）：一张一格排进网格，一格至少 148 像素，列数跟着这一块的宽度自己铺，图多了往下排、不换布局。
   缩略图那一块按这一张本来的用法画：纹理那一种原样平铺一小块（看得出不无缝），其余两种裁中间一块；
   地址取不到那一张改画虚线框，不许摆一块看着像有图的空白。 */
.fd-imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px;}
.fd-imgcell{display:grid;gap:6px;align-content:start;border:var(--hair);border-radius:var(--r-card,8px);
  padding:8px;min-width:0;}
.fd-img{height:56px;border-radius:var(--r-btn,5px);background-size:cover;background-position:center;
  background-color:var(--candidate-bg);}
.fd-img-tile{background-size:auto;}
.fd-img-miss{background-image:none !important;border:1px dashed var(--ctl-edge,var(--input-border));}
.fd-imgname{font-size:.8571rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.fd-imgcell select{width:100%;font-size:.8571rem;padding:3px 5px;}
.fd-imgcell .fd-row{gap:4px;}
#toast,.fd-grid::-webkit-scrollbar-thumb,.scroll-y::-webkit-scrollbar-thumb{border-radius:var(--r-pill,5px);}
/* 组件定制要 1400px：只有它，词库编辑器、生成库那些对话框还是原来的宽 */
.fd-dialog.vwide{width:min(1400px,96vw);max-width:96vw;}
/* 添加插件：面板锁在 560 宽 → 四列正方格，行数和列数差不多，不再摊成一条长带；
   格脚两个小钮分别管隐藏/找回和完全删除，配方组件才有删除那个。 */
.fd-addbox{width:min(560px,86vw);}
.fd-gridpick{grid-template-columns:repeat(auto-fill,minmax(112px,1fr));}
.fd-gridpick .fd-empty{grid-column:1/-1;}
.fd-additem{aspect-ratio:1;padding:7px 6px;gap:5px;}
.fd-addpick{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:8px;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;border-radius:var(--r-btn,5px);}
.fd-addpick > span{overflow:hidden;text-overflow:ellipsis;}
.fd-addpick:disabled{cursor:not-allowed;}
.fd-addpick:not(:disabled):hover{color:var(--accent-text,var(--accent));}
.fd-addops{display:flex;gap:4px;justify-content:center;flex:0 0 auto;}
.fd-addops .wnw-btn{padding:1px 7px;font-size:.72em;}
/* 配色下拉：一行里摆「方案名 + 一排色点」，点开是浮着的第二层菜单（原生 select 摆不出色点）。
   形状照 RP 那个配色选择器来，颜色全吃当前这套 token，换肤跟着一起变。 */
.fd-sel{position:relative;width:100%;max-width:360px;min-width:0}
.fd-sel-btn{width:100%;display:flex;align-items:center;gap:8px;padding:6px 10px;font:inherit;color:var(--text);
  background:var(--candidate-bg);border:var(--bw) solid var(--card-border);border-radius:var(--r-btn,5px);cursor:pointer}
.fd-sel-btn:hover{border-color:var(--text)}
.fd-sel-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}
.fd-sel-arrow{flex:0 0 auto;color:var(--text-light);font-size:.7857rem}
.fd-sel-dots{display:flex;gap:4px;flex:0 0 auto}
.fd-sel-dot{width:11px;height:11px;border-radius:50%;box-shadow:0 0 0 1px var(--ctl-edge,color-mix(in srgb,var(--text) 24%,transparent))}
.fd-sel-menu{display:none;position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:60;padding:4px;
  max-height:280px;overflow-y:auto;background:var(--card-bg);border:var(--bw) solid var(--card-border);
  border-radius:var(--r-btn,5px)}
.fd-sel-menu.open{display:block}
/* 选项从前是一个 DIV，键盘 Tab 不到（无障碍走查 C-1）；换成真 <button> 就得把它自带的那套样子抹掉：
   浏览器给的浅灰底、内边距、边框、字体，任何一样留着，在这块卡面上都是一个不像选项的小灰块。 */
.fd-sel-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;font:inherit;
  background:none;border:0;padding:6px 8px;cursor:pointer;color:var(--text);
  border-radius:calc(var(--r-btn,5px) - 2px)}
.fd-sel-item:hover{background:var(--candidate-bg)}
.fd-sel-item.on{background:var(--accent-light);font-weight:600}
.fd-sel-tag{flex:0 0 auto;font-size:.7143rem;color:var(--text-light)}
` }));
}

/* ---------- 卡片内容自适应：缩到塞得下为止 ---------- */
const FIT_MIN_PX = 9;
/* 卡里不给滚动，所以量一遍"内容摊平要多高"，按可用高度整体缩；
   缩到 9px 还塞不下就停住，底部那道 .fd-cut 渐隐告诉你下面还有东西。
   opt.max > 1 时允许反向放大：月历这类"格子应当铺满卡面"的组件用。
   opt.pin（音-8）：整卡字号钉死一档 —— 只在头一回真的塞不下那一刻定下那一档，
     往后换句、换歌都只重算底部那道渐隐，不许把整卡字号重算一遍；卡片自己那一格变了尺寸才重新定。
     这是「宁可整体偏小，也不许切歌时跳一下」那一条的落点。 */
function fitBox(host, opt){
  const up = (opt && opt.max) || 1;
  const pin = !!(opt && opt.pin);
  if(host._fitRO) host._fitRO.unobserve(host);
  let busy = false;
  /* 钉住那一档记在宿主自己身上（host._fitLock），不记在这一趟闭包里：
     native 卡每换一句歌词都要重新走一遍 fitBox（fitLive 每次调一个新的 fitBox），
     记在闭包里就等于每次换句都把档位忘掉 —— 缩放系数照样从 1.000 重算，闪的还是那一处。 */
  const fade = over => {
    const card = host.closest('.fd-card');
    const el = card && card.querySelector('.fd-cut');
    if(el) el.style.opacity = over ? 1 : 0;
  };
  const fit = () => {
    if(busy) return;
    const avail = host.clientHeight;
    if(!avail){ host.style.setProperty('--fit', 1); return; }
    const now = host.clientWidth + 'x' + avail;
    /* 钉住的那一档：卡片那一格没变、只是里面的内容换了 —— 字号不动，只补渐隐。
       这里连「先按 1 量一遍」那一步都不走，因为正是那一步让整卡闪一下。 */
    if(pin && host._fitLock !== undefined && now === host._fitBox){ fade(host.scrollHeight > avail + 1); return; }
    if(now !== host._fitBox) host._fitLock = undefined;   /* 卡片被拉大拉小：那一档作废，重新量 */
    host._fitBox = now;
    busy = true;
    host.style.setProperty('--fit', 1);
    /* 卡片是弹性高度，直接读 scrollHeight 量到的是"已经压扁后"的高度，得先放开自己。
       宽度要钉在卡片给的那一格上：从前只放开 flex，宿主在横排那一格里被撑成 max-content，
       歌词于是永不换行，量出来的「内容要多高」永远等于可用高度，缩放系数一直卡在 1.000 ——
       切歌时看着像内部一路缩放，就是这一处口径坏了（音-8 量到的原样）。 */
    const st = host.style;
    const ph = st.height, pf = st.flex, pw = st.width, ps = st.alignSelf;
    const cs = getComputedStyle(host);
    const bw = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
    const w = Math.round(host.getBoundingClientRect().width - (cs.boxSizing === 'border-box' ? 0 : bw));
    st.height = 'auto'; st.flex = '0 0 auto'; st.alignSelf = 'flex-start';
    if(w > 0) st.width = w + 'px';
    const nat = host.scrollHeight;
    st.height = ph; st.flex = pf; st.alignSelf = ps; st.width = pw;
    busy = false;
    let f = Math.min(up, avail / (nat || avail));
    /* 底线按卡片自己的字号算（.fd-fit 的字号里已经含了 --fit，要问的是上一层） */
    const min = FIT_MIN_PX / (parseFloat(getComputedStyle(host.parentElement).fontSize) || 14);
    if(f < min) f = min;
    host.style.setProperty('--fit', f.toFixed(3));
    fade(nat * f > avail + 1);
    /* 塞得下（算出来就是 1）不钉：这时候钉住等于把「永远不缩」钉死；
       真到要缩的那一刻才钉，往后每一首歌都用这一档。 */
    if(pin && f < .999) host._fitLock = f;
  };
  const raf = () => requestAnimationFrame(fit);
  if(typeof ResizeObserver === 'function'){ host._fitRO = host._fitRO || new ResizeObserver(raf); host._fitRO.observe(host); }
  fit();
  return { dispose(){ if(host._fitRO) host._fitRO.unobserve(host); } };
}

/* ---------- 轻量设置读写（内存镜像 + IDB） ---------- */
const Settings = {
  mem:{},
  async load(){ this.mem = await Store.loadSetting('misc', {}) || {}; },
  get(k, fb){ return this.mem[k] === undefined ? fb : this.mem[k]; },
  set(k, v){ this.mem[k] = v; Store.saveSetting('misc', this.mem); },
};

/* ============================================================
   #275 开发期改字工具的「跳到那一处」—— 下面这一整块只有开发的时候用得上
   ----------
   改字工具是独立的一份，住在 D:\Programs\Tools Folder\aitools（不在 Flow-Desk 仓里，也不进产品）。
   它那边光标停在清单的某一行，这一头就把 Flow-Desk 挪到那句话在界面上的地方，好对着看。
   话递过来有两条路，内容都是同一句 { prog, page, text, rel, line }：
     · Flow-Desk 程序里：工具往 data\uitext-jump.json 写一句，主进程盯着这个文件，收到就推给各窗口
       （同一条 #275 在 main.cjs 盯目录那一段里，加上 preload.cjs 的 onUiTextJump）
     · 本地开发那台服务器上：工具自己开在 http://127.0.0.1:8792，这一头直接连它那条消息线
   要撤掉这一段：把从下面 const JUMP_TOOL 到末尾 Jump.watch() 整块注释掉，再把上面提到的两处同编号的行一起注释掉，
   别处不留尾巴。
   能跳到哪儿、跳不到在哪儿（弹出来的那一句里都说清了，不含糊）：
     · 界面上正摆着的那句话 —— 滚进视野、描一圈（改过字的按源码里原来那句认）
     · 「设置 · 哪一档」—— 先把设置打开、点到那一档，再按上一条找
     · 「桌面」+ 一个卡片名（卡片大小那份清单）—— 桌上有这张卡就亮它，没有就先摆一张再亮
     · 「功能包 · 哪一家」—— 那一家不在桌上就先摆上来，再在那张卡里找这句话
     · 「主界面」「启动」—— 先就地找（这些句子多半就在开着的那个弹窗里），找不到才收掉弹窗和封面回到桌面重找
     · 「Flow-Desk 主进程」那几行（窗口的菜单、托盘、关窗时问的那一句）—— 那是 Windows 自己的菜单和开机才出现的框，
       页面上摆不出来，只把出处报给你
     · 为写、声笔输入法练习两份页面的字 —— 只走到「那一页」这一步：那两份各是一张独立页面，
       Flow-Desk 这边最多把这句话递进已经开着的那个框，具体亮哪个控件得在那一边也接同一段（现在没接）
   ============================================================ */
const JUMP_TOOL = 'http://127.0.0.1:8792/api/watch';
const Jump = {
  css(){
    if(document.getElementById('fdJumpStyle')) return;
    const s = document.createElement('style');
    s.id = 'fdJumpStyle';
    s.textContent = '.fd-jump{outline:3px solid var(--accent,#d98324);outline-offset:3px}';
    document.head.appendChild(s);
  },
  /* 亮一下：滚进视野 + 描一圈，两秒半自己退 */
  shine(el, note){
    if(!el) return false;
    this.css();
    try{ el.scrollIntoView({ block:'center', inline:'center' }); }catch(e){}
    const was = document.querySelector('.fd-jump');
    if(was) was.classList.remove('fd-jump');
    clearTimeout(this.timer);
    el.classList.add('fd-jump');
    this.timer = setTimeout(() => el.classList.remove('fd-jump'), 2600);
    if(note) toast(note);
    return true;
  },
  timer:null,
  /* 一句话该描哪一层：卡片优先，顶栏其次，都没有就描它自己 */
  wrapOf(el){ return el.closest ? (el.closest('.fd-card') || el.closest('.fd-top') || el) : el; },
  same(a, b){ return String(a == null ? '' : a).replace(/\s+/g, ' ').trim() === String(b || '').replace(/\s+/g, ' ').trim(); },
  /* 在界面上找这句话。page 给得准就只在那一页里找（同一句话可能在好几页各摆着一处）；
     找不到就放宽到全页再找一遍，认到哪儿算哪儿。
     改过字的那一处，界面上显示的是你写的字，原来那句留在节点的 __t0 / __txAttr 上 —— 两边都比。 */
  find(page, text, loose){
    const want = String(text || '').trim();
    if(!want) return null;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(n){
        if(n.nodeType === 3){
          if(!Jump.same(n.__t0 === undefined ? n.nodeValue : n.__t0, want)) return NodeFilter.FILTER_SKIP;
        } else {
          let hit = false;
          for(const k of ['title', 'placeholder', 'aria-label']){
            if(Jump.same(n.__txAttr && n.__txAttr[k] ? n.__txAttr[k] : n.getAttribute(k), want)) hit = true;
          }
          if(!hit) return NodeFilter.FILTER_SKIP;
        }
        if(!loose && page && Txt.pageOf(n) !== page) return NodeFilter.FILTER_SKIP;
        const vis = n.nodeType === 3 ? n.parentElement : n;
        return vis && vis.getClientRects && vis.getClientRects().length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const n = w.nextNode();
    return n ? (n.nodeType === 3 ? n.parentElement : n) : null;
  },
  /* 卡片名 → 注册表里的那一家：清单上的名字来自源码和说明书，界面上叫 def.name，先原样比一遍，再比包含 */
  widgetByName(n){
    const s = String(n || '').trim();
    if(!s) return null;
    for(const [, def] of Registry) if(def.name === s) return def;
    for(const [, def] of Registry) if(typeof def.name === 'string' && def.name.indexOf(s) >= 0) return def;
    return null;
  },
  /* 桌上有没有这张卡；没有就照清单里那张卡的大小摆一张（和「添加插件」里那一下同一套做法） */
  cardOf(def){
    const it = Shell.layout.items.find(x => x.widget === def.id);
    if(it) return document.querySelector('.fd-card[data-iid="' + CSS.escape(it.id) + '"]');
    const r = Shell.firstFit((def.def && def.def.w) || 5, (def.def && def.def.h) || 3);
    if(!r){ toast('页面已经放满了 · 这一张摆不上桌'); return null; }
    Shell.layout.items.push(Object.assign({ id:def.id + '-' + Date.now().toString(36),
      widget:def.id, slot:Shell.layout.items.length % 5 }, r));
    const news = Shell.layout.items[Shell.layout.items.length - 1];
    try{ SizeList.stamp(news, def); }catch(e){}
    Shell.save(); Shell.render();
    toast('「' + def.name + '」原来不在桌上，已经摆了一张');
    return document.querySelector('.fd-card[data-iid="' + CSS.escape(news.id) + '"]');
  },
  /* 设置里点某一档：面板已经开着就只切档，别把它叠成第二层 */
  setTab(name){
    if(!document.querySelector('.fd-set-tabs')) openSettings();
    const b = [...document.querySelectorAll('.fd-set-tabs button')].find(x => x.textContent.trim() === name);
    if(b) b.click();
    return !!b;
  },
  /* 出处那一长串说成人话：「Why Not Write · 写作台」这种 */
  label(m){ return (m.prog ? m.prog + ' · ' + m.page : m.page) + '「' + m.text + '」'; },
  src(m){ return m.rel ? '（源码在 ' + m.rel + ' 第 ' + (m.line || 0) + ' 行）' : ''; },
  go(m){
    const d = m || {};
    const prog = String(d.prog || ''), page = String(d.page || ''), text = String(d.text || '');
    /* 1 别的程序的页面：能递话就递，递了也只到「那一页」为止。
       为写和声笔输入法练习都搬进这一张页之后（#343 G4 / #350），不再是另一份文档：
       认的是它们自己那一层根（.wnw-root / .rp-root），不再认 iframe 的地址。
       那两层都还没接「跳到某一页」那一段，所以只把开着的那一格亮一下。 */
    if(prog === '为写' || prog === '声笔输入法练习'){
      const root = prog === '为写' ? '.wnw-root' : '.rp-root';
      const el = document.querySelector('#fdCoverBody ' + root + ', .fd-card ' + root);
      if(el){
        this.shine(el.closest('.fd-card') || el, '到 ' + prog + ' 这一页了 · ' + page +
          '（再往下要亮哪个控件，那一边还没接同一段）');
      } else toast(prog + ' 那一句在 ' + page + '：这一页没在 Flow-Desk 里开着，而且那一边还没接同一段');
      return;
    }
    /* 2 主进程那几行：窗口的菜单和托盘、关窗时问的那一句 */
    if(prog === 'Flow-Desk 主进程'){
      toast('这一句在 ' + page + '：那是窗口的菜单和托盘，页面上跳不过去' + this.src(d));
      return;
    }
    /* 3 卡片大小那份清单：出处写着「桌面」，名字就是卡片名 */
    if(page === '桌面'){
      const def = this.widgetByName(text);
      if(def){ const el = this.cardOf(def); if(el){ this.shine(el, '桌面上这张「' + def.name + '」'); return; } }
      toast((def ? '这一张摆不上桌' : '桌上没有叫「' + text + '」的卡片') + this.src(d));
      return;
    }
    /* 4 「主界面」「启动」这两页：句子多半长在弹窗里（添加插件那一屏就是主界面的字），
       所以先就地找一遍；找不到再把弹窗和封面收掉、回到桌面重找，别一上来就把要看的盖子揭走 */
    if(page === '主界面' || page === '启动'){
      let e2 = this.find(page, text) || this.find('', text, true);
      if(e2){ this.shine(this.wrapOf(e2), '就在这儿 · ' + this.label(d)); return; }
      if(!document.getElementById('fdCover').hidden) Cover.close();
      while(!document.getElementById('fdModal').hidden) Modal.close();
      e2 = this.find(page, text) || this.find('', text, true);
      if(e2){ this.shine(this.wrapOf(e2), '就在这儿 · ' + this.label(d)); return; }
      toast('界面上没摆着这一句 · ' + this.label(d) + this.src(d));
      return;
    }
    /* 5 清单上写着「功能包 · 便签」的那一段：递过来的是 程序=功能包、页名=便签，
       那一家不在桌上就先摆上来，再在那张卡里找这句话 */
    const pack = prog === '功能包' ? [null, page] : /^功能包 · (.+)$/.exec(page);
    if(pack){ const def = this.widgetByName(pack[1]); if(def) this.cardOf(def); }
    /* 6 「设置 · 哪一档」：先把那一档打开，等它画完再找 */
    const tab = /^设置 · (.+)$/.exec(page);
    if(tab){
      if(!this.setTab(tab[1])){ toast('设置里没有「' + tab[1] + '」这一档' + this.src(d)); return; }
      setTimeout(() => {
        const el = this.find(page, text) || this.find('', text, true);
        this.shine(el || document.querySelector('.fd-set'), el ? '就在这儿 · ' + this.label(d)
          : '这一档已经打开了，界面上找不到这句话 · ' + this.src(d));
      }, 160);
      return;
    }
    /* 7 界面上正摆着的那句话 */
    const el = this.find(page, text) || this.find('', text, true);
    if(el){ this.shine(this.wrapOf(el), '就在这儿 · ' + this.label(d)); return; }
    toast('界面上没摆着这一句 · ' + this.label(d) + this.src(d));
  },
  /* 两条路都接：程序里走主进程那条，本地开发那台服务器直接连工具那条消息线 */
  watch(){
    if(window.FD_APP && window.FD_APP.onUiTextJump){
      try{ window.FD_APP.onUiTextJump(m => Jump.go(m)); }catch(e){}
      return;
    }
    if(!/^https?:/.test(location.protocol)) return;             /* file:// 那份产物不去连，省得一直重试 */
    try{
      const es = new EventSource(JUMP_TOOL);
      es.onmessage = ev => { try{ Jump.go(JSON.parse(ev.data)); }catch(e){} };
      /* 工具没开着就算了：这条线断了就断，不追着重连（Flow-Desk 自己不该依赖它） */
      es.onerror = () => { try{ es.close(); }catch(e){} };
    }catch(e){}
  }
};
Jump.watch();                                              /* #275：这一行跟着上面那块一起注释掉就彻底断开 */
