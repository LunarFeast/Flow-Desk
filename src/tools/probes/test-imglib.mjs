/* 外29 丁组 · 第 4 页「方案资源 · 图片」这一摊的自检（图片库 + 标记色收成只从色卡挑）
   作者的原话：「图片，有以下区分：导入时选择：按背景图导入（进入背景图图库，方案可在这里选背景）、
   按取色素材导入（只取颜色，颜色进入色卡）、按纹理/四方连续图导入（可以在方案中设置为纹理/四方连续图图片）」
   「为方案选择标记用颜色：色卡选色，此处只能选择」
   ----------
   这一台分三段：
     一、把 fd3-lib.js 里那份真 ImgLib（连同 LibYml / imgUseOf / imgKey / imgUrl / imgWallName / imgBlob）
         原样搬进 node:vm，拿假的文件层和假的图标表真跑：读、写、搬旧清单、改用途、划掉、名字闸。
     二、现场数源码：三颗导入按钮、旧那三件（texImport / texAccept / texRemove）和两个薄皮（TexLib / texKey）清零、
         标记色只剩一条路、第 4 页三块齐、恢复出厂带上间距、运行时那一头（main.cjs / fd-serve.mjs）收得到这一格。
     三、咬一口：把「旧纹理清单搬进新库」那一句改掉再跑第一段，第 4 条必须不过 —— 免得这条是个假断言。 */
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = 'D:/Programs/Flow-Desk/';
const rd = p => fs.readFileSync(ROOT + p, 'utf8');
const LIB = rd('src/_fd/src/fd3-lib.js');
const SHL = rd('src/_fd/src/fd3-shell.js');
const UI = rd('src/_fd/src/fd4-builtin.js');
const LOOK = rd('src/_shared/sh-look.js');
const MAIN = rd('src/pack/main.cjs');
const SERVE = rd('src/_fd/fd-serve.mjs');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if(c){ pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (extra ? ' · ' + extra : '')); } };

/* ---------- 一、真 ImgLib 进虚拟机 ---------- */
function tillBrace(src, head){
  const i = src.indexOf(head); if(i < 0) throw new Error('找不到 ' + head);
  let d = 0, j = src.indexOf('{', i);
  for(let k = j; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}'){ d--; if(!d) return src.slice(i, k + 1); } }
  throw new Error(head + ' 没配平');
}
const SLICES = [
  /^const IMG_FILE = .*$/m.exec(LIB)[0],
  /const IMG_USES = \[[\s\S]*?\];/.exec(LIB)[0],
  /const IMG_HEAD = \[[\s\S]*?\]\.join\('\\n'\);/.exec(LIB)[0],
  tillBrace(LIB, 'const LibYml = {'),
  tillBrace(LIB, 'function imgUseOf(v){'),
  tillBrace(LIB, 'function imgKey(file){'),
  tillBrace(LIB, 'function imgUrl(t){'),
  /^const imgBlobs = \{\};$/m.exec(LIB)[0],
  tillBrace(LIB, 'async function imgBlob(t){'),
  tillBrace(LIB, 'function imgWallName(nm){'),
  tillBrace(LIB, 'const ImgLib = {'),
  /* 外观层那头只要那一句赋值，真身 lookTexSet 在 sh-look.js —— 这里收它递过来的名单，数的是「喂进去几条」 */
  'let lookTexSet = v => { thisFed = v; fedCount++; };'
];
const SRC = name => SLICES.join('\n') + '\nthis.IMG_LIB = { ImgLib, LibYml, imgUseOf, imgKey, imgUrl, imgWallName, IMG_USES, IMG_FILE };';

/* 假的文件层 + 假的图标表：每次新开一个沙箱，互不脏。
   files 就是磁盘上那两份 yaml 的内容；ico 是图标那一层认到的那些名字。 */
function mkLib(files, ico, patch){
  let code = SRC('');
  for(const [from, to] of (patch || [])){
    if(!code.includes(from)) throw new Error('咬口没咬到：源码里没有这一段 —— ' + from.slice(0, 40));
    code = code.replace(from, to);
  }
  const sb = {
    console:{ warn(){}, log(){} },
    thisFed:null, fedCount:0,
    LibStore:{ files:Object.assign({}, files), puts:[],
      async fetchRaw(n){ return Object.prototype.hasOwnProperty.call(this.files, n) ? this.files[n] : null; },
      async putRaw(n, text){ this.files[n] = text; this.puts.push(n); return { ok:true }; } },
    Ico:{ table:Object.assign({}, ico), url(n){ return this.table[n] || ''; }, async reloadList(){} },
    Theme:{ apply(){}, cfg:{} }, Bus:{ emit(){} }, Shell:{ refreshSoon(){} },
    window:{ FD_APP:{ writePageBytes(p, b){ (sb.window.__written = sb.window.__written || []).push([p, b.length]); return Promise.resolve({ ok:true }); } } },
    fetch:async () => ({ json:async () => ({ ok:true }) }),
    setTimeout:(fn) => fn && 0, Uint8Array, Promise
  };
  vm.createContext(sb);
  vm.runInContext(code.replace('thisFed = v', 'sbFeed(v)'), sb);
  /* 上面那一句 lookTexSet 的假身要能把名单递回给外层数，走一个桥 */
  vm.runInContext('function sbFeed(v){ thisFed = v; fedCount++; }', sb);
  const A = sb.IMG_LIB;
  A.__fed = () => ({ thisFed:sb.thisFed, fedCount:sb.fedCount });
  A.LibStore = sb.LibStore; A.Ico = sb.Ico; A.window = sb.window;
  return A;
}
/* 一份三张图的清单（三种用途各一张，文件名故意用 img- 那一种前缀） */
const THREE = 'A石:\n  图: img-a.png\n  用途: 纹理·四方连续图\n  作者:\nB景:\n  图: img-b.png\n  用途: 背景图\n  作者:\nC材:\n  图: img-c.png\n  用途: 取色素材\n  作者:\n';
const ICO3 = { 'images-img-a':'fdapp://app/data/images/img-a.png', 'images-img-b':'fdapp://app/data/images/img-b.png', 'images-img-c':'fdapp://app/data/images/img-c.png' };

const L0 = mkLib({ 'images.yaml':'' }, {});
/* 1、第一次开机：文件是空的，也要把带说明的那一份原样写出去（他得看得见这份长什么样） */
await L0.ImgLib.boot();
ok('1 空清单第一次开机：认到 ' + L0.ImgLib.list.length + ' 张，说明那一份写出去了 ' +
   (L0.ImgLib.text().split('\n').length) + ' 行（表头 + 一张也没有）',
  L0.ImgLib.list.length === 0 && /【图片库】/.test(L0.ImgLib.text()) && L0.ImgLib.ready === true);

/* 2、三张图写出去再读回来，用途一栏一个不丢 */
const L1 = mkLib({ 'images.yaml':THREE }, ICO3);
await L1.ImgLib.boot();
const 用途回来 = L1.ImgLib.list.map(t => t.用途).join(',');
const 重读 = L1.ImgLib.entry(L1.LibYml.parse(L1.ImgLib.text())[1]);
ok('2 三张图读回来用途各归各的（' + 用途回来 + '），写出去再读回来那一条也不变（' + 重读.名字 + '=' + 重读.用途 + '）',
  用途回来 === '纹理·四方连续图,背景图,取色素材' && 重读.用途 === '背景图' && 重读.文件 === 'img-b.png');

/* 3、用途写错 / 旧那份没有这一栏：一律落回纹理那一种（宁可能铺，也别摆一条哪一排都不进的孤图） */
const 歪 = [L1.imgUseOf('背景'), L1.imgUseOf(''), L1.imgUseOf('随便写的'), L1.imgUseOf('取色素材')].join(',');
ok('3 用途那一栏认不得的一律落回「纹理·四方连续图」（写错的、空着的都算，认得的那条照原样：' +歪 + '）',
  歪 === '纹理·四方连续图,纹理·四方连续图,纹理·四方连续图,取色素材');

/* 4、那份旧纹理清单现在该是「一个字都不读」：盘上就算还躺着一份带两条的它，开机也不许搬、不许写第二份 */
const OLD = '宣纸:\n  图: xuanzhi.png\n  作者:\n水磨石:\n  图: shuimo.png\n  作者:\n';
const L2 = mkLib({ 'images.yaml':'', 'textures.yaml':OLD }, {});
await L2.ImgLib.boot();
const 读过 = L2.ImgLib.list.length;
ok('4 旧那份清单不再读：给它一份写着两条的 textures.yaml，开机后名单 ' + 读过 + ' 张、写盘只 ' + L2.LibStore.puts.length +
   ' 回（那一个名字都不再提，更不往 images.yaml 里塞别人的条目）',
  读过 === 0 && L2.LibStore.puts.length === 1 && L2.LibStore.puts[0] === 'images.yaml');

/* 5、三块互不串：背景图那一张不许出现在纹理名单里，取色素材那一张两头都不许出现 */
L1.ImgLib.sync();
const 喂进 = L1.__fed().thisFed.map(x => x.name).join(',');
ok('5 按用途分块不串门：纹理那一排 ' + L1.ImgLib.byUse('纹理·四方连续图').length + ' 张、背景那一排 ' +
   L1.ImgLib.byUse('背景图').length + ' 张，喂给外观层的名单只有「' + 喂进 + '」（当纹理用的那一张才递过去），累计喂过 ' +
   L1.__fed().fedCount + ' 遍',
  L1.ImgLib.byUse('纹理·四方连续图').length === 1 && L1.ImgLib.byUse('背景图').length === 1 && 喂进 === 'A石');
const 串门 = L1.ImgLib.byUse('纹理·四方连续图').map(t => t.名字).join(',') + ' | ' + L1.ImgLib.byUse('背景图').map(t => t.名字).join(',');
ok('5b 三张各归一块（' + 串门 + '）：背景那一排里只有 B景，取色素材那张两头都不在',
  串门 === 'A石 | B景' && L1.ImgLib.byUse('取色素材').map(t => t.名字).join(',') === 'C材');

/* 6、方案里「背景图」那一栏只认库里当背景图用的那一张：拿纹理冒充、或名字写错都落回「无」 */
const 假 = [L1.imgWallName('B景'), L1.imgWallName('A石'), L1.imgWallName('没这张'), L1.imgWallName('')].join(' / ');
ok('6 背景图那一栏认得到只认「按背景图导入」那一张（' + 假 + '）—— 拿纹理那张冒充背景、或库里没有的名字，一律落回无',
  假 === 'B景 / 无 / 无 / 无');

/* 7、段名撞了自动让位（段名就是这张图的身份，文件里同名只认头一段） */
const 让位 = [L1.ImgLib.uniqueName('A石'), L1.ImgLib.uniqueName(''), L1.ImgLib.uniqueName('新图')].join(' / ');
ok('7 名字撞了就自动让位、空名字给个兜底（' + 让位 + '）',
  让位 === 'A石 2 / 未命名图 / 新图');

/* 8、改用途：两头跟着变，外观层那份名单再喂一遍（改完不重开就生效） */
const 改前 = L1.ImgLib.byUse('背景图').length;
L1.ImgLib.setUse('C材', '背景图');
const 改后 = L1.ImgLib.byUse('背景图').map(t => t.名字).join(',');
const 改后纹 = L1.ImgLib.byUse('纹理·四方连续图').map(t => t.名字).join(',');
ok('8 「C材」改成当背景图用：背景那一排从 ' + 改前 + ' 张变成 ' + L1.ImgLib.byUse('背景图').length + ' 张（' + 改后 + '），纹理那一排剩 ' + 改后纹 +
   '，落盘 ' + L1.LibStore.puts.length + ' 回',
  改后 === 'B景,C材' && 改后纹 === 'A石' && L1.LibStore.puts.length >= 1);

/* 9、划掉一张只是删清单里那一段：图本身还在（图标那一层照样认得到），程序不替他删磁盘上的东西 */
const 删 = L1.ImgLib.remove('B景');
ok('9 划掉「B景」交回 ' + JSON.stringify(删) + '：清单里 ' + L1.ImgLib.byUse('背景图').length + ' 张、图库地址取不到（空串），可图标那一层那张文件还在（' +
   (L1.Ico.url('images-img-b') ? '认到' : '没了') + '）',
  删.ok === true && L1.ImgLib.url('B景') === '' && !!L1.Ico.url('images-img-b'));
const 删空 = L1.ImgLib.remove('库里没有的');
ok('9b 划掉一张库里没有的名字：交回不过（' + 删空.msg + '），清单一个字不写',
  删空.ok === false && L1.ImgLib.list.length === 2);

/* 10、落盘那一步的名字闸：只准 数据\\images\\ 里那一个平名字（路径穿越、中文名、超长一律拒） */
const W = L0.ImgLib;
const 收 = await W.putBytes('img-ok.png', new Uint8Array([1, 2, 3]));
const 穿 = await W.putBytes('../evil.png', new Uint8Array([1]));
const 中 = await W.putBytes('我家 图.png', new Uint8Array([1]));
const 长 = await W.putBytes('x'.repeat(70) + '.png', new Uint8Array([1]));
const 写到的 = (L0.window.__written || []).map(x => x[0] + '(' + x[1] + '字节)').join(',');
ok('10 落盘名字闸：正规名过（' + JSON.stringify(收) + '，真写到 ' + 写到的 + '），路径穿越 / 中文名 / 超长三个都拒（' +
   [穿.ok, 中.ok, 长.ok].join(',') + '）',
  收.ok === true && 写到的 === 'data/images/img-ok.png(3字节)' && 穿.ok === false && 中.ok === false && 长.ok === false);

/* 11、物理文件名 → 图标表那个键，和图标那一层同一个清洗式子（中文名只能靠清单记着给人看） */
const 键 = L1.imgKey('img-a.png') + ' / ' + L1.imgKey('我家 图 2.PNG') + ' / ' + L1.imgKey('');
ok('11 键名那一步：去后缀再洗一道（' + 键 + '），洗完整串只剩 a-z 0-9 - _（和 sh-ico.js 那一条同一个式子）',
  键 === 'img-a / -----2 / ' && !/[^a-zA-Z0-9_-]/.test(L1.imgKey('我家 图 2.PNG')));

/* ---------- 二、现场数源码 ---------- */
const 空话段 = (/function imgEmptyWord\(use\)\{[\s\S]*?\n\}/.exec(UI) || [''])[0];
const 三颗 = (UI.match(/imgImport\(u\.k/g) || []).length;
ok('12 第 4 页那几颗导入按钮走同一颗函数：IMG_USES 筛出来的那一串（类.map）里数到 imgImport(u.k ' + 三颗 + ' 处，空清单那一句各说各的 ' +
   ((空话段.match(/还没有/g) || []).length) + ' 条',
  三颗 === 1 && /类\.map\(u => h\('button'/.test(UI) && /imgEmptyWord\(u\.k\)/.test(UI)
  && 空话段.length > 100 && (空话段.match(/还没有/g) || []).length === 3);
const 旧件 = ['function texImport(', 'function texAccept(', 'function texRemove(', 'TexLib.', 'function texKey(', 'const TexLib =',
  'TEX_FILE', "'textures.yaml'", "'textures-'"];
const 剩 = 旧件.filter(s => [LIB, SHL, UI, LOOK, MAIN, SERVE].some(t => t.includes(s)));
ok('13 从前纹理那一摊的旧件全清：' + 旧件.length + ' 样里还剩 ' + 剩.length + ' 样' + (剩.length ? '（' + 剩.join(' / ') + '）' : '') + ' —— 薄皮 TexLib / texKey 也撤干净了，界面上不再有第二条来路',
  剩.length === 0);
const 挑两头 = /ImgLib\.byUse\('纹理·四方连续图'\)/.test(UI) && /ImgLib\.byUse\('背景图'\)/.test(UI);
ok('14 第 3 页那两排直接吃图片库那份清单（纹理那一排和背景那一排各一处 byUse），界面上不再抄第二份名字表',
  挑两头 && !/LOOK_TEXTURES/.test(UI));
const 段 = (/function markSection\(\)\{[\s\S]*?\n\}/.exec(UI) || [''])[0];
ok('15 标记色三条路都开着（作者的话「标记色可以取色器+色号自由设色」）：那一段里取色器 colorChip ' +
   (段.match(/colorChip/g) || []).length + ' 处、手写色号那只框 ' + (段.match(/h\('input'/g) || []).length +
   ' 处、「色卡」那一枚 ' + (段.match(/markPoolDlg\(hex/g) || []).length + ' 处；「只能从色卡挑」那一句排他话 ' +
   (段.match(/只能从色卡/g) || []).length + ' 处',
  段.length > 400 && (段.match(/colorChip/g) || []).length === 1 && (段.match(/h\('input'/g) || []).length === 1
  && (段.match(/markPoolDlg\(hex/g) || []).length === 1 && (段.match(/只能从色卡/g) || []).length === 0
  && /CardPool\.hex\(/.test(段));
ok('16 挑色那一屏只吃一家：那一段里两条循环（一条从 CardPool 收色、一条把收来的摆成点），' +
   'Marks.pool 那一个第二家整个不在（四份源码里 ' + (([LIB, SHL, UI, LOOK].join('')).match(/Marks\.pool/g) || []).length +
   ' 处提到）；一个色也没有时说的是「色卡上还一个色也没有」',
  (/for\(const c of CardPool\.items\) push\(CardPool\.hexOf\(c\)\);/.test(UI)) && !/Marks\.pool/.test(UI)
  && /Modal\.open\('从色卡挑一个颜色'/.test(UI) && /色卡上还一个色也没有/.test(UI));
const MK = tillBrace(SHL, 'const Marks = {');
ok('17 Marks 这一份现在按方案走：live 那一格 ' + ((MK.match(/live:\[\]/g) || []).length) + ' 处、落成 ' +
   ((MK.match(/落成\(list, 写回\)\{/g) || []).length) + ' 处、随方案 ' + ((MK.match(/随方案\(list\)\{/g) || []).length) +
   ' 处；从前那个「住在存档顶上」的 store 取值器 ' + ((MK.match(/get store\(\)/g) || []).length) + ' 处、mode 那一档 ' +
   ((MK.match(/setMode|mode\(\)\{/g) || []).length) + ' 处',
  /live:\[\]/.test(MK) && /落成\(list, 写回\)\{/.test(MK) && /随方案\(list\)\{/.test(MK)
  && !/get store\(\)/.test(MK) && !/setMode/.test(MK) && !/mode\(\)\{/.test(MK)
  && /return \{ colors:out \};/.test(SHL) && /LookStore\.data\.marks = null/.test(MK));
ok('18 那一行的 CSS 跟着开回来：.fd-mark 里那只色号框有规则（' +
   ((/\.fd-mark \.fd-input\{[^}]*\}/.exec(SHL) || [''])[0]) + '），每格宽度按「序号 + 取色片 + 色号框 + 色卡 + 撤掉」重定',
  /\.fd-mark \.fd-input\{/.test(SHL) && !/minmax\(104px,1fr\)/.test(SHL));
ok('19 第 4 页四块齐（色卡 / 图片 / 纹理 / 字体）并排挂在 p4box 里，第四档标签交回的就是这一整块',
  UI.includes("gPal = group('色卡')") &&
  UI.includes('[gPal.wrap, gImg.wrap, gTile.wrap, gFont.wrap]') && /gImg\.body\.appendChild\(imgLibSection\(/.test(UI)
  && /gFont\.body\.appendChild\(fontLibSection\(/.test(UI) && /build:\(\) => p4box/.test(UI));
ok('20 恢复出厂那一路把卡片间距也算进数值里（set(间距, f.间距) 真跑了），弹框正文、按钮悬停说明、那一行小字三处都提「两档圆角 + 卡片间距」',
  /set\('间距', f\.间距, false\)/.test(UI) && (UI.match(/两档圆角和卡片间距|两档圆角回到出厂那一档、卡片间距回到自动|两档圆角 \+ 卡片间距/g) || []).length >= 3
  && /出厂数值只读外壳层那一份默认值/.test(UI));
ok('21 运行时那一头收得到这一格：main.cjs 的库文件白名单里有 images.yaml、扫图标时把 data\\images\\ 念作 images-<文件名> 且排在内置之后；开发那台服务器有 /_img 那一条 POST（同一个落点）',
  MAIN.includes("'images.yaml'") && /take\(DATA_IMG_DIR, 'images-', true\)/.test(MAIN)
  && /path\.join\(DATA_ROOT, 'images'\)/.test(MAIN) && /if\(url === '\/_img'\) return imgReq\(req, res\)/.test(SERVE)
  && /fs\.mkdirSync\(DATA_IMG_DIR, \{ recursive:true \}\)/.test(SERVE));
ok('22 开发服务器那一条也认名字闸（和页面上 putBytes 那一句同一个式子，两边不各写一套），后缀不认的一律不落盘',
  SERVE.includes("/^[A-Za-z0-9._-]{1,64}$/.test(q) || q.includes('..') || !IMG_EXT.includes(path.extname(q).toLowerCase())"));
/* 收一张图标那一层取不到地址的图进图库 = 摆一条点得动的假图：三处后缀名单必须对得上（页面挑的 ⊆ 开发服务器收的 ⊆ 主进程扫的） */
const 页收 = (UI.match(/const IMG_PICK = \{[^}]*\}/)[0].match(/\.[a-z]+/g) || []).map(x => x.toLowerCase());
const 服收 = (/const IMG_EXT = \[[^\]]*\]/.exec(SERVE)[0].match(/\.[a-z]+/g) || []);
const 扫得 = (/const ICON_EXT = \[[^\]]*\]/.exec(MAIN)[0].match(/\.[a-z]+/g) || []);
const 越界 = 页收.filter(x => !服收.includes(x) || !扫得.includes(x));
ok('23 三处后缀名单对得上：页面收 ' + 页收.join(',') + ' 个后缀，开发服务器收 ' + 服收.length + ' 个、主进程扫 ' + 扫得.length +
   ' 个 —— 页面那一份不在另两头之内的有 ' + 越界.length + ' 个' + (越界.length ? '（' + 越界.join(',') + '）' : ''),
  页收.length === 5 && 越界.length === 0);
let 咬后缀 = false;
try{
  const 假页 = UI.replace(/const IMG_PICK = \{[^}]*\}/, "const IMG_PICK = { 'image/bmp':['.bmp'] }");
  const b = (假页.match(/const IMG_PICK = \{[^}]*\}/)[0].match(/\.[a-z]+/g) || []);
  咬后缀 = b.filter(x => !扫得.includes(x)).join(',') === '.bmp';
}
catch(e){ 咬后缀 = false; }
ok('24 这一条咬得住：把页面那份名单换成只收 .bmp（主进程那一层不扫它），判法立刻报出越界', 咬后缀);
/* 键名这一步两边各写一遍（页面这边对着清单里写的文件名，主进程那边对着真文件名），式子必须一模一样，差一点就两头认不到同一张图 */
const 页式 = (/function imgKey\(file\)\{[\s\S]*?\n\}/.exec(LIB) || [''])[0];
const 主式 = (/function iconKey\(n\)\{[^\n]*\n/.exec(MAIN) || [''])[0];
const 洗 = s => ((s.match(/replace\((\/[^/]+\/g), '-'\)/) || [])[1] || '');
ok('25 两边清洗式子逐字对上：页面 imgKey 用 ' + 洗(页式) + '，主进程 iconKey 用 ' + 洗(主式) +
   '；两边都是「先去掉后缀、再洗这一串」（主进程那一句还带着「和页面那侧 cssName 同一个换算」的说明）',
  洗(页式) !== '' && 洗(页式) === 洗(主式) && 页式.includes('lastIndexOf') && 主式.includes('String(n)'));

/* ---------- 三、咬一口：把第 5 条依赖的承重墙各改坏一遍，那条判法必须不过 ---------- */
let 咬块 = false, 咬喂 = false;
try{
  /* 3a、把「按用途筛那一块」改成整份都算 —— 背景那一排立刻串进三张，第 5 条那种判法（1 张 / 1 张）不过 */
  const L3 = mkLib({ 'images.yaml':THREE }, ICO3, [['byUse(use){ return this.list.filter(t => t.用途 === use); }', 'byUse(use){ return this.list; }']]);
  await L3.ImgLib.boot();
  咬块 = L3.ImgLib.byUse('背景图').length === 3;
}catch(e){ 咬块 = false; }
try{
  /* 3b、把「喂给外观层那一份只交当纹理用的」改成整份都喂 —— 背景图和取色素材也会当成一档纹理摆进下拉 */
  const L4 = mkLib({ 'images.yaml':THREE }, ICO3,
    [['texList(){ return this.byUse(\'纹理·四方连续图\').map(t => ({ k:imgKey(t.文件), name:t.名字 })); }',
      'texList(){ return this.list.map(t => ({ k:imgKey(t.文件), name:t.名字 })); }']]);
  await L4.ImgLib.boot();
  咬喂 = L4.__fed().thisFed.length === 3;
}catch(e){ 咬喂 = false; }
ok('26 咬得住两处：按用途筛那一步改成整份都算 → 背景那一排数到 ' + (咬块 ? '3 张（串门，第 5 条那种判法不过）' : '还是 1 张') +
   '；只交当纹理用的那几张改成整份递给外观层 → 喂进去 ' + (咬喂 ? '3 张（背景和取色素材也被当成纹理，第 5 条那种判法不过）' : '还是 1 张') +
   '。这两样都反着来才不过，说明第 5 条断的是真事，不是自造的假场景',
  咬块 && 咬喂);

/* ---------- 外32 三层：方案资源 = 总仓库（颜色 / 图片 / 纹理 / 字体），方案编辑 = 打包台 ----------
   作者 2026-10-09：「方案素材是一个总仓库，可以从仓库拿不同的东西（颜色、图片、纹理、字体），然后在方案编辑
   页面用不同的打包方式（颜色微调、纹理使用、字号、圆角数据等）打包成方案，最终呈现为外观。」
   「方案资源这里是色卡，下拉展示所有颜色，选中的进入方案；然后方案编辑就会展示用户给这个方案选择的颜色」 */
ok('27 仓库那一页四块齐，纹理从图片那一块里单列出来（imgLibSection 带用途名单被叫两回：图片那一块只拿背景图和取色素材，纹理那一块只拿纹理）',
  /function imgLibSection\(after, uses\)/.test(UI) &&
  /imgLibSection\(\(\) => \{ drawDetail\(\); drawWall\(\); \}, \['背景图', '取色素材'\]\)/.test(UI) &&
  /imgLibSection\(\(\) => \{ drawDetail\(\); drawWall\(\); \}, \['纹理·四方连续图'\]\)/.test(UI));
ok('28 色卡那一屏有「挑中的进入方案」这一枚，走的是 lookPage 递进来的 useFor（建一套配色给这一套用），不是往 CardPool 里再写一遍',
  /'挑中的进入方案'/.test(UI) && /const 进方案 = useFor \? h\('button'/.test(UI) &&
  /cardPoolBox\(\(\) => \{ redrawAll\(\); \}, useFor\)/.test(UI) &&
  /palEdit = paletteLib\(lib,[\s\S]{0,90}hexes => \{[\s\S]*?Palette\.add\(\{[\s\S]*?set\('配色', it\.name\)/.test(UI));
{ const 池段 = (/function cardPoolBox\(after, useFor\)\{[\s\S]*?\n\}/.exec(UI) || [''])[0];
  ok('29 色卡那一屏里不许再有「挑中的进色卡」那一枚（那是从仓库挑中放回仓库的循环），也不许改圆点的透明度（选中只加一圈环）',
    池段.length > 500 && !/'挑中的进色卡'/.test(池段) && !/opacity/.test(池段)); }
ok('30 某一方案那一头（配色名 / 整体基调 / 色号 / 预览）不在仓库那一页：paletteLib 把它 return 出去，lookPage 挂进 dPal（方案编辑顶上第一块）',
  /return 编辑;/.test(UI) && /if\(palEdit\) dPal\.appendChild\(palEdit\)/.test(UI) &&
  /p3box\.appendChild\(dPal\);\s*\n\s*p3box\.appendChild\(dScheme\)/.test(UI) &&
  !/box\.appendChild\(editor\)/.test(UI));

console.log('\n' + pass + ' 过 ' + fail + ' 不过');
process.exit(fail ? 1 : 0);
