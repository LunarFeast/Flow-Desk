/* ============================================================
   插件这一摊：到外46 四为止，只剩「为写」一家还单独一棵仓
   ------------------------------------------------------------
     node src/_build/plugin-repos.mjs --dry                 只报清单和体积，不落盘、不动 git
     node src/_build/plugin-repos.mjs                       铺 + 提交 + 挂远端（只跑带仓那一家）
     node src/_build/plugin-repos.mjs --only=notes          只跑点到的那几家（不带仓的那几家这一趟什么都不做）
     node src/_build/plugin-repos.mjs --out=目录            换铺的地方

   外46 四（他 2026-10-11 定「仓并成 2 棵这条走」）：其余六家带着自己那几笔提交历史并回了主仓那一棵，
   代码就在这棵树里改、就在这棵树里提交（插件那一格进仓了，规矩在 .gitignore 第七、八两节）。
   这一份以里只干两件事：
     一、登记七家各自占哪些路径 —— 名单只此一份，发布脚本和探针都拿它算，别处不许另抄一份对应表；
     二、把带仓的那一家（为写）从开发这棵树按原路径铺进它自己那一棵、提交、挂远端。
   不带仓的那六家照旧登着：发布脚本要拿那几行路径算「这一家最后动过的是哪一笔」，
   不算这一就不知道该给哪一家刷号、该往哪一格写号。

   形状：仓库里的路径跟主仓一模一样（data\plugins\notes\main.js 还是这一串），
   所以「这一家改了没有」拿两棵树逐字节比就得出，不需要谁再维护第二份对应表。
   铺出去那一格是构建产物（和 dist\ 同一待遇）：每次照清单整格重铺，多出来的删掉。
   改代码还是回主仓改，不许直接在仓库那一格里动手。

   提交身份：作者名用 GitHub 上那个，邮箱一律写 noreply@invalid（.invalid 是保留域，
   投不到任何信箱），所以公开面上读不出真邮箱。这台机器的 git 全局配置一个字不动。

   提交形状（他 2026-10-10 定）：正常多条提交，不压成单颗、不 amend、不 force-push ——
   细粒度留着方便查 bug。这一家的内容和主仓那一份逐字节比得出有没有动，没动就不提交。
   ============================================================ */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const HERE = import.meta.dirname;
export const TREE = path.resolve(HERE, '..', '..');           /* Flow-Desk 那一棵树 */
/* 这一份既是命令行工具，也被 src\_build\release.mjs 当零件用：命令行那一段只在"直接跑我"时才执行 */
const 被当命令跑 = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
const argv = 被当命令跑 ? process.argv.slice(2) : [];
const has = f => argv.includes(f);
const val = (f, d) => { const a = argv.find(x => x.startsWith(f + '=')); return a ? a.slice(f.length + 1) : d; };
const DRY = has('--dry');
const ONLY = val('--only', '').split(',').map(s => s.trim()).filter(Boolean);
const MSG = val('--msg', '');
export const OUT = path.resolve(val('--out', 'D:/Programs/Flow-Desk-plugins'));
const GIT_NAME = 'LunarFeast';
const GIT_MAIL = 'noreply@invalid';                           /* 保留域，投不到任何信箱 */

const pack = id => 'data/plugins/' + id;                   /* 一家插件整格 */
const COMMON = ['LICENSE', 'THIRD-PARTY.txt'];                /* 两份声明跟着走：仓库没声明 = 默认保留所有权利 */

export const 家 = [
  { id:'notes',                  中文:'你的便签',       仓:'', from:[pack('notes')] },
  { id:'schedule',               中文:'日程',           仓:'', from:[pack('schedule')] },
  { id:'your-sentences',         中文:'你的句子',       仓:'', from:[pack('your-sentences')] },
  { id:'music-remote',           中文:'音乐遥控器',     仓:'', from:[pack('music-remote'),
      'src/pack/plugin/FlowDeskBridge.cs', 'src/pack/plugin/MBHeader.cs', 'src/pack/plugin/build-plugin.ps1'] },
  { id:'singbit-input-practice', 中文:'声笔输入法练习', 仓:'', from:[pack('singbit-input-practice'),
      'src/_build/rp-kernel.mjs', 'src/_build/rp-base.html',
      'src/_build/p1.js', 'src/_build/p2.js', 'src/_build/p3.js', 'src/_build/p4.js', 'src/_build/p5.js', 'src/_build/p6.js'] },
  { id:'wnw-custom',             中文:'组件定制',       仓:'', from:[pack('wnw-custom'),
      'src/_wcustom/build-kernel.mjs', 'src/_wcustom/src'] },
  { id:'why-not-write',          中文:'为写',           仓:'Flow-Desk-plugin-Why-Not-Write', from:[pack('why-not-write'),
      'src/_wnw/build-kernel.mjs', 'src/_wnw/src'] },
];

/* 只有带仓那一家需要铺到旁边那一棵；不带仓的六家就在主仓这棵树里提交 */
export const REPOS = 家.filter(j => j.仓);

/* ---------- 清单：目录整格收下（点开头的、产物、构建输出不要） ---------- */
const SKIP_NAME = /^\.|\.zip$/;
const SKIP_PATH = /(^|\/)(dist|node_modules|备份)\//;
function listFrom(rel){
  const abs = path.join(TREE, rel);
  if(!fs.existsSync(abs)) return null;
  if(fs.statSync(abs).isFile()) return [rel.replace(/\\/g, '/')];
  const out = [];
  for(const e of fs.readdirSync(abs, { withFileTypes:true })){
    if(e.name.startsWith('.')) continue;
    const r = rel + '/' + e.name;
    if(e.isDirectory()){ out.push(...listFrom(r)); continue; }
    if(SKIP_NAME.test(e.name) || SKIP_PATH.test(r)) continue;
    out.push(r.replace(/\\/g, '/'));
  }
  return out.sort();
}
export function filesOf(job){
  const set = new Set(COMMON);
  for(const rel of job.from){
    const got = listFrom(rel);
    if(!got) throw new Error(job.仓 + ' 要收的那一格不存在：' + rel);
    for(const f of got) set.add(f);
  }
  return [...set].sort();
}

/* ---------- 私人东西不许进公开面 ---------- */
/* 这两条要盯的字面量从现场取（本机帐户名、这台机器 git 里那个身份），
   不写死在这一份里 —— 写死了这一份自己就把它们公开出去了。 */
const 户 = os.userInfo().username;
const 旧身份 = (() => { try{ return execFileSync('git', ['config', '--global', 'user.email'], { encoding:'utf8' }).trim(); }catch(e){ return ''; } })();
const BIN = /\.(dll|exe|png|jpg|jpeg|gif|webp|ico|zip|woff2?|ttf|otf)$/i;
/* 盯的就是「这台机器自己的东西」：帐户名与旧身份现场取，绝对路径那一类只认这一棵树那一头 ——
   别的盘、别的位置都算这台机器的事，写进公开面就是漏。占位写法（<帐户名>、%APPDATA%、别处 那一类）放过。 */
const 占位 = /<|>|%|\$|帐户名|账户名|用户名|某|别处|备份处|这里|那里|Example|example/i;
function 扫行(line){
  const 中 = [];
  if(户 && line.includes(户)) 中.push('这台机器的 Windows 帐户名');
  if(旧身份 && line.toLowerCase().includes(旧身份.toLowerCase())) 中.push('这台机器 git 配置里那个旧身份');
  if(/[a-z0-9._%+-]+@(?:gmail|qq|163|126|outlook|hotmail|sina|foxmail|icloud)\.com/i.test(line)) 中.push('一个真邮箱');
  if(/[a-z0-9._%+-]+@users\.noreply\.github\.com|@github\.com/i.test(line)) 中.push('GitHub 那一头的地址');
  /* 只认「盘符 + 一个真目录名」那种写法：`b:/` 那种正则片段、`C:\\...\\X` 那种省略写法都不算 */
  for(const m of line.matchAll(/(?<![A-Za-z0-9_])([A-Za-z]):[\\/]{1,2}([A-Za-z0-9_\u4e00-\u9fff<%$][^\s'"`,)（）]*)/g)){
    const 盘 = m[1].toUpperCase(), 尾 = String(m[2] || '');
    if(盘 === 'D' && /^[/\\]?Programs[/\\]Flow-Desk/i.test(尾)) continue;   /* 这一棵树自己 */
    if(占位.test(尾) || 占位.test(line)) continue;
    中.push('仓外那一格的绝对路径（写在 ' + 盘 + ': 那一个盘上）');
  }
  return 中;
}
function scanLeaks(list){
  const bad = [];
  for(const rel of list){
    if(BIN.test(rel)) continue;
    const lines = fs.readFileSync(path.join(TREE, rel), 'utf8').split(/\r?\n/);
    for(let i = 0; i < lines.length; i++)
      for(const why of 扫行(lines[i])) bad.push(rel + ':' + (i + 1) + ' · ' + why + ' · ' + lines[i].trim().slice(0, 90));
  }
  return bad;
}

/* ---------- git ---------- */
export function git(cwd, args){
  return execFileSync('git', args, { cwd, encoding:'utf8',
    env:{ ...process.env, GIT_AUTHOR_NAME:GIT_NAME, GIT_AUTHOR_EMAIL:GIT_MAIL,
          GIT_COMMITTER_NAME:GIT_NAME, GIT_COMMITTER_EMAIL:GIT_MAIL },
    stdio:['ignore', 'pipe', 'pipe'] }).trim();
}
function hasHead(dir){
  try{ git(dir, ['rev-parse', '--verify', 'HEAD']); return true; }catch(e){ return false; }
}
function mirror(list, dest){
  const keep = new Set(list);
  const del = [];
  const walk = rel => {
    const abs = path.join(dest, rel);
    if(!fs.existsSync(abs)) return;
    for(const e of fs.readdirSync(abs, { withFileTypes:true })){
      if(e.name === '.git') continue;
      const r = rel ? rel + '/' + e.name : e.name;
      if(e.isDirectory()){ walk(r); continue; }
      if(!keep.has(r)) del.push(r);
    }
  };
  walk('');
  for(const r of del) fs.rmSync(path.join(dest, r), { force:true });
  for(const rel of list){
    const to = path.join(dest, rel);
    fs.mkdirSync(path.dirname(to), { recursive:true });
    fs.copyFileSync(path.join(TREE, rel), to);
  }
  /* 删完文件留下的空壳也一并摘掉（git 不认空目录，但人打开那一格看着是垃圾） */
  const prune = rel => {
    const abs = path.join(dest, rel);
    if(!fs.existsSync(abs)) return;
    for(const e of fs.readdirSync(abs, { withFileTypes:true })){
      if(e.isDirectory() && e.name !== '.git') prune(rel ? rel + '/' + e.name : e.name);
    }
    if(rel && !fs.readdirSync(abs).length) fs.rmSync(abs, { recursive:true, force:true });
  };
  prune('');
  return del;
}

/* ---------- 跑 ----------
   只有"直接跑我"才执行下面这一整段；被 src\_build\release.mjs 当零件 import 的时候一个字都不跑 ——
   从前这里没设闸，release.mjs 一 import 就把七家全铺全提交了一遍，本地凭空多出一笔。 */
if(被当命令跑){
let 报错 = [];
const 计划 = [];
for(const job of REPOS){
  if(ONLY.length && !ONLY.includes(job.id)) continue;
  let list;
  try{ list = filesOf(job); }
  catch(e){ 报错.push(e.message); continue; }
  const bytes = list.reduce((n, r) => n + fs.statSync(path.join(TREE, r)).size, 0);
  const bad = scanLeaks(list);
  if(bad.length){ 报错.push(job.仓 + ' 里有 ' + bad.length + ' 处私人东西：\n      ' + bad.slice(0, 8).join('\n      ')); continue; }
  计划.push({ job, list, bytes });
}
if(报错.length){
  console.error('停下来：这一轮不铺任何东西。\n  ' + 报错.join('\n  '));
  process.exit(1);
}

for(const { job, list, bytes } of 计划){
  const dir = path.join(OUT, job.仓);
  const url = 'https://github.com/LunarFeast/' + job.仓 + '.git';
  const kb = (bytes / 1024).toFixed(1);
  if(DRY){
    console.log(job.仓 + ' · ' + list.length + ' 份 · ' + kb + ' KB · 铺到 ' + dir);
    for(const f of list) console.log('    ' + f);
    continue;
  }
  fs.mkdirSync(dir, { recursive:true });
  const del = mirror(list, dir);
  if(!fs.existsSync(path.join(dir, '.git'))) git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['add', '-A']);
  const 老 = hasHead(dir);
  /* 正常多条提交（他 2026-10-10 定的口径）：这一家这一轮有改动，就在它自己那一棵上另起一笔 ——
     不折、不 amend、不 force，细粒度留着方便查 bug；一个字没变就连一笔都不多。 */
  let 提交 = '没变化';
  try{ git(dir, ['diff', '--cached', '--quiet']); }
  catch(e){
    const 头 = MSG || job.仓 + ' · 同步主仓这一份';
    const 身 = [
      头, '',
      '这一棵是 Flow-Desk 的「' + job.中文 + '」那一家，内容是从主仓那棵树里按原路径挑出来的 ' + list.length + ' 份（' + kb + ' KB）：',
      ...list.map(f => '  ' + f),
      '',
      '主仓：https://github.com/LunarFeast/Flow-Desk —— 代码只在那一棵里改，这一棵每次整格重铺，别在这儿动手。',
      '授权：见根上 LICENSE（软件和插件只允许个人使用与研究，暂时不允许分发、修改、重新打包）与 THIRD-PARTY.txt。',
    ].join('\n');
    fs.writeFileSync(path.join(dir, '.git', 'COMMIT_MSG'), 身, 'utf8');
    git(dir, ['commit', '-q', '-F', '.git/COMMIT_MSG']);
    提交 = 老 ? '新提交一笔' : '造了首次提交';
  }
  try{ git(dir, ['remote', 'add', 'origin', url]); }
  catch(e){ git(dir, ['remote', 'set-url', 'origin', url]); }
  const sha = 老 || hasHead(dir) ? git(dir, ['rev-parse', '--short', 'HEAD']) : '（空）';
  console.log(job.仓.padEnd(38) + ' ' + String(list.length).padStart(3) + ' 份 · ' + kb.padStart(9) + ' KB · ' + 提交 +
    (del.length ? ' · 删掉多出来的 ' + del.length + ' 份' : '') + ' · ' + sha);
}
if(DRY) console.log('\n（--dry：什么都没写。七家合计 ' + 计划.reduce((n, p) => n + p.list.length, 0) + ' 份）');
else console.log('\n铺在 ' + OUT + ' 下面，远端都挂好了。推那一步在发布脚本 release.mjs 里，打包成了才推。');
}
