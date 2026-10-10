/* 版本号唯一真身（2026-10-10 外44 换成他定的那一套形状）
   ------------------------------------------------------------
   形状 = 主.次.补丁-预发布+build.<git 短哈希>，例：1.0.0-alpha+build.977bc41。
   · 前段（shell）= 1.0.0，换档由人改 version.json 里那一行；
   · 预发布（pre）= alpha / beta，正式版把这一格留空（就成 1.0.0+build.xxxx）；
   · build = 最后一次动过主程序代码的那一笔提交的短哈希（见下面 内容路径 那一句）——
     **不写进 version.json**：他定的口径是「代码先提交 → 号从提交里取 → 号当环境变量传进打包 →
     源码一个字不改、打完不回滚」，所以这一格只认传进来的那一个（FD_BUILD），没传就就地问一次 git。
   · 从前那个每生成一次页面就自己加一的流水号（1.4.0-dev.17 尾巴那个 17）撤掉了 ——
     他一句「内容代码更新才有那个哈希值的增长」，号跟提交一一对应，不再有第二把尺。

   只有生成那一趟（build.mjs）读这一格把号写进页面；产物文件名带的也是同一串，
   所以包名、更新标记、页面上显示的号都同源。 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = import.meta.dirname;
const FILE = path.join(HERE, 'version.json');
const TREE = path.resolve(HERE, '..', '..');

function 账(){
  let j;
  try{ j = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch(e){ throw new Error('版本号这一格读不到（' + FILE + '）：' + (e && e.message || e)); }
  if(!j || typeof j.shell !== 'string' || !/^\d+\.\d+\.\d+$/.test(j.shell))
    throw new Error('版本号这一格里 shell 要的是「主.次.补丁」三段数字（写成 "1.0.0" 这种）：' + FILE);
  return j;
}
/* 短哈希：环境变量优先（发布脚本传进来），没传就地问一次 git；问不到就留空 ——
   留空时号长成 1.0.0-alpha，还是一串合法号，只是认不出是哪一笔提交。
   ------------------------------------------------------------
   问的不是「HEAD 是哪一笔」，而是「最后一次动过主程序自己那些代码的是哪一笔」。
   他一句「内容、内容代码更新才有那个哈希值的增长」：改文档、加探针、写述职那些提交
   不该让页面换名字 —— 从前按 HEAD 取，我提交一笔补正注释，页面就得跟着重生成一次、
   尾巴上凭空长一枚新哈希，那个号已经不是"这一版是什么"的尺了。
   列进来的这几棵就是主程序出门要带的代码：宿主页面那几棵 + 程序壳 + 页面骨架。
   不列的：docs\ 和 pages\ 里的文稿（文字不是代码）、src\tools\（这台机器自己的工具，
   探针和审查台不进页面）、那三家的源码（为写 / 组件定制 / 声笔练习不住在主仓的跟踪面里，
   它们改了换的是那一家自己的号 —— 各仓用自己的哈希，他定的）。
   要加一棵就动下面这一串，别在别处再写第二把尺。 */
const 内容路径 = ['src/_fd', 'src/_shared', 'src/_build', 'src/pack', 'pages/template.html'];
function 哈希(){
  const 传 = String(process.env.FD_BUILD || '').trim();
  if(传) return 传.replace(/^build\./, '').slice(0, 12);
  try{
    return execFileSync('git', ['log', '-1', '--format=%h', '--', ...内容路径], { cwd:TREE, encoding:'utf8' }).trim();
  }catch(e){ return ''; }
}
function 串(shell, pre, build){
  return shell + (pre ? '-' + pre : '') + (build ? '+build.' + build : '');
}

/* 当前这一版（页面上显示、别处倒查都用这一支） */
export function 号(){ const j = 账(); return 串(j.shell, String(j.pre || ''), 哈希()); }
/* 不带 build 的那一段（比大小用这一支：短哈希不参与排序，它只负责「是哪一笔」） */
export function 底号(){ const j = 账(); return 串(j.shell, String(j.pre || ''), ''); }
/* 产物页的名字：整条链只认这一个前缀 + 这一串号 */
export function 页名(用了){ return 'Flow_Desk_' + (用了 || 号()) + '.html'; }
