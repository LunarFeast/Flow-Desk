/* 外32 图6 自检：整本导入 —— 一份 txt / md 摊成卷章结构。
   作者的话：「增加整本导入，识别 txt 文档中的卷标题和章节标题，按卷章结构导入」。
   ----------
   这一台把三份真源码搬进虚拟机跑：认标题那一只手（BookImport.head/split/parse）和建结构那一只手
   （BookImport.into/clearSeed），用的就是页面里那一份，不抄第二份；序号格式表吃的是 w14 那张 Seq，
   字数口径吃的是 w7 那一份 wordCount。界面那一半（那一屏统计、那两枚落点）另开探针浏览器点。 */
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = 'D:/Programs/Flow-Desk/';
const rd = p => fs.readFileSync(ROOT + p, 'utf8');
const W7 = rd('src/_wnw/src/w7-data.js');
const W14 = rd('src/_wnw/src/w14-num.js');
const W16 = rd('src/_wnw/src/w16-export.js');
const W8 = rd('src/_wnw/src/w8-write.js');
const W9 = rd('src/_wnw/src/w9-shelf.js');

function tillBrace(src, head){
  const i = src.indexOf(head); if(i < 0) throw new Error('源码里找不到「' + head + '」');
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
function seg(src, a, b){
  const i = src.indexOf(a), j = src.indexOf(b, i);
  if(i < 0 || j < 0) throw new Error('源码里圈不出那一段：' + a + ' → ' + b);
  return src.slice(i, j);
}

const SRC = [
  seg(W7, 'function uid(p)', 'const pad2'),
  seg(W7, 'const HAN_RE', 'function chWords'),
  seg(W7, 'function chWords', '/* 列表里只有目录那一份'),
  seg(W7, 'function newPara', '/* 秒 → 1:23:45'),
  seg(W7, 'function delRanges', '/* 原文下标'),
  seg(W14, 'const CN_D', 'function cnParse'),
  seg(W14, 'function cnParse', '/* ---------- 二、格式表'),
  seg(W14, 'const SEQ_PRESET', 'const Seq = {'),
  tillBrace(W14, 'const Seq = {'),
  seg(W16, 'const BI_MAXLEN', 'const BookImport = {'),
  tillBrace(W16, 'const BookImport = {'),
  '\nthis.__x = { BookImport, Seq, SEQ_PRESET, wordCount, parasCount, paraCount };'
].join('\n');

const sb = { console, JSON, Math, Date, Number, String, Array, Object, Boolean, RegExp, Error, Promise,
  isNaN, parseInt, parseFloat, setTimeout, TextDecoder,
  /* 页面那几件宿主东西的替身：这一台只走认标题和建结构，界面那三件挂了名字就用不到 */
  DB:{ put:async (k, v) => { sb.__w.put++; sb.__w.docs.push({ k, v }); }, del:async (k) => { sb.__w.del++; sb.__w.gone.push(k); } },
  Shelf:{ create:async () => { throw new Error('这一台不碰建书那一步'); } },
  Work:{}, Overlay:{}, Shell:{}, h:() => { throw new Error('界面那一只手不在这一台里跑'); }, toast:() => {},
  __w:{ put:0, del:0, docs:[], gone:[] } };
vm.createContext(sb);
vm.runInContext(SRC, sb);
const X = vm.runInContext('__x', sb);
const BI = X.BookImport;

let pass = 0, fail = 0;
const ok = (n, c, extra) => { if(c){ pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (extra ? ' · ' + extra : '')); } };

/* ---------- 一、一份典型网文：两卷四章，中间混着四行"看着像标题"的正文 ---------- */
const TXT = [
  '　　这是开头的一段，那时候还没到第一章。',
  '',
  '第一卷 风起',
  '第一章 少年',
  '　　那天他十六岁。',
  '第一部他看了三遍。',
  '第一部他看了三遍',
  '第三天，他上了山。',
  '3. 然后他走了',
  '第二章',
  '　　山下的灯亮着。',
  '第二卷 潮落',
  '第12章 归途',
  '　　他回来了。',
  '　　又一轮日头。'
].join('\r\n');            /* 故意给 CRLF：Windows 记事本那份就是这种行尾 */
const t = BI.parse(TXT);
const titles = g => g.map(x => x.title).join('|');
const 头一章名 = t.groups.map(g => g.chs.map(c => c.title).join('/')).join(' ‖ ');
ok('1 认卷：' + t.vol + ' 个卷标题，名字原样留着（"' + titles(t.groups) + '"）',
  t.vol === 2 && titles(t.groups) === '第一卷 风起|第二卷 潮落');
ok('2 认章：' + t.ch + ' 个章节标题，光有「第二章」三个字不带名字的也认（各组章名：' + 头一章名 + '）',
  t.ch === 3 && 头一章名 === '/第一章 少年/第二章 ‖ 第12章 归途');
ok('3 正文 ' + t.lines + ' 段：空行只当分段不进正文，行首那两个全角空格剥掉了，CRLF 也吃得下',
  t.lines === 9 && t.groups[0].chs[1].lines[0] === '那天他十六岁。' && t.groups[1].chs[0].lines.length === 2);
ok('4 「第一部他看了三遍」没被当成卷标题（序号后面紧接着说话的那种不算）—— 卷数还是 ' + t.vol,
  t.vol === 2 && t.lines === 9);
ok('5 「第三天，他上了山。」「第一部他看了三遍。」结尾带句读，一律算正文',
  t.vol === 2 && t.ch === 3);
ok('6 有「第X章」可认的时候，「3. 然后他走了」这一类光秃秃的编号不算章（第二轮没启用）',
  t.weak === false && t.ch === 3);
ok('7 开头那 ' + t.leadN + ' 段没归到任何一章：认出来了（lead=' + t.lead + '），章名留空等人在那一屏给一个；' +
   '这本书有卷，所以它并进了第一卷的头一列，不在根上单挂一章',
  t.lead === true && t.leadN === 1 && t.groups[0].chs[0].title === '' && t.groups.length === 2);
/* 字数按页面里那一把尺现算一遍对数：只算那 9 行正文，标题那一行都不该掺进来 */
const 正文九行 = ['这是开头的一段，那时候还没到第一章。', '那天他十六岁。', '第一部他看了三遍。',
  '第一部他看了三遍', '第三天，他上了山。', '3. 然后他走了', '山下的灯亮着。', '他回来了。', '又一轮日头。'];
const 应得 = 正文九行.reduce((s, x) => s + X.wordCount(x), 0);
ok('8 字数吃的是全站那一个口径（Word 那一套）：' + t.w + ' 字，与这 9 行正文一行行算出来的 ' + 应得 + ' 对得上（标题不计字）',
  t.w === 应得 && 应得 === 75);

/* ---------- 二、只有「1. 标题」这一类编号的一份：这才轮到第二轮那张格式 ---------- */
const DOT = ['1. 起风', '正文甲', '2. 落雨', '正文乙'].join('\n');
const d = BI.parse(DOT);
ok('9 一份只有「1. 标题」这种编号的：第二轮认出了 ' + d.ch + ' 章，并且报明认的是哪一类（weak=' + d.weak + '）',
  d.ch === 2 && d.weak === true && d.groups[0].chs.map(c => c.title).join('/') === '1. 起风/2. 落雨');

/* ---------- 三、一个标题都没有的一份：整份落成一章，不硬猜 ---------- */
const FLAT = ['　　一段没有名字的正文。', '　　又一段。'].join('\n');
const f = BI.parse(FLAT);
ok('10 卷标题、章标题一个都没认出：' + f.ch + ' 章 ' + f.vol + ' 卷，整份归成一章，lead=' + f.lead,
  f.ch === 0 && f.vol === 0 && f.groups.length === 1 && f.groups[0].chs.length === 1 && f.groups[0].chs[0].lines.length === 2);

/* ---------- 四、整本导出那份 md 导回来：# 是书名、## 是卷、### 是章 ---------- */
const MD = ['# 北风书', '## 第一卷 风起', '### 第一章 少年', '　　那天他十六岁。',
  '### 第二章 归途', '　　他回来了。'].join('\n');
const m = BI.parse(MD);
ok('11 认自己导出那份 md：书名那一行进的是书名栏（"' + m.book + '"），' + m.vol + ' 卷 ' + m.ch + ' 章，' + m.lines + ' 段正文',
  m.book === '北风书' && m.vol === 1 && m.ch === 2 && m.lines === 2);

/* ---------- 五、建结构那一只手：卷、章、段落、字数各归各位 ---------- */
async function build(tree, b, lead){ return BI.into(b, tree, { lead }); }
const seedBook = () => ({ id:'b1', title:'书', vols:[], chs:[], daily:{} });
const b1 = seedBook();
const 存底 = sb.__w.docs.length;
const r1 = await build(t, b1, '前言');
const vids = b1.vols.map(v => v.id);
ok('12 建出来 ' + r1.av + ' 卷 ' + r1.ac + ' 章（这份是两卷三章加开头那一章），一卷一条、一章一条，章上记的 vid 对得上卷',
  r1.av === 2 && r1.ac === 4 && b1.vols.length === 2 && b1.chs.length === 4 &&
  b1.chs.slice(0, 3).every(c => c.vid === vids[0]) && b1.chs[3].vid === vids[1]);
const 四份 = sb.__w.docs.slice(存底).map(x => x.v);
const doc0 = 四份[1];
ok('13 每章存的那一份里，正文是一段一段的段落对象（有号、k 是 p、字原样）：第一章存了 ' + doc0.paras.length +
   ' 段，头一段是 "' + doc0.paras[0].t + '"；开头那一段落用了人给的那个章名（"' + b1.chs[0].title + '"），四章段数 ' +
   b1.chs.map(c => c.para).join('/'),
  doc0.paras.length === 5 && doc0.paras[0].k === 'p' && !!doc0.paras[0].id && doc0.paras[0].t === '那天他十六岁。' &&
  b1.chs[0].title === '前言' && b1.chs.map(c => c.para).join('/') === '1/5/1/2');
ok('14 章模式一律是写作（' + b1.chs.map(c => c.mode).join(',') + '），目录上带了字数、段数、时间戳',
  b1.chs.every(c => c.mode === 'write' && typeof c.w === 'number' && typeof c.para === 'number' && c.at > 0));
/* 目录上那两个数必须和存下去的段落对得上：拿页面里同一把尺（parasCount / paraCount）现算一遍 */
const 尺一样 = b1.chs.every((m2, i) => m2.w === X.parasCount(四份[i].paras).w &&
  m2.han === X.parasCount(四份[i].paras).han && m2.para === X.paraCount(四份[i].paras));
ok('15 目录上那份字数与段数是从存的段落现算的（不是估的）：四章段数 ' +
   b1.chs.map(c => c.para).join('/') + ' 与各章存的 ' + 四份.map(c => c.paras.length).join('/') + ' 段一致', 尺一样);

/* 并进一本已有的书：原来的卷章一个字不动，新书状态也不改 */
const b2 = { id:'b2', title:'旧书', vols:[{ id:'vold', title:'旧卷', desc:'', collapsed:false }],
  chs:[{ id:'cold', vid:'vold', title:'旧第一章', mode:'write', han:3, w:3, para:1, at:1 }], daily:{}, novol:false };
const r2 = await build(f, b2, '补记');
ok('16 并进一本已有的书：旧那一卷还在（' + b2.vols.length + ' 卷），新章挂在它下面（vid=' +
   (b2.chs[1] && b2.chs[1].vid) + '），这本书的「不分卷」状态没被改（novol=' + b2.novol + '）',
  r2.av === 0 && b2.vols.length === 1 && b2.chs.length === 2 && b2.chs[1].vid === 'vold' && b2.novol === false);

/* 认不出卷标题、但认出了章的一份 + 新书：这才叫不分卷 */
const b3 = seedBook();
await build(d, b3, '前言');
ok('17 一份只有「1. 标题」的进到新书里：' + b3.chs.length + ' 章、一个卷都不建（vid 全空 = 不分卷）',
  b3.vols.length === 0 && b3.chs.length === 2 && b3.chs.every(c => c.vid === ''));

/* ---------- 六、新书出厂那一卷一章的空壳：只撤它自己那一对 ---------- */
const seeded = { id:'b9', title:'新书', vols:[{ id:'v9', title:'第一卷' }],
  chs:[{ id:'c9', vid:'v9', title:'第一章', mode:'write', han:0, w:0 }], daily:{} };
const wiped = await BI.clearSeed(seeded);
ok('18 出厂那一卷一章（那一张一个字没写）撤得掉：撤完卷 ' + seeded.vols.length + ' 条、章 ' + seeded.chs.length +
   ' 条，落盘那份也销了一笔（DB.del ' + sb.__w.del + ' 次）',
  wiped === true && seeded.vols.length === 0 && seeded.chs.length === 0 && sb.__w.del === 1);
const notSeed = { id:'b8', title:'写过两章的书', vols:[{ id:'v8', title:'第一卷' }],
  chs:[{ id:'c8', vid:'v8', title:'第一章', mode:'write', han:5, w:5 }, { id:'c7', vid:'v8', title:'第二章', mode:'write', han:1, w:1 }], daily:{} };
const before = sb.__w.del;
ok('19 写过字的、或者两卷两章的那种一本都不撤（这是撤掉别人家的东西，不是清壳）',
  (await BI.clearSeed(notSeed)) === false && notSeed.chs.length === 2 && sb.__w.del === before);

/* ---------- 七、编码：UTF-8 硬读不通才退 GBK，BOM 不吃进正文 ---------- */
const fileOf = bytes => ({ arrayBuffer:async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
const gbk = new Uint8Array([0xB5, 0xDA, 0xD2, 0xBB, 0xBE, 0xED]);      /* 「第一卷」的 GBK 六个字节 */
const g = await BI.read(fileOf(gbk));
ok('20 没 BOM 的 GBK 那份：UTF-8 硬读不通就退 GBK，认得出「第一卷」（读到 "' + (g.text || g.err) + '" · 按 ' + g.enc + '）',
  !g.err && g.enc === 'GBK' && g.text === '第一卷');
const bom = new Uint8Array([0xEF, 0xBB, 0xBF, 0xE7, 0xAC, 0xAC, 0xE4, 0xB8, 0x80, 0xE7, 0xAB, 0xA0]);  /* BOM + 「第一章」 */
const u = await BI.read(fileOf(bom));
ok('21 带 BOM 的 UTF-8：BOM 不当成正文第一个字（读到 "' + u.text + '" · 按 ' + u.enc + '）',
  !u.err && u.enc === 'UTF-8' && u.text === '第一章');
const junk = await BI.read(fileOf(new Uint8Array([0xFF, 0xFE, 0xFF, 0xFF, 0x80, 0x81])));
ok('22 两头都不是：给一句实话，不闷头把一堆方块字铺进正文', !!junk.err, JSON.stringify(junk));

/* ---------- 八、两个入口接没接上 ---------- */
const 导出处 = W8.indexOf("{ label:'整本导出', fn:() => BookExport.dlg('book') }");
const 导出处2 = W8.indexOf("{ label:'整本导入'");
ok('23 章节列表右上角那个 ⋮ 里，「整本导入」就排在「整本导出」后面（相隔 ' + (导出处2 - 导出处) + ' 个字），默认并进当前这本',
  导出处 > 0 && 导出处2 > 导出处 && 导出处2 - 导出处 < 400 && /BookImport\.pick\('here', draw\)/.test(W8));
ok('24 书架那一排的「整本导入」按的是这一排里常挂着的那一只挑文件口，空书架那一屏用的是临时那一枚，两条都走「另起一本」',
  /const impFile = BookImport\.field\('new'\);/.test(W9) && /onclick:\(\) => impFile\.click\(\)/.test(W9) &&
  /BookImport\.pick\('new'\)/.test(W9) && (W9.match(/整本导入/g) || []).length >= 2);
ok('25 导入这一摊住在导出那一份里（整本导出、整本导入同一家，不另起一份文件）：w16 里 BookExport 和 BookImport 都在，装配那份名单没动',
  /const BookExport = \{/.test(W16) && /const BookImport = \{/.test(W16) &&
  /\['w13-docx\.js', 'w16-export\.js', 'w6-boot\.js'\]|'w13-docx\.js', 'w16-export\.js', 'w6-boot\.js'/.test(rd('src/_wnw/build-kernel.mjs')));

/* ---------- 九、一千章往后的网文（作者 2026-10-09《全职高手》整本导入报的「识别有漏洞」） ----------
   那一本第三卷底下是 第1061章 我回来了 … 第1691章 终章，预览里整卷只剩一章、章名空着、一段数三千多 ——
   根子就在 head() 那一句「序号要在 1~999 之间」：1000 章往后的标题当场不算标题，正文全并成一块。 */
const 长篇 = ['第三卷  我回来了：重返联盟!'];
for(let n = 1061; n <= 1075; n++) 长篇.push('第' + n + '章  章节' + n, '　　这一章的正文，第 ' + n + ' 段。');
长篇.push('第三卷1691-终章', '　　收尾的一段。');
const 长 = BI.parse(长篇.join('\n'));
ok('26 一千章往后的章节标题也算标题（15 章认出 ' + 长.ch + ' 章，从前只认到 999 章）', 长.ch === 15, 长.ch);
ok('27 那一卷底下是 15 章，不是并成一章（预览里那一行写的就是章数）',
  长.groups[0].chs.length === 15, 长.groups.map(g => g.chs.length).join(','));
/* 他预览里那一行「第三卷1691-终章」是原文里真有的写法：它以「第三卷」开头，认卷这一档就把它算成一个卷标题。
   这一条钉的是「算成卷」这个现况，不是判它对不对 —— 要不要改口，得看他那份原文那一行到底怎么写的。 */
ok('27b 「第三卷1691-终章」这样以卷字开头的一行现在算一个卷标题（第二截 ' + (长.groups[1] || {chs:[]}).chs.length + ' 章）',
  长.groups.length === 2 && /终章/.test(长.groups[1].title), JSON.stringify(长.groups.map(g => g.title)));
ok('28 每一章都带着自己的章名（「没名字，上面那栏给一个」那一档一章都不该出现）',
  长.groups[0].chs.every(c => /第\d+章/.test(c.title)), JSON.stringify(长.groups[0].chs.slice(0, 2).map(c => c.title)));
ok('29 每章正文各 1 段，不再三千多段并成一块',
  长.groups[0].chs.every(c => c.lines.length === 1), 长.groups[0].chs.map(c => c.lines.length).join(','));
/* 上限抬上去以后，那两种容易切错的写法还得拦住：正文里「第1234567890个字」不算标题 */
const 野 = BI.split('第一章 正主\n　　他数到第98765432109个字才停。\n　　第123456789章 这不是标题，太长了。\n第二章 收尾', false);
ok('30 序号长到不像话的那一行仍然当正文（章数还是 2，不是 3）', 野.ch === 2, 野.ch);
ok('31 卷号那一头照旧收着（第一卷到第999卷算卷，第100000卷不算）',
  BI.head('第100000卷 太离谱', BI.forms().filter(g => g.kind === 'vol' && !g.weak)) === null &&
  !!BI.head('第999卷 还成', BI.forms().filter(g => g.kind === 'vol' && !g.weak)));
ok('32 留到第二轮才试的那一种（20. 标题）上限没跟着抬（弱格式还钉在 999）',
  BI.head('1200. 这一行不算标题', BI.forms().filter(g => g.weak)) === null);

console.log('\n' + pass + ' 过 ' + fail + ' 不过');
process.exit(fail ? 1 : 0);
