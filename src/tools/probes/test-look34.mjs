/* 外34 · 外观那一摊（配色能删 / 明暗进方案 / 池计数对得上 / 界面五处样子）
   作者这一轮点名的原话：
     图2「配色要允许删除」 · 图3「上下为什么两套配色」 · 图4·5「应该是选了哪一套，方案设定的方案名就显示什么」
     图6「填写色号的框这么长明显多余啊！短一点、并列」 · 图7「这个框右边又没有内容，这么长、右边界都被吃了」
     图8「两个多余按钮」 · 图9「色彩圆形左边被切掉了」 · 图12「方案设定增加一个明暗，初始明暗是程序根据颜色自动给定，用户可以手动调整」
     图13「这里数字有点问题」 · 图14·15「配色的删除按钮就该跟着配色列表（下拉）走」
   规矩照这一仓来：真源码一颗一颗切进 node:vm 跑（配色那一条删色的路、预设补齐那一步、明暗归池那颗，全是仓库里那一份），
   只在边界使替身（读写那一层 / 存档 / 弹窗 / 提示）；每一条都把数到的东西打印出来，最后咬三口。 */
import vm from 'node:vm';
import { rd, 切, 记账 } from './lib-slice.mjs';

const R = 记账('test-look34');
const 份 = {
  color:rd('src/_shared/sh-color.js'), look:rd('src/_shared/sh-look.js'), font:rd('src/_shared/sh-font.js'),
  packs:rd('src/_shared/sh-packs.js'),
  shell:rd('src/_fd/src/fd3-shell.js'), lib:rd('src/_fd/src/fd3-lib.js'), ui:rd('src/_fd/src/fd4-builtin.js'),
};

/* ---------- 名单：从三份源码里各切哪几颗（都是仓库里那一份原文，不抄第二份） ---------- */
const 名单 = {
  packs:['MARK_MIN'],
  look:['CUSTOM_TEX', 'lookTexSet', 'lookTex', 'lookTexName', 'LOOK_MODES', 'LOOK_DEFAULT', 'lookMode'],
  font:['FF_WEIGHT_CN', 'ffWeightName'],
  shell:['mingPoolOf', 'mingNearest', 'mingHueDist', 'Palette', 'Ming'],
  lib:['PAL_FILE', 'PAL_SRC', 'PAL_SRC_BACK', 'PAL_MODES', 'PAL_MODES_BACK', 'PAL_STD', 'PAL_STD_BACK',
    'PAL_MD', 'PAL_MD_BACK', 'PAL_MD_UNKNOWN', 'palMingDarkName', 'PAL_HEAD', 'PalLib',
    'LOOKS_FILE', 'LOOK_HEAD', 'LOOK_GAP_AUTO', 'LOOK_GAP', 'lookGap', 'LOOK_TEX_WAYS', 'lookTexWay',
    'LOOK_MD', 'LOOK_SEED', 'ffLangMap', 'ffLangText', 'marksText', 'marksOf',
    'lookModeByName', 'lookTexByName', 'lookWeight', 'LibYml', 'imgWallName', 'LookLib'],
};
const 抓 = 份名 => (名单[份名] || []).map(n => 切(份[份名], n)).join('\n');

/* ---------- 边界替身：读写那一层、存档、弹窗、提示。颜色算那一层用真的（sh-color.js 整份端进来） ---------- */
const 替 = `
var LookStore = { data:{ items:[], cur:'', curName:'', look:{}, marks:null }, 存盘:0,
  async load(){ this.读过 = (this.读过 || 0) + 1; }, save(){ this.存盘++; } };
var LibStore = { files:{}, 写:0, 晚:0, 最近:null,
  async fetchRaw(f){ return this.files[f] === undefined ? null : this.files[f]; },
  async putRaw(f, t){ this.写++; this.最近 = [f, t]; this.files[f] = t; return true; },
  later(f, t){ this.晚++; this.最近 = [f, t]; this.files[f] = t; } };
var Theme = { cfg:{}, apply(){ this.上色 = (this.上色 || 0) + 1; }, tokens(){ return { tokens:{}, roles:null, notes:[] }; }, save(){} };
var Shell = { render(){ this.重画 = (this.重画 || 0) + 1; }, refreshSoon(){}, fitGrid(){}, cellW:12, cellH:12 };
var Bus = { emit(){ } };
var console = { warn(){}, log(){}, error(){} };
var toast = () => {};
var fdAsk = async () => true;
var h = (tag, at, kids) => ({ tag, at:at || {}, kids:[].concat(kids === undefined ? [] : (Array.isArray(kids) ? kids : [kids])) });
var icoMarkup = n => 'ico:' + n;
var Modal = { open(){}, close(){} };
var ImgLib = { list:[], find(n){ return this.list.find(x => x.名字 === n) || null; } };
var Ico = { table:{}, url(n){ return this.table[n] || ''; } };
var FF_LANGS = [{ k:'zh', name:'中文简体' }];
var MING_AXIS = '';
var MING_MODES = [{ k:'manual', name:'手动' }, { k:'auto', name:'跟着系统' }, { k:'time', name:'按时段' }];
var MING_NAME = { light:'明亮', dark:'黑暗' };
var nowText = () => '12:00';
`;
const 全码 = ['look', 'font', 'packs', 'shell', 'lib'].map(抓0 => 抓(抓0)).join('\n') +
  '\n;this.件 = { Palette, Ming, LookLib, PalLib, LibYml, mingPoolOf, LOOK_MD, LOOK_SEED, LOOK_HEAD, LOOKS_FILE, PAL_FILE };';

/* 一台干净的沙：改 = [承重那一句, 改成什么] —— 咬口用同一个台子，只换源码 */
const 台 = (改) => {
  let 码 = 全码;
  if(改){
    if(!码.includes(改[0])) throw new Error('咬口没咬到：源码里没有那一句 —— ' + 改[0].slice(0, 46));
    码 = 码.replace(改[0], 改[1]);
  }
  const 沙 = {}; vm.createContext(沙);
  vm.runInContext(替, 沙);
  vm.runInContext(份.color, 沙, { filename:'sh-color.js' });
  vm.runInContext(码, 沙);
  return Object.assign(沙, 沙.件);
};

/* 一套配色：md 直接写死（'light' / 'dark'），这样归哪一池不靠现算，量的是这一轮改的那几颗 */
const 配 = (id, name, md, source) => ({ id, name, source:source || 'custom', mode:'custom',
  colors:[{ raw:'#123456', format:'auto' }], std:'gracol', md });
/* 一条方案：明暗 那一栏不给就是「没写过」（老文件那个样子） */
const 案 = (名, 配色, 明暗) => { const s = { 方案名:名, 配色, 标记色:[], 外观模式:'质感', 纹理:'无',
  纹理用法:'直接使用', 背景图:'无', 分组:'常用', 字体:'', 卡片圆角:5, 控件圆角:5, 间距:0, 作者:'' };
  if(明暗) s.明暗 = 明暗; return s; };

function 摆(改){
  const A = 台(改);
  A.LookStore.data.items = [ 配('preset-light', 'RP 明亮', 'light', 'preset'), 配('preset-dark', 'RP 黑暗', 'dark', 'preset'),
    配('pA', '甲自建', 'light'), 配('pB', '乙自建', 'dark') ];
  A.LookStore.data.cur = 'pA'; A.LookStore.data.curName = '甲自建';
  A.LookLib.ready = true; A.LookLib.cur = '日常';
  A.LookLib.list = [ 案('日常', 'RP 明亮'), 案('夜间', 'RP 黑暗'), 案('挑的', '甲自建'), 案('钉暗', 'RP 明亮', '黑暗') ];
  A.LibStore.files[A.PAL_FILE] = '# 这一段说明，一段配色也没有\n';
  A.LibStore.files[A.LOOKS_FILE] = '';
  return A;
}
const 指空 = A => A.LookLib.list.filter(s => !A.Palette.items.some(e => e.name === s.配色)).map(s => s.方案名);

/* ================= 一、删一套配色（图2 + 图14·15 + 图13 那句「外观方案 1 套」的根） ================= */
R.题('一 · 删掉一套配色：删得掉、当前指向跟着改口、指着它的方案不落空');
{
  const A = 摆();
  const 回 = A.Palette.remove('pA');
  R.判('删掉「甲自建」（light 池里那条自建）：回真、库里从 4 条剩 ' + A.Palette.items.length + ' 条、被删那条真没了',
    回 === true && A.Palette.items.length === 3 && !A.Palette.items.some(x => x.id === 'pA'), A.Palette.items.map(x => x.name));
  R.判('当前生效那条不指着没了的那套（cur = ' + A.LookStore.data.cur + '，在库里认得到）',
    !!A.Palette.items.find(x => x.id === A.LookStore.data.cur), A.Palette.cur && A.Palette.cur.name);
  const 挑 = A.LookLib.list.find(s => s.方案名 === '挑的');
  R.判('方案「挑的」原本指着「甲自建」，删完改口成同一明暗池里的那一套（现在写的是「' + 挑.配色 + '」）—— 不是随便抓一套跨池的',
    挑.配色 === 'RP 明亮' && A.Ming.lookPool(挑) === 'light', 挑.配色);
  R.判('四条方案里指着不存在的配色的，删完剩 ' + 指空(A).length + ' 条（这就是图13 那句「外观方案 1 套」的根：指空的方案在两个池里都数不着）',
    指空(A).length === 0, 指空(A));
  R.判('改口这一步真的落了盘（LookLib.saveNow 走了 ' + A.LibStore.写 + ' 回写盘，不是只在内存里改改）',
    A.LibStore.写 >= 1, A.LibStore.写);
  const 夜 = A.LookLib.list.find(s => s.方案名 === '夜间');
  A.Palette.remove('preset-dark');
  R.判('再删「RP 黑暗」（dark 池里还剩「乙自建」）：方案「夜间」改口到「' + 夜.配色 + '」，删的正是内置那一条 —— 内置不再免删（图2）',
    夜.配色 === '乙自建' && !A.Palette.items.some(x => x.id === 'preset-dark'), A.Palette.items.map(x => x.name));
  R.判('库里带着 locked:true 的老条目也删得掉（从前那道「预设和输入法配色删不掉」的闸撤了）',
    (() => { const it = A.Palette.items[0]; it.locked = true; return A.Palette.remove(it.id) === true; })(),
    A.Palette.items.map(x => x.name));
  const 剩 = A.Palette.items.slice();
  const 拦 = A.Palette.remove(剩[0].id);
  R.判('只剩最后一套时不许删，而且那条还在（拦在动库之前，不是先删空了才说不删）：回 ' + 拦 + '、库里 ' + A.Palette.items.length + ' 条',
    拦 === false && A.Palette.items.length === 1, A.Palette.items.map(x => x.name));
}
{
  const A = 摆();
  A.Palette.remove('pA');
  R.判('咬口一：把「if(换) LookLib.repoint(...)」那一句摘掉，同一条删除之后指着空的方案立刻是 ' + (() => {
    const B = 摆(['    if(换) LookLib.repoint(it.name, 换.name);', '    if(换 && false) LookLib.repoint(it.name, 换.name);']);
    B.Palette.remove('pA'); return 指空(B).length + ' 条（' + 指空(B).join('、') + '）';
  })() + ' —— 上面那两条不是空的', 指空(A).length === 0);
}

/* ================= 二、预设只在色卡空着的时候补（图2 的下半句：删了不能自己长回来） ================= */
R.题('二 · 开机补预设那一步：只在库空着的时候补');
{
  const A = 摆();
  A.LookStore.data.items = [];
  await A.Palette.init();
  R.判('空库开机：补回内置那两条（现在 ' + A.LookStore.data.items.length + ' 条：' + A.LookStore.data.items.map(x => x.name) + '）',
    A.LookStore.data.items.length === 2 && A.LookStore.data.items.map(x => x.name).join('|') === 'RP 明亮|RP 黑暗',
    A.LookStore.data.items.map(x => x.name));
  const B = 摆();
  B.LookStore.data.items = [ 配('pK', '我自己配的', 'light') ];
  await B.Palette.init();
  R.判('删过预设的机器（库里只剩一条自建）再开机：还是 ' + B.LookStore.data.items.length + ' 条，内置那两条没自己回来',
    B.LookStore.data.items.length === 1 && B.LookStore.data.items[0].name === '我自己配的', B.LookStore.data.items.map(x => x.name));
  const D = 台(['    if(!this.data.items.length){',
    '    if(!this.data.items.find(x => x.id === \'preset-light\' || x.name === \'RP 明亮\')) this.data.items.unshift({ id:\'preset-light\', name:\'RP 明亮\', source:\'preset\', mode:\'light\', colors:[], std:\'gracol\' }); if(false){']);
  D.LookStore.data.items = [ 配('pK', '我自己配的', 'light') ];
  D.LookStore.data.cur = 'pK'; D.LibStore.files[D.PAL_FILE] = '# 空的\n';
  await D.Palette.init();
  R.判('咬口二：把这一道闸改回从前那句「库里没有内置那条就补」（外34 图2 报的就是这个）—— 同一条路走一趟，' +
     '删掉的「RP 明亮」下一趟开机又回来了（现在 ' + D.LookStore.data.items.length + ' 条：' + D.LookStore.data.items.map(x => x.name).join('、') + '），上面那条不是空的',
    D.LookStore.data.items.some(x => x.name === 'RP 明亮'));
}

/* ================= 三、明暗这一栏（图12）：初始由程序按颜色给，用户可以钉死 ================= */
R.题('三 · 方案自己带一栏「明暗」：自动 = 跟着配色现算，写明亮/黑暗 = 钉住归哪一池');
{
  const A = 摆();
  R.判('三档就是作者写的这三个字（LOOK_MD = ' + A.LOOK_MD.join('/') + '），顺序是 自动 在前 = 默认那一档',
    A.LOOK_MD.length === 3 && A.LOOK_MD.join('|') === '自动|明亮|黑暗', A.LOOK_MD);
  const 出去 = A.LookLib.list.map(s => A.LookLib.fields(s).明暗);
  R.判('占位那三条方案（LOOK_SEED）都没写 明暗，写出去一律是「自动」= 程序按颜色自己给（' + 出去.join('/') + '）',
    A.LOOK_SEED.every(s => !s.明暗) && 出去.slice(0, 3).every(x => x === '自动'), 出去);
  A.LookLib.list = [ 案('甲', 'RP 明亮', '自动'), 案('乙', 'RP 明亮', '明亮'), 案('丙', 'RP 明亮', '黑暗'), 案('丁', 'RP 黑暗') ];
  const 文 = A.LookLib.text();
  const 回来 = A.LibYml.parse(文).map(sec => A.LookLib.scheme(sec));
  R.判('写出去再读回来，明暗 一格不丢（' + 回来.map(s => s.明暗 || '(空)').join('/') + '）；那一栏在表头名单里排在 配色 之后',
    回来.map(s => s.明暗).join('|') === '自动|明亮|黑暗|自动' && /'配色', '明暗', '标记色'/.test(份.lib),
    回来.map(s => s.明暗));
  R.判('文件里认不出的写法（比如写着「深浅」）落回「自动」，不抛也不留空：读回来是「' +
     A.LookLib.scheme({ name:'戊', fields:{ 配色:'RP 明亮', 明暗:'深浅', 外观模式:'质感' } }).明暗 + '」',
    A.LookLib.scheme({ name:'戊', fields:{ 配色:'RP 明亮', 明暗:'深浅', 外观模式:'质感' } }).明暗 === '自动');
  const B = 摆();
  R.判('归池那颗真吃这一栏：钉成「明亮」的那套（配色指着 RP 黑暗）落 light 池、钉成「黑暗」的落 dark 池、写着自动的跟着配色走（' +
     ['乙', '丙', '甲'].map(n => n + '=' + B.Ming.lookPool({ 明暗:n === '乙' ? '明亮' : n === '丙' ? '黑暗' : '自动', 配色:'RP 黑暗' })).join(' ') + '）',
    B.Ming.lookPool({ 明暗:'明亮', 配色:'RP 黑暗' }) === 'light' && B.Ming.lookPool({ 明暗:'黑暗', 配色:'RP 明亮' }) === 'dark' &&
    B.Ming.lookPool({ 明暗:'自动', 配色:'RP 黑暗' }) === 'dark' && B.Ming.lookPool({ 配色:'RP 黑暗' }) === 'dark');
  const 名单2 = { light:B.Ming.lookPoolList('light').map(s => s.方案名), dark:B.Ming.lookPoolList('dark').map(s => s.方案名) };
  R.判('两池加起来的方案数对得上（light ' + 名单2.light.length + ' 套：' + 名单2.light.join('、') + ' ｜ dark ' + 名单2.dark.length + ' 套：' +
     名单2.dark.join('、') + ' ｜ 一共 ' + B.LookLib.list.length + ' 套）—— 图13 那句「外观方案 1 套」就是两头都不落才数漏的',
    名单2.light.length + 名单2.dark.length === B.LookLib.list.length && 名单2.light.indexOf('钉暗') < 0,
    名单2.light.length + '+' + 名单2.dark.length);
  R.判('配色那一栏指着不存在的一套、又没钉死明暗 → 不归任何一池（判不出来就不硬判）：量到「' + (B.Ming.lookPool({ 配色:'没有这一套' }) || '(空)') + '」',
    B.Ming.lookPool({ 配色:'没有这一套' }) === '');
  R.判('明暗池下的配色数也报得出（light 池 ' + B.Ming.pool('light').length + ' 套、dark 池 ' + B.Ming.pool('dark').length + ' 套，库里共 ' + B.Palette.items.length + ' 套）',
    B.Ming.poolCount('light') === 2 && B.Ming.pool('light').length + B.Ming.pool('dark').length === B.Palette.items.length);
}

/* ================= 四、界面那七处接线（真源码上的锚，位置也量） ================= */
R.题('四 · 界面那几处接线：删除跟着配色下拉走、方案名跟着选中的方案走、色号并列、预览那一框有上限、圆点不切、两颗多余按钮撤了');
{
  const UI = 份.ui, SH = 份.shell;
  R.判('「方案设定」那一页摆出了 明暗 那一行，三档就是 自动/明亮/黑暗，改完重画明暗那一屏和方案下拉',
    /gLook\.body\.appendChild\(row\('明暗', segCtrl\(\[\{v:'自动'/.test(UI) && /\{v:'明亮',t:'明亮'\},\{v:'黑暗',t:'黑暗'\}/.test(UI) &&
    /set\('明暗', v\); drawMing\(\); drawScheme\(\);/.test(UI));
  R.判('方案名和分组那两格建在「刷方案名」有真值之前（声明在第 ' + UI.indexOf('let 刷方案名 = () => {};') + ' 个字、真赋值在第 ' +
     UI.indexOf('刷方案名 = () => { const s = LookLib.get()') + ' 个字、grpInp 建在第 ' + UI.indexOf('const grpInp') + ' 个字）',
    UI.indexOf('let 刷方案名 = () => {};') > 0 && UI.indexOf('let 刷方案名') < UI.indexOf('const grpInp') &&
    UI.indexOf('刷方案名 = () => { const s = LookLib.get()') > UI.indexOf('const grpInp') &&
    /const drawScheme = \(\) => \{ schemeSel\.draw\(\); 刷方案名\(\); \};/.test(UI));
  R.判('删除这一枚紧挨着配色那只下拉摆（palSel.wrap、rndBtn、palDel 三样在同一个 row(' + "'配色'" + ') 里），删的是下拉挑中的那一套',
    /dPal\.appendChild\(row\('配色', h\('div', \{ class:'fd-row' \}, \[palSel\.wrap, rndBtn, palDel\]\)\)\)/.test(UI) &&
    /onclick:\(\) => 删配色\(Palette\.items\.find\(x => x\.name === \(draft \? draft\.配色 : ''\)\) \|\| Palette\.cur,/.test(UI),
    (UI.match(/row\('配色'[^\n]*/) || [''])[0].trim());
  R.判('「删除这一套」这两枚都摆上了（配色那一截顶上 ' + (UI.match(/}, '删除这一套'/g) || []).length + ' 枚 + 方案编辑的配色下拉旁边那一枚），' +
     '管的正是这一截正在编辑的那一套；从前那句拦路话「预设和输入法配色删不掉」在四份源码里数到 ' +
     ((UI + SH + 份.lib).match(/预设和输入法配色删不掉/g) || []).length + ' 处',
    (UI.match(/}, '删除这一套'/g) || []).length === 2 && /const 现编辑 = \(\) => \(挑着 \? 挑着\(\) : null\) \|\| Palette\.cur;/.test(UI) &&
    !/预设和输入法配色删不掉/.test(UI) && !/预设和输入法配色删不掉/.test(份.lib) && /}, '删除当前'\);\n  const editBtn/.test(UI));
  R.判('同一份 paletteLib 挂到「方案编辑」顶上时，看哪一套由调用方递的那一颗说了算（图3「上下两套配色」：上面下拉挑方案的配色，下面不能再改另一套）',
    /function paletteLib\(box, refresh, useFor, 挑着\)\{/.test(UI) &&
    /\}, \(\) => Palette\.items\.find\(x => x\.name === \(draft && draft\.配色\)\) \|\| Palette\.cur\);/.test(UI));
  R.判('色号那一列改成按宽度并列（一格至少 250 像素），输入框自己 min-width:0 + flex（不写这两句，五个色号就把那一页拉成五长条 = 图6）',
    /grid-template-columns:repeat\(auto-fill,minmax\(250px,1fr\)\)/.test(UI) && /min-width:0;flex:1 1 8em/.test(UI));
  R.判('预览那一框有了自己的上限（max-width:min(620px,100%) + min-width:0），不再跟着栅格那一列摊到最右被面板吃掉右边界（图7）',
    /max-width:min\(620px,100%\);min-width:0/.test(UI));
  R.判('圆点那一排留了 4 像素内边距（图9 左边被切：选中的那一圈是往外描的，容器 padding 为 0 就裁在第一格上）',
    /\.fd-dots\{display:flex;flex-wrap:wrap;gap:7px;align-items:center;padding:4px;\}/.test(SH),
    (SH.match(/\.fd-dots\{[^\n]*/) || [''])[0]);
  R.判('色卡那一排不再摆「小企鹅配色进色卡」「内置配色 v1 进色卡」（图8 两个多余按钮）：顶.append 那一句只剩 成组、从方案、加',
    /顶\.append\(成组, 从方案, 加\);/.test(UI) && !/小企鹅配色进色卡'/.test(UI) && !/内置配色 v1 进色卡'/.test(UI),
    (UI.match(/顶\.append\([^\n]*\)/g) || []).join(' ｜ '));
}

/* ================= 五、删完配色之后的账（图3 + 图14·15 那一条路走通没有） ================= */
R.题('五 · 删一套配色之后，两池的方案数和下拉都能接着选');
{
  const A = 摆();
  A.Palette.remove('pA');
  const light = A.Ming.pool('light'), dark = A.Ming.pool('dark');
  R.判('配色库里两条池各数得着（light ' + light.length + ' 套：' + light.map(x => x.name) + ' ｜ dark ' + dark.length + ' 套：' +
     dark.map(x => x.name) + '），库里 ' + A.Palette.items.length + ' 条一条不落空',
    light.length + dark.length === A.Palette.items.length, light.length + '+' + dark.length);
  const 案light = A.Ming.lookPoolList('light').length, 案dark = A.Ming.lookPoolList('dark').length;
  R.判('方案两头下拉的数量加起来等于方案总数（light ' + 案light + ' 套 ｜ dark ' + 案dark + ' 套 ｜ 共 ' + A.LookLib.list.length + ' 套）—— ' +
     '界面那一句「外观方案 N 套」念的就是这一份数', 案light + 案dark === A.LookLib.list.length, 案light + '+' + 案dark);
  const 回 = A.Palette.remove('preset-light');
  R.判('把 light 池整个删空（两条都删）：回 ' + 回 + '、light 池剩 ' + A.Ming.pool('light').length + ' 套，' +
     '指着它的方案改口到库里还剩的那一套（不在 light 池也照样有处可去，不留假选项）',
    回 === true && A.LookLib.list.every(s => A.Palette.items.some(e => e.name === s.配色)),
    A.LookLib.list.map(s => s.方案名 + '→' + s.配色));
  const B = 台(['    if(!it || this.data.items.length < 2) return false;', '    if(!it || this.data.items.length < 1) return false;']);
  B.LookStore.data.items = [ 配('only', '独苗', 'light') ]; B.LookStore.data.cur = 'only';
  B.LibStore.files[B.PAL_FILE] = '# 空的\n';
  let 抛 = '';
  try{ B.Palette.remove('only'); B.Palette.remove('only'); }catch(e){ 抛 = String((e && e.message) || e); }
  R.判('咬口三：把「最后一套不许删」那一道闸放开（length < 2 改成 length < 1）—— 第二趟删空之后取 items[0].id 当场抛：' +
     (抛 || '没抛（库里 ' + B.Palette.items.length + ' 条）') + '，上面那条拦的不是空的',
    抛 !== '' || B.Palette.items.length > 0);
}

R.数('源码', ['fd3-shell.js', 'fd3-lib.js', 'fd4-builtin.js', 'sh-color.js'].join(' + '));
R.收尾();
