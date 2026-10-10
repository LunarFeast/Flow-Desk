/* 丁组 · 字体那一摊（外29 第 56 轮之后接着做的那块）
   作者的原话：「本地字体（用户电脑自己安装的字体；用颜色小点展示支持的语言…字体排序中，自动置顶一个当前字体，
   然后是5个收藏字体，再往下是所有字体按照字体名排序且分类展示，如中文字体分类为宋体、楷体、行书、草书、手写体、艺术字等）；
   可对不同的语言设置不同的字体（两个联动的下拉窗口、一个选择语言、另一个选择字体，语言排序中，中文简体第一位、
   中文繁体第二位、英语第三位，其他常见语言按照英文名字母排序），可以一键统一字体」
   + 第 4 页「字体：建立本地字体列表，屏蔽字体（本地存在、软件中不想显示），收藏字体的管理，选择字体、查看字体信息」
   —— 2026-10-08 作者把上面那句里的「分类展示（宋体、楷体、行书…）」整条撤了：「字体不要平铺，也别分类了，
   你分得乱七八糟都不对 / 改成下拉列表，收藏和常用还在前边，其他排序，中文字体在前、外语字体在后，按名字升序排列」，
   所以这台改判的是「次序对不对 + 分类那套有没有删干净」，不再判归类本身。
   这一台把 sh-font.js / fd3-lib.js 里的真函数搬进虚拟机跑，不抄第二份。 */
import fs from 'node:fs';
import vm from 'node:vm';
const R = 'D:/Programs/Flow-Desk/';
const FONT = fs.readFileSync(R + 'src/_shared/sh-font.js', 'utf8');
const LIB = fs.readFileSync(R + 'src/_fd/src/fd3-lib.js', 'utf8');
const SHL = fs.readFileSync(R + 'src/_fd/src/fd3-shell.js', 'utf8');
const UI = fs.readFileSync(R + 'src/_fd/src/fd4-builtin.js', 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if(c){ pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (x ? ' · ' + x : '')); } };
function bs(src, marker){
  const i = src.indexOf(marker); if(i < 0) throw new Error('找不到 ' + marker);
  let d = 0, j = src.indexOf('{', i);
  for(let k = j; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}'){ d--; if(!d) return src.slice(i, k + 1); } }
  throw new Error(marker + ' 没配平');
}
const sb = { console, String, Object, Array, Set, Map, RegExp, JSON, Number, Boolean, isNaN, Intl };
vm.createContext(sb);
vm.runInContext([
  /const FF_LANGS = \[[\s\S]*?\n\];/.exec(FONT)[0],
  /const FF_SCRIPTS\s*= .*\n/.exec(FONT)[0],
  /const FF_PIN_MAX = .*;/.exec(FONT)[0],
  /const FF_LANG_ALIAS = .*;/.exec(FONT)[0],
  /function ffQuote\(name\)\{.*\}/.exec(FONT)[0],
  bs(FONT, 'function ffLangList()'),
  'this.f = { ffLangList, FF_PIN_MAX, FF_LANG_ALIAS, FF_LANGS };'
].join('\n'), sb);
const F = sb.f;

/* ---------- 一、语言表 ---------- */
const L = F.ffLangList();
ok('1 语言排序照原话：中文简体第一、中文繁体第二、英语第三（实得 ' + L.slice(0, 3).map(x => x.name).join(' / ') + '）',
  L[0].name === '中文简体' && L[1].name === '中文繁体' && L[2].name === '英语');
const rest = L.slice(3).map(x => x.en);
ok('2 其余 ' + rest.length + ' 档按英文名字母排（' + rest.join(' < ') + '）',
  rest.join('|') === rest.slice().sort((a, b) => a.localeCompare(b, 'en')).join('|'));
ok('3 每一档都带着自己那一段 unicode 区段（没有空 range 的档）',
  L.every(x => /^U\+/.test(x.range) && x.range.includes('-')));

/* ---------- 一之乙、名单那一份次序（跑的是 sh-font.js 里真的 all() / cnRank / isHidden）
   作者 2026-10-08 改口：「字体不要平铺，也别分类了，你分得乱七八糟都不对 / 改成下拉列表，
   收藏和常用还在前边，其他排序，中文字体在前、外语字体在后，按名字升序排列」。
   界面上那一枚下拉只是把这份名单切成四截摆出来，次序全在这一个函数里。 ---------- */
const sbK = { console, String, Object, Array, Set, RegExp, JSON };
vm.createContext(sbK);
vm.runInContext('const Fonts = { pinned:["霞鹜文楷等宽","华文中宋"], hidden:["黑体"], marks:{ "Segoe UI":{zh:1} },'
  + ' dir:[], sys:["宋体","楷体","华文中宋","黑体","Arial","Times New Roman","Microsoft YaHei","Segoe UI"],'
  + ' used:{ "Arial":9, "Times New Roman":3, "楷体":1 },\n'
  + [bs(FONT, '  all(){'), bs(FONT, '  cnRank(f){'), bs(FONT, '  isHidden(f){')].join(',\n')
  + '\n}; this.F3 = Fonts;', sbK);
const 名单 = vm.runInContext('Fonts.all().map(x => x.g + ":" + x.f)', sbK);
ok('4 名单次序照他点的那条：收藏（照收藏表自己那顺序）→ 常用（用过 9 / 3 / 1 从多到少）→ 其余（中文在前、外语在后）（实得 '
  + 名单.join(' | ') + '）',
  名单.join(',') === 'pin:霞鹜文楷等宽,pin:华文中宋,use:Arial,use:Times New Roman,use:楷体,'
    + 'all:Segoe UI,all:宋体,all:Microsoft YaHei', 名单.join(','));
ok('5 宋体楷体那一套分类真删干净了：源码里再没有 ffKindOf / FF_KINDS，字体信息那一屏也没有「分类」这一行（他判过「分得乱七八糟都不对」）',
  !/ffKindOf/.test(FONT) && !/FF_KINDS/.test(FONT) && !/\[\s*'分类'/.test(FONT)
  && !/ffKindOf|Fonts\.kinds\(\)/.test(UI));

/* ---------- 二、按语言那一份 @font-face ---------- */
const sb2 = { console, String, Object, Array, Set, Map, RegExp, JSON, ffQuote:v => "'" + String(v).replace(/['"\\]/g, '').trim() + "'",
  FF_LANGS:F.FF_LANGS, ffLangList:F.ffLangList, FF_LANG_ALIAS:F.FF_LANG_ALIAS };
vm.createContext(sb2);
vm.runInContext(bs(FONT, '  langFaces(map){').replace(/^  /, 'function ') + '\nthis.lf = langFaces;', sb2);
const css = sb2.lf({ 'zh-Hans':'宋体', 'en':'Times New Roman' });
const lines = css.split('\n').filter(Boolean);
ok('6 真跑 langFaces：钉两档交出两条 @font-face（实得 ' + lines.length + ' 条）', lines.length === 2);
ok('7 每一条都是 src:local(那一个字体) + 这一档自己的区段 + 共用同一个假名（系统里装着的字体不用读文件字节）',
  lines.every(x => /src:local\('/.test(x) && /unicode-range:U\+/.test(x) && x.includes("font-family:'" + F.FF_LANG_ALIAS + "'")), lines.join(' ⧸ '));
ok('8 没钉任何一档 = 一条都不生成（不摆空样式表骗屏幕）', sb2.lf({}) === '' && sb2.lf(null) === '');
let cssRan = 0;
const sb3 = { console, String, Object, Array, Set, RegExp, JSON,
  ffQuote:v => "'" + v + "'", FF_LANGS:F.FF_LANGS, ffLangList:F.ffLangList, FF_LANG_ALIAS:F.FF_LANG_ALIAS,
  ffCss(){ cssRan++; } };
vm.createContext(sb3);
vm.runInContext([bs(FONT, '  langFaces(map){').replace(/^  /, 'function '),
  bs(FONT, '  langStack(map, base){').replace(/^  /, 'function '), 'this.ls = langStack;'].join('\n'), sb3);
ok('9 字体栈：钉过 → 假名排最前再接原来那一串；没钉 → 原样交回（不凭空插一层）',
  vm.runInContext('langStack({ "zh-Hans":"宋体" }, "Segoe UI")', sb3).startsWith("'" + F.FF_LANG_ALIAS + "',Segoe UI")
  && vm.runInContext('langStack({}, "Segoe UI")', sb3) === 'Segoe UI');

/* ---------- 三、收藏五格封顶 + 屏蔽 ---------- */
const methods = [bs(FONT, '  pin(f){'), bs(FONT, '  isHidden(f){'), bs(FONT, '  hide(f){'), bs(FONT, '  unhide(f){')].join(',\n');
const sb4 = { console, String, Array, Object, Set, State:{ set(){} }, toast(){}, FF_PIN_MAX:F.FF_PIN_MAX };
vm.createContext(sb4);
vm.runInContext('const Fonts = { pinned:[], hidden:[], marks:{}, sys:[], dir:[], used:{}, changed(){}, '
  + 'unpin(f){ this.pinned = this.pinned.filter(x => x !== f); },\n' + methods + '\n}; this.F2 = Fonts;', sb4);
const G = sb4.F2;
for(let i = 0; i < 8; i++) G.pin('字体' + i);
ok('10 收藏封顶五格：连点八次收藏，只有前五个进去（作者的话：「然后是5个收藏字体」）',
  G.pinned.length === 5 && G.pinned.join(',') === '字体0,字体1,字体2,字体3,字体4', G.pinned.join(','));
G.hide('字体9'); G.hide('字体8');
ok('11 屏蔽记进名单、并且屏蔽时顺手从收藏里摘掉（同一个字体不该既收藏又看不见）',
  G.isHidden('字体9') && G.hidden.length === 2);
G.unhide('字体9');
ok('12 取消屏蔽立刻回来（不碰系统里那份字体文件，只是软件里摆不摆）',
  !G.isHidden('字体9') && G.hidden.length === 1);
ok('13 清单那一路把屏蔽掉的滤掉：all() 里那句 filter 吃了 isHidden',
  /!this\.isHidden\(f\)/.test(FONT) && /out\.push\(\{ f, g:'all' \}\)/.test(FONT));

/* ---------- 四、方案文件里那一栏：读写对得上 ---------- */
const sb5 = { console, String, Object, Array, JSON, FF_LANGS:F.FF_LANGS };
vm.createContext(sb5);
vm.runInContext([bs(LIB, 'function ffLangMap(txt)'), bs(LIB, 'function ffLangText(map)')].join('\n'), sb5);
const back = vm.runInContext('ffLangMap(ffLangText({ "zh-Hans":"宋体", en:"Times New Roman" }))', sb5);
ok('14 文件里那一串写得出去读得回来（中文简体=宋体;英语=Times New Roman）',
  back['zh-Hans'] === '宋体' && back.en === 'Times New Roman', JSON.stringify(back));
ok('15 认不出的那一截丢掉不报错（"火星语=X" 读回来是空、少一个等号的那截也丢掉）',
  Object.keys(vm.runInContext('ffLangMap("火星语=X; 坏行; 英语=A")', sb5)).join(',') === 'en');
ok('16 表头 / 读 / 写 三处齐：按语言这一栏进得了 looks.yaml（表头那一串 2026-10-08 加了 纹理用法 / 背景图 / 间距，按语言和分组的位置没变）',
  LIB.includes("'纹理', '纹理用法', '背景图', '分组', '按语言', '字体'") && LIB.includes("按语言:ffLangText(s.按语言),") && LIB.includes("按语言:ffLangMap(n('按语言')),"));

/* ---------- 五、接线的三处（现场数，不凭记忆） ---------- */
ok('17 上屏只有一处全局字体出口，且吃了按语言那一份',
  (SHL.match(/setProperty\('--fd-font'/g) || []).length === 1 && /Fonts\.langStack\(this\.cfg\.fontLangs/.test(SHL));
ok('18 方案生效那一路把 按语言 带进机器存档（c.fontLangs），默认值里也有这一份',
  /c\.fontLangs = s\.按语言 \|\| \{\}/.test(LIB) && /defaults:\{[^}]*fontLangs:\{\}/.test(SHL));
ok('19 第 3 页两样齐：按语言那一摊（两联动下拉 + 一键统一 + 全撤）+ 全局那个还在',
  /dScheme\.appendChild\(row\('按语言钉字体', langFontRow\(/.test(UI) && /dScheme\.appendChild\(row\('全局字体', Fonts\.field\(/.test(UI)
  && /const selLang = h\('select'/.test(UI) && /const selFont = h\('select'/.test(UI) && /'一键统一'/.test(UI));
ok('20 第 4 页有字体那一摊（列表 / 收藏 / 屏蔽 / 信息 四样都在，且和颜色、图片、纹理几块并排挂在 p4box 里）',
  /gFont\.body\.appendChild\(fontLibSection\(/.test(UI) && UI.includes('[gPal.wrap, gImg.wrap, gTile.wrap, gFont.wrap]')
  && /gImg\.body\.appendChild\(imgLibSection\(/.test(UI)
  && /'查看字体信息'|字体信息/.test(UI)
  && /'收藏'/.test(UI) && /'屏蔽'/.test(UI) && /'取消屏蔽'/.test(UI));
ok('21 联动是真的：换语言那一下重读当前档、钉这一档走 set(按语言)、一键统一把每一档都填上',
  /selLang\.onchange = \(\) => \{ pick = selLang\.value; sync\(\); \}/.test(UI)
  && /set\('按语言', m\)/.test(UI) && /for\(const l of langs\) m\[l\.k\] = v/.test(UI));

/* ---------- 六、第 4 页那一摊：一枚下拉，四截次序（2026-10-08 那一轮改口） ---------- */
ok('22 屏蔽掉的那个不摆出来（黑体本地装着，可下拉里没有它）', !名单.some(x => x.endsWith(':黑体')));
ok('23 「中文在前」认的是名字里有汉字、或点过「中」那个点：Segoe UI 名字里没汉字但点过中 → 和宋体同截，Microsoft YaHei 落外语那一截',
  vm.runInContext('Fonts.cnRank("Segoe UI")', sbK) === 0
  && vm.runInContext('Fonts.cnRank("宋体")', sbK) === 1
  && vm.runInContext('Fonts.cnRank("Microsoft YaHei")', sbK) === 2);
vm.runInContext('Fonts.pinned.reverse();', sbK);
const 名单2 = vm.runInContext('Fonts.all().filter(x => x.g === "pin").map(x => x.f)', sbK);
ok('24 咬口：把收藏表倒过来，名单最前那两枚跟着倒（那一截真吃的是收藏表，不是名字排序）',
  名单2.join(',') === '华文中宋,霞鹜文楷等宽', 名单2.join(','));
const 字体段 = bs(UI, 'function fontLibSection');
ok('25 第 4 页字体那一摊是一枚下拉：select + 四个 optgroup（收藏 / 常用 / 中文字体 / 外语字体），平铺那一套 rowOf / byKind 已经没了',
  /h\('select'/.test(字体段) && /h\('optgroup'/.test(字体段)
  && 字体段.includes("grp('收藏'") && 字体段.includes("grp('常用'")
  && 字体段.includes("grp('中文字体'") && 字体段.includes("grp('外语字体'")
  && !/rowOf|byKind|fd-grp/.test(字体段));
ok('26 下拉底下那一行管得动：信息 / 收藏 ↔ 取消收藏 / 收藏里往上往下 / 屏蔽，被屏蔽的那一截给「取消屏蔽」',
  /'信息'/.test(字体段) && /'取消收藏'/.test(字体段) && /'收藏'/.test(字体段)
  && /'往上'/.test(字体段) && /'往下'/.test(字体段) && /Fonts\.order\(/.test(字体段)
  && /'屏蔽'/.test(字体段) && /'取消屏蔽'/.test(字体段));

console.log('\n' + pass + ' 过 ' + fail + ' 不过');
process.exit(fail ? 1 : 0);
