/* ============================================================
   一个运行时 + 三个 exe，全平铺在 Flow-Desk\ 这一层：
   不装、不写注册表、不各自为战 —— FD / WNW / RP 不是三个文件夹，是三个 exe。
   做法是把 node_modules/electron/dist 里的文件用硬链接铺进 Flow-Desk\ 根
   （同一块盘上硬链接不占额外空间，286MB 的运行时只存在一份），
   electron.exe 那一份按三个 app 各链一次、改各自的名字，
   main.cjs / preload.cjs / root.json / 兜底页面 只有共用的一份 resources\app；
   「我是哪一个」由 exe 的文件名决定，共用一份代码不会串。
     node build-app.mjs          生成/补齐 Flow-Desk\ 根
     node build-app.mjs --force  重铺运行时（升级 electron 后用）

   外20 起这一份只管根上那一层：运行时、exe 门牌、给用户换的 icons\、README.txt。
   resources\app 那一层出厂镜像整个交给 mirror.mjs —— 因为打更新包那一趟也必须有它：
   更新包是把 resources\app 整层送出去的，镜像不跟着刷，送出去的就是上一次出包那天的旧货。
   随行文件（监听脚本、桥插件）的原件在音乐遥控器的包里，app 层不收第二份，
   兜底由 main.cjs 的 landAsset() 直接走出厂插件那一格（口径见 mirror.mjs 顶上那段）。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply as layMirror, refuseRunning, walk, copyDir,
  MIRROR, TREE_ROOT, PACK_DIR } from './mirror.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, 'node_modules', 'electron', 'dist');
/* 产物就在 Flow-Desk\ 根上（src\pack 往上两级）：运行时、三个 exe、pages、data、src 同级。
   第 15 条：一棵树分两层 —— pages 层可以整层覆盖，data 层是用户自己长出来的。
   三层名字全英文（2026-10-01 他拍的 D 案）：Flow-Desk\{pages,data,update}，不留中文别名。 */
const OUT = TREE_ROOT;
const FORCE = process.argv.includes('--force');
/* 根上只铺一个可执行文件：Flow-Desk.exe（名字跟着 main.cjs 里 APP.label 那一格走）。
   为写、声笔输入法练习的代码都拼在 Flow-Desk 那一张页里，由组件在窗口里就地开，
   不另起进程、也不另出页面，也就没有第二个门牌。 */
const EXE = 'Flow-Desk.exe';
const EXE_PAGE = 'Flow_Desk_*.html';

function linkFile(src, dst){
  fs.mkdirSync(path.dirname(dst), { recursive:true });
  if(fs.existsSync(dst)){
    const a = fs.statSync(src), b = fs.statSync(dst);
    if(!FORCE && a.size === b.size && a.ino === b.ino) return false;   /* 已经链好了 */
    fs.rmSync(dst, { force:true });
  }
  fs.linkSync(src, dst);
  return true;
}

/* 铺镜像之前先问一句：跑着的 PowerShell 会咬住脚本、MusicBee 会咬住插件 dll，
   写到一半写不动就是铺了个半成品（README 里那句"关掉程序再跑 build-app"说的就是这件事） */
refuseRunning('出包（build-app.mjs）');

const files = walk(DIST);
if(!files.includes('electron.exe')) throw new Error('electron dist 里没有 electron.exe，先跑 npm install');

let linked = 0;
for(const rel of files){
  if(rel === 'electron.exe') continue;
  if(rel === 'resources/default_app.asar') continue;   /* 有 resources/app 就用不上，省一份 */
  /* 根上那份 LICENSE 是这棵树自己的授权声明（他 2026-10-09 定的那一条：只许个人使用与研究、
     暂时不许分发/修改/重新打包，纹理与字体另按 CC0、OFL 说话），不是 Electron 传下来的那份 MIT。
     这一趟照 dist 铺的时候要把盖子留住 —— 2026-10-09 外39 跑这一趟时被 dist 的 LICENSE 整份盖掉过一次，
     靠 .gitignore 放行了 LICENSE 才当场看出来。Chromium 那份 LICENSES.chromium.html 照铺，名字不一样不挡。 */
  if(rel === 'LICENSE') continue;
  if(linkFile(path.join(DIST, rel), path.join(OUT, rel))) linked++;
}

/* 出厂镜像那一整层（页面兜底、程序壳、出厂底本、出厂清单、出厂组件、默认图标、root.json、package.json）
   铺完它 mirror.mjs 自己会把每一句 require('./某份') 对一遍，缺一份当场报错 */
console.log('出厂镜像 ' + MIRROR);
for(const line of layMirror()) console.log(line);

/* 图标这一份是给用户换的那一层（Flow-Desk\icons）：已经有的绝不覆盖，他挑过的图不能被出包吃掉。
   自带默认那一份在 resources\app\icons，由上面那一趟铺，和 src\pack\icons 一模一样。 */
copyDir(path.join(PACK_DIR, 'icons'), path.join(OUT, 'icons'), true);
/* 随包内置素材那一层（外31 一组：纹理那 6 张）：只有这一处铺 —— 出厂镜像那一层不带它，原因写在 mirror.mjs 里那一段。
   页面写的是相对地址 material/textures/文件名，fdapp:// 按树根去找，所以这一格得落在 Flow-Desk\material 底下。
   已经有的不覆盖 —— 这一格他也能自己换图（换过的不能被出包吃掉）。 */
copyDir(path.join(PACK_DIR, 'material'), path.join(OUT, 'material'), true);

/* 运行时只有一份：Flow-Desk.exe 是 electron.exe 同一个 inode 上起的名，不占第二份字节 */
if(linkFile(path.join(DIST, 'electron.exe'), path.join(OUT, EXE))) linked++;
console.log(EXE.padEnd(20) + '页面 ' + EXE_PAGE);
fs.writeFileSync(path.join(OUT, 'README.txt'), readme());
console.log('硬链接 ' + linked + ' 个文件（只占一份）');
console.log('产物在 ' + OUT);

function readme(){
  /* README 只管「拿到这棵文件夹怎么开起来」这一件事；
     三层目录、更新、图标、MusicBee、界面文字清单这些细节全部在程序里的「帮助」（data\help.md），
     这儿不再抄一遍 —— 抄一遍就会漏改一处，两份对不上号。 */
  const OPEN = [
    '这一层只有一个 exe，共用同一个运行时，不需要安装：',
    '  双击 Flow-Desk.exe 开桌面工作台（右下角托盘可以退出）。',
    '  为写、声笔输入法练习开在这同一个窗口里：点启动卡就在窗口里展开，不另起程序，托盘上也不会多出图标。',
  ];
  return [
    'Flow-Desk · 便携版',
    '==============================',
    '',
    ...OPEN,
    '',
    '整个 Flow-Desk 文件夹可以改名、挪到别的盘、拷到别的电脑：程序和用户数据分两层放着（pages\\ 是程序，data\\ 是你自己的东西），',
    '路径全按这个文件夹的相对位置找，挪完不用回来改任何设置。',
    '',
    '想知道更多：打开程序，顶栏「帮助」（或按 Ctrl H）。帮助是一份明文文件 data\\help.md，用 Notepad++ 改完保存，再点开就是新的。',
    '程序自己会第一次开机把出厂版帮助铺成 data\\help.md；找不到 data\\ 里的东西时会自动用 resources\\app\\ 里自带的兜底副本。',
    '',
    '更新：设置 → 程序 → 本地更新 里挑一个 FlowDesk_update_*.zip 就行，data\\ 一个字节都不动。细节和出包办法都在帮助里。',
    '',
    '给打包的人：改了 pages\\ 以外的东西（main.cjs / preload.cjs 这类程序壳），关掉程序到 src\\pack 跑 node build-app.mjs；',
    '升级了 electron 之后加 --force 重铺运行时。打更新包（build-update.mjs）会自己先把出厂镜像铺齐，不用再记着先出一次包。',
    ''
  ].join('\r\n');
}
