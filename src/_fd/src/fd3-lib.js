/* ============================================================
   三份库文件：#291 色卡 data\palettes.yaml · #292 外观方案 data\looks.yaml · 外29 丁组 图片库 data\images.yaml
   ----------
   为什么是明文：颜色、外观方案、自己导进来的图都是用户自己攒出来的东西，不该锁在程序存档里。
   攒好之后他能在记事本里改一行、删一段，Flow-Desk 里那些下拉和卡片跟着变。
   ----------
   三份文件形状一样（都是 Yml 这一台认的那一种）：一条方案一段，顶格那行是段名，
   段名就是界面上看到的那个名字；底下缩进两格写这一条方案的字段。
   字段值全用界面上的中国话写（明亮 / 自定义色号 / 质感 / 无界 / 无），
   文件里那一行和屏幕上那一行是同一句话，改的人不用先学一遍内部名字。
   一条方案住在哪一段、当前用哪一段，都由段名认，不按位置认 —— 上下挪不算改动。
   ----------
   和 数据\ui-text.yaml、数据\card-size.yaml 的区别只在第一次：那两份由程序在重新生成页面时刷新，
   这三份里的东西程序自己造不出来（从图里取的、你自己填的、你自己导进来的），
   所以是页面开机发现文件还空着，就地把现有那一些原样写出去 —— 一条不丢，往后跟着默认走。
   存档 data\appearance.json 退回去只管「当前用哪一条」这些状态，方案本身不再抄第二份。
   ============================================================ */

/* ---------- 一小台 YAML：只要吃得下这几份文件自己写出来的形状 ----------
   为什么不借界面文字清单、卡片大小清单那两台：那两份一行一个地方，值不会分行；
   这几份的色号要一行一个（- 开头排成一串），那两台不认这种清单。
   认的就这么几种：顶格 `段名:` 开一段；段里两格缩进 `字段: 值`；
   字段值空着、下面跟一串 `- 项` 就算清单；# 开头是说明行。
   裹引号的值（写色号时防着 # 被当成说明）读回来把引号去掉。 */
const LibYml = {
  /* 值：外层成对引号去掉；没引号的把行尾说明切掉 */
  val(s){
    const t = String(s === undefined || s === null ? '' : s).trim();
    if(/^".*"$/.test(t)){ try{ return JSON.parse(t); }catch(e){ return t.slice(1, -1); } }
    if(/^'.*'$/.test(t)) return t.slice(1, -1).replace(/''/g, "'");
    return t.replace(/\s+#.*$/, '').trim();
  },
  /* 写：带 #、带冒号、头尾带空格的裹一层引号（#3b6cb5 不裹就被当成一行说明，色号就没了） */
  str(v){
    const s = String(v === undefined || v === null ? '' : v);
    if(s === '') return '';
    return /[:#]|^\s|\s$/.test(s) ? JSON.stringify(s) : s;
  },
  /* 读一段：交回 [{ name, fields:{ 字段: 值 | [值, …] } }]；重名的段只认头一个 */
  parse(text){
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
        cur.fields[listKey].push(LibYml.val(body.slice(1)));
        continue;
      }
      /* 段名、字段名先试「整对引号」那一种（名字里带冒号的那种是这么写出来的：`"潮焰: 序章":`），
         引号切不到再退回「第一个冒号前算名字」——不这么排的话带冒号的段名只认到冒号为止，整段读不回来 */
      const m = body.match(/^("(?:[^"\\]|\\.)*")\s*:(.*)$/) || body.match(/^(.+?):(.*)$/);
      if(!m) continue;
      const k = LibYml.val(m[1]), v = LibYml.val(m[2]);
      if(ind === 0 && v === ''){
        if(seen.has(k)){ cur = null; continue; }        /* 重名：后一段整个不看，前面的照认 */
        seen.add(k); cur = { name:k, fields:{} }; listKey = '';
        secs.push(cur); continue;
      }
      if(!cur) continue;
      cur.fields[k] = v; listKey = (v === '') ? k : '';
    }
    return secs;
  },
  /* 写一份：head 是那段说明，secs = [{ name, fields:{ 字段: 值 | [值, …] } }]，字段按给定的次序写 */
  emit(head, secs, order){
    const out = [String(head || '')];
    for(const s of secs || []){
      /* 段名也走 str：名字里带冒号、带 #、头尾带空格的那种裹上引号，不然整段读不回来 */
      out.push(LibYml.str(s.name) + ':');
      const ks = (order && order.length) ? order : Object.keys(s.fields || {});
      for(const k of ks){
        const v = (s.fields || {})[k];
        if(v === undefined) continue;
        if(Array.isArray(v)){
          if(!v.length) continue;                        /* 空清单不写字段名：写了像坏了一段 */
          out.push('  ' + k + ':');
          for(const it of v) out.push('    - ' + LibYml.str(it));
          continue;
        }
        const t = LibYml.str(v);
        out.push('  ' + k + ':' + (t ? ' ' + t : ''));
      }
      out.push('');
    }
    return out.join('\n').replace(/\n+$/, '') + '\n';
  }
};

/* ---------- 两份库文件共同的读写底子：读、写、认得是不是自己写出去的那一份 ---------- */
const LibStore = {
  /* 自己写出去的原文按名字记一份：主进程那趟广播绕回本页时靠它认出「这就是我刚写的」，不用再重认一遍 */
  mine:{},
  /* 交回三种样子：原文 / '' （文件确实不存在或空着）/ null （读这一步本身失败了）。
     这两种不能混：第一次开机「文件还没写」要就地写出去，而「读不到」要是被当成空的，
     这一趟就会把只含两条预设的色卡写进文件，把用户攒的那些整个盖掉。 */
  async fetchRaw(name){
    const A = window.FD_APP;
    if(A && A.libRead){
      let r = null;
      try{ r = await A.libRead(name); }catch(e){ return null; }
      if(!r || r.ok === false) return null;
      return String(r.text || '');
    }
    /* 问不到主进程那一层（本地开发那台服务器）就从服务器根上取：它发的就是 数据\ 里那一个文件 */
    try{
      const r = await fetch('/' + name, { cache:'no-store' });
      if(r.ok) return await r.text();
      return r.status === 404 ? '' : null;
    }catch(e){ return null; }
  },
  async putRaw(name, text){
    const s = String(text || '');
    this.mine[name] = s;
    const A = window.FD_APP;
    if(A && A.libWrite){
      try{ return await A.libWrite(name, s); }catch(e){ return { ok:false, msg:String((e && e.message) || e) }; }
    }
    /* 开发那台服务器上存盘：走 /_lib 那一条，落的还是 数据\ 里同一个文件 */
    try{
      const r = await fetch('/_lib?name=' + encodeURIComponent(name), { method:'POST', body:s });
      const j = await r.json().catch(() => null);
      return (j && j.ok === false) ? j : { ok:true };
    }catch(e){ return { ok:false, msg:String((e && e.message) || e) }; }
  },
  /* 主进程广播回来的那一句：认名字、认原文，是自己写出去的就不折腾 */
  hook(onChanged){
    const A = window.FD_APP;
    if(!A || !A.onLibChanged) return null;
    try{
      return A.onLibChanged(m => {
        if(!m || !m.name) return;
        const t = String(m.text || '');
        if(this.mine[m.name] === t) return;
        this.mine[m.name] = t;
        try{ onChanged(m.name, t); }catch(e){}
      });
    }catch(e){ return null; }
  },
  /* 写盘排一下队：连着改色号、连着拖滑杆，只把最后一份写出去 */
  timers:{},
  later(name, text){
    clearTimeout(this.timers[name]);
    this.timers[name] = setTimeout(() => { this.putRaw(name, text).then(r => {
      if(r && r.ok === false) toast('存不进文件：' + (r.msg || '这一份没写出去'));
    }); }, 400);
  }
};

/* ============================================================
   #291 色卡 · 成套的那一份：data\palettes.yaml
   一条配色一段：基调、明暗、色号、CMYK 换算、来源、作者。
   色卡只有一个名字两种形状：这一份是一段一串色（底 / 卡面 / 正文 / 强调…），
   data\cards.yaml 那一份是一段一个色（界面上摊开的那些圆点）。攒在一起的都叫色卡。
   内置那两套（RP 明亮 / RP 黑暗）不写色号：整套颜色由 _shared/sh-color.js 现派生。
   明暗 那一栏（外13-A）是判定结果的一份记录，由 paletteMingDark() 现算再写下去。
   ============================================================ */
const PAL_FILE = 'palettes.yaml';
/* 外观方案那一份叫 LOOKS_FILE，不敢叫 LOOK_FILE：fd3-shell.js 里那个 const 已经占了这个名字
   （它指的是存档 appearance.json），两段拼进同一个产物就是「标识符重复声明」，整个页面白屏。 */
const LOOKS_FILE = 'looks.yaml';
/* 界面上那几个来源的说法，和文件里 来源 那一栏的字对上
   （件-9 整条撤下 Rime 配色之后没有 rp 这一档了；老文件里万一还写着「Rime」，
     下面 entry 那条兜底会把它当「自建」认，不报错） */
const PAL_SRC = { preset:'内置', custom:'自建', image:'图片', swatch:'色卡照片' };
/* 回读时旧写法「色卡」照样认（他那份文件里已经写着这两个字），只是再写出去统一成 色卡照片 */
const PAL_SRC_BACK = { '内置':'preset', '自建':'custom', '图片':'image', '色卡照片':'swatch', '色卡':'swatch' };
const PAL_MODES = { light:'明亮', dark:'黑暗', custom:'自定义色号' };
const PAL_MODES_BACK = { '明亮':'light', '黑暗':'dark', '自定义色号':'custom', '自定义':'custom' };
const PAL_STD = { gracol:'GRACoL', swop:'SWOP', japan:'Japan Color' };
const PAL_STD_BACK = { 'GRACoL':'gracol', 'SWOP':'swop', 'JAPAN COLOR':'japan', 'JAPAN':'japan' };
/* 明暗那一栏的说法（外13-A）：判定口径固定 —— 识别出来的底色对正文比 WCAG 相对亮度，
   字亮 = 黑暗、字暗 = 明亮；两头都勉强（亮度差不到 .02）时这里写「判不准」，不硬给结论。
   和上面 基调 那两字看着像，说的是两件事：基调 讲的是这一套是不是 Flow-Desk 自带的那两套预设，
   明暗 讲的是这套配色铺开之后整体看着是深还是浅。 */
const PAL_MD = { dark:'黑暗', light:'明亮' };
const PAL_MD_BACK = { '黑暗':'dark', '明亮':'light' };
const PAL_MD_UNKNOWN = '判不准';
/* 文件里那一栏由这条现算出来（判定跟着默认那一套识别方案走，不认当前切到哪一套），
   读回来只当记录用 —— 运行时派生永远现算，免得文件和代码两份结论对不上。 */
function palMingDarkName(e){
  try{
    if(typeof paletteMingDark !== 'function') return PAL_MD_UNKNOWN;
    return PAL_MD[paletteMingDark(e)] || PAL_MD_UNKNOWN;
  }catch(err){ return PAL_MD_UNKNOWN; }
}
const PAL_HEAD = [
  '# 【色卡】Flow-Desk 里每一套配色都记在这份清单上',
  '#   这是一份 YAML（YAML 就是"用缩进和冒号排版"的纯文本），记事本、Notepad++ 都能直接改；存盘请保持 UTF-8 编码。',
  '#   一套配色一段：顶格那一行写着方案名，界面上配色下拉里看到的就是这个名字；底下缩进两格的是这一套的内容。',
  '#     基调：明亮、黑暗（这两套是 Flow-Desk 自带的，颜色不用写）或者自定义色号。',
  '#     明暗：这一套铺开之后整体是深还是浅 —— 明亮 / 黑暗 / 判不准。',
  '#       写这一栏时是现算的：拿识别出来的底色和正文各算一次 WCAG 相对亮度比高低，字比底亮就是黑暗。',
  '#       判不准 = 那两个数挨得太近，两头都说不准，不硬给结论（这一套该由对比下限那一条去拦）。',
  '#       改完色号不用手工改这一栏：程序下次写这份清单时会重新算一遍；你手写的内容读回来只当记录，不参与算色。',
  '#       它和上面 基调 说的不是一件事：基调 认的是"是不是自带的那两套预设"。',
  '#     色号：一行一个，从上往下依次当 底 / 卡面 / 正文 / 主强调 / 次强调 用。',
  '#       写法照你顺手的那种来：#3b6cb5、0x35A82A、59,108,181（RGB）都认；',
  '#       CMYK 要写成 cmyk(78,52,0,0) —— 裹上这一层，四个数字才认得出是 CMYK 而不是 RGB。',
  '#     换算：CMYK 换成屏幕上的颜色时用哪一套标准，GRACoL / SWOP / Japan Color，不写当 GRACoL。',
  '#     来源：内置 / 自建 / 图片 / 色卡照片，界面上那条小字跟着它走。',
  '#     作者：想记是谁配的就写，不写空着。',
  '#   改完存盘，Flow-Desk 里那一套当场跟着变，不用重启；这一段一个字都没动过就别存，省得白刷新一次。',
  '#   认不出的那一段程序整段跳过，其余照常；名字重复只认头一段。',
  '#   这一份由 Flow-Desk 在你第一次打开它的时候，把当时色卡里的每一条原样写出来 —— 包括你自己填的、从图里取的。',
  '#   以 # 开头的行是说明，程序读的时候跳过。',
  ''
].join('\n');
const PalLib = {
  name:PAL_FILE,
  ready:false,
  /* ---------- 一条配色 ↔ 文件里的一段 ---------- */
  fields(e){
    const f = { 基调: PAL_MODES[e.mode] || '自定义色号', 明暗: palMingDarkName(e) };
    /* 只要带着色号就写下来：从前只认 基调 是「自定义色号」的那一条，
       存档里有一批「黑暗 + 自带 5 个色号」的（早期攒下的那一批），
       照老写法 色号 整块不落文件，读回来就成了 0 个色号 —— 一套颜色悄悄空了 */
    if((e.colors || []).length){
      const list = [];
      for(const c of (e.colors || [])){
        const raw = String(c.raw || '').trim();
        if(!raw) continue;
        list.push((c.format === 'cmyk' && !/^cmyk\(/i.test(raw)) ? 'cmyk(' + raw + ')' : raw);
      }
      if(list.length) f.色号 = list;
      if(e.std && e.std !== 'gracol') f.换算 = PAL_STD[e.std] || 'GRACoL';
    }
    f.来源 = PAL_SRC[e.source] || '自建';
    f.作者 = e.author || '';
    return f;
  },
  entry(sec){
    const f = sec.fields || {};
    const mode = PAL_MODES_BACK[f.基调] || 'custom';
    const src = PAL_SRC_BACK[f.来源] || '自建';
    const list = Array.isArray(f.色号) ? f.色号 : (f.色号 ? [f.色号] : []);
    const colors = list.filter(Boolean).map(raw => ({
      raw:String(raw), format:/^cmyk\(/i.test(String(raw)) ? 'cmyk' : 'auto'
    }));
    const e = { id:'p:' + sec.name, name:sec.name, source:src, mode, colors,
      std:PAL_STD_BACK[String(f.换算 || '').toUpperCase()] || 'gracol', author:f.作者 || '' };
    /* 明暗 那一栏读回来只当一份记录（界面上那条小字、自检那张表用得上），
       不参与算色 —— 每一次派生都现算，文件里这一栏和代码算的对不上时以现算为准。 */
    e.md = PAL_MD_BACK[String(f.明暗 || '').trim()] || '';
    e.mdText = String(f.明暗 || '').trim();
    /* 内置那两条是 Flow-Desk 自带的底子，界面上不给删（删了下次重新生成页面又会回来） */
    e.locked = src === 'preset';
    return e;
  },
  text(items){
    return LibYml.emit(PAL_HEAD, (items || []).map(e => ({ name:e.name, fields:this.fields(e) })),
      ['基调', '明暗', '色号', '换算', '来源', '作者']);
  },
  /* 段名就是这条配色的身份：撞名就等于两套并成一套，所以进色卡之前先让个位子（未命名配色 2 这样） */
  uniqueName(base, skipId){
    const n0 = String(base || '').trim() || '未命名配色';
    const taken = nm => (Palette.items || []).some(x => x.id !== skipId && x.name === nm);
    if(!taken(n0)) return n0;
    for(let i = 2; i < 500; i++){ const c = n0 + ' ' + i; if(!taken(c)) return c; }
    return n0 + ' ' + Date.now();
  },
  /* ---------- 把文件里那几段认成色卡 ----------
     当前用哪一套按名字认：文件里的段名就是界面上那个名字，存档里那份 cur 是内部 id，
     搬家之后 id 一律换成 p:+名字，老 id 认不着就退回第一条，配色不会丢。 */
  adopt(keep, text){
    const secs = LibYml.parse(text);
    if(!secs.length) return 0;
    Palette.data.items = secs.map(s => this.entry(s));
    const hit = Palette.data.items.find(x => x.name === keep) || Palette.data.items[0];
    Palette.data.cur = hit ? hit.id : '';
    Palette.data.curName = hit ? hit.name : '';
    return secs.length;
  },
  /* ---------- 开机：文件空着就把池里那些原样写出去；有内容就照文件认 ----------
     文件是唯一真身，这一点不变。但「唯一真身」不等于「可以凭空少几条」：
     #291 之前那一摊配色住在存档里（appearance.json 的 items 那一份，早期攒下的几十条、
     自己填的都在里头）。旧存档升上来的机器要么文件还没写，要么只写着程序自带的两条 ——
     照文件认就是把那一大摊整个盖掉。所以这里按名字对一遍：存档里有、文件上还缺着的，
     原样补一段进去，一条不丢（第 8 条：所有现行配色全部进色卡）。
     只对这一回：补完在存档里钉一个记号，往后你从文件里删掉一条就是删了，不会被复活。 */
  async boot(){
    const text = await LibStore.fetchRaw(PAL_FILE);
    if(text === null){ console.warn('色卡这一趟没读到（读写那一层还没连上），先按存档里那份跑'); return this; }
    const archive = (Palette.data.items || []).slice();   /* adopt 会整个换掉这一份，先抄下来 */
    const keep = LookStore.data.curName || (Palette.cur || {}).name || '';
    const n = this.adopt(keep, text);
    /* 文件里一段都没有（第一次开机）时 adopt 特意不动色卡，色卡还指着存档那一份。
       这时候 mergeMissing 要是照「色卡现在的名字」划已认下来的那一圈，
       存档里每一条都会撞上自己 —— 于是 57 条被让位成「xxx 2」再补一遍，变成 114 条。
       先把色卡清空，让补齐从「文件上一条也没有」这个起点走，补完正好是存档那一整份。
       记号已经钉上过后再把文件删空，是用户自己动手删，不补、也别把色卡清了害得没得选。 */
    if(!n && !LookStore.data.palMigrated) Palette.data.items = [];
    const miss = this.mergeMissing(archive, keep);
    /* 记号只在「真的写出去了」之后才钉：写盘那一步失败（磁盘满、那一格被占）也照钉的话，
       存档里的色卡下一趟就被 slim 抹掉，开机就只剩文件里那几条 ——
       用户攒的那几十套配色、自建的那些整个没了，界面上连一句提醒都没有。
       没写成就什么也不钉、也不点亮 ready：下一趟接着补，这一趟也不让 persist 往文件里盖东西。 */
    if(!n || miss.length){
      const r = await LibStore.putRaw(PAL_FILE, this.text(Palette.items));
      if(r && r.ok === false){
        console.warn('色卡没写出去：' + (r.msg || ''));
        try{ toast('色卡这一趟没写进文件，先按屏幕上这一份跑，下次开机再补一回'); }catch(e){}
        return this;
      }
      LookStore.data.palMigrated = true;
    }
    /* 「此刻用哪一套」一定要按名字记下：只留 id 的话，下一次开机那串老 id 在文件里认不着，
       配色就悄悄跳到文件里的第一条去了 */
    if(!Palette.data.curName){
      const c = Palette.cur || (Palette.data.items || [])[0];
      if(c){ Palette.data.cur = c.id; Palette.data.curName = c.name; }
    }
    LookStore.save();
    this.ready = true;
    return this;
  },
  /* 补齐：交回补进来的那几条（空数组 = 什么都没补）。当前在用的那一条若是补进来的，
     顺带把「此刻用哪一套」指回它，不然老存档的人一开机就被换成文件里的第一条。
     记号由 boot 在写盘成功之后钉，这里不动它。
     ----------
     名字就是一套配色的身份，所以「文件上已经有了」只能按名字逐条销账：
     色卡里同名几条就记几个数，存档里来一条销掉一个 —— 销完还来的才是文件上缺的那一条。
     早先写的是「撞名就给后到的让个位子（末尾加 2）再补进去」，那是把「文件里已有」当成了
     「文件里那条是别人的」：文件认下来 55 条、存档也带着这 55 条，一次开机就补出 55 条带 2 的复制品，
     色卡里凭空多一倍，界面上看着是「潮焰」和「潮焰 2」两套一样的东西。
     让位那一条留给真正用得着的场合：存档里本来就有两套同名（早期攒下的那一批里就有），
     文件上只有一条的位置 —— 头一套销账、第二套让位补进去，两套颜色都不丢。 */
  mergeMissing(archive, keep){
    if(LookStore.data.palMigrated) return [];
    const avail = new Map();   /* 文件里那个名字还剩几条没被存档对上（同名几条就记几个数） */
    const taken = new Set();   /* 色卡里此刻占着的名字：文件的 + 这一趟刚补进来的 */
    for(const e of (Palette.data.items || [])){
      const k = e && e.name; if(!k) continue;
      avail.set(k, (avail.get(k) || 0) + 1); taken.add(k);
    }
    const miss = [];
    for(const e of (archive || [])){
      if(!e || !e.name) continue;
      const left = avail.get(e.name) || 0;
      if(left > 0){ avail.set(e.name, left - 1); continue; }
      let nm = e.name, i = 2;
      while(taken.has(nm)){ nm = e.name + ' ' + i; i++; }
      taken.add(nm);
      miss.push(nm === e.name ? e : Object.assign({}, e, { name:nm, id:'p:' + nm }));
    }
    if(miss.length){
      Palette.data.items = (Palette.data.items || []).concat(miss);
      const hit = Palette.data.items.find(x => x.name === keep);
      if(hit){ Palette.data.cur = hit.id; Palette.data.curName = hit.name; }
    }
    return miss;
  },
  /* 存：色卡改过（新建、改名、改色号、删掉一条）都走这一条。
     存档这一头记「此刻用哪一套」，文件那一头记「有哪些套」。 */
  persist(){
    LookStore.data.curName = (Palette.cur || {}).name || '';
    LookStore.save();
    if(!this.ready) return;
    LibStore.later(PAL_FILE, this.text(Palette.items));
  },
  /* 外部（或别的窗口）改了这一份：重认一遍，配色下拉和当前生效那一套当场跟上 */
  async reload(){
    const keep = (Palette.cur || {}).name || LookStore.data.curName || '';
    if(!this.adopt(keep, await LibStore.fetchRaw(PAL_FILE))) return false;
    LookStore.save();
    Theme.apply(); Shell.refreshSoon(); Bus.emit('theme');
    return true;
  },
  /* 一条配色的名字改了：外观方案里指着这个名字的那几条跟着改口，不然方案一换就找不到配色 */
  renamed(from, to){
    let hit = false;
    for(const s of LookLib.list){ if(s.配色 === from){ s.配色 = to; hit = true; } }
    if(hit) LookLib.save();
  }
};

/* ============================================================
   #292 外观方案：data\looks.yaml
   一套方案一段：配色、外观模式、纹理、字体、两档圆角。
   一条方案就是「点开下拉选它，整个 Flow-Desk 换成这个样子」那一套东西。
   ============================================================ */
/* 界面说法 ↔ 内部 key：外观模式 / 纹理都从 _shared/sh-look.js 那两张表里现取，不再抄第二份 */
function lookModeByName(n){ return LOOK_MODES.find(x => x.name === n) || null; }
function lookTexByName(n){ return lookTexName(n); }
const LOOK_HEAD = [
  '# 【外观方案】Flow-Desk 里每一套外观方案都记在这份清单上',
  '#   这是一份 YAML（YAML 就是"用缩进和冒号排版"的纯文本），记事本、Notepad++ 都能直接改；存盘请保持 UTF-8 编码。',
  '#   一套方案一段：顶格那一行写着方案名，界面上方案下拉里看到的就是这个名字；底下缩进两格的是这一套的内容。',
  '#   一套方案 = 配色 + 标记色 + 外观模式 + 纹理 + 分组 + 字体 + 圆角。挑中一条，Flow-Desk 连它带的配色和标记色一起换过去。',
  '#     配色：写色卡里成套那一份（data\\palettes.yaml）的一个段名，界面上配色下拉列的就是它。',
  '#     明暗：这一套方案归明亮池还是黑暗池 —— 自动 / 明亮 / 黑暗。',
  '#       自动 = 跟着上面 配色 那一套现算（拿识别出来的底色和正文比高低）；写明亮或黑暗 = 钉住归哪一池，不再看配色。',
  '#       界面上「方案设定」那一页有同一档，改这里和改那里是一回事。',
  '#     标记色：这一套方案自己定的一串颜色，分号隔开一行写完（#3b6cb5;#5ea36a;#c1663f）。',
  '#       最少 3 个、最多 20 个；空着 = 这一套没单独选过标记色，切到它时屏幕上原来那一串接着用（不换、也不替你写上去）。',
  '#       这一串在界面上取的是 --mark-1 … --mark-N，按这里写的次序一个一个排上去，颜色原样上，不跟着配色换算。',
  '#     外观模式：质感 / 辉光 / 纯平 / 无界 —— 只管边框、阴影、边界线、发光。',
  '#       卡片底只有实色这一档，2026-10-04 把材质（拟液态玻璃 / 凝态 / 霜态）和「真液态对比」那个开关从程序里撤了，',
  '#       这两行不再写进文件；文件里还留着旧行的，读的时候整行跳过，不报错。',
  '#     纹理：无，或者图片库（那份是 data\\images.yaml）里 用途 写着「纹理·四方连续图」的那一个名字。',
  '#       这一层铺在哪些面上：Flow-Desk 的背景、卡片面、展开后的组件面。',
  '#     纹理用法：去色 = 这张图只当无色的材质用，颜色跟着这套配色走；直接使用 = 原图进，图是什么色就铺什么色。',
  '#     背景图：无，或者图片库里 用途 写着「背景图」的那一个名字。这一张只铺 Flow-Desk 的背景，',
  '#       不碰卡片、也不碰展开后的组件。',
  '#     字体：界面上字体选择器里那个名字，空着跟 Flow-Desk 默认那套。',
  '#     字重：100~900 里的一档（300 细 / 400 标准 / 500 中 / 700 粗 这一类），空着跟默认那档（400 标准）。',
  '#       这一栏只管界面上没自己写粗细的那些文字；标题、选中态那些本来就写了要粗一档的，照旧往这一家底下',
  '#       那一张更粗的真脸上挑（这一个字体家只有一张脸时才拿假粗凑）。这一家底下有哪几档，看「方案资源 · 字体」里那行的字体信息。',
  '#     卡片圆角、控件圆角：0~30，单位是像素。',
  '#     卡片间距：写「自动」就跟着格子大小走（屏幕大间距就大），写数字就钉死这一档（4~24，单位是像素）。',
  '#       从前这一档住在机器存档顶上（所有方案共用一个数），2026-10-08 按作者的话挪进方案里来了。',
  '#     作者：想记是谁配的就写，不写空着。',
  '#   改完存盘，正在用的那一套方案当场跟着变；没在用的那几条，挑到它的时候才照新内容变。',
  '#   认不出的那一段整段跳过，认不出的那一个字段只当没写（外观模式退回默认那一档），其余照常。',
  '#   以 # 开头的行是说明，程序读的时候跳过。',
  ''
].join('\n');
/* ---------- 卡片间距（2026-10-08 作者的话：「为方案设置数据：圆角、间距数据」）----------
   从前这一档住在机器存档顶上（Settings 里那个 gapFd），所有方案共用一个数 —— 换方案间距跟着旧值走，
   和圆角不是同一个待遇。现在它进方案文件，和两档圆角并列，文件里只剩一条路：
   「自动」= 排版那一步按格子短边现算（Shell.fitGrid），屏幕换了它自己跟着换；写数字就钉死这一档。
   钉死那一档的下限给到 4（不是 0）：比 4 小的间距在 60 像素的格子上就是卡片挨卡片，画不出边界。 */
const LOOK_GAP_AUTO = '自动';
const LOOK_GAP = { min:4, max:24 };
function lookGap(v){
  const n = Math.round(+v || 0);
  return n <= 0 ? 0 : Math.max(LOOK_GAP.min, Math.min(LOOK_GAP.max, n));
}
/* ---------- 全局字重（外31 二组 · 作者的话：「应当根据字体可以选择不同的字重」）----------
   文件里认两种写法：那一个数（100~900，一位一档），或者界面上那几个中文字（细 / 标准 / 中 / 粗 …）——
   这份文件他拿记事本直接改，「字重: 中」比「字重: 500」好认。认不出的一律当没写（跟默认那档 400 走），
   不硬猜、也不报错。中文字那一张表就是字体层里那一份（ffWeightName），两头不各写一套说法。 */
function lookWeight(v){
  const s = String(v == null ? '' : v).trim();
  if(!s || s === '0') return '';
  const n = Math.round(+s);
  if(n >= 100 && n <= 900 && n % 100 === 0) return String(n);
  for(const w of [100, 200, 300, 400, 500, 600, 700, 800, 900]) if(ffWeightName(w) === s) return String(w);
  return '';
}
/* ---------- 纹理怎么用（2026-10-08 作者的话：「可选择去色（纹理/四方连续图仅作为无色材质、颜色跟着配色走）
     还是直接使用（原图进入）」）----------
     去色那一档在样式表里就两下：把那张图先洗成灰的，再让它和底下那块面叠（overlay）——
     图只剩下纹路和明暗，颜色由这一套配色供；直接使用那一档一个字都不动，图进去就是原图。 */
const LOOK_TEX_WAYS = ['直接使用', '去色'];
function lookTexWay(v){
  const s = String(v || '').trim();
  return LOOK_TEX_WAYS.includes(s) ? s : LOOK_TEX_WAYS[0];
}
/* 占位那三套：先摆三个能一眼看出差别的样子，一套一档外观模式 */
/* 标记色 那一栏在文件里是一串分号隔开的色号（和 按语言 同一分法）：
   读的时候只认 #rrggbb 那一种写法、去重、封顶 MARK_MAX，认不得的那一截丢掉不报错；
   写的时候由 Marks 现洗过一遍，这里只是原样拼起来。 */
function marksText(list){ return (Array.isArray(list) ? list : []).filter(h => /^#[0-9a-f]{6}$/i.test(String(h))).map(h => String(h).toLowerCase()).join(';'); }
function marksOf(txt){
  const out = [];
  for(const seg of String(txt || '').split(';')){
    const h = String(seg || '').trim().toLowerCase();
    if(/^#[0-9a-f]{6}$/.test(h) && !out.includes(h)) out.push(h);
    if(out.length >= MARK_MAX) break;
  }
  return out;
}
/* 占位那三套：先摆三个能一眼看出差别的样子，一套一档外观模式。
   标记色 那一律空着 —— 这三套是程序摆的占位，不该替用户定一串他还没见过的颜色；
   空着的含义就是「没单独选过」，切到它时屏幕上那一串沿用不动（见上面 标记色 那一段说明）。 */
/* 一套方案的明暗归属（外34 图12）：自动 = 跟着它 配色 那一套现算，写明亮 / 黑暗 = 钉住归哪一池。 */
const LOOK_MD = ['自动', '明亮', '黑暗'];
const LOOK_SEED = [
  { 方案名:'质感·浅色日常', 配色:'RP 明亮', 标记色:[], 外观模式:'质感', 纹理:'无', 纹理用法:'直接使用', 背景图:'无', 分组:'常用', 字体:'', 卡片圆角:5, 控件圆角:5, 间距:0, 作者:'' },
  { 方案名:'辉光·夜间',     配色:'RP 黑暗', 标记色:[], 外观模式:'辉光', 纹理:'无', 纹理用法:'直接使用', 背景图:'无', 分组:'常用', 字体:'', 卡片圆角:5,  控件圆角:5,  间距:0, 作者:'' },
  { 方案名:'无界·写作专注', 配色:'RP 黑暗', 标记色:[], 外观模式:'无界', 纹理:'无', 纹理用法:'直接使用', 背景图:'无', 分组:'写作', 字体:'', 卡片圆角:0,  控件圆角:0,  间距:0, 作者:'' },
];
/* 按语言那几档在文件里写成一串：中文简体=宋体;英语=Times New Roman
   分号只在这里当分隔（字体名里带分号的情况实际没有，带上也只是那一档认不出、当没钉）；
   读的时候只认 FF_LANGS 里有的那几个档名，认不出的那一截丢掉，不报错。 */
function ffLangMap(txt){
  const out = {};
  for(const seg of String(txt || '').split(';')){
    const i = seg.indexOf('='); if(i < 0) continue;
    const k = seg.slice(0, i).trim(), v = seg.slice(i + 1).trim();
    const l = (typeof FF_LANGS !== 'undefined' ? FF_LANGS : []).find(x => x.name === k || x.k === k);
    if(l && v) out[l.k] = v;
  }
  return out;
}
function ffLangText(map){
  const L = (typeof FF_LANGS !== 'undefined' ? FF_LANGS : []);
  return Object.keys(map || {}).filter(k => map[k]).map(k => {
    const l = L.find(x => x.k === k); return (l ? l.name : k) + '=' + map[k];
  }).join(';');
}
const LookLib = {
  name:LOOKS_FILE,
  ready:false, list:[],
  get(){ return this.cur ? this.list.find(x => x.方案名 === this.cur) : null; },
  /* ---------- 一条方案 ↔ 文件里的一段 ---------- */
  fields(s){
    return { 配色:s.配色 || '', 明暗:s.明暗 || LOOK_MD[0], 标记色:marksText(s.标记色), 外观模式:s.外观模式 || '',
      纹理:s.纹理 || '无', 纹理用法:s.纹理用法 || LOOK_TEX_WAYS[0], 背景图:s.背景图 || '无',
      分组:s.分组 || '', 按语言:ffLangText(s.按语言),
      字体:s.字体 || '', 字重:s.字重 ? String(s.字重) : '', 卡片圆角:String(s.卡片圆角), 控件圆角:String(s.控件圆角),
      /* 0 写成一个字「自动」而不是一个数字：这份文件他直接拿记事本看，「间距: 自动」不用回头查数表 */
      间距:(+s.间距 > 0 ? String(s.间距) : LOOK_GAP_AUTO), 作者:s.作者 || '' };
  },
  scheme(sec){
    const f = sec.fields || {};
    const n = k => { const v = String(f[k] || '').trim(); return v; };
    const md = lookModeByName(n('外观模式')) || lookModeByName(LOOK_SEED[0].外观模式);
    const tx = n('纹理'); const tex = (!tx || tx === '无') ? '' : ((lookTexByName(tx) || {}).k || '');
    return { 方案名:sec.name,
      配色:n('配色'),
      /* 明暗 这一栏（外34 图12）：自动 = 跟着 配色 那一套现算；写明亮 / 黑暗 = 钉住归哪一池。
         认不出的写法当「自动」，和 外观模式 那一栏同一处理方式。 */
      明暗:LOOK_MD.indexOf(n('明暗')) >= 0 ? n('明暗') : LOOK_MD[0],
      标记色:marksOf(f.标记色), 外观模式:md.name,
      纹理:tex ? (lookTexByName(tx) || {}).name : '无', texKey:tex,
      /* 纹理怎么用（去色 / 直接使用）和背景那一张图，都是方案自己的两栏（外29 丁组）。
         背景图 那一栏只认图库里 用途 写着「背景图」的那些：写错了名字、或者那张被划掉了，就当没写（退回「无」），
         和上面 纹理 那一栏同一个处理方式 —— 屏幕上不摆一条挑了什么都不铺的假名字。 */
      纹理用法:lookTexWay(n('纹理用法')),
      背景图:imgWallName(n('背景图')),
      /* 强度那一栏整串撤了（2026-10-08 作者的话：删除纹理强度系列设置）。旧文件里还写着的那一行读到手也不管，
         从前读文件这一头夹到 100，写文件那一头夹到 40，两处口径不一样。 */
      分组:n('分组'), 按语言:ffLangMap(n('按语言')),
      字体:n('字体'), 字重:lookWeight(f.字重),
      卡片圆角:Math.max(0, Math.min(30, Math.round(+f.卡片圆角 || 0))),
      控件圆角:Math.max(0, Math.min(30, Math.round(+f.控件圆角 || 0))),
      间距:lookGap(f.间距),
      作者:n('作者') };
  },
  text(){ return LibYml.emit(LOOK_HEAD, this.list.map(s => ({ name:s.方案名, fields:this.fields(s) })),
      ['配色', '明暗', '标记色', '外观模式', '纹理', '纹理用法', '背景图', '分组', '按语言', '字体', '字重', '卡片圆角', '控件圆角', '间距', '作者']); },
  /* ---------- 开机：文件空着就摆三条占位 + 把当前这一套原样记成一条；有内容照文件认 ---------- */
  async boot(){
    const text = await LibStore.fetchRaw(LOOKS_FILE);
    if(text === null){ console.warn('外观方案这一趟没读到，先按当前这一套跑'); return this; }
    const secs = LibYml.parse(text);
    if(secs.length) this.list = secs.map(s => this.scheme(s));
    else{
      /* 用户当前那一份外观原样记成一条，放在最前面：一打开程序看到的就是它，界面不因为搬家而换个样子 */
      this.list = [this.snapshot('当前外观')].concat(LOOK_SEED.map(s => Object.assign({}, s)));
      this.cur = '当前外观';
      await this.saveNow();
    }
    /* 当前用哪一条：认名字；名字没了（被删被改名）退回第一条 */
    if(!this.cur) this.cur = LookStore.data.lookCur || '';
    if(!this.cur || !this.list.find(x => x.方案名 === this.cur)) this.cur = (this.list[0] || {}).方案名 || '';
    this.ready = true;
    this.saveState();
    return this;
  },
  /* 把现在生效的这一套（配色 + 外观那一串）读成一条方案 */
  snapshot(name){
    const c = Theme.cfg, p = Palette.cur;
    const md = lookMode(c.mode);
    const tx = lookTex(c.tex);
    return { 方案名:name, 配色:(p && p.name) || '',
      /* 存的就是屏幕上此刻活着的那一串（Marks.live）：这一套没钉过时 snapshot 出来的串就是沿用的那一串，
         这正是「先沿用、他动了才钉上」的意思 —— 存成一套新方案时他那一串跟着走，不凭空另起一套 */
      标记色:(typeof Marks !== 'undefined' ? Marks.hexes() : []), 外观模式:md.name,
      纹理:tx ? tx.name : '无', texKey:c.tex || '',
      纹理用法:c.texGray ? '去色' : '直接使用', 背景图:c.wallImg || '无',
      /* 强度那一档不再往外写（2026-10-08 整串撤了）：往前的存档里留着的那个数由界面那头一并忽略，
         界面上那根滑杆顶只到 40、真正生效的也是 40 —— 文件里的数和屏幕上对不上，白留一个够不着的值。 */
      字体:c.font || '', 字重:c.weight || '', 卡片圆角:clampRadius(c.radiusCard), 控件圆角:clampRadius(c.radiusCtl),
      间距:lookGap(c.gap), 作者:'' };
  },
  /* 一条方案 → 生效：外观模式这些写回 Theme.cfg，配色挑中同名的那条，然后重新上色 */
  apply(s, opt){
    if(!s) return false;
    const c = Theme.cfg;
    const md = lookModeByName(s.外观模式) || LOOK_MODES[0];
    c.mode = md.k;
    c.tex = s.texKey !== undefined ? s.texKey : ((lookTexByName(s.纹理) || {}).k || '');
    c.font = s.字体; c.weight = s.字重 || ''; c.fontLangs = s.按语言 || {}; c.radiusCard = s.卡片圆角; c.radiusCtl = s.控件圆角;
    /* 间距跟着方案走（0 = 自动，排版那一步按格子短边现算）：这一档从前住在机器存档顶上，2026-10-08 搬进来 */
    c.gap = lookGap(s.间距);
    /* 纹理怎么用、背景那一张图：两样都是方案自己的（外29 丁组）。
       背景图 存的是图库里那个名字，地址由 Theme.wallUrl 现读 —— 这里只把名字交出去，不缓存地址 */
    c.texGray = lookTexWay(s.纹理用法) === '去色';
    c.wallImg = s.背景图 && s.背景图 !== '无' ? s.背景图 : '';
    /* 标记色跟着方案走（2026-10-08 作者的话：「换方案标记色跟着换，只不过如果新的方案没有单独选择标记色，
       会沿用之前的标记色」）：这一套钉过一串就换成它那一串，那一栏空着就一个字不动。
       排在配色挑中之后、Theme.save 之前 —— 根元素上那一串 --mark-N 由它自己上，不参与派生。 */
    if(typeof Marks !== 'undefined' && Marks.随方案) Marks.随方案(s.标记色);
    const pal = Palette.items.find(x => x.name === s.配色);
    /* 配色那一栏指着的名字在色卡里找不到（手工改文件、或者那条被删了）：
       就用当前这套色，方案里那一行照原样留着 —— 文件是用户写的，不偷偷替他改。 */
    if(pal && pal.id !== Palette.data.cur) Palette.select(pal.id);
    Theme.save(); Theme.apply();
    /* 间距这一档是排版那一步现算的（--gap 由 fitGrid 重写），拖滑杆那一头不走重排桌面，
       所以这里补一句：不补就是「文件里写了 18、屏幕上还是旧的那个数」，要等下次换窗口大小才跟上。 */
    try{ Shell.fitGrid(); }catch(e){}
    Bus.emit('theme');
    if(!(opt && opt.noRender)) Shell.render();
    return true;
  },
  /* 挑中一条：当前记它，整套生效 */
  pick(name){
    const s = this.list.find(x => x.方案名 === name); if(!s) return false;
    this.cur = name; this.saveState();
    return this.apply(s);
  },
  /* 界面上动过一笔之后问一句：覆盖当前这一条 / 另存为一条新的 / 先都不写 */
  overwrite(){
    const s = this.snapshot(this.cur);
    const at = this.list.findIndex(x => x.方案名 === this.cur);
    if(at >= 0) this.list[at] = s; else this.list.push(s);
    return this.saveNow();
  },
  saveAs(name){
    const clean = this.uniqueName(name);
    if(!clean) return Promise.resolve({ ok:false, msg:'方案名空着，写不出去' });
    const s = this.snapshot(clean);
    const at = this.list.findIndex(x => x.方案名 === this.cur);
    this.list.splice(at < 0 ? this.list.length : at + 1, 0, s);
    this.cur = clean; this.saveState();
    return this.saveNow();
  },
  /* 段名就是这一套方案的身份：文件里同名只认头一段，所以另存/新建之前先让位（我的方案 2 这样） */
  uniqueName(base){
    const n0 = String(base || '').trim() || '新方案';
    if(!this.list.find(x => x.方案名 === n0)) return n0;
    for(let i = 2; i < 500; i++){ const c = n0 + ' ' + i; if(!this.list.find(x => x.方案名 === c)) return c; }
    return n0 + ' ' + Date.now();
  },
  /* 删一条：就剩一条时不让删（外观不能没有方案）。删的是当前这条就切到第一条。 */
  /* 改一套方案的名字：库里那条跟着改，正用着的这一套的名字也跟着改（不然屏幕上写着旧名、文件里是新名）。
     撞名不当成功：先让位成「新名 2」，和新建那一条同一个口径，界面上告诉他用的是哪个。 */
  /* 给一套方案记一个组名（界面上那只下拉按组分开摆）。空着 = 不归组；组名没有清单，
     写什么就是什么 —— 攒出几个组由人自己定，程序不预设一套分类法。 */
  setGroup(name, g){
    const s = this.list.find(x => x.方案名 === name);
    if(!s) return { ok:false, msg:'没这一套方案' };
    s.分组 = String(g || '').trim();
    this.saveNow();
    return { ok:true, group:s.分组 };
  },
  groups(){ return [...new Set(this.list.map(x => x.分组).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh')); },
  rename(from, to){
    const s = String(to || '').trim();
    const at = this.list.findIndex(x => x.方案名 === from);
    if(at < 0) return { ok:false, msg:'没这一套方案' };
    if(!s) return { ok:false, msg:'名字不能空着' };
    if(s === from) return { ok:true, name:from };
    if(this.list.find(x => x.方案名 === s)) return { ok:false, msg:'库里已经有一套叫「' + s + '」的' };
    this.list[at].方案名 = s;
    if(this.cur === from) this.cur = s;
    this.saveState(); this.saveNow();
    return { ok:true, name:s };
  },
  /* 一套配色被删掉之后，指着它的那些方案一起改口（外34 图13：删一次配色，
     有两条方案的 配色 就指向一个不存在的段名，于是它在明亮池和黑暗池两头都数不着，
     下拉里凭空少两套、界面上那句「外观方案 1 套」也跟着对不上）。 */
  repoint(from, to){
    let n = 0;
    for(const s of this.list) if(s.配色 === from){ s.配色 = to; n++; }
    if(n) this.saveNow();
    return n;
  },
  remove(name){
    if(this.list.length <= 1) return { ok:false, msg:'就剩这一套方案了，删掉就没有方案可用了' };
    const at = this.list.findIndex(x => x.方案名 === name);
    if(at < 0) return { ok:false, msg:'没这一套方案' };
    this.list.splice(at, 1);
    if(this.cur === name){ this.cur = (this.list[0] || {}).方案名 || ''; this.saveState(); this.apply(this.get()); }
    else this.saveState();
    this.saveNow();
    return { ok:true };
  },
  saveNow(){ return LibStore.putRaw(LOOKS_FILE, this.text()); },
  save(){ if(this.ready) LibStore.later(LOOKS_FILE, this.text()); },
  async reload(){
    const secs = LibYml.parse(await LibStore.fetchRaw(LOOKS_FILE));
    if(!secs.length) return false;
    this.list = secs.map(s => this.scheme(s));
    if(!this.list.find(x => x.方案名 === this.cur)) this.cur = (this.list[0] || {}).方案名 || '';
    this.saveState();
    this.apply(this.get());
    return true;
  },
  /* 当前用哪一条 + 那一套不进方案的外观：都住在 data\appearance.json 这一份存档里 */
  saveState(){ LookStore.data.lookCur = this.cur || ''; LookStore.save(); }
};

/* ============================================================
   方案资源 · 图片：data\images.yaml（外29 丁组 第 4 页）
   一张图一段：段名就是界面上挑图时看到的那个名字，底下写图在哪个文件、当初按什么用途导的、谁导的。
   ----------
   导入那一步先选用途（作者的话）：「按背景图导入（进入背景图图库，方案可在这里选背景）、
   按取色素材导入（只取颜色，颜色进入色卡）、按纹理/四方连续图导入（可以在方案中设置为纹理/四方连续图图片）」
   —— 三种都攒在这同一份清单里，只是 用途 那一栏不一样；界面按用途分三块摆，挑图的下拉各吃各的那一块。
   ----------
   为什么图不在清单里、名字要在：图标那一层（sh-ico.js）把 icons\ 和 data\images\
   两层扫成同一张「名字 → 地址」的表，认的是文件名去掉后缀那一个 —— 而文件名进程序时被洗过一道
   （非英文数字的字符一律换成连字符，见那边的 iconKey），中文名在这一步就没了。所以界面上那个名字
   只能由这份清单记着：物理文件名只管找图，段名只管给人看，两份各干各的。
   ----------
   导入时给的文件名是 img-<时间戳+随机> 这一种，故意不用原图的名字：两张原名一样的图
   （都叫 纹理.png）落在同一格会互相盖掉，而按原名生成的表键也一样，界面上就成了
   「下拉里只有一条、换了一张另一张也跟着变」。名字由他在对话框里写，撞了就自动让位。
   ----------
   划掉一张图只删清单里那一段，图留在 data\images\ 不动 ——
   删图这一步交给他自己在记事本里做；程序不替他删他磁盘上的东西。
   ----------
   预设纹理那一批（icons\textures\ 那十一张 + data\textures.yaml 那份清单 + data\textures\ 那一格）
   2026-10-08 按作者的话全撤了 —— 「删除当前所有预设纹理」。图上只有一条路：往这一份里导。
   ============================================================ */
const IMG_FILE = 'images.yaml';
/* 导入时挑的那三种用途（界面和文件里都写中国话，不加内部码） */
const IMG_USES = [{ k:'背景图', t:'按背景图导入' }, { k:'取色素材', t:'按取色素材导入' },
  { k:'纹理·四方连续图', t:'按纹理 / 四方连续图导入' }];
function imgUseOf(v){
  const s = String(v || '').trim();
  const hit = IMG_USES.find(x => x.k === s);
  return hit ? hit.k : IMG_USES[2].k;    /* 旧清单搬过来的、或手工写错的，一律算纹理那一种 */
}
const IMG_HEAD = [
  '# 【图片库】你自己导进来的那些图，每一张记在这里',
  '#   这是一份 YAML（YAML 就是"用缩进和冒号排版"的纯文本），记事本、Notepad++ 都能直接改；存盘请保持 UTF-8 编码。',
  '#   一张图一段：顶格那一行写着图的名字，界面上挑图那一排里看到的就是这个名字。',
  '#     图：这张图在 数据\\images\\ 里的文件名（带着后缀），程序就按这个名字去那一个文件夹找图。',
  '#       名字对不上、或者那张图被删了，界面里这一档就不出现（不是摆一条灰的给你点）。',
  '#     用途：导入那一步挑的，三种里挑一个 —— 背景图 / 取色素材 / 纹理·四方连续图。',
  '#       背景图：进背景图图库，方案在「方案编辑」那一页挑它当背景（只铺 Flow-Desk 的背景）。',
  '#       取色素材：只拿来取颜色，取出来的色进色卡，这张图本身不铺到屏幕上。',
  '#       纹理·四方连续图：方案可以把它设成纹理，铺到 Flow-Desk 背景、卡片面、展开后的插件卡面上。',
  '#     作者：想记是谁做的这张图就写，不写空着。',
  '#   界面上「划掉这张图」只删这一段，图本身留在 数据\\images\\ 不动；要真删图请自己在文件夹里删。',
  '#   改完存盘，Flow-Desk 里那一排下拉当场跟着变，不用重启。',
  '#   认不出的那一段整段跳过；段名重复只认头一段。',
  '#   以 # 开头的行是说明，程序读的时候跳过。',
  ''
].join('\n');
/* 物理文件名 → 图标表里那个键：去掉后缀，再走一遍和 sh-ico.js 的 iconKey 同一样的清洗。
   这里自己写一遍而不去调那边：那份清洗是扫描时对着真实文件名做的，这一份对着清单里写的文件名做，
   两边要用同一个式子才对得上；写成同一个函数反而会把「清单里的名字」和「文件里的名字」混成一件。 */
function imgKey(file){
  const s = String(file || '').trim();
  if(!s) return '';
  const at = s.lastIndexOf('.');
  const base = at > 0 ? s.slice(0, at) : s;
  return base.replace(/[^a-zA-Z0-9_-]/g, '-');
}
/* 图库里这一张在屏幕上的地址：图标那一层把 data\images\ 扫成「images-<文件名>」，只问这一头。
   取不到就是那张图真不在盘上（他自己在记事本里删了、或者那一格没建起来），界面上按「没认到那张文件」报。 */
function imgUrl(t){
  const k = imgKey(t && t.文件); if(!k) return '';
  try{
    if(typeof Ico !== 'undefined' && Ico.url) return Ico.url('images-' + k) || '';
  }catch(e){}
  return '';
}
/* 原图字节（取色、量壁纸那块等效底都要真字节，不能拿缩放过的地址凑）：取到一份就留着 */
const imgBlobs = {};
async function imgBlob(t){
  const u = imgUrl(t); if(!u) return null;
  if(imgBlobs[u]) return imgBlobs[u];
  try{ const b = await (await fetch(u)).blob(); imgBlobs[u] = b; return b; }
  catch(e){ return null; }
}
/* 方案里 背景图 那一栏只认图库里「按背景图导入」的那几张：名字写错、那张被划掉了、
   或者拿一张纹理来当背景，一律退回「无」—— 和 纹理 那一栏同一个口径，
   界面上不摆一条挑上什么都不铺的假选项。 */
function imgWallName(nm){
  const t = ImgLib.find(nm);
  return t && t.用途 === '背景图' ? t.名字 : '无';
}
const ImgLib = {
  name:IMG_FILE,
  ready:false, list:[],
  /* ---------- 一张图 ↔ 文件里的一段 ---------- */
  fields(t){ return { 图:t.文件 || '', 用途:t.用途 || '', 作者:t.作者 || '' }; },
  entry(sec){
    const f = sec.fields || {};
    return { 名字:sec.name, 文件:String(f.图 || '').trim(),
      用途:imgUseOf(f.用途), 作者:String(f.作者 || '').trim() };
  },
  text(){ return LibYml.emit(IMG_HEAD, this.list.map(t => ({ name:t.名字, fields:this.fields(t) })),
      ['图', '用途', '作者']); },
  find(name){ const n = String(name || '').trim(); return n ? this.list.find(t => t.名字 === n) : null; },
  /* 按用途挑出来那几张（下拉和图库那一屏各吃各的那一块） */
  byUse(use){ return this.list.filter(t => t.用途 === use); },
  /* 外观层要的那一份纹理名单：只有「纹理·四方连续图」那一种用途的才算纹理 */
  texList(){ return this.byUse('纹理·四方连续图').map(t => ({ k:imgKey(t.文件), name:t.名字 })); },
  sync(){ lookTexSet(this.texList()); },
  /* 界面上挑中的那一档是不是图库里的（决定「划掉这张图」那一枚摆不摆） */
  isKnown(name){ return !!this.find(name); },
  /* 段名就是这张图的身份：文件里同名只认头一段，所以进来之前先让位（水磨石 2 这样）。 */
  uniqueName(base){
    const taken = nm => !!this.list.find(x => x.名字 === nm);
    const n0 = String(base || '').trim() || '未命名图';
    if(!taken(n0)) return n0;
    for(let i = 2; i < 500; i++){ const c = n0 + ' ' + i; if(!taken(c)) return c; }
    return n0 + ' ' + Date.now();
  },
  /* ---------- 开机：文件还没写就先落地一份带说明的空清单，有内容照文件认 ---------- */
  async boot(){
    const text = await LibStore.fetchRaw(IMG_FILE);
    if(text === null){ console.warn('图片库这一趟没读到（读写那一层还没连上），先按空清单跑'); return this; }
    this.list = LibYml.parse(text).map(s => this.entry(s)).filter(t => t.名字 && t.文件);
    this.sync();
    if(text === '') await this.saveNow();       /* 第一次开机：把说明那一段先写出去，让他看得见这份长什么样 */
    this.ready = true;
    return this;
  },
  /* 收进一张图：图已经落盘了（putBytes 那一步过了），这里只记名单。交回界面上用的那个名字。 */
  add(name, file, use, author){
    const clean = this.uniqueName(name);
    const at = this.list.findIndex(x => x.文件 === file);
    const rec = { 名字:clean, 文件:file, 用途:imgUseOf(use), 作者:author || '' };
    if(at >= 0) this.list[at] = rec; else this.list.push(rec);
    this.sync(); this.saveNow();
    return clean;
  },
  /* 改用途（图库那一屏上「改成当背景图用」那一档）：只动清单里那一栏 */
  setUse(name, use){
    const t = this.find(name); if(!t) return false;
    t.用途 = imgUseOf(use); this.sync(); this.saveNow();
    return true;
  },
  /* 只删这一段，图留在原地 */
  remove(name){
    const at = this.list.findIndex(x => x.名字 === String(name || '').trim());
    if(at < 0) return { ok:false, msg:'图库里没有这一张' };
    this.list.splice(at, 1);
    this.sync(); this.saveNow();
    return { ok:true };
  },
  saveNow(){ return LibStore.putRaw(IMG_FILE, this.text()); },
  /* 外部（记事本 / 别的窗口）改了这一份：重认一遍 + 把外观重铺一次。
     当前正在用的那一张被删掉时，Look.url 认不到图就不写 --tex-image，卡片当场退回实色，
     界面上那一档也从下拉里消失 —— 不出现「下拉写着名字、屏幕上什么都没铺」。 */
  async reload(){
    const text = await LibStore.fetchRaw(IMG_FILE);
    if(text === null || text === '') return false;
    this.list = LibYml.parse(text).map(s => this.entry(s)).filter(t => t.名字 && t.文件);
    this.sync();
    try{ Theme.apply(); Bus.emit('theme'); }catch(e){}
    try{ if(typeof Shell !== 'undefined' && Shell.refreshSoon) Shell.refreshSoon(); }catch(e){}
    return true;
  },
  /* 屏幕上此刻能不能取到这张图的地址（图库那一屏按这一条判「认到了没有」） */
  url(name){ const t = this.find(name); return t ? imgUrl(t) : ''; },
  blob(name){ const t = this.find(name); return t ? imgBlob(t) : Promise.resolve(null); },
  /* ---------- 把一张图的字节落到 数据\images\ ----------
     程序里走现成的 writePageBytes（fs:write 第三参会把 数据\images\ 这一格自己建出来）；
     开发那台服务器没有那层桥，走 /_img 那一条，落点完全一样。 */
  async putBytes(file, bytes){
    const clean = String(file || '').trim();
    if(!/^[A-Za-z0-9._-]{1,64}$/.test(clean) || clean.includes('..'))
      return { ok:false, msg:'这个名字放不进图库那一格' };
    const A = window.FD_APP;
    if(A && A.writePageBytes){
      try{ await A.writePageBytes('data/images/' + clean, bytes); return { ok:true }; }
      catch(e){ return { ok:false, msg:String((e && e.message) || e) }; }
    }
    try{
      const r = await fetch('/_img?name=' + encodeURIComponent(clean),
        { method:'POST', body:bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes) });
      const j = await r.json().catch(() => null);
      return (j && j.ok === false) ? j : { ok:true };
    }catch(e){ return { ok:false, msg:String((e && e.message) || e) }; }
  }
};

/* ---------- 开机那一步：三份文件先后认下来，再把外部改动那条广播接上 ----------
   色卡排在前面：外观方案里 配色 那一栏指着它的名字；图片库排在方案之前，
   方案里 纹理 和 背景图 那两栏要按名字认到库里那几张（lookTexByName 走的是外观层那张合并后的名单）。
   认完之后只重绘一次 —— 第一次开机把现有那些写进文件不该看着像「方案被换过了」。 */
async function bootLibs(){
  await PalLib.boot();
  /* 色卡（外29）：自己一个档，读不读得回来都不碍着那三份，单独兜住 */
  try{ await CardPool.boot(); }catch(e){ console.warn('色卡没认下来，这一趟先按内存里那份跑：' + ((e && e.message) || e)); }
  await ImgLib.boot();
  /* 随包那 6 张纹理开机收进图库（和色卡那 1307 个色号同一件事：他说「嵌入」就是开箱要有） */
  try{ await 内置纹理收(); }catch(e){ console.warn('内置纹理这一趟没收进来：' + ((e && e.message) || e)); }
  await LookLib.boot();
  /* 卡片间距从前住在机器存档顶上（Settings 里那个 gapFd，所有方案共用一根滑杆）：
     第一次跑到这一趟把它搬进当前正在用的那一套方案，然后把机器存档里那一份让位掉 ——
     从此这一档只住方案文件里，不留「方案一个数、机器一个数」两个口径。
     方案里已经钉过数的（他自己在这根滑杆上动过）不搬，机器那份是空的那一趟也不折腾。 */
  const 老间距 = Settings.get('gapFd', null);
  if(老间距 !== null){
    const n = lookGap(老间距), s = LookLib.get();
    if(n > 0 && s && !(+s.间距 > 0)){ s.间距 = n; await LookLib.saveNow(); Theme.cfg.gap = n; Theme.save(); }
    Settings.set('gapFd', null);
  }
  /* 背景那一张：旧存档里挂着文件手柄的那两回（普通图片 / 四方连续）先收进图库，
     再把方案生效下来 —— 顺序反了就会「图上写着名字、屏幕上什么都不铺」（和纹理那一档同一条规矩）。 */
  try{ await Theme.wallLift(); }catch(e){ console.warn('旧存档里那一张背景图没搬进图库：' + ((e && e.message) || e)); }
  const hit = LookLib.get();
  if(hit) LookLib.apply(hit, { noRender:true });
  try{ await Theme.wallSync(); }catch(e){}
  if(hit) Theme.apply();
  LibStore.hook(async name => {
    if(name === PAL_FILE){
      await PalLib.reload();
      /* 配色可能改了名或改了内容：当前那条方案里指的名字跟着改口，界面上的色也重上一遍 */
      Theme.apply(); Shell.render();
      return;
    }
    if(name === LOOKS_FILE){ await LookLib.reload(); return; }
    if(name === IMG_FILE) await ImgLib.reload();
  });
}
