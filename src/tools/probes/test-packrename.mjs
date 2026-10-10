/* 包 id 改名这一轮的闸（同步 GitHub 第 3 条 · 2026-10-09 他定「改程序、代码命名（本体名字和各处引用）」）
   ------------------------------------------------------------
   三件事要钉住，每一条都报数：
     一 · 那张表只有一份，而且旧名字在进仓的那几棵树里一处不剩（不留第二张嘴、也不留旧名）
     二 · 生成那一趟真的把表和号写到了页顶 —— 桌面那颗搬家方法读的是页顶那一份，不是 node 那一份
     三 · 桌面上那一趟搬家真搬得动：切 fd3-shell.js 里那一颗原文，喂一份带旧名的布局、
         一台只认新名字的注册表，量搬了几张、旧名剩几张、卡片号有没有被误改、只搬一次那条挡不挡得住
   最后咬口：把「旧名字还注册着就别动」那一句拆掉 —— 那一跑必须搬歪，
   不然说明那句闸是空的（回拽那一轮的教训：算了闸门没核落笔）。 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { ROOT, rd, 切方法, 记账 } from './lib-slice.mjs';
import { PACK_RENAME } from '../../_build/pack-rename.mjs';

const 台 = 记账('包 id 改名');
const 旧名 = Object.keys(PACK_RENAME);

/* ---------- 一 · 表只有一份，旧名清干净 ---------- */
台.题('一 · 一张表 · 旧名字在仓里还剩几处');
台.数('表上几笔', 旧名.length);
台.判('表上正是那三家，指到仓库名那一套', 旧名.length === 3
  && PACK_RENAME['your-notes'] === 'notes'
  && PACK_RENAME['to-music'] === 'music-remote'
  && PACK_RENAME['rime-practice'] === 'singbit-input-practice', PACK_RENAME);
/* 进仓的源码树里还能不能翻出旧名字（git grep 只认进仓的，docs 那一层已经不推了，不算）。
   该留的只有三处：① 改名那张表自己 —— 它的活儿就是把旧名字翻译成仓库名，翻译的左边抹不掉；
   ② 这台探针自己 —— 它要照着表把旧名字念出来才判得住（上面那两条判据就是）；
   ③ test-stategate.mjs 顶上那两句 —— 它判的是「存过的那串键两头都不打头」，
     不把改名前后的两个 id 都念出来，那条判据就是空的。
   所以判的是「除了这三处，别处一处不剩」，不是「全仓一处不剩」。
   没匹配时 git grep 的退出码是 1，那也按空表处理。 */
const 该留 = ['src/_build/pack-rename.mjs', 'src/tools/probes/test-packrename.mjs',
  'src/tools/probes/test-stategate.mjs'];
let 全 = '';
try{ 全 = execSync('git -C "D:/Programs/Flow-Desk" -c core.quotePath=false grep -l -E "your-notes|to-music|rime-practice" -- src pages icons data',
  { encoding:'utf8' }).trim(); }
catch(e){ if(String(e.status) !== '1' || e.stdout.trim()) throw e; }
const 剩 = 全.split(/\r?\n/).filter(x => x && !该留.includes(x));
台.数('除那张表和这台探针之外还带旧名的文件', 剩.length);
台.判('源码 / 图标 / 插件树里一处旧名不剩，旧名字只活在改名那张表和这台探针上',
  剩.length === 0 && 该留.every(n => 全.includes(n)), 剩.join(' | ') || 全 || '（连表里都找不到旧名了，那这张表改了形状）');
/* 盘上那一格：目录名、插件清单 id、名单三样都得跟着换，缺一样就是「一半新一半旧」 */
const 格 = ROOT + 'data/plugins';
const 目录 = fs.readdirSync(格).filter(n => fs.statSync(格 + '/' + n).isDirectory());
const 插件清单 = {};
for(const d of 目录) if(fs.existsSync(格 + '/' + d + '/manifest.json'))
  插件清单[d] = JSON.parse(fs.readFileSync(格 + '/' + d + '/manifest.json', 'utf8')).id;
const 名单 = JSON.parse(fs.readFileSync(格 + '/off.json', 'utf8')).off;   /* 外41 六段起这份记的是「被卸掉的」 */
台.数('插件格', 目录.join('、'));
台.数('卸掉的', 名单.length ? 名单.join('、') : '（一家都没卸）');
台.判('三家新名字在目录和插件清单两处都对得上，旧名字一处没有；卸掉那份名单不认旧名',
  ['notes','music-remote','singbit-input-practice']
    .every(n => 目录.includes(n) && 插件清单[n] === n)
  && !目录.some(n => 旧名.includes(n)) && !名单.some(n => 旧名.includes(n))
  /* 家数不钉死：外39 起组件定制也成了一家（wnw-custom），钉死一个数就是每加一家要改一台探针。
     名单反着记之后要判的是「off 里不许有盘上不存在的家」（卸掉的家必须真在那一格里有名字），
     以及这一棵树至少出厂那几家在。 */
  && 名单.every(x => 目录.includes(String(x))) && 目录.length >= 7,
  目录.length + ' 格 / 卸掉 ' + 名单.length + ' 项 · 差在：'
  + (名单.filter(x => !目录.includes(String(x))).join('、') || '没有'));
台.判('插件清单里的中文名一个字没动（界面上叫的还是「你的便签」）',
  插件清单['notes'] === 'notes' && JSON.parse(fs.readFileSync(格 + '/notes/manifest.json', 'utf8')).name === '你的便签'
  && JSON.parse(fs.readFileSync(格 + '/music-remote/manifest.json', 'utf8')).name === '音乐遥控器',
  JSON.parse(fs.readFileSync(格 + '/notes/manifest.json', 'utf8')).name);

/* ---------- 二 · 表和号被写在页顶 ---------- */
台.题('二 · 生成那一趟往页顶写的那两句');
const 装配 = rd('src/_fd/build.mjs');
台.判('build.mjs 往页顶写 FD_VERSION（号只从 version.json 那一格来）',
  装配.includes("'var FD_VERSION = ' + JSON.stringify(版)"));
台.判('build.mjs 往页顶写 PACK_RENAME（桌面那颗搬家读的就是这一份）',
  装配.includes("'var PACK_RENAME = ' + JSON.stringify(PACK_RENAME)"));
台.判('为写内核那份答卷交的是页顶那个号（源码里没有第二串字面量）',
  rd('src/_wnw/wnw-kernel.js').includes('version:FD_VERSION'));
台.判('声笔练习那份的号由调用方传进来（rp-kernel.mjs 里不再自己钉一串）',
  rd('src/_build/rp-kernel.mjs').includes('JSON.stringify(o.version)'));

/* ---------- 三 · 桌面上那一趟搬家 ---------- */
台.题('三 · 桌面搬家（切 fd3-shell.js 那一颗原文）');
const 壳 = rd('src/_fd/src/fd3-shell.js');
const 一颗 = 切方法(壳, '  改名搬家(){');   /* 头里那一格缩进要给全：切方法认的是「换行 + 头」 */
/* init 里的顺序也是承重的一部分：搬家必须排在 pruneMissing 之前 */
const 位 = 壳.indexOf('this.改名搬家();'), 剪位 = 壳.indexOf('this.pruneMissing();');
台.数('搬家那一句在第 ' + 位 + ' 个字 · pruneMissing 在第 ' + 剪位 + ' 个字', 剪位 - 位);
台.判('搬家排在「认不出就剪掉」之前（不然旧名那几张先被当成卸了包抹掉）', 位 >= 0 && 位 < 剪位);

/* 把那一颗方法端进一台假壳：注册表、设置、页顶那张表全是我造的，跑的是原文 */
function 跑(布局, 注册, 拆闸){
  let 体 = 一颗;
  if(拆闸) 体 = 体.replace('if(Registry.has(旧)) continue;', '/* 这一句闸被拆掉了 */');
  if(拆闸 && 体 === 一颗) throw new Error('咬口没咬到地方：那一句闸在源码里改了形状，这一台的对照要跟着改');
  const 记 = {};
  const Settings = { get:(k, fb) => (k in 记 ? 记[k] : fb), set:(k, v) => { 记[k] = v; } };
  const Registry = { has:w => 注册.includes(w) };
  const 自 = { layout:{ items:布局 } };
  const 对 = new Function('Settings', 'Registry', 'PACK_RENAME', 'console', 'return {' + 体 + '}')
    (Settings, Registry, PACK_RENAME, { log(){} });
  return { n:对.改名搬家.call(自), 布局, 记 };
}
const 六张 = () => ([
  { id:'your-notes-mv04ycid', widget:'your-notes' },
  { id:'tool-to-music-mv04yfen', widget:'tool-to-music' },
  { id:'rime-practice-mv04ygzk', widget:'rime-practice' },
  { id:'schedule-mv04ye5s', widget:'schedule' },
  { id:'your-sentences-mv04yb0f', widget:'your-sentences' },
  { id:'why-not-write-mv04ymkz', widget:'why-not-write' }
]);
const 新注册 = ['notes','tool-music-remote','singbit-input-practice','schedule','your-sentences','why-not-write'];

const 一跑 = 跑(六张(), 新注册, false);
台.数('搬了几张', 一跑.n);
台.数('搬完之后 widget', 一跑.布局.map(it => it.widget).join('、'));
台.判('该搬的三张全搬到了新 id（工具卡那张的 tool- 前缀跟着换）', 一跑.n === 3
  && 一跑.布局[0].widget === 'notes' && 一跑.布局[1].widget === 'tool-music-remote'
  && 一跑.布局[2].widget === 'singbit-input-practice', 一跑.n);
台.判('旧 widget 一张不剩', 一跑.布局.filter(it => 旧名.includes(it.widget)
  || 旧名.includes(String(it.widget).replace(/^tool-/, ''))).length === 0,
  一跑.布局.map(it => it.widget).join('、'));
台.判('卡片号一个字没动（it.id 是宿主发的号，动它就要动 IndexedDB 里那一堆键）',
  一跑.布局.map(it => it.id).join('、') === 六张().map(it => it.id).join('、'), 一跑.布局.map(it => it.id).join('、'));
台.判('不在表上那三家原样不动', ['schedule','your-sentences','why-not-write']
  .every(w => 一跑.布局.some(it => it.widget === w)));
台.数('设置里那一笔记成了', 一跑.记.packRenameDone);
const 二跑 = 跑(一跑.布局, 新注册, false);
台.数('第二次跑又搬了几张', 二跑.n);
台.判('只搬一次：第二次跑搬 0 张（设置里那一笔挡住了）', 二跑.n === 0, 二跑.n);

/* 旧名字还注册着（有人手动放回了旧包）：那一张不该动 */
const 三跑 = 跑(六张(), 新注册.concat(['your-notes']), false);
台.数('旧名还注册着的时候搬了几张', 三跑.n);
台.判('旧名字还在注册表里就不动那一张', 三跑.n === 2 && 三跑.布局[0].widget === 'your-notes', 三跑.n);
/* 新名字没装进来：不该动，那张归 pruneMissing 按卸载剪 */
const 四跑 = 跑(六张(), 新注册.filter(w => w !== 'notes'), false);
台.数('新名没装的时候搬了几张', 四跑.n);
台.判('新的没注册就不动（那张交给 pruneMissing 按卸载处理）', 四跑.n === 2 && 四跑.布局[0].widget === 'your-notes', 四跑.n);
/* 咬口 */
const 五跑 = 跑(六张(), 新注册.concat(['your-notes']), true);
台.数('拆掉那一句闸之后搬了几张', 五跑.n);
台.判('咬口 · 拆掉「旧名还注册着就别动」，那一跑必须搬歪（3 张全搬才说明闸在承重）', 五跑.n === 3, 五跑.n);

台.收尾();
