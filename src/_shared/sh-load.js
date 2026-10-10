/* ============================================================
   插件运行时加载器（中立模块 · Flow-Desk 和 Why Not Write 共用这一份）
   ----------
   插件代码不再拼进产物：它们住在 data\plugins\<id>\ 里，页面每次开机从那儿拿。
   走三大步：
     1 认名单 —— 问主进程（开发那台服务器就问 /_comp 的 op:'dirs'）扫目录，拿回 { packs, off }；
       off 记的是「被卸掉的那几家」，这份名单不在 = 一家都没卸，扫到的全生效。按宿主管家的挑出来，按 order 排。
     2 import('<id>/main.js?v=开机时间') —— ES module，export default 一份定义；
       每次开机都是新 URL，改了代码存盘、刷新这一页就生效，没有「重新生成页面」这一趟。
     3 先给这一家做一份插件上下文（PackCtx），调 def.init(ctx)，再按插件清单的 type 登记：
       widget → 桌面卡片（只有 Flow-Desk 有桌面）· tool → 功能（两端）· recipe → 生成器配方。
   ----------
   一个崩只倒自己的坑：插件清单照收，登记一张错误卡（或控制台一句），
   外壳和别家插件照常跑。
   名单读不到就这一轮不加载插件，外壳照常跑 —— 把 html 双击直接打开那一种已经废止，
   加载和使用插件的途径只有 Flow-Desk 程序（本地开发那台 http 服务器算开发通道）。
   ============================================================ */
const PackLoader = {
  host:'fd',
  base:'plugins/',        /* 宿主报上来的前缀：Flow-Desk.exe 是 ../data/plugins/ 那种，开发服务器是 plugins/ 或 ../plugins/ */
  stamp:'',
  errs:new Map(),            /* 这一轮没加载起来的那几家：id → 错话 */
  /* 每一家开机做好的那份插件上下文留着，宿主按需再递回去：
     卡片/停靠面板上的「设置」按钮要调 def.settings(ctx)，那份 ctx 就是这一份（带门的），不用现做一份新的。 */
  ctxs:new Map(),
  ctxOf(id){ return this.ctxs.get(String(id)); },
  loaded:false,
  use(o){ Object.assign(this, o); return this; },
  which(){ return this.host; },

  /* ---------- 名单和插件清单 ----------
     两条开法拿回来的是同一份形状 { packs:[{id,kind,manifest}], off:[…] }：
       · Flow-Desk 程序 → 主进程那条 packList；
       · 本地开发那台 http 服务器 → /_comp 的 op:'dirs'（它自己扫 数据\plugins\ 那一格）。
     名单反着记：off 里点名的那几家不加载，其余扫到的都加载 ——
     所以往 plugins\ 里丢一个文件夹（或一个 zip，由主进程开机摊开），重启这一趟就认得它。 */
  async disk(){
    const A = window.FD_APP;
    if(A && typeof A.packList === 'function'){
      try{ return await A.packList(); }catch(e){ return null; }
    }
    try{
      const r = await fetch('/_comp', { method:'POST', headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ op:'dirs' }) });
      return r.ok ? await r.json() : null;
    }catch(e){ return null; }
  },
  async sources(){
    const d = await this.disk();
    if(!d || d.error){ console.warn('读不到插件那一层的清单（' + this.base + '）· 这一轮不加载插件'); return []; }
    const off = new Set((Array.isArray(d.off) ? d.off : []).map(String));
    const out = [];
    for(const p of (d.packs || [])){
      const m = p.manifest;
      if(!m || !m.id) continue;
      if(off.has(String(m.id))) continue;
      if(p.kind === 'zip'){
        console.warn('插件「' + m.id + '」还是 zip 那份运输形状：开机那一趟没摊成文件夹（已经有同名文件夹，或者那份包读不动）');
        continue;
      }
      out.push({ id:String(m.id), manifest:m });
    }
    return out;
  },
  /* 插件清单缺的那几样按默认补齐 —— 和构建那把尺（_build/packs.mjs）同一个口径 */
  metaOf(id, m){
    return {
      id, name:m.name || id, version:m.version || '0', author:m.author || '', source:m.source || '',
      host:Array.isArray(m.host) ? m.host : ['fd'], entry:Array.isArray(m.entry) ? m.entry : ['main.js'],
      order:(typeof m.order === 'number' ? m.order : 100),
      dataKeys:m.dataKeys || [], kvKeys:m.kvKeys || [], sharedKeys:m.sharedKeys || [], stateKeys:m.stateKeys || [],
      desc:m.desc || '', bank:m.bank || null, assets:m.assets || {},
      type:m.type || 'widget', settings:!!m.settings, appChannels:m.appChannels || [],
      where:id + '/'
    };
  },

  async load(){
    this.stamp = Date.now();
    const list = [];
    for(const it of await this.sources()){
      const meta = this.metaOf(it.id, it.manifest);
      if(meta.host.indexOf(this.host) < 0) continue;      /* 不归这个宿主的包，一家都不 import */
      PACK_META[it.id] = meta;
      list.push(it.id);
    }
    list.sort((a, b) => (PACK_META[a].order - PACK_META[b].order) || (a < b ? -1 : a > b ? 1 : 0));
    /* 插件清单表一家家填进 PACK_META 之后、真 import 之前刷新词库名：
       第一家的 init 就可能要读自己那份库，BANK_NAME 得先认得出这一家。 */
    if(typeof bankSync === 'function') bankSync();
    for(const id of list){
      try{ await this.one(id); }
      catch(e){ this.fail(id, e); }
    }
    this.loaded = true;
    try{ Bus.emit('packs:loaded'); }catch(e){}
    return this;
  },
  /* ---------- 新建 / 刚导入的那一家：先从盘上把插件清单读进表里 ----------
     名单和 PACK_META 都按开机那一趟算，刚写进 data\\plugins\\ 的一格表里没有它。
     读得到插件清单、且 host 认本宿主，才往表里补一格（补完这一家就等于「装上并加载」）。 */
  async metaFromDisk(id){
    id = String(id);
    let text = '';
    const A = window.FD_APP;
    if(A && typeof A.compRead === 'function'){
      const r = await A.compRead(id, 'manifest.json');
      if(r && r.ok) text = String(r.text || '');
    }else{
      /* 本地开发那台 http 服务器：插件清单直接从 plugins/ 那一层 fetch */
      try{
        const r = await fetch(this.base + id + '/manifest.json', { cache:'no-store' });
        if(r.ok) text = await r.text();
      }catch(e){}
    }
    if(!text) return null;
    let m = null;
    try{ m = JSON.parse(text); }catch(e){ return null; }
    if(!m || !m.id) return null;
    const meta = this.metaOf(id, m);
    if(meta.host.indexOf(this.host) < 0) return null;   /* 不归本宿主用的包不补表 */
    PACK_META[id] = meta;
    return meta;
  },
  /* ---------- 改代码存完：只把这一家重新 import 一遍 ----------
     加载器的 URL 尾巴换成当前时刻，页面手里那份模块缓存跟着作废，拿到的就是刚落盘的文件；
     注册那一格被新的定义顶掉（出厂基线 TOOL_DEFS / WIDGET_BASE 不吃第二次，还是第一份）。
     重 import 之后广播一句 pack:reload，宿主在那儿重画自己那部分（卡片、停靠面板都重新挂一遍），
     所以「改代码 · 保存」之后不用刷新整页，也不用重新构建 Flow-Desk 页面。
     opt.new = 这一家刚新建 / 刚导入、表里还没有插件清单：先补插件清单再 import。
     没在名单里加载的（opt.new 没给）不动它 —— 免得把用户刚卸掉的包偷偷请回来。 */
  async reload(id, opt){
    id = String(id);
    const o = opt || {};
    if(!PACK_META[id]){
      if(!o.new) return { ok:false, msg:'这一家这一轮没在名单里加载，改完刷新这一页才认它' };
      if(!await this.metaFromDisk(id)) return { ok:false, msg:'刚写的插件清单读不到，或者它不写给本宿主用' };
    }
    this.errs.delete(id);
    delete PACK_META[id].error;
    this.stamp = Date.now();
    let err = null;
    try{ await this.one(id); }
    catch(e){ this.fail(id, e); err = (e && e.message) || String(e); }
    try{ Bus.emit('pack:reload', id); }catch(e){}
    return err ? { ok:false, msg:err } : { ok:true };
  },
  async one(id){
    const m = PACK_META[id];
    const ent = (m.entry && m.entry[0]) || 'main.js';
    /* 说明符先转成绝对 URL 再 import：ES module 里不以 '/' './' '../' 打头的那串算裸名，
       开发那台 http 服务器报上来的前缀正好是 'plugins/' 这种光溜溜的写法，直接递进去会「无法解析模块说明符」。 */
    const url = new URL(this.base + id + '/' + ent + '?v=' + this.stamp, document.baseURI).href;
    const mod = await import(url);
    const def = mod && mod.default;
    if(!def || typeof def !== 'object') throw new Error('这一家的代码没有交出一份定义');
    /* id 和中文名都从插件清单取，一家只写一处：包里那份定义不用自己声明，
       声明了就是抄第二份名字 —— 改了插件清单、漏了源码，界面上就露出旧名。 */
    def.id = id;
    def.name = m.name;
    const ctx = PackCtx.make(id);
    this.ctxs.set(id, ctx);
    if(typeof def.init === 'function') await def.init(ctx);
    this.register(id, def, ctx);
  },
  register(id, def, ctx){
    /* 名字的真身只有一份：插件清单（manifest.json）里那一行 name。
       包里那份定义不再自己声明 id / name —— 声明了就是抄第二份，改一处漏一处。
       mount 包一层：宿主现给的挂载上下文和 init 那份插件上下文并成一份传进去，
       组件里只管用同一份 ctx，不用两头记。
       宿主那份挂载上下文里原先直接塞着宿主的内部件（卡片档给过整个 Store/Settings/Modal/Cover，
       Why Not Write 的视图档塞着整个工作台 desk）—— 组件拿到的这一份里把它们摘干净：
       对话框走 ctx.dialog、封面走 ctx.cover、数据走 ctx.store/ctx.kv 那些带门的，
       整个工作台外壳组件永远不碰。卡片自己的事（item/expanded/layout/saveLayout/setHeight/where/ref/close/on/dispose）照留。 */
    if(typeof def.mount === 'function' && !def.__packMount){
      const raw = def.mount;
      def.mount = (body, mctx) => {
        const base = Object.assign({}, mctx);
        for(const k of ['store', 'settings', 'bus', 'theme', 'toast', 'modal', 'openCover', 'desk']) delete base[k];
        return raw.call(def, body, Object.assign(base, ctx));
      };
      def.__packMount = true;
    }
    const type = PACK_META[id].type || 'widget';
    if(type === 'tool') registerTool(def);
    else if(type === 'recipe'){ if(typeof Gen !== 'undefined') Gen.def(def); }
    else if(typeof registerWidget === 'function') registerWidget(def);
  },
  /* 崩了的一家：插件清单留着（名单里看得见它、信息页说得出为什么），位子上立一张错误卡 */
  fail(id, e){
    const m = PACK_META[id];
    const msg = (e && e.message) || String(e);
    if(m) m.error = msg;
    this.errs.set(id, msg);
    console.warn('组件「' + ((m && m.name) || id) + '」没加载起来：' + msg);
    const nm = (m && m.name) || id;
    const draw = body => {
      body.appendChild(h('div', { class:'fd-empty' }, [
        h('div', {}, '「' + nm + '」这个插件没加载起来'),
        h('div', { style:'font-size:.86em;opacity:.75;margin-top:4px' }, msg),
        h('div', { style:'font-size:.86em;opacity:.6;margin-top:4px' }, '点这个卡上的「改代码」改它自己那份，存完刷新这一页就重试')
      ]));
      return { unmount(){} };
    };
    const type = (m && m.type) || 'widget';
    try{
      if(type === 'tool') registerTool({ id, name:nm, card:{}, ready:null, mount:draw });
      else if(type !== 'recipe' && typeof registerWidget === 'function')
        registerWidget({ id, name:nm, minW:2, minH:2, def:{ w:4, h:2 }, mount:draw });
    }catch(e2){ console.warn('错误卡也没立起来：' + e2); }
  }
};

/* ============================================================
   Electron 桥的白名单发放（两个宿主共用这一把尺）
   ----------
   插件清单 appChannels 点名哪个方法，组件才拿得到哪一个；没点名的在它的上下文里根本不存在。
   还有一道硬地板：装卸、关于、树内文件、用户数据底层、窗口控制这些通道，
   就算哪份插件清单厚着脸皮点名也不给 —— 插件禁止清单第一节那一条从这里开始是机制，不是约定。
   找桥按「自己这一框 → 父框 → 顶框」往上问一圈：桥只注在 Flow-Desk 那一框，组件不管挂在桌面上
   还是停靠里，都在同一张页的同一框，问一次就中；音乐卡在桌面和停靠里连的是同一个桥。
   函数一律包一层再递（组件拿不到桥对象本身），非函数的属性（label：这一框是哪个程序）照原值带上。
   ============================================================ */
const APP_DENY = ['packList', 'packSet', 'packFile', 'packImport', 'packWipe', 'rebuild',
  'compRead', 'compWrite', 'compDelete', 'compRestore', 'compFactory', 'compList',
  'readPageFile', 'writePageFile', 'writePageBytes', 'delPageFile', 'pagePath', 'pathOf',
  'dataRead', 'dataWrite', 'dataList', 'aboutInfo',
  'uiTextRead', 'uiTextWrite', 'uiTextList', 'cardSizeRead', 'cardSizeWrite',
  'winCtl', 'restartApp', 'closeChoice', 'openDir', 'iconsList', 'dirTree', 'readText', 'fontList', 'onFontList',
  'ocrSwatch', 'imgPeek', 'imgOpen', 'dataDir', 'rimeDir', 'setRimeDir'];
function packApp(ch){
  /* 桥就在这一张页的 window 上：从前组件装在另一个窗口里才需要隔框找，现在不用 */
  const A = (window.FD_APP && typeof window.FD_APP === 'object') ? window.FD_APP : null;
  if(!A) return null;                      /* 这一棵里没有主进程那层桥（本地开发那台服务器） */
  const out = {};
  for(const k of (ch || [])){
    if(APP_DENY.includes(k)){ console.warn('插件清单点名要「' + k + '」：这条通道不给组件，硬地板挡下'); continue; }
    if(typeof A[k] === 'function') out[k] = (...a) => A[k](...a);
    else if(k in A) out[k] = A[k];
  }
  return out;
}

/* ============================================================
   插件上下文 —— 组件能碰宿主的东西全从这儿递，ES module 里看不见宿主的任何全局名
   ----------
   两半分：
     · 两家同名同义的公共件（h / toast / Bus / State / Theme / mkBank …）由这份直接引用产物里的那个全局，
       组装进每一家的 ctx；
     · 各宿主不一样的那几样（设置、明文存储、封面、对话框、FD_APP 通道、剩下的小工具）
       由宿主开机时 PackCtx.parts({...}) 交上来，缺的项就不摆。
   数据门按插件清单来：
     kv / settings 只认 manifest.kvKeys 点名的键（外加 pack.<id>. 打头的新键）；
     state 只认自己名字打头的键，外加 manifest.stateKeys 点名的那些前缀
       （音乐遥控器存的是 music-dir / music-ly 这一串，包 id 叫 music-remote，挡不住 —— 就写进插件清单）；
     store 只读写 manifest.dataKeys 点名的文件；
     app 只开 manifest.appChannels 点名的方法。
   ============================================================ */
const PackCtx = {
  frag:{},
  parts(f){ Object.assign(this.frag, f); return this; },
  make(id){
    const m = PACK_META[id] || {};
    const F = this.frag;
    const nm = m.name || id;
    const kvOk = k => (m.kvKeys || []).includes(k) || String(k).startsWith('pack.' + id + '.');
    const stOk = k => { const s = String(k); return s === id || s.startsWith(id + '-') || s.startsWith(id + '.') || s.startsWith('pack.' + id + '.')
      || (m.stateKeys || []).some(p => s.startsWith(String(p))); };
    const deny = what => { throw new Error('组件「' + nm + '」' + what + '，插件清单没带它'); };
    const ctx = {
      pack:{ id, name:nm, version:m.version, author:m.author, source:m.source, where:m.where, desc:m.desc, type:m.type || 'widget' },
      el:h,
      icon:typeof icoMarkup === 'function' ? icoMarkup : () => '',
      toast:typeof toast === 'function' ? toast : () => {},
      copyBtn:typeof copyBtn === 'function' ? copyBtn : null,
      bus:Bus,
      /* 色位（slotColor）：第三方组件读标记色只借这一个（取值口径在 _shared/sh-packs.js，
         外13-N 起它接的是用户在 设置·外观 里自定义的那一串标记色，组件只读不重算）。
         色位的「具体色号」另一半（slotHex(i)）：slotColor 回的是 var(--mark-N, …) 那一句 CSS，
         有的组件要存的就是色号本身（日程「新建标签」的默认色就是这一种），所以明面开这一个；
         编号、兜底都跟 slotColor 同一个口径，取数在 sh-packs 里复用 markHexes / markCount，
         不另抄算式 —— 插件自己照样不许抓 window.FD_MARKS 或根元素上的样式。
         标记色本体不住在加载器里：markVar / markSlots 这些是宿主与为写共用的顶层小工具，
         由 _shared 直接摆进整页作用域，加载器不替它们开后门——所以这一节不再逐个往 ctx 上挂。 */
      slotColor:typeof slotColor === 'function' ? slotColor : null,
      slotHex:typeof slotHex === 'function' ? slotHex : null,
      theme:typeof Theme !== 'undefined' ? Theme : null,
      kv:{
        get:async (k, fb) => { if(!kvOk(k)) deny('要读的键「' + k + '」'); return F.kv.get(k, fb); },
        put:async (k, v) => { if(!kvOk(k)) deny('要写的键「' + k + '」'); return F.kv.put(k, v); },
        del:async (k) => { if(!kvOk(k)) deny('要删的键「' + k + '」'); return F.kv.del(k); }
      },
      state:{
        get:async (k, fb) => { if(!stOk(k)) deny('要读的表单键「' + k + '」'); return State.get(k, fb); },
        set:(k, v) => { if(!stOk(k)) deny('要写的表单键「' + k + '」'); return State.set(k, v); }
      },
      /* 词库跟着包走：插件清单点了哪份，就只能拿哪份 */
      bank:which => {
        const b = m.bank;
        if(!(b && b.which === which)) deny('词库「' + which + '」');
        return mkBank(which);
      },
      banks:Banks,
      /* 自带样式：贴到宿主 head 上的一块，节点认得是谁家的，卸了包刷新就没了 */
      style:css => {
        let s = document.querySelector('style[data-pack="' + CSS.escape(id) + '"]');
        if(!s){ s = document.createElement('style'); s.setAttribute('data-pack', id); document.head.appendChild(s); }
        s.textContent += (s.textContent ? '\n' : '') + css;
      },
      /* 后台通道：插件清单 appChannels 点了哪几个才发哪几个（发放那把尺在上面，两个宿主共用）；
         这一棵里没有桥（本地开发那台服务器没有主进程）就是 null，组件里那句「这条通道没有」的分支照常走 */
      app:(F.app || packApp)(m.appChannels || [])
    };
    if(F.settings) ctx.settings = {
      get:(k, fb) => { if(!kvOk(k)) deny('设置项「' + k + '」'); return F.settings.get(k, fb); },
      set:(k, v) => { if(!kvOk(k)) deny('要写的设置项「' + k + '」'); return F.settings.set(k, v); }
    };
    if(F.store){
      const ok = f => (m.dataKeys || []).includes(String(f));
      ctx.store = {
        loadJSON:async (f, fb) => { if(!ok(f)) deny('数据文件「' + f + '」'); return F.store.loadJSON(f, fb); },
        saveJSON:(f, o) => { if(!ok(f)) deny('要写的数据文件「' + f + '」'); return F.store.saveJSON(f, o); },
        saveSetting:async (k, v) => { if(!kvOk(k)) deny('要写的设置键「' + k + '」'); return F.store.saveSetting(k, v); },
        loadSetting:async (k, fb) => { if(!kvOk(k)) deny('要读的设置键「' + k + '」'); return F.store.loadSetting(k, fb); }
      };
    }
    if(F.cover) ctx.cover = F.cover;
    if(F.dialog) ctx.dialog = F.dialog;
    /* 删之前问那一句由宿主这一枚包好交出去（外27 全清第 5 条）：组件不许自己搭确认框 ——
       从前日程、便签、金句三家各抄了一份逐字相同的 ask，问话排版和钮的次序要四处同步。 */
    if(F.ask) ctx.ask = F.ask;
    /* 两家产物里同名同义的小工具：直接带上，不算越界也不做门 */
    if(typeof shSplit === 'function'){ ctx.shSplit = shSplit; ctx.shSplitKey = shSplitKey; }
    /* 歌词的时值尺（外19 词格与音乐遥控器同读这一份，见 _shared/sh-ttml.js）：
       插件是运行时现 import 的 ES module，它拿不到整页作用域里的顶层名字，只能由这一节发下去；
       为写那一头是同页的闭包，直接使顶层名字就行，两头用的是同一套算式。 */
    if(typeof shTtmlParse === 'function') ctx.ttml = { parse:shTtmlParse, close:shTtmlClose, clock:shTtmlClock, stamp:shLrcStamp };
    /* 播放时钟（遥控器往里填、词格读，见 _shared/sh-mus.js）：组件递进来的是同一个对象，
       它填的那一份和为写读的那一份必须是同一个东西，所以这里原样交对象、不包一层。 */
    if(typeof MusClock !== 'undefined') ctx.mus = MusClock;
    /* 标签歌词那一格的读者位（见 _shared/sh-mus.js 末了那一段）：音乐遥控器把自己的读者挂上来，
       词格从同一格取 —— 字节解析只在那一家里有一份。 */
    if(typeof MusTag !== 'undefined') ctx.tag = MusTag;
    if(typeof Phrase !== 'undefined') ctx.phrase = Phrase;
    if(typeof randInt === 'function'){ ctx.randInt = randInt; ctx.pickOne = pickOne; ctx.shuffle = shuffle; }
    /* 宿主补的零碎小工具（日期格式、量字号、分词那套）：原样并进来，不做门 */
    if(F.more) Object.assign(ctx, F.more);
    return ctx;
  }
};
