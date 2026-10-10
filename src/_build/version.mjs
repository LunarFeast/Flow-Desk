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
   他定的口径：「打包一次，build 后面那枚短哈希变一次」。所以真号是 src\_build\release.mjs 那一趟给的 ——
   它每跑一次就先在主仓落一笔什么都不改的"发布"提交，拿那一笔的短哈希传进来：
   打包 ↔ 提交 ↔ tag ↔ 号，四样一一对应。
   本地自己跑 build.mjs（不走发布）拿的是 HEAD 那一笔，同一笔提交上重复生成会得到同一个号，
   页面就地覆盖，不会凭空长号。 */
function 哈希(){
  const 传 = String(process.env.FD_BUILD || '').trim();
  if(传) return 传.replace(/^build\./, '').slice(0, 12);
  try{ return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd:TREE, encoding:'utf8' }).trim(); }
  catch(e){ return ''; }
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
