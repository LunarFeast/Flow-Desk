/* ============================================================
   字体层（FD / WNW 共用这一份）
   1) 系统字体清单：Flow-Desk 里走主进程那一条（WPF 那张字体表：一家一条，底下有哪几档真脸是系统自己报的，
      合成出来的假粗假斜在子进程那一步就扔掉）；开机主进程在后台重数一遍并推过来，界面跟着刷新。
      这一棵里没有主进程那一层就读不到表，只剩手输 + 上次读到的缓存 —— 所以摆一个按钮让人点着重新数一遍。
   2) 附加字体文件夹：指一个放着未安装字体的目录，里面的 ttf/otf/ttc/woff2 现场挂成 FontFace。
   3) 选择器分三块：置顶（自己加，可拖序）/ 常用（按使用次数自动排）/ 全部（中文字体优先，其余按名）。
   4) 每行左边用该字体自己渲染「Aa字型的口」，右边四个圆点标 中/日/韩/英。
      圆点是固定色（中绿 / 日蓝 / 韩粉 / 英橙），不跟外观配色变，只能在这里手动点。
   5) 入口只有一种形态：就地展开。FD 的设置对话框、卡片的字体对话框、WNW 的设置面板
      都是一层-slot 的模态，再套一层会把父对话框顶掉，所以这里点「选字体」是在本对话框里
      把清单撑开，点某一行立刻套用并留在原地，试完点「收起」。
   ============================================================ */
/* 默认那一个字体家（外31 二组 · 作者定的「全局统一字体，默认霞鹜文楷等宽」）。
   本地装着就不嵌进安装包 —— 那台机器上没装，栈里自动往后退到 Segoe UI / 微软雅黑，界面上照样有字。
   英文名一起写：同一个字体家在别的语言版本里注册的是英文名字，CSS 挑到哪个都是同一张脸。 */
const FF_DEFAULT_FD = '霞鹜文楷等宽';
const FF_DEFAULT_EN = 'LXGW WenKai Mono';
const FF_BASE_FD  = ffQuote(FF_DEFAULT_FD) + ',' + ffQuote(FF_DEFAULT_EN) +
  ',"Segoe UI","Microsoft YaHei","霞鹜文楷 屏幕阅读版","LXGW Screen Reader",system-ui,sans-serif';
const FF_BASE_WNW = ffQuote(FF_DEFAULT_FD) + ',' + ffQuote(FF_DEFAULT_EN) +
  ',system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif';
/* 代码那一头本来就要求等宽：霞鹜文楷等宽正是一张等宽脸，所以摆最前；读不到那张就退回 Consolas 那一串 */
const FF_MONO     = ffQuote(FF_DEFAULT_FD) + ',' + ffQuote(FF_DEFAULT_EN) +
  ',ui-monospace,Consolas,"Courier New",monospace';
/* 四个圆点：颜色写死，和色卡无关 */
const FF_SCRIPTS  = [['zh', '中', '#2fa35b'], ['ja', '日', '#3b7fd4'], ['ko', '韩', '#e0599a'], ['en', '英', '#e08a2a']];
const FF_PREVIEW  = 'Aa字型的口';
const FF_EXT      = /\.(ttf|otf|ttc|woff2?)$/i;
/* ---------- 按语言设字体那几档（外29 丁组 · 作者的话：「两个联动的下拉窗口、一个选择语言、另一个选择字体，
     语言排序中，中文简体第一位、中文繁体第二位、英语第三位，其他常见语言按照英文名字母排序」）
     range 就是这一档要接住的 unicode 区段：CSS 的 @font-face 拿 src:local(字体名) + unicode-range，
     系统里装着的字体不用读文件字节也能一条一档挂上去 —— 这是这条路唯一不必求用户导文件的走法。 */
const FF_LANGS = [
  { k:'zh-Hans', name:'中文简体', en:'Chinese (Simplified)', range:'U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF' },
  { k:'zh-Hant', name:'中文繁体', en:'Chinese (Traditional)', range:'U+0002-0003,U+2000-2001,U+2004-2008,U+2299,U+229C,U+22A4-22A5,U+2312,U+251C-251D,U+2514,U+2518,U+2519,U+251E-251F,U+2521-2523,U+252D-2530,U+2583,U+25D0-25D1,U+25E8-25E9,U+2613,U+261E,U+2661,U+2667,U+266A,U+266C,U+26BE,U+2BC0-2C2F,U+2C34-2C5B,U+2E80-2E99,U+2E9B-2EF3,U+2F00-2FD5,U+2FF0-2FFB,U+3008,U+300A,U+300C,U+3011,U+3014,U+3016,U+301A,U+3021,U+3023,U+302A,U+3039,U+3041,U+3043,U+3045,U+3047,U+3049,U+304A,U+304C-304E,U+3050-3057,U+3059,U+305A,U+305C-305F,U+3061,U+3062,U+3065-3069,U+306E,U+3070,U+3071,U+3075,U+3076,U+307D-3084,U+3086,U+3087,U+308E-30AA,U+30AE,U+30AF,U+30B1-30C1,U+30D1,U+30D2,U+30D4-30D9,U+30DD,U+30DE,U+30E1,U+30E3,U+30E5,U+30E7,U+30E8,U+30EA,U+30EC-30F0,U+30F2,U+30F3,U+30F4,U+30F5,U+30F6,U+30F8,U+30F9,U+30FE,U+30FF,U+3127-3129,U+3131,U+3132,U+3140,U+3141,U+3145,U+3146,U+3148,U+314B-314D,U+314F,U+3150,U+3152,U+3153,U+3157,U+3158,U+315B,U+315F,U+3160,U+3161,U+3163,U+3168,U+3169,U+316C,U+316D,U+316F-3171,U+3174,U+3175,U+3177,U+3178,U+317B,U+317C,U+317E,U+317F,U+3181,U+3182,U+3185,U+3186,U+3188,U+3189,U+318C,U+318D,U+31E4-31ED,U+31F1,U+31F3-31F5,U+3280-3289,U+3B9F,U+3CE0-3CEC,U+3D00-3DB3,U+4E00-9FFF,U+E8E5-EBE3' },
  { k:'en',      name:'英语',     en:'English',      range:'U+0041-005A,U+0061-007A' },
  { k:'ja',      name:'日语',     en:'Japanese',     range:'U+3041-30FF,U+31F0-31FF,U+FF66-FF9F' },
  { k:'ko',      name:'韩语',     en:'Korean',       range:'U+1100-11FF,U+3130-318E,U+AC00-D7A3,U+FFA0-FFDC' },
  { k:'vi',      name:'越南语',   en:'Vietnamese',   range:'U+00C0-00C3,U+00A8,U+1EA0-1EF9,U+022b' },
  { k:'th',      name:'泰语',     en:'Thai',         range:'U+0E00-0E7F' },
  { k:'ar',      name:'阿拉伯语', en:'Arabic',       range:'U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFF' },
  { k:'ru',      name:'俄语',     en:'Russian',      range:'U+0400-04FF,U+0500-052F' },
  { k:'el',      name:'希腊语',   en:'Greek',        range:'U+0370-03FF,U+1F00-1FFF' },
  { k:'he',      name:'希伯来语', en:'Hebrew',       range:'U+0590-05FF,U+FB1D-FB4F' },
  { k:'hi',      name:'印地语',   en:'Hindi',        range:'U+0900-097F' },
  { k:'latin',   name:'其他拉丁字母', en:'Other Latin', range:'U+00C0-024F,U+1E00-1EFF,U+20A0-20CF' }
];
/* 排序就是作者点的那条：简中、繁中、英语在前，其余按英文名字母排 */
function ffLangList(){
  const head = ['zh-Hans', 'zh-Hant', 'en'];
  const rest = FF_LANGS.filter(l => !head.includes(l.k)).sort((a, b) => a.en.localeCompare(b.en, 'en'));
  return head.map(k => FF_LANGS.find(l => l.k === k)).concat(rest).filter(Boolean);
}
const FF_PIN_MAX = 5;      /* 收藏只给五格（作者的话：「然后是5个收藏字体」） */
const FF_LANG_ALIAS = 'Flow-Desk 按语言';   /* 按语言那一份挂在这个假名上，全局字体栈把它摆最前 */

/* ---------- 一个字体家底下真有哪几档字重（外31 二组 · 作者的话：「应当根据字体可以选择不同的字重」）
   Windows 把多字重的字体一族一族分开注册（「霞鹜文楷等宽 Light」「霞鹜文楷等宽 Medium」），
   也有把数字写在名字尾巴上的（「霞鹜975朦胧黑体SC 400W」）—— 这两种形状都认。
   只认英文词和三位数：中文里的「黑」「圆」「楷」讲的是字形不是粗细，跟着认会把「霞鹜漫黑」读成 900。
   认出来的这几档只决定界面上摆哪几个选择；写进 CSS 的永远还是 font-weight 那一个数 ——
   浏览器自己会挑到那一张真脸（沙盒里量过：同一个「霞鹜文楷等宽」写 300 出来的墨点，和单独一族
   「霞鹜文楷等宽 Light」写 400 一模一样），所以不另挂 @font-face 改名，也不让它拿假粗凑：
   假粗在样式表那一头用一句 font-synthesis-weight:none 关掉（这一家最粗就到那一张真脸，上面不再编粗）。 */
const FF_WEIGHT_CN = { 100:'特细', 200:'很细', 300:'细', 400:'标准', 500:'中', 600:'半粗', 700:'粗', 800:'特粗', 900:'最粗' };
function ffWeightName(w){ return FF_WEIGHT_CN[w] || String(w); }
/* 一档摆到人前那三个字：表里有的那些数用中文名（细 / 标准 / 中 / 粗…）；
   表外的那些数（微软雅黑那一张 Light 系统报 290、Segoe UI Semilight 报 350）不编中文名，
   直接用系统给那张脸起的档名 —— 界面上写成「290 · 290」是两句废话。 */
function ffWeightLabel(x){ return FF_WEIGHT_CN[x && x.w] || String((x && x.名) || (x && x.w) || ''); }
/* 钉的那一档在这一家底下没有对应的真脸时，屏幕上实际落到哪一档。
   走的是 CSS 自己那一条挑脸的顺序（不是我自己定的规矩）：要的那一档比 400 细，先往更细里找最靠近的，
   没有再往粗的那头挑；要的是 400 或更粗，先往粗的那头挑最近的，没有再往细的那头。
   拿这一个数只为把话说明白（「钉的是 500、这一家只到 400，屏幕上就按 400 走」），不动文件里那一栏。 */
function ffWeightLanded(要, 档){
  const ws = (档 || []).map(x => x.w).filter(w => w >= 100 && w <= 900).sort((a, b) => a - b);
  const 目标 = Math.round(+要 || 0);
  if(!ws.length || !目标 || ws.includes(目标)) return 目标;
  if(目标 < 400){ for(let w = 目标; w >= 100; w -= 100) if(ws.includes(w)) return w; return ws.find(w => w > 目标) || ws[ws.length - 1]; }
  const 上 = ws.find(w => w >= 目标);
  return 上 === undefined ? ws[ws.length - 1] : 上;
}

function ffQuote(name){ return "'" + String(name).replace(/['"\\]/g, '').trim() + "'"; }
/* 一个字体名 → 能直接写进 CSS 的那串；没选就是宿主原本的兜底栈 */
function ffStack(family, base){ return family ? ffQuote(family) + ',' + base : (base || 'inherit'); }
function ffFamily(file){
  return String(file).replace(FF_EXT, '')
    .replace(/[-_ ]?(regular|light|extralight|ultralight|thin|hairline|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy|italic|oblique|roman|\d{3,4})\b/gi, '')
    .replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || String(file);
}
function ffCss(css){
  if(document.getElementById('ff-style')) return;
  const n = document.createElement('style');
  n.id = 'ff-style';
  n.textContent = css;
  document.head.appendChild(n);
}

const Fonts = {
  sys:[], dir:[], marks:{}, pinned:[], used:{}, hidden:[],
  wmap:{},                                    /* 系统报的那份字重表：{ 名字:[{w,名}…] }，主进程 WPF 那一路数出来的 */
  read:false, busy:null, hooks:new Set(), faces:{}, pending:null, watched:false,
  async boot(){
    if(this.bootted) return;
    this.bootted = true;
    this.marks  = await State.get('font-mark', null) || {};
    this.pinned = await State.get('font-pin', null) || [];
    this.used   = await State.get('font-used', null) || {};
    this.hidden = await State.get('font-hide', null) || [];
    this.sys    = await State.get('font-sys', null) || [];
    this.wmap   = await State.get('font-w', null) || {};
    if(this.sys.length) this.read = true;
    await this.restoreDir();
    /* 开机这一趟主进程在后台重数本地字体（装了新字体不该等谁去点按钮），数完推一份新的过来：
       订上这一条，换上新的并把挂在页上那几块面板一起叫醒。只订一次。 */
    const a = this.app();
    if(a && typeof a.onFontList === 'function' && !this.watched){
      this.watched = true;
      a.onFontList(got => { try{ this.absorb(got); }catch(e){} });
    }
    /* 开机这中间 FD 就播过一份表过来：先记着，等本地这份读齐了再并 */
    if(this.pending) this.merge(this.pending);
  },
  app(){
    try{ if(window.FD_APP && typeof window.FD_APP.dataRead === 'function') return window.FD_APP; }catch(e){}
    return null;
  },
  /* Flow-Desk 程序里开机就能静默读到；本地开发那台服务器什么都不做，让界面摆那个按钮 */
  async auto(){
    await this.boot();
    if(this.read || this.busy) return this.sys;
    const a = this.app();
    if(a && typeof a.fontList === 'function'){ this.busy = this.take(() => a.fontList()); await this.busy; }
    return this.sys;
  },
  /* 那个按钮走的路：让 Flow-Desk 主进程重新数一遍（慢一点，但拿到的是刚装的） */
  async ask(){
    await this.boot();
    if(this.busy) return this.sys;
    const a = this.app();
    if(a && typeof a.fontList === 'function'){ this.busy = this.take(() => a.fontList(true)); await this.busy; }
    return this.sys;
  },
  /* 主进程那一份表进页面：{ fonts:[家名…], faces:{ 名字:[{w,名}…] } }。
     家名一颗一个（不再是一家底下的 Light / Medium 各算一族），字重表认名字（中英文都登记过）。 */
  absorb(got){
    const g = (got && typeof got === 'object' && Array.isArray(got.fonts)) ? got : { fonts:[], faces:{} };
    const set = [];
    for(const n of g.fonts){ const s = String(n || '').trim(); if(s && !set.includes(s)) set.push(s); }
    set.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    const 表 = {};
    for(const k in (g.faces || {})){
      const 档 = (g.faces[k] || []).map(x => ({ w:+(x && x.w), 名:String((x && x.名) || '') }))
        .filter(x => x.w >= 100 && x.w <= 1000);
      if(档.length) 表[String(k).trim()] = 档.sort((a, b) => a.w - b.w);
    }
    this.sys = set; this.wmap = 表; this.read = true;
    State.set('font-sys', set); State.set('font-w', 表);
    this.changed();
  },
  async take(get){
    try{
      const raw = await get();
      if(!raw || !Array.isArray(raw.fonts) || !raw.fonts.length) throw new Error('没读到字体清单');
      this.absorb(raw);
    }catch(e){
      toast('读系统字体失败：' + ((e && e.message) || e));
    }finally{ this.busy = null; }
  },
  /* ---------- 附加字体文件夹 ---------- */
  async pickDir(){
    let dir = null;
    try{ dir = await window.showDirectoryPicker({ id:'font-dir' }); }
    catch(e){ return; }
    await this.setDir(dir);
  },
  async setDir(dir){
    const found = [];
    for await (const fh of dir.values()){
      if(fh.kind !== 'file' || !FF_EXT.test(fh.name)) continue;
      const fam = ffFamily(fh.name);
      try{ await this.addFace(fam, await (await fh.getFile()).arrayBuffer(), fh.name); }
      catch(e){ continue; }
      if(!found.includes(fam)) found.push(fam);
    }
    this.dir = found;
    State.set('font-dir', dir);
    State.set('font-dir-names', found);
    this.changed();
    toast(found.length ? '附加字体：' + found.length + ' 款' : '这个文件夹里没有 ttf / otf / woff2');
  },
  async restoreDir(){
    this.dir = await State.get('font-dir-names', null) || [];
    let hd = null;
    try{ hd = await State.get('font-dir', null); }catch(e){ hd = null; }
    this.dirHandle = (hd && typeof hd.values === 'function') ? hd : null;
    if(!this.dirHandle) this.dir = [];
  },
  async clearDir(){
    for(const f of Object.keys(this.faces)){ document.fonts.delete(this.faces[f]); delete this.faces[f]; }
    this.dir = []; this.dirHandle = null;
    State.set('font-dir', null); State.set('font-dir-names', []);
    this.changed();
  },
  async addFace(fam, buf, filename){
    if(!window.FontFace) return;
    const fmt = /\.woff2$/i.test(filename) ? 'woff2' : /\.woff$/i.test(filename) ? 'woff'
      : /\.otf$/i.test(filename) ? 'opentype' : 'truetype';
    const face = new FontFace(fam, buf, { display:'swap' });
    await face.load();
    document.fonts.add(face);
    this.faces[fam] = face;
  },
  /* ---------- 三块列表 ---------- */
  all(){
    const out = [];
    for(const f of this.pinned) out.push({ f, g:'pin' });
    const seen = new Set(this.pinned);
    const recent = Object.keys(this.used).filter(f => !seen.has(f) && this.used[f] > 0)
      .sort((a, b) => this.used[b] - this.used[a]);
    for(const f of recent) out.push({ f, g:'use', n:this.used[f] });
    const rest = [...this.sys, ...this.dir].filter(f => !seen.has(f) && !recent.includes(f) && !this.isHidden(f));
    rest.sort((a, b) => (this.cnRank(a) - this.cnRank(b)) || a.localeCompare(b, 'zh-Hans-CN'));
    for(const f of rest) out.push({ f, g:'all' });
    return out;
  },
  /* 中文字体优先：认「中」那个点，没点过的按名字里有没有汉字粗排 */
  cnRank(f){ const m = this.marks[f]; return (m && m.zh) ? 0 : /[\u3400-\u9fff]/.test(f) ? 1 : 2; },
  mark(f){ return this.marks[f] || {}; },
  toggleMark(f, k){
    const m = Object.assign({}, this.mark(f));
    m[k] = m[k] ? 0 : 1;
    this.marks[f] = m;
    State.set('font-mark', this.marks);
    this.changed();
  },
  /* 屏蔽：本地装着、但软件里不想看见（作者的话：「屏蔽字体（本地存在、软件中不想显示）」）。
     只是不摆出来，不碰系统里那份字体文件；解屏蔽立刻回来。 */
  isHidden(f){ return this.hidden.includes(f); },
  hide(f){ if(this.isHidden(f)) return; this.hidden.push(f); State.set('font-hide', this.hidden);
    this.unpin(f); this.changed(); },
  unhide(f){ this.hidden = this.hidden.filter(x => x !== f); State.set('font-hide', this.hidden); this.changed(); },
  pin(f){
    if(this.pinned.includes(f)) return;
    /* 收藏就五格：满了不当场吞进去，也不偷偷挤掉已经进去的 —— 说清满了，让人自己先撤一个 */
    if(this.pinned.length >= FF_PIN_MAX){ (typeof toast === 'function') && toast('收藏已经满了 ' + FF_PIN_MAX + ' 个，先撤掉一个再收藏这个', true); return; }
    this.pinned.push(f);
    State.set('font-pin', this.pinned);
    this.changed();
  },
  unpin(f){
    this.pinned = this.pinned.filter(x => x !== f);
    State.set('font-pin', this.pinned);
    this.changed();
  },
  order(list){ this.pinned = list.slice(); State.set('font-pin', this.pinned); },
  use(f){ if(!f) return; this.used[f] = (this.used[f] || 0) + 1; State.set('font-used', this.used); },
  table(){ return { marks:this.marks, used:this.used, pinned:this.pinned }; },
  /* 嵌在 FD 里时两边共用这一份表：FD 播过来的那份并进来。
     只取并、取大、按 FD 的置顶顺序排在前面 —— 单向合并不会互相抹掉，所以不必回播。 */
  merge(r){
    if(!r || !this.bootted) return false;
    let ch = false;
    for(const f in (r.marks || {})){
      const m = Object.assign({}, this.mark(f), r.marks[f]);
      if(JSON.stringify(m) !== JSON.stringify(this.marks[f] || {})){ this.marks[f] = m; ch = true; }
    }
    for(const f in (r.used || {})) if((this.used[f] || 0) < r.used[f]){ this.used[f] = r.used[f]; ch = true; }
    const rp = (r.pinned || []).filter(f => f && !this.pinned.includes(f));
    if(rp.length){ this.pinned = [...new Set(rp.concat(this.pinned))]; ch = true; }
    if(ch){
      State.set('font-mark', this.marks); State.set('font-used', this.used); State.set('font-pin', this.pinned);
      this.changed();
    }
    return ch;
  },
  /* 清单变了（读到系统字体 / 换了附加文件夹 / 置顶改了）叫醒所有还挂在页上的面板 */
  changed(){ for(const fn of [...this.hooks]){ try{ fn(); }catch(e){ this.hooks.delete(fn); } } },
  /* 设置行左边那个小方块：当前字体自己的样子 */
  chip(family){
    return h('span', { class:'ff-chip', style:'font-family:' + ffStack(family, 'sans-serif') }, 'Aa');
  },
  /* ---------- 按语言那一份 ----------
     map = { 'zh-Hans':'宋体', 'en':'Times New Roman', ... }，空的那一档不挂。
     一条 @font-face 用 src:local(系统里那个名字) + 这一档自己的 unicode-range，
     全部共用 'Flow-Desk 按语言' 这一个假名：谁的字落在哪一段，浏览器自己挑那一条。
     返回那串样式表文本，交 ffCss 上屏（同一个 id 只挂一张，重挂就换内容）。 */
  langFaces(map){
    const out = [];
    for(const l of ffLangList()){
      const f = map && map[l.k];
      if(!f) continue;
      out.push('@font-face{font-family:' + ffQuote(FF_LANG_ALIAS) + ';src:local(' + ffQuote(f) +
        ');unicode-range:' + l.range + ';font-display:swap}');
    }
    return out.join('\n');
  },
  /* 全局字体栈：按语言那一份摆最前，后面接这一套方案自己钉的字体和底子 */
  langStack(map, base){
    const faces = this.langFaces(map);
    ffCss(faces || '/* 按语言没钉字体 */');
    return faces ? ffQuote(FF_LANG_ALIAS) + ',' + (base || '') : (base || '');
  },
  langs(){ return ffLangList(); },
  /* 一个字体家底下真有的那几档字重（从小到大）—— 数的是系统自己报的那张脸（主进程 WPF 那一份表），
     不再从字体名字尾巴猜（作者 2026-10-08：「你现在就换」）。
     表里没有它（附加文件夹里挂上来的、手输的名字）：本家那一张脸一定在，就给「标准 400」这一档，
     少了那一档界面上就成了一个空下拉。 */
  weightsOf(f){
    const 本家名 = String(f || '').trim();
    if(!本家名) return [];
    const 档 = this.wmap[本家名];
    if(档 && 档.length) return 档.slice();
    return [{ w:400, 名:'Regular' }];
  },
  /* 此刻屏幕上真正生效的那一个字体家（方案钉过吃钉的那个，没钉就是默认那一个） */
  nowFamily(cfg){ const f = String((cfg && cfg.font) || '').trim(); return f || FF_DEFAULT_FD; },
  /* 一个字体的信息（作者的话：「查看字体信息」）：只报程序真知道的这几样，不编 */
  info(f){
    const m = this.mark(f);
    const 档 = this.weightsOf(f);
    const rows = [['字体名', f || ''],
      ['这一家底下的字重', 档.map(x => ffWeightLabel(x) + ' ' + x.w).join('　')
        + (this.wmap[String(f || '').trim()] ? '' : '　—— 系统那张表里没读到这一家，这一行只有本家那一张脸')],
      ['认到的语言', FF_SCRIPTS.filter(x => m[x[0]]).map(x => x[1]).join('、') || '没标过'],
      ['来路', this.sys.includes(f) ? '系统字体' : (this.dir.includes(f) ? '附加文件夹' : '不在清单里（手输的名字）')],
      ['用过几次', String(this.used[f] || 0)],
      ['收藏', this.pinned.includes(f) ? '是（排第 ' + (this.pinned.indexOf(f) + 1) + ' 个）' : '否'],
      ['屏蔽', this.isHidden(f) ? '是' : '否']];
    const face = this.faces && this.faces[f];
    if(face) rows.push(['已加载', '是']);
    return rows;
  },
  /* 一个字体设定处的一整块：当前值 + 就地展开的清单。
     opt = { label, value, dflt, onSet(family) }；dflt 是没钉字体时那行字显示什么（说清在跟谁），
     onSet 只管套用，别关对话框。 */
  field(opt){
    const dflt = opt.dflt || '跟随默认';
    const wrap = h('div', { class:'ff-wrap' });
    const chip = this.chip(opt.value);
    const nm = h('span', { class:'ff-cur', title:opt.value || dflt }, opt.value || dflt);
    const drop = h('div', { class:'ff-drop' });
    const tog = h('button', { class:'wnw-btn mini', onclick:() => {
      if(drop.firstChild){ drop.innerHTML = ''; tog.textContent = '选字体'; return; }
      FontPick.panel(drop, {
        value:() => cur(),
        onSet:f => { set(f); }
      });
      tog.textContent = '收起';
    }}, '选字体');
    const clr = h('button', { class:'wnw-btn mini', onclick:() => set('') }, '不指定');
    let curVal = opt.value || '';
    const cur = () => curVal;
    const set = f => {
      curVal = f || '';
      chip.style.fontFamily = ffStack(curVal, 'sans-serif');
      nm.textContent = curVal || dflt;
      nm.title = curVal || dflt;
      clr.hidden = !curVal;
      Fonts.use(curVal);
      opt.onSet(curVal);
    };
    clr.hidden = !curVal;
    wrap.appendChild(h('div', { class:'ff-line' }, [chip, nm, tog, clr]));
    wrap.appendChild(drop);
    return wrap;
  }
};

/* 就地展开的那块清单：搜索 + 读字体/附加文件夹 + 三块列表 + 手输名字 */
const FontPick = {
  panel(host, opt){
    const box = h('div', { class:'ff-pick' });
    const list = h('div', { class:'ff-list' });
    const qi = h('input', { class:'wnw-input', type:'search', placeholder:'打字找字体', style:'flex:1 1 auto;min-width:0' });
    const draw = () => {
      if(!box.isConnected){ Fonts.hooks.delete(draw); return; }
      list.innerHTML = '';
      const q = qi.value.trim().toLowerCase();
      const sel = opt.value();
      let g = '';
      for(const it of Fonts.all()){
        if(q && !it.f.toLowerCase().includes(q)) continue;
        if(it.g !== g){
          g = it.g;
          list.appendChild(h('div', { class:'ff-grp' }, g === 'pin' ? '置顶 · 可拖序'
            : g === 'use' ? '常用' : '全部 · 中文字体在前'));
        }
        list.appendChild(ffRow(it, sel, f => { opt.onSet(f); draw(); }));
      }
      if(!list.querySelector('.ff-row')) list.appendChild(h('div', { class:'wnw-hint', style:'padding:10px 6px' },
        Fonts.read ? '没有匹配的字体' : '还没读到系统字体：点上面「读系统字体」，或在下面直接填字体名'));
    };
    qi.addEventListener('input', draw);
    Fonts.hooks.add(draw);

    const top = h('div', { class:'ff-top' });
    top.appendChild(qi);
    const sysBtn = h('button', { class:'wnw-btn mini', onclick:async () => {
      sysBtn.disabled = true; await Fonts.ask(); sysBtn.disabled = false;
      sysBtn.textContent = ffSysLabel(); draw();
    }}, ffSysLabel());
    top.appendChild(sysBtn);
    const dirBtn = h('button', { class:'wnw-btn mini', onclick:async () => {
      await Fonts.pickDir(); dirBtn.textContent = ffDirLabel(); clearBtn.hidden = !Fonts.dir.length; draw();
    }}, ffDirLabel());
    top.appendChild(dirBtn);
    const clearBtn = h('button', { class:'wnw-btn mini', onclick:() => { Fonts.clearDir(); dirBtn.textContent = ffDirLabel(); clearBtn.hidden = true; draw(); } }, '去掉附加');
    clearBtn.hidden = !Fonts.dir.length;
    top.appendChild(clearBtn);
    const mine = h('input', { class:'wnw-input', placeholder:'或者直接填字体名', style:'flex:1 1 10em;min-width:8em' });
    const man = h('div', { class:'ff-man' }, [mine,
      h('button', { class:'wnw-btn mini', onclick:() => {
        const f = mine.value.trim();
        if(!f) return;
        Fonts.pin(f); mine.value = ''; opt.onSet(f); draw();
      }}, '置顶并用它')]);

    box.appendChild(top);
    box.appendChild(h('div', { class:'ff-top' }, [man]));
    box.appendChild(list);
    box.appendChild(h('div', { class:'ff-foot' },
      [h('span', { class:'wnw-hint' }, '圆点固定色：中绿 · 日蓝 · 韩粉 · 英橙')]));
    host.appendChild(box);
    draw();
    return box;
  }
};
function ffSysLabel(){ return Fonts.sys.length ? '重读系统字体（' + Fonts.sys.length + '）' : '读系统字体'; }
function ffDirLabel(){ return Fonts.dir.length ? '换附加文件夹（' + Fonts.dir.length + '）' : '附加字体文件夹'; }

function ffRow(it, sel, onSel){
  const f = it.f;
  const row = h('div', { class:'ff-row' + (it.g === 'pin' ? ' pin' : '') + (f === sel ? ' on' : ''), 'data-ff':f,
    title:'用这个字体', onclick:() => onSel(f) });
  if(it.g === 'pin'){
    row.draggable = true;
    row.appendChild(h('span', { class:'ff-grip', title:'按住拖到想要的位置', html:icoMarkup('sort') }));
    row.addEventListener('dragstart', () => row.classList.add('drag'));
    row.addEventListener('dragend', () => { row.classList.remove('drag'); ffDropCommit(row); });
    row.addEventListener('dragover', e => {
      const src = document.querySelector('.ff-row.drag');
      /* 四档能各开一块清单，只在本块里换位置，别把另一块的行拽过来 */
      if(!src || src === row || src.parentNode !== row.parentNode) return;
      e.preventDefault();
      const r = row.getBoundingClientRect();
      row.parentNode.insertBefore(src, e.clientY < r.top + r.height / 2 ? row : row.nextSibling);
    });
  }
  row.appendChild(h('span', { class:'ff-prev', style:'font-family:' + ffStack(f, 'sans-serif') }, FF_PREVIEW));
  row.appendChild(h('span', { class:'ff-nm', title:f }, f + (it.g === 'use' ? ' · 用过 ' + it.n + ' 次' : '')
    + (Fonts.dir.includes(f) ? ' · 附加' : '')));
  const dots = h('span', { class:'ff-dots' });
  for(const [k, lab, col] of FF_SCRIPTS){
    const on = !!Fonts.mark(f)[k];
    dots.appendChild(h('button', { class:'ff-dot' + (on ? ' on' : ''), title:lab + '（点一下' + (on ? '取消' : '标上') + '）',
      style:'--ff-dot:' + col, onclick:e => {
        e.stopPropagation();
        Fonts.toggleMark(f, k);
        e.target.classList.toggle('on', !!Fonts.mark(f)[k]);
      } }));
  }
  row.appendChild(dots);
  if(it.g === 'pin')
    row.appendChild(h('button', { class:'ff-x', title:'不再置顶', html:icoMarkup('close'),
      onclick:e => { e.stopPropagation(); Fonts.unpin(f); } }));
  return row;
}
/* 拖完把 DOM 顺序写回置顶表。只认这一块列表；搜索框滤过之后可见的置顶行不齐，那就别写 */
function ffDropCommit(row){
  const box = row && row.parentNode;
  if(!box || !box.querySelectorAll) return;
  const names = [...box.querySelectorAll('.ff-row.pin')].map(r => r.dataset.ff).filter(Boolean);
  if(names.length === Fonts.pinned.length) Fonts.order(names);
}

ffCss(`
.ff-wrap{display:flex;flex-direction:column;gap:8px;min-width:0;flex:1 1 auto;}
.ff-line{display:flex;gap:8px;align-items:center;min-width:0;}
.ff-line .ff-cur{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
/* 字号预览那一格和下拉里那一叠：宽度钉死 1px，跟着 --bw 走就在质感那一档没框。
   里面那一块容器进外观层的表面名单（src\_shared\sh-look.js 的 SURF），底色归那一层画。 */
.ff-chip{display:inline-block;min-width:1.9em;text-align:center;font-size:1.15em;line-height:1.4;
  border:1px solid var(--hair-color);border-radius:var(--r-btn,5px);padding:0 4px;background:var(--input-bg);}
.ff-drop:not(:empty){border:var(--bw,1px) solid var(--card-border);border-radius:var(--r-card,5px);
  padding:8px;}
.ff-pick{display:flex;flex-direction:column;gap:8px;}
.ff-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.ff-man{display:flex;gap:6px;flex:1 1 16em;min-width:12em;}
.ff-list{max-height:44vh;min-height:8em;overflow:auto;padding:2px;}
/* 钉住在列表顶部那一行组名：底色得跟它身后那块面一模一样，否则滚过去的字会从半截颜色底下穿出来 */
.ff-grp{font-size:.78em;color:var(--text-light);padding:6px 8px 2px;position:sticky;top:0;background:var(--face-solid,var(--card-bg));}
.ff-row{display:flex;align-items:center;gap:10px;padding:5px 8px;border-radius:var(--r-btn,5px);cursor:pointer;}
.ff-row:hover{background:var(--candidate-bg);}
.ff-row.on{background:var(--sel-bg);color:var(--sel-text);}
.ff-row.drag{opacity:.4;}
.ff-grip{color:var(--text-light);cursor:grab;}
.ff-prev{flex:0 0 8.5em;font-size:1.25em;line-height:1.3;overflow:hidden;white-space:nowrap;}
.ff-nm{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ff-dots{display:flex;gap:5px;flex:0 0 auto;}
.ff-dot{width:12px;height:12px;padding:0;border-radius:50%;cursor:pointer;border:1px solid var(--ctl-edge,var(--input-border));background:transparent;}
.ff-dot.on{background:var(--ff-dot);border-color:var(--ff-dot);}
.ff-x{border:0;background:transparent;color:var(--text-light);cursor:pointer;font:inherit;padding:0 4px;}
.ff-x:hover{color:var(--bad,#c0453a);}
.ff-foot{display:flex;gap:10px;align-items:center;}
`);
