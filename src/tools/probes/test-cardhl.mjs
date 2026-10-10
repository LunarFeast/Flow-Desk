/* 外30 乙组 · 图8 图9：「卡片高亮没有响应，也没有统计出场次数」—— 先把这两条的算法层量清楚。
   切真源码：CardHl（名单、按章缓存的正则、spans、pending）、Occur（三档响应的账、按章指纹缓存、
   那一格数字的填法）、occNum / occHits / chips / oneLine、Cards 那几颗读写、cleanText / parasCount。
   边界替身：IndexedDB（mkKv）、State（权重那份）、Work（书与章的读法，这一台给一本两章的假书）。 */
import vm from 'node:vm';
import { rd, 切, 切方法, 记账 } from './lib-slice.mjs';

const R = 记账('test-cardhl');
const W7 = rd('src/_wnw/src/w7-data.js');
const W8 = rd('src/_wnw/src/w8-write.js');
const W10 = rd('src/_wnw/src/w10-cards.js');
const C7 = W7.indexOf('const Cards = {');
const 界 = (src, 起) => { const n = src.indexOf('\nconst ', 起), k = src.indexOf('\nclass ', 起);
  return [n, k].filter(x => x > 起).sort((a, b) => a - b)[0] || src.length; };
const 止7 = 界(W7, C7);
const 卡法 = ['  async get(id){', '  async put(c, keepAt){', '  async index(c){', '  async all(){',
  '  async forBook(bid){'].map(头 => 切方法(W7, 头, C7, 止7));

const 拼 = `
${切(W7, 'DB')}
${切(W7, 'delRanges')}
${切(W7, 'cleanText')}
${切(W10, 'oneLine')}
${切(W10, 'chips')}
${切(W10, 'occNum')}
${切(W10, 'occHits')}
${切(W10, 'occW').replace(/^/, '')}
${切(W8, 'hlCss')}          /* 卡自己钉的外观（外37 那条「要一个设定自动高亮的外观的入口」）现算在这一颗上 */
${切(W10, 'CardHl')}
${切(W10, 'Occur')}
const Cards = {
${卡法.join(',\n')}
};
this.件 = { DB, Cards, CardHl, Occur, occNum, occHits, cleanText };
`;

const 替 = `
var 库表 = new Map();
async function mkKv(){ return { kind:'idb',
  async get(k){ return 库表.has(k) ? JSON.parse(库表.get(k)) : undefined; },
  async put(k, v){ 库表.set(k, JSON.stringify(v)); return true; },
  async del(k){ 库表.delete(k); },
  async keys(pre){ return [...库表.keys()].filter(k => !pre || k.startsWith(pre)); } }; }
var Storage = { warn(){} };
var toast = m => { 报话.push(String(m)); };
var 报话 = [];
var Bus = { emit(){}, on(){ return () => {}; } };
var State = { 表:{}, async get(k, d){ return this.表[k] === undefined ? d : this.表[k]; }, async set(k, v){ this.表[k] = v; } };
function h(标记, at, kids){ const el = { 标记, at:at || {}, kids:[], textContent:(at && at.title !== undefined) ? '' : '',
  isConnected:true, appendChild(x){ this.kids.push(x); return x; },
  set innerHTML(v){ if(v === ''){ this.kids = []; this.textContent = ''; } } };
  if(typeof kids === 'string') el.textContent = kids;
  else for(const x of (kids === undefined ? [] : (Array.isArray(kids) ? kids : [kids]))) if(x) el.appendChild(x);
  return el; }
var confirm = () => true;
var Phrase = { out:s => String(s) };
/* 扫描那一趟每十二张要让一拍（外37 那条「名字框要等一下才打得进字」），这一台要数它让了几回：
   让拍记数，回调排到微任务里跑，整条链靠 await 自己走完，不用额外泵。 */
var 拍 = 0;
function setTimeout(fn){ 拍++; Promise.resolve().then(fn); return 拍; }
function clearTimeout(){}
/* 一本两章的假书：Work 这一头是边界（真身要读盘、算字数、管卷），这一台只管章正文 */
var 章 = {}; var 这 = { 序:2000 };
var Work = {
  book:{ id:'b1', title:'测试书', chs:[{ id:'ch1', title:'第一章', at:1 }, { id:'ch2', title:'第二章', at:1 }] },
  async ch(id){ return 章[id] || null; },
  setCh(id, c){ if(!c.at) c.at = ++这.序; 章[id] = c; const m = this.book.chs.find(x => x.id === id); if(m) m.at = c.at; return c; }
};
`;

const 静 = async (n = 40) => { for(let i = 0; i < n; i++) await Promise.resolve(); };
function 台(码){
  const 沙 = {}; vm.createContext(沙);
  vm.runInContext(替, 沙); vm.runInContext(码 || 拼, 沙);
  Object.assign(沙, 沙.件);
  return 沙;
}
async function 建卡(沙, id, 名, resp, 多){
  await 沙.Cards.put({ id, bookId:'b1', tpl:'', tplName:'空白', title:名, aliases:多 || [], at:1, created:1,
    groups:[], color:'', tags:[], resp, links:[], ok:{} });
  await 静();
}
var 序 = 1000;
/* 带 /g 的正则 test 一次会把 lastIndex 往前挪（真身画正文走的是 replace，不受这个影响），
   这一台要连测好几句，所以每次先把 lastIndex 归零 */
function 认(re, 文){ re.lastIndex = 0; return re.test(文); }
function 章文(...段){ return { at:++序, paras:段.map(t => ({ id:'p' + Math.random(), t, cards:[] })) }; }

/* ---------- 一、出场次数：三档响应各数的是什么 ---------- */
R.题('一、Occur 三档响应的账');
{
  const 沙 = 台();
  沙.Work.setCh('ch1', 章文('主角结交了一个人，叫白衣。', '白衣转身走了。'));
  沙.Work.setCh('ch2', 章文('第二章里没有这个人。'));
  await 建卡(沙, 'k1', '白衣', 'high');
  await 建卡(沙, 'k2', '宝珠', 'high');
  await 建卡(沙, 'k3', '洞天福地', 'mid');
  await 建卡(沙, 'k4', '老张', 'low', ['张三']);
  const rows = await 沙.Occur.load();
  R.判('高响应「白衣」在两章正文里出现 2 次 → 出场次数 ' + rows.get('k1').v + '（×1 固定）', rows.get('k1').v === 2, JSON.stringify(rows.get('k1')));
  R.判('高响应「宝珠」一次没出现 → 0', rows.get('k2').v === 0, JSON.stringify(rows.get('k2')));
  R.判('中响应「洞天福地」没点过「亮」→ 0（点了才算，这一趟没点）', rows.get('k3').v === 0, JSON.stringify(rows.get('k3')));
  R.判('低响应「老张」没有手动关联 → 0', rows.get('k4').v === 0, JSON.stringify(rows.get('k4')));
  R.数('界面那一格交回的字', 沙.Occur.cell('k1', 'b1').textContent + ' → 等一会儿 ' + (await 静(), ''));
  /* 缓存：章没改就不重扫 */
  const 扫过 = [];
  const 原 = 沙.Occur.scan.bind(沙.Occur);
  沙.Occur.scan = (b, s) => { 扫过.push(s); return 原(b, s); };
  await 沙.Occur.load(); await 沙.Occur.load();
  R.判('两章的 at 一个没动：再叫两次 load，一次都没重扫（重扫次数 ' + 扫过.length + '）', 扫过.length === 0, String(扫过.length));
  /* 改一章正文 → at 跟着动 → 下一次用到要重扫 */
  沙.Work.setCh('ch2', 章文('第二章里也请白衣坐了一回。'));
  const 前 = 沙.Occur.sig;
  const rows2 = await 沙.Occur.load();
  R.判('第二章添了一句「白衣」：指纹变了（' + (前 !== 沙.Occur.sig) + '），重扫之后「白衣」= ' + rows2.get('k1').v + ' 次',
    前 !== 沙.Occur.sig && rows2.get('k1').v === 3, 前 + ' → ' + 沙.Occur.sig + ' / ' + JSON.stringify(rows2.get('k1')));
}

/* ---------- 二、中响应点过「亮」的那几章 + 权重 ---------- */
R.题('二、中响应与权重');
{
  const 沙 = 台();
  沙.Work.setCh('ch1', 章文('白衣在这里，白衣也在这里。'));
  沙.Work.setCh('ch2', 章文('白衣在第二章也露了一次面。'));
  await 建卡(沙, 'k3', '洞天福地', 'mid');
  await 建卡(沙, 'k1', '白衣', 'mid');
  const c = await 沙.Cards.get('k1'); c.ok = { ch1:true }; await 沙.Cards.put(c); await 静();
  await 沙.State.set('occur.mid', 0.5);
  const rows = await 沙.Occur.load();
  R.判('中响应只认点过「亮」的那一章：第一章 2 次 × 权重 0.5 = ' + rows.get('k1').v, rows.get('k1').v === 1, JSON.stringify(rows.get('k1')));
  const 卡 = await 沙.Cards.get('k1'); 卡.ok = { ch1:true, ch2:true }; await 沙.Cards.put(卡); await 静();
  const rows2 = await 沙.Occur.load();
  R.判('第二章也点上「亮」：3 次 × 0.5 = ' + rows2.get('k1').v, rows2.get('k1').v === 1.5, JSON.stringify(rows2.get('k1')));
  await 沙.State.set('occur.mid', 1);
  await 沙.Occur.reweigh();
  R.判('权重滑到 1：不重扫正文，账直接换算成 3 次（' + 沙.Occur.rows.get('k1').v + '）', 沙.Occur.rows.get('k1').v === 3, JSON.stringify(沙.Occur.rows.get('k1')));
  /* pending：中响应出现了但没问过的章 */
  const 沙2 = 台(); 沙2.Work.setCh('ch1', 章文('白衣白衣白衣')); await 建卡(沙2, 'k1', '白衣', 'mid');
  await 沙2.CardHl.sync();
  const p = 沙2.CardHl.pending('ch1', '白衣白衣白衣');
  R.判('中响应「本章出现 3 次、还没问过」的那一句问得出来（' + (p[0] ? p[0].n + ' 次' : '问不出') + '）',
    p.length === 1 && p[0].n === 3, JSON.stringify(p.map(x => x.card.title + ':' + x.n)));
}

/* ---------- 三、高亮：spans 到底亮不亮 ---------- */
R.题('三、CardHl.spans 高亮');
{
  const 沙 = 台();
  await 建卡(沙, 'k1', '白衣', 'high', ['白袍人']);
  await 建卡(沙, 'k2', '宝珠', 'high');
  await 沙.CardHl.sync();
  const 排 = 沙.CardHl.spans('ch1', null);
  const 一 = 排.find(x => x.card === 'k1');
  R.判('两张高响应卡各给一条正则（本章 ' + 排.length + ' 条），「白衣」那一条带着别名两个词', 排.length === 2 && !!一 && !!一.re, JSON.stringify(排.map(x => x.card)));
  const 文 = '主角结交了一个人，叫白衣。';
  const 中 = 认(一.re, 文);
  R.判('那一条正则真认得「' + 文 + '」里的「白衣」', 中, String(中));
  /* 卡改了名：指纹变了 → 缓存重算 */
  const 卡 = await 沙.Cards.get('k1'); 卡.title = '白衣人'; await 沙.Cards.put(卡); await 静();
  await 沙.CardHl.sync();
  const 排2 = 沙.CardHl.spans('ch1', null);
  const 二 = 排2.find(x => x.card === 'k1');
  R.判('卡改名之后：新的名字认得到（「白衣人来了」= ' + 认(二.re, '白衣人来了') + '），光秃秃的「他穿白衣」不再算这一条',
    认(二.re, '白衣人来了') === true && 认(二.re, '他穿白衣') === false, JSON.stringify(排2.map(x => x.card)));
  /* 别名添上：同一趟里也要认 */
  const 卡2 = await 沙.Cards.get('k1'); 卡2.aliases = ['白袍客']; await 沙.Cards.put(卡2); await 静();
  await 沙.CardHl.sync();
  const 排3 = 沙.CardHl.spans('ch1', null);
  const 三 = 排3.find(x => x.card === 'k1');
  R.判('卡上添了别名：当场两条都认（白袍客 = ' + 认(三.re, '那白袍客走了') + '，白衣人 = ' + 认(三.re, '白衣人来了') + '）',
    认(三.re, '那白袍客走了') && 认(三.re, '白衣人来了'), JSON.stringify(排3.map(x => x.card)));
  /* 段上挂卡（低响应也算） */
  const 沙4 = 台(); await 建卡(沙4, 'k4', '老张', 'low');
  沙4.Work.setCh('ch1', { at:1, paras:[{ id:'p1', t:'老张来了', cards:['k4'] }] });
  await 沙4.CardHl.sync();
  const 段 = { id:'p1', t:'老张来了', cards:['k4'] };
  const 排4 = 沙4.CardHl.spans('ch1', 段);
  R.判('低响应卡：平时不亮，这一段自己挂了它 → 这一条照样给（' + 排4.length + ' 条）',
    排4.length === 1 && 排4[0].card === 'k4', JSON.stringify(排4.map(x => x.card)));
  const 账4 = await 沙4.Occur.load();
  R.判('挂卡的段在出场次数里各加一笔（低响应没有正文那一份，只这一笔）：' + 账4.get('k4').v, 账4.get('k4').v === 1,
    JSON.stringify(账4.get('k4')));
  /* ---------- 外37：卡自己钉的「外观」（作者原话「需要一个设定自动高亮的外观的入口，就像规则高亮的外观设定那样」） ---------- */
  const 沙5 = 台(); await 建卡(沙5, 'k5', '前辈', 'high');
  await 沙5.CardHl.sync();
  const 裸 = 沙5.CardHl.spans('ch1', null).find(x => x.card === 'k5');
  R.判('没钉外观的卡：交出去的那一条不带内联样式（正文里吃 hl-N 那个标记色）· 实际 ' + JSON.stringify(裸.css),
    裸.css === '' && !!裸.cls && /^hl-\d+$/.test(裸.cls), JSON.stringify(裸));
  const 卡5 = await 沙5.Cards.get('k5');
  卡5.st = { c:'#6b21a8', w:'600', i:false, f:'', r:8, p:[2,6,2,6],
    bg:{ k:'solid', c:'#f3e8ff', g:[], a:14 }, bd:{ s:'solid', w:1, c:'#e9d5ff' }, ul:{ s:'', c:'' } };
  await 沙5.Cards.put(卡5); await 静();
  await 沙5.CardHl.sync();
  const 钉 = 沙5.CardHl.spans('ch1', null).find(x => x.card === 'k5');
  R.判('卡上钉了外观：只改这一处、卡名一个字没动，CardHl 那份指纹就认（重算出来带样式的一条）',
    !!钉.css && 钉.cls === 裸.cls, JSON.stringify(钉));
  R.判('那串样式是照 规则高亮 同一把尺算出来的（color / 字重 / 底色 / 边框 / 圆角 都在）：' + 钉.css,
    /color:#6b21a8/.test(钉.css) && /font-weight:600/.test(钉.css) && /background:#f3e8ff/.test(钉.css) &&
    /border:1px solid #e9d5ff/.test(钉.css) && /border-radius:8px/.test(钉.css));
  const 段5 = 沙5.CardHl.paraSpans({ id:'p1', t:'前辈', cards:['k5'] });
  R.判('手动挂到段上的同一条：也带这份外观（两条路一个口径）：' + 段5[0].css,
    段5.length === 1 && 段5[0].css === 钉.css, JSON.stringify(段5));
  const 卡5b = await 沙5.Cards.get('k5'); 卡5b.st = null; await 沙5.Cards.put(卡5b); await 静();
  await 沙5.CardHl.sync();
  R.判('按「跟色位」把这一笔撤掉：又回到不带内联样式（和没钉过一模一样）',
    沙5.CardHl.spans('ch1', null).find(x => x.card === 'k5').css === '');
  R.判('卡片面板上那一颗「外观」走的是 规则高亮 同一只口（hlStyleDlg），只是存的对方换成这张卡',
    /this\.hlBox\(\)/.test(W10) && /hlStyleDlg\(/.test(W10) && /set st\(v\)\{ c\.st = v; \}/.test(W10));
  R.判('那只口收得到「存到哪儿」（第三个参数），设置·高亮 那一头没传就还是存进 WriteCfg',
    /function hlStyleDlg\(r, onDone, save\)/.test(W8) && /const 存 = save \|\| \(\(\) => WriteCfg\.save\(\)\);/.test(W8) &&
    /hlStyleDlg\(r, drawHl\)/.test(rd('src/_wnw/src/w3-shell.js')));
  R.判('正文那一头接得住：卡给的这一串走的是 WriteCfg.spans 的 extra 那一路，css 要跟着一起递（不递就死在半路）',
    /cls:e\.cls, card:e\.card, css:e\.css/.test(W8));
}

/* ---------- 四、量到的是哪一层：界面上那一格什么时候填数 ---------- */
R.题('四、那一格数字的填法');
{
  const 沙 = 台();
  沙.Work.setCh('ch1', 章文('白衣出现了一次。')); 沙.Work.setCh('ch2', 章文('这里没有。'));
  await 建卡(沙, 'k1', '白衣', 'high');
  const 格 = 沙.Occur.cell('k1', 'b1');
  R.判('刚造出来那一格是「·」（不是假数字 0）：' + 格.textContent, 格.textContent === '·', 格.textContent);
  await 静(60);
  R.判('扫到之后当场填成真的数：' + 格.textContent, 格.textContent === '1', 格.textContent);
  /* 卡换了别的书的：给横杠不给 0 */
  const 他 = 沙.Occur.cell('k1', 'b2');
  R.判('别的书来的卡：那一格是横杠（不做跨书累加）', 他.textContent === '—', 他.textContent);
  /* 正文一改，重画那一格：paint 只认还挂在屏上的 */
  沙.Work.setCh('ch1', 章文('白衣白衣。'));
  await 沙.Occur.load();
  R.判('正文添了一次「白衣」：重扫之后那一格跟着变成 ' + 格.textContent, 格.textContent === '2', 格.textContent);
}

/* ---------- 四b、图9 的根：正文改了之后新开的那一格不许摆旧数 ---------- */
R.题('四b、图9 的根：cached 着一份旧 rows 也要重扫');
{
  const 沙 = 台();
  沙.Work.setCh('ch1', 章文('白衣出现了一次。')); 沙.Work.setCh('ch2', 章文('这里没有。'));
  await 建卡(沙, 'k1', '白衣', 'high');
  const 甲 = 沙.Occur.cell('k1', 'b1');
  await 静(60);
  R.判('第一格：扫到 ' + 甲.textContent, 甲.textContent === '1', 甲.textContent);
  /* 正文又写了一个「白衣」，章的 at 跟着动（真身里 saveCh 就是这么改的） */
  沙.Work.setCh('ch1', 章文('白衣出现了一次，白衣又来了一次。'));
  const 乙 = 沙.Occur.cell('k1', 'b1');
  await 静(60);
  R.判('改完正文再开一屏：那一格走的是重扫之后的数（' + 乙.textContent + '），不是手里 cached 的那份旧账',
    乙.textContent === '2', 乙.textContent);
  R.判('先前挂在屏上的那一格也一起跟着改（load 算完自己 paint，不用把整列重画）：' + 甲.textContent,
    甲.textContent === '2', 甲.textContent);
  /* 没改正文：再来一格不该重扫（load 里那一道指纹得挡住） */
  const 扫过 = [];
  const 原 = 沙.Occur.scan.bind(沙.Occur);
  沙.Occur.scan = (b, s) => { 扫过.push(s); return 原(b, s); };
  沙.Occur.cell('k1', 'b1'); await 静(60);
  R.判('一个字没改再开一屏：一次都不重扫（重扫 ' + 扫过.length + ' 次）', 扫过.length === 0, String(扫过.length));
}

/* ---------- 五、咬口 ---------- */
/* ---------- 五、半路被顶掉的那一趟（外37「新建卡片那个名字那里会卡…有时候好不了」） ---------- */
R.题('五、Occur 半路作废：不把半截数当成品，一张一张让拍出');
{
  const 字 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const 名 = j => '白衣' + 字[j];      /* 名字之间不能互相包含（白衣1 是 白衣10 的一半，数出来会翻倍） */
  const 段文 = i => Array.from({ length:26 }, (x, j) => 名(j) + '走过第 ' + i + ' 章。').join('');
  const 装书 = 沙 => { for(let i = 1; i <= 20; i++){
    沙.Work.book.chs.push({ id:'c' + i, title:'第' + i + '章', at:i });
    沙.Work.setCh('c' + i, 章文(段文(i)));
  } };
  const 卡数 = 26;
  {
    const 沙 = 台(); 装书(沙);
    for(let j = 0; j < 卡数; j++) await 建卡(沙, 'k' + j, 名(j), 'high');
    /* 读到第六章那一刻，别处改了一张卡（指纹跟着变）—— 这一趟就该作废，不能把数到一半的账交出去 */
    let 读 = 0; const 原读 = 沙.Work.ch.bind(沙.Work);
    沙.Work.ch = async id => { const c = await 原读(id); if(++读 === 6) 沙.Occur.sig = '被人改过'; return c; };
    const 拍0 = 沙.拍;
    const rows = await 沙.Occur.load();
    R.数('作废之后重跑：一共读了几个章次 / 让出几拍', 读 + ' ｜ ' + (沙.拍 - 拍0));
    R.判('半路作废的那一趟自己按新指纹重跑：二十六张卡各数满二十章（白衣A = ' + rows.get('k0').v + '）',
      rows.get('k0').v === 20 && rows.get('k' + (卡数 - 1)).v === 20, JSON.stringify(rows.get('k0')));
    R.判('只多跑了一趟（头一趟读到第六章作废、第二趟走完），不是每一格各扫一遍全书（那样要 ' + 卡数 * 20 + ' 次）',
      读 <= 46, '读了 ' + 读 + ' 个章次');
    R.判('二十六张卡 × 全书文本不是一整块跑完：每十二张让出一拍（走满的那一趟让了 ' + (沙.拍 - 拍0) + ' 回）', 沙.拍 - 拍0 >= 1);
    R.判('作废那一趟也把读进来的章退干净（不留整本书压在内存上）', (() => {
      const 留 = [...沙.DB.mem.keys()].filter(k => k.startsWith('book.b1.ch.')).length;
      R.数('这一趟跑完还留在内存里的章', 留); return 留 === 0; })());
  }
  /* 咬口：把「作废就重跑」改回「半截数也当成品」—— 那一格就该停在数到一半的账上 */
  const 拼旧 = 拼.replace('{ 退(); return null; }', '{ 退(); return out; }');
  if(拼旧 === 拼) throw new Error('咬口没抓到那一句（scan 里作废那两行的写法改了，这台要跟着改）');
  {
    const 沙旧 = 台(拼旧); 装书(沙旧);
    for(let j = 0; j < 卡数; j++) await 建卡(沙旧, 'k' + j, 名(j), 'high');
    let 读旧 = 0; const 原旧 = 沙旧.Work.ch.bind(沙旧.Work);
    沙旧.Work.ch = async id => { const c = await 原旧(id); if(++读旧 === 6) 沙旧.Occur.sig = '被人改过'; return c; };
    const 半 = await 沙旧.Occur.load();
    const 半1 = 半.get('k0');
    R.判('咬口过：半截数一旦当成品，那一格就交回一个数不满的账（' + (半1 ? 半1.v : '这一笔干脆没有') +
      ' 而不是 20），而且指纹已经对上、往后每一格都拿它交差 —— 这就是「有时候好不了」',
      !半1 || 半1.v !== 20, JSON.stringify(半1));
  }
}

R.题('六、咬口（把承重那一句改坏，判法必须不过）');
{
  /* 咬口一：sigOf 不看章的 at（正文改了不重扫）→ 第三条的「重扫之后 3 次」必须不过 */
  const 坏一 = 拼.replace("(b.chs || []).map(c => c.id + ':' + (c.at || 0)).join('|')", "(b.chs || []).map(c => c.id).join('|')");
  if(坏一 === 拼) R.判('咬口一没咬到：找不到那一句指纹', false, '');
  else {
    const 沙 = 台(坏一);
    沙.Work.setCh('ch1', 章文('白衣。')); 沙.Work.setCh('ch2', 章文('这里没有。'));
    await 建卡(沙, 'k1', '白衣', 'high');
    const a = await 沙.Occur.load();
    沙.Work.setCh('ch2', 章文('白衣又来了。'));
    const b = await 沙.Occur.load();
    R.判('咬口一：指纹里不看章的 at，正文改了不重扫（第一次 ' + a.get('k1').v + '，第二次还是 ' + b.get('k1').v + '，量到的应当是 2）',
      b.get('k1').v === 1, String(b.get('k1').v));
  }
  /* 咬口二：高响应那一档不数正文（拿 links 顶）→ 第一条必须不过 */
  const 坏二 = 拼.replace("else n = per.reduce((a, x) => a + occHits(x.text, re), 0);", 'else n = 0;');
  if(坏二 === 拼) R.判('咬口二没咬到：找不到高响应那一句', false, '');
  else {
    const 沙 = 台(坏二);
    沙.Work.setCh('ch1', 章文('白衣。白衣。'));
    await 建卡(沙, 'k1', '白衣', 'high');
    const rows = await 沙.Occur.load();
    R.判('咬口二：高响应不数正文之后，出现两次也报 0（' + rows.get('k1').v + '）', rows.get('k1').v === 0, String(rows.get('k1').v));
  }
  /* 咬口三：把「那一格先比对指纹」退回「手里有 rows 就直接填」→ 四b 必须不过（这就是图9 的根） */
  const 坏三 = 拼.replace('const 鲜 = this.rows && cur && this.book === cur && this.sig === this.sigOf(Work.book);',
    'const 鲜 = !!this.rows;');
  if(坏三 === 拼) R.判('咬口三没咬到：找不到那一句比对指纹', false, '');
  else {
    const 沙 = 台(坏三);
    沙.Work.setCh('ch1', 章文('白衣出现了一次。'));
    await 建卡(沙, 'k1', '白衣', 'high');
    沙.Occur.cell('k1', 'b1'); await 静(60);
    沙.Work.setCh('ch1', 章文('白衣白衣。'));
    const 格 = 沙.Occur.cell('k1', 'b1'); await 静(60);
    R.判('咬口三：退回「有缓存就直接填」之后，改完正文再开一屏还是旧数（' + 格.textContent + '，应当是 2）',
      格.textContent === '1', 格.textContent);
  }
}

R.收尾();
