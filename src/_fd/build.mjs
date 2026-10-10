/* FD 组装：只拼外壳骨架 —— 插件代码不进产物。
   功能住在 data\plugins\<id>\，页面开机由加载器（_shared/sh-load.js）现名单、现 import；
   哪几家不加载归 off.json 说了算，构建这边不再认名单、不再拼段、不再打说明书表。
   （发布侧的 zip / 货架仍然由 _build/packs.mjs 那把尺打包 —— 那是运输形状，不是产物内容。） */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { icodeEmbed } from '../_vendor/icode/embed.mjs';
import tree from '../_build/tree.cjs';
import { assertClean } from '../_build/scan-packs.mjs';
import uitext from '../pack/uitext.cjs';
import cardsize from '../pack/cardsize.cjs';
import { rpKernelSource } from '../_build/rp-kernel.mjs';
import { 下一号, 落账, 页名 } from '../_build/version.mjs';
import { PACK_RENAME } from '../_build/pack-rename.mjs';

const ROOT = path.resolve(import.meta.dirname);
/* 源码定在 Flow-Desk\src\_fd\ 下面，生成页面进 pages\、插件住在 data\plugins（第 15 条）：
   全按相对位置找，整个 Flow-Desk 文件夹挪盘、拷到别的电脑，生成页面的路径跟着走 */
const TREE = tree(ROOT);
const OUT_DIR = TREE.pages;
/* 版本号：真身在 src\_build\version.json，这一趟生成取「下一号」，写完页面才落账
   （失败的那一趟不记账，下一趟接着用同一个号）。产物文件名就是这串号唯一的载体，
   出包、更新标记、页面里显示的那一份都从它取，别再在别处写死第二串。 */
const 版 = 下一号();
const OUT = path.join(OUT_DIR, 页名(版));
/* 机械门槛：插件越界扫描。插件代码不再拼进产物，但它和外壳跑在同一个页面里 ——
   ES module 只藏住插件自己的顶层名字，宿主的经典脚本全局名（Store/Shell/Cover/Bus…）在模块里照样看得见，
   所以「组件只走 ctx」得由这把尺来查（禁用名表和该走的通道都在 _build/scan-packs.mjs）。
   放在最前面：先查组件再干活，越界就别生成这一版页面。 */
if(!assertClean(path.join(TREE.data, 'plugins'), '生成 Flow-Desk 页面')) process.exit(1);
/* 下面这些是外壳的骨架，一个功能都不带：存储、桌面、标题栏、设置面板、注册表、
   配色/词库/代码编辑器这些公用的底子，加上组件加载器那一半（sh-load + fd5-load 的宿主答卷）。
   从前这里还拼着一份 _shared/sh-rime.js（解析小企鹅 weasel 配色那台）：件-9 整条撤下 Rime 配色，
   它跟着从构建里摘掉，文件本身搬进 备份\2026-10-05-撤Rime配色\，没有直接删。
   fd8-tools.js 是中立工具的 FD 侧适配，必须排在 _shared/ 那几段前面；
   fd5-load.js 排在 fd8 之后：它要交上去的 DATA_PRE / ToolKv 都在那儿定义；
   fd7-help.js 排在 boot 前面：帮助文档要在启动流程跑起来之前就挂到顶栏上 */
const parts = ['../_shared/sh-rand.js','../_shared/sh-store.js','../_shared/sh-packs.js','../_shared/sh-load.js','../_shared/sh-text.js','../_shared/sh-color.js','../_shared/sh-ico.js','../_shared/sh-font.js','fd10-size.js','fd2-store.js','fd3-shell.js','fd3-lib.js','fd11-cards.js','fd12-rime-colors.js','fd13-colour-v1.js','fd9-title.js','fd4-builtin.js','fd8-tools.js','fd5-load.js',
  '../_shared/sh-style.js','../_shared/sh-look.js','../_shared/sh-doc.js','../_wcustom/wnw-custom-kernel.js',
  '../_shared/sh-ttml.js',
  '../_shared/sh-mus.js',
  '../_shared/sh-icode.js',
  '../_shared/sh-bank-ui.js','../_shared/sh-log.js','fd7-help.js'];
/* 组件定制那四份（词库底层 / 生成器 / 向导 / 改代码）从外39 起不再一份一份拼：
   它们住在 src\_wcustom\src\，由那一棵自己的 build-kernel.mjs 出成上面那一份产物。
   排的位置就是从前 sh-banks 那一格 —— 这四份全是纯声明，落在整页顶层哪一处都不影响求值，
   外壳那几只入口（改代码 / 生成向导 / 导入导出组件）判的是「这个名字在不在」，
   所以这一版没带定制代码时那些入口自己就不摆，不需要另加判空。 */
/* 组件定制那颗产物在不在：缺了就报错退出（和为写那颗同一待遇），
   加 --无定制 才允许打一版不带定制的页面 —— 那种版本上改代码、生成向导那几只入口自己就不摆。 */
const 不带定制 = process.argv.indexOf('--无定制') >= 0;
const CUSTOM = path.join(path.dirname(ROOT), '_wcustom', 'wnw-custom-kernel.js');
if(!fs.existsSync(CUSTOM)){
  if(!不带定制){
    console.error('组件定制那颗产物不在：' + CUSTOM
      + '\n  它由那一棵自己出：node src\\_wcustom\\build-kernel.mjs'
      + '\n  确实要打一版没有组件定制的页面：加 --无定制');
    process.exit(1);
  }
  parts.splice(parts.indexOf('../_wcustom/wnw-custom-kernel.js'), 1);
  console.log('这一版不带组件定制：那几只入口按「名字在不在」判，摆出来就是没有它们');
}

/* boot 排最后：加载器、注册表、外壳底子都站好了才开机 */
const BOOT = 'fd6-boot.js';

/* ---------- 为写内核：这一棵读一颗产物，不再认它的源码 ----------
   同步 GitHub 第 4 条（2026-10-09 定「为写分离」）：从前这里抓着 src\_wnw\src\ 那二十份源码，
   按名单拼一层闭包贴进来 —— 公开仓库要打得出一张页就必须留着为写的全部源码。
   现在那一趟归私有那一棵自己跑（node src\_wnw\build-kernel.mjs → src\_wnw\wnw-kernel.js），
   这边只读那颗产物，连名单都不再认。产物本身也进了 .gitignore：仓库里既没有源码也没有整包。
   闭包那层道理、名字为什么会撞、顺序为什么不能重排，全写在 build-kernel.mjs 开头。
   这一棵只认这一颗产物的路径，不再认 src\_wnw\src\ 里的任何文件名。 */
const KERNEL = path.join(path.dirname(ROOT), '_wnw', 'wnw-kernel.js');
const 不带内核 = process.argv.indexOf('--无内核') >= 0;

/* 全页唯一的一串号和那一张改名表：写在最前面，后面每一段（含为写、声笔练习那两层闭包）
   往外读到的都是这一份。用 var 不用 const —— 拼进同一个作用域的段里万一有同名声明，
   var 顶多重置，const 直接报错。 */
let js = '\n/* ==== 版本号 · 真身在 src\\_build\\version.json，这一趟生成写进来，别处不再抄一份 ==== */\n'
  + 'var FD_VERSION = ' + JSON.stringify(版) + ';\n'
  + '/* ==== 包 id 改名那一张表 · 真身在 src\\_build\\pack-rename.mjs，桌面搬家和 node 那头共用同一份 ==== */\n'
  + 'var PACK_RENAME = ' + JSON.stringify(PACK_RENAME) + ';\n';
/* 批⑤-6 · 界面文字清单：构建时把 数据\ui-text.yaml 跟着源码刷新一遍（用户在右边写过的字留着）。
   产物里不再内嵌这一份 —— 程序读的就是磁盘那一个文件（Flow-Desk.exe 问主进程，开发服务器直接发），
   第一次开机由主进程从出厂那层落到 数据\（对照着换字的是 _shared/sh-text.js）。 */
uitext.refresh(TREE.tree);
/* #251 · 卡片大小清单：同样只刷新 数据\card-size.yaml（一张卡片两行，用户写过的「你要」留着），
   不再打一份进产物；盖大小的是 _fd/src/fd10-size.js（从前它躺在 _shared\ 里，可桌面卡片只有 Flow-Desk 有） */
cardsize.refresh(TREE.tree);
function add(name, src){
  try{ new vm.Script(src, { filename:name }); }
  catch(e){ console.error('SYNTAX FAIL ' + name + ': ' + e.message); process.exit(1); }
  js += '\n/* ==== ' + name + ' ==== */\n' + src;
}
/* 内置代码编辑器的运行时和样式：打进 window.ICODE_SRC，第一次真用到才塞进 <head>
   （见 _shared/sh-icode.js）。 */
add('icode-src', icodeEmbed());
for(const p of parts) add(p, fs.readFileSync(p.startsWith('../') ? path.join(ROOT, p) : path.join(ROOT, 'src', p), 'utf8'));
/* 为写那段排在 boot 之前：它的代码一求值就把 WNW_KERNEL 挂成全局，宿主开机那一趟才递得出这份上下文 */
if(fs.existsSync(KERNEL)) add('wnw-kernel', fs.readFileSync(KERNEL, 'utf8'));
else if(不带内核) console.log('这一版不带写作内核：那张启动卡会自己说「但这一版页面里没有写作内核，开不了」');
else{
  console.error('写作内核那颗产物不在：' + KERNEL
    + '\n  它由私有那一棵出：node src\\_wnw\\build-kernel.mjs'
    + '\n  确实要打一版没有为写的页面（比如只发外壳给别人看）：加 --无内核');
  process.exit(1);
}
/* 声笔输入法练习（#343 G4）：从前那一张独立页面（rp-base.html + p1..p6 灌成一份 html，再用 iframe 嵌进来）
   同样剥成这一张页里的一层闭包。底样式、封面骨架、六份代码全部在构建期由 _build/rp-kernel.mjs 收拢，
   选择器改挂 .rp-root、递给它的 document 是容器那一份影子；往外只交一份 window.RP_KERNEL。
   和为写那段同一个位置：排在 boot 之前，宿主开机那一趟才递得出这份上下文。 */
add('rp-kernel', rpKernelSource({ version:版 }));
add(BOOT, fs.readFileSync(path.join(ROOT, 'src', BOOT), 'utf8'));

const tpl = fs.readFileSync(path.join(ROOT, 'template.html'), 'utf8');
if(!tpl.includes('/*__FD__*/')){ console.error('模板缺少 /*__FD__*/ 占位'); process.exit(1); }
/* 回调用函数形式：源码里出现 $& 之类的串不会被当成替换模式 */
const html = tpl.replace('/*__FD__*/', () => js);
try{ new vm.Script(js, { filename:'fd-bundle' }); }catch(e){ console.error('BUNDLE FAIL ' + e.message); process.exit(1); }
fs.mkdirSync(OUT_DIR, { recursive:true });
fs.writeFileSync(OUT, html, 'utf8');
/* 页面落盘了才记账：这一趟要是半路停在语法闸上，号不烧掉，下一趟还是它 */
落账(版);
console.log('SYNTAX OK');
/* 组件这一段不再进产物：开机从 data\plugins\ 加载，名单归运行时认 */
console.log('插件 · 运行时加载（构建不拼段）：' + path.join(TREE.data, 'plugins'));
console.log('WROTE ' + OUT + '  ' + Buffer.byteLength(html) + ' bytes  ' + html.split('\n').length + ' lines');
