/* ============================================================
   发布：八棵仓一条道走完（他 2026-10-10 定的那九条）
   ------------------------------------------------------------
     node src/_build/release.mjs --dry                 只看：哪几棵会动、各家用哪一串号，一个字节不写
     node src/_build/release.mjs --msg="这一轮改了什么"  正式跑：提交 → 取号 → 生成 → 出包 → 打 tag → 推
     node src/_build/release.mjs --only=notes,schedule  只点这几家（写插件 id）
     node src/_build/release.mjs --不推                 跑完前四步，tag 也不打（试跑整条链用这一条）

   顺序是他定的，不能乱：
     ① 代码先提交完（主仓这边必须已经干净 —— 有没提交的改动就停下报清单，不替他提交主仓）
     ② 七棵插件仓各自独立：铺一遍，内容和仓里那一份逐字节一样就整棵跳过，不一样才 add/commit
     ③ 每棵取自己那一笔的短哈希，拼成 主.次.补丁-预发布+build.<那棵的短哈希>，本地打 tag
     ④ 回主程序这一棵：号当环境变量传进打包（FD_BUILD），源码一个字不改、不临时写文件、不回滚；
        每一家的号一并传进去（FD_PLUGINS）—— 说明书里那一格 version 是老版本，打包这一趟不写它也不取它
     ⑤ 生成、出包任何一步失败 → 当场终止，一律不推
     ⑥ 只有全套跑成了才推，而且只推这一趟真动过的棵；哪一棵推砸了就报是哪一棵
   主程序和插件相互独立：各用各仓的哈希，互不牵（他原话）。

   推这一步经不经过我的手续：脚本只喊 `git push`，用的是这台机器已经配好的 git credential helper；
   我这一头不读、不写、不存任何令牌，也看不到那串东西。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REPOS, TREE, git, filesOf } from './plugin-repos.mjs';
import { 号, 底号, 页名 } from './version.mjs';
import { 存档落点 } from '../tools/本地路径.mjs';

const argv = process.argv.slice(2);
const has = f => argv.some(a => a === f || a.startsWith(f + '='));
const val = (f, d) => { const a = argv.find(x => x.startsWith(f + '=')); return a ? a.slice(f.length + 1) : d; };
const DRY = has('--dry');
const NOPUSH = has('--不推');
const ONLY = val('--only', '').split(',').map(s => s.trim()).filter(Boolean);
const MSG = val('--msg', '');
const OUT = path.resolve(val('--out', 'D:/Programs/Flow-Desk-plugins'));
const P = (n) => console.log(n);
const 停 = (why) => { console.error('\n停下来：' + why + '\n'); process.exit(1); };

/* ---------- ① 主仓这一棵：必须已经提交完 ----------
   不替他 commit 主仓 —— 那一棵里躺着他这一轮还没说完的东西，脚本一把全收走等于替他写提交说明。 */
const 主仓dirty = git(TREE, ['status', '--porcelain']).split(/\r?\n/).filter(Boolean);
if(主仓dirty.length) 停('主仓还有 ' + 主仓dirty.length + ' 处没提交：\n  ' + 主仓dirty.slice(0, 12).join('\n  ') +
  '\n  要么提交掉，要么这一轮别发。');

/* ---------- 程序正开着就不动：pages\ 和 resources\app\ 会被它自己咬住 ---------- */
let 开着 = '';
try{ 开着 = execFileSync('tasklist', ['/FI', 'IMAGENAME eq Flow-Desk.exe', '/FO', 'CSV', '/NH'], { encoding:'utf8' }); }catch(e){}
if(/Flow-Desk\.exe/i.test(开着)) 停('Flow-Desk 正在开着，页面和程序壳那一层被它读着。先把它退干净（托盘图标右键 → 退出）。');

/* ---------- ② 七家：逐字节比一遍，没动就整棵跳过，动了才叫铺那台去提交 ----------
   铺和提交那一趟用的是 src\_build\plugin-repos.mjs 本身（一家插件一棵仓的铺法只有那一份，不在这儿抄第二份）。
   判"动没动"拿的是仓库里那一份和主仓这一份逐字节比 —— 路径两边一模一样，比得出就不需要谁再维护对应表。 */
const 短 = dir => { try{ return git(dir, ['rev-parse', '--short', 'HEAD']); }catch(e){ return ''; } };
function 会动吗(job, dir){
  if(!fs.existsSync(path.join(dir, '.git'))) return true;
  const 脏 = git(dir, ['status', '--porcelain']).split(/\r?\n/).filter(Boolean);
  if(脏.length) return true;                     /* 仓里留着没被提交的痕迹：这一趟把它收掉 */
  for(const rel of filesOf(job)){
    const a = path.join(TREE, rel), b = path.join(dir, rel);
    try{ if(!fs.readFileSync(a).equals(fs.readFileSync(b))) return true; }
    catch(e){ return true; }                     /* 任何一边读不到 = 少一份或多一份 */
  }
  return false;
}

const 家 = [];
for(const job of REPOS){
  if(ONLY.length && !ONLY.includes(job.id)) continue;
  const dir = path.join(OUT, job.repo);
  const 前 = 短(dir);
  let 会动;
  try{ 会动 = 会动吗(job, dir); }catch(e){ 停(job.repo + ' 这一棵比不了：' + e.message); }
  if(会动 && !DRY){
    const args = ['src/_build/plugin-repos.mjs', '--only=' + job.id, '--out=' + OUT];
    if(MSG) args.push('--msg=' + MSG);
    P('\n$ node ' + args.join(' '));
    try{ process.stdout.write(execFileSync(process.execPath, args, { cwd:TREE, encoding:'utf8', stdio:['ignore','pipe','pipe'] })); }
    catch(e){ 停(job.repo + ' 这一棵铺砸了：' + String((e && (e.stdout || e.stderr)) || (e && e.message) || e).replace(/\r?\n/g, ' ').slice(0, 500)); }
  }
  const 后 = 短(dir);
  家.push({ id:job.id, repo:job.repo, 中文:job.中文, dir, 会动, 动了:!!(后 && 前 && 后 !== 前) || (!!会动 && !前),
            sha:后, 号: 后 ? 底号() + '+build.' + 后 : '' });
}

/* ---------- ③ 号：打包一次，尾巴那枚短哈希就变一次（他 2026-10-10 定的口径）----------
   这一笔是这趟打包自己的记号：--allow-empty，源码一个字不改、不写临时文件、不回滚。
   tag 钉在它身上 —— 打包 ↔ 提交 ↔ tag ↔ 号，四样一一对应。
   --dry 不落这一笔，只报"号会在这一笔之后才定"。 */
let 主号 = '', 主短 = '';
if(DRY){
  P('主程序 ' + 底号() + '+build.（这一趟会先落一笔"发布"提交，号从它身上取）');
}else{
  git(TREE, ['commit', '--allow-empty', '-q', '-m', '发布 ' + 底号() + ' · 这一趟打包的记号（源码一个字没改）']);
  主短 = git(TREE, ['rev-parse', '--short', 'HEAD']);
  主号 = 底号() + '+build.' + 主短;
  P('主程序 ' + 主号 + '（这一趟打包那一笔：' + 主短 + '）');
}
for(const r of 家) P('  ' + r.repo.padEnd(40) +
  (r.会动 ? (DRY ? '会动' : (r.动了 ? '动了' : '比出来会动、铺完却没差别')) : '不动') + ' · ' +
  (DRY && r.会动 ? '这一趟铺完才定号' : (r.号 || '（这一棵还没有一笔）')));
if(DRY){ P('\n（--dry：什么都没写、没提交、没打包、没推。）'); process.exit(0); }

/* ---------- ④ 号当环境变量传进打包：源码不改、不写临时文件 ---------- */
const env = Object.assign({}, process.env, {
  FD_BUILD: 主短,
  /* 每一家这一趟带的是哪一串号：那一家自己那一笔的哈希拼出来的，不取说明书里那一格 version */
  FD_PLUGINS: JSON.stringify(家.filter(r => r.号).reduce((m, r) => {
    m[r.id] = { version: r.号, 中文: r.中文 }; return m;
  }, {}))
});
const 跑 = (cmd, args) => {
  P('\n$ ' + cmd + ' ' + args.join(' '));
  try{
    const out = execFileSync(cmd, args, { cwd:TREE, env, encoding:'utf8', stdio:['ignore','pipe','pipe'] });
    process.stdout.write(out.split(/\r?\n/).slice(-14).join('\n') + '\n');
  }catch(e){
    停('「' + args[0] + '」这一趟没跑成，一律不推。\n' + String((e && (e.stdout || e.stderr)) || (e && e.message) || e).replace(/\r?\n/g, '\n  ').slice(0, 1200));
  }
};
跑(process.execPath, ['src/_fd/build.mjs']);
/* 出厂镜像那一层（resources\app\）必须在打包之前铺齐 —— 从前这一步搭在 build-update.mjs 里顺手办了，
   那条 zip 更新链撤了之后，publish 只管照着盘上那一层收，谁铺齐它不管：所以在这儿明着跑一次。 */
跑(process.execPath, ['src/pack/build-app.mjs']);
跑(process.execPath, ['src/pack/publish.mjs']);

/* ---------- 旧版本就地收走（他 2026-10-10 两句：「这种多版本的地方都需要定期清理旧版本」+「只留最新，旧版转移到存档那一格」）----------
   三个地方会堆：pages\（每生成一张写一张）、dist\（每打一颗 exe 多一份）、update\packages\（每出一次更新包多一包）。
   只认这三种产物自己的名字，别的一个字不碰：pages\ 同时是他的文稿目录，
   update\backups\ 是每趟装之前的旧层（留着能退回去），根上那个 备份\ 更是一个文件夹都不许动。
   落点住在 src\tools\本地路径.cjs 那颗「存档落点」里（这台机器自己的位置，不进仓）；没登记就只报不动。 */
function 挪(from, to){
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try{ fs.renameSync(from, to); return true; }
  catch(e){ fs.copyFileSync(from, to); fs.rmSync(from, { force: true }); return true; }   /* 跨盘：改名不行就拷过去再删 */
}
function 收一处(格, 认, 说明){
  const 全 = [];
  try{
    for(const n of fs.readdirSync(格)){
      if(!认.test(n)) continue;
      let mt = 0; try{ mt = fs.statSync(path.join(格, n)).mtimeMs; }catch(e){}
      全.push({ n, mt });
    }
  }catch(e){ P('  ' + 说明 + '：这一格读不到，跳过'); return; }
  全.sort((a, b) => b.mt - a.mt);
  const 旧 = 全.slice(1);
  if(!存档落点){ P('  ' + 说明 + '：留最新 1 份 · 另有 ' + 旧.length + ' 份旧版没收（这台没登记存档落点，只报不动）'); return; }
  const 去 = 旧.map(x => { try{ 挪(path.join(格, x.n), path.join(存档落点, '旧版本', path.basename(格), x.n)); return x.n; }catch(e){ return '挪不动 ' + x.n; } });
  P('  ' + 说明 + '：留最新 1 份 · 挪走 ' + 去.length + ' 份 → ' + 存档落点 + '\\旧版本\\' + path.basename(格) + (去.length ? '\n    ' + 去.join('\n    ') : ''));
}
P('\n收旧版本（只留最新那一份）：');
收一处(path.join(TREE, 'pages'), /^Flow_Desk_[\d][\w.+-]*\.html$/, '页面 pages\\');
收一处(path.join(TREE, 'dist'), /^Flow_Desk_setup_[\d][\w.+-]*\.exe$|^Flow_Desk_payload_[\d][\w.+-]*\.zip$/, '发布物 dist\\');
收一处(path.join(TREE, 'update', 'packages'), /^FlowDesk_update_/, '更新包 update\\packages\\');

/* ---------- ⑤ 本地打 tag：号钉在哪一笔上，一一对应 ---------- */
function 打tag(dir, name, 谁){
  let 已有 = '';
  try{ 已有 = git(dir, ['rev-parse', '--short', name]); }catch(e){}
  const 这笔 = git(dir, ['rev-parse', '--short', 'HEAD']);
  if(已有 && 已有 !== 这笔) 停(谁 + ' 这一棵上已经有一枚同名 tag ' + name + '，钉在另一笔（' + 已有 + '）上。换个号或先把那枚删了，别让它指歪。');
  if(已有 === 这笔){ P('  ' + 谁 + ' · tag ' + name + ' 已经在这一笔上，不再打一遍'); return false; }
  git(dir, ['tag', '-a', name, '-m', 谁 + ' ' + name, 'HEAD']);
  P('  ' + 谁 + ' · 本地打了 tag ' + name);
  return true;
}
if(!NOPUSH){
  打tag(TREE, 'v' + 主号, 'Flow-Desk');
  for(const r of 家) if(r.动了) r.新tag = 打tag(r.dir, 'v' + r.号, r.repo);

  /* ---------- ⑥ 推：只推这一趟真动过的棵；砸了就报是哪一棵 ---------- */
  const 推 = (dir, 谁, 有东西) => {
    if(!有东西){ P('  ' + 谁 + ' · 这棵没新东西，不推'); return; }
    let 未推 = -1;
    try{ 未推 = Number(git(dir, ['rev-list', '--count', 'origin/main..HEAD'])); }
    catch(e){ 未推 = 1; }                                  /* 还没有 origin/main：整棵都得推上去 */
    const 名 = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
    if(名 !== 'main') 停(谁 + ' 这一棵当前不在 main 上（在 ' + 名 + '）。');
    if(未推 === 0){ P('  ' + 谁 + ' · 提交都已经在远端了，不推'); return; }
    try{
      git(dir, ['push', 'origin', 'main']);
      git(dir, ['push', 'origin', '--tags']);
    }catch(e){
      停(谁 + ' 这一棵推砸了（后面的棵还没推）：' + String((e && (e.stderr || e.stdout)) || (e && e.message) || e).replace(/\r?\n/g, ' ').slice(0, 400));
    }
    P('  ' + 谁 + ' · 推上去了（' + 未推 + ' 笔 + tag）');
  };
  P('');
  推(TREE, 'Flow-Desk', true);          /* 主仓有没有新东西由里面那一笔「未推的提交数」说了算 */
  for(const r of 家) 推(r.dir, r.repo, r.动了 || r.新tag);
}else P('\n（--不推：提交和打包都跑了，tag 没打、一根没推。）');

P('\n完了。主程序 ' + 主号 + ' · 页面 ' + 页名(主号) + ' · 首装那颗 exe 在 dist\\ 里，每一家的号都记在 flow-desk-install.json 那一格。');
