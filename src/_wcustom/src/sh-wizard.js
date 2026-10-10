/* ============================================================
   组件定制 · WNW 和 FD 共用这一份
   三块：功能模块（界面结构件拼）→ 判断逻辑（生成时怎么挑怎么裁）→ 输出（出法 + 模板）；
   功能模块用五个结构件拼：控件 / 一行并列 / 成组 / 纯文本 / 组循环；出法两选一：列表组合 / 文本组合；
   控件功能十九种（开关 / 滑杆 / 区间随机数 / 生成式下拉 / 格式模板这五种是后补的，
   多选勾选 / 整段文本 / 输入即筛 / 颜色 / 日期时刻这五种照 Ant Design 对照补的），加上组循环正好二十种。问完就是一张配方。
   判断逻辑一共十八条，预设一股脑全摆上，不要哪条点「删」；每条都在 sh-gen.js 里真的参与生成，
   配方不写规则就一律按老样子出。界面上分两组摆：剔掉不合格的那几条一组，管出不出、出几条、怎么排、内容怎么改的一组。
   其中「条件分支」是唯一只做决定的一条：它自己不开词库、不改值，一块只管自己那几件事，
   谁消费这个决定谁自己去取（改分类 / 换拼法 / 不要哪几格 / 换条数 / 插一行 各在各的位置）。
   产物两份：这一家自己那一格（data\plugins\<id>\）里的 main.js 就是加载器 import 的那一份，
   同一格的 recipe.json 是这张配方的明文；说明书 manifest.json 新建时补一份，之后跟着配方改名字和简介。
   写这一格有两条通道：Flow-Desk 程序问主进程，本地开发那台服务器问 /_comp，落的是同一个文件。
   这台机器连不上那一格时（没有主进程也没起开发服务器）配方镜像进宿主 kv，
   页面下次打开照样把它装回来，界面不至于空着。
   那张配方从头到尾是明文数据，由解释器 Gen 读着生成，不 eval。
   入口两处：FD「添加插件」那格、WNW 设置·功能。
   宿主契约：h() toast() State BankDlg Gen GenView GenLog Banks bankWhich mkBank 和 TOOL_HOST.dlg。
   ============================================================ */
const GW_FNS = [
  ['cat2', '二级下拉'], ['cat3', '三级联动下拉'], ['thru', '穿透下拉'], ['fuse', '融合/联动下拉'],
  ['extract', '文本提取计数'], ['num', '数字指定'], ['numShow', '数字展示'], ['input', '文本输入'],
  ['rand', '可修改随机'], ['sw', '开关'], ['range', '滑杆'], ['rng', '区间随机数'],
  ['dyn', '生成式下拉'], ['fmt', '格式模板'],
  ['multi', '多选勾选'], ['tarea', '整段文本'], ['sift', '输入即筛'], ['color', '颜色'], ['date', '日期时刻']
];
const GW_T0 = {
  cat2:'一个或几个分类并成一套选项', cat3:'先选大类，再选大类底下的项', thru:'这一类连它底下所有子类的词条',
  fuse:'词库分类 / 别处切出来的字段 / 写死几项，并成一套', extract:'按分隔符切字段，顺手数出几段',
  num:'中间手打，右边 +1 +10', numShow:'把别处的数字摆在这儿看', input:'自己打，原样进结果',
  rand:'文本框带一个随机按钮：点一下从指定分类抽一个，抽完还能手改',
  sw:'点一下在开/关（或填的两个词）之间翻；这个数还能当份数', range:'一根能拖的数：原创度、差异度这种就该长这样',
  rng:'给两个数随机出一个整数，可带单位；界面上留空的话，生成时每一格自动掷一次',
  dyn:'下拉里有什么，由上游那个变量现下是什么决定（点了「男」，「称号」里只剩男的那批）',
  fmt:'拼接格式本身当一批词条来抽：先抽一个格式，再往里填内容',
  multi:'从指定的几个分类里摆出一列勾选框，自己勾几个算几项（能当份数、也能数上下限）',
  tarea:'一整段原样进结果，不切字段也不数段（填背景、写设定那种）',
  sift:'打几个字下面只留含这几个字的候选，点一条就填进框里（词库大了翻着累的时候用）',
  color:'色块和色号文本框互相跟着改，进结果的是文本框里那一串（色号或色名都成）',
  date:'原生日期/时刻输入框；「2026-10-04」这种串在数算逻辑里读出来就是年份，能直接拿去算年龄'
};
/* 换功能就换一套参数，新建时给个能直接跑的默认 */
const GW_NEW = {
  cat2:{ cats:[] }, cat3:{ cat:'', at:1 }, thru:{ cats:[] }, fuse:{ sources:[] },
  extract:{ sep:'[、,，;；\n]+', ph:'' }, num:{ def:3, min:1, max:99 }, numShow:{ src:'' }, input:{ def:'', ph:'' },
  rand:{ cats:[], def:'', ph:'' },
  sw:{ onv:'要', offv:'不要', on:true }, range:{ min:0, max:10, step:1, def:5, unit:'' },
  rng:{ lo:1, hi:10, def:'', unit:'' }, dyn:{ src:'', cat:'' }, fmt:{ cats:[] },
  multi:{ cats:[], join:'、' }, tarea:{ rows:4, def:'', ph:'' }, sift:{ cats:[], def:'', ph:'' },
  color:{ def:'', ph:'' }, date:{ kind:'date', def:'' }
};
/* 换功能要清干净的参数名（不然上一个功能填的还赖在配方里） */
const GW_KEYS = ['cats', 'cat', 'at', 'sources', 'sep', 'ph', 'def', 'min', 'max', 'src',
  'onv', 'offv', 'on', 'step', 'unit', 'lo', 'hi', 'join', 'rows', 'kind'];
const GW_JOIN = [['\n', '每条一行'], ['、', '顿号'], ['，', '逗号'], ['；', '分号'], [' ', '空格']];
/* 成组那三档：收起态只藏外观，里面那些格子照样建出来、照样取值 */
const GW_FOLD = [['', '一直摊着'], ['can', '可以收起（打开是摊开的）'], ['shut', '默认收着（要点标题才摊开）']];

/* ---------- 判断逻辑：十八条摆全，删由人 ----------
   p 是这条规则的默认参数；配方里 rules: [{ k, on, ...参数 }]。
   没写进配方的规则一律不参与，老配方拼出来的结果和从前一模一样。
   界面分两组摆，分组的名单就是 sh-gen.js 里那份 GEN_SOFT（剔行的那几条）。 */
const GW_RULES = [
  { k:'noRepeat', name:'随机抽的词不重复',
    tip:'同一轮里随机抽到的词不再抽第二遍，那一摞抽干了才允许重样。一份名单要连着抽出好几个不重样的时候开它，比如给五个角色各配一把兵器。',
    def:true },
  { k:'dropEmpty', name:'空着的不进结果',
    tip:'界面上没填值的那一项，结果里不出它那一行。有几项常常空着、不想看见它们的时候开它，比如三个备选只填了两个。',
    def:true },
  { k:'dropBlock', name:'整块空了连名字一起不出',
    tip:'一块里一条都没出，这块的标题也跟着不出，不留只有名字的空壳。功能模块里用成组或者组循环带了标题、又想整块空着不填的时候开它。',
    def:true },
  { k:'uniq', name:'一样的只留一条',
    tip:'同一个内容重复命中，只留头一条，后面的丢掉。一批结果里不许出现两个一模一样的时候开它，比如抽出 20 个人名。',
    def:true },
  { k:'retry', name:'不合格先重抽',
    tip:'不合格的那一格先当场重抽，最多试几轮，实在抽不出再按你选的方式收场（照旧剔掉 / 留最后抽的那一版 / 写一句占位的），合格标准照着已经开着的那几条判：空项不进结果、重复只留一条、每条字数上下限。别的判断只会把不合格的行剔掉，剔一条少一条，你要条数不减的时候开它。',
    p:{ n:12, onFail:'drop' } },
  { k:'branch', name:'条件分支',
    tip:'读一个变量现下是什么，从上往下命中第一条成立的情况，决定挂在情况上，谁要用谁自己来取 —— 改分类在抽词那一头，换拼法在拼结果那一头，不要哪几格 / 换条数 / 插一行排在判断流水线最后。界面上几种选择要走出几种不同结果的时候开它，结论还能起个名字，文本模板里 {那个名字} 就取得到。',
    p:{ name:'分支', cases:[] } },
  { k:'cap', name:'最多出几条',
    tip:'结果再多也按这个条数收住，只留最前面的几条。一次想少出几条、或者抽出一大批只想留前 20 条的时候开它。',
    p:{ n:20 } },
  { k:'lenLimit', name:'每条字数上下限',
    tip:'少于下限的那条丢掉，超过上限的那条裁到上限，填 0 的那一头不管。要每条长短齐整的时候开它，比如每条控制在 2 到 4 字。',
    p:{ min:0, max:0 } },
  { k:'number', name:'每条前面标序号',
    tip:'照你写的格式给每条挂上第几条，{序} 就是那个数。结果要像清单一样一条条数着看的时候开它，比如【第1条】这样。',
    p:{ tpl:'【第{序}条】' } },
  { k:'shuffle', name:'出完打乱顺序',
    tip:'结果出完再整体打乱，顺序不跟着界面上那一排走。不想让人看出你是挨个控件顺序抽的时候开它。',
    p:{} },
  { k:'needAll', name:'有空的就不出，提示哪个没填',
    tip:'界面上还有没填的控件就一条都不生成，并且报出是哪一个没填。宁可不出也不想出一半的时候开它，比如必须先填时代才肯往下推。',
    p:{} },
  { k:'weight', name:'按权重抽',
    tip:'词库里词条写成「4|玄铁」「0.02|传说」这样数字加竖线就是权重，数越大越常见，没写的算 1，开了这条随机那一档照权重抽，结果里只留词本身，「4|」这一截不进结果。想让常见的多出现、稀有的偶尔冒一次的时候开它。',
    def:false, p:{} },
  { k:'calc', name:'数算逻辑：按公式算一个数',
    tip:'照你写的公式算出一个数，加减乘除取余、括号和 min max abs round floor ceil 都能写，变量用花括号点名，算出来的数挂在你起的名字上，文本模板里 {那个名字} 取得到，组循环的「份数跟着」和数字展示的「看哪个数」也认它。结果里有个数该由别几个数推出来的时候开它，比如 价格 = {基准价} × {数量} × min({等级},3)。',
    p:{ name:'数量', expr:'{数量} * 2' } },
  { k:'pair', name:'搭配限制：这两样不许撞',
    tip:'说清比哪两格、怎么比（完全同名 / 一个含另一个 / 前一个的尾字等于后一个的首字 / 汉字字组有重合），撞上的那条这一轮不算成，开着「不合格先重抽」的话会当场重抽。两格抽出来的东西不许撞车的时候开它，比如姓和名不能撞同一个字。',
    p:{ a:'', b:'', how:'same' } },
  { k:'like', name:'相似程度：太像的剔掉',
    tip:'两行有超过几成的汉字字组相同（相邻两字算一个字组）就只留一条，再绑上一个词库分类，撞上里面那些词的也剔掉。「一样的只留一条」只认完全一样，你想连「赵云 / 赵云飞」这种近似也一起挡掉的时候开它。',
    p:{ pct:40, cat:'' } },
  { k:'diverse', name:'多样化：挑差异够大的几条',
    tip:'一次出几条，两两数有几项不同，只留不同够数的组合。想要一批结果彼此拉开差距、不是清一色同一个套子的时候开它，比如三个角色不能全是同一个性格。',
    p:{ minDiff:1, n:3 } },
  { k:'rw', name:'生成格式改写',
    tip:'抽完再动内容，动作能叠好几个按列表顺序来：剥掉括号里的字、色号换成黑、颜色太浅换黑、英文连着重复的两三个字母去掉、首字母转大小写、照「旧=>新」替换表改字、只留数字。词库里的原文不能直接用、要洗一道才好看的时候开它。',
    p:{ ops:[] } },
  { k:'dim', name:'多维定义：缺哪个靠表推哪个',
    tip:'几个维度互相定义：词条写成「C1 热带雨林」这种编码加词，规则表一行一条像「土壤：气候,植被 = C1,V2 → S3」，界面上只填了两个维度，剩下的照表一层层推出来，推不出就走你给那一维写的那一句。想让设定互相咬合、填一半就自动推出一整套的时候开它；勾「摊组合」就把已知维度能配的全组合摊成行，交给「多样化」挑差异够大的。',
    p:{ name:'生态', dims:[], table:[], out:'word', join:'、', expand:false } }
];
function gwRule(k){ return GW_RULES.find(r => r.k === k) || null; }
/* 待实现清单里标了「已导入」、而且这个版本代码里真跑得起来的那几条，并进向导那两张名单（#298）。
   功能模块的参数默认值只能是空的一套：GW_NEW 那张表在代码里，清单里的东西补不出默认参数，
   所以导进来的功能模块新建时靠配方解释器认它自己的参数，向导里那一格先留空。 */
function gwAdopt(){
  let n = 0;
  for(const it of (GenPending.items || [])){
    if(!it || !it.added || !libHas(it.kind, it.name)) continue;
    if(it.kind === 'fn'){
      if(!GW_FNS.some(x => x[0] === it.name)){ GW_FNS.push([it.name, it.title || it.name]); n++; }
      if(GW_T0[it.name] === undefined) GW_T0[it.name] = it.desc || '';
      if(!GW_NEW[it.name]) GW_NEW[it.name] = {};
    }else if(!GW_RULES.some(r => r.k === it.name)){
      GW_RULES.push({ k:it.name, name:it.title || it.name, tip:it.desc || '', p:{} }); n++;
    }
  }
  return n;
}

const GenWizard = {
  onSaved:null,
  /* 组件 id 直接当文件名：小写字母开头，后面小写字母数字和 - _ */
  okId(id){ return /^[a-z][a-z0-9_-]{1,31}$/.test(String(id || '')); },
  open(id){ new GenSheet(id); }
};

class GenSheet{
  constructor(id){
    this.editing = id || '';
    this.R = id ? JSON.parse(JSON.stringify(Gen.get(id))) : this.blank();
    this.got = new Set();
    this.boot();
  }
  blank(){
    return { id:'', name:'', icon:'pencil', desc:'', bank:Banks.list()[0] || '',
      out:{ mode:'list', join:'\n', template:'' }, keep:{ days:0, max:0 }, ui:[],
      rules: GW_RULES.map(r => Object.assign({ k:r.k, on:!!r.def }, JSON.parse(JSON.stringify(r.p || {})))) };
  }
  async boot(){
    await Banks.loadReg();
    this.banks = Banks.list();
    await GenPending.load();      /* #298：待实现清单先读进来，标题那一排才报得出几条 */
    gwAdopt();
    await this.loadBank(this.R.bank);
    this.draw();
  }
  /* 每本词库在这张向导里只读一次，读完重画一回，下拉里才有分类 */
  async loadBank(name){
    if(!name || this.got.has(name)) return;
    this.got.add(name);
    try{ await genBank(name).load(); }catch(e){ console.warn('词库没读到：' + name); }
  }

  /* ---------- 小件套 ---------- */
  field(label, el){ return h('div', { class:'wnw-field' }, [h('label', {}, label), el]); }
  txt(val, on, ph){
    const i = h('input', { class:'wnw-input', value:val === undefined ? '' : val, placeholder:ph || '' });
    i.addEventListener('input', () => on(i.value));
    return i;
  }
  /* 填完要重排一次的（控件名、分类那些），用 change 触发，焦点已经离开输入框了 */
  txtRo(val, on, ph){
    const i = this.txt(val, v => { on(v); }, ph);
    i.addEventListener('change', () => this.re());
    return i;
  }
  num(val, min, max, on){
    const i = h('input', { class:'wnw-input', type:'number', value:val, min:min, max:max, style:'max-width:7em' });
    /* 框清空时别把 NaN 写进配方，按这一档的下限算 */
    i.addEventListener('input', () => { const v = parseInt(i.value, 10); on(Number.isFinite(v) ? v : min); });
    return i;
  }
  selVal(opts, val, on, ph){
    const s = h('select', { class:'wnw-input' }, []);
    if(ph) s.appendChild(h('option', { value:'', selected:!val }, ph));
    for(const [v, label] of opts) s.appendChild(h('option', { value:v, selected:v === val }, label));
    s.addEventListener('change', () => on(s.value));
    return s;
  }
  addSel(opts, label, on){
    if(!opts.length) return null;
    const s = h('select', { class:'wnw-input', style:'width:auto;max-width:14em' },
      [h('option', { value:'', selected:true, disabled:true }, label)].concat(opts.map(o => h('option', { value:o }, o))));
    s.addEventListener('change', () => { const v = s.value; s.value = ''; if(v) on(v); });
    return s;
  }
  btn(label, on, title){ return h('button', { class:'wnw-btn mini', title:title || '', onclick:on }, label); }
  /* 只摆图的那一个：名字交给 icons\ 里的图片，悬停还是汉字 */
  btnIco(name, on, title){ return h('button', { class:'wnw-btn mini', title:title || '', 'aria-label':title || '', html:icoMarkup(name), onclick:on }); }
  /* 图 + 字并排的那一个：w-txt 让两者在同一行、留一点缝 */
  btnIT(name, label, on, title){ return h('button', { class:'wnw-btn mini w-txt', title:title || '', html:icoMarkup(name) + label, onclick:on }); }
  /* 每一块都能把代码原样拷走：贴回右边「源码」那一栏改，或者贴给另一个组件 */
  codeBtn(node){ return copyBtn(() => JSON.stringify(node, null, 2), '复制代码'); }

  /* ---------- 配方里的那些控件 ---------- */
  walk(a, fn){ for(const n of a || []){ fn(n); this.walk(n.items, fn); } }
  ctls(){ const out = []; this.walk(this.R.ui, n => { if(n.t === 'ctl') out.push(n); }); return out; }
  /* 能被「份数」「数字展示」绑的那两个：数字指定和文本提取计数 */
  nums(){ return this.ctls().filter(c => ['num','extract','sw','range','rng','multi'].indexOf(c.fn) >= 0); }
  node(id){ let f = null; this.walk(this.R.ui, n => { if(n.id === id) f = n; }); return f; }
  /* id 用户不碰：向导自己编号，绑来绑去认的是名字 */
  uid(){ let i = 1; while(this.node('k' + i)) i++; return 'k' + i; }

  /* ---------- 左：向导 ---------- */
  draw(){
    const pane = h('div', { class:'sh-pane gw-pane' });
    const form = h('div', { class:'sh-col sh-form' });
    const out = h('div', { class:'sh-col sh-out' });
    pane.appendChild(form); pane.appendChild(out);
    form.appendChild(this.baseCard());
    form.appendChild(this.uiCard());
    form.appendChild(this.rulesCard());
    shSplit(pane, form, shSplitKey('wizard'));
    this.outPane(out);
    H().dlg.open('组件定制' + (this.editing ? ' · ' + this.R.name : ''), pane, [
      h('button', { class:'wnw-btn primary', onclick:() => this.save() }, this.editing ? '保存' : '建这个插件'),
      h('button', { class:'wnw-btn mini', onclick:() => H().dlg.close() }, '关闭')
    ], { wide:true, vwide:true, redraw:true });
  }
  /* ---------- 右：上半是「输出」，下半是预览 / 源码 ----------
     出法和拼出来的样子是同一件事的两端，摆一列上下才接得上：改一行拼法，抬眼就能生成对着看。
     左边那一栏留给界面结构和判断逻辑，不用再为这点事滚到底。 */
  outPane(out){
    out.appendChild(this.outCard());
    const slot = h('span', { class:'wnw-row' });
    out.appendChild(h('div', { class:'wnw-row', style:'align-items:center' }, [
      h('div', { class:'wnw-seg' }, [['prev', '预览'], ['src', '源码']].map(([k, nm]) => h('button', {
        class:(this.tab || 'prev') === k ? 'on' : '', onclick:() => { this.tab = k; this.draw(); } }, nm))),
      h('span', { style:'flex:1' }),
      slot
    ]));
    this.factSlot(slot);
    if(this.tab === 'src'){ out.appendChild(this.srcBox()); return; }
    /* 真视图挂在预览那一格，改一条就能点生成试，用的就是手里这张草稿 */
    const box = h('div', {});
    out.appendChild(box);
    this.view = new GenView(box, this.R);
    this.view.boot().then(() => this.view.paint());
  }
  srcBox(){
    /* 这一栏就是将要落盘的那份 JSON：挂内置编辑器，行号着色折叠搜索一样不少 */
    const host = h('div', { style:'width:100%' });
    const box = h('div', { class:'wnw-col' });
    box.appendChild(host);
    box.appendChild(h('div', { class:'wnw-row' }, [
      this.btn('照这份源码改', () => this.applySrc(api.get())),
      copyBtn(() => api.get(), '复制')]));
    const api = ICode.attach(host, { value:JSON.stringify(this.R, null, 2),
      file:'recipe.json', height:'calc(74vh - 116px)' });
    return box;
  }
  applySrc(text){
    let R;
    try{ R = JSON.parse(text); }catch(e){ toast('这份源码读不成 JSON：' + ((e && e.message) || e)); return; }
    if(!R || typeof R !== 'object' || !R.id || !Array.isArray(R.ui) || !R.out)
      { toast('源码里得有 id、ui、out 三个字段'); return; }
    this.R = R;
    this.loadBank(R.bank).then(() => this.draw());
  }
  /* 「恢复出厂」这个按钮摆不摆，得先问一句原版那一格（data\plugins-factory\）有没有这一家的底：
     新建那张还没落盘、没有底 —— 这种情况这一格就空着，不摆一个点了是空话的按钮。
     外43 起导入那一下会顺手留底，所以正常导入进来的第三方包也摆得出这颗钮。 */
  async factSlot(slot){
    const id = this.editing;
    if(!id || typeof PackCode === 'undefined' || !PackCode.can()) return;
    let fact = [];
    try{ fact = await PackCode.factory(id); }catch(e){}
    if(!slot.isConnected || !fact.length) return;
    slot.appendChild(this.btn('恢复出厂', () => this.restore(),
      '恢复初始版本'));
  }
  /* 换回原版：点名那三份从 data\plugins-factory\<id>\ 拷回来，紧接着重载这一家。
     自己后来往这一格里加的文件不在点名这几份里，那一次拷回不动它们。 */
  async restore(){
    const id = this.editing;
    if(!id) return;
    if(!confirm('要把「' + this.R.name + '」这一格里的代码和配方换成原版那一格里的版本（导入那一下留的底）· 你现在这份就被覆盖了，继续吗？')) return;
    const r = await PackCode.restorePack(id, ['main.js', 'recipe.json', 'manifest.json']);
    if(!r || !r.ok){ toast('没换成原版：' + ((r && r.msg) || '主进程没回话')); return; }
    toast(r.msg || '已经换成导入时那一份原版');
    /* 关掉这张草稿，再按重载回来的那一版重新开一张：手上这份已经被覆盖了，留着只会让人以为还没存 */
    H().dlg.close();
    if(Gen.get(id)) GenWizard.open(id);
  }

  baseCard(){
    const R = this.R, card = h('div', { class:'wnw-card' });
    card.appendChild(h('h4', {}, '基本信息'));
    card.appendChild(this.field('名字', this.txt(R.name, v => { R.name = v; }, '这个功能叫什么')));
    const id = this.txt(R.id, v => { R.id = v.trim().toLowerCase(); }, '程序内部认它用的代号，小写英文，比如 scene-pack');
    if(this.editing){ id.disabled = true; id.title = Phrase.out('改配方不换代号，要换请关掉再新建一个'); }
    card.appendChild(this.field('代号', id));
    card.appendChild(this.field('图标', this.txt(R.icon, v => { R.icon = v; }, '图标库里那一本图的名字，不用带后缀；这里留空也行，包里自己带一张图就归这张包自己管')));
    const two = (label, el) => h('div', { class:'wnw-field', style:'flex:1 1 10em' }, [h('label', {}, label), el]);
    card.appendChild(h('div', { class:'wnw-row' }, [
      two('作者', this.txt(R.author, v => { const s = v.trim(); if(s) R.author = s; else delete R.author; }, '谁做的这个功能')),
      two('版本号', this.txt(R.ver, v => { const s = v.trim(); if(s) R.ver = s; else delete R.ver; }, '1.0'))]));
    card.appendChild(this.field('简介', this.txt(R.desc, v => { R.desc = v; }, '介绍一下这个插件')));
    const row = h('div', { class:'wnw-row' }, [
      this.selVal(this.banks.map(n => [n, n]), R.bank, async v => { R.bank = v; await this.loadBank(v); this.draw(); }),
      (typeof BankDlg !== 'undefined') ? this.btn('改词库', () => BankDlg.open(bankWhich(R.bank))) : null,
      this.btnIT('plus', '新建词库', () => this.newBank(row))
    ]);
    card.appendChild(this.field('词库', row));
    return card;
  }
  /* 建词库就地在这一行里问名字，写完直接选中它 */
  newBank(row){
    const box = h('div', { class:'wnw-row' });
    const i = h('input', { class:'wnw-input', placeholder:'新词库的名字', style:'max-width:12em' });
    box.appendChild(i);
    box.appendChild(this.btn('建', async () => {
      try{
        const nm = await Banks.create(i.value);
        await this.loadBank(nm);
        this.R.bank = nm; this.banks = Banks.list();
        toast('词库「' + nm + '」建好了，去「改词库」里填条目');
        this.draw();
      }catch(e){ toast((e && e.message) || String(e)); }
    }));
    box.appendChild(this.btn('取消', () => box.remove()));
    row.appendChild(box);
    i.focus();
  }

  /* ---------- 功能模块：五块结构的清单 ---------- */
  uiCard(){
    const R = this.R, card = h('div', { class:'wnw-card' });
    card.appendChild(this.cardTitle('功能模块', 'fn'));
    if(!R.ui.length) card.appendChild(h('div', { class:'wnw-hint' }, '还没有块，用下面这几个按钮加'));
    for(let i = 0; i < R.ui.length; i++) card.appendChild(this.itemRow(R, 'ui', i));
    card.appendChild(h('div', { class:'wnw-row', style:'margin-top:8px' }, this.addBtns(R, 'ui')));
    return card;
  }
  /* 标题那一排：右边跟着 #298 那两个入口（组件里用到、库里还没有的那些类型） */
  cardTitle(text, kind){
    return h('div', { class:'wnw-row', style:'gap:10px;align-items:center;justify-content:space-between' }, [
      h('h4', {}, text), this.pendBar(kind)
    ]);
  }
  pendBar(kind){
    /* 只数还没导进来的那几条：导过的已经进了可选名单，再叫「待实现」就是假话 */
    const n = (GenPending.items || []).filter(x => x.kind === kind && !x.added).length;
    const row = h('div', { class:'wnw-row', style:'gap:6px;align-items:center' });
    row.appendChild(this.btn('待实现 ' + n + ' 条 · 查看', () => this.pendView(kind),
      '组件里用到、但库里还没有的功能模块 / 判断逻辑：看名字、功能描述、参数和代码原文，整份复制走交给 AI 写实现'));
    row.appendChild(this.btn('导入', () => this.pendImport(kind),
      '把清单里这个版本已经写好实现的那几条摆进可选名单；还没实现的留在清单里，导进来也跑不起来'));
    return row;
  }
  /* 查看：一条一格，写着它有没有实现、在哪儿出现过，能复制、能删、能就地补一句功能描述 */
  pendView(kind){
    const list = (GenPending.items || []).filter(x => x.kind === kind);
    const box = h('div', { class:'wnw-col', style:'gap:10px;min-width:min(820px,94vw);max-height:min(66vh,620px);overflow:auto' });
    if(!list.length) box.appendChild(h('div', { class:'wnw-hint' },
      '清单还空着。导入插件、导入功能包、改代码存为插件的时候，要是那份组件用到了库里没有的类型，这里就会有。'));
    for(const it of list){
      const has = libHas(it.kind, it.name);
      /* 三种状态各说一句实话：能不能跑、导没导进来，是两件事 */
      const stat = has ? (it.added ? '已导入 · 库里能选能跑' : '这个版本已有实现 · 点「导入」就进可选名单')
        : (it.added ? '清单里标着导过 · 但这个版本的代码里找不到它的实现了，导进来也跑不起来'
          : '实现还没进代码 · 只能先看，导进来也跑不起来');
      const desc = this.txt(it.desc, v => { it.desc = v; }, '它干什么用（一句就够）');
      /* 两样都留「叫什么」那一格：判断逻辑导进可选名单时摆的中文名也从这个字段取 */
      const tit = this.txt(it.title, v => { it.title = v; }, '可选名单里摆的中文名');
      /* 名字和描述填完才落盘：一次写一条，别边打字边写文件 */
      const put = async () => { await GenPending.set(it.kind, it.name, { title:it.title || '', desc:it.desc || '' }); };
      desc.addEventListener('change', put);
      if(tit) tit.addEventListener('change', put);
      const detail = it.code ? it.code : JSON.stringify(it.params || {}, null, 2);
      box.appendChild(h('div', { class:'sh-mod' }, [
        h('div', { class:'wnw-row', style:'gap:8px;align-items:center' }, [
          h('b', {}, it.name + (it.title ? '（' + it.title + '）' : '')),
          h('span', { class:'wnw-hint' }, stat),
          h('span', { style:'flex:1' }),
          this.btn('删掉这条', async () => {
            /* 这一条是当场落盘的（不像别处那些草稿要等「保存」），所以它得问一句 */
            if(!await shAsk('从待实现清单里拿掉「' + it.name + '」这份记录？')) return;
            await GenPending.remove(it.kind, it.name); this.pendView(kind);
          }, '从待实现清单里拿掉这份记录'),
          copyBtn(() => pendingOne(it), '复制这条')
        ]),
        h('div', { class:'wnw-hint' }, '出现在：' + ((it.froms || []).join('、') || '这份配方') + (it.where ? '（' + it.where + '）' : '')),
        tit ? this.field('界面上叫什么', tit) : null,
        this.field('功能描述', desc),
        h('div', { class:'wnw-hint' }, it.code ? '插件代码里那一段原文（命中那一行上下各 ' + PENDING_SNIP + ' 行）：' : '它在这份配方里带的那些参数：'),
        h('pre', { class:'wnw-hint', style:'white-space:pre-wrap;max-height:14em;overflow:auto;margin:0' }, detail || '（没有）')
      ]));
    }
    const pick = h('input', { type:'file', accept:'.json,application/json', style:'display:none' });
    pick.addEventListener('change', () => {
      const f = pick.files && pick.files[0];
      if(!f) return;
      const fr = new FileReader();
      fr.onload = async () => { const r = await GenPending.absorb(String(fr.result || '')); toast(r.ok ? '并进来 ' + r.n + ' 条 · ' + r.msg : r.msg); this.pendView(kind); };
      fr.readAsText(f);
    });
    H().dlg.open('待实现清单 · ' + (kind === 'fn' ? '功能模块' : '判断逻辑'), box, [
      copyBtn(() => pendingBrief(list), '复制全部（交给 AI）'),
      h('button', { class:'wnw-btn mini', onclick:() => { genDownload(PENDING_FILE, JSON.stringify({ items:list }, null, 2) + '\n'); toast('已存成文件，在下载的地方'); } }, '存成文件'),
      h('button', { class:'wnw-btn mini', onclick:() => pick.click() }, '读别处的清单并进来'),
      h('button', { class:'wnw-btn primary', onclick:() => { H().dlg.close(); this.draw(); } }, '回到向导'),
      pick
    ], { wide:true, vwide:true });
  }
  /* 导入：只收这个版本真跑得起来的，剩下的留在清单里等实现（没实现的东西不摆进可选名单） */
  async pendImport(kind){
    const list = await GenPending.load();
    const can = list.filter(x => x.kind === kind && !x.added && libHas(x.kind, x.name));
    if(!can.length){
      const wait = list.filter(x => x.kind === kind && !x.added).length;
      toast(wait ? '清单里这 ' + wait + ' 条的实现还没进代码，导进来选了也跑不起来 · 先复制这份清单交给 AI 写实现'
        : '清单里没有可导入的（要么已经导过了，要么还没扫到新的）');
      return;
    }
    for(const it of can) it.added = true;
    const r = await GenPending.save();
    gwAdopt();
    toast('已导入 ' + can.length + ' 条：' + can.map(x => x.name).join('、') + ' · ' + r.msg);
    this.draw();
  }
  addBtns(host, key){
    const mk = {
      ctl:() => ({ t:'ctl', id:this.uid(), fn:'cat2', name:'', cats:[] }),
      row:() => ({ t:'row', items:[] }),
      group:() => ({ t:'group', name:'', items:[] }),
      tabs:() => ({ t:'tabs', items:[{ t:'pane', name:'第一页', items:[] }] }),
      pane:() => ({ t:'pane', name:'', items:[] }),
      text:() => ({ t:'text', text:'' }),
      loop:() => ({ t:'loop', id:this.uid(), name:'', src:'', tpl:'', items:[] })
    };
    const label = { ctl:'控件', row:'一行并列', group:'成组', tabs:'分页签', pane:'一页', text:'纯文本', loop:'组循环' };
    /* 并列那一行只放得下控件；组里能塞控件；循环里塞控件和组；页签里塞的是一页一页 */
    const which = key === 'ui' ? ['ctl', 'row', 'group', 'tabs', 'text', 'loop']
      : (host.t === 'row' ? ['ctl'] : host.t === 'group' ? ['ctl'] : host.t === 'tabs' ? ['pane'] : ['ctl', 'group']);
    const arr = host[key] || (host[key] = []);
    return which.map(k => this.btnIT('plus', label[k], () => { arr.push(mk[k]()); this.draw(); }));
  }
  tag(n){ return { ctl:'控件', row:'一行并列', group:'成组', tabs:'分页签', pane:'一页', text:'纯文本', loop:'组循环' }[n.t] || n.t; }
  fnName(fn){ const f = GW_FNS.find(x => x[0] === fn); return f ? f[1] : fn; }
  itemRow(host, key, i){
    const arr = host[key] || (host[key] = []), n = arr[i];
    const box = h('div', { class:'sh-mod' });
    box.appendChild(h('div', { class:'wnw-row', style:'justify-content:space-between;align-items:center' }, [
      h('b', {}, n.t === 'ctl' ? this.fnName(n.fn) : this.tag(n)),
      h('div', { class:'wnw-row', style:'gap:6px' }, [
        this.btnIco('up', () => { if(i > 0){ arr.splice(i - 1, 0, arr.splice(i, 1)[0]); this.draw(); } }, '上移'),
        this.btnIco('down', () => { if(i < arr.length - 1){ arr.splice(i + 1, 0, arr.splice(i, 1)[0]); this.draw(); } }, '下移'),
        this.codeBtn(n),
        this.btn('删', () => { arr.splice(i, 1); this.draw(); }, '删掉这块')])
    ]));
    if(n.t === 'ctl') this.ctlFields(box, n);
    else if(n.t === 'text') box.appendChild(this.field('文本', this.txt(n.text, v => { n.text = v; }, '界面上摆的一句死字，不进结果')));
    else this.innerFields(box, n, i);
    return box;
  }
  /* 一行并列 / 成组 / 组循环 / 一页：里面还能再套块 */
  innerFields(box, n){
    if(n.t === 'pane')
      box.appendChild(this.field('这页叫什么', this.txtRo(n.name, v => { n.name = v; }, '页签上摆的这几个字')));
    else if(n.t !== 'row' && n.t !== 'tabs'){
      box.appendChild(this.field(this.tag(n) === '组循环' ? '这块叫' : '组名',
        this.txtRo(n.name, v => { n.name = v; }, '结果里用这个名字')));
    }
    /* 成组那一块怎么摆：一直摊着 / 点标题收起 / 打开就收着（收起态里那些格照样取值） */
    if(n.t === 'group')
      box.appendChild(this.field('怎么摆', this.selVal(GW_FOLD, n.fold || '', v => { n.fold = v; this.draw(); }))
      );
    if(n.t === 'tabs' && !(n.items || []).length)
      box.appendChild(h('div', { class:'wnw-hint' }, '一页都没有，界面上就不摆这一排页签'));
    if(n.t === 'loop'){
      box.appendChild(this.field('份数跟着', this.srcSel(n.src, v => { n.src = v; this.draw(); })));
      box.appendChild(this.field('每份长这样', this.txt(n.tpl, v => { n.tpl = v; }, '第{序}份｜{名字}')));
    }
    const items = n.items || (n.items = []);
    for(let k = 0; k < items.length; k++) box.appendChild(this.itemRow(n, 'items', k));
    if(!items.length) box.appendChild(h('div', { class:'wnw-hint' }, '里面还空着'));
    box.appendChild(h('div', { class:'wnw-row', style:'margin-top:6px' }, this.addBtns(n, 'items')));
  }
  srcSel(val, on){
    const list = this.nums().map(c => [c.id, c.name || c.id]);
    /* 数算逻辑 / 多维定义挂出来的名字也是一头（引擎 numOf 认），份数和数字展示能直接绑 */
    for(const r of this.R.rules || [])
      if(r && r.on && (r.k === 'calc' || r.k === 'dim') && String(r.name || '').trim()
        && !list.some(x => (x[1] || '').indexOf(r.name) === 0))
        list.push([r.name, r.name + (r.k === 'calc' ? '（算出来的数）' : '（推出来的值）')]);
    return this.selVal(list, val, on, '（选一个数字或字段）');
  }
  /* 功能模块产生的变量：控件和组循环各算一个，结果里每一行的行名就是它 */
  vars(){
    const out = [];
    this.walk(this.R.ui, n => { if(n.t === 'ctl' || n.t === 'loop'){ const v = n.name || n.id; if(v && !out.includes(v)) out.push(v); } });
    return out;
  }
  varSel(val, on){ return this.selVal(this.vars().map(v => [v, v]), val || '', on, '（全部结果）'); }

  ctlFields(box, n){
    const row = h('div', { class:'wnw-row' }, [
      h('div', { class:'wnw-field', style:'flex:1 1 12em' }, [h('label', {}, '名字'), this.txtRo(n.name, v => { n.name = v; }, '结果里叫它什么')]),
      h('div', { class:'wnw-field', style:'flex:1 1 12em' }, [h('label', {}, '功能'),
        this.selVal(GW_FNS, n.fn, v => {
          for(const k of GW_KEYS) delete n[k];
          n.fn = v; Object.assign(n, JSON.parse(JSON.stringify(GW_NEW[v] || {})));
          this.draw();
        })])
    ]);
    box.appendChild(row);
    box.appendChild(h('div', { class:'wnw-hint' }, GW_T0[n.fn] || ''));
    const bank = this.field('词库', this.bankSel(n));
    switch(n.fn){
      case 'cat2': case 'thru':
        box.appendChild(bank);
        box.appendChild(this.field(n.fn === 'thru' ? '穿透这些类' : '收这些分类', this.cats(n)));
        break;
      case 'cat3':
        box.appendChild(bank);
        box.appendChild(this.field('大类', this.oneCat(n)));
        box.appendChild(this.field('它在第几层', this.num(n.at || 1, 1, 5, v => { n.at = v || 1; })));
        break;
      case 'extract':
        box.appendChild(this.field('分隔符', this.txt(n.sep, v => { n.sep = v; }, '[、,，;；\n]+')));
        box.appendChild(this.field('灰字提示', this.txt(n.ph, v => { n.ph = v; }, '输入框里那句灰字')));
        break;
      case 'fuse':
        box.appendChild(this.field('并成一套的来源', this.fuseSrc(n)));
        break;
      case 'num':
        box.appendChild(h('div', { class:'wnw-row' }, [
          this.field('默认', this.num(n.def === undefined ? 3 : n.def, 0, 99, v => { n.def = v; })),
          this.field('最少', this.num(n.min === undefined ? 1 : n.min, 0, 99, v => { n.min = v; })),
          this.field('最多', this.num(n.max === undefined ? 99 : n.max, 1, 99, v => { n.max = v; }))]));
        break;
      case 'numShow':
        box.appendChild(this.field('看哪个数', this.srcSel(n.src, v => { n.src = v; this.draw(); })));
        break;
      case 'input':
        box.appendChild(this.field('默认值', this.txt(n.def, v => { n.def = v; })));
        box.appendChild(this.field('灰字提示', this.txt(n.ph, v => { n.ph = v; })));
        break;
      case 'rand':
        box.appendChild(bank);
        box.appendChild(this.field('从哪些分类抽（连子类）', this.cats(n)));
        box.appendChild(h('div', { class:'wnw-row' }, [
          this.field('默认值', this.txt(n.def, v => { n.def = v; }, '打开就填在框里，可以留空')),
          this.field('灰字提示', this.txt(n.ph, v => { n.ph = v; }, '空框里那句灰字'))]));
        break;
      case 'sw':
        box.appendChild(h('div', { class:'wnw-row' }, [
          this.field('开着叫什么', this.txt(n.onv, v => { n.onv = v; }, '要')),
          this.field('关着叫什么', this.txt(n.offv, v => { n.offv = v; }, '不要')),
          this.field('打开时是', this.selVal([[true, '开着'], [false, '关着']], !!n.on, v => { n.on = v === true || v === 'true'; this.draw(); }))
        ]));
        break;
      case 'range':
        box.appendChild(h('div', { class:'wnw-row' }, [
          this.field('最小', this.num(n.min === undefined ? 0 : n.min, -99, 999, v => { n.min = v; })),
          this.field('最大', this.num(n.max === undefined ? 10 : n.max, -999, 9999, v => { n.max = v; })),
          this.field('步长', this.num(n.step || 1, 1, 99, v => { n.step = v; })),
          this.field('默认', this.num(n.def === undefined ? 5 : n.def, -99, 999, v => { n.def = v; })),
          this.field('单位', this.txt(n.unit, v => { n.unit = v; }, '成 / 岁，可留空'))]));
        break;
      case 'rng':
        box.appendChild(h('div', { class:'wnw-row' }, [
          this.field('最小', this.num(n.lo === undefined ? 1 : n.lo, -999, 9999, v => { n.lo = v; })),
          this.field('最大', this.num(n.hi === undefined ? 10 : n.hi, -999, 99999, v => { n.hi = v; })),
          this.field('单位', this.txt(n.unit, v => { n.unit = v; }, '岁 / 条，可留空')),
          this.field('打开就填', this.txt(n.def, v => { n.def = v; }, '留空 = 生成时随机'))]));
        break;
      case 'dyn':
        box.appendChild(bank);
        box.appendChild(this.field('上游是哪个变量', this.varSel(n.src, v => { n.src = v || ''; this.draw(); })));
        box.appendChild(this.field('大类（下游按上游的值分层）', this.dynCat(n)));
        break;
      case 'fmt':
        box.appendChild(bank);
        box.appendChild(this.field('格式句子的分类', this.cats(n)));
        break;
      case 'multi':
        box.appendChild(bank);
        box.appendChild(this.field('从哪些分类摆候选（连子类）', this.cats(n)));
        box.appendChild(this.field('勾中的怎么拼', this.selVal(GW_JOIN, n.join || '、', v => { n.join = v; })));
        break;
      case 'sift':
        box.appendChild(bank);
        box.appendChild(this.field('从哪些分类找候选（连子类）', this.cats(n)));
        box.appendChild(h('div', { class:'wnw-row' }, [
          this.field('默认值', this.txt(n.def, v => { n.def = v; }, '打开就填在框里，可以留空')),
          this.field('灰字提示', this.txt(n.ph, v => { n.ph = v; }, '空框里那句灰字'))]));
        break;
      case 'tarea':
        box.appendChild(h('div', { class:'wnw-row' }, [
          this.field('几行高', this.num(n.rows === undefined ? 4 : n.rows, 2, 20, v => { n.rows = v; })),
          this.field('灰字提示', this.txt(n.ph, v => { n.ph = v; }, '空框里那句灰字'))]));
        box.appendChild(this.field('打开就填', this.txt(n.def, v => { n.def = v; }, '一整段原样进结果，可以留空')));
        break;
      case 'color':
        box.appendChild(h('div', { class:'wnw-row' }, [
          this.field('默认值', this.txt(n.def, v => { n.def = v; }, '#3b6cb5 或色名，可留空')),
          this.field('灰字提示', this.txt(n.ph, v => { n.ph = v; }, '空框里那句灰字'))]));
        break;
      case 'date':
        box.appendChild(h('div', { class:'wnw-row' }, [
          this.field('填哪一样', this.selVal([['date', '某一天'], ['time', '时刻'], ['both', '哪天几点']],
            n.kind || 'date', v => { n.kind = v; this.draw(); })),
          this.field('打开就填', this.txt(n.def, v => { n.def = v; }, '比如 2026-10-04，可留空'))]));
        break;
    }
    box.appendChild(this.reqCard(n));
  }
  /* ---------- 件-4 这一格的填写要求：不合规就在那一格下面出字、拦住这一次生成 ----------
     比的是界面上这一格现下填着什么（不是抽出来的那个词）；判定在 sh-gen.js 的 cellCheck 里。
     这几个参数换功能时不清：说的是「怎么要求这一格」，跟「这一格怎么取值」不是一回事。
     数框填 0、写法框留空都等于不限制。
     「不合格时」是件-4 第四步那档松紧：默认拦住这一轮；改「只提一句」照样在那一格下面出字，
     但不进拦生成的那份清单 —— 结果出得来，只是提醒这一格看着不对。 */
  reqCard(n){
    const g = h('div', { class:'sh-mod' });
    g.appendChild(h('b', {}, '填写要求'));
    g.appendChild(h('div', { class:'wnw-row' }, [
      this.field('必填', this.selVal([['', '不用'], ['1', '要']], n.req ? '1' : '',
        v => { if(v) n.req = true; else delete n.req; this.draw(); })),
      this.field('字数最少', this.num(n.cMin || 0, 0, 99, v => { v ? n.cMin = v : delete n.cMin; })),
      this.field('字数最多', this.num(n.cMax || 0, 0, 99, v => { v ? n.cMax = v : delete n.cMax; }))
    ]));
    g.appendChild(h('div', { class:'wnw-row' }, [
      this.field('数字不小', this.num(n.nMin || 0, -999, 9999, v => { v ? n.nMin = v : delete n.nMin; })),
      this.field('数字不大', this.num(n.nMax || 0, -999, 9999, v => { v ? n.nMax = v : delete n.nMax; })),
      this.field('写法', this.txt(n.pat, v => { v ? n.pat = v : delete n.pat; }, '整串要符合的写法，比如 \\d{4}-\\d{2}；留空就是不比'))
    ]));
    g.appendChild(this.field('不合格时', h('div', { class:'wnw-seg' },
      [['', '拦住这一轮'], ['1', '只提一句，照样出']].map(([k, nm]) => h('button', {
        class:(n.warn ? '1' : '') === k ? 'on' : '', title:'选「只提一句」：那一格下面照样写着哪儿不合格，但不拦生成',
        onclick:() => { if(k) n.warn = true; else delete n.warn; this.draw(); } }, nm)))));
    g.appendChild(this.field('不合格时说', this.txt(n.cMsg, v => { v ? n.cMsg = v : delete n.cMsg; },
      '留空就说引擎那句（比如「字数超过 4，现在 7」）')));
    return g;
  }
  /* 生成式下拉的大类：候选 = 这一类 . 上游现下的值；挑子只列顶级（底下靠点号再分） */
  dynCat(n){
    const opts = this.catNames(n).filter(c => c.indexOf('.') < 0);
    const s = h('select', { class:'wnw-input' }, [h('option', { value:'', selected:!n.cat }, '（选一个大类）')]
      .concat(opts.map(c => h('option', { value:c, selected:c === n.cat }, c))));
    s.addEventListener('change', () => { n.cat = s.value; this.draw(); });
    return s;
  }
  bankSel(n){
    return this.selVal([['', '跟随组件词库（' + this.R.bank + '）']].concat(this.banks.map(b => [b, b])),
      n.bank || '', async v => { if(v) n.bank = v; else delete n.bank; await this.loadBank(v || this.R.bank); this.draw(); });
  }
  catNames(fn){
    try{ const b = genBank(fn.bank || this.R.bank); return b.loaded ? b.names() : []; }
    catch(e){ return []; }
  }
  cats(n){
    return this.catChips(n.cats || (n.cats = []), v => { n.cats = v; }, n);
  }
  /* 分类那一串挑子：ref 是拿词库的那块（控件或整张配方），分支改分类那儿也用它 */
  catChips(list, put, ref){
    const row = h('div', { class:'wnw-row sh-chips' });
    for(const c of list) row.appendChild(h('span', { class:'wnw-chip sh-chip', title:c }, [
      h('span', {}, c),
      h('button', { class:'sh-x', title:'去掉「' + c + '」', html:icoMarkup('close'), onclick:() => { put(list.filter(x => x !== c)); this.re(); } })]));
    const add = this.addSel(this.catNames(ref).filter(c => !list.includes(c)), '加分类…', c => { list.push(c); put(list.slice()); this.re(); });
    if(add) row.appendChild(add);
    if(!list.length && !this.catNames(ref).length) row.appendChild(h('span', { class:'wnw-chip' }, '这本词库里还没有分类'));
    return row;
  }
  oneCat(n){
    const opts = this.catNames(n);
    const s = h('select', { class:'wnw-input' }, [h('option', { value:'', selected:!n.cat }, '（选一个分类）')]
      .concat(opts.map(c => h('option', { value:c, selected:c === n.cat }, c))));
    s.addEventListener('change', () => {
      n.cat = s.value;
      /* 选完顺手把「第几层」按点号个数对上，用户爱改再改 */
      n.at = Math.max(1, String(n.cat).split('.').length);
      this.draw();
    });
    return s;
  }
  fuseSrc(n){
    const list = n.sources || (n.sources = []);
    const box = h('div', { class:'wnw-col' });
    list.forEach((s, i) => {
      const kind = ('cat' in s) ? 'cat' : ('ctl' in s) ? 'ctl' : 'text';
      const row = h('div', { class:'wnw-row' });
      row.appendChild(this.selVal([['cat', '词库分类'], ['ctl', '切出来的字段'], ['text', '写死几项']], kind, v => {
        n.sources[i] = v === 'cat' ? { cat:'' } : v === 'ctl' ? { ctl:'' } : { text:'' };
        this.draw();
      }));
      row.appendChild(this.sourceVal(s, kind));
      row.appendChild(this.btn('删', () => { list.splice(i, 1); this.draw(); }));
      box.appendChild(row);
    });
    if(!list.length) box.appendChild(h('div', { class:'wnw-hint' }, '还没有来源'));
    box.appendChild(this.btnIT('plus', '来源', () => { list.push({ text:'' }); this.draw(); }));
    return box;
  }
  sourceVal(s, kind){
    if(kind === 'cat'){
      const opts = this.catNames(this.R);
      return this.selVal(opts.map(c => [c, c]), s.cat || '', v => { s.cat = v; });
    }
    if(kind === 'ctl'){
      const list = this.ctls().filter(c => c.fn === 'extract').map(c => [c.id, c.name || c.id]);
      return this.selVal(list, s.ctl || '', v => { s.ctl = v; this.draw(); }, '（选一个提取控件）');
    }
    return this.txt(s.text, v => { s.text = v; }, '几项用；隔开');
  }

  /* ---------- 判断逻辑：一排按钮，点谁开谁那一档 ----------
     摆法照功能模块那排加块钮：链上有什么就摆什么，按钮上直接看得出这条在不在用；
     这条从哪儿来的、哪个组件在用它 —— 一律不摆，参数在他自己那一档里改。
     还没拼进来的分两组摆在下面：剔掉不合格的是一组，管出不出、出几条、怎么排、内容怎么改的是另一组。
     分组只认 sh-gen.js 里那份 GEN_SOFT，引擎那头的名单一改，界面上这两组跟着改，不会写死两份。
     先后照「现有配方里开着这条的组件数」从多到少排，同数量保持原有前后。 */
  rulesCard(){
    const R = this.R, card = h('div', { class:'wnw-card' });
    card.appendChild(this.cardTitle('判断逻辑', 'rule'));
    const list = R.rules || (R.rules = []);
    if(!list.length) card.appendChild(h('div', { class:'wnw-hint' }, '一条规则都没摆，生成出来就是功能模块里填的原文'));
    card.appendChild(this.field('这条判断链', h('div', { class:'wnw-row sh-chips' },
      this.byUse(list).map(r => this.ruleBtn(list, r)))));
    const add = g => () => {
      list.push(Object.assign({ k:g.k, on:true }, JSON.parse(JSON.stringify(g.p || {}))));
      this.draw();
    };
    const back = GW_RULES.filter(g => !list.some(r => r.k === g.k));
    [['剔掉不合格的，点一下拼到链尾', back.filter(g => GEN_SOFT.indexOf(g.k) >= 0)],
     ['出不出、出几条、怎么排、内容怎么改，点一下拼到链尾', back.filter(g => GEN_SOFT.indexOf(g.k) < 0)]
    ].forEach(pair => {
      if(!pair[1].length) return;
      card.appendChild(this.field(pair[0], h('div', { class:'wnw-row sh-chips' },
        this.byUse(pair[1]).map(g => this.btn(g.name, add(g), g.tip)))));
    });
    return card;
  }
  /* 开着这条的组件有几个：数的是已经落盘的配方，手里这张草稿不算（它还没成「现有配方」） */
  useCount(k){
    let n = 0;
    try{ for(const R of Gen.list()) if((R.rules || []).some(r => r.k === k && r.on)) n++; }catch(e){}
    return n;
  }
  byUse(arr){
    return arr.map((v, i) => [v, this.useCount(v.k), i])
      .sort((a, b) => b[1] - a[1] || a[2] - b[2]).map(x => x[0]);
  }
  ruleBtn(arr, r){
    const g = gwRule(r.k);
    const b = this.btn(g ? g.name : '不认识的规则', () => this.ruleOpen(arr, r),
      g ? (r.on ? '在用 · 点开改参数' : '未使用 · 点开改参数') : '配方里有这条，产物里不认得：' + r.k);
    if(!r.on) b.style.opacity = '.5';
    return b;
  }
  /* 「重画」重画的是当前这一页：判断规则的小窗开着就只重画那一张，不去动底下的向导 */
  re(){ if(this.ruleBox && this.ruleBox.isConnected) this.ruleShow(true); else { this.rule = null; this.draw(); } }
  ruleOpen(arr, r){ this.rule = { arr, r }; this.ruleShow(false); }
  ruleShow(again){
    const ref = this.rule; if(!ref) return;
    const { arr, r } = ref, g = gwRule(r.k);
    const box = h('div', { class:'wnw-col', style:'gap:10px;min-width:min(680px,92vw)' });
    if(!g) box.appendChild(h('div', { class:'wnw-hint' },
      '成果内容中不识别这条判断规则：' + r.k + ' · 留存不影响，删掉更干净'));
    else{
      box.appendChild(h('div', { class:'wnw-hint' }, g.tip));
      /* 这几条自己说清读哪几格 / 挂哪个名字，顶上那排「读哪个变量」就不重复摆（搭配限制认 a、b 两格） */
      const own = ['calc', 'dim', 'pair'].indexOf(r.k) >= 0;
      box.appendChild(h('div', { class:'wnw-row', style:'align-items:flex-end;gap:12px' }, [
        this.field('生成时走不走这一条', this.btn(r.on ? '在用' : '未使用', () => { r.on = !r.on; this.re(); },
          '这条现在算不算（按钮上淡一下的就是不算的）')),
        r.on && !own ? this.field('读哪个变量', this.varSel(r.src, v => { if(v) r.src = v; else delete r.src; this.re(); })) : null
      ]));
      if(r.on) this.ruleParams(box, r);
    }
    this.ruleBox = box;
    H().dlg.open('判断逻辑 · ' + (g ? g.name : r.k), box, [
      this.btn('删掉这条', () => { const i = arr.indexOf(r); if(i >= 0) arr.splice(i, 1); this.ruleClose(); }, '从这条判断链上拿掉'),
      h('button', { class:'wnw-btn primary', onclick:() => this.ruleClose() }, '完成')
    ], again ? { redraw:true } : null);
  }
  ruleClose(){ this.rule = null; this.ruleBox = null; H().dlg.close(); this.draw(); }
  ruleParams(box, r){
    if(r.k === 'branch'){ this.branchEdit(box, r); return; }
    if(r.k === 'retry'){
      box.appendChild(h('div', { class:'wnw-row' }, [
        this.field('最多重抽几次', this.num(r.n === undefined ? 12 : r.n, 1, 999, v => { r.n = v; })),
        this.field('试完还不合怎么办', this.selVal([['drop', '照旧剔掉'], ['loose', '留最后抽的那一版'], ['ph', '写一句占位的']],
          r.onFail || 'drop', v => { r.onFail = v; this.re(); }))
      ]));
      if(r.onFail === 'ph')
        box.appendChild(this.field('占位写什么', this.txt(r.ph, v => { r.ph = v; }, '（重抽若干次仍不合格）')));
      return;
    }
    if(r.k === 'cap')
      { box.appendChild(this.field('最多几条', this.num(r.n === undefined ? 20 : r.n, 1, 999, v => { r.n = v; }))); return; }
    if(r.k === 'lenLimit')
      { box.appendChild(h('div', { class:'wnw-row' }, [
        this.field('少于几字丢掉', this.num(r.min || 0, 0, 99, v => { r.min = v; })),
        this.field('超过几字裁掉', this.num(r.max || 0, 0, 999, v => { r.max = v; }))])); return; }
    if(r.k === 'number')
      { box.appendChild(this.field('序号写成', this.txt(r.tpl, v => { r.tpl = v; }, '【第{序}条】'))); return; }
    if(r.k === 'calc')
      { box.appendChild(h('div', { class:'wnw-row' }, [
        this.field('算出来的数挂哪个名字', this.txtRo(r.name, v => { r.name = v; }, '数量')),
        h('div', { class:'wnw-field', style:'flex:2 1 16em' }, [h('label', {}, '公式（变量写 {名字}，例子：{数量} * min({等级},3) + 5）'),
          this.txt(r.expr, v => { r.expr = v; }, '{数量} * 2')]
        )])); return; }
    if(r.k === 'pair')
      { box.appendChild(h('div', { class:'wnw-row' }, [
        this.field('比哪一格', this.varSel(r.a, v => { r.a = v || ''; this.re(); })),
        this.field('和哪一格比（不填就拿这一格自己那些行互比）', this.varSel(r.b, v => { r.b = v || ''; this.re(); })),
        this.field('怎么算撞车', this.selVal([['same', '完全同名'], ['contain', '一个含另一个'],
          ['tailHead', '前一个尾字 = 后一个首字'], ['noShare', '汉字字组有重合']], r.how || 'same', v => { r.how = v; this.re(); }))
      ])); return; }
    if(r.k === 'like')
      { box.appendChild(h('div', { class:'wnw-row' }, [
        this.field('几成字组相同算太像', this.num(r.pct === undefined ? 40 : r.pct, 10, 100, v => { r.pct = v; })),
        h('div', { class:'wnw-field', style:'flex:1 1 14em' }, [h('label', {}, '对照哪个分类（现实词表，可留空）'),
          this.selVal(this.catNames(r).map(c => [c, c]), r.cat || '', v => { r.cat = v; this.re(); }, '（不对照）')])]));
        if(r.cat) box.appendChild(h('div', { class:'wnw-row' }, [
          this.selVal([['', '跟随组件词库']].concat(this.banks.map(b => [b, b])), r.bank || '', v => { r.bank = v; this.re(); })]));
        return; }
    if(r.k === 'diverse')
      { box.appendChild(h('div', { class:'wnw-row' }, [
        this.field('两两至少几项不同', this.num(r.minDiff || 1, 1, 9, v => { r.minDiff = v; })),
        this.field('最多留几条', this.num(r.n || 3, 1, 99, v => { r.n = v; }))])); return; }
    if(r.k === 'rw'){ this.rwEdit(box, r); return; }
    if(r.k === 'dim'){ this.dimEdit(box, r); return; }
  }
  /* 生成格式改写：动作一排排叠着来，「旧=>新」那档再给一张替换表 */
  rwEdit(box, r){
    const ops = r.ops || (r.ops = []);
    const NAMES = { paren:'剥掉括号里的字', hex:'色号换成黑', light:'颜色太浅换黑', rep:'英文连着重复的字母去掉',
      cap:'首字母转大写', low:'首字母转小写', num:'只留数字', replace:'按「旧=>新」替换表改字' };
    for(let i = 0; i < ops.length; i++){
      const o = ops[i], row = h('div', { class:'wnw-row' });
      row.appendChild(this.selVal(Object.keys(NAMES).map(k => [k, NAMES[k]]), o.op, v => { o.op = v; this.re(); }));
      if(o.op === 'replace')
        row.appendChild(this.txt(o.segs, v => { o.segs = v; }, '深黑=>墨黑；(旧)>>；一条一句，分号隔开'));
      row.appendChild(this.btn('删', () => { ops.splice(i, 1); this.re(); }));
      box.appendChild(row);
    }
    const left = Object.keys(NAMES).filter(k => !ops.some(o => o.op === k));
    if(left.length) box.appendChild(this.field('点着往里加', h('div', { class:'wnw-row sh-chips' },
      left.map(k => this.btn(NAMES[k], () => { ops.push({ op:k, segs:'' }); this.re(); })))));
    if(!ops.length) box.appendChild(h('div', { class:'wnw-hint' }, '还没有改写动作'));
  }
  /* 多维定义：维度表 + 规则表 + 出编码还是出词 + 摊不摊组合 */
  dimEdit(box, r){
    const dims = r.dims || (r.dims = []);
    box.appendChild(h('b', {}, '维度表'));
    for(let i = 0; i < dims.length; i++){
      const d = dims[i], card = h('div', { class:'sh-mod' });
      card.appendChild(h('div', { class:'wnw-row', style:'justify-content:space-between;align-items:center' }, [
        h('b', {}, '维度 ' + (i + 1) + (d.d ? ' · ' + d.d : '')),
        h('div', { class:'wnw-row', style:'gap:6px' }, [
          i > 0 ? this.btnIco('up', () => { dims.splice(i - 1, 0, dims.splice(i, 1)[0]); this.re(); }, '上移') : null,
          i < dims.length - 1 ? this.btnIco('down', () => { dims.splice(i + 1, 0, dims.splice(i, 1)[0]); this.re(); }, '下移') : null,
          this.btn('删', () => { dims.splice(i, 1); this.re(); })])
      ]));
      card.appendChild(h('div', { class:'wnw-row' }, [
        h('div', { class:'wnw-field', style:'flex:1 1 8em' }, [h('label', {}, '维度叫什么'),
          this.txtRo(d.d, v => { d.d = v; }, '气候')]),
        this.field('界面上已知（填编码或词，留空靠表推）', this.txt(d.val, v => { d.val = v; }, 'C1 或 热带雨林'))
      ]));
      card.appendChild(this.field('词条出自哪些分类（写「C1 热带雨林」这种编码加词）',
        this.catChips(d.cats || (d.cats = []), v => { d.cats = v; }, this.R)));
      card.appendChild(this.field('推不出就报（可留空）', this.txt(d.fallback, v => { const s = v.trim(); if(s) d.fallback = s; else delete d.fallback; }, '没有该生态')));
      box.appendChild(card);
    }
    box.appendChild(this.btnIT('plus', '维度', () => { dims.push({ d:'', cats:[], val:'' }); this.re(); }));
    const table = r.table || (r.table = []);
    box.appendChild(h('b', {}, '规则表（一行一条：「要推：条件 = 结果」，条件像 气候,植被 = C1,V2）'));
    const names = dims.map(d => d.d).filter(Boolean);
    for(let i = 0; i < table.length; i++){
      const card = h('div', { class:'sh-mod' });
      const m = /^([^:：]*)[:：]?\s*(.*)$/.exec(String(table[i] || ''));
      const want = (m && m[1] || '').trim(), rest = (m && m[2] || '').trim();
      const eq = /^(.*?)[=＝](.*)$/.exec(rest);
      card.appendChild(h('div', { class:'wnw-row' }, [
        this.selVal(names.map(v => [v, v]), want, v => { table[i] = v + '：' + rest; this.re(); }, '要推哪一维'),
        this.txt(eq ? eq[1] : rest, v => { table[i] = want + '：' + v + (eq ? eq[2] ? ' = ' + eq[2] : ' = ' : ' = '); }, '条件，像 气候,植被 = C1,V2'),
        this.btn('删', () => { table.splice(i, 1); this.re(); })
      ]));
      if(eq) card.appendChild(this.field('推出什么', this.txt(eq[2], v => { table[i] = want + '：' + (rest.split(/[=＝]/)[0] || '').trim() + ' = ' + v; }, 'S3')));
      box.appendChild(card);
    }
    if(!table.length) box.appendChild(h('div', { class:'wnw-hint' }, '还没有规则，推的那一头全靠这张表'));
    box.appendChild(this.btnIT('plus', '加一条规则', () => { table.push((names[0] || '') + '： = '); this.re(); }));
    box.appendChild(h('div', { class:'wnw-row' }, [
      this.field('出编码还是出词', this.selVal([['word', '出词（C1 → 热带雨林）'], ['code', '出编码']], r.out || 'word', v => { r.out = v; this.re(); })),
      this.field('名字挂哪个（模板里 {这名} 取得到）', this.txtRo(r.name, v => { r.name = v; }, '生态')),
      this.field('几维之间用什么连', this.txt(r.join, v => { r.join = v; }, '、'))
    ]));
    box.appendChild(h('label', { class:'wnw-switch' }, [
      h('input', { type:'checkbox', checked:!!r.expand, onchange:e => { r.expand = e.target.checked; this.re(); } }),
      h('span', {}, '摊组合：把已知维度能配的全组合摊成行，交给「多样化」挑')
    ]));
  }

  /* ---------- 条件分支：一条一条排下来，命中第一条就停，不填条件的那条算否则 ----------
     一块只做决定：这条块自己不开词库、不改值，决定写在 case 的 act 上，
     引擎里谁要用谁去取（改分类 → 抽词那头；换拼法 → 拼结果那头；不要哪几格 / 换条数 / 插一行 → 判断流水线最后）。 */
  branchEdit(box, r){
    box.appendChild(this.field('结论叫什么（文本模板里 {这名} 就取得到）',
      this.txtRo(r.name, v => { r.name = v; }, '分支')));
    const cs = r.cases || (r.cases = []);
    for(let i = 0; i < cs.length; i++) box.appendChild(this.caseCard(cs, i));
    if(!cs.length) box.appendChild(h('div', { class:'wnw-hint' }, '还没有条件，下面两个按钮加'));
    const hasElse = cs.some(c => !c.op);
    box.appendChild(h('div', { class:'wnw-row', style:'margin-top:6px' }, [
      this.btnIT('plus', '加一条', () => {
        const at = hasElse ? cs.length - 1 : cs.length;
        cs.splice(at, 0, { op:'eq', txt:'', act:{} }); this.re();
      }),
      hasElse ? null : this.btnIT('plus', '否则那一条', () => { cs.push({ op:'', txt:'', act:{} }); this.re(); })
    ]));
  }
  caseCard(cs, i){
    const c = cs[i], box = h('div', { class:'sh-mod' });
    const del = this.btn('删', () => { cs.splice(i, 1); this.re(); }, '删掉这一条');
    box.appendChild(h('div', { class:'wnw-row', style:'justify-content:space-between;align-items:center' }, [
      h('b', {}, c.op ? '条件 ' + (i + 1) : '否则'),
      h('div', { class:'wnw-row', style:'gap:6px' }, [
        i > 0 ? this.btnIco('up', () => { cs.splice(i - 1, 0, cs.splice(i, 1)[0]); this.re(); }, '上移（越靠前越先命中）') : null,
        i < cs.length - 1 ? this.btnIco('down', () => { cs.splice(i + 1, 0, cs.splice(i, 1)[0]); this.re(); }, '下移') : null,
        this.codeBtn(c), del])
    ]));
    if(c.op){
      const hint = BR_OPHINT[c.op] || ['', ''];
      box.appendChild(h('div', { class:'wnw-row' }, [
        h('div', { class:'wnw-field', style:'flex:1 1 10em' }, [h('label', {}, '怎么算成立'),
          this.selVal(BR_OPS, c.op, v => { c.op = v; this.re(); })]),
        h('div', { class:'wnw-field', style:'flex:1 1 12em' }, [h('label', {}, '和什么比'),
          this.txt(c.txt, v => { c.txt = v; }, hint[1])])
      ]));
      box.appendChild(h('div', { class:'wnw-hint' }, hint[0]));
    }
    box.appendChild(this.field('结论写成（不填就拿上面那个条件值顶）',
      this.txt(c.out, v => { const s = v.trim(); if(s) c.out = s; else delete c.out; }, '走 A')));
    box.appendChild(this.branchAct(c));
    return box;
  }
  /* 一条 case 挂出来的决定：一条能管好几处（换分类 + 换格式 + 换条数 一块儿给） */
  branchAct(c){
    const a = c.act || (c.act = {}), box = h('div', { class:'wnw-col' });
    const NAME = { cats:'某几格改从别的分类抽', skip:'不要哪几格', tpl:'换拼法', join:'换多项之间', n:'换条数', add:'插一行' };
    const keys = ['cats', 'skip', 'tpl', 'join', 'n', 'add'];
    for(const k of keys) if(a[k] !== undefined) box.appendChild(this.field(NAME[k], this.actEdit(k, a)));
    const left = keys.filter(k => a[k] === undefined);
    if(left.length) box.appendChild(this.field('点着往里加', h('div', { class:'wnw-row sh-chips' },
      left.map(k => this.btn(NAME[k], () => {
        a[k] = k === 'cats' ? {} : k === 'skip' || k === 'add' ? [] : k === 'n' ? 3 : '';
        this.re();
      }, NAME[k])))));
    return box;
  }
  actEdit(k, a){
    const del = () => { delete a[k]; this.re(); };
    const rm = this.btn('放弃', del);
    if(k === 'cats'){
      const box = h('div', { class:'wnw-col' });
      for(const nm of Object.keys(a.cats)) box.appendChild(h('div', { class:'wnw-row' }, [
        h('span', { class:'wnw-chip sh-chip' }, [h('button', { class:'sh-x', title:'不管这一格了', html:icoMarkup('close'), onclick:() => { delete a.cats[nm]; this.re(); } }), h('span', {}, nm)]),
        this.catChips(a.cats[nm], v => { a.cats[nm] = v; }, this.catsBank(nm))]));
      const opts = this.catsCtls().map(c => c.name || c.id).filter(nm => !a.cats[nm]);
      const add = this.addSel(opts, '管哪一格…', nm => { a.cats[nm] = []; this.re(); });
      if(add) box.appendChild(add);
      box.appendChild(rm);
      return box;
    }
    if(k === 'skip'){
      const box = h('div', { class:'wnw-row sh-chips' });
      for(const nm of a.skip) box.appendChild(h('span', { class:'wnw-chip sh-chip' }, [
        h('button', { class:'sh-x', title:'这一格还是要', html:icoMarkup('close'), onclick:() => { a.skip = a.skip.filter(x => x !== nm); this.re(); } }),
        h('span', {}, nm)]));
      const add = this.addSel(this.vars().filter(v => a.skip.indexOf(v) < 0), '不要哪一格…', v => { a.skip.push(v); this.re(); });
      if(add) box.appendChild(add);
      box.appendChild(rm);
      return box;
    }
    if(k === 'tpl'){
      const ta = h('textarea', { class:'wnw-input', rows:3 }); ta.value = a.tpl || '';
      ta.addEventListener('input', () => { a.tpl = ta.value; });
      return h('div', { class:'wnw-col' }, [ta, rm]);
    }
    if(k === 'join')
      return h('div', { class:'wnw-row' }, [this.selVal(GW_JOIN, a.join || '\n', v => { a.join = v; }), rm]);
    if(k === 'n')
      return h('div', { class:'wnw-row' }, [this.num(a.n || 1, 1, 999, v => { a.n = v; }), rm]);
    const box = h('div', { class:'wnw-col' });
    a.add.forEach((p, i) => box.appendChild(h('div', { class:'wnw-row' }, [
      this.txt(p.k, v => { p.k = v; }, '行名（可留空）'),
      this.txt(p.v, v => { p.v = v; }, '内容，能用 {占位符}'),
      this.btn('删', () => { a.add.splice(i, 1); this.re(); })])));
    box.appendChild(this.btnIT('plus', '再插一行', () => { a.add.push({ k:'', v:'' }); this.re(); }));
    box.appendChild(rm);
    return box;
  }
  /* 能被分支改分类的那三种：界面上挑了分类的（二级下拉、穿透下拉、可修改随机）；三级和融合的来源形状不一样，等生成式下拉那一轮 */
  catsCtls(){ return this.ctls().filter(c => c.fn === 'cat2' || c.fn === 'thru' || c.fn === 'rand'); }
  catsBank(nm){ const c = this.ctls().find(x => (x.name || x.id) === nm); return c || this.R; }

  /* ---------- 输出 ---------- */
  outCard(){
    const o = this.R.out, card = h('div', { class:'wnw-card' });
    card.appendChild(h('h4', {}, '输出'));
    card.appendChild(this.field('出法', h('div', { class:'wnw-seg' },
      [['list', '列表组合'], ['table', '表格'], ['text', '文本组合']].map(([k, nm]) => h('button', {
        class:o.mode === k ? 'on' : '', onclick:() => { o.mode = k; this.draw(); } }, nm)))));
    card.appendChild(this.field('多项之间', this.selVal(GW_JOIN, o.join || '\n', v => { o.join = v; })));
    if(o.mode === 'table'){
      const names = this.vars();
      const pick = (o.cols || []).filter(x => names.includes(x));
      const bar = h('div', { class:'wnw-row sh-chips' });
      if(!names.length) bar.appendChild(h('span', { class:'wnw-hint' }, '界面上还没有会出结果的格子，先去上面加功能模块'));
      for(const nm of names){
        const k = pick.indexOf(nm);
        bar.appendChild(h('button', { class:'wnw-btn mini' + (k >= 0 ? ' on' : ''),
          title:k >= 0 ? ('第 ' + (k + 1) + ' 列，点一下不当列') : '点一下当一列（按点的先后排）',
          onclick:() => {
            if(k >= 0) pick.splice(k, 1); else pick.push(nm);
            o.cols = pick.slice(); this.draw();
          } }, nm));
      }
      card.appendChild(this.field('哪几列', bar));
      card.appendChild(h('div', { class:'wnw-hint' }, '一个都没点就按界面上出现的顺序全摆上；组循环出的那几份竖着排成几行'));
    }
    if(o.mode === 'text'){
      const ta = h('textarea', { class:'wnw-input', rows:4 }); ta.value = o.template || '';
      ta.addEventListener('input', () => { o.template = ta.value; });
      card.appendChild(this.field('模板', ta));
      card.appendChild(this.field('点着往里插', this.phRow(ta)));
      card.appendChild(h('label', { class:'wnw-switch' }, [
        h('input', { type:'checkbox', checked:!!o.rows, onchange:e => { o.rows = e.target.checked; this.draw(); } }),
        h('span', {}, '拆成多行：整块按行拆开进判断流水线，每一行各自过判定，结果里每一行给一个「只换该项」')
      ]));
      card.appendChild(h('div', { class:'wnw-hint' }, '{序} 是组循环里的第几份；未填写的原样留存占位符'));
    }
    return card;
  }
  /* 占位符按界面上填的名字列出来：三级联动多两个分部，提取计数和勾选多一个数，颜色多三个分量，日期多年月日 */
  phRow(ta){
    const row = h('div', { class:'wnw-row sh-chips' });
    const add = (k, label) => row.appendChild(this.btn(label, () => {
      const p = ta.selectionStart === null ? ta.value.length : ta.selectionStart;
      ta.value = ta.value.slice(0, p) + k + ta.value.slice(ta.selectionEnd === null ? p : ta.selectionEnd);
      this.R.out.template = ta.value;
      ta.focus(); ta.selectionStart = ta.selectionEnd = p + k.length;
    }));
    this.walk(this.R.ui, n => {
      const nm = n.name || n.id;
      if(n.t === 'ctl'){
        add('{' + nm + '}', '{' + nm + '}');
        if(n.fn === 'cat3'){ add('{' + nm + '.类}', '{' + nm + '.类}'); add('{' + nm + '.项}', '{' + nm + '.项}'); }
        if(n.fn === 'extract'){ add('{' + nm + '.n}', '{' + nm + '.n}'); }
        if(n.fn === 'multi'){ add('{' + nm + '.n}', '{' + nm + '.n}（勾了几项）'); add('{' + nm + '.项}', '{' + nm + '.项}'); }
        if(n.fn === 'color'){ add('{' + nm + '.红}', '{' + nm + '.红}'); add('{' + nm + '.绿}', '{' + nm + '.绿}'); add('{' + nm + '.蓝}', '{' + nm + '.蓝}'); }
        if(n.fn === 'date'){ for(const k of ['年', '月', '日']) add('{' + nm + '.' + k + '}', '{' + nm + '.' + k + '}'); }
      } else if(n.t === 'loop' && nm) add('{' + nm + '}', '{' + nm + '}');
    });
    /* 条件分支的传输口：那条块起的名字就是一个占位符，走哪条路写在结果里；
       数算逻辑和多维定义挂出来的名字同样能在模板里 {这个名字} 取到 */
    for(const r of this.R.rules || [])
      if(r && r.on && String(r.name || '').trim()){
        if(r.k === 'branch') add('{' + r.name + '}', '{' + r.name + '}（分支结论）');
        if(r.k === 'calc') add('{' + r.name + '}', '{' + r.name + '}（算出来的数）');
        if(r.k === 'dim') add('{' + r.name + '}', '{' + r.name + '}（推出来的值）');
      }
    add('{序}', '{序}');
    return row;
  }

  /* ---------- 收口：查一遍，落两份文件，立刻装上 ---------- */
  check(){
    const R = this.R;
    if(!String(R.name).trim()) return '名字还没填';
    if(!GenWizard.okId(R.id)) return '代号要用小写字母开头，后面小写字母、数字、- 或 _，比如 scene-pack';
    if(R.id !== this.editing && Gen.get(R.id)) return '已经有叫「' + R.id + '」的组件了，换个代号';
    const cs = this.ctls();
    if(!cs.length && !R.ui.some(n => n.t === 'text')) return '界面上一个控件都还没有';
    /* 控件名和组循环的名字都是模板里的占位符，重了认不出 */
    const nm = [];
    const takeName = n => {
      const v = String(n.name || '').trim();
      if(!v){ if(n.t === 'ctl') return '有控件还没起名，结果里靠这个名字'; if(n.t === 'loop') return '组循环还没起名'; return null; }
      if(nm.includes(v)) return '名字重了：' + v + '，占位符会认不出';
      nm.push(v); return null;
    };
    for(const c of cs){ const e = takeName(c); if(e) return e; }
    const loops = [];
    this.walk(R.ui, n => { if(n.t === 'loop') loops.push(n); });
    for(const l of loops){ const e = takeName(l); if(e) return e; }
    for(const c of cs){
      if((c.fn === 'cat2' || c.fn === 'thru') && !(c.cats || []).length) return '「' + c.name + '」还没选分类';
      if((c.fn === 'multi' || c.fn === 'sift') && !(c.cats || []).length)
        return '「' + c.name + '」还没选分类，候选从这些类里摆出来';
      if(c.fn === 'cat3' && !c.cat) return '「' + c.name + '」还没选大类';
      if(c.fn === 'fuse' && !(c.sources || []).length) return '「' + c.name + '」还没加来源';
      if(c.fn === 'numShow' && !c.src) return '「' + c.name + '」还没说要数字';
      if(c.fn === 'dyn'){
        if(!c.src) return '「' + c.name + '」还没说上游是哪个变量';
        if(!c.cat) return '「' + c.name + '」还没选大类（底下按上游的值分层）';
      }
      if(c.fn === 'fmt' && !(c.cats || []).length) return '「' + c.name + '」还没选格式句子的分类';
      if(c.fn === 'rng' && !(Number(c.hi) > Number(c.lo))) return '「' + c.name + '」掷数的上限要比下限大';
      if(c.fn === 'range' && !(Number(c.max) > Number(c.min))) return '「' + c.name + '」滑杆的头要比尾大';
    }
    for(const l of loops){
      if(!l.src) return '组循环「' + (l.name || '') + '」还没选份数跟着谁走';
      if(!(l.items || []).length) return '组循环「' + (l.name || '') + '」里还空着';
    }
    /* 页签空着不如不摆：一排没有一页、有一页里没格子，都拦下来 */
    let tabErr = '';
    this.walk(R.ui, n => {
      if(tabErr) return;
      if(n.t === 'tabs' && !(n.items || []).length) tabErr = '有一排页签里还没有一页';
      else if(n.t === 'pane' && !(n.items || []).length) tabErr = '页签「' + (n.name || '还没起名') + '」里还空着';
    });
    if(tabErr) return tabErr;
    if(R.out.mode === 'table' && !this.vars().length) return '表格那一档至少要有一个会出结果的变量';
    if(R.out.mode === 'text' && !String(R.out.template || '').trim()) return '文本组合的模板还空着';
    for(const r of R.rules || []){
      if(!gwRule(r.k)) continue;
      if(!r.on) continue;
      if(r.k === 'cap' && !(Number(r.n) > 0)) return '「最多出几条」还没定条数';
      if(r.k === 'branch'){
        if(!r.src) return '「条件分支」还没说读哪个变量';
        if(!(r.cases || []).length) return '「条件分支」一条条件都没摆，它什么都决定不了';
        const pn = String(r.name || '').trim() || '分支';
        if(nm.includes(pn)) return '「条件分支」的结论叫「' + pn + '」，和上面某个变量重了，换个名';
      }
      if(r.k === 'number' && !String(r.tpl || '').trim()) return '「每条前面标序号」还没写序号长什么样';
      if(r.k === 'calc'){
        const cn = String(r.name || '').trim();
        if(!cn) return '「数算逻辑」还没说算出来的数挂哪个名字';
        if(!String(r.expr || '').trim()) return '「数算逻辑」的公式还空着';
        if(nm.includes(cn)) return '「数算逻辑」挂的名字「' + cn + '」和某个变量重了，换个名';
        /* 每个 {名} 都当 1 试算一遍：还算不出数，就是式子本身写坏了 */
        if(Number.isNaN(calcEval(String(r.expr), () => 1))) return '「数算逻辑」的公式读不通：' + String(r.expr);
      }
      if(r.k === 'pair' && !String(r.a || '').trim()) return '「前后配对」还没说比哪一格';
      if(r.k === 'rw'){
        if(!(r.ops || []).length) return '「生成格式改写」还没加动作';
        for(const o of r.ops || [])
          if(o && o.op === 'replace' && !String(o.segs || '').trim()) return '「生成格式改写」的替换表还空着（旧=>新，分号隔开）';
      }
      if(r.k === 'dim'){
        if(!(r.dims || []).length) return '「多维定义」还没摆维度';
        for(const d of r.dims || [])
          if(!String(d.d || '').trim() || !String(d.cat || '').trim()) return '「多维定义」有维度还没起名或没选词库分类';
        const tl = (r.table || []).filter(x => String(x || '').includes('='));
        if(!tl.length && !r.expand) return '「多维定义」规则表还空着，没摊组合就推不出东西';
        const dn = String(r.name || '').trim();
        if(!dn) return '「多维定义」还没说推出来的值挂哪个名字';
        if(nm.includes(dn)) return '「多维定义」挂的名字「' + dn + '」和某个变量重了，换个名';
      }
    }
    return null;
  }
  async save(){
    const msg = this.check();
    if(msg){ toast(msg); return; }
    const R = JSON.parse(JSON.stringify(this.R));
    if(!R.icon) R.icon = 'pencil';
    await genLocalPut(R);
    const w = await genWriteFiles(R);
    if(!w.ok){ toast('文件没写进去：' + w.msg); return; }
    if(!w.file){
      /* 写这一格那条通道没接上：这份先存这台机器上，界面里当场登记回来 */
      Gen.def(R);
      toast('这台机器没有写插件那一格的通道 · 这份先存在这台机器上，在 Flow-Desk 程序或开发服务器里再存一次就落到那一格');
      H().dlg.close();
      if(GenWizard.onSaved) GenWizard.onSaved(R);
      await genPendingAsk(genScanRecipe(R, R.name || R.id || '这张配方'));
      return;
    }
    /* 三样都落了盘（main.js + recipe.json + 新建时的说明书）：名单补上这一家，再只重载这一家 */
    const a = await genApply(R.id);
    toast('已存到这一家自己那一格 · ' + a.msg);
    H().dlg.close();
    if(GenWizard.onSaved) GenWizard.onSaved(R);
    await genPendingAsk(genScanRecipe(R, R.name || R.id || '这张配方'));   /* #298：这张配方里要是引用了库里没有的类型，问一句要不要提取 */
  }
}

/* 源码那份就是 default 一份配方对象；加载器 import 本目录的 main.js，拿 default 交给 Gen.def()。
   （往 plugins\<id>\ 文件夹写这份 main.js 连同 manifest.json / recipe.json 那一步，见「组件装卸即时化」。） */
function genSource(R){
  return '/* ES module 配方包：加载器 import 本文件、把 default 这份配方交给 Gen.def() 登记成一个功能。\n'
    + '   改配方走「组件定制」向导（它重写本目录的 main.js 与 recipe.json），或直接改那份 recipe.json；\n'
    + '   手改 main.js 里这一段会在下次保存时被向导覆盖。 */\n'
    + 'export default ' + JSON.stringify(R, null, 2) + ';\n';
}

/* ---------- 装回那一格里没有的配方 ----------
   正常情况下每张配方都落在 plugins\<id>\ 那一格，加载器开机一家家 import；
   这一趟是给「写不了那一格时存进宿主 kv 的那份镜像」兜底的：表里没有它才从 kv 里捞回来。 */
const GenLocal = {
  async warm(){
    const ids = (await H().kv.get('gen-local', [])) || [];
    for(const id of ids){
      if(Gen.get(id)) continue;
      const raw = await H().kv.get('gen-recipe.' + id, null);
      if(!raw) continue;
      try{ Gen.def(JSON.parse(raw)); }catch(e){ console.warn('这张配方装不回来：' + id); }
    }
    return ids.length;
  }
};
