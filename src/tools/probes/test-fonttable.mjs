/* 外31 三组 · 本地字体那份表（2026-10-08 作者改口：「明明各种字重我本地都有，链接一下就行了」
   「系统字体扫一下那么快，显示本地字体快得很，你设置一下那么慢」「你现在就换」）
   判的是主进程那一颗真代码：src\pack\main.cjs 里的 fontScanCmd / parseFontOut / parseFontRows / ffWeightNum
   （用 lib-slice 现切，工具里不抄第二份），当场开一趟子进程读这台机器上真装着的字体。
   从前那一版走 GDI 的 InstalledFontCollection：只给名字，一家底下的 Light / Medium 被它当成三个独立族报回来，
   所以「宋体（22 个）」那种分类、字重靠名字尾巴猜、新装字体要等 7 天缓存过期才现身，三样都是同一个根。
   这一台把这几条一条一条钉住。 */
import { execFileSync } from 'node:child_process';
import { rd, 切 } from './lib-slice.mjs';

const MAIN = rd('src/pack/main.cjs');
const SHF = rd('src/_shared/sh-font.js');
const PRE = rd('src/pack/preload.cjs');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if(c){ pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (x ? ' · ' + x : '')); } };

/* 把真源码里那几颗搬进虚拟机：跑的是仓库里那一份，不是这里重写的一份 */
const sb = { console, String, Object, Array, Number, Boolean, RegExp, Error, isNaN, Intl, JSON };
import vm from 'node:vm';
vm.createContext(sb);
vm.runInContext([
  切(MAIN, 'fontScanCmd'), 切(MAIN, 'FF_WEIGHT_NUM'), 切(MAIN, 'ffWeightNum'),
  切(MAIN, 'parseFontRows'), 切(MAIN, 'parseFontOut'),
  'this.K = { fontScanCmd, parseFontOut, parseFontRows, ffWeightNum };'
].join('\n'), sb);
const K = sb.K;

/* ---------- 一、那一段 PowerShell 认的是系统那张表，不是名字 ---------- */
const cmd = K.fontScanCmd();
ok('1 读的是 WPF 的 SystemTypefaces（一家底下有哪几档真脸，系统自己报），不是 GDI 那份只给名字的族表',
  /System\.Windows\.Media\.Fonts\]::SystemTypefaces/.test(cmd) && !/InstalledFontCollection/.test(cmd));
ok('2 合成出来的假粗假斜当场扔掉（霞鹜文楷等宽那一家因此只剩三档，和「设置 → 个性化 → 字体」一样）',
  /IsBoldSimulated/.test(cmd) && /IsObliqueSimulated/.test(cmd));
ok('3 非 Normal 的拉伸扔掉、中文英文名和档名一起带回来（五列，制表符分开）',
  /Stretch\.ToString\(\) -ne "Normal"/.test(cmd) && /\$f\.Source,\[string\]\$_\.Weight,\$d,\$e,\$l/.test(cmd)
  && /-join \[char\]9/.test(cmd));
ok('4 中文字体名走 UTF-8 出来，PowerShell 用 -STA 起（不设置就是本地代码页的字节，node 按 UTF-8 解成乱码）',
  /OutputEncoding=\[System\.Text\.Encoding\]::UTF8/.test(cmd)
  && /'-STA'/.test(MAIN.slice(MAIN.indexOf('function enumerateFonts'), MAIN.indexOf('function enumerateFonts') + 1400)));

/* ---------- 二、真机器上跑一趟：这一节全部是现场量出来的 ---------- */
const t0 = Date.now();
const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', cmd],
  { encoding:'buffer', maxBuffer:64 << 20, windowsHide:true });
const 用了 = Date.now() - t0;
const got = K.parseFontOut(out.toString('utf8'), 0, '');
const 家 = got.fonts, 表 = got.faces;
const 档 = n => (表[n] || []).map(x => x.w);
const 脸 = n => (表[n] || []).map(x => x.w + ':' + x.名).join(' ');
ok('5 真数出来 ' + 家.length + ' 家、字重表 ' + Object.keys(表).length + ' 个键，跑了 ' + 用了 + ' ms（一家一条）',
  家.length > 100 && Object.keys(表).length >= 家.length);
const 拆 = 家.filter(n => 家.some(m => m !== n
  && new RegExp('^' + String(m).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' (Light|Regular|Medium|Semibold|Demibold|Bold|Thin)$', 'i').test(n)));
ok('6 一家不再被拆成三族：名单里找不出「某家 + 空格 + Light/Regular/Medium/Bold」那种条目（GDI 那一份 456 条里全是这种；'
  + '真独立注册的「Arial Black」这一类不在此列，它本来就是一家）',
  拆.length === 0, 拆.slice(0, 6).join(' / '));
ok('7 霞鹜文楷等宽 底下读到三档 300 / 400 / 500，没有假粗 700（作者那句「还有个粗呢？哪去了？」的量：他机器上装的就是 Light/Regular/Medium）',
  档('霞鹜文楷等宽').join(',') === '300,400,500', '实得 [' + 档('霞鹜文楷等宽').join(',') + '] 脸=' + 脸('霞鹜文楷等宽'));
ok('8 中文名和英文名都登记在表里，写哪一个都读得到同一份档（CSS 里两样都可能撞上）',
  档('LXGW WenKai Mono').join(',') === 档('霞鹜文楷等宽').join(',') && 档('LXGW WenKai Mono').length === 3,
  '英文那把实得 [' + 档('LXGW WenKai Mono').join(',') + ']');
ok('9 系统直接报数的也收下（微软雅黑那一张 Light 报的是 290，不是整数档）',
  档('微软雅黑').includes(290) || 档('Microsoft YaHei').includes(290),
  '微软雅黑=[' + 档('微软雅黑').join(',') + '] / Microsoft YaHei=[' + 档('Microsoft YaHei').join(',') + ']');
const A = 表['Arial'] || [];
ok('10 Arial 这一家底下摆的每一档都是 Arial 自己那张脸（' + (脸('Arial') || '没读到') + '）；'
  + '从前那一版按名字尾巴猜，会把「Arial Black」当成 Arial 的一档摆上来，而它不在这一家底下，写下去挑不到（量过 2327 对 2044 个墨点）',
  A.length > 0 && A.every(x => !/arial black/i.test(String(x.名))), '实得 ' + JSON.stringify(A));
ok('11 每一家的档从小到大排好、同一个数不重复摆两档',
  家.every(n => { const ws = 档(n); return ws.join(',') === ws.slice().sort((a, b) => a - b).join(',')
    && new Set(ws).size === ws.length; }));
ok('12 认不出的档名不硬给数（ffWeightNum("中粗体") = ' + K.ffWeightNum('中粗体') + '，回 0 就是丢掉这一张脸）',
  K.ffWeightNum('中粗体') === 0 && K.ffWeightNum('Bold') === 700 && K.ffWeightNum('290') === 290
  && K.ffWeightNum('black') === 900 && K.ffWeightNum('ultralight') === 200);

/* ---------- 三、接线：页面读的是这一份对象，不是从前那一串名字 ---------- */
ok('13 页面那颗「重读系统字体」真强制重扫（preload 从前把 force 吞了，点它走的还是缓存）',
  /async fontList\(force\)\{[\s\S]{0,80}invoke\('font:list', !!force\)/.test(PRE));
ok('14 开机后台重数一趟并推给所有窗口；缓存那份不再有过期这一档（新装字体不该等 7 天）',
  /refreshFonts\(\);/.test(MAIN) && /webContents\.send\('font:changed'/.test(MAIN) && !/FONTS_CACHE_AGE/.test(MAIN));
ok('15 主进程那一趟正在跑时页面来问，等这一份就行，不另开子进程',
  /if\(fontsBusy\)\{ const g = await fontsBusy;/.test(MAIN));
ok('16 页面收的是 { fonts, faces } 那一份，字重表存进 State（下一次开机不用重扫也有档）',
  /absorb\(got\)\{/.test(SHF) && /State\.set\('font-w', 表\)/.test(SHF) && /a\.onFontList\(got =>/.test(SHF));
ok('17 字重不再从字体名字里猜：ffBaseOf / ffWeightOf / FF_WEIGHT_WORDS 三颗都从源码里撤了',
  !/ffBaseOf|ffWeightOf|ffWeightMark|FF_WEIGHT_WORDS/.test(SHF));
ok('18 挑档那一路吃的就是这张表（weightsOf 读 wmap，认不到才退本家那一张 400）',
  /weightsOf\(f\)\{[\s\S]{0,260}this\.wmap\[本家名\][\s\S]{0,120}w:400/.test(SHF));
ok('19 组件那头拿不到这两条通道（硬地板清单里 fontList 旁边补上了 onFontList）',
  /'fontList', 'onFontList'/.test(rd('src/_shared/sh-load.js')));

console.log('\n' + pass + ' 过 ' + fail + ' 不过（真机器 ' + 家.length + ' 家 / ' + Object.keys(表).length + ' 个名字键 / ' + 用了 + ' ms）');
process.exit(fail ? 1 : 0);
