/* 外30 乙组 · 图1「目录、光标闪烁」+ 图7「界面弹动、闪烁」
   量出来两条根，一条是真漏、一条是口径：
   ① 漏监听：目录那一屏（panel-ch）从前订总线用的是裸 Bus.on，而它交回的 unmount 是空的 ——
      左栏每重画一次就多攒一对监听；而「打字 1.2 秒自动保存」那一条路本身就在重画左栏
      （Desk.drawLeft 是把整块壳换掉、面板 render 又是异步的，中间空一帧就是一闪）。
      于是越打越多：第 N 次保存会牵出 N 趟整列重画。这就是「越打越闪 / 弹动」。
   ② 章纲那一页（olList）写着 vsum / book 两个名字，可这两个名字只住在 tree() 里面 ——
      行尾一开「比值」那一档就抛 ReferenceError，整块左栏空掉。
   改法：监听换成 ctx.on（卸屏时由 Desk.render 统一解）；存盘那一趟不再重画左栏，改成「就地刷新」
   —— 只把变了的字写回原来那几个格子。这一台就把这两条钉住：
   一、全仓 Bus.on 台账（多一处没归类的就报；Views.reg 那一屏里一律只许 ctx.on）
   二、就地刷新 的账（真源码切出来跑）：比值 / 累计 / 收卷三种口径和 tree() 一字不差
   三、只写变了的那几格
   四、咬口
   边界替身：Work / chWords / State / DOM 全给假的，就地刷新 与 字数账 两颗是仓库里那一份原文。 */
import vm from 'node:vm';
import fs from 'node:fs';
import { rd, 切, 切方法, 记账 } from './lib-slice.mjs';

const R = 记账('test-flicker');
const W8 = rd('src/_wnw/src/w8-write.js');

/* ---------- 一、全仓 Bus.on 台账 ---------- */
const 目录 = ['src/_wnw/src', 'src/_fd/src', 'src/_shared'];
const 全部 = [];
for(const d of 目录) for(const f of fs.readdirSync('D:/Programs/Flow-Desk/' + d))
  if(/\.js$/.test(f)) for(const [i, 行] of rd(d + '/' + f).split('\n').entries())
    if(/Bus\.on\(/.test(行)) 全部.push({ 处:d + '/' + f + ':' + (i + 1), 行:行.trim(), 文:f });
/* 已逐条看过、各自有解绑那一只手的：写在台账里，多出来的一条都不许悄悄进来 */
const 台账 = new Map([
  ['Bus.on(\'pack:reload\'', '模块顶层一次，进程活着就一直要'],
  ['if(!this._wired){ this._wired = true; Bus.on(\'theme\'', '自己上闩：_wired 只订一次'],
  ['const offLook = Bus.on(\'look\'', '自己解：画完发现节点离了档就 offLook()'],
  ['Bus.on(\'desk:saved\', () => this.tick())', '热力图：三颗都收进 off 数组，交给 ctx.dispose 解'],
  ['Bus.on(\'desk:cards\', () => this.tick())', '同上'],
  ['Bus.on(\'desk:insp\', () => this.tick())', '同上'],
  ['Bus.on(\'bank-saved\'', '词库：_bound 那一本上闩，一份词库只订一次'],
  ["Bus.on('bank:' + b.which", '生成器：GEN_BOUND 那一本上闩'],
  ['on(k, f){ offs.push(Bus.on(k, f)); }', '这一颗就是解法本身：Desk.render 给的 ctx.on，收进 offs 卸屏时统一解'],
  ['const on = this.ctx.on || ((k, f) => Bus.on(k, f));', '章视图：有 ctx 就走 ctx.on，退到 Bus.on 那条只在拿不到 ctx 时']
]);
R.题('一、全仓 Bus.on 台账（Views.reg 那一屏里一律只许 ctx.on）');
{
  const 没归类 = [];
  for(const x of 全部) if(![...台账.keys()].some(k => x.行.includes(k))) 没归类.push(x);
  R.判('全仓 ' + 全部.length + ' 颗 Bus.on 一颗颗都归了类（没归类 ' + 没归类.length + ' 颗）',
    没归类.length === 0, 没归类.map(x => x.处 + ' ' + x.行).join(' | '));
  /* Views.reg 的那一屏：交回的是 { unmount }，可框架只解 ctx.on 那一条链，裸 Bus.on 在里面就是漏 */
  const 屏里 = [];
  for(const x of 全部){
    const 源 = rd(x.处.split(':')[0]);
    const 行号 = +x.处.split(':')[1];
    const 前 = 源.split('\n').slice(0, 行号 - 1).join('\n');
    const 开 = 前.lastIndexOf('Views.reg(');
    if(开 < 0) continue;
    /* 从 Views.reg( 起配对到那一颗闭合：这一屏的整块范围 */
    let d = 0, i = 开 + 'Views.reg'.length, 关 = -1;
    for(; i < 源.length; i++){ const c = 源.charCodeAt(i); if(c === 40) d++; else if(c === 41){ d--; if(!d){ 关 = i; break; } } }
    const 起 = 源.slice(0, 开).length;
    if(关 > 起 && x.处.split(':')[1] > 0){
      const 本行 = 源.split('\n').slice(0, 行号 - 1).join('\n').length;
      if(本行 > 起 && 本行 < 关) 屏里.push(x);
    }
  }
  R.判('没有一颗裸 Bus.on 落在 Views.reg 那一屏里（量到 ' + 屏里.length + ' 颗）',
    屏里.length === 0, 屏里.map(x => x.处).join(' | '));
  R.判('目录那一屏订的是 ctx.on（卸屏时框架统一解）',
    /ctx\.on\('desk:saved', \(\) => 就地刷新\(\)\)/.test(W8) && !/Bus\.on\('desk:saved', onSaved\)/.test(W8),
    /ctx\.on\('desk:saved'[^\n]*/.exec(W8));
  R.判('自动保存那一条路上不再重画左栏（Desk.drawLeft 从 save 里撤了）',
    !/await Work\.saveCh\(this\.c\);[\s\S]{0,240}Desk\.drawLeft\(\)/.test(W8),
    /async save\(manual\)\{[\s\S]{0,600}/.exec(W8)[0].split('\n').slice(0, 12).join(' ⏎ '));
  R.判('章标题那一格打字也不再重画左栏',
    !/c\.title = e\.target\.value; this\.dirty\(\); Desk\.drawLeft\(\)/.test(W8),
    /c\.title = e\.target\.value;[^\n]*/.exec(W8));
  R.判('图7 第二条：章纲那一页现在自己取字数账（vsum / book 不再是从 tree() 里够不着的名字）',
    /const olList = \(\) => \{[\s\S]{0,200}const \{ vsum, book \} = 字数账\(\)/.test(W8),
    /const olList = \(\) => \{[\n][\s\S]{0,180}/.exec(W8)[0].replace(/\n/g, ' ⏎ '));
}

/* ---------- 二、就地刷新 的账（真源码切出来跑） ---------- */
const 起 = W8.indexOf('Views.reg(\'panel-ch\'');
const 字数 = 切方法(W8, '    const 字数账 = () => {', 起);
const 刷新 = 切方法(W8, '    const 就地刷新 = () => {', 起);
const 码 = `
${切(W8, 'cntTxt')}
${字数};
${刷新};
this.件 = { 就地刷新, 字数账, cntTxt };
`;
function 台(书, 设, 码文){
  const 沙 = { R, 书 };
  vm.createContext(沙);
  /* 假 DOM：格子用带读写的属性，写了没变的那一格也算一次 —— 那一「写」就是肉眼看见的一闪 */
  vm.runInContext(`
    function 格(初){ let 文 = String(初 == null ? '' : 初), 写 = 0;
      return { get textContent(){ return 文; }, set textContent(x){ 文 = String(x); 写++; }, get 写(){ return 写; } }; }
    function 行(类){ const e = { 类:(类 || []).slice() };
      e.classList = { contains:c => e.类.includes(c),
        toggle(c, 开){ const i = e.类.indexOf(c); if(开 && i < 0) e.类.push(c); if(!开 && i >= 0) e.类.splice(i, 1); } };
      return e; }
  `, 沙);
  vm.runInContext(`
    var 屏 = [];
    var listSt = ${JSON.stringify(Object.assign({ cum:false, quick:false, den:'off' }, 设 || {}))};
    var Work = { cur:'A', totalWords:() => 书.全书, orderedChs:() => 书.序 };
    var b = { chGoal:0, vols:[], chs:书.序 };
    var chWords = m => m.w;
    var goalOf = m => m.goal || b.chGoal || 0;
  `, 沙);
  vm.runInContext(码文 || 码, 沙);
  Object.assign(沙, 沙.件);
  沙.书 = 书;
  return 沙;
}
/* 一行格子：把 tree() 里那几颗闭包原样搭出来（本 / 分 / 标 / 收），交给真 就地刷新 去算 */
function 记(沙, 录){
  const r = Object.assign({ 名:沙.格(录.文 ? 录.文() : ''), 数:沙.格(''), 行:沙.行(['wnw-ch']) }, 录);
  沙.屏.push(r); return r;
}
const 章 = (沙, m, 累) => 记(沙, { kind:'ch', id:m.id, 文:() => m.title, 本:() => 沙.chWords(m),
  分:(全书, v和) => 沙.listSt.den === 'vol' ? (v和[m.vid] || 0) : 沙.listSt.den === 'book' ? 全书 : 0,
  标:() => 沙.goalOf(m), 累:累 });
const 卷 = (沙, v, chs) => 记(沙, { kind:'vol', id:v.id, 文:() => v.title,
  本:() => chs.reduce((a, c) => a + c.w, 0), 分:(全书) => 沙.listSt.den === 'off' ? 0 : 全书,
  标:() => 0, 收:() => !!v.collapsed });

R.题('二、就地刷新 的账：比值 + 累计 + 收卷（口径必须和整列重画那一份一字不差）');
{
  const A = { id:'A', vid:'V1', title:'甲', w:100 }, B = { id:'B', vid:'V1', title:'乙', w:50 },
    C = { id:'C', vid:'V2', title:'丙', w:30 };
  const 书 = { 全书:180, 序:[A, B, C] };
  const 沙 = 台(书, { den:'vol', cum:true });
  const V1 = { id:'V1', title:'第一卷' }, V2 = { id:'V2', title:'第二卷', collapsed:true };
  卷(沙, V1, [A, B]); 章(沙, A); 章(沙, B); 卷(沙, V2, [C]);
  const n = 沙.就地刷新();
  const 得 = 沙.屏.map(r => r.数.textContent);
  R.判('卷行：本卷 150 / 全书 180 | 累计到本卷 150', 得[0] === 沙.cntTxt(150, 180, 150, 0), 得[0]);
  R.判('章行甲：100 / 本卷 150 | 累计 100', 得[1] === 沙.cntTxt(100, 150, 100, 0), 得[1]);
  R.判('章行乙：50 / 本卷 150 | 累计 150（一路加下来的，不是各算各的）', 得[2] === 沙.cntTxt(50, 150, 150, 0), 得[2]);
  R.判('收起来的卷：30 / 180 | 180（本卷的数照样并进累计，后面接着加不会断档）', 得[3] === 沙.cntTxt(30, 180, 180, 0), 得[3]);
  R.数('这一趟报了几格（四格起步是空的，都该写）', n);
  R.判('第一趟四格都写了（数一下真写了几次）', 沙.屏.every(r => r.数.写 === 1), 沙.屏.map(r => r.数.写).join(','));
  const 再 = 沙.就地刷新();
  R.判('数字没动时一格都不许写（写了就是白闪一下）：第二趟报 ' + 再 + ' 格、真写 ' + 沙.屏.map(r => r.数.写).join('') ,
    再 === 0 && 沙.屏.every(r => r.数.写 === 1), 再);
  A.w = 120; 书.全书 = 200;
  const 三 = 沙.就地刷新();
  const 得2 = 沙.屏.map(r => r.数.textContent);
  R.判('甲改了字：卷行跟着变 170 / 200 | 170', 得2[0] === 沙.cntTxt(170, 200, 170, 0), 得2[0]);
  R.判('甲自己变 120 / 170 | 120', 得2[1] === 沙.cntTxt(120, 170, 120, 0), 得2[1]);
  R.判('乙没改字但累计跟着挪：50 / 170 | 170', 得2[2] === 沙.cntTxt(50, 170, 170, 0), 得2[2]);
  R.判('收着的卷也挪：30 / 200 | 200', 得2[3] === 沙.cntTxt(30, 200, 200, 0), 得2[3]);
  R.判('四格都真变了 → 报 4 格、每格只写一次：量到 ' + 三 + ' / ' + 沙.屏.map(r => r.数.写).join(','),
    三 === 4 && 沙.屏.every(r => r.数.写 === 2), 三 + ' / ' + 沙.屏.map(r => r.数.写).join(','));
  const 当 = 沙.屏[0].行.类.join(',');
  C.w = 31; 书.全书 = 201;
  沙.就地刷新();
  R.判('只有丙改了字：甲乙两格一次都不许多写（一屏几十行不该被连累）',
    沙.屏[1].数.写 === 2 && 沙.屏[2].数.写 === 2 && 沙.屏[3].数.写 === 3, 沙.屏.map(r => r.数.写).join(','));
  R.数('当前那一行的亮块有没有被这一趟动过（不该动）', 当 + ' → ' + 沙.屏[0].行.类.join(','));
  A.title = '甲改过名';
  沙.就地刷新();
  R.判('标题改了也就地换字（不重画整列）', 沙.屏[1].名.textContent === '甲改过名', 沙.屏[1].名.textContent);
}
R.题('二b、三档比值各算各的（off / book / 单章目标）');
{
  const A = { id:'A', vid:'V1', title:'甲', w:100, goal:200 };
  const 沙 = 台({ 全书:100, 序:[A] }, { den:'off', cum:false });
  章(沙, A);
  沙.就地刷新();
  R.判('off 那一档：只写自己的数 + 目标完成度 50%（没有斜杠）', 沙.屏[0].数.textContent === '100 · 50%', 沙.屏[0].数.textContent);
  const 沙2 = 台({ 全书:100, 序:[A] }, { den:'book', cum:true });
  章(沙2, A); 沙2.就地刷新();
  R.判('book 那一档 + 累计：100/100 | 100 · 50%', 沙2.屏[0].数.textContent === '100/100 | 100 · 50%', 沙2.屏[0].数.textContent);
  const 沙3 = 台({ 全书:100, 序:[A] }, { den:'off', cum:false });
  章(沙3, A, false); 沙3.就地刷新();
  R.判('章纲那一页不吃累计那一档（累:false）：100 · 50%', 沙3.屏[0].数.textContent === '100 · 50%', 沙3.屏[0].数.textContent);
}

/* ---------- 三、咬口 ---------- */
R.题('三、咬口（改坏一句，上面那条必须变红）');
{
  /* 咬口一：把「收起来的卷也要并进累计」那一句拿掉 —— 收卷后面还排着别行时，那一行往后全算错。
     （收卷排在最后一行时两种算法碰巧一样，所以这一份把 V3 摆在收着的 V2 后面） */
  const 坏 = 刷新.replace('else cum = r.收() ? (run += own) : run + own;', 'else cum = run + own;');
  if(坏 === 刷新) R.判('咬口一没咬到：找不到收卷那一句', false, '');
  else {
    const a = { id:'A', vid:'V1', title:'甲', w:100 }, b2 = { id:'B', vid:'V1', title:'乙', w:50 },
      c2 = { id:'C', vid:'V2', title:'丙', w:30 }, d2 = { id:'D', vid:'V3', title:'丁', w:10 };
    const 摆 = 沙 => {
      卷(沙, { id:'V1', title:'第一卷' }, [a, b2]); 章(沙, a); 章(沙, b2);
      卷(沙, { id:'V2', title:'第二卷', collapsed:true }, [c2]);
      卷(沙, { id:'V3', title:'第三卷' }, [d2]); 章(沙, d2);
    };
    const 对 = 台({ 全书:190, 序:[a, b2, c2, d2] }, { den:'vol', cum:true });
    摆(对); 对.就地刷新();
    const 准 = 对.屏[4].数.textContent;
    const 沙 = 台({ 全书:190, 序:[a, b2, c2, d2] }, { den:'vol', cum:true }, 码.replace(刷新, 坏));
    摆(沙); 沙.就地刷新();
    const 得 = 沙.屏[4].数.textContent;
    R.判('咬口一：收着的卷不并进累计之后，它后面那一卷算成 ' + 得 + '（真身是 ' + 准 + '，整列往后全偏 30）',
      得 !== 准, 得 + ' / ' + 准);
  }
  /* 咬口二：把「数字没变就不写」那一句拆掉 —— 第二条的「第二趟 0 次」必须变红 */
  const 坏二 = 刷新.replace('if(r.数.textContent !== 文){ r.数.textContent = 文; 改++; }', 'r.数.textContent = 文; 改++;');
  if(坏二 === 刷新) R.判('咬口二没咬到：找不到那一句「变了才写」', false, '');
  else {
    const 沙 = 台({ 全书:100, 序:[{ id:'A', vid:'V1', title:'甲', w:100 }] }, { den:'off' }, 码.replace(刷新, 坏二));
    章(沙, 沙.Work.orderedChs()[0]);
    沙.就地刷新();
    const 二 = 沙.就地刷新();
    R.判('咬口二：拆掉「变了才写」之后，数字没动的第二趟照样写了 ' + 二 + ' 格（第二条判法当场失效）', 二 > 0, 二);
  }
}

R.收尾();
