/* ============================================================
   色卡（外29）：一个一个攒着的那一份，落在 data\cards.yaml。
   色卡只有一个名字，但有两种形状，各占一份文件，别当成两个东西：
     · 成套的那一份（data\palettes.yaml）—— 一段 = 一套 = 底 / 卡面 / 正文 / 主强调 / 次强调 那一串角色；
     · 一个一个的那一份（这一份）—— 一段 = 一个色（或几个基础色一组，拿去配渐变）。
     他定了「不分套」：攒着的色不打包成方案，所以两件事不硬塞进同一份文件。
   段名就是这一个的内部代码（他定的：颜色本身不取名，改名只能改组名）。
   一个可以是单色（色号 一行），也可以是几个基础色（色号 好几行）—— 色卡只存料，不存画法：
   这几个到底铺成线性还是弥散，是外观方案那一侧定的（同一串基础色可以在两个方案里各用一种形式）。
   界面上那个圆点色卡摊开的就是这一份；从图里取到的、色卡图上认到的、挑色挑中的都往这里加。
   ============================================================ */
const CARD_FILE = 'cards.yaml';
const CARD_GROUP0 = '未分组';
/* 来源那一栏的说法：swatch 指的是「从一张印好的色卡照片上认到的色」，
   和这一份文件的名字（色卡）不是一件事，所以写全成 色卡照片，不留两个同名的东西。 */
const CARD_SRC = { custom:'自建', pick:'挑色', image:'图片', swatch:'色卡照片', rime:'Rime', scheme:'方案', v1:'内置配色' };
const CARD_SRC_BACK = Object.fromEntries(Object.entries(CARD_SRC).map(x => [x[1], x[0]]));
const CARD_HEAD = [
  '# 色卡 —— Flow-Desk 攒色的那一份，界面上「色卡」那一屏摊开的就是这里。',
  '#   这是一份 YAML（YAML 就是"用缩进和冒号排版"的纯文本），记事本、Notepad++ 都能直接改；存盘请保持 UTF-8 编码。',
  '#   一段一个色卡：顶格那一行是这一个的内部代码（c 开头那串，程序认它，界面上不显示，也不用你起名字）。',
  '#     色号：一行一个。只写一行就是单个色；写几行就是几个基础色一组（拿它去配渐变，怎么渐归外观方案那边定，这一份不管）。',
  '#       写法照你顺手的那种来：#3b6cb5、0x35A82A、59,108,181（RGB）都认；',
  '#       CMYK 要写成 cmyk(78,52,0,0) —— 裹上这一层，四个数字才认得出是 CMYK 而不是 RGB。',
  '#     组：这一个摆在色卡上哪一组里。界面上「颜色管理」开起来才能改组名、挪组。不写当 未分组。',
  '#     来源：自建 / 挑色 / 图片 / 色卡照片 / Rime / 方案 / 内置配色。',
  '#   改完存盘，Flow-Desk 里那张色卡当场跟着变，不用重启；这一段一个字都没动过就别存，省得白刷新一次。',
  '#   认不出的那一段程序整段跳过，其余照常；代码重复只认头一段。',
  '#   以 # 开头的行是说明，程序读的时候跳过。',
  ''
].join('\n');

const CardPool = {
  name:CARD_FILE,
  ready:false,
  items:[],
  tuneOn:true,          /* 颜色一键微调开不开（界面上那枚勾选框管这一个，存档里跟着走） */
  /* ---------- 一键微调：把取回来那一串推成"能用的一串" ----------
     两件事：① 太接近的两个并掉（色相挨着、明度也挨着，摆到色卡上就是两个看着一样的点）；
     ② 过暗、过亮的那个往回推一档（纯黑纯白当强调色使不上劲）。
     关掉就是取到什么色就存什么色，一个不动 —— 他要么"照原样留着"、要么"帮我理一遍"，两样都要能选。 */
  tune(list){
    if(!this.tuneOn) return (list || []).slice();
    const out = [];
    for(const hex of (list || [])){
      const h = String(hex || '').toLowerCase();
      if(!/^#[0-9a-f]{6}$/.test(h)) continue;
      const [hu, sa, li] = CV.hslOf(h);
      /* 太接近：色相差不到 6 度、明度差不到 6%。色相这把尺是 0~1（一整圈 = 1），
         所以 6 度就是 6/360，两头相接那一处（红色）要绕回来比，不能只算直差。 */
      const 撞 = out.find(x => { const a = CV.hslOf(x);
        const 直 = Math.abs(a[0] - hu), 绕 = 1 - 直;
        return Math.min(直, 绕) < 6 / 360 && Math.abs(a[2] - li) < 0.06; });
      if(撞) continue;
      let v = h;
      if(li < 0.12) v = CV.adjust(h, 0.10, 1);
      else if(li > 0.94) v = CV.adjust(h, -0.10, 1);
      out.push(v);
    }
    return out;
  },
  setTune(v){ this.tuneOn = !!v; State.set('cards.tune', this.tuneOn ? 1 : 0); return this.tuneOn; },
  /* ---------- 一个色卡 ↔ 文件里的一段 ---------- */
  fields(c){
    return { 色号:(c.colors || []).map(x => x.raw), 组:c.group || CARD_GROUP0, 来源:CARD_SRC[c.source] || '自建' };
  },
  entry(sec){
    const f = sec.fields || {};
    const list = Array.isArray(f.色号) ? f.色号 : (f.色号 ? [f.色号] : []);
    const colors = list.filter(Boolean).map(raw => ({
      raw:String(raw), format:/^cmyk\(/i.test(String(raw)) ? 'cmyk' : 'auto'
    }));
    if(!colors.length) return null;
    return { code:sec.name, colors, group:String(f.组 || '').trim() || CARD_GROUP0,
      source:CARD_SRC_BACK[String(f.来源 || '').trim()] || 'custom' };
  },
  text(){
    return LibYml.emit(CARD_HEAD, this.items.map(c => ({ name:c.code, fields:this.fields(c) })),
      ['色号', '组', '来源']);
  },
  adopt(text){
    const secs = LibYml.parse(text);
    if(!secs.length) return 0;
    const got = secs.map(s => this.entry(s)).filter(Boolean);
    this.items = got;
    return got.length;
  },
  /* ---------- 开机：文件没读过就别往回盖 ---------- */
  async boot(){
    this.tuneOn = (await State.get('cards.tune', 1)) !== 0;    /* 一键微调那枚开关：没存过当开 */
    const text = await LibStore.fetchRaw(CARD_FILE);
    /* 读不到就不点亮 ready：没读过那份文件却往回盖，等于把用户攒的那一摛整个抹掉 */
    if(text === null){ this.ready = false; console.warn('色卡这一趟没读到（读写那一层还没连上），先按内存里那份跑'); return this; }
    this.adopt(text);
    this.ready = true;
    /* 随包那份配色（作者给的那份《Colour v1》1307 个色号）开机就进色卡 —— 他说的是「嵌入」，
       不是「摆一颗按钮等我去点」。认来源 'v1' 进过没有：进过就一个字不动（他删掉的那些不硬塞回来）。 */
    if(!this.items.some(c => c.source === 'v1')){
      let 添 = 0;
      for(const g of Object.keys(COLOUR_V1)) 添 += this.addAll(COLOUR_V1[g], 'v1', g, true);
      if(添) console.log('内置配色 v1 开机进色卡：' + 添 + ' 个');
    }
    return this;
  },
  persist(){ if(this.ready) LibStore.later(CARD_FILE, this.text()); },
  /* ---------- 往里加 ---------- */
  /* 内部代码：一个一个，撞了就往后让位子（段名就是身份，撞名等于两个并成一个） */
  uniqueCode(){
    const taken = new Set(this.items.map(c => c.code));
    let base = 'c' + Date.now().toString(36);
    if(!taken.has(base)) return base;
    for(let i = 2; i < 500; i++){ if(!taken.has(base + '-' + i)) return base + '-' + i; }
    return base + '-' + Date.now();
  },
  hexOf(c){
    /* 一个色卡在色卡上占一个圆点：单色就是那个色，渐变取第一档当代表色 */
    const first = (c.colors || [])[0];
    if(!first) return '';
    return CardPool.hex(first.raw, first.format);
  },
  /* 一行色号 ↔ 屏幕上那一个：#3b6cb5、#f0a、0x35A82A、59,108,181、cmyk(78,52,0,0) 全照界面上那把尺解，
     解不出来交回空串（不拿正则硬卡，免得 #f0a 这种三位简写被悄悄丢掉） */
  hex(raw, format){
    const p = parseColor(String(raw || '').trim(), format || (/^cmyk\(/i.test(String(raw || '')) ? 'cmyk' : 'auto'));
    const r = p ? resolveColor(p, 'gracol') : null;
    return r ? String(r.hex).toLowerCase() : '';
  },
  /* 查重分两摊算（他定的口径）：单个色只跟单个色比，几个一组的只跟几个一组的比 ——
     一组「蓝→绿→中灰」里当过一档的那个绿，不挡他从图上取到的同一个纯绿进色卡。 */
  solo(c){ return (c.colors || []).length === 1; },
  has(hex){ const h = String(hex || '').toLowerCase();
    return this.items.some(c => this.solo(c) && this.hexOf(c).toLowerCase() === h); },
  /* 一串色各自进色卡：同色不重复添（他已经攒过 #3b6cb5，再从图里取到同一个就不摆第二个）
     存进去的是解出来的那六个字，界面上那一行写的是 #f0a 也存成 #ff00aa
     照原样 = 跳过「一键微调」那一步：内置配色那一份是他自己写定的清单，推档会把里头那几个色号改掉，
     并近色会把整档删没 —— 那一理是给「从图上取回来的散色」用的，不是给一份定稿清单用的。 */
  addAll(hexes, source, group, 照原样){
    let n = 0;
    const 过 = (hexes || []).map(x => this.hex(x)).filter(Boolean);
    for(const hex of 照原样 ? 过 : this.tune(过)){
      if(!/^#[0-9a-f]{6}$/.test(hex) || this.has(hex)) continue;
      this.items.push({ code:this.uniqueCode(), colors:[{ raw:hex, format:'auto' }],
        group:String(group || CARD_GROUP0), source:CARD_SRC[source] ? source : 'custom' });
      n++;
    }
    if(n) this.persist();
    return n;
  },
  /* 一趟挑中的几个，攒成一组基础色进色卡（色卡自选颜色组成一组）
     色卡只存料：这一组怎么铺成渐变（线性还是弥散）不记在这儿，那是外观方案那一侧定的。
     同一串基础色再来一趟不攒第二个（审查第 39 条：从前这里不查重，连点两次就多出一个双份） */
  addGrad(hexes, group, source){
    const list = [];
    for(const hex of this.tune((hexes || []).map(x => this.hex(x)).filter(Boolean))) if(list.indexOf(hex) < 0) list.push(hex);
    if(list.length < 2) return null;
    /* 一组跟一组比：只看那一串基础色，不比画法（他定的口径）。
       档的先后换了算另一个：色号那几行的顺序就是渐变从哪头渐到哪头。 */
    const 有 = this.items.find(c => !this.solo(c) && (c.colors || []).length === list.length
      && (c.colors || []).every((x, i) => String(x.raw).toLowerCase() === list[i]));
    if(有) return 有;
    const c = { code:this.uniqueCode(), colors:list.map(raw => ({ raw, format:'auto' })),
      group:String(group || CARD_GROUP0), source:CARD_SRC[source] ? source : 'pick' };
    this.items.push(c); this.persist();
    return c;
  },
  /* ---------- 当前方案在用的色进色卡（外29 乙组第一条） ----------
     「在用的色」认的是屏幕上此刻真钉着的那一串（Theme.applied），不是色卡里那段原始写法 ——
     原始那几行换算完、再过一遍掺墨和推对比，才是眼睛看到的这些个。
     名单只挑这套配色的锚：页面底、卡面（掺完墨那一块）、正文、次正文、主强调、次强调、五个色位、状态三色。
     渐变两头那两空处（--wall-a --wall-b）和控件那几块底不在名单里：那不是「方案在用的色」，是画渐变时借的料。 */
  SCHEME_KEYS:['--page-bg', '--card-bg', '--face-solid', '--text', '--text-light', '--accent', '--accent2',
    '--ok', '--bad', '--warn', '--slot-1', '--slot-2', '--slot-3', '--slot-4', '--slot-5'],
  /* 名单里此刻真解得出六字体色的那几个（交回一串，界面拿它的长度分得清「一个没认到」和「都已经有了」——
     审查第 42 条：这两种情况都数得出 0，从前报的是同一句话） */
  schemePicks(tokens){
    const t = tokens || {};
    return this.SCHEME_KEYS.map(k => String(t[k] || '')).filter(x => /^#[0-9a-f]{6}$/i.test(x)).map(x => x.toLowerCase());
  },
  fromScheme(tokens){ return this.addAll(this.schemePicks(tokens), 'scheme'); },
  /* ---------- 管理态那三样：改组名、挪组、删一个 ---------- */
  remove(code){
    const i = this.items.findIndex(c => c.code === code);
    if(i < 0) return false;
    this.items.splice(i, 1); this.persist();
    return true;
  },
  setGroup(code, group){
    const c = this.items.find(x => x.code === code);
    if(!c) return false;
    c.group = String(group || '').trim() || CARD_GROUP0; this.persist();
    return true;
  },
  /* 组名跟着改：一整组一起换名字（改名只能改组名，颜色本身不取名） */
  renameGroup(from, to){
    const t = String(to || '').trim();
    if(!t) return 0;
    let n = 0;
    for(const c of this.items) if(c.group === from){ c.group = t; n++; }
    if(n) this.persist();
    return n;
  },
  groups(){
    const out = new Map();
    for(const c of this.items){ if(!out.has(c.group)) out.set(c.group, []); out.get(c.group).push(c); }
    /* 未分组永远排最后，其余按组名 */
    return [...out.entries()].sort((a, b) =>
      (a[0] === CARD_GROUP0) - (b[0] === CARD_GROUP0) || String(a[0]).localeCompare(String(b[0]), 'zh-CN'));
  },
  /* 一组之内怎么排（作者 2026-10-09 先说「每组的深浅、明暗看起来都是混着来的」，改成按色相走带之后又说
     「色卡排序不太好，还是有深色混在浅色里面」）。参考那一张他点名的色卡（蓝色系 50 色、每块底下印着色号）
     量出来是明度为轴的：拿几种尺子去重现它那一列次序，纯按明度最贴（反序对 18.1%），上一版那条 12° 色相带最远（49.1%）。
     可只按明度在他这一份内置配色上又是另一桩：相邻两颗的色相平均跳 16.5°、单颗跳过 30° 的有 201 处 —— 正是他前一轮
     嫌的「色相起起伏伏」。两头都要，所以这一把这样走：
     · 明度为轴一路深 → 浅；把明度挨着（一层高 8 个点以内）的连着几颗归成一层，层内按色相排，
       并且一层往右、下一层往左地蛇形走 —— 相邻两层的接头才不会对跳一下。
       这样明度最多只往回走一层高（量出来最大 7.8 个点，眼睛不再把「浅色后面冒出深色」挑出来），
       色相又拢得住（平均跳 3.4°、单颗跳过 30° 的只剩 11 处，和那条色相带一样平）。
     · 没有方向的一档不拢色相，只按深浅走。认「有没有方向」用 R~B 三道的极差（0~255，就是 内置配色 那台分组工具
       黑白灰 一条用的同一把尺），不用 HSL 的饱和度：近黑近白那一头 HSL 饱和会虚高（#fef0f0 三道只差 14，HSL 能算到
       0.88 —— 眼睛看着就是一张米白），拿它当彩度会把一支灰点认成有颜色。合力也按这一把极差加权，灰点那一支色相是
       噪声、权重也就近乎零，搅不散一支真有方向的组。他这一份 1308 个色量出来：黑白灰 中位极差 12 · 加权合力 28%，
       九支彩色组最低的两档是 蓝色系 中位极差 55 · 绿色系 加权合力 86% —— 门槛 24 / 四五成 就夹在这中间。
     渐变那一颗按它的代表色排。数出自 src\tools\probes\test-hl36.mjs 第三节（跑的是这一把真的 sortIn）。 */
  sortIn(list){
    const k = c => { const h = this.hexOf(c) || ''; const x = h ? CV.hslOf(h) : [0, 0, 0];
      const n = h ? [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] : [0, 0, 0];
      return { c, h, 相: x[0] * 360, l: x[2], 差: Math.max(...n) - Math.min(...n) }; };
    const 颗 = list.map(k);
    const 差 = 颗.map(a => a.差).sort((a, b) => a - b);
    let x = 0, y = 0, 总 = 0;
    for(const a of 颗){ const r = a.相 * Math.PI / 180; x += a.差 * Math.cos(r); y += a.差 * Math.sin(r); 总 += a.差; }
    const 走色相 = (总 ? Math.hypot(x, y) / 总 : 0) >= .45 && (差[Math.floor(差.length / 2)] || 0) >= 24;
    /* 明度为轴那一趟：同一个色号永远落在同一个位子上（明度比不出输赢就角色号） */
    const 深到浅 = 颗.slice().sort((a, b) => (a.l - b.l) || a.h.localeCompare(b.h));
    if(!走色相) return 深到浅.map(a => a.c);
    const out = [];
    for(let i = 0, 趟 = 0; i < 深到浅.length; 趟++){
      let j = i;
      while(j < 深到浅.length && 深到浅[j].l - 深到浅[i].l <= .08) j++;
      const 段 = 深到浅.slice(i, j).sort((a, b) => (a.相 - b.相) || a.h.localeCompare(b.h));
      out.push(...(趟 % 2 ? 段.reverse() : 段));
      i = j;
    }
    return out.map(a => a.c);
  },
  /* 色卡摊开要吃的那一串：每个一个色号（渐变取代表色），按色相排 —— 跟色卡那一头同一把尺 */
  hexes(){
    const hs = this.items.map(c => this.hexOf(c)).filter(Boolean);
    return [...new Set(hs)].sort((a, b) => { const x = CV.hslOf(a), y = CV.hslOf(b); return (x[0] - y[0]) || (x[2] - y[2]); });
  },
  count(){ return this.items.length; }
};
