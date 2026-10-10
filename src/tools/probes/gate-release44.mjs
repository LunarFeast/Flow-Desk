/* ============================================================
   gate-release44.mjs · 外44 三：发布脚本那九条 + 号只跟内容代码 + 铺那台不再有第二套口径
   ------------------------------------------------------------
     node src/tools/probes/gate-release44.mjs
   钉的是"顺序"和"闸"，不是钉某一行代码长什么样：
     ① 主仓没提交完不许发；② 七棵各自独立、没动整棵跳过；③ 各用各仓的哈希 + 本地 tag；
     ④ 号当环境变量传进打包（源码不改不写不滚）；⑤ 打包失败一律不推；⑥ 只推真动过的棵；
     ⑦ 铺那台被 import 的时候一个字都不跑（这一条是我自己踩过一次才钉上的）
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { rd, 记账 } from './lib-slice.mjs';

const 台 = 记账('gate-release44');
const rel = rd('src/_build/release.mjs');
const rep = rd('src/_build/plugin-repos.mjs');
const ver = rd('src/_build/version.mjs');
const pub = rd('src/pack/publish.mjs');

台.题('一、号：打包一次，尾巴那枚短哈希才变一次');
台.判('取号那一格：环境变量 FD_BUILD 是第一优先（发布脚本传进来就用它）', /process\.env\.FD_BUILD/.test(ver));
台.判('没传的时候退回 HEAD 那一笔（同一笔上重复生成不会凭空长号）', /rev-parse', '--short', 'HEAD/.test(ver));
台.判('号里没有任何"自己加一"的计数器', !/下一号|落账/.test(ver));
台.判('发布脚本每跑一次先落一笔"发布"提交当记号（源码一个字不改）', /'commit', '--allow-empty'/.test(rel) && /这一趟打包的记号/.test(rel));
台.判('那一笔的短哈希就是这一趟的号，且传给打包', /主短 = git\(TREE, \['rev-parse', '--short', 'HEAD'\]\)/.test(rel) && /FD_BUILD: 主短/.test(rel));
台.判('--dry 不落那一笔（看计划不長号）', rel.indexOf('if(DRY){\n  P(\'主程序') > 0);
台.判('打包完把老版本挪去存档那一格（不是就地删），只认产物自己的名字、不碰文稿',
  /function 挪\(from, to\)/.test(rel) && /存档落点/.test(rel) && /\^Flow_Desk_/.test(rel) && !/rmSync\(path\.join\(格, n\)\)/.test(rel));

台.题('二、发布脚本那九条');
台.判('① 主仓有没提交的改动就停下报清单（不替他提交主仓）', /status', '--porcelain'/.test(rel) && rel.includes('要么提交掉，要么这一轮别发'));
台.判('① 程序开着也不发（页面和程序壳那一层被它读着）', /IMAGENAME eq Flow-Desk\.exe/.test(rel));
台.判('② 一家一棵各自判动没动（逐字节比那一份和仓里这一份）', /function 会动吗\(job, dir\)/.test(rel) && /readFileSync\(a\)\.equals\(fs\.readFileSync\(b\)\)/.test(rel));
台.判('② 没动的那一棵整棵跳过：不铺、不提交、不打 tag', /if\(会动 && !DRY\)/.test(rel) && /if\(r\.动了\) r\.新tag/.test(rel));
台.判('② 铺和提交只叫那一台工具去干（一家一棵仓的铺法不在这里抄第二份）', /'src\/_build\/plugin-repos.mjs', '--only='/.test(rel));
台.判('③ 每一家的号用它自己那一笔的短哈希拼', /底号\(\) \+ '\+build\.' \+ 后/.test(rel));
台.判('③ tag 由脚本本地打（v + 完整号），同名钉在另一笔上就停下', /git\(dir, \['tag', '-a', name/.test(rel) && rel.includes('别让它指歪'));
台.判('④ 号当环境变量传进打包：FD_BUILD + FD_PLUGINS 两格', /FD_BUILD: 主短/.test(rel) && /FD_PLUGINS: JSON\.stringify/.test(rel));
台.判('④ 打包那三趟按顺序跑：生成 → 铺出厂镜像 → 出发布物', rel.indexOf('src/_fd/build.mjs') < rel.indexOf('src/pack/build-app.mjs') && rel.indexOf('src/pack/build-app.mjs') < rel.indexOf('src/pack/publish.mjs'));
台.判('⑤ 任何一步砸了都走 停（里面一律不推）', rel.indexOf('停(') > 0 && /process\.exit\(1\)/.test(rel));
台.判('⑥ 推只在打包成了之后，而且一口报出是哪一棵', /这一棵推砸了（后面的棵还没推）/.test(rel));
台.判('⑥ 提交都已经在远端的棵不推（--dry 也不推）', /未推 === 0/.test(rel) && rel.includes('提交都已经在远端了，不推'));
台.判('试跑那一格留得下来：--不推 跑完前四步、tag 不打一根不推', /const NOPUSH = has\('--不推'\)/.test(rel) && /if\(!NOPUSH\)/.test(rel));
台.判('看一眼那一格留得下来：--dry 在打包之前就退出，什么都没写', /if\(DRY\)\{ P\('\\n（--dry/.test(rel));

台.题('三、插件那一头的旧口径撤干净了');
台.判('不再压成一颗没有爹的提交（amend / reset --soft 都下台了）', !/--amend/.test(rep) && !/'reset', '-q', '--soft'/.test(rep));
台.判('不再顺手 reflog expire / gc（那一套是为 amend 收尸的）', !/reflog', 'expire/.test(rep) && !/'gc', '--prune=now'/.test(rep));
台.判('有改动就是新起一笔（话也改成这个样子）', /提交 = 老 \? '新提交一笔' : '造了首次提交'/.test(rep));
台.判('被当零件 import 时命令行那一段一个字都不跑', /if\(被当命令跑\)\{/.test(rep) && /const 被当命令跑 = process\.argv\[1\]/.test(rep));
/* Windows 上 import 绝对路径要写成 file:// URL，直接给 D:\... 会当场抛协议不对 */
const 那颗URL = pathToFileURL(path.resolve('D:/Programs/Flow-Desk/src/_build/plugin-repos.mjs')).href;
台.判('这一条不是白钉的：import 它一次，只报几家几棵，不报仓名', (() => {
  const out = execFileSync(process.execPath, ['-e', 'import(' + JSON.stringify(那颗URL) + ').then(m => console.log("登记 " + m.家.length + " 家 · 要铺 " + m.REPOS.length + " 棵"))'],
    { cwd:'D:/Programs/Flow-Desk/', encoding:'utf8' });
  return out.trim() === '登记 7 家 · 要铺 1 棵' && !/Flow-Desk-plugin-/.test(out);
})());

台.题('四、插件清单里那一格老版本不再当成打包取的号');
台.判('publish 认 FD_PLUGINS 传进来的那一家自己的号', /const 递来的家 = \(\(\) =>/.test(pub) && /递来的家 && 递来的家\[m\.id\] && 递来的家\[m\.id\]\.version/.test(pub));
台.判('传进来的不是合法 JSON 就当场报错，不静悄悄退回老号', /FD_PLUGINS 传进来的不是合法 JSON/.test(pub));
台.判('安装标记里带上每一家的号和它要的外壳那一档（他第九条要的那三样）', /plugins: shelf\.map\(p => \(\{ id:p\.id, name:p\.name, version:p\.version, 兼容外壳:p\.minShell/.test(pub));

台.收尾();
