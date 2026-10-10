/* 外30 甲组 · 图3 + 图12：出厂模板清空一次、模板改了卡要跟着对齐。
   切的是真源码（w7-data.js 的 Cards.loadTpls / DB / migrateTplIcons / TPL_ICON_OLD、w10-cards.js 的
   洗值 / alignToTpl / 并对齐 / syncFromTpl / askBox），边界上只给替身：State（表单记忆）、
   Overlay（弹窗壳）、toast、h（假元素）。
   规矩照这一仓的来：每一条都报数，最后咬两口 —— 把承重那一句改坏，对应的判法必须不过。 */
import vm from 'node:vm';
import { rd, 切, 切方法, 记账 } from './lib-slice.mjs';

const R = 记账('test-tplsync');
const W7 = rd('src/_wnw/src/w7-data.js');
const W10 = rd('src/_wnw/src/w10-cards.js');
const C7 = W7.indexOf('const Cards = {');
const 界 = (src, 起) => { const n = src.indexOf('\nconst ', 起), k = src.indexOf('\nclass ', 起);
  return [n, k].filter(x => x > 起).sort((a, b) => a - b)[0] || src.length; };
const 止7 = 界(W7, C7);

const 卡法 = ['  async loadTpls(){', '  async saveTpls(){', '  async tpl(id){', '  async get(id){',
  '  async put(c, keepAt){', '  async index(c){', '  async all(){'].map(头 => 切方法(W7, 头, C7, 止7));
const 拼 = `
${切(W7, 'DB')}
${切(W7, 'TPL_ICON_OLD')}
${切(W7, 'migrateTplIcons')}
${切(W7, 'uid')}
const Cards = { tpls:null,
${卡法.join(',\n')}
};
${切(W10, '洗值')}
${切(W10, 'alignToTpl')}
${切(W10, '并对齐')}
${切(W10, 'syncFromTpl')}
${切(W10, 'askBox')}
this.件 = { DB, Cards, alignToTpl, 洗值, syncFromTpl, askBox, uid };
`;

const 替 = `
var 库表 = new Map();
async function mkKv(){ return { kind:'idb',
  async get(k){ return 库表.has(k) ? JSON.parse(库表.get(k)) : undefined; },
  async put(k, v){ 库表.set(k, JSON.stringify(v)); return true; },
  async del(k){ 库表.delete(k); },
  async keys(pre){ return [...库表.keys()].filter(k => !pre || k.startsWith(pre)); } }; }
var Storage = { warn(){} };
var toast = (m) => { 报话.push(String(m)); };
var 报话 = [];
var Bus = { emit(k, a){ 播.push(k); } };
var 播 = [];
var State = { 表:{}, async get(k, d){ return this.表[k] === undefined ? d : this.表[k]; }, async set(k, v){ this.表[k] = v; } };
var 开 = [];
var Overlay = { open(title, box, btns){ 开.push({ title, box, btns:btns || [] }); },
  close(){ 开.pop(); },
  /* 按第几颗按钮（从 0 数）：真身里那是他点下去的一下 */
  按(i){ const m = 开[开.length - 1]; if(!m) throw new Error('没有开着的框'); const b = m.btns[i];
    if(!b) throw new Error('那一颗按钮没摆出来（一共 ' + m.btns.length + ' 颗）'); b.at.onclick(); return m.title; },
  钮名(){ const m = 开[开.length - 1]; return m ? m.btns.map(b => b.at && b.文 || '').join(' / ') : '(没开框)'; } };
function 元素(标记, at){ const el = { 标记, at:at || {}, kids:[], text:'',
  appendChild(x){ this.kids.push(x); return x; } }; return el; }
var h = (标记, at, kids) => {
  const el = 元素(标记, at); el.文 = '';
  const 列 = kids === undefined ? [] : (Array.isArray(kids) ? kids : [kids]);
  for(const x of 列){ if(typeof x === 'string') el.文 += x; else if(x) el.appendChild(x); }
  return el;
};
var confirm = () => true;
`;

const 静 = async (n = 40) => { for(let i = 0; i < n; i++) await Promise.resolve(); };
function 台(码){
  const 沙 = {}; vm.createContext(沙);
  vm.runInContext(替, 沙); vm.runInContext(码 || 拼, 沙);
  Object.assign(沙, 沙.件);
  沙.静 = 静;
  return 沙;
}
/* 一套模板 + 一张照着它建出来的卡（结构照 Cards.fromTpl 那颗真身摆出来的样子：每条带 fid） */
function 模板(){ return { id:'t1', name:'人物', icon:'card', groups:[
  { name:'基本', items:[
    { id:'f1', name:'名称', type:'text', opts:[] },
    { id:'f2', name:'性别', type:'single', opts:[{ label:'男', color:'' }, { label:'女', color:'' }] } ] },
  { name:'线索', items:[ { id:'f3', name:'进度', type:'track', opts:[] } ] } ] }; }
function 卡(tpl, 改){
  const c = { id:'c1', bookId:'b1', tpl:tpl.id, tplName:tpl.name, title:'甲', aliases:[], at:1, created:1,
    groups:[], color:'', tags:[], resp:'high', links:[], ok:{} };
  for(const g of tpl.groups) c.groups.push({ name:g.name, items:g.items.map(f => ({
    id:'i_' + f.id, fid:f.id, name:f.name, type:f.type, values:[], opts:(f.opts || []).map(o => ({ label:o.label, color:o.color })) })) });
  /* 默认往两条上填字，好数「掉字」 */
  c.groups[0].items[0].values = ['林七'];
  c.groups[0].items[1].values = ['男'];
  if(改) 改(c);
  return c;
}
async function 铺(沙, tpl, c){
  await 沙.DB.put('cardtpl', [tpl]);
  await 沙.Cards.put(c);
  沙.Cards.tpls = null;
  await 静();
}
const 找 = (c, 名) => { for(const g of c.groups) for(const it of g.items) if(it.name === 名) return it; return null; };

/* ---------- 一、图3：出厂那六套不再种进库，老库里那几套清一次 ---------- */
R.题('一、图3 出厂模板');
{
  /* 源码里不许再有那六套的名字：一颗一颗数 */
  const 名单 = ['角色卡', '物品', '地点', '势力', '功法', '事件纲要'];
  const 还在 = 名单.filter(n => W7.includes("name:'" + n + "'"));
  R.判('w7-data.js 里那六套出厂模板的定义（name:\'…\'）还剩 ' + 还在.length + ' 处', 还在.length === 0, 还在.join('、'));
  R.判('TPL_BUILTIN 这一颗整块没了（源码里出现次数 = ' + (W7.match(/TPL_BUILTIN/g) || []).length + '）',
    !/TPL_BUILTIN/.test(W7), (W7.match(/TPL_BUILTIN/g) || []).length + ' 处');

  const 沙 = 台();
  /* 老库里三套：两套带 builtin（当年种进去的），一套他自己建的 */
  await 沙.DB.put('cardtpl', [
    { id:'o1', name:'角色卡', icon:'card', builtin:true, groups:[] },
    { id:'o2', name:'物品', icon:'card', builtin:true, groups:[] },
    { id:'u1', name:'我的类型', icon:'card', groups:[] }]);
  await 沙.Cards.loadTpls();
  R.判('开机读一次：出厂那两套被摘掉（' + 沙.Cards.tpls.length + ' 套留着），他自己建的「我的类型」原样在',
    沙.Cards.tpls.length === 1 && 沙.Cards.tpls[0].name === '我的类型', 沙.Cards.tpls.map(x => x.name).join('、'));
  R.判('摘掉这件事写回了库（不是只在内存里躲一次）',
    ((await 沙.DB.get('cardtpl', [])) || []).length === 1, String(((await 沙.DB.get('cardtpl', [])) || []).length));
  R.判('报了一句明话（清掉几套、卡没动）：' + (沙.报话[0] || ''), /清掉出厂模板 2 套/.test(沙.报话.join('|')), 沙.报话.join('|'));
  沙.Cards.tpls = null; 沙.报话.length = 0;
  await 沙.Cards.loadTpls();
  R.判('第二次读不再摘、也不再报（只清这一次，不当常驻动作）', 沙.报话.length === 0 && 沙.Cards.tpls.length === 1,
    沙.报话.join('|') + ' / ' + 沙.Cards.tpls.length + ' 套');
  /* 空库：一颗都不种 */
  const 空 = 台(); await 空.DB.put('cardtpl', null); await 空.Cards.loadTpls();
  R.判('库里一套也没有：交回 ' + 空.Cards.tpls.length + ' 套（不种出厂货、不报错）', 空.Cards.tpls.length === 0, String(空.Cards.tpls.length));
}

/* ---------- 二、图12：alignToTpl 六种改动 ---------- */
R.题('二、图12 卡跟着模板对齐（alignToTpl 六种改动）');
{
  const 沙 = 台();
  {
    const t = 模板(), c = 卡(t);
    t.groups[0].items[0].name = '名字';
    const r = 沙.alignToTpl(c, t);
    R.判('模板里改属性名：卡上那一格跟着改口（报 改名 ' + r.改名 + '）', 找(c, '名字') && r.改名 === 1, JSON.stringify(r));
    R.判('改属性名不掉字：那一格还留着「林七」', (找(c, '名字').values || []).join('') === '林七', (找(c, '名字').values || []).join(''));
  }
  {
    const t = 模板(), c = 卡(t);
    t.groups[1].name = '伏笔';
    const r = 沙.alignToTpl(c, t);
    R.判('模板里改属性组名：卡上那一组靠编号认出来、跟着改口（报 改组名 ' + r.改组名 + '），没有多出一组空的',
      r.改组名 === 1 && c.groups.length === 2 && c.groups[1].name === '伏笔' && 找(c, '进度'),
      c.groups.map(g => g.name + '(' + g.items.length + ')').join(' '));
  }
  {
    const t = 模板(), c = 卡(t);
    t.groups[0].items[1].type = 'multi';
    const r = 沙.alignToTpl(c, t);
    R.判('换填写方式（单选 → 多选）：那一格还是「男」，不掉字（报 换型 ' + r.换型 + '、掉字 ' + r.掉字 + '）',
      r.换型 === 1 && r.掉字 === 0 && (找(c, '性别').values || []).join('') === '男', JSON.stringify(r));
  }
  {
    const t = 模板(), c = 卡(t);
    t.groups[0].items[1].type = 'text';
    const r = 沙.alignToTpl(c, t);
    R.判('单选换成填空：那两个字还当填空的话读，留着不掉（掉字 ' + r.掉字 + '）',
      r.掉字 === 0 && 找(c, '性别').type === 'text' && (找(c, '性别').values || []).join('') === '男', JSON.stringify(r));
  }
  {
    const t = 模板(), c = 卡(t);
    c.groups[0].items[0].type = 'text';       /* 卡上这一格本来是填空，填着「林七」 */
    t.groups[0].items[0].type = 'single';     /* 模板把它改成单选，选项里没有「林七」 */
    t.groups[0].items[0].opts = [{ label:'男', color:'' }];
    const r = 沙.alignToTpl(c, t);
    R.判('填空换成单选、原来那两个字不在选项里：当场掉（掉字 ' + r.掉字 + '），这一笔要报给他看',
      r.掉字 === 1 && (找(c, '名称').values || []).length === 0, JSON.stringify(r));
  }
  {
    const t = 模板(), c = 卡(t);
    t.groups[0].items = [t.groups[0].items[1]];
    const r = 沙.alignToTpl(c, t);
    R.判('模板里删一条属性：卡上那一格连着填过的字一起没（删掉 ' + r.删掉 + '、掉字 ' + r.掉字 + '），剩下那条不动',
      r.删掉 === 1 && r.掉字 === 1 && !找(c, '名称') && !!找(c, '性别'), JSON.stringify(r));
  }
  {
    const t = 模板(), c = 卡(t);
    t.groups[0].items.push({ id:'f9', name:'出场年龄', type:'text', opts:[] });
    const r = 沙.alignToTpl(c, t);
    const 新 = 找(c, '出场年龄');
    R.判('模板里加一条属性：卡上多出一格空的、带着 fid（新加 ' + r.新加 + '）',
      r.新加 === 1 && !!新 && 新.fid === 'f9' && (新.values || []).length === 0, JSON.stringify(r));
  }
  {
    const t = 模板(), c = 卡(t);
    /* 卡上自己加的一条（没有 fid）+ 模板里换了次序 */
    c.groups[0].items.push({ id:'iz', name:'我自己加的', type:'text', values:['留着'] });
    t.groups[0].items.reverse();
    const r = 沙.alignToTpl(c, t);
    const 序 = c.groups[0].items.map(x => x.name).join('、');
    R.判('模板里挪了次序：卡上那几条跟着重排（报 移动 ' + r.移动 + '），自己加的那条留在末尾不动',
      r.移动 === 1 && /我自己加的$/.test(序) && 序.indexOf('性别') === 0, 序);
  }
  {
    const t = 模板(), c = 卡(t);
    const 前 = JSON.stringify(c);
    const r = 沙.alignToTpl(c, t);
    R.判('模板一个字没改：六本账全是 0，卡里那颗字也没动（' + JSON.stringify(r) + '）',
      Object.keys(r).every(k => !r[k]) && JSON.stringify(c) === 前, JSON.stringify(r));
  }
  /* 咬口：模板自己不带编号（导入覆盖那一路）→ 不许动刀删卡里的格 */
  {
    const t = 模板(); t.groups.forEach(g => g.items.forEach(f => { delete f.id; }));
    const c = 卡(模板());   /* 卡是照带编号的模板建的，fid 全在 */
    const r = 沙.alignToTpl(c, t);
    R.判('模板不带可信编号（导入覆盖那一路）：不删卡里任何一格（删掉 ' + r.删掉 + '）、不掉字（' + r.掉字 + '）',
      r.删掉 === 0 && r.掉字 === 0 && !!找(c, '名称') && !!找(c, '性别'), JSON.stringify(r));
  }
}

/* 问那一句：syncFromTpl 会停在那只框上等回答，所以先把这一单挂起来、再按按钮、最后收账。
   答 = 0 是「只改模板」，1 是「一起对齐」 */
async function 问答(沙, tpl, 答){
  const 单 = 沙.syncFromTpl(tpl);
  await 静();
  const 框 = 沙.开[沙.开.length - 1];
  const 话 = 框 ? 框.box.kids.map(x => x.文).join(' ｜ ') : '';
  if(框) 沙.Overlay.按(答);
  await 静();
  return { n:await 单, 话, 开过:!!框 };
}

/* ---------- 三、syncFromTpl：问那一句报的是真数，答「不」就一个字都不写 ---------- */
R.题('三、syncFromTpl 那一句问话');
{
  const t = 模板();
  const c = 卡(t);
  const 沙 = 台(); await 铺(沙, t, c);
  /* 铺完再改：真身里就是这个次序 —— 库和卡照旧，模板那份在内存里被改了 */
  t.groups[0].items[0].name = '名字';
  t.groups[0].items[1].type = 'text';      /* 两处：改属性名 + 换填写方式 */
  const { n, 话, 开过 } = await 问答(沙, t, 0);
  R.判('改完模板问了一句，标题是「同步这些卡」', 开过, 开过 ? '' : '没开框');
  R.判('那一句里报的是当场算出来的真数（用到它的 1 张卡 · 改属性名 1 处 · 换填写方式 1 处）',
    /1 张卡/.test(话) && /改属性名 1 处/.test(话) && /换填写方式 1 处/.test(话), 话);
  R.数('那一句原话', 话);
  const 后 = await 沙.Cards.get('c1');
  R.判('答「只改模板」：卡里一个字没动（那一格还叫「名称」，还是单选）',
    后.groups[0].items[0].name === '名称' && 找(后, '性别').type === 'single', 后.groups[0].items[0].name + ' / ' + 找(后, '性别').type);
  R.判('交回 0 张（没动卡就是没动卡，不虚报）', n === 0, String(n));
  /* 答「一起对齐」 */
  const 沙2 = 台(); { const 底 = 模板(); await 铺(沙2, 底, 卡(底)); }
  const t2 = (await 沙2.DB.get('cardtpl', []))[0]; t2.groups[0].items[0].name = '名字二';
  const r2 = await 问答(沙2, t2, 1);
  const 后2 = await 沙2.Cards.get('c1');
  R.判('答「一起对齐」：卡里那一格真的改口成「名字二」（交回 ' + r2.n + ' 张）',
    后2.groups[0].items[0].name === '名字二' && r2.n === 1, 后2.groups[0].items[0].name);
  R.判('对齐那一趟广播了 cards:aligned（卡屏开着的话要重读，不然下次一打字把对齐好的盖回去）',
    沙2.播.includes('cards:aligned') && 沙2.播.includes('desk:cards'), 沙2.播.join('、'));
  /* 「以后不再问」= 一起对齐：第二次不弹窗，直接办 */
  const 沙3 = 台(); { const 底 = 模板(); await 铺(沙3, 底, 卡(底)); }
  沙3.State.表['tpl.sync'] = 'yes';
  const t3 = (await 沙3.DB.get('cardtpl', []))[0]; t3.groups[0].items[0].name = '名字三';
  const r3 = await 问答(沙3, t3, 1);
  R.判('勾过「以后不再问 · 一起对齐」：不再弹窗（开过框 = ' + r3.开过 + '），直接对齐 ' + r3.n + ' 张',
    !r3.开过 && r3.n === 1 && (await 沙3.Cards.get('c1')).groups[0].items[0].name === '名字三', r3.开过 + ' / ' + r3.n);
  /* 「以后不再问」= 只改模板：也不弹窗，也什么都不写 */
  const 沙4 = 台(); { const 底 = 模板(); await 铺(沙4, 底, 卡(底)); }
  沙4.State.表['tpl.sync'] = 'no';
  const t4 = (await 沙4.DB.get('cardtpl', []))[0]; t4.groups[0].items[0].name = '名字四';
  const r4 = await 问答(沙4, t4, 1);
  R.判('勾过「以后不再问 · 只改模板」：不弹窗也不动卡（交回 ' + r4.n + ' 张，卡里还是「名称」）',
    !r4.开过 && r4.n === 0 && (await 沙4.Cards.get('c1')).groups[0].items[0].name === '名称', String(r4.n));
  /* 没有卡用这套模板：一句都不问 */
  const 沙5b = 台(); await 沙5b.DB.put('cardtpl', [模板()]);
  const r5 = await 问答(沙5b, (await 沙5b.DB.get('cardtpl', []))[0], 1);
  R.判('一套模板没有卡在用：不问（开过框 = ' + r5.开过 + '）、交回 ' + r5.n, !r5.开过 && r5.n === 0, r5.开过 + ' / ' + r5.n);
}

/* ---------- 四、模板改名 → 卡的类型名跟着改口 ---------- */
R.题('四、模板改名与卡的类型名');
{
  const t = 模板(), c = 卡(t);
  const 沙 = 台(); await 铺(沙, t, c);
  const 前 = (await 沙.Cards.get('c1')).at;      /* 铺那一下是按正常建卡走的，先记下这个时间 */
  t.name = '人物二';
  const { n, 话 } = await 问答(沙, t, 1);
  const 后 = await 沙.Cards.get('c1');
  const idx = await 沙.DB.get('cards.idx', []);
  R.判('模板改名：卡的 tplName 跟着改口（卡里 = ' + 后.tplName + '，名单里 = ' + (idx[0] || {}).tplName + '），货架和搜索不会再挂老名字',
    后.tplName === '人物二' && (idx[0] || {}).tplName === '人物二', 后.tplName + ' / ' + (idx[0] || {}).tplName);
  R.判('那一句问话里把「改卡片类型名 1 张」也报了', /改卡片类型名 1 张/.test(话), 话);
  R.判('交回 ' + n + ' 张', n === 1, String(n));
  /* 对齐不许把「最近改动」刷到今天 */
  R.判('对齐那一趟不动「最近改动」：at 还是对齐前那一个 ' + 前 + '（不是 Date.now()）', 后.at === 前, 前 + ' → ' + 后.at);
}

/* ---------- 五、咬口 ---------- */
R.题('五、咬口（把承重那一句改坏，判法必须不过）');
{
  /* 咬口一：把「模板不带可信编号就不删」那一道闸拿掉 → 导入覆盖那一路会把卡里填过的字清空 */
  const 坏一 = 拼.replace('if(能删 && it.fid && !号在.has(it.fid)){', 'if(it.fid && !号在.has(it.fid)){');
  if(坏一 === 拼) R.判('咬口一没咬到：源码里找不到那道「能删」闸', false, '');
  else {
    const 沙 = 台(坏一);
    const t = 模板(); t.groups.forEach(g => g.items.forEach(f => { delete f.id; }));
    const c = 卡(模板());
    const r = 沙.alignToTpl(c, t);
    R.判('咬口一：拿掉「能删」那道闸之后，导入覆盖那一路真把卡里的格删光了（删掉 ' + r.删掉 + ' 处）',
      r.删掉 >= 2, JSON.stringify(r));
  }
  /* 咬口二：把 syncFromTpl 里「答 not 就返回」那一句拿掉 → 选「只改模板」也会动卡 */
  const 坏二 = 拼.replace('if(r !== \'yes\') return 0;', '');
  if(坏二 === 拼) R.判('咬口二没咬到：源码里找不到那一句「if(r !== \'yes\') return 0;」', false, '');
  else {
    const t = 模板(), c = 卡(t);
    const 沙 = 台(坏二); await 铺(沙, t, c);
    const t2 = (await 沙.DB.get('cardtpl', []))[0]; t2.groups[0].items[0].name = '名字X';
    await 问答(沙, t2, 0);        /* 答「只改模板」 */
    const 后 = await 沙.Cards.get('c1');
    R.判('咬口二：拿掉那一句之后，答「只改模板」卡里那一格照样被改了（' + 后.groups[0].items[0].name + '）',
      后.groups[0].items[0].name === '名字X', 后.groups[0].items[0].name);
  }
}

R.收尾();
