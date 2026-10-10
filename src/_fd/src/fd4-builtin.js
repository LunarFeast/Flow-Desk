/* ============================================================
   FD 外壳 v0.7：启动卡的公共画法和设置面板
   内置组件已经一个都不在这儿了 —— 便签、你的句子、两张启动卡、日程都搬进
   data\plugins\<id>\ 当包了，卸掉哪个，产物里就没那一段，设置里也没那一档。
   ============================================================ */

/* ---------- 启动卡：整张卡就是一块卡面，中间一行字，点卡打开 ----------
   启动卡是两个可卸的包（plugins\why-not-write\、plugins\singbit-input-practice\）。
   卡上那行字和封面顶上的标题都用说明书里那个中文名，包里不再抄一份。
   怎么把一张卡画出来是公共件，留在外壳这里，两个包共用，不各写一份。
   以前是一个铺满卡面的按钮，把卡片本身那块面盖住了；不用按钮也就不需要
   data-nodrag，长按 180ms 照样能起拖，短按就是打开。
   字只许一行，卡片窄就把字号往下让，和别的内容一样 9px 封顶。
   摆法两家共用，「点开之后干什么」由包里递进来：为写和声笔输入法练习那两个递的都是内核
   （两份代码都在这一张页里，Flow-Desk 那份装配单把它们各收成一层闭包；练习那一段见 _build/rp-kernel.mjs）。
   以前这里写死 Cover.openUrl，于是外壳替两家决定了「入口只能开一个网页」—— 搬进宿主的
   那一家没法用自己的开法，只能被按回 iframe；那一条通道整个撤了，外壳不再知道有「地址」这回事。 */
function mountLauncher(body, opts, ctx){
  const title = opts.title || (ctx && ctx.pack && ctx.pack.name) || '';
  const face = h('div', { style:'flex:1;display:flex;align-items:center;justify-content:center;cursor:pointer;' +
    'font-size:1.02em;font-weight:600;color:var(--text);padding:0 8px;text-align:center;white-space:nowrap' });
  const span = h('span', {}, '打开' + title + '，' + opts.action);
  face.appendChild(span);
  face.onclick = () => opts.open();
  body.appendChild(face);
  let busy = false;
  const fit = () => {
    if(busy) return;
    busy = true;
    face.style.fontSize = '1.02em';
    /* 居中的flex容器量不出往两边溢出的那截，只能问里面那个 span 本身多宽 */
    const need = span.offsetWidth;
    /* 挂载这一刻卡片还没进网格，量不到宽度，就按格子数自己算一个 */
    const guess = ctx && ctx.item ? Math.round(ctx.item.w * Shell.cellW - Shell.gap) : 0;
    const avail = Math.max(0, (face.clientWidth || guess) - 16);
    if(avail > 0 && need > avail){
      face.style.fontSize = Math.max(FIT_MIN_PX, parseFloat(getComputedStyle(face).fontSize) * avail / need) + 'px';
    }
    busy = false;
  };
  const ro = new ResizeObserver(() => fit());
  /* 盯 face 自己的宽度：卡片改大小它就变，量出来的一定是这一格的实际尺寸 */
  ro.observe(face);
  fit();
  return { unmount(){ ro.disconnect(); } };
}

/* ---------- 设置面板 ---------- */
/* 第 22 条：切档闪的根子有两处 —— 一是每切一次把左边那一列标签也重建了一遍（整屏白一下），
   二是「程序」「数据」这两档的内容是异步问出来的：先画一版猜的，答案回来再改一版，看着就是抖一下。
   改法：标签那一列开面板时建一次，切档只换右栏；异步那两档把上回问到的值先摆在原地（缓存一份），
   没有缓存的那一回就等内容到齐再画，不再画一版猜的。 */
const SetCache = { close:null, data:'', about:'' };
/* 左边那一列有哪几档：全是外壳自己的档。
   插件的设置不在这里 —— 每一家自己的设置摆在自己卡片标题条那一个齿轮上
   （说明书点了 settings 才渲染这个按钮，Why Not Write 的停靠面板头上同名一个，两边入口对等）。
   配色不再单开一档 —— 一套颜色本来就是「外观」的第一件事（paletteRows）。 */
SetupTabs.add('外观', tabLook, { order:20 });
/* 「程序」这一档管的是窗口怎么关，只有 Flow-Desk.exe 里说了算的那一层在的时候才摆 */
SetupTabs.add('程序', tabProgram, { order:50, when:() => !!(window.FD_APP && window.FD_APP.closeChoice) });
SetupTabs.add('快捷键', tabKeys, { order:60 });
SetupTabs.add('数据', tabData, { order:80 });
/* 「这一档里有改动还没存」只有外观那一档知道，可要问的那一句挂在设置面板的关掉路径上（完成 / 右上角关闭 / Esc）：
   外观那一档建自己的时候把判定挂到这里，面板那头来问一句再走（走查 AA-6：删当前不问、关面板也不问）。
   没挂就一律放行 —— 别的档改了就直接写盘，没有「没存」这一说。 */
const Unsaved = { ask:null };
function openSettings(){
  /* 左边一列竖标签，右边这一档的内容；窗口定死 1080×680（Modal 的 set 档），
     内容长短不一样也不抖，长了就在右栏里滚 */
  /* 这一列是真标签（走查 A-3）：外壳 role="tablist"、每一项 role="tab" + aria-selected，
     右栏是 role="tabpanel"，并且指着当前选中的那一个标签 —— 读屏器才说得出「这是第几档、现在在哪档」。
     键盘按整列只占 Tab 里的一站，走进这一列之后用上下键在档之间走（无障碍走查 C-5）：
     选中的那个 tabindex=0、其余 -1，这是标签列的标准走法，Tab 键不会在这一列里一个一个地过。 */
  const paneId = 'fd-set-pane';
  const tabbar = h('div', { class:'fd-set-tabs', role:'tablist', 'aria-orientation':'vertical' });
  const pane = h('div', { class:'fd-set-body', role:'tabpanel', id:paneId });
  const tabs = SetupTabs.list();
  const byName = new Map(tabs.map(t => [t.name, t]));
  let cur = tabs.length ? tabs[0].name : '';
  /* 界面文字清单按「设置 · 哪一档」分着认（批⑤-6）：页名钉在这一档的盒子上，
     清单里出处写着这一档的行就只在这一档里生效；盒子随面板一起没，不用另外收摊 */
  const stamp = () => { pane.setAttribute('data-txp', cur ? '设置 · ' + cur : ''); pane.setAttribute('aria-labelledby', 'fd-tab-' + cur); };
  const btns = {};
  const select = (name, moveFocus) => {
    if(cur !== name){
      cur = name;
      for(const x in btns){
        const on = x === cur;
        btns[x].classList.toggle('on', on);
        btns[x].setAttribute('aria-selected', String(on));
        btns[x].setAttribute('tabindex', on ? '0' : '-1');
      }
      stamp();
      pane.replaceChildren(byName.get(cur).build());
      pane.scrollTop = 0;
    }
    if(moveFocus) btns[name].focus();
  };
  tabs.forEach((t, i) => btns[t.name] = h('button', { class:t.name === cur ? 'on' : '', id:'fd-tab-' + t.name,
    role:'tab', tabindex:t.name === cur ? '0' : '-1', 'aria-selected':String(t.name === cur), 'aria-controls':paneId, onclick:() => select(t.name) }, t.name));
  tabbar.addEventListener('keydown', e => {
    const i = tabs.findIndex(t => t.name === cur);
    if(i < 0) return;
    const k = e.key;
    let n = k === 'Home' ? 0 : k === 'End' ? tabs.length - 1
      : k === 'ArrowDown' || k === 'ArrowRight' ? (i + 1) % tabs.length
      : k === 'ArrowUp' || k === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : -1;
    if(n < 0) return;
    e.preventDefault();
    select(tabs[n].name, true);
  });
  /* 整列只在建面板这一次摆出来：切档时那一列原样不动，抖的源头就少一处 */
  for(const k in btns) tabbar.appendChild(btns[k]);
  if(cur) { stamp(); pane.appendChild(byName.get(cur).build()); }
  Modal.open('设置', h('div', { class:'fd-set' }, [tabbar, pane]),
    [h('button', { class:'fd-btn primary', onclick:() => { Theme.refresh(); Shell.tickClock(); toast('已应用'); Modal.requestClose(); } }, '完成')],
    null, { set:true, guard:next => Unsaved.ask ? Unsaved.ask(next) : next() });
}
/* 一行「左边标签 + 右边控件」的关联：从前左边那句只是个普通 div，跟右边控件没有任何程序上的联系 ——
   读屏器走到滑杆上只能念出「滑块 14」，不知道这 14 是在调什么（WCAG 3.3.2 / 1.3.1，走查 A-2、A-5）。
   现在给标签一个 id，再把这个 id 挂到这一行里能聚焦的控件上。分段选择是例外：
   名字挂在那一组的外壳上（role="group"），组里四个按钮各认自己那几个字，念四遍标签反而更吵。 */
let rowSeq = 0;
function row(lbl, ctrl){
  const id = 'fd-lbl-' + (++rowSeq);
  const box = h('div', {}, ctrl);
  const seg = box.querySelector('.fd-seg');
  if(seg) seg.setAttribute('aria-labelledby', id);
  else box.querySelectorAll('input,select,textarea,button,[tabindex]').forEach(el => el.setAttribute('aria-labelledby', id));
  return h('div', { class:'fd-form' }, [h('div', { class:'lbl', id }, lbl), box]);
}
/* 分段选择：选中与否从前只写在 class 上，读屏器听不出来（念出来是四个同名按钮，走查 A-1）。
   aria-pressed 是给读屏器的那一条，template.html 里那句加粗是给眼睛的那一条（1.4.1 不许只靠颜色）。 */
function segCtrl(opts, get, set){
  const s = h('div', { class:'fd-seg', role:'group' });
  const draw = () => { s.innerHTML = ''; opts.forEach(o => { const on = get() === o.v;
    s.appendChild(h('button', { class:on ? 'on':'', 'aria-pressed':String(on), onclick:() => { set(o.v); draw(); } }, o.t)); }); };
  draw(); return s;
}
/* ---------- 一整套方案在界面上就摆两个：名字 + 一排色点 ----------
   色点取的就是判重那四个主角色（底 / 卡 / 文 / 强），自定义的按色号顺序去重后取前六个。 */
function paletteDots(e){
  const box = h('span', { class:'fd-sel-dots' });
  let hs = [];
  if(e && e.mode === 'custom'){ const all = Palette.hexesOf(e); hs = all.filter((x, i) => all.indexOf(x) === i).slice(0, 6); }
  else if(e){ const p = presetOf(e.mode); hs = [p['--page-bg'], p['--card-bg'], p['--text'], p['--accent']]; }
  for(const c of hs) box.appendChild(h('i', { class:'fd-sel-dot', style:'background:' + c, title:c }));
  return box;
}
/* ---------- 自绘下拉的菜单：开合、键盘、焦点归还，全站只挂一次 ----------
   关的永远是此刻开着的那一只，不是某一只下拉自己的事。每建一只就往 document 上挂一个监听，
   这一屏重画十几回就攒了十几个监听，每个都去翻一遍菜单 —— 全在干同一件事。
   无障碍走查第 C-1 条：菜单里的选项是自绘的（原生 select 摆不出色点），前阵子它们只是一个个 DIV + onclick，
   回车能把菜单打开，之后选项一个都 Tab 不到、方向键也不动 —— 挑方案、挑配色、挑纹理这一整段键盘走不通。
   现在选项是真 <button role=option>（自带 Tab 与回车），这里再补上方向键 / Home / End，以及 Esc 之后把焦点还给触发它那个按钮。 */
function selTrigger(menu){ return menu && menu.parentElement ? menu.parentElement.querySelector('.fd-sel-btn') : null; }
function selMenuClose(){
  for(const m of document.querySelectorAll('.fd-sel-menu.open')){
    m.classList.remove('open');
    const t = selTrigger(m);
    if(t){
      t.setAttribute('aria-expanded', 'false');
      /* 焦点正在这只菜单里（键盘用户按的 Esc）：不还回去它就掉到页面底下，得从头 Tab 一遍 */
      if(m.contains(document.activeElement)) t.focus();
    }
  }
}
document.addEventListener('click', selMenuClose);
addEventListener('keydown', e => { if(e.key === 'Escape') selMenuClose(); });
function selMenuOpen(menu){
  selMenuClose();
  menu.classList.add('open');
  const t = selTrigger(menu);
  if(t) t.setAttribute('aria-expanded', 'true');
  const opts = [...menu.querySelectorAll('.fd-sel-item')];
  const at = opts.find(x => x.getAttribute('aria-selected') === 'true') || opts[0];
  if(at) at.focus(); else if(t) t.focus();
}
/* 打开一只的时候先把别只收掉，再决定自己开不开 —— 连着点两只下拉不用点两回 */
function selMenuToggle(menu){
  if(menu.classList.contains('open')) selMenuClose(); else selMenuOpen(menu);
}
/* 方向键在选项之间走，走到头不绕回：这一列最长有五十多项，绕一圈反而看不清自己走到哪了 */
function selMenuKeys(menu, ev){
  const opts = [...menu.querySelectorAll('.fd-sel-item')];
  if(!opts.length) return;
  const at = opts.indexOf(document.activeElement);
  let n;
  if(ev.key === 'ArrowDown') n = Math.min(at + 1, opts.length - 1);
  else if(ev.key === 'ArrowUp') n = at < 0 ? 0 : Math.max(at - 1, 0);
  else if(ev.key === 'Home') n = 0;
  else if(ev.key === 'End') n = opts.length - 1;
  else return;
  ev.preventDefault();
  opts[n].focus();
  opts[n].scrollIntoView({ block:'nearest' });
}
/* ---------- 色卡这一段（#291 · #292 拆过）----------
   从前这一段顶着自己的下拉，和上面「方案」那一档的配色选择器是两个入口挑同一件事；
   #292 把「挑哪套配色」收进方案的详细设置里（那一行改的是方案 配色 那一栏），
   这一段就只剩色卡成套的那一份本身：新建、删除、改这一套的色号。从图取色和色卡照片认到的色
   从外29 起只进色卡（一个一个的那一份），不再在这一头各自登记成一套。
   改完直接写进 数据\palettes.yaml —— 不像外观方案那样要问「覆盖还是另存」。 */
/* ---------- 颜色的两块：仓库那一头 + 某一方案那一头（作者 2026-10-09 定的三层）----------
   「方案资源这里是色卡，下拉展示所有颜色，选中的进入方案；然后方案编辑就会展示用户给这个方案选择的颜色」
   —— 颜色这一摊天生分两处，这一个函数把两处一起交出去：
     · 挂进 box（送「方案资源」那一页 = 总仓库）：一套一套的配色怎么新建 / 删掉、从图取色、一个一个攒着的色整个摊开；
     · return 出去的「编辑」（送「方案编辑」那一页顶上）：这一套方案正在用的那几个颜色（名字、基调、色号、预览）。
   useFor(色号数组) 由 lookPage 传进来：色卡上挑中的那几颗「进入方案」，不写回色卡 —— 色卡本来就是仓库，
   从仓库挑中再放回仓库那一句是循环（作者 2026-10-09 点的就是这一处）。 */
/* 删掉一套配色（外34 图2：「配色要允许删除」）。从前内置那两条免删、删完下次开机还会回来，
   两处一起改了：内置不再拦（Palette.remove 那一道闸撤了），补预设那一步改成只在色卡空着的时候跑。
   指着这一套配色的外观方案由 Palette.remove 一起改口，不留一条挑着空名字的假选项（图13 那句「外观方案 1 套」的根）。 */
async function 删配色(e, 完事){
  if(!e){ toast('这一套配色没认出来 · 先挑一套再删'); return; }
  if(Palette.items.length <= 1){ toast('就剩这一套配色了 · 删掉就没有可显示的颜色了'); return; }
  if(!await fdAsk('删掉「' + e.name + '」这一套配色？这几个色号就没有了，指着它的方案会改挑同一明暗池里最近的一套。', '删除')) return;
  if(Palette.remove(e.id)){ if(完事) 完事(); }
  else toast('这一套删不掉 · 库里认不出它');
}
function paletteLib(box, refresh, useFor, 挑着){
  /* 这一截既摆在「方案资源」那一页（改的是屏幕上正用的那一套），也整块挂到「方案编辑」顶上
     （改的是这一套方案挑中的那一套）。同一份 DOM 挂两处，看哪一套由 挑着 这一位说了算 ——
     外34 图3 报的就是这里：上面那只下拉挑的是方案的配色，下面却在改另一套，一屏看着像两套。 */
  const 现编辑 = () => (挑着 ? 挑着() : null) || Palette.cur;
  const redrawAll = () => { Palette.save(); Theme.apply(); Shell.render(); if(refresh) refresh(); drawEditor(); };
  box.appendChild(h('div', { class:'fd-row' }, [
    h('button', { class:'fd-btn mini w-txt', title:'自己填 3~10 个色号建一套', html:icoMarkup('plus') + '新建一套', onclick:() => newPaletteDlg(() => openSettings()) }),
    h('button', { class:'fd-btn mini', title:'把上面那一套配色从配色那一档里删掉', onclick:() => 删配色(现编辑(), redrawAll) }, '删除这一套'),
    h('span', { class:'fd-hint' }, '一套配色就是 3~10 个色号；哪一套进哪一套方案、这一套里的色号怎么改，在「方案编辑」那一页顶上')]));

  /* ---- 这一套方案正在用的那几个颜色：交出去，摆到「方案编辑」那一页顶上（紧跟「配色」那一行）---- */
  const 编辑 = h('div', { style:'display:grid;gap:14px' });
  编辑.appendChild(h('div', { class:'fd-row' }, [h('b', {}, '这一套方案选中的颜色'),
    h('span', { class:'fd-hint' }, '上面那一行挑的是哪一套，这里就是它那几个色；从「方案资源」的色卡上挑中一串进方案，来的也是这里')]));
  /* editor 里一行一个 row()，各自是块级 .fd-form：不排成栅格就没有行间距，全贴在一起。
     顶上那道是分隔线，走外观层的 --hair：从前写 --bw + --card-border，质感与纯平两档
     把外框收成 0、边框色收成透明，这道线跟着一起没了（同一处还有下面那张预览卡的外框）。 */
  const editor = h('div', { style:'display:grid;gap:14px;border-top:var(--hair);padding-top:12px' });
  /* 预览卡挂 data-look 并进表面名单：底色、纹理、影子都交给外观层现算。
     原来内联写的 border / background 必须一并撤掉 —— 内联比任何选择器都重，
     留着就永远压着 --card-face，外观层算出来的那张卡面也覆不上来。
     外34 图7：这一框右边没有内容，却跟着栅格那一列摊到最右、右边界被面板裁掉一截 —— 给它一个自己的上限。 */
  const preview = h('div', { 'data-look':'', style:'border-radius:var(--r-card,5px);padding:10px;max-width:min(620px,100%);min-width:0' });
  const redrawPreview = () => {
    Theme.apply();
    const t = Theme.tokens().tokens, r = Theme.tokens().roles, notes = Theme.tokens().notes;
    preview.innerHTML = '';
    preview.appendChild(h('div', { style:'display:flex;gap:6px;margin-bottom:8px' },
      ['--page-bg','--card-bg','--accent','--accent2','--text','--text-light','--ok','--bad'].map(k =>
        h('span', { class:'fd-swatch', title:k + ' ' + t[k], style:'background:' + t[k] }))));
    preview.appendChild(h('div', { style:'font-weight:700' }, '正文示例 Flow-Desk ' + t['--text']));
    preview.appendChild(h('div', { class:'fd-hint' }, '次要文字与提示'));
    const info = [];
    if(r){
      info.push('自动归属 → 底 ' + r.bg + ' / 卡面 ' + (r.card||'—') + ' / 正文 ' + (r.text||'—') + ' / 主强调 ' + r.accent + (r.accent2 ? ' / 次强调 ' + r.accent2 : ''));
      const c = CV.contrast(t['--text'], t['--card-bg']).toFixed(2);
      info.push('对比度自检：正文/卡面 ' + c + ':1' + (c >= 4.5 ? ' ✓ 达 AA' : ' ✗ 不足 4.5，已自动提亮'));
    }
    notes.forEach(n => info.push('CMYK ' + n));
    if(info.length) preview.appendChild(h('div', { class:'fd-hint', style:'margin-top:8px;white-space:pre-wrap' }, info.join('\n')));
  };
  const drawEditor = () => {
    editor.innerHTML = '';
    const e = 现编辑();
    if(!e) return;
    /* 这一格改的是「一套配色」的名字（palettes.yaml 里那一段的段名），不是方案名 ——
       方案自己的名字在「方案设定」那一页。这一截现在摆在「方案编辑」顶上，两个名字并排，
       再写「方案名」就成了同屏两个入口改两个不同的东西（作者 2026-10-09 把这三层分开之后才露出来）。 */
    editor.appendChild(row('配色名', (() => { const i = h('input', { class:'fd-input', value:e.name, style:'max-width:280px' });
      /* 段名就是这条配色在库里的身份：改了名，外观方案里指着旧名字的那几条一起改口 */
      i.addEventListener('change', () => { const old = e.name; e.name = i.value.trim() || old; if(old !== e.name) PalLib.renamed(old, e.name); redrawAll(); }); return i; })()));
    editor.appendChild(row('整体基调', segCtrl([{v:'light',t:'明亮'},{v:'dark',t:'黑暗'},{v:'custom',t:'自定义色号'}],
      () => e.mode, v => { e.mode = v; redrawAll(); })));
    if(e.mode === 'custom'){
      /* 一行一个色号、输入框吃满整幅 —— 五个色号就把这一页拉成五长条（外34 图6：「这么长明显多余，短一点、并列」）。
         现在按宽度自动并列，一格至少 250 像素，窗口宽就多摆几列，窄了自己掉成一列。 */
      const colorList = h('div', { style:'display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px 16px;align-items:start' });
      const drawColors = () => {
        colorList.innerHTML = '';
        (e.colors.length ? e.colors : [{ raw:'', format:'auto' }]).forEach((c, i) => {
          if(!e.colors[i]) e.colors[i] = { raw:'', format:'auto' };
          const item = e.colors[i];
          const inp = h('input', { class:'fd-input', placeholder:i === 0 ? '例如 #3b6cb5 或 59,108,181 或 78,52,0,0' : '第 ' + (i+1) + ' 个色号', value:item.raw,
            style:'min-width:0;flex:1 1 8em',
            oninput:ev => { item.raw = ev.target.value; paint(); redrawPreview(); } });
          inp.addEventListener('change', () => { redrawAll(); });
          const fmt = h('select', { class:'fd-input', style:'width:auto', onchange:ev => { item.format = ev.target.value; redrawAll(); } },
            [h('option',{value:'auto'},'自动'), h('option',{value:'rgb'},'RGB'), h('option',{value:'cmyk'},'CMYK')]);
          fmt.value = item.format || 'auto';
          /* 这一块从前是个 <span class="fd-swatch">，只把上面输入框认出来的结果画出来给人看，
             全站没给它挂过点击（外13-N 顺手修的那处：「设置这里怎么不能点击选择颜色了？」）。
             现在它是真控件：点一下就定这一格的色，认不出来那一格照旧铺条纹，但也点得动。 */
          const sw = colorChip('', (v, final) => { item.raw = v; paint(); redrawPreview(); if(final) redrawAll(); });
          /* 色块跟着输入实时亮起来：不然边填边看不到这一格认没认出来 */
          const paint = () => {
            const p = parseColor(item.raw, item.format || 'auto');
            const res = p ? resolveColor(p, e.std) : null;
            sw.sync(res ? res.hex : '', res ? (res.source + ' → ' + res.hex + ' · 点这块重新定色') : '这一格还没认出色号 · 点这块定一个');
          };
          paint();
          colorList.appendChild(h('div', { class:'fd-row' }, [sw, inp, fmt,
            h('button', { class:'fd-tool', title:'删除', html:icoMarkup('close'), onclick:async () => {
              /* 这一笔当场就写进 palettes.yaml，没有「先不存」那一步可退 */
              if(!await fdAsk('删掉「' + e.name + '」的第 ' + (i + 1) + ' 个色号（' + (item.raw || '这一格还空着') + '）？底下那几格会一起往前挪一位。', '删除')) return;
              e.colors.splice(i, 1); redrawAll();
            } })]));
        });
        if(e.colors.length < 10) colorList.appendChild(h('button', { class:'fd-btn mini', style:'justify-self:start',
          onclick:() => { e.colors.push({ raw:'', format:'auto' }); redrawAll(); } }, '加一个色号'));
        redrawPreview();
      };
      drawColors();
      editor.appendChild(h('div', { style:'display:grid;gap:8px' }, [
        row('CMYK 换算标准', segCtrl([{v:'gracol',t:'GRACoL'},{v:'swop',t:'SWOP'},{v:'japan',t:'Japan Color'}],
          () => e.std, v => { e.std = v; redrawAll(); })),
        row('色号', colorList)]));
    }
    editor.appendChild(row('', preview));
    /* 明亮 / 黑暗 方案没有色号那一栏，预览也得照样画出来，不然只剩一个空壳条 */
    redrawPreview();
  };
  编辑.appendChild(editor);
  /* 取色和铺壁纸是两回事：这一行只把图里的主要颜色取进色卡，壁纸归下面「背景」那一行管。
     外29 乙组第二条：从图里取到的色不再各自成为一套配色方案 —— 一处一套的形状就留在色卡里，
     一段一个色，想要一套就去 配色 那一头自己建。 */
  box.appendChild(row('从图取色', (() => {
    const normal = h('button', { class:'fd-btn mini',
      title:'选一张图，把它的主要颜色取出来进色卡（要铺壁纸用下面「背景」里的图片）',
      onclick:async () => {
        try{
          const r = await pickFile({ 'image/*':['.png','.jpg','.jpeg','.webp','.gif','.bmp'] }, 'fd-image-theme');
          if(!r) return;
          const hexes = await ImageTheme.colors(r.file, 8);
          if(!hexes.length){ toast('这张图里没有可取的颜色', true); return; }
          const 进色卡 = CardPool.addAll(hexes, 'image');
          redrawAll();
          toast('从图里取到 ' + hexes.length + ' 个色 · 进色卡 ' + 进色卡 + ' 个'
            + (进色卡 ? '' : '（这些色色卡里已经有了）') + 池尾());
        }catch(e){ if(e && e.name !== 'AbortError') toast('取不了：' + e.message); }
      }}, '普通图片');
    const card = h('button', { class:'fd-btn mini',
      title:'选一张或几张色卡照片：一张一张格一格认色块，认到的并成一张清单勾着进色卡；图里印的色号用系统自带的离线识别读回来',
      onclick:async () => { try{ await swatchDlg(redrawAll); }catch(e){ if(e && e.name !== 'AbortError') toast('认不了：' + e.message); } } }, '色卡图');
    /* 「打开色卡」那一枚 2026-10-09 撤了：色卡不再是一只框，它就摊在下面这一块，
       要挑要看不用先开一扇窗（作者：「打开的是色卡，挑中了再进色卡，这个逻辑你不觉得奇怪吗？」） */
    return h('div', { class:'fd-row' }, [normal, card]);
  })()));
  /* ---- 色卡：攒的一个一个的色，整个摊开在这一页上（这一页的小标题「色卡」管的就是这一块）---- */
  box.appendChild(h('div', { class:'fd-row', style:'border-top:var(--hair);padding-top:12px' }, [
    h('span', { class:'fd-hint' }, '上面那两行管的是一套一套的配色（3~10 个色号一套）；下面摊开的是一个一个攒着的色 —— 按色系分块，一组之内从深到浅排，点一颗挑上，挑中的进方案或者存成一组基础色')]));
  box.appendChild(cardPoolBox(() => { redrawAll(); }, useFor));
  drawEditor();
  return 编辑;
}
/* ---------- 色卡图：一次可以挑多张（外29 第 31 轮），认完并成一张清单，勾着的进色卡 ----------
   这种图一律不铺壁纸，也不再建配色方案。批量那一段不整批返工：某一张读不开、或没数出色块，
   就在小标题那一句里写明是哪些，其余那张认到的照样进得了池 —— 一次挑八张，不该因为第八张坏了前七张白认。 */
async function swatchDlg(redraw){
  const 挑 = await pickFiles({ 'image/*':['.png','.jpg','.jpeg','.webp','.bmp'] }, 'fd-swatch');
  if(!挑.length) return;
  const 张张 = [];                                    /* 一张一组：{ 名, 块, ocr, 一句 } */
  for(let i = 0; i < 挑.length; i++){
    const r = 挑[i];
    if(挑.length > 1) toast('正在认第 ' + (i + 1) + ' / ' + 挑.length + ' 张…');
    /* OCR 要绝对路径：Flow-Desk.exe 里选文件回来的句柄带着真路径，开发服务器里没有就只采样 */
    const p = (window.FD_APP && FD_APP.pathOf) ? (FD_APP.pathOf(r.handle) || '') : '';
    let got;
    try{ got = await SwatchTheme.read(r.file, p); }
    catch(e){ 张张.push({ 名:r.file.name, 块:[], 因:'读不开：' + ((e && e.message) || e) }); continue; }
    张张.push({ 名:r.file.name, 块:got.list, ocr:got.ocr,
      因:got.list.length ? '' : ('没数出色块' + (got.why ? '：' + got.why : '（色块之间得有能看出来的分隔）')) });
  }
  const 块 = 张张.reduce((a, g) => a.concat(g.块), []);
  if(!块.length) throw new Error(张张.length === 1 ? ('这张图' + 张张[0].因) :
    ('这 ' + 张张.length + ' 张里都没数出色块 —— ' + 张张.map(g => g.名 + '：' + g.因).join('、')));
  const list = h('div', { style:'display:grid;gap:6px' });
  for(const g of 张张){
    if(张张.length > 1) list.appendChild(h('div', { class:'fd-hint', style:'border-top:var(--hair);padding-top:8px' },
      g.名 + ' · ' + (g.块.length ? ('认出 ' + g.块.length + ' 个色块' + (g.ocr ? '（色号取自图上的字）' : '（只采样，没读图上的字）')) : g.因)));
    for(const b of g.块){
      const sw = h('span', { class:'fd-swatch', style:'width:34px;height:34px' });
      const inp = h('input', { class:'fd-input', value:b.raw, style:'max-width:150px' });
      const paint = () => {
        const c = parseColor(inp.value.trim(), 'auto');
        const res = c ? resolveColor(c, 'gracol') : null;
        sw.style.background = res ? res.hex : 'repeating-linear-gradient(45deg,#ccc 0 4px,#eee 4px 8px)';
        sw.title = res ? (res.source + ' → ' + res.hex) : '认不出这串色号';
      };
      inp.addEventListener('input', paint); paint();
      const ck = h('input', { type:'checkbox' }); ck.checked = true;
      b.ck = ck; b.inp = inp;
      list.appendChild(h('div', { class:'fd-row' }, [ck, sw, inp,
        h('span', { class:'fd-hint' }, b.code ? ('采样 ' + b.hex + ' · 图上 ' + b.txt)
          : ('采样 ' + b.hex + '（采样）' + (b.txt ? ' · 图上 ' + b.txt + ' 对不上' : '')))]));
    }
  }
  const 空 = 张张.filter(g => !g.块.length).length;
  Modal.open('色卡图 · ' + (张张.length > 1 ? (张张.length + ' 张 · ') : '') + '认出 ' + 块.length + ' 个色块'
      + (张张.some(g => g.ocr) ? ' · 色号取自图上的字' : '')
      + (张张.length > 1 && 空 ? ' · ' + 空 + ' 张没认出色块' : ''),
    h('div', { style:'display:grid;gap:12px' }, [list]), [
      h('button', { class:'fd-btn', onclick:() => Modal.close() }, '取消'),
      h('button', { class:'fd-btn primary', onclick:() => {
        /* 界面上那一行现在写的是什么就按什么解一次：改过的色号、图上印的色号都走这一条，解不出来的跳过 */
        const 勾着 = 块.filter(b => b.ck.checked).map(b => (b.inp.value || '').trim() || b.hex);
        if(!勾着.length){ toast('至少勾一个色块'); return; }
        const 进色卡 = CardPool.addAll(勾着.map(raw => {
          const p = parseColor(raw, 'auto');
          const r = p ? resolveColor(p, 'gracol') : null;
          return r ? r.hex : '';
        }), 'swatch');
        Modal.close(); if(redraw) redraw();
        toast('勾中的 ' + 勾着.length + ' 个色进色卡 · 添了 ' + 进色卡 + ' 个'
          + (进色卡 ? '' : '（这些色色卡里已经有了）') + 池尾());
      }}, '勾中的进色卡')]);
}
/* ---------- 新建配色：一次填 3~10 个色号，边填边看预览，点确定才进色卡 ---------- */
function newPaletteDlg(back){
  const draft = { name:'自定义方案 ' + (Palette.items.filter(x => x.source === 'custom').length + 1),
    mode:'custom', std:'gracol',
    colors:[{ raw:'', format:'auto' }, { raw:'', format:'auto' }, { raw:'', format:'auto' }] };
  const list = h('div', { style:'display:grid;gap:8px' });
  /* 预览卡并进表面名单（影子、纹理都归外观层现算）。
     从前这里画的是 --bw + --card-border：质感与纯平两档收成 0，卡片就没有外框也没有影子，
     和对话框那块面完全糊在一起。外框撤掉是这两档的定义（靠影子分高低），不是漏。
     色号填够三个以后 drawPreview 会内联铺上「这一套候选卡面」的颜色，内联比选择器重，
     那一档底本来就归草稿自己管，外观层只补影子与纹理。 */
  const preview = h('div', { 'data-look':'', style:'border-radius:var(--r-card,5px);padding:10px' });
  const hexes = () => draft.colors.map(c => {
    const p = parseColor(c.raw, c.format || 'auto');
    const r = p ? resolveColor(p, draft.std) : null;
    return r ? r.hex : '';
  }).filter(Boolean);
  const drawPreview = () => {
    const hs = hexes();
    preview.innerHTML = '';
    if(hs.length < 3){ preview.appendChild(h('span', { class:'fd-hint' }, '填够 3 个色号就能看成品')); return; }
    const t = deriveTokens(assignRoles(hs));
    preview.style.background = t['--card-bg'];
    preview.style.color = t['--text'];
    preview.appendChild(h('div', { style:'display:flex;gap:6px;margin-bottom:8px' },
      ['--page-bg','--card-bg','--accent','--accent2','--text','--text-light','--ok','--bad'].map(k =>
        h('span', { class:'fd-swatch', title:k + ' ' + t[k], style:'background:' + t[k] }))));
    preview.appendChild(h('div', { style:'font-weight:700' }, '正文示例 Flow-Desk'));
    preview.appendChild(h('div', { style:'opacity:.65' }, '次要文字与提示'));
  };
  const draw = () => {
    list.innerHTML = '';
    draft.colors.forEach((c, i) => {
      /* 同上：这一块从前是个不能点的 <span>（这一处就是用户圈出来的那一排条纹色块），
         现在点得动 —— 点它是给这一格定一个色，上面那个输入框跟着写出色号。 */
      const sw = colorChip('', (v, final) => { c.raw = v; paint(); drawPreview(); if(final) draw(); });
      /* 每格色块跟着输入实时亮起来，才知道这一串 FD 认没认出来 */
      const paint = () => {
        const p = parseColor(c.raw, c.format || 'auto');
        const res = p ? resolveColor(p, draft.std) : null;
        sw.sync(res ? res.hex : '', res ? (res.source + ' → ' + res.hex + ' · 点这块重新定色') : '这一格还没填出颜色 · 点这块定一个');
      };
      paint();
      const inp = h('input', { class:'fd-input', value:c.raw,
        placeholder:'第 ' + (i+1) + ' 个：#3b6cb5 / 59,108,181 / 0x35A82A / 78,52,0,0',
        oninput:e => { c.raw = e.target.value; paint(); drawPreview(); } });
      const fmt = h('select', { class:'fd-input', style:'width:auto' },
        [h('option',{value:'auto'},'自动'), h('option',{value:'rgb'},'RGB'), h('option',{value:'cmyk'},'CMYK')]);
      fmt.value = c.format || 'auto';
      fmt.addEventListener('change', () => { c.format = fmt.value; draw(); });
      list.appendChild(h('div', { class:'fd-row' }, [
        sw, inp, fmt,
        h('button', { class:'fd-tool', title:'删掉这一格', html:icoMarkup('close'), onclick:() => {
          if(draft.colors.length <= 3){ toast('最少 3 个色号'); return; }
          draft.colors.splice(i, 1); draw();
        }})]));
    });
    if(draft.colors.length < 10) list.appendChild(h('button', { class:'fd-btn mini', style:'justify-self:start',
      onclick:() => { draft.colors.push({ raw:'', format:'auto' }); draw(); } }, '加一个色号（最多 10 个）'));
    drawPreview();
  };
  draw();
  const name = h('input', { class:'fd-input', value:draft.name, style:'max-width:280px', oninput:e => { draft.name = e.target.value; } });
  Modal.open('新建配色', h('div', { style:'display:grid;gap:14px' }, [
    row('配色名', name),
    row('CMYK 换算标准', segCtrl([{v:'gracol',t:'GRACoL'},{v:'swop',t:'SWOP'},{v:'japan',t:'Japan Color'}],
      () => draft.std, v => { draft.std = v; draw(); })),
    row('色号 3~10 个', list),
    row('预览', preview)
  ]), [
    h('button', { class:'fd-btn', onclick:() => Modal.close() }, '取消'),
    h('button', { class:'fd-btn primary', onclick:() => {
      if(hexes().length < 3){ toast('至少填 3 个能认出的色号'); return; }
      Palette.add({ name:draft.name.trim() || '未命名配色', mode:'custom',
        colors:draft.colors.filter(c => parseColor(c.raw, c.format || 'auto')), std:draft.std });
      Modal.close(); toast('已建好并选用');
    }}, '确定套用')
  ], back);
}
/* ---------- 一只自绘下拉（#292）：名字 + 一排色点 + 右边一个小标签 ----------
   方案和配色两档都用它。认一套样子靠的就是那几点色，原生 <select> 摆不出色点，
   所以自绘一层菜单，标签用来写「质感 · 纸质纹理」这种一眼分得出的话。
   全站就这一只下拉的形状（从前还有一只同形的配色下拉，配色那档并入方案之后它没人调用了，2026-10-04 删掉）。 */
function dotSel(list, get, set){
  const wrap = h('div', { class:'fd-sel' });
  const btn = h('button', { class:'fd-sel-btn', type:'button', 'aria-haspopup':'listbox', 'aria-expanded':'false' });
  const menu = h('div', { class:'fd-sel-menu', role:'listbox' });
  const draw = () => {
    const items = list() || [];
    const cur = String(get() || '');
    const hit = items.find(x => x.k === cur);
    btn.replaceChildren(h('span', { class:'fd-sel-name' }, hit ? hit.name : (cur || '（没有可选的）')),
      paletteDots(hit ? hit.pal : null), h('span', { class:'fd-sel-arrow', html:icoMarkup('caretDown') }));
    menu.innerHTML = '';
    for(const x of items){
      const on = x.k === cur;
      const it = h('button', { class:'fd-sel-item' + (on ? ' on' : ''), type:'button', role:'option', 'aria-selected':String(on) },
        [h('span', { class:'fd-sel-name' }, x.name), paletteDots(x.pal)].concat(x.tag ? [h('span', { class:'fd-sel-tag' }, x.tag)] : []));
      it.onclick = ev => { ev.stopPropagation(); selMenuClose(); if(x.k !== cur) set(x.k); };
      menu.appendChild(it);
    }
  };
  btn.onclick = e => { e.stopPropagation(); selMenuToggle(menu); };
  /* 焦点在触发按钮上按方向键 = 打开并跳到当前选中那一项，和原生 select 一个手感 */
  btn.onkeydown = e => {
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); selMenuOpen(menu); }
  };
  menu.onkeydown = e => selMenuKeys(menu, e);
  wrap.append(btn, menu);
  draw();
  return { wrap, draw };
}
/* ---------- 一块点了就能选色的色块（外13-N 顺手修的那处真 bug）----------
   从前这里是 h('span', { class:'fd-swatch' }) —— 一整块纯预览，全站没有一处给它挂过点击，
   也没有 input[type=color] 在底下（出处见下面那两条旧代码的位置）。看着是「在这儿挑颜色」，
   其实那块色只是把上面输入框认出来的结果画出来给人看，所以「点不动」不是坏了，是从来没有能点的控件。
   现在这个是真控件：外层这块圆片只负责摆颜色，里面盖着一个透明铺满的原生取色器，
   点它 = 系统取色面板；Tab 也走得到它（焦点框归外观层那一条 2px 描边）。
   上面输入框还没认出色号时，这一个照旧铺条纹说「还没认出来」，但一样点得动 —— 点一下就是定色。 */
function colorChip(hex, onPick, title){
  const ok = v => /^#[0-9a-f]{6}$/i.test(String(v || ''));
  const inp = h('input', { type:'color', class:'fd-chip-in', value:'#808080',
    title:title || '点这块选颜色', 'aria-label':title || '点这块选颜色' });
  const el = h('span', { class:'fd-chip' }, inp);
  /* 认没认出来跟着上面那个输入框实时重画（sync 就是从前那句 sw.style.background = … 的位置），
     认不出来的那一格铺条纹，但里面那个取色器照样点得动 */
  el.sync = (v, lab) => {
    const good = ok(v);
    el.className = 'fd-chip' + (good ? '' : ' fd-chip-none');
    el.style.background = good ? v : '';
    inp.value = good ? v : '#808080';
    if(lab){ el.title = lab; inp.title = lab; inp.setAttribute('aria-label', lab); }
  };
  inp.addEventListener('input', e => onPick(String(e.target.value).toLowerCase(), false));
  /* 原生取色面板关上那一下才是「定下来了」：拖动过程中只重画这一块，落定才写盘 / 重排 */
  inp.addEventListener('change', e => onPick(String(e.target.value).toLowerCase(), true));
  el.sync(hex, title);
  return el;
}
/* ---------- 从色卡挑一个颜色 ----------
   摊开的就是「方案资源」那一页管着的那一份色卡（data\cards.yaml），去重、按色相排。
   这一个按钮是三条定色路里的一条：另外两条 —— 取色器、手写色号 —— 就在下面那一排每一个颜色自己边上
   （作者的话：「标记色可以取色器+色号自由设色，只不过标记色的色号不会自动进入色卡」）。
   从前这里还并列过第二家（这套配色里出现过的色号），是我自己分的两家，作者只定了一个东西：色卡 —— 撤了。
   挑中的那一个用全站同一套确认语言圈出来（外观层那一条：描边 + 内圈 + 勾）。 */
function markPoolDlg(cur, onPick){
  const set = [];
  const push = hex => { const v = String(hex || '').toLowerCase();
    if(/^#[0-9a-f]{6}$/.test(v) && !set.includes(v)) set.push(v); };
  for(const c of CardPool.items) push(CardPool.hexOf(c));
  if(!set.length){ toast('色卡上还一个色也没有 —— 先到「方案资源」那一页取几个色进色卡，或者直接用旁边的取色器、色号那一格', true); return; }
  set.sort((a, b) => { const x = CV.hslOf(a), y = CV.hslOf(b); return (x[0] - y[0]) || (x[2] - y[2]); });
  const grid = h('div', { class:'fd-dots' });
  const q = h('input', { class:'fd-input', placeholder:'按色号筛，比如 3b6c', style:'max-width:200px' });
  const draw = () => {
    grid.innerHTML = '';
    const s = q.value.trim().toLowerCase();
    const list = s ? set.filter(hex => hex.includes(s)) : set;
    if(!list.length){ grid.appendChild(h('span', { class:'fd-hint' }, '没有色号里带这几个字的颜色，把上面那几个字改一改')); return; }
    for(const hex of list) grid.appendChild(h('button', { class:'fd-dot' + (hex === cur ? ' on' : ''), type:'button',
      style:'background:' + hex, title:hex, 'aria-label':'用这个颜色 ' + hex,
      'aria-pressed':String(hex === cur),
      onclick:() => { Modal.close(); onPick(hex); } }));
  };
  q.addEventListener('input', draw);
  draw();
  Modal.open('从色卡挑一个颜色', h('div', { style:'display:grid;gap:12px' }, [
    h('div', { class:'fd-hint' }, '色卡上攒的 ' + CardPool.count() + ' 个，按色相排。这一个只是挑现成的 —— 色卡里没有的那个色，用旁边那两条路：取色器点一个、或者把色号写进那一格。'),
    q, grid]),
    [h('button', { class:'fd-btn', onclick:() => Modal.close() }, '不换了')]);
}
/* 进色卡那几步共用的后半句（审查第 41 条）：读不到 cards.yaml 那一趟，CardPool.boot 会把 ready 按灭，
   其后的存盘那一步一个字都不写（那是为了防止拿一份没读到的空档去盖掉文件里那一整份）。
   内存里加上了、这一屏也看得见，但重启就没 —— 报「添了几个」的时候得把这一句带上。 */
const 池尾 = () => CardPool.ready ? '' : '（这一趟没连上色卡那份文件，只记在内存里，重启就没了）';
/* ---------- 色卡（外29 那一屏，外32 第 1 轮整个摊到「方案资源」那一页上，不再藏在一只框里）----------
   这一屏就是色卡本身：库里攒的一个一个色，按色系分块摊开，顶上写总数、工具条排在圆点之前。
   作者 2026-10-09 三句话定了这一屏的形状：
   · 「打开的是色卡，挑中了再进色卡，这个逻辑你不觉得奇怪吗？」+「方案资源这里是色卡，下拉展示所有颜色，选中的进入方案」
     —— 这一屏是仓库，从仓库里挑中再放回仓库那句是循环，那一枚整个撤了。挑中的去处两条：
     「挑中的进入方案」（存成这一套方案正在用的那套配色，回到「方案编辑」顶上就能看到、能微调），
     或者「挑中的存成一组基础色」（渐变那一颗）。一个色都不挑 = 就是看着挑着玩，色卡一个字节不动。
     要往色卡里添色，走旁边那四条真的入口：从图取色、色卡图、当前方案的色、自己填色号。
   · 「不要选中变色！！！！！！！！！！会让用户感觉选错了」—— 挑中只加一圈环：这一颗不许变淡，其余几百颗
     更不许跟着变淡（那一条例外写在 _shared\sh-look.js 与 _shared\sh-style.js 的 .fd-dots-pool 里）。
   · 「色卡排序也不太对，每组的深浅、明暗看起来都是混着来的」+「现在软件内的圆点形式排序比较乱，感觉色相、
     亮度都有点起起伏伏」+ 这一轮「色卡排序不太好，还是有深色混在浅色里面」—— 组内一律走 CardPool.sortIn：
     明度为轴深 → 浅，明度挨着（一层 8 个点以内）的拢成一层、层内按色相排，一层往右下一层往左地蛇形走。
     中间那一版改成「先按色相 12° 一条带」，量下来正是它把深色送回浅色后面的（九档真色里 39 处往回跳、最狠一处 85 个点），
     这一版撤回来了。三处口径都写在 sortIn 上面那一段。
   「颜色管理」按下去才给改组名、删一个 —— 平时这一屏只挑色，不动色卡。
   一个色在这一屏占一个圆点：一组几档就画成几档斜着铺开，一眼看得出这不是一个纯色（只为显示，不写进档）。 */
function cardPoolBox(after, useFor){
  const picked = new Set();
  let 管理 = false;
  const 组 = () => CardPool.groups();
  const 挑中 = () => [...picked];
  const gradCss = c => {
    const hs = (c.colors || []).map(x => CardPool.hexOf({ colors:[x] })).filter(Boolean);
    if(hs.length < 2) return hs[0] || '#888';
    return 'linear-gradient(135deg,' + hs.join(',') + ')';
  };
  const box = h('div', { style:'display:grid;gap:12px' });
  const 顶 = h('div', { class:'fd-row', style:'flex-wrap:wrap;gap:8px' });
  const cnt = h('span', { class:'fd-hint' });
  const 圆点区 = h('div', { style:'display:grid;gap:12px' });
  box.append(顶, 圆点区);
  const draw = () => {
    圆点区.innerHTML = '';
    const gs = 组();
    if(!gs.length){ 圆点区.appendChild(h('span', { class:'fd-hint' }, '色卡还是空的 —— 先从图里取色，或者下面自己填色号添几个。')); }
    for(const [名, 个] of gs){
      const 名格 = h('input', { class:'fd-input', value:名, style:'max-width:200px' });
      const 头 = h('div', { class:'fd-row' }, [管理 ? 名格 : h('b', {}, 名), h('span', { class:'fd-hint' }, 个.length + ' 个')]);
      if(管理) 头.appendChild(h('button', { class:'fd-btn mini', type:'button', title:'改这一组的组名（颜色本身不取名）',
        onclick:() => { const v = 名格.value.trim();
          if(!v){ toast('组名不能空'); 名格.value = 名; return; }
          CardPool.renameGroup(名, v); draw(); } }, '改组名'));
      圆点区.appendChild(头);
      const grid = h('div', { class:'fd-dots fd-dots-pool' });
      for(const c of CardPool.sortIn(个)){
        const on = picked.has(c.code);
        const dot = h('button', { class:'fd-dot' + (on ? ' on' : ''), type:'button',
          style:'background:' + gradCss(c), 'aria-label':'色卡上一个 ' + CardPool.hexOf(c),
          'aria-pressed':String(on),
          title:c.code + ' · ' + (c.colors || []).map(x => x.raw).join(' → ') + ' · ' + c.group +
            ' · ' + (CARD_SRC[c.source] || '自建') + ' · 点一下' + (on ? '撤掉' : '挑上'),
          onclick:() => { picked.has(c.code) ? picked.delete(c.code) : picked.add(c.code); draw(); } });
        if(管理){
          dot.appendChild(h('i', { class:'fd-tool', style:'position:absolute;right:-3px;top:-3px', html:icoMarkup('close'),
            title:'删掉这一个', onclick:async ev => { ev.stopPropagation();
              if(!await fdAsk('删掉色卡上这一个（' + (c.colors || []).map(x => x.raw).join(' → ') + '）？这一个从色卡里没了，攒色的那份文件也跟着少一段。', '删除')) return;
              CardPool.remove(c.code); picked.delete(c.code); draw(); } }));
        }
        grid.appendChild(dot);
      }
      圆点区.appendChild(grid);
    }
    /* 工具条排在圆点之前：这一屏几百颗一路排下去，控件沉到底就等于每回都要滚一遍才够得着 */
    顶.innerHTML = '';
    const 管 = h('button', { class:'fd-btn mini' + (管理 ? ' primary' : ''), type:'button',
      title:管理 ? '退出管理，这一屏回到只挑色' : '开起来才能改组名、删一个（挪组要先删了再填）',
      onclick:() => { 管理 = !管理; draw(); } }, '颜色管理');
    /* 这一枚从前不给 flex:0 0 auto + nowrap，父行一排东西挤满时它被压成一个字一行竖着排
       （作者 2026-10-08 指着那一屏说的「这么丑的换行」）—— 宁可整枚挪到下一行，不许把字拆开。 */
    const 微 = h('label', { class:'fd-row', style:'gap:5px;align-items:center;flex:0 0 auto;white-space:nowrap' }, [
      h('input', { type:'checkbox', checked:CardPool.tuneOn, onchange:ev => { CardPool.setTune(ev.target.checked);
        toast(ev.target.checked ? '一键微调开了：进色卡的色先理一遍（太接近的并掉、过暗过亮推回能用的档）'
                                : '一键微调关了：取到什么色就存什么色，一个不动'); } }),
      h('span', { class:'fd-hint' }, '颜色一键微调')]);
    const 加 = h('input', { class:'fd-input', placeholder:'自己填一个色号进色卡，回车（#3b6cb5、59,108,181、cmyk(78,52,0,0) 都认）',
      style:'max-width:340px', onkeydown:ev => { if(ev.key !== 'Enter') return;
        const n = CardPool.addAll([ev.target.value.trim()], 'custom');
        if(!n) toast('这一行解不出颜色'); else { ev.target.value = ''; draw(); if(after) after(); } } });
    const 从方案 = h('button', { class:'fd-btn mini', type:'button',
      title:'把当前这套配色正在用的那些色号（页面底、卡面、正文、次正文、主强调、次强调、五个色位、状态三色）添进色卡；同色不重复添，一键微调开着就先理一遍',
      onclick:() => {
        const 认到 = CardPool.schemePicks(Theme.applied);
        if(!认到.length){ toast('这一趟从当前配色里一个色号都没认到（配色还没铺上屏）', true); return; }
        const n = CardPool.addAll(认到, 'scheme');
        if(!n){ toast('当前方案在用的 ' + 认到.length + ' 个，色卡里都已经有了'); return; }
        draw(); if(after) after();
        toast('当前方案在用的色进色卡 · 添了 ' + n + ' 个' + 池尾());
      }}, '当前方案的色进色卡');
    /* 「小企鹅配色进色卡」「内置配色 v1 进色卡」这两枚 2026-10-09 撤了（外34 图8：两个多余按钮）。
       内置那 1307 个开机就自动灌过一遍（fd11-cards.js 的 CardPool.boot），这一枚本来就只是「整批划掉了想再来一遍」；
       小企鹅那一批不再自动进，也不再手动进 —— 要那一串色，去「自己填一个色号」那一格写，或直接挑图取色。 */
    /* 挑中的第一条真的去处：进方案 —— 色卡是仓库，从仓库挑中的东西往方案里放，这一句才是这一屏的正路
       （作者：「方案资源这里是色卡，下拉展示所有颜色，选中的进入方案」）。一套配色 3~10 个色号，所以至少挑三颗。 */
    const 进方案 = useFor ? h('button', { class:'fd-btn mini primary', type:'button',
      title:'把挑中的这几颗存成一套配色，并让当前这一套方案用上它（一套配色 3~10 个色号）—— 存完到「方案编辑」那一页顶上就能看到这几个色，改基调、改色号都在那一处',
      onclick:() => {
        const 色 = 挑中().map(code => { const c = CardPool.items.find(x => x.code === code); return c ? CardPool.hexOf(c) : ''; }).filter(Boolean);
        if(色.length < 3){ toast('进方案至少挑 3 个（一套配色最少 3 个色号）'); return; }
        if(色.length > 10){ toast('一套配色最多 10 个色号，先撤掉 ' + (色.length - 10) + ' 个'); return; }
        if(useFor(色)){ picked.clear(); draw(); if(after) after(); }
      }}, '挑中的进入方案') : null;
    /* 挑中的第二条去处：存成一组基础色（从前那一枚「挑中的进色卡」是循环，整个撤了，理由写在上面那段注释里） */
    const 成组 = h('button', { class:'fd-btn mini', type:'button',
      title:'把挑中的这几颗存成一组基础色（至少两颗）—— 色卡只存料，怎么铺成渐变（线性还是弥散）归外观方案那一侧定',
      onclick:() => {
        const 色 = 挑中().map(code => { const c = CardPool.items.find(x => x.code === code); return c ? CardPool.hexOf(c) : ''; });
        if(色.length < 2){ toast('存成一组至少挑两个'); return; }
        const 个数 = CardPool.count();
        const g = CardPool.addGrad(色, CARD_GROUP0, 'pick');
        if(!g){ toast('这几个解不出颜色'); return; }
        picked.clear(); draw(); if(after) after();
        toast(CardPool.count() > 个数 ? ('挑中的 ' + 色.length + ' 个存成一组基础色' + 池尾())
          : ('这一串基础色色卡里已经有了（一组只比那几个色号，不比先后以外的东西；怎么铺成渐变归外观方案定）'));
      }}, '挑中的存成一组');
    顶.append(管, 微);
    if(进方案) 顶.append(进方案);
    顶.append(成组, 从方案, 加);
    cnt.textContent = '色卡里 ' + CardPool.count() + ' 个 · 挑中 ' + picked.size + ' 个';
    顶.appendChild(cnt);
  };
  draw();
  return box;
}
/* ---------- 标记色这一摊（外13-N，外29 丁组改成只从色卡挑）----------
   位置在 设置 · 外观 · 方案编辑 那一页里，但数据上它不进方案草稿，也不走那套「覆盖还是另存」——
   那一套管的是 数据\looks.yaml 里的方案，标记色不住在那儿（住外观存档顶上单独一节 marks）。
   所以这里的每一次改动都是当场落盘（写进这一套方案的 标记色 那一栏）、当场重画，不问「存不存进方案」。
   定色三条路都开着，每一个颜色自己边上各摆一套：取色器点一个 · 色号那一格写一个 · 「从色卡挑」按钮挑一个。
   作者的话：「标记色可以取色器+色号自由设色！！！只不过标记色的色号不会自动进入色卡！」
   —— 只有第三条反过来不成立：这一串里的色号不会因为当过标记色就自己跑进色卡，要进得他自己在色卡那一屏按「进色卡」。
   从前我自己收成「只能从色卡挑」一条路，那一档撤回来了。 */
/* ---------- 现在真被用到的标记色有几个（作者的话：「检测当前所有文件启用的标记色共有多少个」）----------
   存档里存的是「第几个」那一句取值（var(--mark-N, …)，老数据是 var(--slot-N)），不是色号 ——
   所以一串标记色变短时，排在后面的那几号在 markVar 那一头按当前个数绕回前面的色上，
   两处原本不同色的标记就撞成一个色。这一趟数的是「真有几个编号被用着」，问话才有得比。
   走过的那两处：
     · 为写那边每家板子（IndexedDB 的 wnw-docs / kv 里 board.* 那一批）：节点填充、节点边框、连线、分组底色；
     · 正文高亮规则（IndexedDB 的 wnw-state / kv 里的 hl-rules、hl-kw）：圆点存的是 1 起的编号，
       自己定长相当存的就是那一句取值，两样都算。
   不算进来的：书封面、日程的色条与标签、便签左边那一条 —— 那几处存档里写的是 --slot-N（这套配色的强调位），
     跟着配色走，不是标记色；把它们算进来会凭空多出五个来。
   凑满当前这一串的长度就收手（绕回之后的编号不可能超出这一个数）；
   数据库开不起来（这台机器不让用 / 被别的窗口占着）就回当前这一串的长度 —— 宁可多问一句，不悄悄放行。 */
async function marksInUse(){
  const n = Marks.count() || markCount();
  if(!n) return 0;
  const at = new Set();
  const 收 = v => { const i = markIndexOf(v); if(i >= 0 && i < n) at.add(i); return at.size >= n; };
  try{
    for(const k of await IDB.keys('wnw-docs', 'kv', 'board.')){
      const b = await IDB.get('wnw-docs', 'kv', k);
      if(!b) continue;
      for(const x of (b.nodes || [])) if(收(x.fill) || 收(x.line)) return n;
      for(const x of (b.links || [])) if(收(x.c)) return n;
      for(const x of (b.groups || [])) if(收(x.c)) return n;
      if(at.size >= n) return n;
    }
  }catch(e){ return n; }
  for(const key of ['hl-rules', 'hl-kw']){
    let rs = null;
    try{ rs = await IDB.get('wnw-state', 'kv', key); }catch(e){ return n; }
    for(const r of (Array.isArray(rs) ? rs : [])) if(收(r.slot) || 收(r.st)) return n;
  }
  return at.size;
}
/* ---------- 换方案之前那一句问话（作者原话的那四个选择，一个字不改一个不加）----------
   只在「那一套自己钉过一串，而且那一串比真用着的少」时开口；
   那一栏空着 = 他没在那一套里单独选过标记色 → 屏幕上这一串沿用不动，本来就不存在够不够。
   四条路的落点：
     继续启用 = 直接切，接受撞色；
     添加颜色 = 先在一个窗口里把那一串添够（取色器 / 写色号 / 从色卡挑三条都开着），添够了才切；
     替换当前标记色 = 把此刻在用的那一串整个写进他要切过去的那一套，再切；
     取消切换 = 一个字都不动，下拉那一格退回上一套的名字。 */
async function marksGuard(name, go, 退回){
  const s = LookLib.list.find(x => x.方案名 === name);
  const 那一串 = s && Array.isArray(s.标记色) ? s.标记色 : [];
  if(!s || !那一串.length){ go(); return; }
  const 在用 = await marksInUse();
  if(那一串.length >= 在用){ go(); return; }
  const 上一串 = Marks.hexes();
  const 话 = '当前方案标记色数量少于使用中标记色数量，继续启用可能导致部分标记同色';
  /* 在用 这个数天生不会高过屏幕上这一串的长度：marksInUse 数满 Marks.count() 就早退，
     存档里的编号也是按这一串的长度取模绕回来的（撞色就是这么撞的）。
     所以「替换当前标记色」这一条拿上一串去换永远够用，不用留「按不动」那一档。 */
  const 细 = '要切过去的「' + name + '」自己选了 ' + 那一串.length + ' 个标记色，'
    + '此刻所有文件里真用着的有 ' + 在用 + ' 个。（屏幕上这一串有 ' + 上一串.length + ' 个，替换过去就够 ' + 在用 + ' 个用。）';
  Modal.open('标记色不够', h('div', { style:'display:grid;gap:10px' },
      [h('div', {}, 话), h('div', { class:'fd-hint' }, 细)]),
    [h('button', { class:'fd-btn', type:'button', onclick:() => { Modal.close(); go(); } }, '继续启用（接受同色）'),
     h('button', { class:'fd-btn', type:'button', onclick:() => { Modal.close(); 添够再切(name, 那一串, 在用, go, 退回); } }, '添加颜色（补足数量）'),
     h('button', { class:'fd-btn', type:'button',
       title:'用屏幕上这一串（' + 上一串.length + ' 个）整个替掉「' + name + '」的标记色，然后切过去',
       onclick:() => { Modal.close(); s.标记色 = 上一串.slice(); LookLib.saveNow(); go();
         toast('已把「' + name + '」的标记色换成刚才那一串（' + 上一串.length + ' 个）'); } }, '替换当前标记色'),
     h('button', { class:'fd-btn primary', type:'button', onclick:() => { Modal.close(); if(退回) 退回();
       toast('没切过去，还是「' + LookLib.cur + '」'); } }, '取消切换')]);
}
/* 添加颜色那一条：把那一串添够才切过去。添不够就走开，这一次切换整个不算。 */
function 添够再切(name, 那一串, 在用, go, 退回){
  const s = LookLib.list.find(x => x.方案名 === name);
  const 串 = 那一串.slice();
  /* 这一串里不许有两个同色 —— 存进文件就是那一栏的两个同色，屏幕上 marksNorm 也会把重的那个吃掉，
     到时「添够了」那句就成了空话。所以每一条落色口（取色器 / 写色号 / 色卡挑 / 起点色）都先问这一句。 */
  const 占 = (hex, 跳) => 串.some((x, j) => String(x).toLowerCase() === String(hex).toLowerCase() && j !== 跳);
  const 撞 = hex => toast('这一串里已经有 ' + hex + ' 了，换一个', true);
  const box = h('div', { style:'display:grid;gap:12px' });
  const 确 = h('button', { class:'fd-btn primary', type:'button', onclick:() => {
    if(串.length < 在用){ toast('还差 ' + (在用 - 串.length) + ' 个 —— 添够了再切，或者回去选那四条里的另一条', true); return; }
    Modal.close(); s.标记色 = 串.slice(); LookLib.saveNow(); go();
    toast('已给「' + name + '」添到 ' + 串.length + ' 个标记色'); } }, '添够了，切过去');
  const draw = () => {
    box.innerHTML = '';
    box.appendChild(h('div', {}, '在用 ' + 在用 + ' 个 · 这一套已有 ' + 串.length + ' 个'
      + (串.length >= 在用 ? ' · 够了' : ' · 还差 ' + (在用 - 串.length) + ' 个')));
    const list = h('div', { class:'fd-marks' });
    串.forEach((hex, i) => {
      const one = [h('span', { class:'fd-mark-no' }, String(i + 1)),
        colorChip(hex, (v, 落定) => { if(!落定) return; if(占(v, i)){ 撞(v); return; } 串[i] = v; draw(); }, '取色器：换这一个'),
        h('button', { class:'fd-btn mini', type:'button', onclick:() => markPoolDlg(hex, v => {
          if(占(v, i)){ 撞(v); return; } 串[i] = v; draw(); }) }, '色卡')];
      if(串.length > MARK_MIN) one.push(h('button', { class:'fd-tool', type:'button', title:'撤掉这一个',
        html:icoMarkup('close'), onclick:() => { 串.splice(i, 1); draw(); } }));
      list.appendChild(h('div', { class:'fd-mark' }, one));
    });
    box.appendChild(list);
    if(串.length < MARK_MAX){
      const 写 = h('input', { class:'fd-input', type:'text', placeholder:'写一个色号添上，回车', style:'max-width:180px',
        onchange:定, onkeydown:e => { if(e.key === 'Enter') 定(); } });
      function 定(){
        const h6 = CardPool.hex(String(写.value || '').trim());
        if(!h6){ toast('这一个色号认不出来', true); 写.value = ''; return; }
        if(占(h6, -1)){ 撞(h6); 写.value = ''; return; }
        串.push(h6); 写.value = ''; draw();
      }
      box.appendChild(h('div', { class:'fd-row' }, [写,
        h('button', { class:'fd-btn mini', type:'button', onclick:() => {
          const h6 = Marks.nextHex(串);
          if(占(h6, -1)){ toast('这套配色的起点色都用过了 —— 自己写一个或者从色卡挑', true); return; }
          串.push(h6); draw(); } }, '加一个起点色'),
        h('button', { class:'fd-btn mini', type:'button', onclick:() => markPoolDlg('', v => {
          if(占(v, -1)){ 撞(v); return; } 串.push(v); draw(); }) }, '从色卡挑一个添上')]));
    }
  };
  const 关 = () => { Modal.close(); 退回(); toast('没切过去，还是「' + LookLib.cur + '」'); };
  draw();
  Modal.open('给这一套添够标记色', box,
    [h('button', { class:'fd-btn', type:'button', onclick:关 }, '不添了，这次不切'), 确]);
}
function markSection(){
  const box = h('div', { style:'display:grid;gap:14px;border-top:var(--hair);padding-top:12px' });
  const draw = () => {
    box.innerHTML = '';
    const hs = Marks.hexes();
    const 这一套 = LookLib.get();
    box.appendChild(h('div', { class:'fd-hint' },
      '标记色 · ' + hs.length + ' 个（最少 ' + MARK_MIN + ' · 最多 ' + MARK_MAX + '）—— '
      + '这一串写在这一套方案文件的 标记色 那一栏' + (这一套 ? '（「' + 这一套.方案名 + '」）' : '')
      + '：换方案它跟着换，那一套没单独选过时屏幕上这一串沿用不动。换配色、换外观模式、换明暗都不重算它。'));
    box.appendChild(h('div', { class:'fd-hint' },
      '每一个颜色三条路都可使：点取色片自己挑一个 · 在色号那一格写一个（#3b6cb5、59,108,181、cmyk(78,52,0,0) 都认）· 或者点「色卡」从色卡里挑一个现成的。'));
    const list = h('div', { class:'fd-marks' });
    hs.forEach((hex, i) => {
      /* 取色器这一条：拖动过程中只在这一格里重画，松手（落定）才写进方案 —— 一拖几十次白存盘 */
      const chip = colorChip(hex, (v, 落定) => {
        if(!落定){ tx.value = v; chip.sync(v, '取色器挑中的：' + v); return; }
        Marks.set(i, v); draw();
      }, '取色器：点这块挑一个颜色');
      const tx = h('input', { class:'fd-input', type:'text', value:hex, maxlength:24,
        title:'色号：写完回车或走开一下就换上这一个（认 #3b6cb5、0x35A82A、59,108,181、cmyk(78,52,0,0)）',
        'aria-label':'标记色第 ' + (i + 1) + ' 个的色号',
        onkeydown:e => { if(e.key === 'Enter') tx.blur(); },
        onchange:e => {
          const h6 = CardPool.hex(String(e.target.value || '').trim());
          if(!h6){ toast('这一个色号认不出来，还是照原来的 ' + hex, true); e.target.value = hex; return; }
          if(h6 === hex){ e.target.value = hex; return; }
          Marks.set(i, h6); draw();
        } });
      const pick = h('button', { class:'fd-btn mini', type:'button', title:'从色卡里挑一个现成的换上这一个',
        onclick:() => markPoolDlg(hex, v => { Marks.set(i, v); draw(); }) }, '色卡');
      const cell = [h('span', { class:'fd-mark-no' }, String(i + 1)), chip, tx, pick];
      /* 剩下 MARK_MIN 个的时候撤掉那一个是不允许的，这一档「不支持的组合不渲染」：按钮干脆不摆 */
      if(hs.length > MARK_MIN) cell.push(h('button', { class:'fd-tool', type:'button', title:'撤掉这一个',
        html:icoMarkup('close'), onclick:async () => {
          if(!await fdAsk('撤掉第 ' + (i + 1) + ' 个标记色（' + hex + '）？这一串就少一个，后面那几个一起往前挪一位。', '撤掉')) return;
          Marks.remove(i); draw();
        } }));
      list.appendChild(h('div', { class:'fd-mark' }, cell));
    });
    box.appendChild(row('这一串颜色', list));
    const btns = [];
    if(hs.length < MARK_MAX) btns.push(h('button', { class:'fd-btn mini', type:'button',
      title:'往这一串末尾加一个（先接一个起点色，点它再换成色卡里你要的那一个）',
      onclick:() => { Marks.add(); draw(); } }, '加一个'));
    btns.push(h('button', { class:'fd-btn mini', type:'button',
      title:'把这一串整个换成当前这套配色的五个强调位（只有你按这一个才换，换方案不会自动换）',
      onclick:() => {
        Modal.open('照当前配色重取一遍？', h('div', { style:'display:grid;gap:10px' },
          [h('div', {}, '这一串里 ' + hs.length + ' 个会整个换成当前配色里的那五个强调位，你自己挑过的色号会没掉。'),
           h('div', { class:'fd-hint' }, '不换也行：下面那一个一个各自点着换，平时用不着这一个。')]),
          [h('button', { class:'fd-btn', onclick:() => Modal.close() }, '取消'),
           h('button', { class:'fd-btn primary', onclick:() => { Modal.close(); Marks.reseed(); draw(); toast('已照当前配色重取这一串'); } }, '照当前配色重取')]);
      } }, '照当前配色重取一遍'));
    box.appendChild(h('div', { class:'fd-row' }, btns));
  };
  draw();
  return box;
}
/* ---------- 一张平铺小图能不能反复贴（外13-Q 的简单格式测试）----------
   只做三件事：能不能解码、边长落在 8~1024 里、四条边和它们对面那条贴不贴得上。
   这是「简单格式测试」不是「无缝认证」：拿像素比对能拦住「左右两头根本对不上」那一大类，
   拦不住「中间有渐变、两头刚好接着但一眼看得出四格一块」那种。测出来判不了的，
   界面上就把「我知道，照样收」这条路留着（配色原则那份文档第五节第二条：
   「如果糊完露出缝，说明这张图本来就不无缝，那是导入那一步该拦的事」—— 拦这一步，不改壁纸那一档的形状）。
   阈值一条：上下、左右两组边缘差的平均数都 ≤ 16 才算贴得上。16 是 0~255 那一格里的 6%，
   对着纸纹、布纹那种细密纹路量的：真无缝的图这两组通常落在 2~8，肉眼分得出的错位一下上到 40 以上。 */
const TexTest = {
  MIN:8, MAX:1024, MAX_BYTES:4 * 1024 * 1024, EDGE:16,
  /* 交回 { ok, why, seam, w, h }：why 是给人在屏幕上读的那一句，不带文件路径 */
  async run(file){
    if(!file) return { ok:false, why:'没拿到图' };
    if(file.size > this.MAX_BYTES)
      return { ok:false, why:'这张图 ' + Math.round(file.size / 1024) + ' KB，超过 4 MB，反复贴的那一层不该这么大' };
    const url = URL.createObjectURL(file);
    let img = null;
    try{
      img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error('这张图解不开（认 PNG / JPG / WEBP 那三种）'));
        im.src = url;
      });
    }
    catch(e){ URL.revokeObjectURL(url); return { ok:false, why:e.message || '这张图解不开' }; }
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    try{
      if(!(w >= this.MIN && h >= this.MIN))
        return { ok:false, why:'这张图是 ' + w + '×' + h + '，短边不到 ' + this.MIN + ' 像素，铺满一张卡片要重复上千次' };
      if(w > this.MAX || h > this.MAX)
        return { ok:false, why:'这张图是 ' + w + '×' + h + '，长边超过 ' + this.MAX + ' 像素；纹理是给卡片表面反复贴的小图，太大了该去当壁纸' };
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const g = cv.getContext('2d', { willReadFrequently:true });
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, w, h).data;
      const at = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
      /* 两条边各挑一半的行/列来比：一张 1024 的图量 512 个点够稳，又不卡在界面上 */
      const avg = (f, n) => { let s = 0, c = 0; for(let i = 0; i < n; i += 2){ s += f(i); c++; } return c ? s / c : 0; };
      const dh = avg(y => { const a = at(0, y), b = at(w - 1, y); return (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3; }, h);
      const dv = avg(x => { const a = at(x, 0), b = at(x, h - 1); return (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3; }, w);
      const seam = Math.max(dh, dv) <= this.EDGE;
      return { ok:true, seam, w, h,
        why:'这张图 ' + w + '×' + h + '，' + (seam
          ? '四条边对得上（左右差 ' + Math.round(dh) + '、上下差 ' + Math.round(dv) + '，都在 16 以内），反复贴看不出来'
          : '边上对不上（左右差 ' + Math.round(dh) + '、上下差 ' + Math.round(dv) + '，超过 16），贴开了多半看得出格子') };
    }
    /* 读像素这一步本身失败（那张图被系统标成跨源、或者解码器不认这种编码）：
       不能当成「这图不无缝」，只能当成「这一条测不了」，交回 seam:null 让界面照旧问一句 */
    catch(e){ return { ok:true, seam:null, w, h, why:'这张图 ' + w + '×' + h + '，边上的接合测不出来（' + (e && e.message || e) + '），能不能反复贴得你自己看' }; }
    finally{ URL.revokeObjectURL(url); }
  },
  /* 界面里那条「照样收」的说法：seam 是 null（测不了）和 false（测出来对不上）要分开讲 */
  ask(r){
    if(r.seam === null) return '这张图测不出边缘接合，照样收吗？';
    return r.seam ? null : '这张图多半贴不开，照样收吗？';
  }
};
/* ---------- 图片库那三种用途，界面上各一颗导入按钮 ----------
   收进来的图只认图标那一层给得出的后缀（原件在 src\pack\main.cjs 的 ICON_EXT）：
   往图库收一张 .bmp，清单上写着名字、屏幕上却取不到地址，那就是摆一条点得动的假图。
   「颜色」那一摊的「普通图片 / 色卡图」不受这一条管 —— 那两条直接读选中的文件取色，不落图库，所以 bmp 照旧能用。 */
const IMG_PICK = { 'image/png':['.png'], 'image/jpeg':['.jpg','.jpeg'], 'image/webp':['.webp'], 'image/gif':['.gif'] };
/* 一张图读不读得开、多大：背景图那一档不比像素（一张照片本来就大），只拦解码失败的。
   纹理那一路不吃这一条，它走上面 TexTest —— 那儿连边长和四条边的接合一起量。 */
async function imgDecodes(file){
  const url = URL.createObjectURL(file);
  try{
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('这张图读不出来')); img.src = url; });
    return { ok:true, w:img.naturalWidth, h:img.naturalHeight };
  }
  catch(e){ return { ok:false, why:String((e && e.message) || '这张图读不出来') }; }
  finally{ URL.revokeObjectURL(url); }
}
/* ---------- 把选好的那张图收进图片库（外29 丁组 第 4 页）----------
   次序的讲究是从前纹理那一趟留下来的：先落盘 → 再问图标那一层要一遍清单（主进程那边有半秒缓存，
   广播还要绕一跳，所以认不到就短等 300 毫秒再来，最多四回）→ 认到了才写清单。
   清单先写、图没落成的话，下拉里就会摆一条点得动、屏幕上什么都不铺的假名字。
   物理文件名一律写成 img-<时间戳+随机>，不拿原图的名字：两张原名一样的图（都叫 纹理.png）
   落进同一格会互相盖掉，界面上就成了「下拉里只有一条、换了一张另一张也跟着变」。 */
async function imgAccept(file, name, use, 作者){
  const extMatch = /\.([a-z0-9]+)$/i.exec(String(file.name || ''));
  const ext = '.' + String((extMatch && extMatch[1]) || 'png').toLowerCase();
  const base = 'img-' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  const put = await ImgLib.putBytes(base + ext, new Uint8Array(await file.arrayBuffer()));
  if(!put || put.ok === false) return { ok:false, msg:put && put.msg ? put.msg : '这张图没存进图库那一格' };
  const fresh = { 文件:base + ext };
  let got = false;
  for(let i = 0; i < 4 && !got; i++){
    try{ if(typeof Ico !== 'undefined' && Ico.reloadList) await Ico.reloadList(); }catch(e){}
    got = !!imgUrl(fresh);
    if(!got) await new Promise(r => setTimeout(r, 300));
  }
  const clean = ImgLib.add(name, base + ext, use, 作者 || '');
  Theme.apply(); Bus.emit('theme');
  return { ok:true, name:clean, seen:got };
}
/* ---------- 导入那一张图走的那一颗按钮（外29 丁组 第 4 页）----------
   三种用途走同一条路，只有两处按用途分开：纹理那一路多一道「贴不贴得开」的检测和一句照样收的问话；
   取色素材那一路收下之后顺手取一遍色（这一档存在的理由就是那几枚色，不该还要人再点第二回）。 */
async function imgImport(use, after){
  const u = IMG_USES.find(x => x.k === use) || IMG_USES[2];
  const 取色档 = use === '取色素材';
  let r = null;
  try{ r = await pickFile(IMG_PICK, 'fd-image'); }
  catch(e){ if(e && e.name !== 'AbortError') toast('选图这一步就断了：' + (e && e.message || e)); return; }
  if(!r || !r.file) return;
  let why = '', ask = null;
  if(取色档){
    const d = await imgDecodes(r.file);
    if(!d.ok){ toast('这张图读不出来：' + d.why, true); return; }
    why = '这张图 ' + d.w + '×' + d.h + '，能读开。取色只读这张图上的颜色，图上一个字都不改。';
  } else if(use === '纹理·四方连续图'){
    const t = await TexTest.run(r.file);
    if(!t.ok){ toast(t.why, true); return; }
    why = t.why; ask = TexTest.ask(t);
  } else {
    const d = await imgDecodes(r.file);
    if(!d.ok){ toast('这张图读不出来：' + d.why, true); return; }
    why = '这张图 ' + d.w + '×' + d.h + '，能读开。';
  }
  const 后话 = { '背景图':'收下来之后它就在「方案编辑」那一页的背景图那一排里，挑中即铺 Flow-Desk 的背景（只铺背景，不铺卡片面）。',
    '取色素材':'收下来就取这张图的主要颜色，取到的色进色卡；这张图本身不铺到屏幕上，也不进背景、纹理那两排。',
    '纹理·四方连续图':'收下来之后它就在「方案编辑」那一页的纹理那一排里，挑中即铺到背景、卡片面和展开后的插件卡面上；一张占几格在那一页定。' }[u.k];
  const label = ask ? '我知道，照样收' : (取色档 ? '收下并取色' : '收下');
  const go = () => {
    /* 名字默认取源文件名去掉后缀那一段：导一张 wood.png 进来，界面上先写着 wood，他爱改就改 */
    const nm = h('input', { class:'fd-input', style:'max-width:280px',
      value:String(r.file.name || '').replace(/\.[^.]+$/, '').trim() || '我的图' });
    const body = h('div', { style:'display:grid;gap:10px' },
      [h('div', { class:'fd-hint' }, why),
       h('div', { class:'fd-hint' }, ask || 后话),
       row('图片名', nm)]);
    /* 收这一笔要写图、写清单、再问图标那一层要一遍名单，前后有半秒左右的空档：
       那颗按钮在这段路上按下去不该再来第二回，所以先钉住、写着「正在收…」，成了由关闭顶掉它。 */
    const okBtn = h('button', { class:'fd-btn primary', onclick:async () => {
      okBtn.disabled = true; okBtn.textContent = '正在收…';
      const res = await imgAccept(r.file, nm.value.trim(), u.k);
      if(!res.ok){ toast(res.msg, true); okBtn.disabled = false; okBtn.textContent = label; return; }
      let 取到 = '';
      if(取色档){
        try{
          const hexes = await ImageTheme.colors(r.file, 8);
          const 进色卡 = hexes.length ? CardPool.addAll(hexes, 'image') : 0;
          取到 = ' · 取到 ' + hexes.length + ' 个色，进色卡 ' + 进色卡 + ' 个' + (进色卡 ? '' : '（这些色色卡里已经有了）') + 池尾();
        }catch(e){ 取到 = ' · 这一趟取不了这张图的色：' + ((e && e.message) || e); }
      }
      Modal.close();
      toast((res.seen ? ('已收下「' + res.name + '」') : ('已收下「' + res.name + '」，这一趟屏幕上还没认到那张图，稍等一会儿或重新挑一次')) + 取到, !res.seen);
      if(after) after();
    }}, label);
    Modal.open(u.t, body, [h('button', { class:'fd-btn', onclick:() => Modal.close() }, '算了'), okBtn]);
  };
  /* 边缘对不上时不硬拦：先问一句，照样收是他自己的判断（测不出来的那一种也走这一句） */
  if(ask){
    Modal.open('这张图多半贴不开', h('div', { style:'display:grid;gap:10px' },
      [h('div', {}, why), h('div', { class:'fd-hint' }, '要是不介意贴开了看得出格子，就照样收进图库。')]),
      [h('button', { class:'fd-btn', onclick:() => Modal.close() }, '还是不收了'),
       h('button', { class:'fd-btn primary', onclick:() => { Modal.close(); go(); } }, '我知道，照样收')]);
    return;
  }
  go();
}
/* ---------- 第 4 页「方案资源 · 图片」：三类用途各一块，收图和划掉图都在这一页 ----------
   第 3 页那一排下拉吃的就是这里分好的那三块 —— 这一页只管库里有什么，那一页只管这一套方案用哪一张（四页的分工）。
   每一行三样：名字、当成哪一类用（改主意了就地改，不用重导）、取色、划掉这一张。
   划掉只删清单里那一段，图留在 数据\images\ 不动 —— 程序不替他删磁盘上的东西。 */
function imgLibSection(after, uses){
  /* uses 不给 = 三类用途都摆在这一块（从前整页就一块）；给了就只摆点名的那几类
     （作者 2026-10-09 把纹理从图片里单列成仓库的一类：数据还是同一份 images.yaml，只是分两块摆）。 */
  const 类 = IMG_USES.filter(u => !uses || uses.indexOf(u.k) >= 0);
  const 这一堆 = () => ImgLib.list.filter(t => 类.some(u => u.k === t.用途));
  const box = h('div', { style:'display:grid;gap:10px' });
  /* 随包那 6 张内置纹理（src\pack\material\textures\，出包铺成 Flow-Desk\material\textures\）收进来走的是同一条路：
     先落盘 → 再认地址 → 认到了才写清单，跟他自己挑一张图导进来一字不差，不留第二套真相。
     差别只在字节从包里取（不叫选图那只窗）、用途直接记成「纹理·四方连续图」、名字和作者跟着内置那张表走。
     「贴不贴得开」那一道检测这一趟不跑：它是给随手选来的图拦的，这 6 张是他挑定、随包带出来的。 */
  const 内置收 = h('button', { class:'fd-btn mini primary', type:'button',
    title:'把随包的 ' + MATERIAL_TEXTURES.length + ' 张内置纹理（棉纸、牛皮纸、牛皮纸盒、素描纸 那几张，' +
      (MATERIAL_TEXTURES[0] ? MATERIAL_TEXTURES[0].作者 : '') + ' 做的）收进图片库，用途记成「纹理·四方连续图」，' +
      '收进来之后到「方案编辑」那一页的纹理那一排挑；图库里已经有同名的那张就不重收',
    onclick:async () => {
      const r = await 内置纹理收();
      draw(); if(after) after();
      if(!r.收 && !r.坏.length){ toast('内置那 ' + MATERIAL_TEXTURES.length + ' 张已经在图库里了'); return; }
      toast('内置纹理收进图片库 · 收了 ' + r.收 + ' 张' + (r.坏.length ? '，这几张没取到字节：' + r.坏.join(' / ') : ''));
    }}, '内置纹理收进图片库');
  const draw = () => {
    box.innerHTML = '';
    box.appendChild(h('div', { class:'fd-row' }, 类.map(u => h('button', {
      class:'fd-btn mini', type:'button', title:'挑一张图收进图库，用途记成「' + u.k + '」',
      onclick:async () => { try{ await imgImport(u.k, () => { draw(); if(after) after(); }); }
        catch(e){ toast('收图这一步断了：' + ((e && e.message) || e), true); } } }, u.t))
      .concat(类.some(u => u.k.indexOf('纹理') === 0) ? [内置收] : [])));
    box.appendChild(h('div', { class:'fd-hint' },
      '这一块 ' + 这一堆().length + ' 张（图库里一共 ' + ImgLib.list.length + ' 张）—— 清单就是 数据\\images.yaml 那一份纯文本，记事本里改完存盘这一排跟着变；'
      + '图收进来只认 .png / .jpg / .jpeg / .webp / .gif 这几个后缀。'));
    for(const u of 类){
      const 这一类 = ImgLib.byUse(u.k);
      box.appendChild(h('div', { class:'fd-row' }, [h('b', {}, u.k), h('span', { class:'fd-hint' }, 这一类.length + ' 张')]));
      if(!这一类.length){ box.appendChild(h('div', { class:'fd-hint' }, imgEmptyWord(u.k))); continue; }
      /* 一张一格排进网格（作者 2026-10-09：「纹理图片就这样平铺展开？？你还准备一张图一行不成？？
         将来更多图怎么办？？现在太丑了」）：一格至少 148 像素，列数跟着这一块的宽度自己铺，
         图多了往下排，不再一张占满一行。缩略图按这一张本来的用法画：纹理那一种原样平铺一小块
         （一眼看得出不无缝），其余两种裁中间一块。 */
      const grid = h('div', { class:'fd-imgs' });
      for(const t of 这一类){
        /* 地址取不到 = 图标那一层这一趟没认到那张文件（被删了、外置盘没插、后缀不认）。
           这一行照摆，但名字后面写明白 —— 别让人以为挑得动。 */
        const seen = !!imgUrl(t);
        const useSel = h('select', { class:'fd-input', style:'width:auto', title:'这张图改成按哪一类用' },
          IMG_USES.map(x => h('option', { value:x.k, selected:x.k === t.用途 }, x.k)));
        useSel.onchange = () => {
          if(ImgLib.setUse(t.名字, useSel.value)) toast('「' + t.名字 + '」改成当 ' + useSel.value + ' 用');
          else toast('这一张没改成：图库里认不到它', true);
          draw(); if(after) after();
        };
        const 取 = h('button', { class:'fd-btn mini', type:'button',
          title:'把这张图的主要颜色取出来进色卡（图上一个字都不改）',
          onclick:async () => {
            取.disabled = true;
            const b = await ImgLib.blob(t.名字);
            if(!b){ 取.disabled = false; toast('这张图这一趟取不到原图，取不了色', true); return; }
            try{
              const hexes = await ImageTheme.colors(b, 8);
              if(!hexes.length) toast('这张图里没有可取的颜色', true);
              else{
                const 进色卡 = CardPool.addAll(hexes, 'image');
                toast('从「' + t.名字 + '」取到 ' + hexes.length + ' 个色 · 进色卡 ' + 进色卡 + ' 个'
                  + (进色卡 ? '' : '（这些色色卡里已经有了）') + 池尾());
                if(after) after();
              }
            }catch(e){ toast('取不了：' + ((e && e.message) || e), true); }
            取.disabled = false;
          }}, '取色进色卡');
        const 划 = h('button', { class:'fd-btn mini', type:'button', title:'把这一张从图库清单里划掉（那张图本身不删）',
          onclick:async () => {
            if(!await fdAsk('把图库里的「' + t.名字 + '」划掉？清单上这一段没了，背景、纹理那两排里也就挑不到它；'
              + '那张图本身还留在 数据\\images\\ 不动，想再收进清单重新导一次就行。', '划掉')) return;
            const r = ImgLib.remove(t.名字);
            if(!r.ok){ toast(r.msg, true); return; }
            /* 正在用的那一套挑的就是这一张：当场重铺一遍，让它立刻退回不铺，而不是等下一次换方案才发现 */
            Theme.apply(); Bus.emit('theme');
            try{ Shell.refreshSoon(); }catch(e){}
            draw(); if(after) after();
            toast('已把「' + t.名字 + '」从图库划掉，图还留着');
          }}, '划掉');
        const 图 = h('div', { class:'fd-img' + (u.k.indexOf('纹理') === 0 ? ' fd-img-tile' : '') + (seen ? '' : ' fd-img-miss') });
        if(seen) 图.style.backgroundImage = 'url("' + imgUrl(t) + '")';
        grid.appendChild(h('div', { class:'fd-imgcell' }, [
          图,
          h('div', { class:'fd-imgname', title:t.名字 + '　' + t.文件 + (seen ? '' : '　· 这一趟没认到那张文件') },
            t.名字 + (seen ? '' : ' · 没认到文件')),
          useSel, h('div', { class:'fd-row', style:'gap:4px' }, [取, 划])]));
      }
      box.appendChild(grid);
    }
  };
  draw();
  return box;
}
/* ---------- 随包那 6 张内置纹理收进图片库（开机那一步也走这一颗，界面那颗按钮同一份代码）----------
   「嵌入」= 开机就在图库里，不是摆一颗按钮等人去点（作者 2026-10-08 的话）。认名字收过没有：
   库里已经有同名那张的跳过，他删掉的下一趟不硬塞回来（只认 名字，不认字节）。 */
async function 内置纹理收(){
  const 待 = MATERIAL_TEXTURES.filter(t => !ImgLib.find(t.名字));
  const 坏 = [];
  let 收 = 0;
  for(const t of 待){
    let buf = null;
    try{
      const r = await fetch(MATERIAL_DIR + encodeURIComponent(t.文件));
      if(r.ok) buf = new Uint8Array(await r.arrayBuffer());
    }catch(e){}
    if(!buf){ 坏.push(t.名字); continue; }
    const got = await imgAccept({ name:t.文件, arrayBuffer:async () => buf.buffer }, t.名字, '纹理·四方连续图', t.作者);
    if(got && got.ok) 收++; else 坏.push(t.名字);
  }
  return { 收, 坏, 待:待.length };
}
/* 某一类还没有图时各说各的那一句：挑图那一头空着的时候，得告诉他去哪儿添 */
function imgEmptyWord(use){
  if(use === '背景图') return '还没有按背景图收的图 —— 上面那颗「按背景图导入」收一张，「方案编辑」那一页的背景图那一排才挑得出。';
  if(use === '取色素材') return '还没有按取色素材收的图 —— 上面那颗「按取色素材导入」收一张，取到的色进色卡，这张图本身不铺到屏幕上。';
  return '还没有当纹理用的图 —— 上面那颗「按纹理 / 四方连续图导入」收一张无缝小图，「方案编辑」那一页的纹理那一排才挑得出。';
}
/* ---------- 外观这一档（#292 重做）----------
   第 10 条：散着的那几样控件不留 —— 从前这一屏顶上是配色那一摊，底下另摆着卡片质感、字体、两档圆角，
   改完就各存各的，攒不出「一套样子」。现在这一屏只有一条线：
     · 顶上挑一套方案（数据\looks.yaml 里的段名），挑中即整套生效；
     · 底下就是这一套方案的详细设置，改哪一处都只改这一套；
     · 改动先就地看着生效，写不写进文件要问一句：覆盖当前这套 / 另存为一套新方案 / 撤销。
   颜色那一摊（新建一套、改色号、从图取色）留在下面：那是色卡，改完直接进 palettes.yaml / cards.yaml，不问。
   背景、卡片间距也不在方案里：那是桌面本身的样子，换方案不该把壁纸换掉。 */
/* ---------- 横向次级标签（外29 第 56 轮 · 作者的话：「外观加上横向的次级标签页」） ----------
   做法照上面 openSettings 那一列竖标签同一套（role=tablist、每一项 role=tab + aria-selected、
   选中那一项 tabindex=0 其余 -1、左右键在档之间走），不另起机制；只多两样：
     · 方向是横的（aria-orientation:horizontal，左右键为主）；
     · 某一档可以先「锁着」—— 摆出来是灰的、点不动（方案编辑那一页在选中一套方案之前不许进），
       锁着的档不进左右键的走位，也不许用 go() 跳进去。
   pages = [{ name, build() → 节点 }]，内容每次切到那一档才建（和竖标签一样，切档时其余档不建）。 */
function subTabs(pages, start){
  const bar = h('div', { class:'fd-sub-tabs', role:'tablist', 'aria-orientation':'horizontal' });
  const pane = h('div', { class:'fd-sub-pane', role:'tabpanel' });
  const btns = {}, locked = new Set();
  let cur = '';
  const paint = () => {
    for(const p of pages){
      const b = btns[p.name], on = p.name === cur;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
      b.setAttribute('tabindex', on ? '0' : '-1');
    }
    pane.setAttribute('aria-labelledby', 'fd-sub-' + cur);
  };
  const st = {
    cur:() => cur,
    isLocked:n => locked.has(n),
    /* 锁上 / 放开某一档；锁的正好是当前这一档时，退回第一个没锁的档（不许把人关在一页里出不来） */
    lock(n, on){
      if(on){ locked.add(n); btns[n].disabled = true; btns[n].classList.add('off'); if(cur === n) st.goFirst(); }
      else { locked.delete(n); btns[n].disabled = false; btns[n].classList.remove('off'); }
      return st;
    },
    go(n){ if(locked.has(n) || n === cur) return false; const p = pages.find(x => x.name === n); if(!p) return false;
      cur = n; paint(); pane.replaceChildren(p.build()); pane.scrollTop = 0; return true; },
    goFirst(){ for(const p of pages) if(!locked.has(p.name)) return st.go(p.name); return false; },
    redraw(){ if(cur){ const p = pages.find(x => x.name === cur); if(p){ pane.replaceChildren(p.build()); pane.scrollTop = 0; } } },
    bar, pane
  };
  pages.forEach(p => { btns[p.name] = h('button', { class:'fd-sub-tab', id:'fd-sub-' + p.name, role:'tab',
    'aria-selected':'false', tabindex:'-1', 'aria-controls':'fd-sub-pane', onclick:() => st.go(p.name) }, p.name);
    bar.appendChild(btns[p.name]); });
  pane.id = 'fd-sub-pane';
  bar.addEventListener('keydown', e => {
    const open = pages.filter(p => !locked.has(p.name));
    const i = open.findIndex(p => p.name === cur);
    const k = e.key;
    let n = k === 'Home' ? 0 : k === 'End' ? open.length - 1
      : k === 'ArrowRight' || k === 'ArrowDown' ? (i + 1) % open.length
      : k === 'ArrowLeft' || k === 'ArrowUp' ? (i - 1 + open.length) % open.length : -1;
    if(n < 0) return;
    e.preventDefault(); st.go(open[n].name); btns[open[n].name].focus();
  });
  st.go(start || (pages[0] || {}).name);
  return st;
}
/* ---------- 按语言钉字体（外29 丁组 · 第 3 页「方案编辑」里那一摊） ----------
   两个联动的下拉：左边挑语言（中文简体第一、中文繁体第二、英语第三、其余按英文名字母排），
   右边挑这一档语言用哪个字体（清单就是 Fonts 那一份本地字体，带语言小点和分类）。
   下面逐档列出已经钉上的，每一档一枚「撤掉」；「一键统一」把还没钉的档全填成当前选中的那一个。
   存法：方案里 按语言 那一栏（fd3-lib.js 的 ffLangText），生效走 Fonts.langStack —— 一条 @font-face
   用 src:local(字体名) + 这一档自己的 unicode-range，共用一个假名，浏览器按字落在哪一段自己挑。 */
function langFontRow(draft, set, redraw){
  const langs = Fonts.langs();
  let pick = langs[0].k;
  const mapOf = () => Object.assign({}, draft.按语言 || {});
  const selLang = h('select', { class:'fd-input', style:'width:auto' },
    langs.map(l => h('option', { value:l.k, selected:l.k === pick }, l.name)));
  const names = () => Fonts.all().map(x => x.f);
  const selFont = h('select', { class:'fd-input', style:'max-width:260px' }, [h('option', { value:'' }, '（跟随全局字体）')].concat(
    names().map(f => h('option', { value:f }, f))));
  const sync = () => { selFont.value = (mapOf()[pick] || ''); };
  selLang.onchange = () => { pick = selLang.value; sync(); };
  const applyBtn = h('button', { class:'fd-btn mini', onclick:() => {
    const m = mapOf(); const v = selFont.value;
    if(v) m[pick] = v; else delete m[pick];
    set('按语言', m); sync(); redraw();
  }}, '钉这一档');
  const unifyBtn = h('button', { class:'fd-btn mini', title:'把清单上每一档语言都钉成右边这一个（已经钉过的也一起换掉）', onclick:() => {
    const v = selFont.value;
    if(!v){ toast('先选一个字体，再一键统一', true); return; }
    const m = {}; for(const l of langs) m[l.k] = v;
    set('按语言', m); redraw(); toast('已把 ' + langs.length + ' 档语言统一成「' + v + '」');
  }}, '一键统一');
  const clearBtn = h('button', { class:'fd-btn mini', onclick:() => { set('按语言', {}); redraw(); toast('按语言那几档全撤了，回到跟随全局字体'); } }, '全撤');
  const list = h('div', { class:'fd-hint' });
  const drawList = () => {
    list.innerHTML = '';
    const m = mapOf(); const on = langs.filter(l => m[l.k]);
    if(!on.length){ list.textContent = '现在没按语言钉任何一档，界面走的是下面那个全局字体。'; return; }
    on.forEach(l => list.appendChild(h('span', { class:'fd-row', style:'gap:6px;margin-right:12px' }, [
      h('b', {}, l.name), h('span', {}, m[l.k]),
      h('button', { class:'fd-btn mini', onclick:() => { const x = mapOf(); delete x[l.k]; set('按语言', x); redraw(); } }, '撤掉')
    ])));
  };
  sync(); drawList();
  return h('div', { style:'display:grid;gap:8px' }, [
    h('div', { class:'fd-row' }, [selLang, selFont, applyBtn, unifyBtn, clearBtn]), list]);
}
/* ---------- 第 4 页「方案资源 · 字体」：下拉列表挑一个，下面那一行管信息 / 收藏 / 屏蔽 ----------
   作者的话（2026-10-08）：「字体不要平铺，也别分类了，你分得乱七八糟都不对 / 改成下拉列表，
   收藏和常用还在前边，其他排序，中文字体在前、外语字体在后，按名字升序排列」。
   顺序不用重新算：Fonts.all() 那一份本来就是 收藏 → 常用（按用过次数）→ 其余（中文字体在前、再按名字升序），
   这一屏只是把它收进一枚下拉，并把「宋体 / 楷体 / 艺术字」那一套小标题撤掉（那是我自己编的归类，他判了不对）。
   被屏蔽的字体不在这份名单里，所以下面单摆一截，那一截上才有「取消屏蔽」。 */
function fontLibSection(redraw){
  const box = h('div', { style:'display:grid;gap:10px' });
  const info = f => Modal.open('字体信息 · ' + f,
    h('div', { style:'display:grid;gap:6px;min-width:min(420px,80vw)' },
      Fonts.info(f).map(([k, v]) => h('div', { class:'fd-row' }, [
        h('span', { class:'fd-hint', style:'min-width:6em' }, k), h('span', {}, v)]))),
    [h('button', { class:'fd-btn primary', onclick:() => Modal.close() }, '关掉')]);
  const sel = h('select', { class:'fd-input', title:'挑一个本地字体（收藏和常用排在最前，其余中文字体在前、外语字体在后，都按名字升序）' });
  const act = h('div', { class:'fd-row', style:'gap:8px' });
  const hidBox = h('div', { class:'fd-row', style:'gap:8px;flex-wrap:wrap' });
  let 选 = '';
  /* 一截一个 optgroup：空的那截不挂，免得下拉里出现光秃秃的标题 */
  const grp = (lab, list) => {
    if(!list.length) return null;
    const g = h('optgroup', { label:lab + '（' + list.length + '）' });
    for(const it of list) g.appendChild(h('option', { value:it.f }, it.f));
    return g;
  };
  const 摆动作 = () => {
    act.innerHTML = '';
    const f = 选;
    if(!f){ act.appendChild(h('span', { class:'fd-hint' }, '挑一个字体，下面这几样才动得了')); return; }
    act.appendChild(Fonts.chip(f));
    act.appendChild(h('span', { style:'flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', title:f }, f));
    act.appendChild(h('button', { class:'fd-btn mini', onclick:() => info(f) }, '信息'));
    const 藏 = Fonts.pinned.includes(f);
    act.appendChild(h('button', { class:'fd-btn mini',
      title:藏 ? '不再收藏（它就从下拉最前面那一截下去）' : '收进收藏（最多 ' + FF_PIN_MAX + ' 个，收藏的排在名单最前）',
      onclick:() => { 藏 ? Fonts.unpin(f) : Fonts.pin(f); 画(); } }, 藏 ? '取消收藏' : '收藏'));
    if(藏){
      const i = Fonts.pinned.indexOf(f), last = Fonts.pinned.length - 1;
      act.appendChild(h('button', { class:'fd-btn mini', disabled:i <= 0, title:'在收藏里往上挪一个（越靠前越先在名单顶上）',
        onclick:() => { const a = Fonts.pinned.slice(); a.splice(i - 1, 0, a.splice(i, 1)[0]); Fonts.order(a); 画(); } }, '往上'));
      act.appendChild(h('button', { class:'fd-btn mini', disabled:i >= last, title:'在收藏里往下挪一个',
        onclick:() => { const a = Fonts.pinned.slice(); a.splice(i + 1, 0, a.splice(i, 1)[0]); Fonts.order(a); 画(); } }, '往下'));
    }
    act.appendChild(h('button', { class:'fd-btn mini', title:'屏蔽这一个（下拉里不再摆它，本地那份字体文件一个字节都不碰）',
      onclick:() => { Fonts.hide(f); 选 = ''; 画(); } }, '屏蔽'));
  };
  const 摆屏蔽 = () => {
    hidBox.innerHTML = '';
    const hid = Fonts.hidden || [];
    if(!hid.length) return;
    hidBox.appendChild(h('span', { class:'fd-hint' }, '已屏蔽 ' + hid.length + ' 个：'));
    for(const f of hid) hidBox.appendChild(h('span', { class:'fd-row', style:'gap:4px' }, [
      h('span', { style:'max-width:16em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', title:f }, f),
      h('button', { class:'fd-btn mini', onclick:() => info(f) }, '信息'),
      h('button', { class:'fd-btn mini', onclick:() => { Fonts.unhide(f); 画(); if(redraw) redraw(); } }, '取消屏蔽')]));
  };
  const 画 = () => {
    /* 常用那一截是 Fonts.all() 按用过次数给的，屏蔽那一步没管到它（从前这一屏根本不摆常用，所以没人碰过）；
       屏蔽的意思就是名单里不摆它，这一屏自己把它滤掉 */
    const all = Fonts.all().filter(it => it.g !== 'use' || !Fonts.isHidden(it.f));
    /* 中文 / 外语这一刀就用 Fonts 那一份现成的判断：名字里有汉字、或者点过「中」那个点的，都算中文字体 */
    const 中文 = f => Fonts.cnRank(f) < 2;
    if(!all.some(it => it.f === 选)) 选 = '';
    sel.innerHTML = '';
    sel.appendChild(h('option', { value:'' }, all.length ? '（挑一个字体）' : '这一趟没读到本地字体 —— 读字体那一步要在 Flow-Desk.exe 里才走得到'));
    for(const g of [grp('收藏', all.filter(it => it.g === 'pin')), grp('常用', all.filter(it => it.g === 'use')),
      grp('中文字体', all.filter(it => it.g === 'all' && 中文(it.f))),
      grp('外语字体', all.filter(it => it.g === 'all' && !中文(it.f)))])
      if(g) sel.appendChild(g);
    sel.value = 选;
    摆动作(); 摆屏蔽();
  };
  sel.addEventListener('change', () => { 选 = sel.value; 摆动作(); });
  box.appendChild(sel);
  box.appendChild(act);
  box.appendChild(hidBox);
  Fonts.hooks.add(画); 画();
  return box;
}
function tabLook(){
  const box = h('div', { style:'display:grid;gap:14px' });
  let draft = null, base = null, dirty = false;
  const bar = h('div', { class:'fd-row' });
  /* ---------- 外观这一屏按七组分重排（2026-10-05）----------
     明暗 / 方案 / 卡面 / 纹理 / 背景 / 渐变 / 颜色，每组一行分区小标题。
     归属按「它改的是什么」来分：改卡片的进卡面，改背景的进背景，改配色来源的进那一组；
     字体是方案自己那一栏、又不专改哪一层，留在方案组。
     小标题走现成的 fd-hint 那一档字：不加边框、不包卡片、不做折叠。
     最后那一组叫「色卡」，外29 丁组把它整组搬进第 4 页「方案资源」当头一块（作者那一页的原话：
     「管理所有的颜色（色卡）、图片、字体」）。名字照他那一句写，不在小标题上另起一个说法。 */
  const group = name => { const head = h('div', { class:'fd-hint' }, name);
    const body = h('div', { style:'display:grid;gap:14px' });
    return { head, body, wrap: h('div', { style:'display:grid;gap:14px' }, [head, body]) }; };
  const gMing = group('明暗'), gLook = group('方案'), gCard = group('卡面'),
        gTex = group('纹理'), gWall = group('背景'), gGrad = group('渐变'), gPal = group('色卡');
  /* 原先那一整块「详细设置」(detail) 按七组拆开：这四截是各组的落点，
     drawDetail 每次清空这四截再按组挂回去 —— 和从前清空 detail 是同一个做法，只是宿主变成四个 */
  const dScheme = h('div', { style:'display:grid;gap:14px' });   /* 方案组那一截：字体 */
  const dCard = h('div', { style:'display:grid;gap:14px' });     /* 卡面组那一截：外观模式 + 两档圆角 */
  const dTex = h('div', { style:'display:grid;gap:14px' });      /* 纹理组那一截：纹理 + 它那张铺几格（强度那一根 2026-10-08 撤了） */
  const dPal = h('div', { style:'display:grid;gap:14px' });      /* 色卡组那一截：配色下拉 + 随机换一套 + 这一套选中的那几个颜色 */
  /* paletteLib 交回来的那一截（这一套方案选中的颜色：配色名 / 基调 / 色号 / 预览）。
     它是「方案资源」那一页建好递出来的，drawDetail 每回清空 dPal 之后挂回「配色」那一行下面 ——
     先声明成空，是因为 drawDetail 在这一截建出来之前就可能被叫到。 */
  let palEdit = null;
  /* 纹理组里那一档格位只在挑上纹理时在场；方案没认下来时这一截整个空着 ——
     空组不该顶着一行小标题摆假门面（不成立的东西不渲染），所以每回重画完对着数一遍 */
  const syncTexHead = () => { gTex.head.style.display = dTex.children.length ? '' : 'none'; };

  const start = s => { base = Object.assign({}, s); draft = Object.assign({}, s); dirty = false; };
  /* ---------- 生效：草稿写进 Theme.cfg 重新上色，文件一个字节都不碰 ----------
     full 才重排桌面（换配色、换字体要重画卡片）；拖滑杆那一路只重算变量，不然一拖一卡。 */
  const applyNow = full => {
    if(!draft) return;
    LookLib.apply(draft, full ? null : { noRender:true });
    drawBar();
  };
  const set = (k, v, full) => {
    if(!draft) return;
    /* 纹理那一档界面上写的是中文名（文件里也是中文名），样式表认的是内部那个 key：跟着换一次 */
    if(k === '纹理') draft.texKey = (lookTexByName(v) || {}).k || '';
    draft[k] = v; dirty = true; applyNow(full !== false);
  };
  /* ---------- 还没落文件的那一笔：换方案、关面板都可能撞上，问一句再走 ---------- */
  const askUnsaved = after => {
    Modal.open('这套方案的改动还没存',
      h('div', { style:'display:grid;gap:10px' }, [
        h('div', {}, '「' + LookLib.cur + '」被改过。改动已经在屏幕上看着变了，还没存进这套方案 —— 先说这一笔怎么留，再往下走。'),
        h('div', { class:'fd-hint' }, '丢掉这一笔 = 文件里那一条原样不动；另存 = 攒一条新的，原来那条不受影响。')]),
      [h('button', { class:'fd-btn', onclick:() => {
        Modal.close(); LookLib.apply(base); start(base); drawScheme(); drawDetail(); if(after) after();
      }}, '丢掉这处改动'),
       h('button', { class:'fd-btn', onclick:() => { Modal.close(); saveAsDlg(after); } }, '另存为一套新方案'),
       h('button', { class:'fd-btn primary', onclick:() => {
         Modal.close(); LookLib.overwrite().then(() => { start(LookLib.get() || draft); if(after) after(); });
       }}, '覆盖当前这套')]);
  };
  /* 挂给设置面板那一层：关这一屏之前先过这一句（走查 AA-6 说的「关面板也不问」就是这里）。
     这一档建一回挂一回，挂的是当前这一份 dirty 的判定，面板关掉也不会留个假的在下边。 */
  Unsaved.ask = next => { if(dirty) askUnsaved(next); else next(); };
  const saveAsDlg = after => {
    const nm = h('input', { class:'fd-input', style:'max-width:280px', value:LookLib.uniqueName((draft && draft.方案名 ? draft.方案名.replace(/ \d+$/, '') : '新方案') + ' 2') });
    Modal.open('另存为一套新方案', h('div', { style:'display:grid;gap:10px' }, [row('方案名', nm),
      h('div', { class:'fd-hint' }, '存的就是屏幕上正在用的这一套：配色、外观模式、纹理、字体、两档圆角。')]),
      [h('button', { class:'fd-btn', onclick:() => Modal.close() }, '取消'),
       h('button', { class:'fd-btn primary', onclick:() => {
         const clean = LookLib.uniqueName((nm.value || '').trim() || '新方案');
         LookLib.saveAs(clean).then(() => { Modal.close(); start(LookLib.get()); dirty = false;
           drawScheme(); drawDetail(); toast('已另存为「' + clean + '」'); if(after) after(); });
       }}, '存好并选用')]);
  };
  const switchScheme = name => {
    const go = () => { LookLib.pick(name); start(LookLib.get() || LookLib.snapshot(name)); drawScheme(); drawDetail(); };
    /* 取消切换那一条：下拉那一眼看见的还是原来那一套（名单由 LookLib.cur 现读，没切就不变），
       再重画一遍把这一格从「他刚点的那一个名字」收回成现在真正在用的那一个 */
    const 退回 = () => schemeSel.draw();
    const 先问 = () => marksGuard(name, go, 退回);
    if(dirty) askUnsaved(先问); else 先问();
  };
  /* ---------- 明暗那一轴（外13-M）：三档模式摆在这一屏最上面 ----------
     用现成的分段控件（segCtrl），和这一屏其余几档同一个形状，不另起机制。
     这条轴一改动两件事：配色和外观方案的名单都换成新那一池的（不摆另一池的名字，
     也不灰着留在那儿让人点不动 —— 项目规矩：不支持的组合不渲染），
     正用的那套配色如果不归新的那一池，就近换一套并在这儿说清换了什么。 */
  const mingBox = h('div', { style:'display:grid;gap:14px;border-bottom:var(--hair);padding-bottom:12px' });
  const timeInp = (val, onSet) => h('input', { class:'fd-input', type:'time', step:'60', value:val, style:'width:auto',
    onchange:e => { if(!onSet(e.target.value)){ toast('那一刻认不得，还是照原来的写法'); e.target.value = val; return; } drawMing(); } });
  /* 色卡名单跟着轴重画：两只下拉 + 轴那一行的小字都算 */
  const redrawPools = () => {
    drawMing();
    /* 轴一换，正用的那套方案 配色 那一栏可能被这条轴就近改了口（跨池换色 / 方案对齐那两趟）：
       没有还没落文件的改动时草稿跟着重认一遍，不然下拉摆的还是上一池那个名字 */
    if(!dirty && LookLib.ready){ const s = LookLib.get(); if(s) start(s); }
    drawScheme(); drawDetail(); palSel.draw();
  };
  const drawMing = () => {
    mingBox.innerHTML = '';
    mingBox.appendChild(row('明暗模式', segCtrl(MING_MODES.map(x => ({ v:x.k, t:x.name })),
      () => Ming.mode(), v => { Ming.setMode(v); redrawPools(); drawDetail(); })));
    if(Ming.mode() === 'manual')
      mingBox.appendChild(row('这一轴定为', segCtrl([{ v:'light', t:'明亮' }, { v:'dark', t:'黑暗' }],
        () => Ming.pick(), v => { Ming.setPick(v); redrawPools(); drawDetail(); })));
    if(Ming.mode() === 'time'){
      mingBox.appendChild(row('转明亮的时刻', timeInp(Ming.lightAt(), v => Ming.setTime('mingLightAt', v))));
      mingBox.appendChild(row('转黑暗的时刻', timeInp(Ming.darkAt(), v => Ming.setTime('mingDarkAt', v))));
      const eq = Ming.lightAt() === Ming.darkAt();
      mingBox.appendChild(h('div', { class:'fd-hint' }, eq
        ? '两个时刻现在是一样的，这样一天里没有可切的缺口，这一档整天不会换轴（界面停在当前这一轴上）。想让它们错开就改任意一个。'
        : '一天切两段：从「转明亮的时刻」起到「转黑暗的时刻」止是明亮，其余是黑暗；'
          + (mingMinutes(Ming.lightAt()) > mingMinutes(Ming.darkAt()) ? '现在这两个时刻是跨着午夜写的（明亮那一段跨过 00:00），照这样算就对。' : '')
          + '到点就换，不需要一直盯着表；机器睡了一觉醒来也会立刻重认一次。'));
      mingBox.appendChild(h('div', { class:'fd-hint' }, '这一档按的是你写的这两个钟点，不算日出日落 —— 没有经纬度那套东西，写的就是几点切。'));
    }
    if(Ming.mode() === 'auto' && !Ming.sys)
      mingBox.appendChild(h('div', { class:'fd-hint' }, '跟随系统这一档要问系统此刻是深还是浅，这一回没问到（不在 Flow-Desk.exe 里开就是正常的），先照上一回那一轴走。'));
    mingBox.appendChild(h('div', { class:'fd-hint' },
      '此刻：' + (MING_NAME[Ming.axis] || '还没定') + '（' + (Ming.why || '刚开机') + '）· '
      + '明亮池 ' + Ming.poolCount('light') + ' 套 / 黑暗池 ' + Ming.poolCount('dark') + ' 套 · 当前这一池摆出来 '
      + Ming.poolCount() + ' 套、外观方案 ' + Ming.lookPoolList().length + ' 套。'
      + '随机换一套也只在本池里抽。'));
    if(Ming.note) mingBox.appendChild(h('div', { class:'fd-hint' }, [
      h('span', {}, Ming.note),
      h('button', { class:'fd-btn mini', style:'margin-left:8px', onclick:() => { Ming.note = ''; drawMing(); } }, '知道了')    ]));
  }
  /* 方案下拉：名字 + 它那套配色的色点，右边小标签写着外观模式，一眼挑得出。
     名单按当前那一池筛（外13-M）：方案的明暗归属现算它 配色 那一栏指着的那套配色，
     looks.yaml 的字段结构不动。 */
  const schemeSel = dotSel(
    () => Ming.lookPoolList().map(s => ({ k:s.方案名, name:s.方案名, pal:Palette.items.find(x => x.name === s.配色) || null,
      tag:(s.分组 ? s.分组 + ' · ' : '') + s.外观模式 })),
    () => LookLib.cur, switchScheme);
  /* 配色下拉：挑的就是这一套方案 配色 那一栏（色卡里的段名）。同样只摆本池那几套。 */
  const palSel = dotSel(
    () => Ming.pool().map(e => ({ k:e.name, name:e.name, pal:e, tag:PAL_SRC[e.source] || '自建' })),
    () => draft ? draft.配色 : '', name => {
      const e = Palette.items.find(x => x.name === name);
      if(!e) return;
      set('配色', name); palSel.draw();
    });
  /* 随机换一套：只从当前这一池里抽，抽不到本池以外的（外13-M 那条「自动也只在本池」）。
     以前没有这一个按钮，是这条轴第一次要求「随机」这个动作，就摆在这儿。 */
  const rndBtn = h('button', { class:'fd-btn mini', title:'在当前这一池里随机挑一套配色（挑完还要问一句存不存进方案）',
    onclick:() => {
      const cur = draft ? draft.配色 : '';
      const list = Ming.pool().filter(e => e.name !== cur);
      if(!list.length){ toast(MING_NAME[Ming.axis] || '当前这一池' + '里就这一套（或者一套也没有），没有可随机换的'); return; }
      const e = list[Math.floor(Math.random() * list.length)];
      set('配色', e.name); palSel.draw(); drawMing();
      toast('随机换到「' + e.name + '」（' + MING_NAME[Ming.axis] + '池内 ' + list.length + ' 套里抽的）');
    }}, '随机换一套');

  /* 「方案设定」那一页顶上的方案名 / 分组两格，要跟着上面挑中的那一套走（外34 图4·5）。
     这两格是建页时一次性摆出来的，从前建完就没人再写它 —— 下拉换了方案，格子里还写着上一套的名字。
     真正的赋值在底下那两格建好之后（见 刷方案名 = ），这里先占一个空位。 */
  let 刷方案名 = () => {};
  const drawScheme = () => { schemeSel.draw(); 刷方案名(); };
  /* ---------- 这一套方案的详细设置 ----------
     行还是那几行、每行还是原写法，只是各按七组挂到 dScheme / dCard / dTex / dPal 四截里，
     和主屏的分组顺序同一套排法，不搞两屏两套。 */
  const drawDetail = () => {
    dScheme.innerHTML = ''; dCard.innerHTML = ''; dTex.innerHTML = ''; dPal.innerHTML = '';
    if(!LookLib.ready || !draft){
      dScheme.appendChild(h('div', { class:'fd-hint' }, '外观方案这一趟没认下来（数据目录那一份读不到），先按屏幕上正在用的这一套跑。'));
      syncTexHead(); drawBar(); return;
    }
    /* 配色这只下拉画的是草稿里那一栏：每次重画详细设置都跟着走一遍，不然换了方案它还写着上一套 */
    palSel.draw();
    /* 配色改的是这套方案的配色来源（挑色卡里哪一套），按「改配色来源的进色卡」归进那一组。
       删除这一枚跟着这只下拉摆（外34 图14·15：「配色的删除按钮就该跟着配色列表走」）——
       删的是下拉里挑中的那一套，不是屏幕上正在用的那一套。 */
    const palDel = h('button', { class:'fd-btn mini', title:'把上面那只下拉挑中的这一套配色从配色那一档里删掉（指着它的方案会改挑同一明暗池里最近的一套）',
      onclick:() => 删配色(Palette.items.find(x => x.name === (draft ? draft.配色 : '')) || Palette.cur,
        () => { Palette.save(); Theme.apply(); Shell.render(); palSel.draw(); drawDetail(); drawMing(); }) }, '删除这一套');
    dPal.appendChild(row('配色', h('div', { class:'fd-row' }, [palSel.wrap, rndBtn, palDel])));
    /* 「这一套方案选中的颜色」那一截紧跟着挂上来（作者 2026-10-09：「方案编辑就会展示用户给这个方案选择的颜色」）：
       它是「方案资源」那一页的 paletteLib 递出来的，同一份 DOM，挂哪儿都只有一份。 */
    if(palEdit) dPal.appendChild(palEdit);
    /* 材质那一行整行撤了（2026-10-04）：卡片底只有实色这一档，没有可挑的第二个值，
       摆一行只有一个选项的分段选择是给不出「换一档」这件事的。
       「真液态对比」那个开关跟着一起撤 —— 背后画面本来就不透，比无可比。 */
    /* 外观模式管的是边框、阴影、边界线、发光 —— 改的是卡片这一张面，归卡面组 */
    dCard.appendChild(row('外观模式', segCtrl(LOOK_MODES.map(x => ({ v:x.name, t:x.name })), () => draft.外观模式,
      v => { set('外观模式', v); drawDetail(); })));
    /* 挑完纹理要把「这张图怎么用」和「一张占几 × 几格」那两档当场跟上来（挑回「不选」就当场收掉）：
       这两行都是按 纹理 那一条决定在不在场的，所以这里也要像外观模式那样重画一次详细设置。
       名单直接来自图片库（ImgLib.byUse('纹理·四方连续图')），界面上不再抄一份名字表。 */
    /* 纹理 / 四方连续图：从图片库里 用途 写着那一种的那些里挑，可以不选（作者的话：「在已导入的图中选择，可不选」）。
       导入不在这一页 —— 收图、划掉图都归「方案资源」那一页，这一页只管用哪一张（四页的分工）。
       库里那些图这一趟读不回来的不摆：摆一条挑上什么都不铺的假选项是骗人。 */
    const texSel = h('select', { class:'fd-input', style:'max-width:280px' },
      [h('option', { value:'', selected:!draft.纹理 || draft.纹理 === '无' }, '不选')].concat(
        ImgLib.byUse('纹理·四方连续图').filter(t => !!imgUrl(t)).map(t => h('option', { value:t.名字,
          selected:t.名字 === draft.纹理 }, t.名字))));
    texSel.onchange = () => {
      const v = texSel.value;
      if(v && !imgUrl(ImgLib.find(v))){ toast('那张图这一趟没读回来，纹理先按「不选」', true); set('纹理', '无'); drawDetail(); return; }
      set('纹理', v || '无'); drawDetail();
    };
    dTex.appendChild(row('纹理 / 四方连续图', h('div', { class:'fd-row' }, [texSel,
      h('span', { class:'fd-hint' }, '铺在 Flow-Desk 的背景、卡片面、展开后的插件卡面上')])));
    /* 去色 / 直接使用：同一张图两种用法（作者点的这两档）。摆在挑中图之后才出现 —— 没图就没有「怎么用」这回事。 */
    if(draft.纹理 && draft.纹理 !== '无'){
      dTex.appendChild(row('这张图怎么用', segCtrl(LOOK_TEX_WAYS.map(x => ({ v:x, t:x })),
        () => lookTexWay(draft.纹理用法), v => { set('纹理用法', v); drawDetail(); })));
      dTex.appendChild(h('div', { class:'fd-hint' }, draft.纹理用法 === '去色'
        ? '去色：这张图只剩下纹路和明暗，颜色由这一套配色供（灰纹留四成五，底下的色透上来）。'
        : '直接使用：原图进，图是什么色就铺什么色。'));
    }
    /* 强度那一根滑杆整串撤了（2026-10-08 作者的话：删除纹理强度系列设置）：图上不再叠透明度，原图进。
       挑上纹理之后只剩「一张占几 × 几格」这一档（下面那一条 cellRow），铺多大是要的，铺多清楚不再给调。 */
    if(draft.纹理 && draft.纹理 !== '无'){
      /* 作者说的那一个「密度」就是这一档：最小几个格位铺一张（真身见上面 cellRow）。
         正方形那张图最小这一档 = 1×1 = 首页一个格子，往上 2×2、3×3、4×4……放大到铺满整屏为止；
         长方形那张按它自己的比例定最小那一档。这一行只在挑上了纹理时出现，没挑纹理就没有格位这回事。
         格位落在机器存档（它管的是屏幕上这一块怎么铺），纹理本身跟着方案走 —— 所以这里画完要重画详细设置。
         这一档改的是纹路怎么铺，跟着纹理归纹理组，不归背景。 */
      const u = Look.url(draft.texKey || draft.纹理);
      if(u) cellRow('tex', u, dTex, () => { drawDetail(); });
    }
    /* 字体是方案自己那一栏、又不专改卡片或背景哪一层，按「跟着方案走」留在方案组 */
    dScheme.appendChild(row('按语言钉字体', langFontRow(draft, (k, v) => set(k, v), () => { drawDetail(); })));
    /* 全局字重（外31 二组 · 作者的话：「应当根据字体可以选择不同的字重」）：
       摆出来的就是主进程从系统那张字体表里读到的、这一个字体家底下真有的那几张脸（2026-10-08 改的口：
       「明明各种字重我本地都有，链接一下就行了」「你现在就换」—— 不再从字体名字尾巴猜）。
       没读到本地清单时只摆「标准」这一档 —— 认不出来的档不摆假选择。
       挑「标准」写的是空（跟默认同一个数 400，文件里不留一行多余的字）。
       这一档只管界面上没自己写粗细的文字；标题、选中态那些本来就写了要粗一档的，
       会跟着往这一家底下那一张更粗的真脸上挑（只有一张脸的字体不留这一句 —— 那儿没得挑，样式表里照旧）。
       换字体之后这一行跟着重画（只重画这一行，不整页重画，省得把旁边展开的选字体那一摊顶掉）。 */
    const wWrap = h('div', {});
    const wDraw = () => {
      wWrap.innerHTML = '';
      const 家 = Fonts.nowFamily({ font:draft.字体 });
      const 档 = Fonts.weightsOf(家);
      /* 系统那张表里认没认到这一家，得说一句：附加文件夹里挂上来的、手输的名字，表里都没有，
         那一种情况下摆出来的「标准 400」是本家那一张脸，不是读回来的 */
      const 读到了 = !!Fonts.wmap[家];
      const 现 = String(draft.字重 || '');
      const 排 = h('div', { class:'fd-row' });
      for(const x of 档){
        const 是 = (x.w === 400 ? '' : String(x.w)) === 现;
        排.appendChild(h('button', { class:'fd-btn mini' + (是 ? ' on' : ''), type:'button',
          /* 这一档往 CSS 写的就是 font-weight 那一个数；那一句名字是系统给这张脸起的档名（Light / Medium / 290 …），
             从前那一版是从字体名字里猜的，量出来 Arial 底下会多出「Arial Black」这一档 —— 那一个族根本不在
             Arial 这一家底下，写下去挑不到（同一数写下去墨点 2327 对 2044）。改吃系统那张表之后这种串家没有了。 */
          title:'这一档往 CSS 写 font-weight ' + x.w + '；系统报的这张脸叫「' + x.名 + '」，读的是 ' + 家 + ' 这一家底下的字体表',
          onclick:() => { set('字重', x.w === 400 ? '' : String(x.w)); wDraw(); } },
          ffWeightLabel(x) + ' · ' + x.w));
      }
      wWrap.appendChild(排);
      wWrap.appendChild(h('div', { class:'fd-hint' }, 读到了
        ? '系统报的这一家底下的脸：' + 档.map(x => ffWeightLabel(x) + ' ' + x.w).join('、') + '（' + 家 + '）'
        : '本地字体表里没读到「' + 家 + '」这一家（附加文件夹里挂上来的、手输的名字都算），先按标准 400 这一档走'));
      /* 换了字体家、原来钉的那一档在新的一家底下没有那张脸：文件里那一栏照原样留着（那是用户写的），
         可屏幕上实际落到哪一档得说一句 —— 不说就是这一行一个按钮都不亮，看着像坏了。 */
      const 落 = 现 ? ffWeightLanded(+现, 档) : 0;
      if(现 && 落 !== +现) wWrap.appendChild(h('div', { class:'fd-hint' },
        '方案里钉的是 ' + ffWeightName(+现) + ' ' + 现 + '，这一个字体家底下读不到那一张脸：屏幕上按 ' +
        ffWeightLabel(档.find(x => x.w === 落) || { w:落 }) + ' ' + 落 + ' 走。挑上面一档就把它改成这一家真有的脸。'));
    };
    dScheme.appendChild(row('全局字体', Fonts.field({ label:'Flow-Desk 全局字体', value:draft.字体 || '', dflt:'Flow-Desk 默认',
      onSet:f => { set('字体', f); wDraw(); } })));
    dScheme.appendChild(row('全局字重', wWrap));
    wDraw();
    /* 圆角两档、字体都进了方案：第 10 条说的「散控件不留」就是把这几样从屏顶上挪进这一摊里；
       两档圆角改的都是卡片和控件这张面，归卡面组 */
    dCard.appendChild(row('卡片圆角', slider(0, 30, clampRadius(draft.卡片圆角), v => { set('卡片圆角', v, false); }, 'px')));
    dCard.appendChild(row('控件圆角', slider(0, 30, clampRadius(draft.控件圆角), v => { set('控件圆角', v, false); }, 'px')));
    /* 卡片间距也进方案了（2026-10-08 作者的话：「为方案设置数据：圆角、间距数据」）。
       这一档和两档圆角的区别是它有个「自动」：自动 = 排版那一步按格子短边现算（屏幕大了间距跟着大）。
       拖这一根从自动里走出来就钉死一个像素数，钉死的下限 4 —— 比 4 小卡片就挨成一片了。
       只重排桌面、不落文件：松手之后照旧问那一句（覆盖 / 另存 / 撤销）。 */
    dCard.appendChild(row('卡片间距', gapCtl(draft.间距, v => { set('间距', v, false); Shell.fitGrid(); })));
    dCard.appendChild(h('div', { class:'fd-hint' },
      '现在这一档是 ' + ((+draft.间距 || 0) > 0 ? '钉死的 ' + lookGap(draft.间距) + ' 像素' : '自动')
      + '；自动那一档由排版那一步按格子大小现算，屏幕上此刻量到的实际间距是 ' + Math.round(Shell.gap || 0) + ' 像素。'));
    syncTexHead();
    drawBar();
  };
  /* 滑杆一路拖只重算变量，松手才算一次桌面：不然拖一下重排一次，看着就是卡 */
  function slider(min, max, val, set2, unit){
    /* 别拿 clampRadius 夹这一串：那是圆角专用的 0~30，滑杆上限不等于 30 的那几条（从前那条纹理强度顶 40）都会被压扁 */
    const clamp = v => Math.max(min, Math.min(max, Math.round(+v || 0)));
    const txt = v => v + (unit || '');
    const out = h('span', { class:'fd-hint', style:'min-width:3.6em' }, txt(clamp(val)));
    /* aria-valuetext 带着单位念（「20 像素」而不是「20」）；名字那一头由 row() 挂 aria-labelledby 给 */
    const sl = h('input', { type:'range', min:String(min), max:String(max), step:'1', value:String(clamp(val)),
      'aria-valuetext':txt(clamp(val)), style:'width:200px',
      oninput:e => { const v = clamp(e.target.value); set2(v); out.textContent = txt(v); sl.setAttribute('aria-valuetext', txt(v)); } });
    return h('div', { class:'fd-row' }, [sl, out]);
  }
  /* 卡片间距那一根：滑杆 + 一枚回到「自动」的按钮。
     为什么不叫 slider 复用：滑杆的取值范围装不下「自动」这一个状态 ——
     0 在这一档里不是「间距 0 像素」，是「不钉死，跟着格子大小走」，得让它一眼能认出来。 */
  function gapCtl(val, set2){
    const n = Math.round(+val || 0);
    const out = h('span', { class:'fd-hint', style:'min-width:4.2em' }, n > 0 ? n + 'px' : '自动');
    const auto = h('button', { class:'fd-btn mini' + (n > 0 ? '' : ' on'), type:'button',
      'aria-pressed':String(n === 0), title:'不钉死这一档，间距跟着格子大小走',
      onclick:() => { if(n === 0) return; set2(0); drawDetail(); } }, '自动');
    const sl = h('input', { type:'range', min:String(LOOK_GAP.min), max:String(LOOK_GAP.max), step:'1',
      value:String(n > 0 ? Math.max(LOOK_GAP.min, Math.min(LOOK_GAP.max, n)) : Math.round(Shell.gap || LOOK_GAP.min)),
      'aria-valuetext':n > 0 ? n + ' 像素' : '自动', style:'width:200px',
      oninput:e => { const v = lookGap(e.target.value); set2(v); out.textContent = v + 'px';
        auto.classList.remove('on'); auto.setAttribute('aria-pressed', 'false');
        sl.setAttribute('aria-valuetext', v + ' 像素'); } });
    return h('div', { class:'fd-row' }, [sl, out, auto]);
  }
  /* ---------- 唯一的写盘入口：覆盖 / 另存 / 撤销 ---------- */
  function drawBar(){
    bar.innerHTML = '';
    bar.style.display = dirty ? '' : 'none';
    if(!dirty) return;
    bar.appendChild(h('span', { class:'fd-hint' }, '改动已经在屏幕上看着变了，还没写进方案'));
    bar.appendChild(h('button', { class:'fd-btn mini primary', onclick:() => {
      LookLib.overwrite().then(() => { start(LookLib.get() || draft); drawScheme(); drawBar(); toast('已覆盖「' + LookLib.cur + '」'); });
    }}, '覆盖当前这套'));
    bar.appendChild(h('button', { class:'fd-btn mini', onclick:() => saveAsDlg() }, '另存为新方案'));
    bar.appendChild(h('button', { class:'fd-btn mini', onclick:() => {
      LookLib.apply(base); start(base); drawDetail(); drawScheme();
    }}, '撤销这处改动'));
  }
  /* ---------- 按七组分装屏 ----------
     每组的行都还是原来那几行（row() / segCtrl / dotSel / slider 一个没换），只是挪进各自组的 body，
     组的顺序固定：明暗 → 方案 → 卡面 → 纹理 → 背景 → 渐变 → 色卡。
     背景和渐变两组的 body 在下面建（wallBox / gradBox 就是它们的落点），这里先把壳挂上。 */
  /* ---------- 四页各摆什么（作者原话逐页对上，2026-10-08）----------
     第 1 页 方案与明暗：「切换明暗模式、在下拉选项中切换所用方案」
     第 2 页 方案设定：「方案重命名、方案删除、方案分组、方案新建（可以先新建方案，再具体改数值、颜色）、
                        方案编辑（跳转下一标签页编辑方案详情）」
     第 3 页 方案编辑：这套方案自己的每一样（这一套选中的颜色、字体、外观模式、两档圆角和间距、纹理和它那张铺几格、背景、
                        渐变、标记用颜色、配色从哪来）；没选中方案之前锁着
     第 4 页 方案资源：「管理所有的颜色（色卡）、图片、字体」—— 作者 2026-10-09 把这一页说成「总仓库」：
                        颜色、图片、纹理、字体四类料都在这一页管，方案编辑那一页从仓库拿料打包成方案，方案呈现为外观。
     从前那七组分屏的小标题里，卡面 / 纹理 / 背景 / 渐变 这四段留在第 3 页当段头；
     明暗 / 方案 / 色卡 三段不留 —— 页名已经说了同一句话，同一句话不摆两遍。 */
  gMing.body.appendChild(mingBox);
  gMing.body.appendChild(row('外观方案', schemeSel.wrap));
  const nameInp = h('input', { class:'fd-input', style:'max-width:280px', value:LookLib.cur || '' });
  const renBtn = h('button', { class:'fd-btn mini', title:'把当前这套方案改个名字（文件里那一条跟着改）', onclick:() => {
    const r = LookLib.rename(LookLib.cur, (nameInp.value || '').trim());
    if(!r.ok){ toast(r.msg, true); nameInp.value = LookLib.cur; return; }
    if(draft) draft.方案名 = r.name; dirty = true; nameInp.value = r.name;
    drawScheme(); drawMing(); toast('已改名为「' + r.name + '」');
  }}, '改名');
  const newBtn = h('button', { class:'fd-btn mini', title:'照当前这套先攒一条新的，名字你写；新那条接着改数值、颜色',
    onclick:() => saveAsDlg(() => { chosen = true; sub.lock(P_EDIT, false); drawScheme(); }) }, '新建一套');
  const delBtn = h('button', { class:'fd-btn mini', title:'把当前这一套从外观方案库里删掉（就剩一套时删不掉）', onclick:async () => {
    /* 删的是不可逆的一笔（WCAG 3.3.4）：不管有没有没存的改动都问一句。
       带着没落文件的改动时把那一句并进这同一个问题里说，不叠两层框。 */
    const q = '删掉外观方案「' + LookLib.cur + '」？这一套从方案库里就没了，屏幕回到库里剩下的那一套。' +
      (dirty ? '\n这一套上还挂着没存进文件的改动，删掉就连那一笔一起没了。' : '');
    if(!await fdAsk(q, '删除')) return;
    const r = LookLib.remove(LookLib.cur);
    if(!r.ok){ toast(r.msg); return; }
    dirty = false; start(LookLib.get() || {}); drawScheme(); drawDetail(); toast('已删掉这一套方案', true);
  }}, '删除当前');
  const editBtn = h('button', { class:'fd-btn mini primary', title:'跳到「方案编辑」那一页，改这套方案的字体、外观模式、圆角、纹理、背景、颜色',
    onclick:() => { chosen = true; sub.lock(P_EDIT, false); sub.go(P_EDIT); } }, '编辑这套方案');
  gLook.body.appendChild(row('方案名', h('div', { class:'fd-row' }, [nameInp, renBtn])));
  const grpInp = h('input', { class:'fd-input', style:'max-width:180px', list:'fd-look-grps', value:(LookLib.get() || {}).分组 || '' });
  const grpList = () => h('datalist', { id:'fd-look-grps' }, LookLib.groups().map(g => h('option', { value:g })));
  const grpBtn = h('button', { class:'fd-btn mini', title:'给当前这套方案记一个组名（那只下拉按组分开摆；空着 = 不归组）', onclick:() => {
    const r = LookLib.setGroup(LookLib.cur, grpInp.value);
    if(!r.ok){ toast(r.msg, true); return; }
    drawScheme(); drawMing(); toast(r.group ? '已归进「' + r.group + '」' : '已把这一套从组里拿出来');
  }}, '归组');
  gLook.body.appendChild(row('这一套方案', h('div', { class:'fd-row' }, [newBtn, delBtn, editBtn])));
  gLook.body.appendChild(row('方案分组', h('div', { class:'fd-row' }, [grpInp, grpList(), grpBtn])));
  /* 明暗这一档（外34 图12）：默认「自动」= 程序按这套配色现算它是深是浅；
     手动钉成明亮 / 黑暗之后，这一套方案归哪一池就照这一栏算，换配色也不会跳出当前这一池。 */
  gLook.body.appendChild(row('明暗', segCtrl([{v:'自动',t:'自动'},{v:'明亮',t:'明亮'},{v:'黑暗',t:'黑暗'}],
    () => (draft && draft.明暗) || '自动', v => { set('明暗', v); drawMing(); drawScheme(); })));
  /* 上面那两格建好了，才把「跟着选中的方案走」这一笔接回 drawScheme（见上面那个空位） */
  刷方案名 = () => { const s = LookLib.get() || {}; nameInp.value = LookLib.cur || ''; grpInp.value = s.分组 || ''; };
  gLook.body.appendChild(h('div', { class:'fd-hint' },
    '改名、删除、新建管的都是方案库里那一条本身；要改这套方案里的字体、外观模式、圆角、纹理、背景、颜色，'
    + '点「编辑这套方案」跳到「方案编辑」那一页。'));
  const p3box = h('div', { style:'display:grid;gap:14px' });
  /* 「这一套方案选中的颜色」排第一（作者 2026-10-09 圈的正是这一页顶上那块空的地方）：
     颜色是这一页的头一样，字体、卡面、纹理跟在后面。 */
  p3box.appendChild(dPal);
  p3box.appendChild(dScheme); p3box.appendChild(gCard.wrap); p3box.appendChild(gTex.wrap);
  gCard.body.appendChild(dCard);
  gTex.body.appendChild(dTex);
  const P_EDIT = '方案编辑', P_RES = '方案资源';
  let chosen = !!LookLib.cur;   /* 库里已经认到一套在用方案 = 第 3 页本来就有的可编，锁它没意义；
                                   没认到（数据那份读不到）时第 3 页锁着，等第 2 页挑中一套再放开
                                   （四页各摆什么那份说明在「按七组分装屏」那一处写着，这里不抄第二遍） */
  const sub = subTabs([
    { name:'方案与明暗', build:() => gMing.body },
    { name:'方案设定', build:() => gLook.body },
    { name:P_EDIT, build:() => p3box },
    { name:P_RES, build:() => p4box }
  ], '方案与明暗');
  sub.lock(P_EDIT, !chosen);
  box.appendChild(sub.bar); box.appendChild(sub.pane);
  /* ---------- 不进方案的这几样：背景（含渐变怎么画）/ 卡片间距（还摆在同一屏，只是不跟着方案走） ----------
     背景这一档（外13-R D3）改动直接写机器的外观存档、当场重新上色：它管的是屏幕最底下那一块，
     不是「一套方案」的内容 —— 和外观模式、纹理那四档各管各的，互不顶。
     这两样各占一组：wallBox 是背景组的 body（壁纸那几档 + 两根模糊 + 壁纸的格位），
     gradBox 是渐变组的 body（渐变怎么画那几档 + 调节控件）—— 分组只是分位置，判定和画法一行没动。 */
  const wallBox = gWall.body, gradBox = gGrad.body;
  /* 覆盖 / 另存 / 撤销那一行管的是这套方案写不写盘，跟着「方案编辑」那一页走（改的正是这一页上的东西）；
     背景、渐变两组的段头和它们的行也一并进那一页 */
  p3box.appendChild(bar); p3box.appendChild(gWall.wrap); p3box.appendChild(gGrad.wrap);
  /* 渐变组里的行全是条件在场的（背景不是渐变、或这套配色认成不给渐变，就一行都不摆）；
     整组空了就把小标题一起收掉 —— 空门面不渲染 */
  const syncGradHead = () => { gGrad.head.style.display = gradBox.children.length ? '' : 'none'; };
  const gSet = (k, v) => { const g = Theme.cfg.grad || (Theme.cfg.grad = {}); g[k] = v; Theme.save(); Theme.apply(); };
  /* ---------- 背景这一档：纯色 / 渐变 / 一张背景图 ----------
     图归方案（作者的话：「为方案选择背景图片：在已导入的图中选择，可不选；背景图片只会进入FD背景」），
     从图片库那一份清单（data\\images.yaml 里 用途 写着「背景图」的那些）挑，界面上不再开文件选择框。
     糊和压暗提亮这两根还是机器存档顶上那一档：它们管的是「屏幕上这一块读不读得动」，
     换方案不该把这两根跟着换掉 —— 一张图换一套深浅就得重调一次，那是给人添乱。
     上下限的真身在 _shared/sh-look.js（LOOK_WALL_BLUR / LOOK_TINT），界面、样式表、自检吃同一串数。
     从前这里还有一档「四方连续」：2026-10-08 作者把纹理和四方连续图定成同一样东西，
     那一档就从背景这一排里退出去、归到纹理那一摊（纹理现在连背景一起铺）。 */
  const wSet = (k, v) => { Theme.cfg[k] = v; Theme.save(); Theme.apply(); };
  const cellVal = () => { const c = Theme.cfg.texCell; return c && c.w > 0 && c.h > 0 ? c : null; };
  /* 「读不读得动」那一行：换图 / 拖模糊 / 换格位 / 调动子 之后各重算一次壁纸糊完之后的等效底。
     只说一句，不拦任何操作 —— 《配色原则与渐变规则.md》第三节写死了：两条里任何一条不满足时，
     界面上要把「再糊一点」这条路继续留着（糊就是解决「图片太花、字读不动」的手段），拦下来等于把人往回赶。 */
  let wallLine = null, wallGen = 0, wallTimer = 0, drawGen = 0;
  const wallReadText = () => {
    const w = Theme.wallInfo, b = Theme.wallBase;
    if(!w || !w.layer) return '背景现在没铺图，「读不读得动」这一句要等铺上图才说得出。';
    if(!b) return '这张图这一趟没读回来（文件被挪走、或没认成图片），复核先空着，模糊和调子照旧能调。';
    const t = Theme.applied || {};
    const face = t['--face-solid'] || t['--card-bg'], sub = t['--text-light'] || t['--text'];
    const L = x => CV.hslOf(x)[2] * 100;
    const gap = face ? Math.abs(L(face) - L(b.avg)) : NaN;
    const ct = sub ? Math.min(CV.contrast(sub, b.avg), CV.contrast(sub, b.min), CV.contrast(sub, b.max)) : NaN;
    let s = '糊完这一层，屏幕脚下那一片在 ' + b.lumMin.toFixed(0) + '~' + b.lumMax.toFixed(0) + ' 个明度点（平均 ' + L(b.avg).toFixed(0) + '）';
    if(face) s += '；卡面在 ' + L(face).toFixed(0) + ' 点，两个差 ' + gap.toFixed(1) + ' 点（文档要 4~28 之间）';
    if(sub) s += '；压在壁纸上的次级文字最吃紧那一点是 ' + ct.toFixed(1) + ':1（要 4.5 以上）';
    const bad = [];
    if(Number.isFinite(gap) && gap < 4) bad.push('卡片和背景糊成一片、看不出边界');
    if(Number.isFinite(gap) && gap > 28) bad.push('卡面像一块硬板贴在背景上');
    if(Number.isFinite(ct) && ct < 4.5) bad.push('字读不动');
    if(bad.length){
      const canBlur = w.blur < LOOK_WALL_BLUR.max;
      s += ' —— ' + bad.join('、') + '。' + (canBlur ? '再糊一点试试（这根滑杆还没走满）。' : '这根滑杆已经走满了，那就换一张图，或者调上面那根压暗提亮。');
    } else s += ' —— 这一张读得动。';
    return s;
  };
  const refreshWall = async () => {
    const el = wallLine, gen = ++wallGen;
    await Theme.wallRecheck();
    if(gen !== wallGen || el !== wallLine) return;   /* 期间又重画 / 又调过一回，这一趟作废 */
    el.textContent = wallReadText();
  };
  /* 拖滑杆一路走只在松手之后算一次等效底：每挪一个像素重画一遍那张小画布，看着就是卡 */
  const laterWall = () => { clearTimeout(wallTimer); wallTimer = setTimeout(refreshWall, 150); };
  /* ---------- 密度 = 最小使用格位（作者的话），文件里和界面上都写作「一张占几 × 几格」（外13-R D3-c） ----------
     只有会平铺的纹理才有这一档 —— 背景那一张图不涉及格位，它是按屏幕铺满、中间对齐，多出来的边裁掉。
     最小的单位由图源自己的比例定：正方形 = 1×1（首页一个格子）、
     横向 4:3 = 4×3（首页 12 个格子）、16:9 = 16×9（144 个格子）；往上只按整数倍放大
     （4×3 的可以是 8×6、12×9……），倍数的顶 = 放到铺满整屏那一档（整屏 64×36）。
     倍数表只摆 1/2/3/4/6/8/12/16/24/36 这几档里没出界的：正方形那张最小的图理论上有 36 档，
     全摆出来这一行就没法看了。图的比例要读回来才知道，所以这一行是异步后挂的。 */
  /* 存档没写格位 = 按原图自己的像素大小反复贴（这一层挂上来本来就是这个样子），
     和「1×1（首页一个格子）」不是同一件事 —— 从前这里没格位时把选中态摆在 1×1 上，
     界面说「一张占 1 格」、屏幕上贴的是原图那么大，属于骗人。多摆一格「随原图」，
     选中态跟着屏幕走，挑了某档格位也还能退回这一格。 */
  const CELL_NAT = '原图';
  const cellRow = (kind, url, host, after) => {
    const box = h('div', { class:'fd-row' }, [h('span', { class:'fd-hint' }, '正在认这张图是几比几…')]);
    const el = row('一张占几 × 几格', box);   /* 这一档就是作者说的「密度」：最小几个格位铺一张 */
    const gen = drawGen;
    host.appendChild(el);
    Theme.imgCellBase(url).then(base => {
      if(gen !== drawGen || !el.isConnected) return;
      const all = Theme.cellSteps(base);
      const cand = [1, 2, 3, 4, 6, 8, 12, 16, 24, 36].filter(n => n <= all.length).map(n => all[n - 1]);
      const cur = cellVal(kind);
      /* 存档里那个倍数不在候选上（手工改坏的、或从前留下的）也要摆出来，不然选中态落空 */
      if(cur && !cand.some(c => c.w === cur.w && c.h === cur.h)) cand.push(cur);
      const key = c => c.w + '×' + c.h;
      box.innerHTML = '';
      box.appendChild(segCtrl([{ v:CELL_NAT, t:'随原图' }].concat(cand.map(c => ({ v:key(c), t:key(c) }))),
        () => { const c = cellVal(kind); return c ? key(c) : CELL_NAT; },
        v => {
          if(v === CELL_NAT){ Theme.setCell(kind, null); }
          else { const c = cand.find(x => key(x) === v); if(!c) return; Theme.setCell(kind, { w:c.w, h:c.h }); }
          if(after) after(); else { drawWall(); refreshWall(); }
        } ));

      box.appendChild(h('span', { class:'fd-hint' },
        '这张图是 ' + base.w + ':' + base.h + '，所以最小这一档就是 ' + key(base) + '（首页 ' + (base.w * base.h) + ' 个格子）；放大只按这个比例的整数倍走，最大到 ' + key(all[all.length - 1]) + ' 那一档 —— 再往上就超出整屏 64×36 这副栅格了。' +
        (cellVal(kind) ? '' : '现在这一层是按原图自己的大小反复贴的；挑上面某档格位，才改成照首页格子缩放。')));
    });
  };
  /* 背景那一张图自己的几行：挑哪一张（图片库里选）+ 撤掉这一层，底下跟这根模糊滑杆。
     导入不在这一页 —— 「方案资源」那一页管图，这一页只管挑（作者分的那四页就是这个分工）。 */
  const wallRows = () => {
    const cur = draft ? imgWallName(draft.背景图) : '无';
    const lib = ImgLib.byUse('背景图');
    const sel = h('select', { class:'fd-input', style:'max-width:280px' },
      [h('option', { value:'', selected:cur === '无' }, '不选')].concat(
        /* 库里那些图这一趟读不回来的（文件被挪走、外置盘没插）不摆 —— 摆一条挑上什么都不铺的假选项是骗人 */
        lib.filter(t => !!imgUrl(t)).map(t => h('option', { value:t.名字, selected:t.名字 === cur }, t.名字))));
    sel.onchange = () => {
      if(!sel.value){
        set('背景图', '无');
        if(Theme.cfg.wall === 'image') wSet('wall', 'solid');
      } else {
        set('背景图', sel.value);
        wSet('wall', 'image');           /* 挑了图就是要看它：背景那一档跟着切过来，纯色 / 渐变 由他自己再点回去 */
      }
      Shell.render(); drawWall();
    };
    wallBox.appendChild(row('背景图片', h('div', { class:'fd-row' }, [sel,
      cur !== '无' ? h('button', { class:'fd-btn mini', title:'这一张不要了：背景回到纯色或渐变（图库里那张图本身不动，还在「方案资源」那一页里）',
        onclick:() => { set('背景图', '无'); if(Theme.cfg.wall === 'image') wSet('wall', 'solid'); Shell.render(); drawWall(); } }, '撤掉') : null]
      .filter(Boolean))));
    if(!lib.length) wallBox.appendChild(h('div', { class:'fd-hint' },
      '背景图图库现在是空的 —— 到「方案资源」那一页按「按背景图导入」收一张进来，这里才挑得出。'));
    wallBox.appendChild(row('模糊', slider(0, LOOK_WALL_BLUR.max, Theme.cfg.wallBlur || 0,
      v => { wSet('wallBlur', v); laterWall(); }, ' 像素')));
    if(cur === '无') return;
    const url = Theme.wallUrl;
    if(!url) return;
    const gen = drawGen;
    Theme.imgCellBase(url).then(b => {
      if(gen !== drawGen || !wallBox.isConnected) return;
      const sc = lookAspectCells(innerWidth, innerHeight);
      if(!sc || (b.w === sc.w && b.h === sc.h)) return;    /* 比例一样就不必啰嗦这一句 */
      wallBox.appendChild(h('div', { class:'fd-hint' },
        '这张图是 ' + b.w + ':' + b.h + '，屏幕是 ' + sc.w + ':' + sc.h + ' —— 按屏幕铺满、中间对齐，多出来那一边裁掉。想让图一点不裁，就挑一张和屏幕同一个比例的。'));
    });
  };
  const drawWall = () => {
    drawGen++;
    wallBox.innerHTML = '';
    gradBox.innerHTML = '';
    wallLine = null;
    const gd = Theme.gradInfo || Look.grad(Theme.applied || Theme.tokens().tokens, Theme.cfg);
    /* 屏幕上此刻到底铺不铺渐变，只看落地后的那一档：自动判成「不给渐变」、或改口改成了画不出的那一档，
       都算不铺（存档里 kind 只有界面写得出的那几个值，最后一个分支是给手工改坏的存档兜底）。 */
    const noGrad = gd.kind === 'none';
    /* 「不给渐变」是这套配色自己认出来的结论：认出来是它，背景这一档就不摆「渐变」那一格 ——
       摆一格画不出东西的选择是骗人（互斥的组合不渲染，不是灰显）。
       此刻屏幕上铺的本来也就是纯色，所以那一格没选中时把选中态摆在「纯色」上：所见即所选。
       存档里那条 渐变 不动 —— 换回一套认得出方向的配色，它自己就回来了，不必偷偷替他改口。
       壁纸那两层同理：存档写着 普通图片 / 四方连续，可这一趟图没读回来（外置盘没插、文件被挪走），
       界面上那一格也跟着指纯色，和 apply() 里那句是同一个口径。 */
    const eff = () => {
      const w = Theme.cfg.wall;
      /* 存档写着 背景图，可这一趟图库里那张读不回来（文件被划掉、外置盘没插）：
         界面上那一格也跟着指纯色，和 apply() 里那句是同一个口径 */
      if(w === 'image' && !Theme.wallUrl) return 'solid';
      return (noGrad && w === 'gradient') ? 'solid' : w;
    };
    const opts = [{ v:'solid', t:'纯色' }];
    if(!noGrad) opts.push({ v:'gradient', t:'渐变' });
    /* 「背景图」这一格只在方案那一栏已经挑了一张的时候摆 —— 挑一格手里没图的选择是骗人（互斥的不渲染，不是灰显） */
    if(draft && imgWallName(draft.背景图) !== '无') opts.push({ v:'image', t:'背景图' });
    wallBox.appendChild(row('背景', segCtrl(opts, eff, v => {
      if(v === eff()) return;
      Theme.cfg.wall = v; Theme.save(); Theme.apply(); drawWall();
    })));
    wallRows();
    const wl = Theme.wallInfo;
    if(wl && wl.layer){
      const dflt = Theme.dark() ? LOOK_TINT.dark : LOOK_TINT.light;
      const cur = (Theme.cfg.wallTint === '' || Theme.cfg.wallTint == null)
        ? dflt : lookClamp(Theme.cfg.wallTint, LOOK_TINT.min, LOOK_TINT.max);
      wallBox.appendChild(row('压暗提亮', slider(LOOK_TINT.min, LOOK_TINT.max, cur,
        v => { wSet('wallTint', v); laterWall(); })));
      wallBox.appendChild(h('div', { class:'fd-hint' },
        '深底往壁纸上掺黑、浅底掺白，方向跟着明暗自己走，出厂那一档是 ' + dflt + '，现在这根在 ' + cur + '。这一档只压壁纸，卡面和字不吃它。'));
      /* 反向取色：壁纸自己一个字不改（不加色相、不调饱和度），要它那一套颜色就取进色卡，
         到色卡那一屏去挑 —— 从前这里想过「给壁纸改色」，那是拿一层滤镜盖住照片，不是设计要的东西；
         也想过「取成一套配色并挑上」，外29 乙组第二条定了从图取色不再各自成一套，就只进色卡。 */
      const take = h('button', { class:'fd-btn mini',
        title:'读这一张背景图的主要颜色，进色卡（图上一个字都不改）',
        onclick:async () => {
          const blob = await Theme.wallSync().then(() => Theme.wallBlob);
          if(!blob){ toast('这一层现在没有图可取', true); return; }
          take.disabled = true; take.textContent = '正在认…';
          try{
            const hexes = await ImageTheme.colors(blob, 8);
            if(!hexes.length) throw new Error('这张图里没有可取的颜色');
            const 进色卡 = CardPool.addAll(hexes, 'image');
            toast('从这张背景图取到 ' + hexes.length + ' 个色 · 进色卡 ' + 进色卡 + ' 个'
              + (进色卡 ? '' : '（这些色色卡里已经有了）') + 池尾());
          }catch(e){ if(e && e.name !== 'AbortError') toast('取不了：' + (e.message || e), true); }
          take.disabled = false; take.textContent = '从这张背景图取色进色卡';
        }}, '从这张背景图取色进色卡');
      wallBox.appendChild(row('背景图的颜色', h('div', { class:'fd-row' }, [take])));
      wallLine = h('div', { class:'fd-hint' }, wallReadText());
      wallBox.appendChild(wallLine);
      refreshWall();
    }
    /* 背景组到这里画完；下面这几行归渐变组，挂到 gradBox 那一格里 */
    if(Theme.cfg.wall !== 'gradient' || gd.kind === 'none'){ drawGradTune(gd); syncGradHead(); return; }
    /* 五档的名字摆成一行让他改口：默认「自动」= 由这套配色自己认（文档里那三条跨度）。
       「不给渐变」不在这一行里：那是背景那一档选「纯色」或「图片」的事，不是一种画法。 */
    gradBox.appendChild(row('渐变怎么画', segCtrl([{ v:'auto', t:'自动' }].concat(GRAD_KINDS
      .filter(x => x.k !== 'none').map(x => ({ v:x.k, t:x.name }))),
      () => Theme.cfg.grad && Theme.cfg.grad.kind || 'auto',
      v => { gSet('kind', v); drawWall(); })));
    const sp = gd.spans;
    gradBox.appendChild(h('div', { class:'fd-hint' },
      '这套配色认的是「' + gd.autoName + '」：带彩度的锚 ' + sp.k + ' 个 · 色相跨度 ' + Math.round(sp.dH) + '° · 卡面和页面底差 ' + sp.dL.toFixed(1) + ' 个明度点。' +
      (gd.kind === gd.auto ? '' : '现在按你指定的「' + gd.name + '」画。') + ' ' + gd.tip));
    /* 这一档只说落点，不给开关：外29 补充定死渐变只铺两块面，剩下的界面控件管不到它。 */
    gradBox.appendChild(h('div', { class:'fd-hint' },
      '这一条渐变铺在哪几块面：Flow-Desk 的背景、卡片展开之后的那一张面，只这两块。'
      + '弥散和径向这些复杂的画法同样出不了这两块 —— 卡片缩小在首页时一律是实色，'
      + '因为小卡底下已经压着整屏渐变，自己再来一条就叠成两层，字读不动。'));
    drawGradTune(gd);
    syncGradHead();
  };
  /* 每一档各摆自己那几个可调项：不相关的不自造（明度微渐没有色相可掺，就不会看到一根「掺入量」）。
     滑杆拖动只重新上色、不重画这一整块 —— 重画会把手上正拖着的那根滑杆拆掉，拖到一半就断了。
     这些行都归渐变组：挂到 gradBox，和背景那几行分开摆，功能照旧（判定还是上面那一段的判定）。 */
  const drawGradTune = gd => {
    if(Theme.cfg.wall !== 'gradient' || gd.kind === 'none') return;
    const T = gradTune(Theme.cfg);
    if(gd.kind === 'luma'){
      gradBox.appendChild(row('角度', slider(0, 360, T.angle, v => gSet('angle', v), '°')));
      gradBox.appendChild(row('明度跨度', slider(1, 6, T.lumaSpan, v => gSet('lumaSpan', v), ' 点')));
      gradBox.appendChild(h('div', { class:'fd-hint' }, '只往明暗走，另一端是页面底挪 ' + T.lumaSpan + ' 个明度点那一个色号；卡面不参与。挪过头卡片自己就看不出边界了，顶给到 6 点。'));
    } else if(gd.kind === 'family'){
      gradBox.appendChild(row('角度', slider(0, 360, T.angle, v => gSet('angle', v), '°')));
      gradBox.appendChild(row('掺多少强调色', slider(6, 12, T.famMix, v => gSet('famMix', v), '%')));
      gradBox.appendChild(row('中间那一档在哪', slider(50, 85, T.famStop, v => gSet('famStop', v), '%')));
    } else if(gd.kind === 'accent'){
      gradBox.appendChild(row('角度', slider(0, 360, T.angle, v => gSet('angle', v), '°')));
      gradBox.appendChild(row('中段在哪', slider(35, 70, T.accMid, v => gSet('accMid', v), '%')));
      gradBox.appendChild(row('终点收到', segCtrl([{ v:'card', t:'卡面（卡片像从背景里浮出来）' }, { v:'page', t:'页面底（两端都在页面底的族里）' }],
        () => T.accEnd ? 'card' : 'page', v => { gSet('accEnd', v === 'card'); drawWall(); })));
    } else if(gd.kind === 'radial'){
      gradBox.appendChild(row('光从哪儿出', segCtrl(GRAD_CENTERS.map(c => ({ v:c.v, t:c.t })),
        () => T.radCenter, v => { gSet('radCenter', v); drawWall(); })));
      gradBox.appendChild(row('散多远', slider(60, 120, T.radSpan, v => gSet('radSpan', v), '% 屏宽')));
      gradBox.appendChild(row('第二种色相掺多少', slider(0, 8, T.radHue2, v => gSet('radHue2', v), '%')));
      gradBox.appendChild(h('div', { class:'fd-hint' }, '两个色相族排成一条直线就成彩虹带了，所以改成从一角往外散的光；第二种色相只许出现在中间那一档，掺入量顶 8%。'));
    } else if(gd.kind === 'diffuse'){
      const blobs = h('div', { class:'fd-seg', role:'group', 'aria-label':'团摆在哪个角' });
      GRAD_QUADRANTS.forEach((q, i) => {
        const on = T.blobs.includes(i);
        blobs.appendChild(h('button', { class:on ? 'on' : '', 'aria-pressed':String(on), onclick:() => {
          const next = on ? T.blobs.filter(x => x !== i) : T.blobs.concat(i).slice(-4);
          /* 硬规矩：最多四团（slice(-4) 顶住），这一档存在的理由是「散成团」，少于三团就不是团了 */
          if(next.length < 3){ toast('弥散至少三团，再少就不是一团一团地散'); return; }
          gSet('blobs', next); drawWall();
        }}, q.t));
      });
      gradBox.appendChild(row('团摆在哪几个角', blobs));
      gradBox.appendChild(row('每团多大', slider(10, 22, T.blobR, v => gSet('blobR', v), '% 屏宽')));
      gradBox.appendChild(row('团色掺多少', slider(8, 20, T.blobMix, v => gSet('blobMix', v), '%')));
      gradBox.appendChild(h('div', { class:'fd-hint' }, '团色只从主强调、次强调和五个色位里取，不新造颜色。每团直径顶在屏宽 45%（半径 22%）、团只摆四个角 —— 卡片拖到哪儿，脚下的颜色都还接近页面底。'));
    }
  };
  /* 背景、渐变两组的壳先前就挂上屏了：wallBox / gradBox 就是它们的 body，这里只管把行画进去 */
  drawWall();
  /* 卡片间距改的是桌面上卡片的格距，按「改卡片的进卡面」归进卡面组 ——
     它现在是方案自己那一栏了（上面 drawDetail 里那一根），不再是机器存档顶上的 gapFd，
     所以这一行从组壳里挪进详细设置那一趟：换方案就跟着换，和两档圆角同一个待遇。 */
  /* ---------- 标记色（外13-N）：在「方案编辑」这一页里挑，但数据上不进方案、不进色卡 ----------
     他这次点的是「为方案选择标记用颜色：色卡选色，此处只能选择」—— 位置按这一句挪到第 3 页，
     定色那一条路也跟着收成「只从色卡挑」（从前那一档「自由设色」的取色器和手写色号撤了：
     想要色卡里没有的色，去第 4 页往色卡填那一个色号，回到这一页挑）。
     数据归属一个字没改（还住在外观存档顶上单独一节 marks），行内那句「不住在色卡」照旧。 */
  p3box.appendChild(markSection());
  /* ---------- 第 4 页「方案资源」= 颜色 + 图片 + 字体三块 ----------
     他这一页的原话是「管理所有的颜色（色卡）、图片、字体」，所以三块各顶一行小标题，一块管一家：
       色卡 —— 新建一套 / 改色号 / 从图取色 / 摊开那一个个攒着的色，改完直接进 palettes.yaml 与 cards.yaml，不问覆盖还是另存；
       图片 —— 三种用途各一颗导入按钮，下面按用途分三块摆着已收的那几张（改用途、取色、划掉）；
       字体 —— 本地字体清单、屏蔽、收藏、看字体信息。
     第 3 页那一排下拉吃的就是这三块管着的东西，那一页只挑、这一页只管（四页的分工）。 */
  /* ---------- 第 4 页「方案资源」= 总仓库四块：颜色（色卡）/ 图片 / 纹理 / 字体 ----------
     作者 2026-10-09 把这三层说死了：「方案素材是一个总仓库，可以从仓库拿不同的东西（颜色、图片、纹理、字体），
     然后在方案编辑页面用不同的打包方式（颜色微调、纹理使用、字号、圆角数据等）打包成方案，最终呈现为外观。」
     —— 这一页只管库里有什么，一律当场落盘、不问「覆盖还是另存」；某一方案用了哪一样、怎么打包，全在第 3 页。
     纹理从前混在「图片」那一块的用途里，这一轮按他那一句单列一块（数据还是同一份 images.yaml，只是分成两块摆）。 */
  const gImg = group('图片'), gTile = group('纹理'), gFont = group('字体');
  const lib = h('div', { style:'display:grid;gap:14px' });
  /* 色卡上「挑中的进入方案」那一条路：这一串色号存成一套配色，并让当前这一套方案用上它。
     Palette.record 里已经去了重（同几颗色早就有一套在用，就直接回到那一条，不攒第二套同名同色的）。 */
  palEdit = paletteLib(lib, () => { palSel.draw(); drawDetail(); }, hexes => {
    const 方案名 = (draft && draft.方案名) || LookLib.cur || '';
    const it = Palette.add({ name:(方案名 || '色卡') + ' 挑的', mode:'custom',
      colors: hexes.map(x => ({ raw:x, format:'auto' })), std:(Palette.cur || {}).std || 'gracol' });
    if(!it){ toast('这一串没能存成一套配色', true); return false; }
    if(!draft){ toast('这一套配色「' + it.name + '」建好了，可这一趟没认下方案来 · 到「方案设定」挑一套再用它'); return true; }
    set('配色', it.name); palSel.draw(); drawMing(); drawDetail();
    toast('挑中的 ' + hexes.length + ' 个进了方案「' + 方案名 + '」· 这一套用上了「' + it.name + '」');
    return true;
  }, () => Palette.items.find(x => x.name === (draft && draft.配色)) || Palette.cur);
  gPal.body.appendChild(lib);
  /* drawDetail 在上一段就已经跑过一趟，那一趟这一截还没建出来 —— 这里补挂一次，
     挂到「配色」那一行下面（往后每一趟重画都由 drawDetail 自己接回去） */
  if(palEdit) dPal.appendChild(palEdit);
  gImg.body.appendChild(imgLibSection(() => { drawDetail(); drawWall(); }, ['背景图', '取色素材']));
  gTile.body.appendChild(imgLibSection(() => { drawDetail(); drawWall(); }, ['纹理·四方连续图']));
  gFont.body.appendChild(fontLibSection(() => { drawDetail(); }));
  const p4box = h('div', { style:'display:grid;gap:14px' }, [gPal.wrap, gImg.wrap, gTile.wrap, gFont.wrap]);
  /* ---------- 恢复出厂取值（这一屏最底下）----------
     只把这套方案里的数值类取值（两档圆角 + 卡片间距）回到出厂那一档；
     配色、方案名、外观模式、纹理、字体和方案清单本身一概不动 ——
     名字类取值回不回是人的事，数值回不回出厂有个说得清的数，两件事别搅在一个按钮里。
     出厂数值只读外壳层那一份默认值 LookStore.defaults（fd3-shell.js 里开机认存档用的
     就是它，是唯一真身）：这一屏不抄第二份具体数，将来根上改了默认值这个跟着走，不出两个口径。 */
  const factoryNums = () => { const d = LookStore.defaults;
    return { 卡片圆角: clampRadius(d.radiusCard), 控件圆角: clampRadius(d.radiusCtl), 间距: lookGap(d.gap) }; };
  const restoreFactory = () => {
    if(!LookLib.ready || !draft){ toast('外观方案这一趟没认下来，数值还回不了出厂', true); return; }
    /* 不可逆的一笔走现成的确认框（和「把图库里那一张划掉」「照当前配色重取一遍」同一个写法），
       话里先说清只回数值、配色和方案名不动 */
    const f = factoryNums();
    Modal.open('恢复出厂取值？', h('div', { style:'display:grid;gap:10px' }, [
      h('div', {}, '只把这一套方案里的数值类取值回到出厂那一档：卡片圆角 ' + f.卡片圆角 + ' 像素、控件圆角 ' + f.控件圆角 +
        ' 像素、卡片间距' + (f.间距 > 0 ? '钉死 ' + f.间距 + ' 像素' : '回到自动（跟着格子大小走）') + '。'),
      h('div', { class:'fd-hint' }, '配色、方案名、外观模式、纹理、背景图、字体和方案清单本身一概不动。' +
        '点下去先在屏幕上看着生效，要不要写进这套方案照旧问那一句（覆盖 / 另存 / 撤销）—— 不存，这套方案本身不变。')]),
      [h('button', { class:'fd-btn', onclick:() => Modal.close() }, '取消'),
       h('button', { class:'fd-btn primary', onclick:() => {
         Modal.close();
         /* 走滑杆那一头的同一个 set()：值进草稿、当场生效，重画完这几个控件就摆在新值上。
            间距这一档 2026-10-08 才进方案，跟着两档圆角同一个待遇回出厂（它那一档出厂值是「自动」）。 */
         set('卡片圆角', f.卡片圆角, false); set('控件圆角', f.控件圆角, false); set('间距', f.间距, false);
         Shell.fitGrid();
         drawDetail();
         toast('已把两档圆角和卡片间距恢复成出厂取值（配色与方案名没动）');
       }}, '恢复出厂取值')]);
  };
  p3box.appendChild(row('恢复出厂取值', h('div', { class:'fd-row' }, [
    h('button', { class:'fd-btn mini', title:'只把这套方案的两档圆角和卡片间距回到出厂那一档；配色、方案名和方案清单都不动',
      onclick:() => restoreFactory() }, '恢复出厂取值'),
    h('span', { class:'fd-hint' }, '只回数值：两档圆角回到出厂那一档、卡片间距回到自动，配色、方案名和方案清单一概不动。')])));
  start(LookLib.get() || LookLib.snapshot(LookLib.cur || '当前外观'));
  drawScheme(); drawDetail(); drawMing();
  /* 到点换轴 / 系统深浅变了 / 睡醒重认那一趟：这一屏开着就跟着重画（两只下拉的名单和那行小字都得跟着色卡走）。
     盒子已经随面板关掉了就自己把这根监听退掉 —— 外观这一档每建一回订一回，不退就攒一堆废监听，
     每次换轴都去翻一遍早就不在这儿的那一屏（前端侧那一栏重画走的是同一套路子）。 */
  const off = Ming.onChange(() => { if(document.body.contains(mingBox)) redrawPools(); else off(); });
  return box;
}
/* ---------- 定期备份（外30 戊组）：把数据层那一整个文件夹抄到他指定的地方 ----------
   抄这件事在主进程那颗 backup.cjs 里跑：这一层只管配置、摆界面、报账。
   默认抄的是 data\ 那一层整棵 —— 书、文稿、卡片、看板、逐字记录、插图、插件、词库，
   连同这个宿主的用户目录 data\userdata-fd\（明文 json 那几份配置）都在它底下，
   所以「用户数据」和「文稿」是一棵树上的两件事，不是两处地方。
   想再带上别的文件夹（比如导出去的文稿放在别处），加一条就行。
   表只摆一颗：这一趟抄完再摆下一颗；不是一遍遍地问现在几点。 */
const Backup = {
  cfg:{ on:false, every:'day', keep:8, dest:'', extra:[], skip:['logs','gen-log','日志'], 上一趟:'' },
  上回:'', 下一回:0, 表:0, 正:false,
  get 有(){ return !!(window.FD_APP && window.FD_APP.backupRun); },
  洗(c){
    const o = (c && typeof c === 'object') ? c : {};
    return { on:!!o.on, every:['off','day','3d','week'].includes(o.every) ? o.every : 'day',
      keep:Number.isFinite(+o.keep) && +o.keep >= 0 ? Math.min(60, Math.round(+o.keep)) : 8,
      dest:String(o.dest || ''), 上一趟:String(o.上一趟 || ''),
      extra:Array.isArray(o.extra) ? o.extra.filter(x => x && x.dir).map(x => ({ dir:String(x.dir), label:String(x.label || '') })) : [],
      skip:Array.isArray(o.skip) && o.skip.length ? o.skip.map(String) : ['logs','gen-log','日志'] };
  },
  async boot(){
    if(!this.有) return;
    try{ this.cfg = this.洗(Object.assign(this.cfg, await Store.loadJSON('backup.json', null))); }catch(e){}
    await this.账(); this.arm();
  },
  save(){ Store.saveJSON('backup.json', this.cfg); },
  /* 问一账：上一次抄到什么时候、到点没、下一颗表设到哪一刻（这些磁盘才知道） */
  async 账(){
    if(!this.有){ this.上回 = ''; this.下一回 = 0; return; }
    try{ const r = await window.FD_APP.backupCheck(this.cfg);
      this.上回 = (r && r.上回) || ''; this.下一回 = (r && r.下一回) || 0; }
    catch(e){ this.上回 = ''; this.下一回 = 0; }
  },
  arm(){
    clearTimeout(this.表); this.表 = 0;
    /* every 这一条要在这儿当场判：下一回那一刻是上一趟问出来的旧数，
       刚从「每天」拧成「不自动」的时候它还有值，不判这一句就会照旧摆一颗表出去 */
    if(!this.cfg.on || this.cfg.every === 'off' || !this.cfg.dest || !this.下一回) return;
    const 等 = this.下一回 - Date.now();
    this.表 = setTimeout(() => this.run('到点'), 等 > 0 ? 等 : 0);
  },
  async run(为什么){
    if(!this.有){ toast('定期备份要在 Flow-Desk 程序里才抄得了'); return null; }
    if(this.正){ toast('上一趟还没抄完'); return null; }
    if(!String(this.cfg.dest || '').trim()){ toast('先定备份到哪一个文件夹'); return null; }
    this.正 = true;
    let r = null;
    try{ r = await window.FD_APP.backupRun(this.cfg); }
    catch(e){ r = { ok:false, msg:'备份没走通：' + ((e && e.message) || e) }; }
    this.正 = false;
    this.cfg.上一趟 = 为什么 + ' · ' + (r && r.msg || '没报回话') +
      (r && r.坏 && r.坏.length ? ' · 没抄上 ' + r.坏.length + ' 个' : '');
    this.save();
    await this.账(); this.arm();
    toast(r && r.ok ? ('备份好了：' + r.msg) : ('备份没成：' + this.cfg.上一趟));
    return r;
  },
  /* 挑目录那一条不走页面那层假句柄：要的就是绝对路径那串字 */
  async 挑目录(){
    if(!window.FD_APP || !window.FD_APP.backupPick){ toast('挑文件夹要在 Flow-Desk 程序里'); return ''; }
    try{ return await window.FD_APP.backupPick() || ''; }catch(e){ toast(e.message); return ''; }
  }
};
function tabData(){
  const box = h('div', { style:'display:grid;gap:12px' });
  /* 一个文件一行：挤在一行里九个名字糊成一条，看不出到底存了哪几份 */
  const stat = h('div', { class:'fd-hint', style:'white-space:pre-line' });
  /* 第 22 条：这一格是异步问出来的，上回问到的先摆着，切回来不会空一下再长出来 */
  stat.textContent = SetCache.data;
  const refresh = async () => {
    const be = Store.backend();
    let files = [];
    try{ files = await Store.rawList(''); }catch(e){}
    /* 同上：字没变就不回写，切档回来不会白跳 */
    const s = be === 'idb'
      ? '后端：IndexedDB 镜像（未授权目录）· 已存 ' + files.length + ' 个文件\n连接目录后会把镜像里的数据迁移成明文文件。'
      : '后端：' + (be === 'app' ? 'exe 里的数据目录（' + Store.appDir + '\\）' : '你选的目录（' + Store.dirName() + '/）') +
        ' · 明文文件 ' + files.length + ' 个\n' + files.join('\n');
    SetCache.data = s;
    if(stat.textContent !== s) stat.textContent = s;
  };
  refresh();
  box.appendChild(row('存储位置', stat));
  box.appendChild(row('', h('div', { class:'fd-row' }, [
    h('button', { class:'fd-btn primary', onclick:async () => {
      try{ const n = await Store.connect(); Store.cache.clear(); await Store.flush(); refresh(); Shell.render(); toast('已连接目录：' + n); }
      catch(e){ toast(e.message); }
    }}, Store.backend() === 'app' ? '换到别的目录' : '选择 Flow-Desk 数据目录'),
    Store.dir ? h('button', { class:'fd-btn danger', onclick:async () => {
      if(!await fdAsk('断开「' + Store.dirName() + '」这个数据目录？里面那些文件一张不动，只是 Flow-Desk 不再从那儿读写，' +
        (Store.appDir ? '回到 exe 里那一份数据（' + Store.appDir + '\\）。' : '回到镜像模式（屏幕上看到的是 IndexedDB 里那一份）。'), '断开')) return;
      await Store.forget(); Store.cache.clear(); await refresh(); Shell.render();
      toast(Store.backend() === 'app' ? '已断开，回到 exe 里的数据目录' : '已断开目录，回到镜像模式');
    }}, '断开目录') : null])));
  /* 第 23 条：不受更新影响的那些东西，一篇明文清单里列全（数据层 userdata-list.md），点开现读 */
  box.appendChild(row('不受更新影响的', h('button', { class:'fd-btn', onclick:() => UserList.open() }, '用户数据详单')));
  box.appendChild(row('导出 / 导入', h('div', { class:'fd-row' }, [
    h('button', { class:'fd-btn', onclick:async () => {
      await Store.flush();
      const bundle = {};
      /* 带哪些明文：外壳这四个 + 每个装着的包在说明书里自己点名的（卸载掉的不掺和） */
      for(const rel of Packs.dataFiles(['appearance.json','layout.json','phrases.json'])) bundle[rel] = Store.cache.get(rel) || await Store.rawRead(rel);
      const a = h('a', { href:URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type:'application/json' })), download:'flow-desk-backup-' + fmtDate(new Date()) + '.json' });
      a.click(); toast('已导出备份 JSON');
    }}, '导出全部'),
    h('label', { class:'fd-btn', style:'display:inline-block' }, [h('span',{},'导入'), h('input', { type:'file', accept:'.json', hidden:true, onchange:async e => {
      const f = e.target.files[0]; if(!f) return;
      /* 先问再读：这一趟是把备份整个盖到现有数据上，盖完没有留底的地方 */
      if(!await fdAsk('导入「' + f.name + '」这份备份？备份里有的那些文件会把现在这一份全部盖掉 ——\n当前这些数据不留底，盖完就找不回来。', '导入并盖掉')) return;
      try{
        const bundle = JSON.parse(await f.text());
        for(const rel in bundle){ const v = bundle[rel]; Store.cache.set(rel, typeof v === 'string' ? JSON.parse(v) : v); Store.dirty.add(rel); }
        await Store.flush(); toast('导入完成'); setTimeout(() => location.reload(), 600);
      }catch(err){ toast('导入失败：' + err.message); }
    }})])])));
  /* ---------- 外30 戊组：定期备份那一块 ----------
     只摆配置和账：真抄在主进程那颗 backup.cjs 里，一份一个时间戳文件夹，
     抄完才改名收口 —— 新的一份还没收口时，上一份完整的连一个字节都没动。
     控件建一次就摆着：勾一下、改一个数都不许把整块重画 —— 那一画焦点就从他手上那颗控件掉走了
     （和目录那一栏闪烁、弹动是同一类病，改法也同一个：字变了就就地补那几个字，块不动）。 */
  box.appendChild(row('定期备份', (() => {
    const c = Backup.cfg;
    const blk = h('div', { style:'display:grid;gap:8px' });
    const 落字 = h('span', { class:'fd-hint', style:'user-select:all;font-family:ui-monospace,Consolas,monospace' }, '');
    const 落钮 = h('button', { class:'fd-btn', onclick:async () => {
      const p = await Backup.挑目录(); if(!p) return; c.dest = p; 改();
    } }, '');
    const 外加 = h('div', { style:'display:grid;gap:4px' });
    const 账行 = h('div', { class:'fd-hint', style:'white-space:pre-line' }, '');
    const 补 = () => {
      const 定 = String(c.dest || '').trim();
      落字.textContent = 定 || '（还没定）';
      落钮.textContent = 定 ? '换一处' : '定一个文件夹';
      外加.innerHTML = '';
      for(const x of c.extra) 外加.appendChild(h('div', { class:'fd-row', style:'gap:8px;align-items:center' }, [
        h('span', { class:'fd-hint' }, '外加'),
        h('span', { class:'fd-hint', style:'user-select:all;font-family:ui-monospace,Consolas,monospace' }, x.label + ' · ' + x.dir),
        h('span', { style:'flex:1' }),
        h('button', { class:'fd-btn', onclick:() => { c.extra = c.extra.filter(y => y !== x); 改(); } }, '去掉')
      ]));
      const s = '上一次抄的：' + (Backup.上回 || '还没抄过') + (c.上一趟 ? ' · ' + c.上一趟 : '') +
        (c.on && c.every !== 'off' && 定 && Backup.下一回 ?
          '\n下一份：' + new Date(Backup.下一回).toLocaleString() + (Backup.正 ? ' · 正抄着' : '') : '');
      if(账行.textContent !== s) 账行.textContent = s;
    };
    /* 改一处就：存盘 → 重新问一账（换了档、换了落点，下一回那一刻就跟着变了）→ 重摆表 → 补那几处字 */
    const 改 = async () => { Backup.save(); await Backup.账(); Backup.arm(); 补(); };
    blk.appendChild(h('div', { class:'fd-row', style:'flex-wrap:wrap;gap:8px;align-items:center' }, [
      h('label', { class:'fd-row', style:'gap:5px;align-items:center' }, [
        h('input', { type:'checkbox', checked:c.on, onchange:ev => { c.on = ev.target.checked; 改(); } }),
        h('span', {}, '开这一档')]),
      segCtrl([{ v:'day', t:'每天' }, { v:'3d', t:'每 3 天' }, { v:'week', t:'每周' }, { v:'off', t:'不自动' }],
        () => c.every, v => { c.every = v; 改(); }),
      h('span', { class:'fd-hint' }, '留'),
      h('input', { class:'fd-input', type:'number', min:'1', max:'60', style:'width:64px', value:String(c.keep),
        title:'留几份：多出来的收最旧那一份（只收这一档自己抄的那几颗）',
        onchange:ev => { const n = Math.max(1, Math.min(60, Math.round(+ev.target.value || 0))); c.keep = n; ev.target.value = String(n); 改(); } }),
      h('span', { class:'fd-hint' }, '份')
    ]));
    blk.appendChild(h('div', { class:'fd-row', style:'flex-wrap:wrap;gap:8px;align-items:center' }, [
      h('span', { class:'fd-hint' }, '备份到'), 落字, 落钮,
      h('span', { style:'flex:1' }),
      h('button', { class:'fd-btn primary', onclick:async () => { await Backup.run('手动'); 补(); } }, '立刻抄一份')
    ]));
    blk.appendChild(h('div', { class:'fd-row', style:'flex-wrap:wrap;gap:8px;align-items:center' }, [
      h('span', { class:'fd-hint' }, '抄的内容：数据层整棵 data\\（书、文稿、卡片、看板、逐字记录、插图、插件、配置）' +
        ' · 不抄 ' + c.skip.join(' / ')),
      h('span', { style:'flex:1' })
    ]));
    blk.appendChild(外加);
    blk.appendChild(h('div', { class:'fd-row', style:'gap:8px;align-items:center' }, [
      h('button', { class:'fd-btn', onclick:async () => {
        const p = await Backup.挑目录(); if(!p) return;
        const 名 = String(p).replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '外加';
        if(c.extra.some(x => x.dir === p)){ toast('这一处已经加过了'); return; }
        c.extra.push({ dir:p, label:名 }); 改();
      } }, '再加一处文件夹')
    ]));
    blk.appendChild(账行);
    补();
    Backup.账().then(补);                /* 磁盘上那一账是问出来的：先摆着，问到就补那两个字 */
    return blk;
  })()));
  /* 批⑤-6 · 界面文字清单：摆在「数据」这一档（第 14 条的旧提示语页删了，改字走这份明文清单）。
     一个地方一行、出处写在行首；「把改动写进程序」先出改动清单，确认了才动源码并重新生成页面。
     #251 · 卡片大小清单摆在它下边：一行一张卡片，同一套按钮、同一套确认和重启提醒 ——
     两份清单共用下面这一包对话框接法。桌面卡片只有 Flow-Desk 有，这一份只摆在这一边。 */
  const listDlg = {
    base:{ row:'fd-row', btn:'fd-btn', input:'fd-input', hint:'fd-hint' },
    dlg(title, body, okText){
      return new Promise(res => {
        let yes = false;
        Modal.open(title, body, [
          h('button', { class:'fd-btn', onclick:() => Modal.close() }, '取消'),
          h('button', { class:'fd-btn primary', onclick:() => { yes = true; Modal.close(); } }, okText)
        ], () => res(yes));
      });
    },
    /* 写进程序之后问一句：立刻重启还是稍后自己重启（各窗口刷新也能见到新字，只是菜单托盘要重启才换） */
    askRestart(msg){
      return new Promise(res => {
        Modal.open('改动已经写进程序', h('div', { style:'display:grid;gap:8px;min-width:380px' }, [
          h('div', {}, msg),
          h('div', { class:'fd-hint' }, '立刻重启 Flow-Desk，所有窗口、菜单和托盘一次换成新的；选稍后就先干活，回头自己关一次再开也一样。')
        ]), [
          h('button', { class:'fd-btn', onclick:() => { Modal.close(); res('later'); } }, '稍后手动重启'),
          h('button', { class:'fd-btn primary', onclick:() => { Modal.close(); res('now'); } }, '立刻重启')
        ], () => res('later'));
      });
    },
    restart(){ return window.FD_APP && window.FD_APP.restartApp ? window.FD_APP.restartApp() : { ok:false }; }
  };
  box.appendChild(row('界面文字', Txt.settingsRow(listDlg)));
  box.appendChild(row('卡片大小', SizeCfg.settingsRow(listDlg)));
  /* ---------- 外42 二 · 一键清理所有用户数据 ----------
     三次确认：点这一颗算第一次，后面两道各问一句（那两句就是他给的原话，不添小字）。
     真删不在这一趟：浏览器存储那一格此刻正被内核占着，当场删一半比不删更糟 —— 所以只排一张字条，
     下一趟开机在任何数据落地之前整格清掉（主进程文件顶上 userWipe 那一段）。 */
  box.appendChild(row('清理', h('div', { class:'fd-row', style:'align-items:center;gap:10px' }, [
    h('button', { class:'fd-btn danger', onclick:async () => {
      if(!window.FD_APP || !window.FD_APP.dataWipe){ toast('清理要在 Flow-Desk 程序里'); return; }
      if(!await fdAsk('删除后无法从软件中找回，除非您已另有完整备份', '继续')) return;
      if(!await fdAsk('您确定要删除吗？', '删除')) return;
      const r = await window.FD_APP.dataWipe();
      if(!r || !r.ok){ toast((r && r.msg) || '清理没排下去'); return; }
      if(await listDlg.askRestart('清理排下了：重启之后就是刚装好的样子。') === 'now') await listDlg.restart();
    }}, '一键清理所有用户数据'),
    h('span', { class:'fd-hint' }, '删的是数据层那一格里属于你的东西（书、文稿、卡片、看板、逐字记录、插图、色卡与外观方案、界面文字与卡片大小那两份清单、浏览器存储）· 留着插件、日志、搬家账本')
  ])));
  return box;
}
/* 设置 · 日程那一档（含标签编辑）跟着日程包走，在 fd5-schedule.js 里登记 */
/* ---------- 设置 · 程序：只有 app 版出现，管的是壳的行为 ---------- */
function tabProgram(){
  const box = h('div', { style:'display:grid;gap:14px' });
  const seg = h('div', { class:'fd-seg' });
  const OPTS = [['ask', '问问我'], ['tray', '最小化到托盘'], ['quit', '直接退出']];
  let cur = SetCache.close;
  const draw = () => {
    if(!cur){ seg.innerHTML = ''; return; }
    seg.innerHTML = '';
    for(const [v, t] of OPTS) seg.appendChild(h('button', { class: cur === v ? 'on' : '', onclick: async () => {
      const got = await window.FD_APP.setCloseChoice(v);
      cur = SetCache.close = got || v; draw();
    }}, t));
  };
  /* 上回问到的那份先画出来；头一回进来等答到齐再画，不先摆一版猜的再改 */
  draw();
  window.FD_APP.closeChoice().then(m => { if(m && m !== cur){ cur = SetCache.close = m; draw(); } });
  box.appendChild(row('关闭时', seg));
  /* 关于这一小节摆的是本机这一份的号和东西在哪儿，这两样都要问 Flow-Desk.exe 那一层，它不在就不摆 */
  if(window.FD_APP.aboutInfo) aboutRows(box);
  return box;
}
/* ---------- 关于：三个版本号 · 数据在哪儿 ----------
   更新不在这一格里了（外44 四）：从前这里有一颗「挑更新包」的钮，吃一个 FlowDesk_update_*.zip，
   由 updater.cjs 等程序关干净了挪文件。那条路整条撤了 —— 主程序换版就双击一颗新的
   Flow_Desk_setup_<版本号>.exe，指到同一棵树上点「覆盖升级」；zip 那种形状只留给插件用。
   被覆盖升级换下来的旧东西落在 update\backups\<时间戳>\，那一格里没有用户写的东西，
   所以把最近的几趟列出来，让人知道旧版去哪儿了。data\ 从头到尾不参与。 */
/* 为写和声笔输入法练习的版本号从各自那一份内核要：它们不再是 pages\ 里的独立页面，
   代码拼在 Flow-Desk 这一张页里，独立页面的文件名早就不存在了。 */
function kernelVersion(which){
  const k = which === 'wnw' ? window.WNW_KERNEL : window.RP_KERNEL;
  return (k && k.version) || '没装';
}
function aboutRows(box){
  /* 第 22 条：这格跟「数据」那档一样是异步问出来的 —— 上回问到的先摆在原地（SetCache.about），
     内容一个字没变就别回写：回写会把文本节点拆了重搭，看着就是白跳一下。 */
  const about = h('div', { class:'fd-hint', style:'white-space:pre-wrap' }, SetCache.about);
  const put = s => { if(about.textContent !== s) about.textContent = s; };
  window.FD_APP.aboutInfo().then(r => {
    if(!r || !r.ok){ put((r && r.msg) || '版本信息没读到'); return; }
    const v = r.versions || {};
    /* 装着的每一家一行，号取运行时真正加载的那一份清单文件（发布那一趟已经把真号写回它）；
       没写号的那一格照实说「清单里没写号」，不编一个数出来。 */
    const 家 = (r.packs || []).map(p => p.name + '　' + (p.version || '清单里没写号')).join('\n');
    put(SetCache.about = 'Flow-Desk ' + (v.fd || '?') + '　为写 ' + kernelVersion('wnw', '?') +
      '　声笔输入法练习 ' + kernelVersion('rp', '没装') + '\n数据在这儿：' + r.data +
      '\n页面在这儿：' + r.pages + '（换版换这一层，数据那一层一个字都不动）' +
      (家 ? '\n\n装着的：\n' + 家 : '') +
      (r.backups && r.backups.length ? '\n\n最近的升级备份：' + r.backups.slice(0, 3).join(' · ') : ''));
  });
  box.appendChild(row('关于', about));
}
/* ---------- 第 24 条：快捷键 ----------
   只列窗口里面用得上的键。程序不抢后台全局快捷键 —— 窗口没焦点时一个都不响应，
   原来那个 Ctrl+Alt+F 已经从 main.cjs 的 APPS 里拿掉了。
   冲突不主动查：查一遍得把三个页面的键位都常驻着比对，白占内存也白占时间，
   按拍板在这儿留一句提醒就行。
   标「窗口」的那几个快捷键是 Flow-Desk.exe 窗口的键（开发时那一开法里这几个键归页面自己）。
   卡片里那两家（为写、声笔输入法练习）各自还有一套自己的键，不在这一张清单里：
   为写那一套列在它自己设置的「快捷键」档里。 */
function tabKeys(){
  const box = h('div', { style:'display:grid;gap:10px' });
  for(const [k, t] of [
    ['Ctrl / ⌘ + S', '保存当前这一层：便签、日程这些带「保存」按钮的地方'],
    ['Ctrl + Enter', '便签里存这一段'],
    ['Esc', '关掉当前的对话框或覆盖层'],
    ['F11', '全屏（窗口）'],
    ['Ctrl / ⌘ + R', '重新载入页面，按住 Shift 是不读缓存的那种（窗口）'],
    ['Ctrl / ⌘ + = / - / 0', '整页放大 / 缩小 / 复原（窗口）'],
    ['Ctrl / ⌘ + Q', '退出（窗口）']
  ]) box.appendChild(row(k, h('span', {}, t)));
  box.appendChild(h('div', { class:'fd-hint' }, '全局快捷键：没有。窗口没焦点时程序不接任何键，原来那个 Ctrl+Alt+F 也已经拿掉了。'));
  box.appendChild(h('div', { class:'fd-hint' }, '为写、声笔输入法练习各自还有一套自己的键，不在这一张清单里；为写那一套在它设置的「快捷键」档里。'));
  box.appendChild(h('div', { class:'fd-hint' }, '请注意避免快捷键冲突。'));
  return box;
}
/* 第 14 条那一套旧「提示语」档已经删掉：界面上的字改走 数据\ui-text.yaml 界面文字清单
   （一个地方一行，写了存盘立刻跟着变），那一行摆在下面「数据」这一档里。 */
/* 「组件」那一档也一起退了：档里原本摆的是各家组件垫进来的设置行，
   现在那几行都搬回插件自己的设置对话框（日程的四行、启动卡的地址、音乐控件的播放器与文件夹），
   入口在自己卡片标题条的齿轮上。 */
