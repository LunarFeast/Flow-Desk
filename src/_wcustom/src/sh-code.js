/* ============================================================
   组件「改代码」= 直接改这一家自己那一格里的文件
   ----------
   乙案之后插件代码不拼在产物里：data\plugins\<id>\main.js 就是它现在跑的这一份。
   存了就是新的 —— 存完立刻重载这一家（加载器 PackLoader.reload 重新 import 一遍，
   宿主在那儿重画这张卡），既不跑重新构建，也不用刷新整页。
   想回到出厂那一版：「恢复出厂」从程序自带的那一层
   （resources\app\data\plugins\<id>\）把同一份文件原样拷回来。
   ----------
   两条通道同一个口径（三道闸都写在 src\pack\comp-files.cjs 里：
   包名只认干净字符 · 相对路径不许有 .. · 落点必须在 plugins\<id>\ 里面）：
     · Flow-Desk 程序（fdapp://）→ 主进程 FD_APP.compRead / compList / compWrite / compRestore / compFactory；
     · 本地开发那台 http 服务器（fd-serve）→ 同一个 comp-files.cjs 挂在 /_comp 上，
       改的也是真文件，不会出现「那一份是草稿、这一份才作数」两套真相。
   配方组件（demo-scene 那种）不走这里 —— 它的「改代码」开的是「组件定制」向导，
   向导写的是同一格里的 main.js + recipe.json，存完同样立刻重载这一家。
   ============================================================ */
const PackCode = {
  /* ---------- 一条通道两种走法 ---------- */
  async call(op, payload){
    const A = window.FD_APP;
    const b = Object.assign({ op }, payload || {});
    if(A && typeof A.compRead === 'function'){
      if(op === 'read')    return await A.compRead(b.id, b.rel);
      if(op === 'list')    return await A.compList(b.id);
      if(op === 'write')   return await A.compWrite(b.id, b.rel, b.text);
      if(op === 'restore') return await A.compRestore(b.id, b.rel);
      if(op === 'factory') return await A.compFactory(b.id);
      /* 抹掉一整格（「完全删除」那一步）：只按包名动手，主进程那把尺不接子路径 */
      if(op === 'delete')  return typeof A.compDelete === 'function' ? await A.compDelete(b.id)
        : { ok:false, msg:'主进程没有删掉一整格这条通道' };
      return { ok:false, msg:'主进程没有这一条通道：' + op };
    }
    /* 本地开发那台 http 服务器（fd-serve）：只有 http 这一种开法有这条通道 */
    if(!/^https?:$/.test(location.protocol)) return { ok:false, msg:'这一格没有可读写的通道' };
    try{
      const r = await fetch('/_comp', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(b) });
      return await r.json();
    }catch(e){ return { ok:false, msg:'本地服务器没接上：' + ((e && e.message) || e) }; }
  },
  /* 这一格写不写得动：Flow-Desk 程序（主进程那把尺）和本地开发那台服务器，有任一条通道就算写得动 */
  can(){
    const A = window.FD_APP;
    if(A && typeof A.compWrite === 'function') return true;
    return /^https?:$/.test(location.protocol);
  },
  /* 说明书点名的入口那份：一个包只有一个入口，改代码默认开它 */
  entry(id){
    const m = PACK_META[String(id)] || {};
    return (m.entry && m.entry[0]) || 'main.js';
  },
  async read(id, rel){ return await this.call('read', { id, rel }); },
  async write(id, rel, text){ return await this.call('write', { id, rel, text }); },
  async restore(id, rel){ return await this.call('restore', { id, rel }); },
  /* 这一家有几份出厂原文（决定「恢复出厂」这个按钮摆不摆、点了有没有用） */
  async factory(id){ const r = await this.call('factory', { id }); return (r && r.files) || []; },
  /* 这一格里有哪几份能改的文本文件：读不到清单就退回「入口 + 说明书 + 配方」那三份 */
  async files(id){
    const r = await this.call('list', { id });
    if(r && r.ok && Array.isArray(r.files) && r.files.length) return r.files;
    const guess = [this.entry(id), 'manifest.json', 'recipe.json'];
    const out = [];
    for(const rel of guess){
      if(out.includes(rel)) continue;
      const f = await this.read(id, rel);
      if(f && f.ok) out.push(rel);
    }
    return out.length ? out : [this.entry(id)];
  },

  /* ---------- 存：落盘 + 立刻重载这一家 ---------- */
  async save(id, rel, text){
    const w = await this.write(id, rel, text);
    if(!w || w.ok === false) return { ok:false, msg:(w && w.msg) || '主进程没回话' };
    /* 改的是入口那份才真的换代码；改说明书、配方 json 那些要下一轮加载才认（跟加载器说清楚） */
    if(String(rel) !== this.entry(id))
      return { ok:true, reloaded:false, msg:'已存好 · 这一份不是入口，下次开机加载时才认，刷新这一页就用新的' };
    const r = await PackLoader.reload(id);
    return r && r.ok ? { ok:true, reloaded:true, msg:'已存好 · 「' + Packs.name(id) + '」已经按这一份重载' }
      : { ok:true, reloaded:false, msg:'已存好 · 这一份代码加载不起来：' + ((r && r.msg) || '') + '（改坏了就再存一次或恢复出厂）' };
  },
  /* ---------- 恢复出厂：从自带那一层把这一份原样拷回来，紧接着重载 ---------- */
  async restoreAndReload(id, rel){
    const r = await this.restore(id, rel);
    if(!r || r.ok === false) return { ok:false, msg:(r && r.msg) || '主进程没回话' };
    if(String(rel) !== this.entry(id))
      return { ok:true, reloaded:false, msg:'已从程序自带的那一层拷回这一份 · 下次开机加载时认它' };
    const k = await PackLoader.reload(id);
    return { ok:true, reloaded:!!(k && k.ok),
      msg:k && k.ok ? '已拷回出厂那一版 · 「' + Packs.name(id) + '」跟着重载好了'
        : '已拷回出厂那一版 · 这一版加载不起来：' + ((k && k.msg) || '') };
  },

  /* ---------- 整格恢复出厂：点名那几份从自带那一层拷回来，然后重载这一家 ----------
     配方向导走的是这一条（main.js 里就是那张配方，recipe.json 是它的明文），
     没有出厂原文的那一份跳过不动 —— 用户自己加的第三方文件不该被这次操作抹掉。 */
  async restorePack(id, rels){
    const fact = await this.factory(id);
    const back = [], none = [];
    for(const rel of (rels || [])){
      if(!fact.includes(String(rel))){ none.push(rel); continue; }
      const r = await this.restore(id, rel);
      if(r && r.ok) back.push(rel); else none.push(rel + '（' + ((r && r.msg) || '没拷回来') + '）');
    }
    if(!back.length) return { ok:false, msg:'自带那一层没有这一家的出厂原文' };
    const k = await PackLoader.reload(id, { new:true });
    return { ok:true, restored:back, skipped:none,
      msg:'已拷回 ' + back.join('、') + (k && k.ok ? ' · 这一家跟着重载好了' : ' · 可这一版加载不起来：' + ((k && k.msg) || '')) +
        (none.length ? ' · 没动的那几份：' + none.join('、') : '') };
  },

  /* ---------- 改到了 src\ 共用底子那几份：那部分拼在页面里，得让主进程重新生成页面才换 ----------
     插件自己那一格不在这儿 —— 那些文件运行时直接 import，存了就是新的，不用这一趟。
     装卸、改代码都不叫它；只有真改了 src\ 才叫。 */
  async rebuildPages(note){
    const A = window.FD_APP;
    if(!A || typeof A.rebuild !== 'function'){ toast('本地没有重新生成页面的通道'); return { ok:false }; }
    toast(note || '立即重新生成页面…');
    const r = (await A.rebuild()) || {};
    toast(r.ok ? '已生成，刷新获取' + (r.msg || '') : '重生成失败' + (r.msg || ''));
    return r;
  },

  /* ---------- 对话框：左边挑文件，右边一整栏编辑器 ---------- */
  async open(id, rel){
    id = String(id);
    const nm = Packs.name(id);
    const files = await this.files(id);
    let cur = rel ? String(rel) : (files.includes(this.entry(id)) ? this.entry(id) : files[0]);
    let api = null;
    let base = '';
    /* 编辑器里的手上改动和文件里那一份不一样就算脏：恢复出厂之前问一句，别默默吃掉用户刚写的东西 */
    const edited = () => !!api && String(api.get()) !== base;
    const fact = await this.factory(id);
    const ed = h('div', { style:'width:100%' });
    const hint = h('div', { class:'wnw-hint' }, '');
    const pick = h('select', { class:'wnw-input', title:'这一段内容现在用的就是这一份',
      onchange:() => { load(pick.value); } },
      files.map(f => h('option', { value:f }, f + (f === this.entry(id) ? '（这一家跑的代码）' : ''))));
    const btn = (txt, fn, tip, cls) => h('button', { class:'wnw-btn ' + (cls || 'mini'), title:tip || '', onclick:fn }, txt);
    /* 出厂那一格有同名文件才给这个按钮（导入进来的第三方包没有出厂原文，点了也是空话） */
    const hasFact = f => fact.includes(String(f));
    async function load(f){
      cur = String(f);
      const r = await PackCode.read(id, cur);
      if(!r || r.ok === false){ toast('这一份现在读不到：' + ((r && r.msg) || '')); return; }
      if(api){ api.set(r.text || ''); base = String(r.text || ''); }
      pick.value = cur;
      const fb = hasFact(cur) ? ' · 程序自带那一层有这一份的出厂原文，可以「恢复出厂」'
        : ' · 程序自带的那一层没有这一份，改坏了没法恢复出厂';
      hint.textContent = '上面挑的这一段就是「' + nm + '」现在用的这一份'
        + (cur === PackCode.entry(id) ? ' · 存了立刻按这一份重载' : ' · 这一份不是入口，下次加载时才认') + fb;
      restBtn.disabled = !hasFact(cur);
    }
    const box = h('div', { class:'wnw-col', style:'gap:8px;min-width:min(760px,92vw)' }, [
      h('div', { class:'wnw-row', style:'gap:8px;align-items:center' }, [
        h('span', { class:'wnw-hint' }, '改哪一份'), pick,
        h('span', { style:'flex:1' }),
        h('span', { class:'wnw-hint' }, '查找 Ctrl+F，替换 Ctrl+Shift+F，行号左边小箭头折叠')]),
      hint, ed
    ]);
    const restBtn = btn('恢复出厂', async () => {
      if(edited() && !confirm('当前编辑内容暂未保存，恢复出厂会丢失编辑内容，继续恢复？')) return;
      const r = await PackCode.restoreAndReload(id, cur);
      toast(r.ok ? r.msg : '未复制' + (r.msg || ''));
      if(r.ok) load(cur);
    }, hasFact(cur) ? '从代码中复制原文' : '代码中没有出厂原文');
    restBtn.disabled = !hasFact(cur);
    H().dlg.open('改代码 · 「' + nm + '」', box, [
      btn('保存', async () => {
        const r = await PackCode.save(id, cur, api ? api.get() : '');
        if(!r.ok){ toast('未写入' + r.msg); return; }
        base = String(api ? api.get() : '');
        toast(r.msg);
        /* #298：这份代码里要是用到了库里没有的功能模块 / 判断逻辑，就地摆一个按钮问一句
           （不直接弹窗：那会把这一栏编辑器顶掉，人可能还想接着改） */
        const found = typeof genScanCode === 'function' ? genScanCode(api ? api.get() : '', id, cur) : [];
        if(found.length) hint.appendChild(h('button', { class:'wnw-btn mini w-txt', style:'margin-left:10px',
          onclick:() => genPendingAsk(found).then(() => load(cur)) },
          '库里没有：' + found.map(x => x.name).join('、') + ' · 提取进清单'));
      }, '保存，并立刻重载', 'primary'),
      btn('重新读一遍', () => load(cur), '放弃未保存的编辑内容，读取自带内容'),
      btn('复制', async () => toast(await copyText(api ? api.get() : '') ? '已复制到剪贴板' : '复制失败，请手动选中'), '复制当前内容'),
      restBtn,
      btn('关闭', () => H().dlg.close())
    ], { wide:true, vwide:true });
    /* 编辑器要等这一层真挂到页面上再开：对话框是先建节点、后 open 的 */
    api = ICode.attach(ed, { value:'', file:cur, height:'min(58vh,540px)' });
    await load(cur);
  }
};

/* 一个「改代码」：配方开组件定制向导，其余开上面那一份 —— 编辑的都是这一家自己那一格里的文件。
   两个宿主的按钮长相不一样，样式名由宿主给；宿主要在打开前插自己的钩子（FD 卡要接 onSaved）就传 before。
   这一家这一轮没加载（说明书都不在）时返回 null，宿主那一行不用判。 */
/* 戊：这一家不给开「改代码」的口子。名单写在这一处，两个宿主（Flow-Desk 卡标题条那枚铅笔、
   为写停靠标题条那个「改代码」）一起收 —— 别家照旧开得到。
   为什么单收它：音乐遥控器那一屏不是静态样式，它连着后台那座桥和监听插件，改坏了是整条监听断掉，
   不是「这一格难看」；而且它自己带一份编译好的插件，代码和插件之间没有校验，改哪一行都可能对不上。 */
const CODE_ENTRY_OFF = ['music-remote'];
function codeEntry(id, cls, label, tip, before){
  id = String(id);
  if(CODE_ENTRY_OFF.indexOf(id) >= 0) return null;
  const isRecipe = (typeof Gen !== 'undefined' && Gen.get(id)) && typeof GenWizard !== 'undefined';
  if(!PACK_META[id] && !isRecipe) return null;
  /* 第三个参数给图标名字（FD 卡标题条那一排只摆图）就画图；给文字（WNW 停靠条写「改代码」）照旧出字 */
  const ic = (ICO_D[icoName(label)] || Ico.has(icoName(label))) ? icoMarkup(label) : '';
  const props = { class:cls, title:(tip || '改「' + Packs.name(id) + '」这一家自己的代码'),
    onclick:() => {
      if(before) before();
      if(isRecipe) GenWizard.open(id); else PackCode.open(id);
    } };
  if(ic) props.html = ic;
  return h('button', props, ic ? null : label);
}
