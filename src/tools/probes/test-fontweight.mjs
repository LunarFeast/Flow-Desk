/* 外31 二组自检 · 全局默认字体改霞鹜文楷等宽 + 字重跟着这一家底下真有的那几张脸走
   ----------
   这台盯四件事：
     一 默认那一串：三个底子栈（FD / 为写 / 代码）都从同一个常量起手，漏一个就是「为写不跟着全局改」；
        后面的 Segoe UI、微软雅黑、system-ui 都还在（那台机器没装这张字体不许白屏）；
        「无需嵌入」这条是真的量出来的 —— 仓里不许躺字体文件，样式里不许出现读文件的 @font-face（只认 src:local）。
     二 页面怎么用系统那张字重表（2026-10-08 改口：「你现在就换」——不再从字体名字尾巴猜）：
        absorb 收 { fonts, faces } 那一份（名单去重排序、档数滤掉认不出的、档从小到大排、两处都落盘），
        weightsOf 按名字取这一家底下的档，表里没这一家才退本家那一张标准 400（不许空下拉）。
        表本身是不是真机器上那一份，由 test-fonttable.mjs 开子进程现场量，这一台只管页面这一头。
     三 生效那一路六个登记口：方案文件的 fields / scheme / 那一列名单 / 当前这套存成方案 / 挑方案写回 Theme.cfg，
        少一处就是「界面上选了、存下去就没了」；再加 --fd-weight、--fd-synth 那两句样式表和 body 那一条。
     四 界面上那一行：「全局字重」紧跟在「全局字体」后面、摆的是这一家真有的档、挑标准写空、换字体只重画这一行。
   跑法：node src\tools\probes\test-fontweight.mjs */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, rd, 切, 记账 } from './lib-slice.mjs';

const R = 记账('test-fontweight');
const FSH = rd('src/_shared/sh-font.js');
const LIB = rd('src/_fd/src/fd3-lib.js');
const SHL = rd('src/_fd/src/fd3-shell.js');
const BUI = rd('src/_fd/src/fd4-builtin.js');

const 假页 = { getElementById:() => null, createElement:() => ({ id:'', textContent:'', style:{} }), head:{ appendChild(){} } };
/* State / toast 是真边界：沙箱里没有 IndexedDB，落盘那一步只记谁被写过 */
const 落的 = [];
const 假State = { get:(k, d) => (k === 'font-w' ? 假State._w : d), set:(k, v) => 落的.push([k, v]), _w:null };
/* ---------- 沙箱：字体层整份跑起来（顶上只有常量和函数声明，不碰 DOM） ---------- */
const 沙 = vm.createContext({ Math, JSON, String, Number, Object, Array, RegExp, Set, Map, isNaN, parseInt, parseFloat,
  console, document:假页, State:假State, toast:() => {} });
vm.runInContext(FSH + '\n;this.X = { FF_BASE_FD, FF_BASE_WNW, FF_MONO, FF_DEFAULT_FD, FF_DEFAULT_EN, ffQuote, ffWeightName, ffWeightLabel, ffWeightLanded, Fonts };', 沙);
const X = 沙.X;
/* 主进程那份表的形状（真机器上数出来的那一份由 test-fonttable.mjs 现场量；这里给的是页面要吃的样子，
   故意把档序打乱、再塞两条认不出数的） */
const 本机表 = {
  '霞鹜文楷等宽':[{ w:500, 名:'Medium' }, { w:400, 名:'Regular' }, { w:300, 名:'Light' }],
  'LXGW WenKai Mono':[{ w:400, 名:'Regular' }, { w:300, 名:'Light' }, { w:500, 名:'Medium' }],
  '霞鹜文楷':[{ w:400, 名:'Regular' }, { w:300, 名:'Light' }, { w:500, 名:'Medium' }],
  '霞鹜975朦胧黑体SC':[{ w:300, 名:'300W' }, { w:400, 名:'400W' }, { w:500, 名:'500W' }],
  '霞鹜漫黑':[{ w:400, 名:'Regular' }],
  '微软雅黑':[{ w:700, 名:'Bold' }, { w:290, 名:'Light' }, { w:400, 名:'Regular' }],
  '坏档':[{ w:'abc', 名:'?' }, { w:0, 名:'?' }, { w:400, 名:'Regular' }]
};
const 本机名单 = Object.keys(本机表);
const 喂 = (表, 名单) => X.Fonts.absorb({ fonts:名单 || 本机名单.slice(), faces:表 || 本机表 });
喂();

R.题('一、全局默认那一串字体');
R.判('默认那一个字体家就是「' + X.FF_DEFAULT_FD + '」，英文名 "' + X.FF_DEFAULT_EN + '" 跟着一起写（别的语言版本注册的是英文名）',
  X.FF_DEFAULT_FD === '霞鹜文楷等宽' && X.FF_DEFAULT_EN === 'LXGW WenKai Mono', { 中:X.FF_DEFAULT_FD, 英:X.FF_DEFAULT_EN });
for(const [名, 栈] of [['FF_BASE_FD（Flow-Desk 界面）', X.FF_BASE_FD], ['FF_BASE_WNW（为写那一摊）', X.FF_BASE_WNW], ['FF_MONO（代码编辑器）', X.FF_MONO]])
  R.判(名 + ' 起手就是这一个字体家（三个栈漏一个，就是那一处不跟着全局改）',
    栈.startsWith(X.ffQuote(X.FF_DEFAULT_FD) + ',' + X.ffQuote(X.FF_DEFAULT_EN)), 栈.slice(0, 70));
R.判('兜底那几家还在后面排着（没装这张字体的机器不许白屏）：Segoe UI、Microsoft YaHei、system-ui、sans-serif 一个不少',
  ['Segoe UI', 'Microsoft YaHei', 'system-ui', 'sans-serif'].every(k => X.FF_BASE_FD.includes(k)) &&
    ['Segoe UI', 'system-ui', 'sans-serif'].every(k => X.FF_BASE_WNW.includes(k)) &&
    ['Consolas', 'monospace'].every(k => X.FF_MONO.includes(k)), { FD:X.FF_BASE_FD, WNW:X.FF_BASE_WNW, MONO:X.FF_MONO });
R.判('三个栈都是拿同一个常量起手的，不是各抄一遍字（抄两遍迟早漂移，那是 audit 那台盯的形状）',
  (FSH.match(/ffQuote\(FF_DEFAULT_FD\)/g) || []).length === 3, (FSH.match(/ffQuote\(FF_DEFAULT_FD\)/g) || []).length);
{
  /* 出厂页面自己那份 HTML 模板里也写着 body 的字体栈：样式表后面那一条只是把它盖回来，
     模板不跟着改就是「开机头一瞬屏幕上还是 Segoe UI」+ 同一件事两处各一套字 */
  const 模 = rd('src/_fd/template.html');
  const 串 = (/body\{[\s\S]{0,160}?font-family:([^;]+);/.exec(模) || [])[1] || '';
  R.判('出厂页面那一格（src\\_fd\\template.html 里 body 那一条）起手也是这一个家，兜底那几家照旧排在后面',
    串.startsWith('"' + X.FF_DEFAULT_FD + '","' + X.FF_DEFAULT_EN + '"') &&
      ['Segoe UI', 'Microsoft YaHei', 'system-ui', 'sans-serif'].every(k => 串.includes(k)), 串.slice(0, 96));
}
{
  /* 「无需嵌入」不是句口号，量两样：仓里不许躺字体文件、样式里不许出现读文件的 @font-face */
  const 躺 = [];
  const 走 = d => { for(const e of fs.readdirSync(ROOT + d, { withFileTypes:true })){
      const p = path.join(d, e.name);
      if(e.isDirectory()){ if(e.name !== 'node_modules') 走(p); }
      else if(/\.(ttf|otf|ttc|woff2?|woff)$/i.test(e.name)) 躺.push(p); } };
  走('src'); 走('icons');
  const 面 = [...FSH.matchAll(/@font-face\{[^}]*\}/g)].map(m => m[0]);
  R.判('字体一个字节都不进仓（src\\ 和 icons\\ 里数到 ' + 躺.length + ' 个字体文件）、样式里挂的每一条 @font-face 都只认本机那一个名字（src:local）',
    躺.length === 0 && 面.length > 0 && 面.every(s => /src:local\(/.test(s) && !/src:url\(/.test(s)), { 文件:躺, 条数:面.length });
}

R.题('二、页面怎么用系统那张字重表（沙箱里跑真函数 absorb / weightsOf）');
{
  const 等 = (家, 该) => JSON.stringify(X.Fonts.weightsOf(家).map(x => x.w)) === JSON.stringify(该);
  落的.length = 0; 喂();
  const 存了 = 落的.map(x => String(x[0]));
  R.判('absorb 收的是 { fonts, faces } 那一份：名单去重排序进 sys、字重表进 wmap、两处都落盘（font-sys + font-w，下一次开机不用重扫也有档）',
    X.Fonts.sys.length === 7 && X.Fonts.read === true && 存了.includes('font-sys') && 存了.includes('font-w'),
    { 家:X.Fonts.sys.length, 落的:存了 });
  R.判('「霞鹜文楷等宽」读到三档：细 300、标准 400、中 500（喂进去的表里序是打乱的 → 交回来从小到大）',
    等('霞鹜文楷等宽', [300, 400, 500]), X.Fonts.weightsOf('霞鹜文楷等宽'));
  R.判('那一张脸的档名跟着交回来（界面上那句说明要报得出 300 这一档系统叫「Light」）',
    X.Fonts.weightsOf('霞鹜文楷等宽').find(x => x.w === 300).名 === 'Light', X.Fonts.weightsOf('霞鹜文楷等宽'));
  R.判('系统直接报数的收下，不逼成整数档（微软雅黑那一张 Light 报 290 → 界面上就写 290，档名不编）',
    等('微软雅黑', [290, 400, 700]) && X.ffWeightName(290) === '290', X.Fonts.weightsOf('微软雅黑'));
  R.判('认不出数的档丢掉（w 是 ' + JSON.stringify(本机表['坏档'].map(x => x.w)) + ' 那一条只留下 400，别摆一档看不懂的选择）',
    等('坏档', [400]), X.Fonts.weightsOf('坏档'));
  R.判('一张脸的字体只给「标准」这一档，不编出第二档（「霞鹜漫黑」表里就一条，名字里那个「黑」讲的是字形不是粗细）',
    等('霞鹜漫黑', [400]), X.Fonts.weightsOf('霞鹜漫黑'));
  R.判('串家这条从机制上没了：档是按名字从表里取的，别家的 300 / 500 不会漂到「霞鹜漫黑」头上',
    等('霞鹜漫黑', [400]) && 等('霞鹜文楷', [300, 400, 500]) &&
      X.Fonts.weightsOf('霞鹜漫黑').every(x => x.名 === 'Regular'), { 漫黑:X.Fonts.weightsOf('霞鹜漫黑'), 文楷:X.Fonts.weightsOf('霞鹜文楷') });
  R.判('表里没有这一家（附加文件夹里挂上来的、手输的名字）：退本家那一张标准 400，不许摆一个空选择',
    (() => { const a = X.Fonts.weightsOf('随便手输的一家');
      return JSON.stringify(a.map(x => x.w)) === JSON.stringify([400]) && a[0].名 === 'Regular'; })(), X.Fonts.weightsOf('随便手输的一家'));
  R.判('空名字什么都不是：交回空数组（界面上那一行拿的是 nowFamily，永远有一个家，这一条只管函数本身不许拿空串去表里撞出一条档）',
    X.Fonts.weightsOf('').length === 0 && X.Fonts.weightsOf(undefined).length === 0, '');
  R.判('没钉字体时认的是默认那一个家（Fonts.nowFamily 交回 FF_DEFAULT_FD，不是空串 —— 空串界面上就没档可摆）',
    X.Fonts.nowFamily({}) === X.FF_DEFAULT_FD && X.Fonts.nowFamily({ font:'微软雅黑' }) === '微软雅黑',
    { 空:X.Fonts.nowFamily({}), 钉:X.Fonts.nowFamily({ font:'微软雅黑' }) });
  R.判('中文档名有对照表（300 细、400 标准、500 中、700 粗），表外的数原样报出来不给假名字',
    X.ffWeightName(300) === '细' && X.ffWeightName(400) === '标准' && X.ffWeightName(500) === '中' &&
      X.ffWeightName(700) === '粗' && X.ffWeightName(450) === '450', [100, 300, 400, 450, 500, 700, 900].map(X.ffWeightName));
  R.判('表外那一档摆到人前不写成「290 · 290」那句废话：认不出中文名的用系统给那张脸起的档名（微软雅黑那一张报的是 290，系统叫它 Light）',
    X.ffWeightLabel({ w:290, 名:'Light' }) === 'Light' && X.ffWeightLabel({ w:300, 名:'Light' }) === '细'
      && X.ffWeightLabel({ w:350, 名:'Semilight' }) === 'Semilight' && X.ffWeightLabel({ w:600 }) === '半粗',
    [X.ffWeightLabel({ w:290, 名:'Light' }), X.ffWeightLabel({ w:350, 名:'Semilight' })]);
  /* 钉的那一档在新的一家底下没有真脸时，屏幕上落到哪一档 —— 认的是 CSS 自己那一条挑脸的顺序 */
  const 落 = (要, 档) => X.ffWeightLanded(要, 档.map(w => ({ w })));
  R.判('钉 500 换到只有 300 / 400 的一家：落到 400（粗的那头没有比 500 更近的了，回落到更细的那一张）',
    落(500, [300, 400]) === 400 && 落(700, [300, 400, 500]) === 500, [落(500, [300, 400]), 落(700, [300, 400, 500])]);
  R.判('要的那一档比 400 细：先往更细里找最靠近的（钉 300 只有 200 和 400 → 落 200，不是 400）',
    落(300, [200, 400]) === 200 && 落(100, [300, 400]) === 300, [落(300, [200, 400]), 落(100, [300, 400])]);
  R.判('钉 400 换到只有一张 500 的一家：落 500（CSS 那一档先看 500，再往更细看）；一档也没读到时原样交回，不编一个数',
    落(400, [500, 600]) === 500 && 落(500, []) === 500 && 落('', [300, 400]) === 0, [落(400, [500, 600]), 落(500, []), 落('', [300, 400])]);
  R.判('钉的正是这一家真有的那一档 → 落回同一个数（这种时候界面上不多嘴说一句）',
    落(300, [300, 400]) === 300 && 落(400, [300, 400]) === 400, [落(300, [300, 400]), 落(400, [300, 400])]);
}

R.题('三、方案文件里那一栏「字重」（六个登记口一个都不许漏）');
{
  const 沙2 = vm.createContext({ Math, JSON, String, Number, Array, Object, RegExp, isNaN, parseInt, parseFloat, ffWeightName:X.ffWeightName });
  vm.runInContext(切(LIB, 'lookWeight') + ';this.f = lookWeight;', 沙2);
  const lw = 沙2.f;
  R.判('文件里认两种写法：那一个数（300 / 500 / 700）和界面上那几个中文字（细 / 中 / 粗）—— 这份文件他拿记事本直接改',
    lw('500') === '500' && lw('300') === '300' && lw('中') === '500' && lw('细') === '300' && lw('粗') === '700', [lw('500'), lw('中')]);
  R.判('认不出的一律当没写（跟默认那档走），不硬猜也不报错：空、0、二百五、四位数字、瞎写的词都交回空串',
    ['', '0', '250', '1000', '随便写的', undefined, null].map(lw).every(v => v === ''), ['', '0', 250, 1000, '随便写的'].map(lw));
  const 登 = [
    ['fields（写出去那一步）', /字体:s\.字体 \|\| '', 字重:s\.字重 \? String\(s\.字重\) : ''/],
    ['scheme（读回来那一步）', /字体:n\('字体'\), 字重:lookWeight\(f\.字重\)/],
    ['那一列名单（emit 排的栏序，漏了这一栏直接不写进文件）', /'字体', '字重', '卡片圆角'/],
    ['当前这套存成方案', /字体:c\.font \|\| '', 字重:c\.weight \|\| ''/],
    ['挑中一条方案写回 Theme.cfg', /c\.font = s\.字体; c\.weight = s\.字重 \|\| '';/],
    ['头顶那份说明里写了这一栏怎么填', /'#     字重：100~900 里的一档/] ];
  const 缺 = 登.filter(x => !x[1].test(LIB)).map(x => x[0]);
  R.判('六个登记口全在（少一处就是界面上选了、存下去就没了，或者文件里改了读不回来）：' + 登.map(x => x[0]).join('、'),
    缺.length === 0, 缺);
}
R.判('Theme 的默认值里有 weight 这一格（不写就是 undefined，界面上那一行认不到当前档）',
  /radiusCard:5, radiusCtl:5, gap:0, font:'', weight:'', scheme:'a'/.test(SHL), '');
R.判('生效那一步：钉过就写 --fd-weight，没钉过就把这一句摘掉（不许留上一套方案那个数）',
  /if\(this\.cfg\.weight\) document\.documentElement\.style\.setProperty\('--fd-weight', this\.cfg\.weight\);\s*\n\s*else document\.documentElement\.style\.removeProperty\('--fd-weight'\)/.test(SHL), '');
R.判('样式表里 body 那一条吃这两个变量：font-weight 兜底 400、假粗那一档兜底 auto',
  /body\{font-family:var\(--fd-font,\$\{FF_BASE_FD\}\);font-weight:var\(--fd-weight,400\);font-synthesis-weight:var\(--fd-synth,auto\);\}/.test(SHL), '');
R.判('--fd-synth 的方向对：这一家底下读到不止一张真脸才关假粗（none），只有一张的留着（auto）—— 写反了就是拿假粗盖掉真脸',
  /setProperty\('--fd-synth',\s*\n?\s*Fonts\.weightsOf\(Fonts\.nowFamily\(this\.cfg\)\)\.length > 1 \? 'none' : 'auto'\)/.test(SHL), '');
R.判('粗细的出口只有这一条：卡片那一头只写 font-family，不另写一份 font-weight（第二套粗细出口迟早和这一栏打架）',
  /card\.style\.fontFamily = ffStack\(ff, FF_BASE_FD\)/.test(SHL) && !/card\.style\.fontWeight/.test(SHL), '');

R.题('四、界面上那一行「全局字重」');
{
  const 块 = /const wWrap[\s\S]*?dScheme\.appendChild\(row\('全局字重', wWrap\)\);\s*\n\s*wDraw\(\);/.exec(BUI);
  R.判('那一行造出来了、也摆进了方案那一组（row 里没摆进 dScheme 就是代码在、屏幕上没有）', !!块, 块 && 块[0].slice(0, 80));
  R.判('摆的就是这一家真读到的那几档（不再兜一个假档：表里没有这一家时靠的是 weightsOf 退那一张标准 400，界面上不加第二层兜底）',
    !!块 && /Fonts\.weightsOf\(家\)/.test(块[0]) && /for\(const x of 档\)/.test(块[0]) && !/档\.length \? 档 :/.test(块[0]),
    块 && 块[0].slice(0, 160));
  R.判('挑「标准」写的是空（和默认同一个数，文件里不多留一行），挑别的写那一个数',
    !!块 && /set\('字重', x\.w === 400 \? '' : String\(x\.w\)\)/.test(块[0]), '');
  R.判('字体那一行的 onSet 里带着重画这一行（换了家就该换一批档），但不整页重画 —— 整页重画会把旁边展开的「选字体」那一摊顶掉',
    /onSet:f => \{ set\('字体', f\); wDraw\(\); \}/.test(BUI) && !/onSet:f => \{ set\('字体', f\); drawDetail\(\)/.test(BUI), '');
  R.判('那一句说明分得清读没读到（表里没这一家就明说「本地字体表里没读到这一家…先按标准 400 这一档走」，不许装着读到了）',
    !!块 && /const 读到了 = !!Fonts\.wmap\[家\];/.test(块[0]) && /系统报的这一家底下的脸/.test(块[0]) &&
      /本地字体表里没读到/.test(块[0]), 块 && (/fd-hint[\s\S]{0,220}/.exec(块[0]) || [''])[0].replace(/\s+/g, ' ').slice(0, 150));
  R.判('那颗按钮上写的是人话：报到哪一档、系统给这张脸起的档名叫什么、读的是哪一家；从前那两句口径（「本机清单里那一张脸叫」「挑不挑得到看浏览器认不认」）不许留着——那是名字猜测那一版的说法',
    !!块 && /font-weight ' \+ x\.w/.test(块[0]) && /系统报的这张脸叫/.test(块[0]) && /这一家底下的字体表/.test(块[0]) &&
      !/本机清单里那一张脸叫/.test(块[0]) && !/挑不挑得到看浏览器/.test(块[0]) && !/屏幕上用的就是本地那个字体族/.test(块[0]),
    块 && (/title:[\s\S]{0,200}/.exec(块[0]) || [''])[0].replace(/\s+/g, ' ').slice(0, 150));
  R.判('钉的那一档在新的一家底下没有真脸时补一句（说清屏幕上落到哪一档），而且这一句只说不改文件（不动 set / draft）',
    !!块 && /ffWeightLanded\(\+现, 档\)/.test(块[0]) && /方案里钉的是 /.test(块[0]) && /屏幕上按 /.test(块[0]) &&
      /if\(现 && 落 !== \+现\)/.test(块[0]) && !/if\(现 && 落 !== \+现\)[\s\S]{0,220}?set\('字重'/.test(块[0]),
    块 && 块[0].slice(-320));
}

R.题('五、咬口（确认上面那些判法真咬得住）');
{
  const 改 = FSH.replace("const FF_BASE_WNW = ffQuote(FF_DEFAULT_FD) + ',' + ffQuote(FF_DEFAULT_EN) +", 'const FF_BASE_WNW =');
  R.判('咬口一：只把为写那一个栈的默认字体删掉 → 「三个栈起手都是这一个家」当场失效（这种改法界面上看不出来，为写那一摊自己跟着系统跑）',
    改 !== FSH && !改.includes("const FF_BASE_WNW = ffQuote(FF_DEFAULT_FD)"), '');
}
{
  const 沙3 = vm.createContext({ Math, JSON, String, Number, Array, Object, RegExp, isNaN, parseInt, parseFloat, console, document:假页,
    State:{ get:(k, d) => d, set(){} }, toast:() => {} });
  vm.runInContext(FSH.replace('const 档 = this.wmap[本家名];', 'const 档 = null;   /* 咬口：这一家底下读到的档不看表了 */') +
    '\n;this.X={Fonts};', 沙3);
  沙3.X.Fonts.wmap = 本机表; 沙3.X.Fonts.sys = 本机名单.slice();
  R.判('咬口二：把「按名字去表里取这一家的档」那一句拿掉 → 三档那条判法当场失效（界面上只剩「标准」一档，还是能选，没人会发现读到的档没了）',
    JSON.stringify(沙3.X.Fonts.weightsOf('霞鹜文楷等宽').map(x => x.w)) !== JSON.stringify([300, 400, 500]),
    沙3.X.Fonts.weightsOf('霞鹜文楷等宽'));
}
{
  const 改 = SHL.replace("else document.documentElement.style.removeProperty('--fd-weight');", '');
  R.判('咬口三：把「没钉就摘掉那一句」删了 → 登记判法当场失效（换到一套没钉字重的方案，屏幕上还留着上一套那个数）',
    改 !== SHL && !/removeProperty\('--fd-weight'\)/.test(改), '');
}
{
  const 改 = LIB.replace("'字体', '字重', '卡片圆角'", "'字体', '卡片圆角'");
  R.判('咬口四：把那一列名单里的「字重」摘掉 → 六个登记口那条当场失效（写文件时这一栏整列被丢掉，读回来永远是空）',
    改 !== LIB && !/'字体', '字重',/.test(改), '');
}
{
  const 改 = BUI.replace(/dScheme\.appendChild\(row\('全局字重', wWrap\)\);/, '');
  R.判('咬口五：把那一行从方案那一组里摘掉 → 「造出来了也摆上去了」那条当场失效（函数在、wDraw 在，屏幕上就是没有这一行）',
    改 !== BUI && !/row\('全局字重', wWrap\)/.test(改), '');
}
{
  const 改 = BUI.replace(/if\(现 && 落 !== \+现\) wWrap\.appendChild\(h\('div', \{ class:'fd-hint' \},[\s\S]{0,240}?\)\);/, '');
  R.判('咬口六：把「钉的那一档这一家没有」那一句说明摘掉 → 补一句那条判法当场失效（屏幕上按 400 走、文件里写着 500，那一行一个按钮都不亮，看着像控件坏了）',
    改 !== BUI && !/方案里钉的是 /.test(改), '');
}
{
  const 改 = FSH.replace('function ffWeightLanded(要, 档){', 'function ffWeightLanded(要, 档){ if(1) return Math.round(+要 || 0);');
  R.判('咬口七：把落到哪一档那一步改成「原样交回钉的那一个数」 → 「钉 500 换到只到 400 的一家」那条当场失效（说明会写成「屏幕上按 500 走」，而屏幕上其实是 400）',
    (() => { const 沙4 = vm.createContext({ Math, JSON, String, Number, Array, Object, RegExp, isNaN, parseInt, parseFloat, console, document:假页 });
      vm.runInContext(改 + '\n;this.L=ffWeightLanded;', 沙4);
      return 沙4.L(500, [{ w:300 }, { w:400 }]) === 500; })(), '');
}
{
  const 模 = rd('src/_fd/template.html').replace('"霞鹜文楷等宽","LXGW WenKai Mono",', '');
  const 串 = (/body\{[\s\S]{0,160}?font-family:([^;]+);/.exec(模) || [])[1] || '';
  R.判('咬口八：把出厂页面那一格起手的这两个名字摘掉 → 「模板也起手这一个家」当场失效（样式表后面那一条照样盖得回来，屏幕上看着没事，开机头一瞬、以及样式表那条没跑到的那一头还是旧栈）',
    !串.startsWith('"' + X.FF_DEFAULT_FD + '"'), 串.slice(0, 60));
}
{
  const 改 = BUI.replace('const 读到了 = !!Fonts.wmap[家];', 'const 读到了 = true;');
  R.判('咬口九：把「读没读到这一家」那一句改成永远算读到了 → 分得清读没读到那条当场失效（附加文件夹里挂上来的、手输的名字，界面上会张口就说「系统报的这一家底下的脸：标准 400」，那是本家那一张脸，不是读回来的）',
    改 !== BUI && !/!!Fonts\.wmap\[家\]/.test(改), '');
}
{
  const 沙5 = vm.createContext({ Math, JSON, String, Number, Array, Object, RegExp, isNaN, parseInt, parseFloat, console, document:假页,
    State:{ get:(k, d) => d, set(){} }, toast:() => {} });
  vm.runInContext(FSH.replace("State.set('font-w', 表);", '/* 咬口：字重表不落盘 */') + '\n;this.X={Fonts};', 沙5);
  落的.length = 0;
  沙5.X.Fonts.absorb({ fonts:['甲'], faces:{ 甲:[{ w:400, 名:'Regular' }] } });
  R.判('咬口十：把字重表那一句落盘摘掉 → 「两处都落盘」那条当场失效（下一次开机只有名字没有档，全局字重那一行退成一档，看着像系统读不到字重）',
    !沙5.X.Fonts.absorb.toString().includes("State.set('font-w'"), 落的.slice());
  落的.length = 0; 喂();
}
R.数('默认字体家', X.FF_DEFAULT_FD + ' / ' + X.FF_DEFAULT_EN);
R.数('这一家底下的档', X.Fonts.weightsOf(X.FF_DEFAULT_FD).map(x => x.w + ' ' + X.ffWeightName(x.w) + '（' + x.名 + '）').join('、'));
R.数('钉 500 换到「微软雅黑」（它有 290 / 400 / 700）落到', X.ffWeightLanded(500, X.Fonts.weightsOf('微软雅黑')) + ' ' + X.ffWeightName(X.ffWeightLanded(500, X.Fonts.weightsOf('微软雅黑'))));
R.收尾();
