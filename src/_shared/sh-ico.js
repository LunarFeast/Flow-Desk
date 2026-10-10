/* ============================================================
   图标：一套纯线条形状，只描边、不填充、不拟物，颜色跟着字色走
   （按钮选中时字色变成主题色，图标自己就跟着变了）。

   这一版把形状从代码里搬到文件里：树根 icons\ 一个文件夹装全站所有图标，
   一个图标一个文件，文件名就是代码里叫的名字（undo.svg、close.svg…）。
   icons\ 下面还能开一层子文件夹，那一层里的名字念作「文件夹名-文件名」；只认一层。
   还有一处也并进同一张表：数据\images\ —— 他自己导进来的那些图（外29 丁组 图片库），
   念作「images-<文件名>」；同名时 icons\ 里那一张赢，界面上那些正经图标不该被他导的一张图顶掉。
   SVG 走遮罩（mask）+ currentColor，所以换肤时跟着字色走；
   PNG / JPG 也认，那种就是原样贴上去，颜色以图里画的为准。

   改图不用重启：主进程盯着这个文件夹，文件一落地就把新地址播给所有窗口，
   窗口这边只换一张样式表，屏幕上已经画出来的图标当场跟着换。
   插件的图标不住公共文件夹，住在自己包里的 images\ 那格
   （data\plugins\<包>\images\icon.svg），名字记成 pack-<包名>。

   这一棵里没有主进程那层桥时（本地开发那台服务器）读不到 icons\，就退回本文件末尾那份出厂线稿，
   长相和文件夹里的默认那批一模一样。
   ============================================================ */
const Ico = {
  files:{},        // 名字 → 主进程给的 fdapp:// 地址（已经带全路径）
  rev:0,           // 每次重扫加一号，挂在地址尾巴上，页面就没法拿老缓存
  boot(){
    if(typeof document === 'undefined') return;
    this.el = document.getElementById('fd-ico-style');
    if(!this.el){
      this.el = document.createElement('style');
      this.el.id = 'fd-ico-style';
      (document.head || document.documentElement).appendChild(this.el);
    }
    this.css();
  },
  /* 主进程扫完 icons\ 和各个包的 images\ 递过来的一份表；换肤、装卸包都重走这一趟 */
  scan(list){
    this.files = list || {};
    this.rev++;
    this.css();
    /* 屏幕上已经画出来的那些也当场重画一遍：
       往 icons\ 丢一张 close.svg、或者把包里那张换掉，不用等下一次刷新页面就变。 */
    this.refresh();
  },
  refresh(){
    if(typeof document === 'undefined') return;
    let els = null;
    try{ els = document.querySelectorAll('[data-ico],[data-icofix]'); }catch(e){ return; }
    for(const el of els){
      if(el.hasAttribute('data-ico')) icoPaint(el);
      if(el.hasAttribute('data-icofix')) icoFix(el);
    }
    /* CSS 伪元素借走的那几张（拖放提示条上的箭头）：CSS 变量挂在这个宿主元素身上，
       换图重扫之后也得把新地址补回去，不然伪元素还指着旧那张 */
    try{ for(const el of document.querySelectorAll('[data-icofix]')) icoFix(el); }catch(e){}
  },
  has(name){ return !!this.files[name]; },
  /* 要一张图的真地址，不画到元素上：纹理那几层是把图交给 CSS 变量（见 _shared/sh-look.js）。
     地址尾巴带上当初的写入时间，再加一轮 rev —— 和上面 css() 里同一套算法，换图当场作数。
     icons\ 里没这一张（或者这一棵根本读不到 icons\）就交回空字符串，让调用方自己决定不上。 */
  url(name){
    const u = String(this.files[name] || '');
    if(!u) return '';
    return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'v=' + this.rev;
  },
  /* Flow-Desk 和 Why Not Write 开机都走这一句：有主进程那层桥时 icons\ 可读就读文件，
     没有那层桥（本地开发那台服务器）读不到，就一辈子用本文件末尾那份出厂线稿，长相一样。 */
  bridge:null,
  link(api){
    this.bridge = (api && typeof api.iconsList === 'function') ? api : null;
    if(!this.bridge) return;
    const go = t => this.scan(t);
    try{ this.bridge.iconsList().then(go, () => {}); }catch(e){}
    if(typeof api.onIcons === 'function'){ try{ api.onIcons(go); }catch(e){} }
  },
  /* 再要一次清单（外29 丁组）：刚往 data\images\ 落了一张图，主进程盯文件夹那趟广播要绕一圈才回来，
     开发那台服务器更没有广播这一路 —— 导完图当场问一次，那张图才铺得上、也不至于被判成「图没找到」。
     程序里问主进程，这一台问 /_icons：两边回的是同一张表、同一个形状，不用分叉写两遍。 */
  async reloadList(){
    try{
      let list = null;
      if(this.bridge) list = await this.bridge.iconsList();
      else if(typeof fetch === 'function') list = await (await fetch('/_icons', { cache:'no-store' })).json();
      if(list && typeof list === 'object'){ this.scan(list); return list; }
    }catch(e){}
    return null;
  },
  css(){
    if(!this.el) return;
    let s = ICO_CSS;
    for(const name in this.files){
      const u = String(this.files[name] || '');
      /* 主进程给的地址已经带了文件自己的写入时间（同名换图也认得出来），
         这里再加一轮 rev：装卸包、换肤重扫一遍时旧缓存也留不住。 */
      const url = u + (u.indexOf('?') >= 0 ? '&' : '?') + 'v=' + this.rev;
      const sel = '.i-' + cssName(name);
      /* 位图不遮：贴原图，颜色就是图里的颜色；矢量遮一层 alpha，颜色吃字色 */
      if(/\.(png|jpe?g|webp|gif)(\?|$)/i.test(u))
        s += sel + '{background:transparent url("' + url + '") no-repeat center/contain}';
      else
        s += sel + '{background:currentColor;-webkit-mask-image:url("' + url + '");mask-image:url("' + url + '");' +
          '-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;' +
          '-webkit-mask-size:contain;mask-size:contain;mask-mode:alpha}';
    }
    this.el.textContent = s;
  }
};
function cssName(n){ return String(n).replace(/[^a-zA-Z0-9_-]/g, '-'); }
/* ---------- 老数据里存的是字符，不是名字 ----------
   模板图标、功能注册表这些字段，这些年存下来是一份 ▣ ⛃ ★ ⇄ 那样的字符表；
   磁盘上的老副本不改，页面上照旧得画成图 —— 所以字符也认，先换成名字再找图。
   要改字段值本身（存成名字）就改 icons\ 里的文件，两边都指向同一张图。 */
const GLYPH_ALIAS = {
  '▤':'log', '▣':'card', '⛃':'tpl', '✦':'idea', '⚯':'board', '◈':'tag', '⌕':'findAll',
  '☰':'list', '≣':'stats', '▦':'grid', '✎':'pencil', '♫':'music', '❝':'quote',
  '⇄':'swap', '⌨':'keyboard', '◉':'slot', '⌖':'slot', '★':'star', '☆':'starOff',
  '×':'close', '✕':'close', '＋':'plus', '⋮':'kebab', '▾':'caretDown', '▸':'caretRight',
  '▲':'caretUp', '▼':'caretDown', '◀':'caretLeft', '▶':'caretRight', '◂':'caretLeft',
  '︿':'caretUp', '﹀':'caretDown', '﹥':'caretRight', '↺':'imp', '◐':'slot', '⛶':'expand',
  '✓':'check', '☑':'check', '☐':'box', '•':'bullet',
  '⇥':'dock', '↻':'cycle', '⟳':'cycle', '↑':'up', '↓':'down', '⚙':'gear', '⋈':'rel', '¶':'pilcrow',
  '−':'minus', '－':'minus', '‹':'prev', '›':'next', '⌂':'home', '⇤':'imp', '⤓':'exp', '⤒':'plus', '⠿':'grip',
  '⇅':'sort', '↔':'swap'
};
function icoName(x){ const s = String(x == null ? '' : x).trim(); return GLYPH_ALIAS[s] || s; }
/* 一个图标元素长什么样：外层永远是同一个 span（挂 data-ico，方便换图时找回来），
   icons\ 里有那张图就用样式表贴上去；没有就把本文件末尾的出厂线稿画在里面顶一下。 */
function icoClass(n, extra){
  const keep = String(extra || '').split(/\s+/).filter(x => x && x !== 'w-ico' && !/^i-/.test(x));
  return ('w-ico' + (Ico.has(n) ? ' i-' + cssName(n) : '') + (keep.length ? ' ' + keep.join(' ') : '')).trim();
}
function icoInner(n){
  if(Ico.has(n)) return '';
  const d = ICO_D[n];
  if(!d) return '';
  return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" ' +
    'stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
}
function attrEsc(s){ return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
/* 画一张图标：有文件就交给样式表（.i-名字），没文件才现写一段出厂线稿 */
function icoMarkup(name, cls){
  const n = icoName(name);
  if(!Ico.has(n) && !ICO_D[n]) return '';
  return '<span class="' + icoClass(n, cls) + '" data-ico="' + attrEsc(name) + '" aria-hidden="true">' + icoInner(n) + '</span>';
}
/* 换图落地之后，把屏上每一个图标按新清单重画：文件名照旧、类名和里面的内容跟着变 */
function icoPaint(el){
  const n = icoName(el.getAttribute('data-ico'));
  el.className = icoClass(n, el.getAttribute('class'));
  el.innerHTML = icoInner(n);
}
/* 伪元素用图：CSS 选择器点不到 icons\ 里的文件，把地址挂成 CSS 变量交给宿主元素，
   ::before 拿 var(--ico) 去遮罩；这一位画的是光箭头（图标就在伪元素里，元素本身是空的，
   所以不挂 data-ico —— 那口子是给真图标元素重画 innerHTML 用的，冲这儿来会把它清空）。
   icons\ 里没这张（或者这一棵根本读不到 icons\）就什么都不挂，样式里 content 兜底的那个字符顶上。
   data-icofix 记的是名字，换图重扫时按它补。 */
function icoFix(el){
  const n = icoName(el.getAttribute('data-icofix') || '');
  const u = n && Ico.files[n];
  if(!u){ el.style.removeProperty('--ico'); return; }
  const s = String(u);
  el.style.setProperty('--ico', 'url("' + s + (s.indexOf('?') >= 0 ? '&' : '?') + 'v=' + Ico.rev + '")');
}
/* 一个功能 / 一个包露脸的那一张：包自己 images\ 里那张（pack-<包名>）优先，
   其次注册表里给的名字或老字符，两个都没有才用那张通用的牌。
   注册名有时带 tool- 前缀（外壳那一层加的），插件清单里是光板 id，两边都试一遍。 */
function icoFor(id, name){
  const tryId = x => { const p = 'pack-' + cssName(x || ''); return Ico.has(p) ? p : ''; };
  let hit = tryId(id);
  if(!hit && typeof id === 'string' && id.indexOf('tool-') === 0) hit = tryId(id.slice(5));
  if(hit) return icoMarkup(hit);
  const n = icoName(name);
  if(Ico.has(n) || ICO_D[n]) return icoMarkup(n);
  return icoMarkup('card');
}

/* 摆到 h() 上 just 用：h('button', icoProps('undo','撤回', fn), ...) 之外不再塞字 */
function icoProps(name, tip, onclick){
  return { class:'w-ib', title:tip, 'aria-label':tip, html:icoMarkup(name), onclick };
}
/* 组名前面那个说明符号：不是按钮，就是个说明 */
function icoMark(name, tip){
  return h('span', { class:'w-mk', title:tip, html:icoMarkup(name) });
}
const ICO_CSS = `
/* 图标一律按字走：inline-block 才能和旁边的文字同一行；
   放进弹性容器（列表行、标题条）时会被自动当成弹性项，跟原来一样稳。
   底色不写在公共规则里：有图片时由下面生成的那一条上色（遮罩吃的是这块底色），
   没图片时里面是出厂线稿的 <svg>，自己描边，不需要底。 */
.w-ico{width:1.18em;height:1.18em;display:inline-block;vertical-align:-.22em;flex:0 0 auto}
.w-ico>svg{width:100%;height:100%;display:block}
.w-ib{display:inline-flex;align-items:center;justify-content:center;min-width:2.05em}
.w-txt{display:inline-flex;align-items:center;gap:.34em}
.w-mk{display:inline-flex;align-items:center;opacity:.62;padding:0 .1em}
`;
/* 出厂线稿：icons\ 里的默认那批就是这一份导出去的（node src/_build/ico-dump.mjs）。
   只有读不到 icons\ 那一层时才用（本地开发那台服务器），Flow-Desk 程序里一律走文件。 */
const ICO_D = {
  /* ---- 动作条 ---- */
  undo:'<path d="M8 5 4.4 8.6 8 12.2"/><path d="M4.4 8.6h7.4a4.3 4.3 0 0 1 0 8.6H7.6"/>',
  redo:'<path d="M12 5 15.6 8.6 12 12.2"/><path d="M15.6 8.6H8.2a4.3 4.3 0 0 0 0 8.6h4.2"/>',
  anno:'<path d="M3.2 4.2h13.6v9H9.6l-4 3.2V13.2H3.2z"/><path d="M6 7.4h8M6 10h5.4"/>',
  rev:'<path d="M2.8 16.6h14.4"/><path d="M11.6 3.8 16 8.2 8.6 15.6l-4.8.6.6-4.8z"/>',
  pencil:'<path d="M12.4 3.4 16.6 7.6 8.8 15.4l-4.9.9.9-4.9z"/><path d="M10.6 5.2 14.8 9.4"/>',
  findBook:'<circle cx="8.6" cy="8.6" r="4.8"/><path d="M12.2 12.2 17 17"/>',
  findAll:'<circle cx="10" cy="10" r="6.4"/><path d="M3.6 10h12.8"/><path d="M10 3.6c2.3 3.4 2.3 9.4 0 12.8M10 3.6c-2.3 3.4-2.3 9.4 0 12.8"/>',
  speak:'<path d="M3 7.8h3l3.8-3.2v9.8L6 11.4H3z"/><path d="M12.8 7.4a3.8 3.8 0 0 1 0 5.2M15.4 5a7.2 7.2 0 0 1 0 10"/>',
  ver:'<circle cx="9.6" cy="10.6" r="6.2"/><path d="M9.6 7.4v3.4l2.6 1.6"/><path d="M3.4 6.2 4.8 3.2 7.8 4.4"/>',
  exp:'<path d="M10 3v8.6"/><path d="M6.8 8.4 10 11.6l3.2-3.2"/><path d="M3.2 14v3h13.6v-3"/>',
  /* 整本导出：一本摊开的书，和「导出本章」那支下箭头分开 */
  expBook:'<path d="M2.8 4.6h5.4c1.1 0 1.8.8 1.8 1.9v8.9c0-1-.7-1.8-1.8-1.8H2.8z"/><path d="M17.2 4.6h-5.4c-1.1 0-1.8.8-1.8 1.9v8.9c0-1 .7-1.8 1.8-1.8h5.4z"/>',
  tidy:'<path d="M3.4 16.6 11 9"/><path d="M11.4 4.2 16 8.8 12.6 12.2 8 7.6z"/><path d="M15.4 12.6l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z"/>',
  /* ---- 对齐：五条线，Word 就是这个意思 ---- */
  'al-left':'<path d="M2.8 4.6h14.4M2.8 8.4h8.4M2.8 12.2h14.4M2.8 16h8.4"/>',
  'al-center':'<path d="M2.8 4.6h14.4M5.8 8.4h8.4M2.8 12.2h14.4M5.8 16h8.4"/>',
  'al-right':'<path d="M2.8 4.6h14.4M8.8 8.4h8.4M2.8 12.2h14.4M8.8 16h8.4"/>',
  'al-ju':'<path d="M2.8 4.6h14.4M2.8 8.4h14.4M2.8 12.2h14.4M2.8 16h14.4"/>',
  /* ---- 缩进 / 行距 / 段距 / 空行：四组各一张，别混成一团 ---- */
  indent:'<path d="M6.6 4.4h10.6M2.8 9.8h14.4M2.8 15.4h14.4"/><path d="M2.6 2.4v4M2.6 2.4l2.8 2-2.8 2"/>',
  lh:'<path d="M2.8 3.6h11M2.8 8h11M2.8 12.4h11M2.8 16.8h11"/><path d="M16.8 3.6v13.2M15 5.6 16.8 3.6l1.8 2M15 14.6l1.8 2 1.8-2"/>',
  pg:'<path d="M2.8 3.4h9.4M2.8 6.6h9.4M2.8 13.4h9.4M2.8 16.6h9.4"/><path d="M15.8 3.4v13.2M14 5.4l1.8-2 1.8 2M14 14.6l1.8 2 1.8-2"/>',
  blank:'<path d="M2.8 3.4h11.4M2.8 6.6h11.4M2.8 13.4h11.4M2.8 16.6h11.4"/><path d="M17.4 3.4v13.2"/><path d="M6.4 9.2h4.2"/>',
  /* ---- 字号：一大一小两个 A ---- */
  size:'<path d="M2.4 16.4 6.6 4.4l4.2 12M3.8 12.8h5.6"/><path d="M12.8 16.4 15.6 8.6l2.8 7.8M13.7 14h3.8"/>',
  /* ---- 栏宽：一个框里套一块版心 ---- */
  'w-mid':'<path d="M2.6 3.6h14.8v12.8H2.6z"/><path d="M6.4 6.8h7.2v6.4H6.4z"/>',
  'w-fill':'<path d="M2.6 3.6h14.8v12.8H2.6z"/><path d="M4.6 6.8h10.8v6.4H4.6z"/>',
  'w-cut':'<path d="M2.6 3.6h14.8v12.8H2.6z"/><path d="M7.4 13.6l4.6-4.6 2.2 2.2-4.6 4.6-2.8.6z"/>',
  /* ---- 块类型里能画成图的两个 ---- */
  ul:'<circle cx="4.2" cy="5.4" r="1.2"/><circle cx="4.2" cy="10" r="1.2"/><circle cx="4.2" cy="14.6" r="1.2"/><path d="M7.6 5.4h9.6M7.6 10h9.6M7.6 14.6h9.6"/>',
  todo:'<rect x="2.8" y="4.4" width="11.4" height="11.4" rx="2"/><path d="M5.6 10.2 8 12.6l3.8-4.4"/><path d="M16.6 7.2h1.4M16.6 13h1.4"/>',
  /* ---- 富文本那几个：链接 / 清格式 / 图片 / 表格 ---- */
  link:'<path d="M8.4 11.6 11.6 8.4"/><path d="M10.2 6.6 11.8 5a3.7 3.7 0 0 1 5.2 5.2l-1.6 1.6"/><path d="M9.8 13.4 8.2 15A3.7 3.7 0 0 1 3 9.8l1.6-1.6"/>',
  clear:'<path d="M5.6 16.4h11.6"/><path d="M4 12 9.6 6.4l4.8 4.8-4 4H6.4z"/>',
  img:'<rect x="2.6" y="4" width="14.8" height="12" rx="1.6"/><circle cx="6.8" cy="8" r="1.4"/><path d="M3.4 14.6 7.8 10.4l2.8 2.8 2.6-2.4 3.6 3.4"/>',
  tbl:'<rect x="2.6" y="4" width="14.8" height="12" rx="1.2"/><path d="M2.6 8h14.8M2.6 12h14.8M7.6 4v12M12.4 4v12"/>',
  /* ---- 左侧那一竖条 ---- */
  home:'<path d="M3 9 10 3.2 17 9"/><path d="M4.8 8.2v8.6h10.4V8.2"/><path d="M8.2 16.8v-5h3.6v5"/>',
  list:'<path d="M6.4 5h10M6.4 10h10M6.4 15h10"/><path d="M3.2 5h.9M3.2 10h.9M3.2 15h.9"/>',
  grid:'<rect x="2.8" y="2.8" width="6.4" height="6.4" rx="1.2"/><rect x="10.8" y="2.8" width="6.4" height="6.4" rx="1.2"/><rect x="2.8" y="10.8" width="6.4" height="6.4" rx="1.2"/><rect x="10.8" y="10.8" width="6.4" height="6.4" rx="1.2"/>',
  idea:'<path d="M10 2.8a5.2 5.2 0 0 1 3 9.4v2H7v-2a5.2 5.2 0 0 1-3-9.4"/><path d="M8.2 16.8h3.6M8.8 18.6h2.4"/>',
  board:'<circle cx="5" cy="5.4" r="2.2"/><circle cx="15" cy="8" r="2.2"/><circle cx="8.4" cy="15.4" r="2.2"/><path d="M6.9 6.4 12.9 7.4M6.2 7.4 7.8 13.2M13.4 9.8l-3.8 4.2"/>',
  /* 标签：一个横放的牌子，右边收成一个尖，靠头一个小孔 */
  tag:'<path d="M3.2 4.6h8.6l4.6 5.4-4.6 5.4H3.2z"/><circle cx="6.4" cy="10" r="1.4"/>',
  bank:'<path d="M3 7.4h14v9.2H3z"/><path d="M3 7.4 10 3l7 4.4"/><path d="M6.6 10.4v3.4M10 10.4v3.4M13.4 10.4v3.4"/>',
  log:'<path d="M4 3.4h12v13.2H4z"/><path d="M7 7h6M7 10h6M7 13h4"/><path d="M2.6 6.4v9.2a1 1 0 0 0 1 1h1.4"/>',
  gear:'<circle cx="10" cy="10" r="3.2"/><path d="M10 2.6v2.2M10 15.2v2.2M2.6 10h2.2M15.2 10h2.2M4.8 4.8l1.6 1.6M13.6 13.6l1.6 1.6M15.2 4.8l-1.6 1.6M6.4 13.6l-1.6 1.6"/>',
  /* ---- 停靠标题条上那两个 ---- */
  code:'<path d="M7 5.6 3.2 10 7 14.4M13 5.6 16.8 10 13 14.4"/>',
  pin:'<path d="M8.2 2.8h3.6l-.7 4.4 3.3 3.2H5.6l3.3-3.2z"/><path d="M10 10.4v6.8"/>',
  /* ---- 列表里这一项露不露：眼睛睁开 = 在列表里，闭上 = 已隐藏 ---- */
  eye:'<path d="M2.4 10c2.7-3.5 5.2-5.2 7.6-5.2s4.9 1.7 7.6 5.2c-2.7 3.5-5.2 5.2-7.6 5.2S5.1 13.5 2.4 10z"/><circle cx="10" cy="10" r="2.3"/>',
  eyeOff:'<path d="M2.4 10c2.7-3.5 5.2-5.2 7.6-5.2s4.9 1.7 7.6 5.2c-2.7 3.5-5.2 5.2-7.6 5.2S5.1 13.5 2.4 10z"/><path d="M4.4 4.4 15.6 15.6"/>',
  /* ---- 自绘标题栏：菜单那一个 + 窗口角上那三个 ---- */
  menu:'<path d="M3.6 6h12.8M3.6 10h12.8M3.6 14h12.8"/>',
  winMin:'<path d="M4.6 10.4h10.8"/>',
  winMax:'<rect x="4.6" y="4.6" width="10.8" height="10.8" rx="1.8"/>',
  winRestore:'<rect x="4.6" y="6.8" width="8.6" height="8.6" rx="1.6"/><path d="M6.8 6.8V4.6h8.6v8.6h-2.2"/>',
  winClose:'<path d="M5.2 5.2 14.8 14.8M14.8 5.2 5.2 14.8"/>',
  /* ---- 这一批是原来拿字符顶上的那些：设定卡、模板、音乐、句子、换色、展开…… ---- */
  close:'<path d="M5.4 5.4 14.6 14.6M14.6 5.4 5.4 14.6"/>',
  card:'<rect x="3" y="4.2" width="14" height="11.6" rx="1.8"/><path d="M3 8.2h14"/><path d="M5.8 11.2h5.4M5.8 13.4h3.4"/>',
  tpl:'<rect x="3" y="3.4" width="14" height="13.2" rx="1.8"/><path d="M3 7.6h14M7.4 7.6v9"/><path d="M10.4 10.6h3.6M10.4 13.2h3.6"/>',
  music:'<circle cx="6.6" cy="14.4" r="2.4"/><circle cx="14.4" cy="12.6" r="2.4"/><path d="M9 14.4V5.2l7.8-1.8v9.2"/><path d="M9 7.6l7.8-1.8"/>',
  swap:'<path d="M3.4 7.4h11.2M12 4.6l2.8 2.8-2.8 2.8"/><path d="M16.6 13.2H5.4M8 10.4 5.2 13.2 8 16"/>',
  keyboard:'<rect x="2.4" y="5.6" width="15.2" height="9.2" rx="1.8"/><path d="M5.4 8.6h.9M8.2 8.6h.9M11 8.6h.9M13.8 8.6h.9M6.6 12h7"/>',
  quote:'<path d="M4 12.4a3.4 3.4 0 1 1 3.4-4.6c0 3.6-1.4 5.6-3.4 6.6z"/><path d="M11.4 12.4a3.4 3.4 0 1 1 3.4-4.6c0 3.6-1.4 5.6-3.4 6.6z"/>',
  slot:'<circle cx="10" cy="10" r="6.8"/><path d="M10 3.2v13.6a6.8 6.8 0 0 0 0-13.6z" fill="currentColor" stroke="none"/>',
  expand:'<path d="M3.4 7.6V3.4h4.2M16.6 7.6V3.4h-4.2M3.4 12.4v4.2h4.2M16.6 12.4v4.2h-4.2"/>',
  caretDown:'<path d="M5.4 8 10 12.6 14.6 8"/>',
  caretRight:'<path d="M8 5.4 12.6 10 8 14.6"/>',
  box:'<rect x="3.6" y="3.6" width="12.8" height="12.8" rx="2.2"/>',
  grip:'<circle cx="7.6" cy="5.6" r="1.1"/><circle cx="12.4" cy="5.6" r="1.1"/><circle cx="7.6" cy="10" r="1.1"/><circle cx="12.4" cy="10" r="1.1"/><circle cx="7.6" cy="14.4" r="1.1"/><circle cx="12.4" cy="14.4" r="1.1"/>',
  imp:'<path d="M10 16V2.6"/><path d="M6.8 11.8 10 15l3.2-3.2"/><path d="M3.2 17.4h13.6"/>',
  check:'<path d="M4 10.6 8.2 14.8 16 5.6"/>',
  cross:'<path d="M5.2 5.2 14.8 14.8M14.8 5.2 5.2 14.8"/>',
  disk:'<circle cx="10" cy="10" r="6.6"/><path d="M10 4.6a5.4 5.4 0 1 1-5.2 6.8"/><path d="M4.2 7.4 4.8 11.6l4-1.2"/>',
  /* ---- 这一批是第二批补上的：分屏 / 新建 / 章节菜单 / 星标 / 日历 / 柱图 / 关系 ---- */
  split:'<rect x="2.6" y="4" width="14.8" height="12" rx="1.6"/><path d="M9.6 4v12"/><path d="M4.8 8.2h2.8M4.8 11.4h2.8"/><path d="M11.8 8.2h2.8M11.8 11.4h2.8"/>',
  plus:'<path d="M10 4.2v11.6M4.2 10h11.6"/>',
  kebab:'<circle cx="10" cy="4.6" r="1.2"/><circle cx="10" cy="10" r="1.2"/><circle cx="10" cy="15.4" r="1.2"/>',
  star:'<path d="M10 2.8 12.3 7.4l5.1.7-3.7 3.6.9 5.1-4.6-2.5-4.6 2.5.9-5.1L3.5 8.1l5.1-.7z" fill="currentColor" stroke="none"/>',
  starOff:'<path d="M10 3.6 12 7.6l4.4.6-3.2 3.1.8 4.4-4-2.1-4 2.1.8-4.4L3.6 8.2l4.4-.6z"/>',
  cal:'<rect x="2.8" y="4.4" width="14.4" height="12.4" rx="1.8"/><path d="M2.8 8.4h14.4"/><path d="M6.6 2.8v3.4M13.4 2.8v3.4"/><path d="M6.2 11.6h2.6M11.2 11.6h2.6M6.2 14.2h2.6"/>',
  stats:'<path d="M3.2 16.6h13.6"/><path d="M6 16.6V11M10 16.6V6.4M14 16.6V8.8"/>',
  rel:'<circle cx="6.8" cy="10" r="4"/><circle cx="13.2" cy="10" r="4"/>',
  bullet:'<circle cx="10" cy="10" r="2.6" fill="currentColor" stroke="none"/>',
  caretUp:'<path d="M5.4 12.2 10 7.6l4.6 4.6"/>',
  caretLeft:'<path d="M12.6 5.4 8 10l4.6 4.6"/>',
  /* ---- 标题六档：以前直接拿 H1…H6 六个字摆在按钮上，现在一个档一张图 ---- */
  h1:'<text x="10" y="14" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="currentColor" stroke="none">H1</text>',
  h2:'<text x="10" y="14" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="currentColor" stroke="none">H2</text>',
  h3:'<text x="10" y="14" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="currentColor" stroke="none">H3</text>',
  h4:'<text x="10" y="14" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="currentColor" stroke="none">H4</text>',
  h5:'<text x="10" y="14" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="currentColor" stroke="none">H5</text>',
  h6:'<text x="10" y="14" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="currentColor" stroke="none">H6</text>',
  /* 段落记号 / 有序列表：编辑器工具条上正文和 1. 那一档 */
  pilcrow:'<path d="M8.2 3.4h5.4v13.2"/><path d="M11.8 3.4v13.2"/><path d="M5.6 7.6a3.1 3.1 0 0 0 0 6.2H8.2"/>',
  /* ---- 卡片池（两张叠着的牌）和字体（A 带一笔挑脚）：以前卡片上直接写「池」「字」单字 ---- */
  pool:'<rect x="2.6" y="2.6" width="10.6" height="10.6" rx="1.6"/><path d="M6.8 17.4h7.6a3 3 0 0 0 3-3V6.8"/>',
  font:'<path d="M2.8 16.4 8.2 3.8l5.4 12.6M4.6 12.8h7.2"/><path d="M14.8 16.4V9.4a3 3 0 0 1 3-3"/>',
  ol:'<path d="M3 5.4 4.6 4.2v4.6"/><path d="M3.1 13.2h2.9l-2.9 3.4h3.1"/><path d="M8.4 5.4h9.2M8.4 10h9.2M8.4 14.6h9.2"/>',
  /* 上移 / 下移：一根杆顶一个箭头，比光一对尖角好认 */
  up:'<path d="M10 16.4V4.4"/><path d="M5.4 9 10 4.4 14.6 9"/>',
  down:'<path d="M10 3.6v12"/><path d="M5.4 11 10 15.6 14.6 11"/>',
  /* 停靠到右栏：一整块面板，右边那一格画上线，表示开在侧栏 */
  dock:'<rect x="2.6" y="4" width="14.8" height="12" rx="1.6"/><path d="M12.4 4.2v11.6"/><path d="M13.8 7.6h2.2M13.8 10h2.2M13.8 12.4h2.2"/>',
  /* 再来一条：绕一圈的箭头 */
  cycle:'<path d="M16.2 10a6.2 6.2 0 1 1-1.9-4.5"/><path d="M16.7 3.2v3.3h-3.3"/>',
  /* 缩小 / 上一条 / 下一条：光拿字符顶上的那三个 */
  minus:'<path d="M4.2 10h11.6"/>',
  prev:'<path d="M12.4 5.4 7.8 10l4.6 4.6"/>',
  next:'<path d="M7.6 5.4 12.2 10l-4.6 4.6"/>',
  /* 拖把手：上下换序（白板和字体列表都用）。白板那枚改间距的把手 2026-10-05 起
     直接用 U+2195 这个字符，不再配一张图，所以这里只剩 sort 一枚。 */
  sort:'<path d="M7 16.2V4.6"/><path d="M4.2 7.4 7 4.6l2.8 2.8"/><path d="M13 3.8v11.6"/><path d="M10.2 12.6 13 15.4l2.8-2.8"/>'
};
/* 出厂线稿同时写进 <head>：这一棵读不到 icons\ 那一层时（本地开发那台服务器）走的就是这一份 */
(function(){
  if(typeof document === 'undefined') return;
  Ico.boot();
})();
