/* 外31 三组 · 打字练习取消独立外观、独立字体设置（作者 2026-10-08 的原话：
   「开始做这些意见的修改 另外：打字练习取消独立外观、独立字体设置，跟随全局外观、字体」）
   这一台判的是「撤干净」和「接上宿主的名字」两头：
   · 撤干净 —— 练习器自己那套配色（内置两张表 + 从 weasel.yaml 读主题 + 一整套换算）、两档圆角滑杆、
     字号滑杆、字体设置那两张动态字体，源码里一个名字、界面里一格都不许留；
   · 接上 —— 底样式和运行时注入那几条读的是宿主钉在真根元素上的 --r-card / --r-btn / --fd-font / --fd-mono，
     宿主那一头确实钉了这几个名字（不然练习器读到的是兜底值，改圆角看不见动）。
   全部从真源码里切，不抄第二份。判之前先把注释剥掉：这一轮故意在注释里写了「从前那一段叫什么、为什么撤」，
   拿原文做「名字不许出现」的判定会把自己的说明当成残留。 */
import fs from 'node:fs';
const R = 'D:/Programs/Flow-Desk/';
const BASE = fs.readFileSync(R + 'src/_build/rp-base.html', 'utf8');
const KERNEL = fs.readFileSync(R + 'src/_build/rp-kernel.mjs', 'utf8');
const P = {};
for(const n of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) P[n] = fs.readFileSync(R + 'src/_build/' + n + '.js', 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if(c){ pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (x ? ' · ' + x : '')); } };
const count = (s, sub) => s.split(sub).length - 1;
/* 剥注释：块注释整段去掉，整行 // 那一种把这一行换成空行。
   行首才是 // 才算行注释 —— 中间出现的可能是正则或字符串里的一对斜杠，不能动。 */
function 剥(s){
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^([ \t]*)\/\/.*$/gm, '');
}
const 剥HTML = s => s.replace(/<!--[\s\S]*?-->/g, '');

/* 底样式那一段 = <style> 到 </style>；界面那一段 = <body…> 到第一个 <script>。
   两个边界都从真文件里现量，位置挪了照样切得对。 */
function cssSeg(){
  const i = BASE.indexOf('<style'), j = BASE.indexOf('</style>');
  if(i < 0 || j < 0) throw new Error('底座里没有 <style> 那一段');
  return 剥(BASE.slice(BASE.indexOf('>', i) + 1, j));
}
function htmlSeg(){
  const m = /<body[^>]*>/.exec(BASE);
  const k = m ? BASE.indexOf('<script', m.index) : -1;
  if(!m || k < 0) throw new Error('底座里没有 <body>…<script> 那一段');
  return 剥HTML(BASE.slice(m.index + m[0].length, k));
}
const CSS = cssSeg(), HTML = htmlSeg();
const ALL = Object.values(P).map(剥).join('\n');
const RAW = Object.values(P).join('\n');
const P6 = 剥(P.p6);
const SHELL = 剥(fs.readFileSync(R + 'src/_fd/src/fd3-shell.js', 'utf8'));

/* ---------- 一、界面里那三格撤干净 ---------- */
for(const id of ['radiusSlider', 'radiusVal', 'ctlRadiusSlider', 'ctlRadiusVal', 'cardFree', 'ctlFree',
                 'fontSizeSlider', 'fontSizeVal', 'colorSchemeSelect', 'cselBtn', 'cselMenu', 'cselLabel',
                 'cselBtnDots', 'fontInputCN', 'fontInputEN', 'fontCardCN', 'fontCardEN',
                 'fontStatusCN', 'fontStatusEN', 'fontUnloadCN', 'fontUnloadEN']){
  ok('1 界面里没有 id="' + id + '" 那一格', !HTML.includes('id="' + id + '"'));
}
ok('2 界面里没有「外观」那个段头了', !/group-title">[^<]*外观/.test(HTML), /group-title">[^<]*外观/.exec(HTML));
ok('2 界面里没有「字体」那个段头了', !/group-title">[^<]*字体/.test(HTML));
ok('2 界面里没有「配色」那个段头了', !/group-title">[^<]*配色/.test(HTML));
ok('3 界面里的文件格只剩方案基础与练习文本两格',
  JSON.stringify([...HTML.matchAll(/data-key="([^"]+)"/g)].map(m => m[1])) === JSON.stringify(['schema', 'textPractice']),
  [...HTML.matchAll(/data-key="([^"]+)"/g)].map(m => m[1]).join(','));
const nRange = count(HTML, 'type="range"');
ok('3 界面里不再有一条滑杆（圆角两根 + 字号一根全撤，实剩 ' + nRange + ' 根）', nRange === 0);

/* ---------- 二、底样式读的是宿主那两个名字 ---------- */
ok('4 底样式里一条 --ctl-radius 都不留（练习器从前那一档控件圆角的名字）', count(CSS, '--ctl-radius') === 0);
ok('4 底样式里一条裸 var(--radius) 都不留（宿主的 --radius 是控件那一档，卡片不许读它）',
  count(CSS, 'var(--radius)') === 0);
const nCard = count(CSS, 'var(--r-card'), nBtn = count(CSS, 'var(--r-btn');
ok('4 卡片那一档改吃宿主的 --r-card（' + nCard + ' 处）、控件那一档改吃 --r-btn（' + nBtn + ' 处）',
  nCard >= 5 && nBtn >= 10, nCard + ' / ' + nBtn);
ok('5 底样式里不再钉 --radius（:root 那一格会被收进容器，钉了就等于顶掉宿主的控件圆角）',
  !/--radius\s*:/.test(CSS), /--radius\s*:[^;}]*/.exec(CSS));
ok('5 底样式里不再钉那串色号（--page-bg / --card-bg / --accent 全交回宿主）',
  !/--(page-bg|card-bg|card-border|text|text-light|accent|sel-bg|sel-text)\s*:/.test(CSS),
  /--(page-bg|card-bg|sel-bg)\s*:[^;}]*/.exec(CSS));
ok('5 正文吃宿主的 --fd-font', CSS.includes('font-family:var(--fd-font,'));
ok('6 等宽那两处吃宿主的 --fd-mono（公式 + 按键那一条、英文编码区那一格）',
  count(CSS, 'var(--fd-mono') === 2 && /\.km-formula,\.km-key\{[^}]*--fd-mono/.test(CSS) && /\.ec-code\{[^}]*--fd-mono/.test(CSS));
ok('6 自定义配色下拉那一套样式（.csel）一处不留', count(CSS, '.csel') === 0, count(CSS, '.csel') + ' 处');

/* ---------- 三、六份代码里那套机器撤干净 ---------- */
for(const name of ['lookApply', 'lookSurfaces', 'lookLocal', 'lookCfg', 'paintTheme', 'applyTheme', 'fdThemeName',
                   'initLookDom', 'syncLookRows', 'clampR', 'customSchemes', 'parseColorSchemes', 'parseIndentTree',
                   'rebuildSchemeOptions', 'analyzeScheme', 'autoColors', 'colorSchemeSelect', 'radiusSlider',
                   'fontSizeSlider', 'fontSizeVal', 'renderCselMenu', 'syncCselLabel', 'openCsel', 'closeCsel',
                   'loadFont', 'CTL_DEF', 'CARD_DEF', 'hex0x', 'themes']){
  ok('7 六份代码里不再出现名字「' + name + '」', !ALL.includes(name));
}
ok('8 六份代码里没有那一排换算函数（换算归 _shared/sh-color.js 那一份）',
  !/\bcv_(hexRgb|rgbHsl|hslRgb|mix|adjust|lum|contrast|ensure)\b/.test(ALL));
const pins = [...ALL.matchAll(/documentElement\.style\.setProperty\('(--[a-z-]+)'/g)].map(m => m[1]);
ok('8 运行时往根上钉的变量只剩 --vsc 那一条（这一格自己的缩放，不是外观设定）',
  pins.join(',') === '--vsc', pins.join(','));
const nTheme = [...ALL.matchAll(/setProperty\('--(page-bg|card-bg|text|accent)'/g)];
ok('8 六份代码里不再自己算色号并写下去', nTheme.length === 0, nTheme.map(m => m[1]).join(','));
ok('9 撤外观不许连练习设置一起带走：练习模式 / 强度 / 提示强度三条照旧读',
  /store\.practiceMode=settings\.practiceMode|let _pm=settings\.practiceMode/.test(P6) &&
  /store\.practiceIntensity=settings\.practiceIntensity/.test(P6) &&
  /store\.tfIntensity=/.test(P6));

/* ---------- 四、落库那一份不再存外观 ---------- */
const save = /function saveSettings\(\)\{[\s\S]*?\n\}/.exec(P6);
ok('10 找到了 saveSettings（切不到就说明那一段改名了）', !!save);
if(save){
  ok('10 落库里不再存 theme / radius / radiusCtl / fontSize 那四条',
    !/\b(theme|radius|radiusCtl|fontSize):/.test(save[0]), save[0].replace(/\s+/g, ' ').slice(0, 140));
  ok('10 练习那几条照旧落库',
    /practiceMode:/.test(save[0]) && /practiceIntensity:/.test(save[0]) && /tfIntensity:/.test(save[0]));
}
ok('10 恢复上次会话那一路不再读 settings 里那四条外观',
  !/settings\.(theme|radius|radiusCtl|fontSize)/.test(ALL));

/* ---------- 五、宿主那一头确实递得到 ---------- */
ok('11 宿主把卡片档钉成 --r-card、控件档钉成 --r-btn（练习器读的就是这两个名字）',
  SHELL.includes("setProperty('--r-card'") && SHELL.includes("setProperty('--r-btn'"));
ok('11 宿主把等宽那一份钉成 --fd-mono（练习器那两处等宽吃它）', SHELL.includes("setProperty('--fd-mono'"));
ok('11 宿主把正文那一份钉成 --fd-font', SHELL.includes("setProperty('--fd-font'"));
const keep = /var KEEP = \{[^}]*\}/.exec(KERNEL);
ok('12 拼装那把尺的 KEEP 表里不再收 --radius（收了就会在容器里顶掉宿主）',
  !!keep && !keep[0].includes('--radius'), keep && keep[0].replace(/\s+/g, ' '));
ok('12 拼装那两处补丁锚照旧在（撤代码不许碰掉那两条 mustReplace：量窗口那一句 + 字频表那一格）',
  RAW.includes('innerWidth/1560,innerHeight/900') && RAW.includes('/*__CHARFREQ__*/'),
  '量窗口 ' + RAW.includes('innerWidth/1560,innerHeight/900') + '，字频表 ' + RAW.includes('/*__CHARFREQ__*/'));
ok('12 三栏照旧挂 data-look（共享外观层接管它们的底、影子和纹理）',
  P6.includes("querySelectorAll('.col').forEach(el => el.setAttribute('data-look',''));"));

console.log('练习器跟随全局外观 · ' + pass + ' 过 / ' + fail + ' 没过');
if(fail) process.exitCode = 1;
