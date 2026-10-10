/* 外32 图7 · 图16 那一排的续：「关系标签改成两只下拉 —— 主视角单选、关系视角多选；两边都只选人就等于只看人际关系」
   从前那一步：一张图顶摆着一串档名（一档一颗，点一颗换一张页），要看人&地点得先点那一颗，
   再看人&物还得再点另一颗。现在：主视角挑一类东西，关系视角挑几类，挑出来这一组档在同一张页里一起看。
   切的是仓库里那一份原文，不抄第二份：
     整颗 —— LINK_SIDES / sideName / LINK_CATS / catName / SIDE_RANK / pairKey / catSides / catsOf /
              sortSides / selRef / OLD_CAT / catKey / readRef / selName / shapeOf / REL_PICKS
     方法 —— RelView 的 constructor / get shape / atSec / status / pickBar / 关系菜单 / 换挑法 / list / line / flatList
              加卡片池那一颗 openRel
     一块 —— Views.reg('relmap', {…})（标题那颗吃的是真 readRef）
   边界替身：h（假 DOM，只记类、文字、选项和点了谁）、Menu.under（记下每一张重开的单子）、Desk.addTab、
   State（读写记下来）、linkRows（喂进去的假关联行）、CardNames / linkVal / linkArMarkup / linkDesc / bookTitle。 */
import vm from 'node:vm';
import { rd, 切, 切方法, 记账 } from './lib-slice.mjs';

const R = 记账('test-reltabs');
const W10 = rd('src/_wnw/src/w10-cards.js');
const 观 = W10.indexOf('class RelView');                 /* RelView 那一摊的起点：line / constructor 这种名字别家也有，界住才切得准 */
const 尽 = W10.indexOf("Views.reg('tpls'");
const 方 = 头 => 切方法(W10, 头, 观, 尽);
const 十一颗 = [
  切方法(W10, '  async openRel(){', 0, 观),
  方('  constructor(host, ctx, ref){'),
  方('  get shape(){'),
  方('  atSec(){'),
  方('  status(r, at){'),
  方('  pickBar(){'),
  方('  关系菜单(){'),
  方('  换挑法(main, sides){'),
  方('  async list(){'),
  方('  line(r, at){'),
  方('  flatList(rows, at){')
];
const 门牌块 = (() => {
  const a = W10.indexOf("Views.reg('relmap', {");
  if(a < 0 || a > 观) throw new Error('认不出 Views.reg(\'relmap\') 那一块');
  return W10.slice(a, W10.indexOf('});', a) + 3);   /* 这一块收在「});」，切方法只给到花括号，少那半个圆括号就是一份坏源码 */
})();
/* 卡片里「算哪一档」那一行住在 linkDlg 底下，不是一颗方法，按两个标记之间切一段出来（段的头尾都是仓库里的原话） */
const 档行 = (() => {
  const a = W10.indexOf("const 两头 = catSides(r.cat);");
  const b = W10.indexOf("h('label', {}, '关系')", a);
  if(a < 0 || b < 0) throw new Error('切不到「算哪一档」那一段（那两句话改过了，判法得跟着改）');
  return W10.slice(a, b);
})();
const 拼 = `
${切(W10, 'LINK_SIDES')}
${切(W10, 'sideName')}
${切(W10, 'LINK_CATS')}
${切(W10, 'catName')}
${切(W10, 'SIDE_RANK')}
${切(W10, 'pairKey')}
${切(W10, 'catSides')}
${切(W10, 'catsOf')}
${切(W10, 'sortSides')}
${切(W10, 'selRef')}
${切(W10, 'OLD_CAT')}
${切(W10, 'catKey')}
${切(W10, 'readRef')}
${切(W10, 'selName')}
${切(W10, 'shapeOf')}
${切(W10, 'REL_PICKS')}
const 壳 = class{
${十一颗.join('\n')}
};
const RelView = 壳;
${门牌块}
this.件 = { 壳, REL_PICKS, LINK_CATS, LINK_SIDES, catsOf, selRef, readRef, selName, pairKey, shapeOf, catName, 册:Views.册 };
`;
function 元素(类, 文){ return { 类:(类 || '').trim(), 文:String(文 == null ? '' : 文), 听:{}, children:[], at:{},
  appendChild(x){ this.children.push(x); return x; },
  set className(v){ this.类 = v; }, get className(){ return this.类; },
  set textContent(v){ this.文 = String(v); }, get textContent(){ return this.文; },
  addEventListener(k, f){ this.听[k] = f; },
  点(){ this.听.click && this.听.click({ target:this }); },
  换(v){ if(v !== undefined) this.value = v; this.听.change && this.听.change({ target:this }); } }; }
const h = (标记, at, kids) => {
  const e = 元素(at && at.class, typeof kids === 'string' ? kids : '');
  e.at = at || {};
  if(at && at.value !== undefined) e.value = at.value;
  if(at) for(const k of Object.keys(at)) if(/^on[a-z]+$/.test(k)) e.addEventListener(k.slice(2), at[k]);
  if(Array.isArray(kids)) for(const x of kids) if(x) e.appendChild(x);
  return e; };
function 台(存, 码文){
  const 沙 = { R, 元素, h };
  vm.createContext(沙);
  vm.runInContext(`
    var 开的页 = []; var 写过 = []; var 重画 = 0; var 换过 = []; var 单子 = [];
    var State = { 表:${JSON.stringify(存 || {})},
      async get(k, d){ return this.表[k] === undefined ? d : this.表[k]; },
      async set(k, v){ this.表[k] = v; 写过.push([k, v]); return true; } };
    var Desk = { addTab(kind, ref){ 开的页.push([kind, ref]); } };
    var Work = { book:{ id:'b1', title:'测试书' } };
    var 行 = [];
    async function linkRows(){ return 行; }
    function linkVal(){ return null; }                    /* 时间读法是另一轮的题：这里一律算「不限」，一行都不筛掉 */
    var CardNames = { get:id => ({ a:'甲', b:'乙', c:'丙' }[id] || '') };
    var linkArMarkup = () => '[ar]';
    var linkDesc = r => r.rel || '';
    var bookTitle = () => '测试书';
    var Menu = { under(el, items){ 单子.push({ el, items }); return 元素('wnw-menu'); }, close(){} };
    var Views = { reg(kind, def){ (Views.册 = Views.册 || {})[kind] = def; } };
  `, 沙);
  vm.runInContext(码文 || 拼, 沙);
  Object.assign(沙, 沙.件);
  沙.图 = (main, sides) => {
    const v = new 沙.壳({ clientHeight:600 }, { setRef(k){ 沙.换过.push(k); }, setTitle(){} }, 沙.selRef(main, sides));
    v.st = { mode:'real', at:'', cal:null, shapes:{} };
    v.listBox = 元素('wnw-col');
    /* 重画是真异步的（画一头要先取历法预设、再同步卡名）：这一颗替身交回一张「还没画完」的条子，
       由 沙.画完() 收口 —— 要不就验不出「单子等画完才重开」那一条（挂在一排被摘掉的旧节点上，量到的是全 0）。 */
    v.draw = () => { 沙.重画++; return new Promise(r => { 沙.等画完 = r; }); };
    return v;
  };
  沙.画完 = async () => { const r = 沙.等画完; 沙.等画完 = null; if(r) r(); await null; await null; return 沙; };
  沙.喂 = rows => vm.runInContext('行 = ' + JSON.stringify(rows) + ';', 沙);
  沙.挑项 = sel => sel.children.map(o => [o.at.value, !!o.at.selected]);
  沙.找 = (node, 类) => { const out = []; (function 走(n){ if(!n) return; if(n.类 === 类) out.push(n); n.children.forEach(走); })(node); return out; };
  沙.全话 = node => { const t = []; (function 走(n){ if(n.文) t.push(n.文); n.children.forEach(走); })(node); return t.join(' '); };
  沙.末单 = () => 沙.单子[沙.单子.length - 1];
  沙.末勾 = () => 沙.末单().items.filter(x => x.on).map(x => x.label);
  沙.点单 = 名 => 沙.末单().items.find(x => x.label === 名).fn();
  沙.点勾 = async 名 => { 沙.点单(名); await 沙.画完(); return 沙; };
  return 沙;
}
const 四类 = ['p', 'l', 't', 'o'];

R.题('一、图顶上换成一主一多两只下拉（那一串档名整个撤掉）');
{
  const 沙 = 台();
  const bar = 沙.图('p', ['p', 'l']).pickBar();
  const 选 = 沙.找(bar, 'wnw-input'), 钮 = 沙.找(bar, 'wnw-btn mini');
  R.判('这一排就两只控件：一枚下拉 + 一枚按钮（量的就是「改成两只下拉」那一句）',
    选.length === 1 && 钮.length === 1, 选.length + ' / ' + 钮.length);
  R.判('主视角那枚摆的就是四类，一颗不多一颗不少',
    沙.挑项(选[0]).map(x => x[0]).join(',') === 'p,l,t,o', 沙.挑项(选[0]).map(x => x[0]).join(','));
  R.判('下拉里亮着的是这一张图那一类（不是永远亮第一类）',
    沙.挑项(选[0]).filter(x => x[1]).length === 1 && 沙.挑项(选[0])[0][1] === true, JSON.stringify(沙.挑项(选[0])));
  R.判('关系视角那枚按钮上写着当前挑中的几类（"' + 钮[0].文 + '"）', 钮[0].文 === '关系视角：人、地', 钮[0].文);
  const 全 = 沙.找(沙.图('p', 四类).pickBar(), 'wnw-btn mini')[0].文;
  R.判('四类都挑时那一枚写「都看」（不摆一长串名字）', 全 === '关系视角：都看', 全);
  R.判('页顶那一串档名整个没了（kindBar 那颗方法、wnw-subtabs 那一档样式都不剩）',
    !/kindBar/.test(W10) && !/wnw-subtabs/.test(W10), /kindBar|wnw-subtabs/.exec(W10));
  R.判('两只下拉摆在画法那一排上面（后插的贴着头，顺序写反就成两层倒置）',
    /panelUnder\(head, this\.toolBar\(\)\);[\s\S]{0,220}panelUnder\(head, this\.pickBar\(\)\)/.test(W10),
    /panelUnder\(head, this\.toolBar[\s\S]{0,260}/.exec(W10)[0].split('\n').slice(0, 5).join(' ⏎ '));
}
R.题('二、关系视角那一只：可多选，勾完单子不关');
{
  const 沙 = 台();
  const v = 沙.图('p', ['p']);
  const 单 = v.关系菜单();
  R.判('单子里四类各一行，末尾一条分隔线，再加一颗「四类都看」',
    单.length === 6 && 单.slice(0, 4).map(x => x.label).join('|') === '人|地|物|势力 / 组织 / 机构'
      && 单[4].sep === true && 单[5].label === '四类都看', 单.map(x => x.label || '—').join(' | '));
  R.判('对勾亮的是当前挑中的那几类（这时候只有「人」）', 单.filter(x => x.on).map(x => x.label).join(',') === '人',
    单.map(x => x.label + '=' + !!x.on).join(' '));
  const 前 = 沙.单子.length;
  单.find(x => x.label === '地').fn();
  R.判('点一类没挑的：这一类进来了，门牌和地址跟着换成「p|pl」',
    v.sides.join(',') === 'p,l' && v.ref === 'p|pl' && 沙.换过[沙.换过.length - 1] === 'p|pl',
    v.sides.join(',') + ' / ' + v.ref + ' / ' + 沙.换过.join(','));
  R.判('点下去重画一趟（只一趟）', 沙.重画 === 1, 沙.重画);
  R.判('这一张页画完之前单子不许重开（那一排在重画头一句就被摘下来了，挂它身上量到的是全 0，单子会跳到整页左上角）',
    沙.单子.length === 前, 沙.单子.length - 前);
  await 沙.画完();
  R.判('画完了单子重开一次，两个对勾都在（关了就没人知道自己挑了几类）',
    沙.单子.length === 前 + 1 && 沙.末勾().join('、') === '人、地', 沙.末勾().join('、'));
  await 沙.点勾('地');
  R.判('点一类已挑的（还剩两类以上）：把那一类撤掉，门牌回「p|p」',
    v.sides.join(',') === 'p' && v.ref === 'p|p' && 沙.末勾().join('、') === '人',
    v.sides.join(',') + ' / ' + v.ref + ' / ' + 沙.末勾().join('、'));
  const 重前 = 沙.重画, 换前 = 沙.换过.length, 单前 = 沙.单子.length;
  沙.点单('人');
  R.判('只剩一类时再点它：什么都不撤 —— 不许弄出一张空页（不重画、不换地址）',
    沙.重画 === 重前 && 沙.换过.length === 换前 && v.sides.join(',') === 'p', 沙.重画 + ' / ' + v.sides.join(','));
  R.判('按了拒掉的那一颗，单子也照旧重开（不该因为这一颗按不动就把整张单子关掉）',
    沙.单子.length === 单前 + 1 && 沙.末勾().join('、') === '人', 沙.末勾().join('、'));
  await 沙.点勾('四类都看');
  R.判('「四类都看」：四类全亮，门牌把四类按表排齐（不按点的顺序）',
    v.sides.length === 4 && v.ref === 沙.selRef('p', 四类) && 沙.末勾().length === 4, v.ref + ' / ' + 沙.末勾().join('、'));
}
R.题('三、挑出来的是哪一组档（他那条口径）');
{
  const 沙 = 台();
  R.判('两边都只选「人」= 只看人际关系（只有 pp 那一档）',
    沙.catsOf('p', ['p']).join(',') === 'pp', 沙.catsOf('p', ['p']).join(','));
  R.判('主视角「人」+ 四类都看 = 人那一头的四档（pp / po / pt / pl）',
    沙.catsOf('p', 四类).join(',') === 'pp,po,pt,pl', 沙.catsOf('p', 四类).join(','));
  R.判('主视角「人」+ 关系视角只挑地、物 = 两档（pt / pl，没有人&人也没有物&地点 —— 主视角那一头必须在里头）',
    沙.catsOf('p', ['l', 't']).join(',') === 'pt,pl', 沙.catsOf('p', ['l', 't']).join(','));
  R.判('关系视角空了当「只算自己那一类」，不落成一组谁都见不着的空档',
    沙.catsOf('o', []).join(',') === 'oo', 沙.catsOf('o', []).join(','));
  R.判('两头不分先后：人 对 地 和 地 对 人 落同一档',
    沙.pairKey('p', 'l') === 'pl' && 沙.pairKey('l', 'p') === 'pl', 沙.pairKey('p', 'l') + ' / ' + 沙.pairKey('l', 'p'));
  R.判('原来那七档一字不改（顺序和名字逐字比）',
    沙.LINK_CATS.slice(0, 7).map(x => x.join('=')).join('|') ===
      'pp=人&人关系|po=人&组织关系|oo=组织&组织关系|pt=人&物关系|tl=物&地点关系|pl=人&地点关系|ol=组织&地点关系',
    沙.LINK_CATS.slice(0, 7).map(x => x.join('=')).join('|'));
  R.判('补的三档（地&地 / 物&物 / 组织&物）都在 —— 下拉挑得到就得有档能落',
    ['ll', 'tt', 'ot'].every(k => 沙.LINK_CATS.some(x => x[0] === k)), 沙.LINK_CATS.map(x => x[0]).join(','));
  const 并 = new Set();
  for(const k of 四类) 沙.catsOf(k, 四类).forEach(c => 并.add(c));
  R.判('四类每一类当眼睛都各有四档可看，四类并起来正好是那十档（不漏不多）',
    四类.every(k => 沙.catsOf(k, 四类).length === 4) && 并.size === 沙.LINK_CATS.length,
    四类.map(k => k + ':' + 沙.catsOf(k, 四类).length).join(' ') + ' 并 ' + 并.size);
}
R.题('四、一张页一个门牌（老的档号还得认得）');
{
  const 沙 = 台();
  R.判('门牌写成「主视角|两头」，两头按表排（挑的顺序乱着给也一样）',
    沙.selRef('p', ['l', 't', 'o']) === 'p|otl', 沙.selRef('p', ['l', 't', 'o']));
  R.判('老那一种两个字母的档号认得（oo → 组织那一类、另一头就是组织）',
    JSON.stringify(沙.readRef('oo')) === '{"main":"o","sides":["o"]}', JSON.stringify(沙.readRef('oo')));
  R.判('更早那三档名（rel / sub / inv）迁到位：亲人那档进人&人',
    JSON.stringify(沙.readRef('rel')) === '{"main":"p","sides":["p"]}', JSON.stringify(沙.readRef('rel')));
  R.判('坏值 / 认不出的一类：退回「人 · 只选人」，不开一张空页',
    JSON.stringify(沙.readRef('zz')) === '{"main":"p","sides":["p"]}' && JSON.stringify(沙.readRef('x|q')) === '{"main":"p","sides":["p"]}',
    JSON.stringify(沙.readRef('zz')) + ' / ' + JSON.stringify(沙.readRef('x|q')));
  R.判('名册上只注册一张 relmap（不再按档各注册一张）',
    Object.keys(沙.册).join(',') === 'relmap', Object.keys(沙.册).join(','));
  R.判('标签页那张标题跟着门牌走（页签上写的就是这一组挑的什么，老的档号也报得出名字）',
    沙.册.relmap.title('p|otl') === '人 · 关系：势力 / 组织 / 机构、物、地'
      && 沙.册.relmap.title('oo') === '势力 / 组织 / 机构 · 关系：势力 / 组织 / 机构',
    沙.册.relmap.title('p|otl') + ' ｜ ' + 沙.册.relmap.title('oo'));
  const v = 沙.图('p', ['l']);
  R.判('这一张页记着自己的门牌和这一组档（重开同一张页得到的是同一副）',
    v.ref === 'p|l' && v.cats.join(',') === 'pl', v.ref + ' / ' + v.cats.join(','));
}
R.题('五、那枚「关联」和两处入口');
{
  const 沙 = 台();
  await 沙.图('p', ['p']).openRel();
  R.判('一次都没开过：开「人」那一类、四类都看的那张页', 沙.开的页[0][1] === 'p|potl', JSON.stringify(沙.开的页));
  R.判('一次都没开过也不开弹框（图16 那一步没退回去）', 沙.开的页.length === 1 && !/Overlay\.open\('关联图'/.test(W10), JSON.stringify(沙.开的页));
  const 沙2 = 台({ 'rel.last':'o|pl' });
  await 沙2.图('p', ['p']).openRel();
  R.判('上次这一组挑到什么程度，这一次原样再开（存的是 rel.last）', 沙2.开的页[0][1] === 'o|pl', JSON.stringify(沙2.开的页));
  const 沙3 = 台({ 'rel.last':'oo' });
  await 沙3.图('p', ['p']).openRel();
  R.判('存的是老的档号也照样开得出来（标签页里还可能留着两个字母）', 沙3.开的页[0][1] === 'oo', JSON.stringify(沙3.开的页));
  R.判('画完把新门牌写回 rel.last（老档号进去、新门牌出来，第二回就不再走迁就那条路）',
    /State\.set\('rel\.last', this\.ref\)/.test(W10), /State\.set\('rel\.last'[^\n]*/.exec(W10)[0]);
  R.判('入口清单四条，一类眼睛一条，全走 relmap，门牌是那四类都看那一副',
    沙.REL_PICKS.length === 4 && 沙.REL_PICKS.every(p => p.kind === 'relmap')
      && 沙.REL_PICKS.map(p => p.ref()).join(' ') === 'p|potl l|potl t|potl o|potl',
    沙.REL_PICKS.map(p => p.kind + ':' + p.ref()).join(' '));
  R.判('看板那个下拉和「＋打开内容」两处吃的都是这一份清单（一处一份名字表最容易漏改）',
    /REL_PICKS\.map\(p => \(\{ label:p\.label, fn:\(\) => Desk\.addTab\(p\.kind, p\.ref\(\), null\) \}\)\)/.test(rd('src/_wnw/src/w11-board.js'))
      && /\.\.\.REL_PICKS,/.test(rd('src/_wnw/src/w3-shell.js')),
    /REL_PICKS[^\n]*/.exec(rd('src/_wnw/src/w11-board.js'))[0]);
  R.判('卡片池顶上那枚「关联」走的还是 openRel', /onclick:\(\) => this\.openRel\(\)/.test(W10),
    /onclick:[^\n]*openRel[^\n]*/.exec(W10)[0]);
}
R.题('六、哪些行进这张页（真跑 list，喂进去的是假关联行）');
{
  const 行 = [
    { from:'a', to:'b', cat:'pp', rel:'师徒', fromTitle:'甲' },
    { from:'a', to:'c', cat:'po', rel:'任职', fromTitle:'甲' },
    { from:'b', to:'c', cat:'pl', rel:'住在', fromTitle:'乙' },
    { from:'b', to:'c', cat:'pl', rel:'住在', fromTitle:'乙', rev:true },
    { from:'c', to:'a', cat:'tl', rel:'藏着', fromTitle:'丙' },
    { from:'c', to:'b', cat:'oo', rel:'下属', fromTitle:'丙' }
  ];
  const 沙 = 台();
  沙.喂(行);
  const v = 沙.图('p', ['p']);
  await v.list();
  const 话 = 沙.全话(v.listBox);
  R.判('两边都只选「人」：只有人&人那一条露面，其余五条一条不见',
    /师徒/.test(话) && !/任职|住在|藏着|下属/.test(话), 话);
  R.判('只有一档可看时，行上不补「这条算哪一档」（一句废话都不多）', !/人&人关系/.test(话), 话);
  const v2 = 沙.图('p', ['p', 'o', 'l']);
  await v2.list();
  const 话2 = 沙.全话(v2.listBox);
  R.判('主视角人 + 关系视角人·组织·地：人&人、人&组织、人&地点三条进来，物&地点和组织&组织那条不进',
    /师徒/.test(话2) && /任职/.test(话2) && /住在/.test(话2) && !/藏着|下属/.test(话2), 话2);
  R.判('同时看几档时行上补一句这条算哪一档（每一行写明自己进的是哪一档）',
    /人&人关系/.test(话2) && /人&组织关系/.test(话2) && /人&地点关系/.test(话2), 话2);
  R.判('双向那条反过来的镜像行不占第二行（一条线画双箭头就够）', 话2.split('住在').length - 1 === 1, 话2);
  const v3 = 沙.图('t', ['t']);
  await v3.list();
  R.判('一行都没有时给的是白话指引，写清这一组挑的是什么（不是空白屏）',
    /还没有「物 · 关系：物」这一组关联/.test(沙.全话(v3.listBox)), 沙.全话(v3.listBox));
}
R.题('七、画法记在哪一类眼睛名下');
{
  const 沙 = 台();
  R.判('画法按主视角分开记（收一收关系视角不该把这张图的画法换了）',
    /get shape\(\)\{ return this\.st\.shapes\[this\.main\]/.test(W10), 方('  get shape(){'));
  R.判('新建那一类眼睛的默认画法：组织 = 树、物 = 清单、人和地 = 平铺',
    沙.shapeOf('o') === 'tree' && 沙.shapeOf('t') === 'list' && 沙.shapeOf('p') === 'flat' && 沙.shapeOf('l') === 'flat',
    ['o', 't', 'p', 'l'].map(k => k + ':' + 沙.shapeOf(k)).join(' '));
}
R.题('八、卡片里「算哪一档」跟着换成两只下拉');
{
  R.判('那一行是两只下拉，各挑四类，中间一个「对」，末尾现报这一档的名字',
    /挑一类\(两头\[0\]/.test(档行) && /挑一类\(两头\[1\]/.test(档行)
      && /for\(const \[k, n\] of LINK_SIDES\) s\.appendChild/.test(档行)
      && /'对'/.test(档行) && /catName\(r\.cat\)/.test(档行), 档行.split('\n').slice(0, 2).join(' ⏎ '));
  R.判('原来那七颗档名按钮一排整个撤了（同一件事两处两种挑法最容易记不住）',
    !/for\(const \[k, n\] of LINK_CATS\) seg\.appendChild/.test(W10), /of LINK_CATS\) seg/.exec(W10));
  R.判('换任一头只动自己那一头、另一头照 pairKey 落档（不分先后）',
    /r\.cat = pairKey\(v, catSides\(r\.cat\)\[1\]\)/.test(档行) && /r\.cat = pairKey\(catSides\(r\.cat\)\[0\], v\)/.test(档行),
    /pairKey\([^)]*\)[^\n]*/.exec(档行)[0]);
}
R.题('九、改坏一处会怎样（判法得真的咬得住）');
{
  const 头 = 十一颗[5];                                     /* pickBar 整颗 */
  const 沙 = 台(null, 拼.replace(头, 头.replace('selected:k === this.main', 'selected:false')));
  const 选 = 沙.找(沙.图('p', ['p']).pickBar(), 'wnw-input');
  R.判('改坏一：把「亮着当前那一类」拆掉 → 第一条判法当场失效（下拉里一颗都不亮）',
    沙.挑项(选[0]).every(x => !x[1]), 沙.挑项(选[0]).map(x => x[0] + '=' + x[1]).join(' '));
  const 颗 = 十一颗[6];                                     /* 关系菜单 整颗 */
  const 沙2 = 台(null, 拼.replace(颗, 颗.replace('if(has && this.sides.length === 1){ 重开(); return; }', '')));
  const v = 沙2.图('p', ['p']);
  v.关系菜单().find(x => x.label === '人').fn();
  R.判('改坏二：拿掉「只剩一类不许撤」→ 一类也能撤光，门牌落成一串带竖线的怪值（第二、三段的判法当场失效）',
    v.sides.length === 0 && v.ref === 'p|', v.sides.length + ' / ' + JSON.stringify(v.ref));
  const 沙3 = 台(null, 拼.replace(颗, 颗.replace('完 && 完.then ? 完.then(重开) : 重开();', '重开();')));
  const v3 = 沙3.图('p', ['p']);
  v3.关系菜单().find(x => x.label === '地').fn();
  R.判('改坏三：不等这一张页画完就把单子重挂上去 → 「画完之前不许重开」那条判法当场失效（单子当场就挂上了）',
    沙3.单子.length === 1, 沙3.单子.length);
}
R.收尾();
