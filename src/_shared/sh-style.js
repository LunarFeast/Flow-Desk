/* ============================================================
   中立工具样式 · 组件定制生成的那些功能在 WNW 和 FD 里长一样
   这几条规则原来写在 WNW 的外壳和模板里，剥出来只留一份：
     · WNW 侧 w3-shell.js / template.html 不再定义这些类（尺寸与原来逐像素相同）
     · FD 侧卡片要整体等比缩，靠 fd8-tools.js 的 transform 缩放盒，所以这里保持 px
     · 圆角/描边/间距吃宿主变量，FD 没有的变量给字面量兜底
   ============================================================ */
(function(){
  const CSS = `
.sh-pane{display:flex;gap:14px;align-items:flex-start;min-height:100%;--sh-gap:10px;--sh-form-w:58%;}
.sh-pane > .sh-col{min-width:0;}
.sh-pane > .sh-form{flex:0 0 var(--sh-form-w,460px);min-width:200px;}
.sh-pane > .sh-out{flex:1 1 auto;position:sticky;top:0;}
/* 组件定制：对话框里给一块固定高的地方，左向导右预览各滚各的 */
.gw-pane{height:74vh;align-items:stretch;}
.gw-pane > .sh-col{overflow:auto;min-height:0;}
.gw-pane > .sh-out{position:static;}
/* 向导右边那份源码：占满剩余高度，等宽，能整块滚 */
.gw-src{width:100%;height:calc(74vh - 116px);resize:none;font-family:var(--ff-code,ui-monospace,Consolas,monospace);
  font-size:.857em;line-height:1.6;white-space:pre;}
/* 左右分栏条：按位置算比例，宿主把整块缩放（FD 小卡）也一样准 */
.sh-split{flex:0 0 10px;align-self:stretch;cursor:col-resize;position:relative;touch-action:none;}
.sh-split::after{content:"";position:absolute;left:4px;top:6px;bottom:6px;width:2px;border-radius:var(--r-pill,5px);
  background:var(--hair-color);opacity:.75;transition:background .12s,opacity .12s;}
.sh-split:hover::after,.sh-split.on::after{background:var(--accent);opacity:1;}
/* 展开 / 够大时左右两栏各滚各的；小卡不开这一档，仍然整体缩小到 9px 截断 */
.sh-tools[data-scroll="1"]{display:flex;flex-direction:column;min-height:0;overflow:hidden;}
.sh-tools[data-scroll="1"] .sh-pane{flex:1 1 auto;min-height:0;align-items:stretch;}
.sh-tools[data-scroll="1"] .sh-pane > .sh-col{overflow:auto;min-height:0;max-height:100%;}
.sh-tools[data-scroll="1"] .sh-pane > .sh-out{position:static;}
.sh-tools[data-scroll="1"] .sh-col::-webkit-scrollbar{width:8px;}
.sh-tools[data-scroll="1"] .sh-col::-webkit-scrollbar-thumb{background:var(--scrollbar,var(--hair-color));border-radius:var(--r-pill,5px);}
/* WNW 停靠里：面板自己不再整块滚，滚动交给里面的左右两栏
   丁-1：overflow 从前写 hidden，和 w0-skin.js 那条 overflow:auto 权重相同、靠书写顺序决胜 ——
   这一格于是「既不滚也看不见」。多写一层 .wnw-root 把权重钉死，不再赌谁先加载；
   hidden 改成 auto：左右分栏那种撑得下的照旧各滚各的（不溢出就不出条），直排内容溢出的那一截滚得到。 */
.wnw-root .wnw-dock-body[data-scroll="1"]{display:flex;flex-direction:column;min-height:0;overflow:auto;}
.wnw-root .wnw-dock-body[data-scroll="1"] > .sh-pane{flex:1 1 auto;min-height:0;}
/* 丙-1 停靠两栏：两栏等宽靠 flex 分，不写死像素；每栏自己滚，滚的不再是整条列表 */
.wnw-root .wnw-dock-list.two{flex-direction:row;align-items:stretch;overflow:hidden;}
.wnw-root .wnw-dock-col{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:10px;overflow:auto;
  border-radius:var(--r-card,5px);}
/* 拖拽的落点：从前这三条写在 w10-cards.js 里，选择器少打一个空格（.wnw-root.dnd-out），
   从来没匹配上过，所以换序一直是盲投。这里按停靠这一套补三条真能落地的。 */
.wnw-root .wnw-dock-card.dnd-out{opacity:.4;}
.wnw-root .wnw-dock-card.dnd-tgt{background:var(--candidate-bg);}
.wnw-root .wnw-dock-card.dnd-tgt[data-dnpos="before"]{box-shadow:inset 0 3px 0 0 var(--accent);}
.wnw-root .wnw-dock-card.dnd-tgt[data-dnpos="after"]{box-shadow:inset 0 -3px 0 0 var(--accent);}
/* 落在哪一栏就整栏亮一圈：光看插入线认不出已经换到另一栏去了 */
.wnw-root .wnw-dock-col.dnd-col{background:var(--candidate-bg);box-shadow:inset 0 0 0 2px var(--accent);}
/* 描边口径（2026-10-04，设计债报告 5.3 那一条）：宿主这几处按钮、输入框、标签、分段选择的描边，
   从前写 var(--bw) solid var(--input-border)。
   --input-border 是配色那一份里的 1px 灰线，量出来只有 1.x 的对比，够不着边界对「非文字要 3:1」那条；
   --bw 在质感那一档是 0，这一档下这条边当场没了。真身是外观层现算的那条 --ctl-edge
   （宽度 1px 固定、颜色按当前配色 + 外观模式推到 3:1 以上），样式表 EDGE 那一串已经统一发它。
   所以这里全改成同一个写法：1px solid var(--ctl-edge,var(--input-border)) —— 读得到就用现算的，
   读不到（外观那一趟还没跑到的首帧）才退回配色里的旧值，不留一条永远不生效的死规则。 */
.wnw-btn{border:1px solid var(--ctl-edge,var(--input-border));background:var(--btn-bg);color:var(--text);
  border-radius:var(--r-btn,5px);padding:5px 12px;cursor:pointer;line-height:1.5;white-space:nowrap;}
.wnw-btn:hover{border-color:var(--text);}
.wnw-btn.primary{background:var(--sel-bg);color:var(--sel-text);border-color:transparent;font-weight:700;}
.wnw-btn.mini{padding:2px 9px;font-size:.8571em;border-radius:var(--r-btn,5px);}
/* 列表行尾那个眼睛：不带框不带底，就是线条图标本身，悬停才实 */
.wnw-btn.mini.ico{padding:2px 4px;border:0;background:none;opacity:.5;display:inline-flex;align-items:center;}
.wnw-btn.mini.ico:hover{opacity:1;border:0;}
.wnw-btn.mini.ico.off{opacity:.85;}
.wnw-btn.on{background:var(--accent-light);color:var(--accent-text,var(--accent));border-color:var(--loaded-border);font-weight:700;}
.wnw-hint{color:var(--text-light);font-size:.8571em;line-height:1.6;}
/* 工具区内自己的竖向间距用 --sh-gap：宿主 FD 的 --gap 是格子间距，能小到 4px，
   跟着它走上下控件就贴成一条线了 */
.wnw-row{display:flex;gap:var(--sh-gap,10px);align-items:center;flex-wrap:wrap;}
.wnw-col{display:grid;gap:var(--sh-gap,10px);}
.wnw-card{border:var(--bw,1px) solid var(--card-border);border-radius:var(--r-card,5px);background:var(--card-bg);padding:14px 16px;
  display:grid;gap:var(--sh-gap,var(--gap,10px));align-content:start;}
/* 分栏里这一列写成 minmax(0,1fr)：默认 auto 轨道的最小宽度是内容的 min-content，
   而下拉框的固有宽就是它最长那条选项（实测 306px）—— 分隔条一往左拉，整列被顶宽，
   控件就横跨分隔条溢到右栏那边。轨道允许缩到 0，控件才跟着栏一起缩。
   只管 .sh-pane 以内：WNW 的素材卡、编辑器里也用 wnw-card/wnw-col，那边不碰。 */
.sh-pane .wnw-card,.sh-pane .wnw-col{grid-template-columns:minmax(0,1fr);}
/* 相邻两张卡之间留够呼吸；卡内间距不动 */
.wnw-card + .wnw-card{margin-top:18px;}
/* 网格里的卡片归 gap 管（实测第一张被这条 margin 顶出 90px，整行错位） */
.wnw-grid > .wnw-card,.wnw-grid > .wnw-card + .wnw-card{margin-top:0;}
.wnw-card h4{margin:0;font-size:1em;}
.wnw-field{display:flex;gap:var(--sh-gap,var(--gap,10px));align-items:center;}
.wnw-field > label,.wnw-field > span{flex:0 0 auto;min-width:6.5em;font-size:.8571em;color:var(--text-light);text-align:right;white-space:nowrap;}
.wnw-field > *{flex:1 1 auto;min-width:0;}
/* 件-4：一格控件外面套这一层，不合格那句话写在这格下面（拦生成的走 --bad，只提一句的走 --warn，都由外观层保证对比下限） */
.sh-cell{display:grid;grid-template-columns:minmax(0,1fr);gap:2px;min-width:0;}
.sh-err{color:var(--bad,#c0453a);font-size:.8571em;line-height:1.5;}
.sh-err.warn{color:var(--warn,#9a6a1e);}
.sh-err:empty{display:none;}
.wnw-out{white-space:pre-wrap;line-height:1.75;font-size:.9286em;margin:0;}
/* ---------- 第 14 条：设置里旧「提示语」那一页（WNW / FD 共用这一套） ----------
   一句一行：左边是源码里的原话，长了省略号收着（悬停看全，走第 7 条那套），
   右边那个框写用户改后的；框子空着就是没改，placeholder 把原话当影子显示。
   .sh-on 是「这一档正在编辑」那个按钮的实底，FD 没有 .fd-btn.on，所以两边都认这一个。 */
.sh-on{background:var(--accent-light);color:var(--accent-text,var(--accent));border-color:var(--loaded-border);font-weight:700;}
.sh-ph{display:flex;flex-direction:column;gap:10px;min-width:0;}
.sh-ph-q{flex:1 1 14em;min-width:0;}
.sh-ph-list{display:flex;flex-direction:column;gap:6px;min-width:0;}
.sh-ph-row{flex-wrap:nowrap;align-items:center;}
.sh-ph-key{flex:1 1 42%;min-width:0;color:var(--text-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sh-ph-val{flex:1 1 42%;min-width:0;}
/* 结果块和模块块进外观层的表面名单：底色那一层由 src\_shared\sh-look.js 画，这里不再自己铺 --card-bg */
.wnw-result{border:var(--bw,1px) solid var(--card-border);border-radius:var(--r-card,5px);
  padding:12px 14px;margin-bottom:12px;}
.wnw-chip{display:inline-flex;align-items:center;gap:4px;border-radius:var(--r-pill,5px);padding:1px 9px;font-size:.8095em;
  background:var(--candidate-bg);border:var(--bw,1px) solid var(--card-border);}
/* 带 × 的模块 / 条目按钮：底色走按钮色，别和卡片、模块底糊成一片 */
.wnw-chip.sh-chip{padding:2px 3px 2px 10px;gap:2px;background:var(--btn-bg);border-color:var(--ctl-edge,var(--input-border));}
.sh-chip > .sh-x{border:0;background:transparent;color:var(--text-light);cursor:pointer;
  padding:0 4px;border-radius:var(--r-pill,5px);font:inherit;line-height:1.5;}
.sh-chip > .sh-x:hover{background:var(--accent);color:var(--sel-text);}
.sh-chips select{flex:0 1 auto;width:auto;max-width:12em;}
/* 模块块：标题一行，条目按钮一格一个，随机/手填在按钮右边 */
.sh-mod{margin-top:12px;padding:10px 12px;border-radius:var(--r-card,5px);
  display:grid;grid-template-columns:minmax(0,1fr);gap:8px;}
/* 列宽下限写成 min(230px,100%)：栏窄于一格时列跟着栏退化，控件缩下去而不是溢出去 */
.sh-fgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(230px,100%),1fr));gap:8px 10px;}
.sh-fcell{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;min-width:0;}
.sh-fcell > select,.sh-fcell > input{width:100%;}
.sh-mode{flex:0 0 auto;}
.sh-mode button{padding:2px 9px;font-size:.8095em;}
/* 成组收起、分页签摆：收起来的只是外观，控件照样建出来、照样取值 */
.sh-mod-body{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;min-width:0;}
.sh-fold{justify-self:start;display:inline-flex;align-items:center;gap:4px;}
.sh-tabs{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;min-width:0;margin-top:12px;}
.sh-tabbar{gap:4px;}
/* 表格那一档：窄栏装不下就整张表横向滚，不把列压成一条缝 */
.sh-tablewrap{overflow-x:auto;}
.sh-table{border-collapse:collapse;width:100%;font-size:.95em;}
.sh-table th,.sh-table td{border:var(--bw,1px) solid var(--card-border);padding:4px 8px;text-align:left;vertical-align:top;}
.sh-table th{background:var(--btn-bg);font-weight:700;white-space:nowrap;}
/* 分段选择：宽度仍跟着 --bw 走（质感那一档把外框收成 0 是这一档的定义，靠影子分高低），
   只有颜色归到现算的那条细边。 */
.wnw-seg{display:inline-flex;flex:0 0 auto;white-space:nowrap;border:var(--bw,1px) solid var(--ctl-edge,var(--input-border));border-radius:var(--r-btn,5px);overflow:hidden;}
.wnw-seg button{border:0;background:var(--btn-bg);padding:4px 12px;cursor:pointer;}
.wnw-seg button.on{background:var(--sel-bg);color:var(--sel-text);font-weight:700;}
.wnw-seg button:disabled{opacity:.45;cursor:default;}
/* 档位多的那几排（关系的「算哪一档」七颗、时间读法）：窄窗口里装不下要能换行。
   上面那条 .wnw-seg 的 flex:0 0 auto 和 .wnw-field > * 的 flex:1 1 auto 权重相同、
   写在它后面，所以那一排的宽度永远等于内容宽度 —— 装不下就顶出面板边界（图5）。
   这一档只有点名要换行的地方才挂，别的分段按钮照旧不缩、不换行。 */
.wnw-seg.wrap{flex:1 1 auto;min-width:0;flex-wrap:wrap;height:auto;}
/* 表单控件只在工具区内接管，别溅到宿主的其余界面上。
   选择器认「input 减去那几种自绘类型的」，原来只列了四种 type，
   date / time / color / 裸 input 全都漏在外面，深色主题下就是几块白斑。
   边框这一条从前写 var(--bw) solid var(--input-border)，和输入框那一条一模一样的毛病：
   质感那一档的 --bw 是 0，这条边当场没了 —— 而这一圈正是刚算出来的那条 3:1 细边
   （--ctl-edge，和样式表里 EDGE 那一串同一个色号）。所以宽度钉死 1px，颜色走 --ctl-edge，
   读不到（外观那一趟还没跑到的首帧）才退回配色里的 --input-border。 */
.sh-tools select,.sh-tools textarea,.sh-tools input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]){
  font:inherit;color:var(--text);background:var(--input-bg);
  border:1px solid var(--ctl-edge,var(--input-border));border-radius:var(--r-btn,5px);padding:4px 8px;min-width:0;}
.sh-tools textarea{resize:vertical;line-height:1.6;}
/* FD 的对话框没有 .sh-tools 这层包装：里面没带类名的 select / textarea / input 在深色下就是白斑。
   带 fd-input / wnw-input 的控件自有样式，不碰。边框同理走 --ctl-edge，见上面那一段。 */
.fd-dialog select:not(.fd-input):not(.wnw-input),.fd-dialog textarea:not(.fd-input):not(.wnw-input),
.fd-dialog input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not(.fd-input):not(.wnw-input){
  font:inherit;color:var(--text);background:var(--input-bg);
  border:1px solid var(--ctl-edge,var(--input-border));border-radius:var(--r-btn,5px);padding:4px 8px;min-width:0;}
/* 勾选框、单选、滑尺这几种系统自己画的：跟着主强调色走，别再留系统蓝 */
.sh-tools input[type=checkbox],.sh-tools input[type=radio],.sh-tools input[type=range]{accent-color:var(--accent);}
/* .wnw-input 是向导和设置里那些输入框的名字，宿主两边共用，FD 原本没有这条 */
.wnw-input{font:inherit;color:var(--text);background:var(--input-bg);
  border:1px solid var(--ctl-edge,var(--input-border));border-radius:var(--r-btn,5px);padding:4px 8px;min-width:0;}
input[type=checkbox],input[type=radio],input[type=range]{accent-color:var(--accent);}
/* 聚焦：描边走主色，底色往强调色的浅调微微提一点。
   2026-10-04 这里原本写着 outline:none，把外观层统一给的那圈 2px 焦点框顶掉了
   （无障碍 C-6）—— 删掉；同一条里那圈 1px 强调色的 box-shadow 也一并撤了，
   焦点框只留外观层那一处真身，不叠两层。 */
.sh-tools select:focus,.sh-tools input:focus,.sh-tools textarea:focus{
  border-color:var(--accent);
  background:color-mix(in srgb,var(--input-bg) 90%,var(--accent-light));
}
/* ---------- 外13-O：「一排颜色里挑一个」的统一选中语言（外15 改轻）----------
   认这一串类名：为写的色点（button.wnw-dot：卡片标记色、选项色位、白板节点/连线色点、书封面色）、
   高亮色位（button.wnw-slot：自定义高亮规则、颜色对话框里的标记色排）、
   Flow-Desk 与日程共用的色点（button.fd-dot：标记色池、日程条色位）。
   选中那一个只画外面一圈环，色点自己那一小块面一个像素都不盖：
     描边 —— 外面两道：先一圈卡面色把色点和周围隔开（0 0 0 2px），再一圈正文色实线收口（0 0 0 3px）；
        走 --text 不走 --accent，和工具条那排强调色线不打架，深浅两档自己会翻。
   外13-O 那两遍还画过的内圈那一圈环、点中心那枚勾，2026-10-05 撤了 —— 两件都落在色点身上，
   14~15 的一个点被盖掉中间一圈，看不出这一个到底是什么颜色。
   没选中的那几个一起降到 .55（从前 .5→1 那一档差不叫确认感）。
   焦点框与选中态走两条不同的视觉通道，不打架、也都不许回退：焦点是外观层那条 2px outline
   （外11-A / 外11-E / 外9-E 定的那一条），选中是上面那一圈环；两者同时落在同一个上时
   焦点框外扩到 4px，两条环看得清是两条。
   真身数值与 src\_\shared\sh-look.js 的 PICK 那一组一致（那边按当前配色现算，压过这一份）；
   这一份是共享样式层的底座，首帧和外观层还没跑到的宿主也长一个样。 */
button.wnw-dot,button.wnw-slot,button.fd-dot{position:relative;}
button.wnw-dot:not(.on),button.wnw-slot:not(.on),button.fd-dot:not(.on){opacity:.55;}
/* 色卡那一屏（.fd-dots-pool）例外：一屏几百颗，挑中一颗不许把其余压淡（作者 2026-10-09 的话），
   选中只靠下面那一圈环。真身数值与 src\_\shared\sh-look.js 那一条一致。 */
.fd-dots-pool button.fd-dot:not(.on){opacity:1;}
button.wnw-dot.on,button.wnw-slot.on,button.fd-dot.on{opacity:1;
  box-shadow:0 0 0 2px var(--card-face,var(--card-bg)),0 0 0 3px var(--text);}
button.wnw-dot.on:focus-visible,button.wnw-slot.on:focus-visible,button.fd-dot.on:focus-visible{outline-offset:4px;}
/* 自绘下拉里「这一条正被选用」（外观方案·配色·色卡那一排色点预览旁边的整条选中）：
   同一套语言里的勾那一件 —— 行摆不出圆环，就只挂勾，勾色吃正文色。 */
.fd-sel-item.on::after.on::after{content:"";flex:0 0 auto;width:7px;height:3.5px;margin-left:6px;
  border-left:2px solid var(--text);border-bottom:2px solid var(--text);transform:rotate(-45deg) translateY(-2px);}
`;
  if(document.getElementById('sh-tool-style')) return;
  const n = document.createElement('style');
  n.id = 'sh-tool-style';
  n.textContent = CSS;
  document.head.appendChild(n);
})();

/* ---------- 左右分栏条 ----------
   比例按"宿主 + 工具"各记一份：FD 首页卡和 WNW 停靠区分开存，互不覆盖。
   按下时分头拦住 pointer 事件往下传，宿主的长按拖卡 / 拖拽不能把它抢走。
   第四个参数能给这一条单独定默认宽和拖动上下限（改词库的左列就比生成器的左栏窄）。 */
const SH_SPLIT_DEF = .58, SH_SPLIT_MIN = .24, SH_SPLIT_MAX = .78;
const SH_SPLIT_MEM = {};
function shSplit(pane, form, key, opt){
  const lim = Object.assign({ def:SH_SPLIT_DEF, min:SH_SPLIT_MIN, max:SH_SPLIT_MAX }, opt || {});
  const clamp = p => Math.max(lim.min, Math.min(lim.max, p));
  const set = p => pane.style.setProperty('--sh-form-w', (p * 100).toFixed(2) + '%');
  /* 面板每次重画都重建这条分隔条：记住上次量到的比例，避免一画就闪回默认值 */
  let cur = SH_SPLIT_MEM[key] === undefined ? lim.def : SH_SPLIT_MEM[key];
  set(cur);
  if(SH_SPLIT_MEM[key] === undefined) State.get(key, lim.def).then(v => {
    if(typeof v === 'number' && v > .1 && v < .95){ cur = clamp(v); SH_SPLIT_MEM[key] = cur; set(cur); }
  });
  const bar = h('i', { class:'sh-split', 'data-nodrag':'1', title:'拖动调整左右比例' });
  if(form.nextSibling) pane.insertBefore(bar, form.nextSibling); else pane.appendChild(bar);
  bar.addEventListener('pointerdown', ev => {
    if(ev.button !== 0) return;
    ev.preventDefault(); ev.stopPropagation();
    const rect = pane.getBoundingClientRect();
    if(!(rect.width > 40)) return;
    bar.classList.add('on');
    try{ bar.setPointerCapture(ev.pointerId); }catch(e){}
    const move = e => {
      e.stopPropagation();
      cur = clamp((e.clientX - rect.left) / rect.width);
      set(cur);
    };
    const up = () => {
      bar.classList.remove('on');
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
      bar.removeEventListener('pointercancel', up);
      SH_SPLIT_MEM[key] = Number(cur.toFixed(4));
      State.set(key, SH_SPLIT_MEM[key]);
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
  });
  return bar;
}
/* 分栏记在哪个宿主身上：FD 和 WNW 的 TOOL_HOST 各自带一个 id */
function shSplitKey(which){
  const host = window.TOOL_HOST || {};
  return 'split.' + which + '.' + (host.id || 'fd');
}
