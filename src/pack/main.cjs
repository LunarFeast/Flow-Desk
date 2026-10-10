'use strict';
/* ============================================================
   Flow-Desk 的 Electron 壳：一个程序、一个窗口、一份托盘
   为写、声笔输入法练习、你的便签、你的句子、日程、音乐遥控器都是挂在
   Flow-Desk 下面的插件 —— 为写和声笔输入法练习那两份代码都拼在 Flow-Desk 那一张页里，
   由组件在窗口里就地开，不是另起的进程，也没有自己的托盘。
   页面直接加载 Flow-Desk\pages\ 里现成的 html，不拷副本、不改一行原文件；改完 html 重启就是新版。
   Electron 的 Chromium 没有 File System Access API，所以窗口里所有"选文件/选目录/读写盘"
   都走 preload.cjs 里那层原生对话框 + ipc 的兼容实现。
   ============================================================ */
const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, protocol, net, nativeTheme, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const netNode = require('net');   /* 电子那个 net 是发请求的，端口闸门要用 node 这份 */

/* root.json 由 build-app.mjs 写在产物里；开发时直接用上级目录 */
const ROOTS = loadRoots();
/* ---------- 一棵树分三层：pages\ 可整层覆盖，data\ 更新永不碰，update\ 是更新那一摊（第 15 条）----------
   Flow-Desk\
     pages\   出厂的 html 产物、帮助原件、图标资源 —— 软件更新就是换掉这一层（连同运行时和 exe）
     data\    你写的书（<书名>\history\、assets\）、你自己改过的功能模块和配方 plugins\、
              生成记录 gen-log\、组件自带的词库 <包名>-bank\、help.md 的工作副本、
              userdata-list.md（设置·数据 那个「用户数据详单」读的那份）、
              还有 userdata-fd（Electron 那份用户目录：便签日程配色、写作稿子、练习记录、缓存）、logs\
     update\  更新包 packages\、每趟装之前的旧层 backups\、成没成的账 result.txt
   三层名字全英文（2026-10-01 他拍的 D 案：不留中文别名）。老名字的 页面\ 数据\ 更新\ 由开机第一
   件事 prepareTrees() 自己改名搬正；搬不动（别的程序还占着）就一句大白话把程序停在这儿，
   绝不带着半截改名往下走 —— 代码只认英文名，半截改名等于让他打开一份空数据。
   再往前那种更老的布局（用户数据全挤在 pages\ 里）也一并搬正。
   一句话：要么完整一层覆盖，要么一个字节都不碰。 */
const TREE = ROOTS.tree;
/* 自带的兜底副本（整个文件夹拷到别的电脑、真目录里没有时用）：pages 和出厂 data 各一层 */
const PAGES_BUNDLED = path.join(__dirname, 'pages');
const DATA_BUNDLED = path.join(__dirname, 'data');
/* 开机第一件事：把这棵树摆正（老名字改名 + 老布局的用户数据搬进 data\）。
   这一句得排在 LAYER_REN / dataDirName / isBookDir 这三个后面（下面），const 没初始化就调它是 TDZ 崩 —— 详见那两个函数上面的注释。 */
const PAGES_ROOT = path.join(TREE, 'pages');
const DATA_ROOT = path.join(TREE, 'data');
/* 插件那一格读写的尺（三道闸和恢复出厂都在 comp-files.cjs 里）：
   活的那一层 = data\plugins\（运行时一家家 import 的就是这儿），
   出厂原文 = 自带的 resources\app\data\plugins\（拷回来才是「恢复出厂」，所以是真复制不是链接）。
   这一句得排在 prepareTrees 前面 —— 开机那趟摆树要用它铺组件层，const 没初始化就是 TDZ 崩。 */
const COMP = require('./comp-files.cjs')({
  live:() => path.join(DATA_ROOT, 'plugins'),
  factory:() => path.join(DATA_BUNDLED, 'plugins')
});
/* 只有一个程序，所以窗口、托盘、图标、入口页都只有一份定义。
   关窗口是先问「最小化还是退出」，不是直接退。
   第 24 条：这里不再有 shortcut —— 程序不抢后台全局快捷键，窗口没焦点时不响应任何键；
   窗口里能用的键位在设置的「快捷键」那一档列着。 */
/* label 是程序本体的名字（外39 和仓库名对齐：Flow-Desk，中间一个连字符）。
   这一格就是唯一一处：exe 文件名 = label + '.exe'（build-app 铺那颗、这一份认那个进程名、更新完重启起那颗，三处都读它）。
   用户数据不跟着它走 —— userData 在 setPath 那一行按树里 data\userdata-fd 定，改这个名字不会把谁的数据留在原地。
   entry 那一格是生成产物的文件名（Flow_Desk_<号>.html），那是文件命名法不是本体名，两边不是一回事。 */
const APP = { label:'Flow-Desk', icon:'FD_Icon', entry:'Flow_Desk_*.html',
              win:{ width:1440, height:860 }, tray:true };

/* root.json 里写的都是相对路径，相对这个 exe 自己的 resources\app 算（不是当前工作目录 ——
   双击启动时工作目录就是 exe 那一层，从别处拉起来的又不是，只有 __dirname 是稳的）。
   这样整个 Flow-Desk 文件夹挪盘、拷到别的电脑，root / src 都不用回来改。
   新写法是 tree（Flow-Desk\ 那一层，程序根目录）；老写法 root 指的 pages\ 也照样认 —— 它的上一级就是树根。 */
function loadRoots(){
  let tree = '', src = '';
  try{
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'root.json'), 'utf8'));
    if(j.tree) tree = path.resolve(__dirname, j.tree);
    else if(j.root){
      const r = path.resolve(__dirname, j.root);
      tree = /^pages$/i.test(path.basename(r)) ? path.dirname(r) : r;
    }
    src = j.src ? path.resolve(__dirname, j.src) : '';
  }catch(e){}
  if(!tree) tree = path.resolve(__dirname, '../..');
  if(process.env.FD_TREE) tree = path.resolve(process.env.FD_TREE);   /* 探针 / 开发实例指到别处去 */
  return { tree, src };
}
/* 一串候选路径里取第一个真存在的（页面层 / 数据层 / 自带的兜底副本都按实际存在的那个认） */
function pick(list){ for(const p of list){ try{ if(p && fs.existsSync(p)) return p; }catch(e){} } return null; }

/* ---------- 开机把树摆正（第 15 条 + 2026-10-01 那趟三层改名）----------
   一趟干两件事：
   A. 改名：页面\→pages\、数据\→data\、更新\→update\；data 里面的 日志\→logs\、
      每本书的 历史\→history\、搬家记录.txt→relocate.txt；update 里面的 包\暂存\备份\更新结果.txt
      →packages\staging\backups\result.txt。
   B. 更老那种布局（用户数据全挤在 pages\ 里、userdata-* 散在树根）搬进 data\。
   三条硬规矩：
   ① 只要看到有任何一个程序还开着，这一趟一个名字都不改、一个字节都不动，而且把「停」带回主进程 ——
      代码只认英文名，半截改名等于让他打开一份空数据，那比不开严重得多；
   ② 目标位置已经有同名的就跳过，绝不覆盖（宁可两处并存，也不能吃掉任何一份数据）；
   ③ 每一步都写进 data\relocate.txt，出了事回头看得见到底是什么。 */
const LAYER_REN = [['页面', 'pages'], ['数据', 'data'], ['更新', 'update']];
/* 哪些算"用户自己长出来的数据"：点名过的几个 + 运行日志（老名字 日志 也认，改名那一趟在它后面）。
   词库目录不再一个个点名了 —— 词库跟着功能走，谁的包都能自带一份，
   口径改成「结尾是 -bank 就算」（哪个包自带的都命中，以后新添的词库不用来改这里）。
   写成函数、不写成 const —— prepareTrees 在模块顶上就要跑，那会儿 const 还没初始化（TDZ 直接崩给他在托盘上看）。 */
function dataDirName(n){
  return ['plugins', 'gen-log', 'logs', '日志'].indexOf(n) >= 0 || /-bank$/.test(String(n || ''));
}
function isBookDir(dir){
  for(const mark of ['history', '历史', 'assets']){
    try{ if(fs.statSync(path.join(dir, mark)).isDirectory()) return true; }catch(e){}
  }
  return false;
};
/* 上面那几个备齐了才动这一下：摆树用的就是它们。返回 { log, blocked }，blocked 非空 = 这树还没摆正，
   主进程下面据此弹窗收工，绝不带着一半的名字开机。 */
const MIGRATE = prepareTrees(TREE);
/* ---------- 外42 二 · 一键清理所有用户数据 ----------
   页面上点那一颗的时候不删：浏览器存储那一格（用户档里 IndexedDB / Local Storage 那几棵）被内核自己占着，
   当场删不干净，删一半比不删更糟。所以那一步只留一张字条，真删排在下面这一趟 —— 任何数据文件落地之前、
   内核还没碰存储之前，整格清一遍。清完就是刚装好的样子。
   留三样：插件那一格（代码与名单，那是程序不是数据）、日志、搬家那本账。 */
const WIPE_FILE = () => path.join(DATA_ROOT, 'wipe-user.json');
const WIPE_KEEP = ['plugins', 'logs', 'relocate.txt'];
function userWipe(){
  const out = { log:[], deleted:[], failed:[] };
  let 字条 = null;
  try{ 字条 = JSON.parse(fs.readFileSync(WIPE_FILE(), 'utf8')); }catch(e){ return out; }
  let names = [];
  try{ names = fs.readdirSync(DATA_ROOT); }
  catch(e){ out.log.push('清用户数据没跑成：那一格列不出来（' + ((e && e.code) || e) + '）'); return out; }
  for(const n of names){
    if(WIPE_KEEP.includes(n) || n === 'wipe-user.json') continue;
    try{ fs.rmSync(path.join(DATA_ROOT, n), { recursive:true, force:true, maxRetries:4, retryDelay:150 }); out.deleted.push(n); }
    catch(e){ out.failed.push(n + '（' + ((e && e.code) || e) + '）'); }
  }
  try{ fs.rmSync(WIPE_FILE(), { force:true }); }
  catch(e){ out.failed.push('wipe-user.json（字条删不掉）'); }
  out.log.push('清用户数据：按 ' + (字条 && 字条.requestedAt ? 字条.requestedAt : '那张没读出日期的字条') + ' 排下的一趟清完 · 删掉 ' +
    out.deleted.length + ' 项' + (out.deleted.length ? '（' + out.deleted.join('、') + '）' : '') +
    ' · 留着 ' + WIPE_KEEP.join('、') + (out.failed.length ? ' · 没删掉 ' + out.failed.length + ' 项：' + out.failed.join('、') : ''));
  return out;
}
const WIPE = userWipe();
/* 清掉的那几份里有帮助、用户数据详单和两份清单 —— 它们本来就是开机那一趟（摆树）从 resources\app\data
   铺下来的。可这一趟清在摆树之后，铺好的又被删了，于是「重启之后就是刚装好的样子」要等再下一趟才成立：
   头一次开机点清理的人，那一整趟点开帮助和详单都是「读不到」。所以清完当场把摆树那一趟再走一遍 ——
   它认的就是「这一份不在就铺一份、在就一个字不动」，重跑不改任何已有的东西。 */
if(WIPE.deleted.length){
  try{ prepareTrees(TREE).log.forEach(s => WIPE.log.push('清完补铺：' + s)); }
  catch(e){ WIPE.log.push('清完补铺没跑成：' + ((e && e.code) || e)); }
}
/* 这台电脑上是不是还开着另一个 Flow-Desk：tasklist 数一遍进程名，把自己这一摊剔掉。
   自己这一摊 = 主进程 +  Electron 自己拉的那些副进程（GPU / 渲染 / 网络 / 工具），
   它们和主进程同名同 exe，光剔 process.pid 会把自己算成"别人"，更新按钮就永远按不下去。
   app.getAppMetrics() 只列本实例的副进程（child_process 起的副进程不在里面，照样算别人），
   一次命令不用多开，开机那趟也就没有额外开销。
   为写、声笔输入法练习是开在这个窗口里的页面，不是另起的进程 —— 这里只认那一颗 exe（APP.label + '.exe'）一个名字。 */
function myOwnPids(){
  const s = new Set([process.pid]);
  try{ for(const m of app.getAppMetrics()) s.add(m.pid); }catch(e){}
  return s;
}
function runningSiblings(){
  const exe = APP.label + '.exe';
  const out = [];
  try{
    const mine = myOwnPids();
    const txt = require('child_process').execSync('tasklist /fo csv /nh', { windowsHide:true, encoding:'utf8' });
    for(const line of txt.split(/\r?\n/)){
      const m = line.match(/^"([^"]+)","(\d+)"/);
      if(!m) continue;
      if(mine.has(Number(m[2]))) continue;
      if(m[1].toLowerCase() === exe.toLowerCase() && out.indexOf(APP.label) < 0) out.push(APP.label);
    }
  }catch(e){ return []; }   /* 数不动就当没人在跑：后面 rename 自己会失败，不会搬坏 */
  return out;
}
function prepareTrees(tree){
  const log = [];
  const blocked = [];
  const at = p => path.relative(tree, p).replace(/\\/g, '\\');
  /* 记账：往 relocate.txt 补一段。data\ 还没落地就先用老名那一本记，绝不在这一步凭空建出
     一个空的 data\ —— 真那样，下一趟 数据→data 的改名就撞着同名，树会永远卡在半截。 */
  const save = () => {
    if(!log.length) return;
    const to = [path.join(tree, 'data', 'relocate.txt'), path.join(tree, '数据', '搬家记录.txt'),
      path.join(tree, '数据', 'relocate.txt')].find(p => { try{ return fs.existsSync(path.dirname(p)); }catch(e){ return false; } });
    if(!to) return;
    try{
      fs.appendFileSync(to, new Date().toLocaleString('zh-CN') + '⏎' + log.join('\n') + '\n\n');
    }catch(e){}
  };
  const mv = (from, to) => {
    if(!fs.existsSync(from)) return false;
    if(fs.existsSync(to)){ log.push('跳过 ' + at(from) + '：' + at(to) + ' 已经有同名，一个没动'); return false; }
    try{
      fs.mkdirSync(path.dirname(to), { recursive:true });
      fs.renameSync(from, to);
      log.push('搬 ' + at(from) + ' → ' + at(to));
      return true;
    }catch(e){ blocked.push(at(from) + ' → ' + at(to) + '（' + (e && e.code || e) + '）'); return false; }
  };
  /* 停下来：先记好这一趟做过的，再把要说的话交出去（外面据此弹窗并退出，不会带着空树开机） */
  const stop = why => { save(); return { log, blocked: why }; };
  /* 目录撞名不是「丢掉」，是一个一个并过去（里面同名的那一个照旧不动）。
     老布局里 日志\ 可能两处都有、一本书的 历史\ 和 history\ 也并存过 —— 中文名字要清干净，
     可他存进去的东西一个也不能少，所以并完再撤掉空壳，非空就留着下回接着弄。 */
  const merge = (from, to) => {
    if(!fs.existsSync(from)) return false;
    let isDir = false;
    try{ isDir = fs.statSync(from).isDirectory(); }catch(e){ return false; }
    if(!isDir) return mv(from, to);
    if(!fs.existsSync(to)) return mv(from, to);
    let moved = 0;
    try{
      /* readdirSync 不带 withFileTypes 时回来的就是一串文件名字符串，别当对象用 */
      for(const name of fs.readdirSync(from)){
        const before = log.length;
        mv(path.join(from, name), path.join(to, name));
        if(log.length > before && !/跳过/.test(log[log.length - 1])) moved++;
      }
    }catch(e){ blocked.push(at(from) + ' 并不动（' + (e && e.code || e) + '）'); return false; }
    try{
      if(!fs.readdirSync(from).length){ fs.rmdirSync(from); log.push('并入 ' + at(to) + ' 之后把空壳 ' + at(from) + ' 撤了'); }
      else log.push(at(from) + ' 还有并不过去的（同名撞车），留着下回看');
    }catch(e){}
    return moved > 0;
  };
  /* 每本书目录里的 历史\→history\：把整层 data（或任何一层）里的书目录走一遍。
     A、B 两趟都要用 —— 老布局的书是 B 才搬进 data 的，只在 A 走一遍会漏掉它们。 */
  const renBooks = dir => {
    try{
      for(const e of fs.readdirSync(dir, { withFileTypes:true })){
        if(!e.isDirectory() || e.name === 'logs' || e.name === '日志' || dataDirName(e.name) ||
           /^userdata[-.]/.test(e.name)) continue;
        merge(path.join(dir, e.name, '历史'), path.join(dir, e.name, 'history'));
      }
    }catch(e){}
  };
  /* ---------- A. 三层改名：只要树根上还挂着中文名的任何一层，这一趟就得干活 ---------- */
  const needRen = LAYER_REN.some(([cn]) => { try{ return fs.existsSync(path.join(tree, cn)); }catch(e){ return false; } });
  if(needRen){
    const busy = runningSiblings();
    if(busy.length)
      return stop('三层目录还没改成英文名（pages / data / update），而 ' + busy.join('、') +
        ' 正开着占着它们。把三个程序全关掉再打开这一次，名字自己就改好了 —— 改名的过程记在 data\\relocate.txt。');
    for(const [cn, en] of LAYER_REN) mv(path.join(tree, cn), path.join(tree, en));
    if(blocked.length)
      return stop('三层目录改名改到一半改不动：' + blocked.join('、') +
        '。一个名字没改成的一层还在原地，先关掉所有还开着的窗口（包括资源管理器里正看着这两个文件夹的）再打开一次。');
    /* data 里面跟着改：日志\→logs\、搬家记录.txt→relocate.txt、每本书的 历史\→history\ */
    const data = path.join(tree, 'data');
    merge(path.join(data, '日志'), path.join(data, 'logs'));
    merge(path.join(data, '搬家记录.txt'), path.join(data, 'relocate.txt'));
    renBooks(data);
    /* update 里面跟着改：包\暂存\备份\更新结果.txt → packages\staging\backups\result.txt */
    const upd = path.join(tree, 'update');
    merge(path.join(upd, '包'), path.join(upd, 'packages'));
    merge(path.join(upd, '暂存'), path.join(upd, 'staging'));
    merge(path.join(upd, '备份'), path.join(upd, 'backups'));
    merge(path.join(upd, '更新结果.txt'), path.join(upd, 'result.txt'));
    log.push('三层已改成英文名：pages\\ / data\\ / update\\（老名字不再认）');
  }
  const data = path.join(tree, 'data');
  const legacyPages = path.join(tree, 'pages');
  let pages = fs.existsSync(legacyPages) ? legacyPages : null;
  /* ---------- B. 更老那种布局：用户数据还挤在 pages\ 里、userdata-* 还散在树根 ----------
     分两种：legacyData —— 数据还在 pages\ 里头，不搬程序起来就是个空树，这种非搬不可；
             misc —— 只是零碎没归位（userdata-* 在树根、日志在 exe 旁边、help 工作副本没落），
                     不碍着读，占用就下回开机再弄。 */
  let legacyData = false, misc = false;
  if(pages) try{
    for(const e of fs.readdirSync(pages, { withFileTypes:true })){
      if(!e.isDirectory()) continue;
      const p = path.join(pages, e.name);
      if(dataDirName(e.name) || isBookDir(p) || /^userdata[-.]/.test(e.name)){ legacyData = true; break; }
    }
  }catch(e){}
  if(!misc) for(const w of ['fd', 'wnw', 'rp']) if(fs.existsSync(path.join(tree, 'userdata-' + w))){ misc = true; break; }
  if(!misc && !fs.existsSync(path.join(data, 'help.md'))) misc = true;
  if(!misc) for(const n of ['日志']) if(fs.existsSync(path.join(tree, n))){ misc = true; break; }
  if(legacyData || misc){
    const busy = runningSiblings();
    if(busy.length){
      if(legacyData)
        return stop('还没搬家：' + busy.join('、') + ' 正开着，而用户数据还在 pages\\ 里头 —— 这种状态程序不能起。' +
          '把三个程序全关掉再打开这一次，自己就搬好了（搬的过程记在 data\\relocate.txt）。');
      log.push('零碎没归位：' + busy.join('、') + ' 还开着。关掉三个程序再打开，自己就归位了');
    }
    else{
      try{ fs.mkdirSync(data, { recursive:true }); }
      catch(e){ blocked.push('没搬家：建 data\\ 就失败了（' + (e && e.code || e) + '）'); }
      const before = blocked.length;
      /* pages 里混着的数据先拣出去（ userdata-* 也有可能挤在老页面层里，一并进去 ） */
      if(pages && !blocked.length) try{
        for(const e of fs.readdirSync(pages, { withFileTypes:true })){
          if(!e.isDirectory()) continue;
          const p = path.join(pages, e.name);
          if(dataDirName(e.name) || isBookDir(p) || /^userdata[-.]/.test(e.name))
            merge(p, path.join(data, e.name === '日志' ? 'logs' : e.name));
        }
      }catch(e){ log.push('读 ' + at(pages) + ' 失败：' + (e && e.code || e)); }
      /* 三个 exe 的用户目录一起进去（Electron 那份：便签日程配色、写作库、练习记录、单实例锁） */
      for(const w of ['fd', 'wnw', 'rp']) merge(path.join(tree, 'userdata-' + w), path.join(data, 'userdata-' + w));
      /* 老布局的 日志\ 在 exe 旁边，跟着进 data\ */
      merge(path.join(tree, '日志'), path.join(data, 'logs'));
      /* 书是这一趟才搬进 data 的，它们的 历史\→history\ 得在这儿再走一遍 */
      renBooks(data);
      if(!legacyData && blocked.length > before){      /* 零碎搬不动不碍事：照旧记一笔，下回再试 */
        for(let i = before; i < blocked.length; i++) log.push('先记下，下回开机再弄：' + blocked[i]);
        blocked.length = before;
      }
    }
  }
  /* help.md：出厂那份留在 pages\ 里跟着更新走，工作副本落在 data\，页面上读的是工作副本。
     工作副本是给用户自己改的，所以刷新它之前先问一句"他动过没有"：旁边记一份 help-shipped.json
     （出厂版的内容 hash），hash 对得上 = 他没动过 → 直接换新；对不上 = 他改过 → 一个字不碰，只记账。
     旧版的帮助是 help.html：那份文件一个字不动、也不删，只是不再读它（换格式的账记在日志里）。 */
  syncHelp(data, pages, log);
  /* 两份清单（界面文字 / 卡片大小）第一次开机也从自带那一层落到 data\，落地之后这一份归用户。 */
  syncLists(data, log);
  /* 插件那一层：代码运行时从 data\plugins\ 一家家加载，不在产物里拼着。
     整个文件夹拷到新机器上时这一层可能还没落地（数据层是用户自己长出来的）——
     这时候把程序自带的那一份原样铺过去（已有的一格都不动），第一次打开就有功能。 */
  try{
    const s = COMP.seedMissing();
    if(s.ok && s.laid) log.push('插件从自带那一层铺过来 ' + s.ids.length + ' 家（' + s.ids.join('、') + '）· ' + s.laid + ' 份文件');
    else if(!s.ok) log.push(s.msg);
  }catch(e){ log.push('插件那一层没铺成：' + (e && e.code || e)); }
  save();
  return { log, blocked: blocked.join('；') };
}
/* 一份文件的 sha1（读不到就空串）：只用来判"这份有没有被人改过" */
function fileHash(f){
  try{ return require('crypto').createHash('sha1').update(fs.readFileSync(f)).digest('hex'); }catch(e){ return ''; }
}
function syncHelp(data, pages, log){
  const work = path.join(data, 'help.md'), stamp = path.join(data, 'help-shipped.json');
  const src = [path.join(pages || '', 'help.md'), path.join(PAGES_BUNDLED, 'help.md'),
    path.join(DATA_BUNDLED, 'help.md')].find(x => { try{ return x && fs.statSync(x).isFile(); }catch(e){ return false; } });
  if(!src) return;
  const srcHash = fileHash(src);
  let rec = { hash:'' };
  try{ rec = JSON.parse(fs.readFileSync(stamp, 'utf8')); }catch(e){}
  try{
    if(!fs.existsSync(work)){
      fs.mkdirSync(data, { recursive:true });
      fs.copyFileSync(src, work);
      fs.writeFileSync(stamp, JSON.stringify({ hash: srcHash }, null, 2));
      log.push('help.md 工作副本第一次落地：' + path.basename(src) + ' → data\\help.md');
      if(fs.existsSync(path.join(data, 'help.html')))
        log.push('旧的 data\\help.html 原样留着不删；程序现在读的是 data\\help.md，你改过旧版的话自己把内容对过来');
      return;
    }
    if(rec.hash === srcHash) return;                        /* 出厂版没动，什么都不做 */
    if(fileHash(work) !== rec.hash){                        /* 他自己改过工作副本：不覆盖，只说一次 */
      if(rec.pending !== srcHash){
        fs.writeFileSync(stamp, JSON.stringify({ hash: rec.hash, pending: srcHash }, null, 2));
        log.push('出厂版 help.md 更新了，但你改过 data\\help.md，这份一个字没动 —— 要合自己拿 pages\\help.md 对一下');
      }
      return;
    }
    fs.copyFileSync(src, work);
    fs.writeFileSync(stamp, JSON.stringify({ hash: srcHash }, null, 2));
    log.push('help.md 工作副本跟着出厂版刷新（你没改过它）');
  }catch(e){ log.push('help.md 没弄成：' + (e && e.code || e)); }
}
/* 两份清单的自动落地（#270）：界面文字 ui-text.yaml、卡片大小 card-size.yaml 的真身就是
   data\ 里这两份明文，出厂那份跟着程序走（resources\app\data\）。第一次开机把自带那份铺到
   data\，铺完这一份就归用户：以后一个字不再覆盖（他改过的改动写回源码是另一条路，走 plan/apply）。
   自带那一层没带这份（老包）就不铺，读清单那里照旧能从源码现扫一份兜底。
   两个触发口：开机这一趟（记进搬家日志）+ 哪一份还没铺成而页面先来读它（补铺，不记日志）。
   「用户数据详单」那一屏读的 userdata-list.md 不在这一列里，也不在出厂层里：那一篇是用户自己写的，
   首次安装就没有它，清掉之后也没有谁替它兜底 —— 那一屏说「读不到」就是正确行为（2026-10-10 他定的）。 */
function layList(data, name, log){
  const work = path.join(data, name), src = path.join(DATA_BUNDLED, name);
  if(fs.existsSync(work)) return true;
  try{ if(!fs.statSync(src).isFile()) return false; }catch(e){ return false; }
  try{
    fs.mkdirSync(data, { recursive:true });
    fs.copyFileSync(src, work);
    if(log) log.push(name + ' 第一次落地：resources\\app\\data → data\\' + name);
    return true;
  }catch(e){
    if(log) log.push(name + ' 没落成人：' + (e && e.code || e));
    return false;
  }
}
function syncLists(data, log){
  for(const n of ['ui-text.yaml', 'card-size.yaml']){ try{ layList(data, n, log); }catch(e){} }
}

/* ---------- 版本号文件取最新：文件名里那段版本号最大那个 ----------
   双段版本号：前段是程序版本（1.4.0-dev），后段是生成流水号（.3），
   中间用点连着、前段里还带着 -dev，所以取号那段得能吃字母和连字符，不能只认 [\d.]。
   号只写在 src\_build\version.json 那一格，产物文件名是它在盘上唯一的载体。 */
function latestIn(full){
  const dir = path.dirname(full), pat = path.basename(full);
  if(!pat.includes('*')) return fs.existsSync(full) ? full : null;
  const re = new RegExp('^' + pat.split('*').map(escapeRe).join('([\\d][\\w.+-]*)') + '$');
  let best = null;
  try{
    for(const n of fs.readdirSync(dir)){
      const m = n.match(re);
      if(!m) continue;
      const raw = m.slice(1).join('-'), v = verNum(raw);
      const c = best ? cmpVer(v, best.v) : 1;
      if(c > 0 || (c === 0 && raw > best.raw)) best = { f:path.join(dir, n), v, raw };
    }
  }catch(e){ return null; }
  return best ? best.f : null;
}
/* 1.4.0-dev.3 → [1,4,0,3]：dev 这类字只当分隔符 */
function verNum(raw){ return raw.split(/[^\d]+/).filter(Boolean).map(Number); }
function resolveEntry(rel){
  return latestIn(path.join(PAGES_ROOT, rel)) || latestIn(path.join(PAGES_BUNDLED, rel));
}
function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function cmpVer(a, b){ for(let i = 0; i < Math.max(a.length, b.length); i++){ const d = (a[i]||0) - (b[i]||0); if(d) return d; } return 0; }

/* URL 的形状：pages 层里的文件照旧是 fdapp://app/<相对 pages\>，
   data 层带一个 data/ 开头（fdapp://app/data/<包名>-bank/data.txt），serve 那边按同一个口径认。
   自带的兜底副本按它自己那层算相对路径：整个文件夹拷到别的盘、root.json 还没改好时，
   拿树根去 relative 会跨盘算出一个绝对路径，URL 就废了。 */
function inside(p, root){ return !!root && (p === root || p.startsWith(root + path.sep)); }
function toUrl(file){
  let rel;
  if(inside(file, DATA_ROOT)) rel = 'data/' + path.relative(DATA_ROOT, file);
  else if(inside(file, PAGES_ROOT)) rel = path.relative(PAGES_ROOT, file);
  else if(inside(file, DATA_BUNDLED)) rel = 'data/' + path.relative(DATA_BUNDLED, file);
  else if(inside(file, PAGES_BUNDLED)) rel = path.relative(PAGES_BUNDLED, file);
  else rel = path.relative(TREE, file);
  return 'fdapp://app/' + String(rel).replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/');
}

/* ---------- fdapp:// 协议：把 URL 路径映射回磁盘文件，只允许这棵树以内 ---------- */
protocol.registerSchemesAsPrivileged([
  { scheme:'fdapp', privileges:{ standard:true, secure:true, supportFetchAPI:true, stream:true, corsEnabled:true } }
]);

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.txt':'text/plain; charset=utf-8', '.md':'text/markdown; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2', '.map':'application/json' };

function serve(request){
  const u = new URL(request.url);
  let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
  /* 四个门牌挨个试：pages 层 → 树根（data/ 开头的那条走这里）→ 自带的 pages → 自带的 data。
     老页面里写的 ../<词库目录>/... 这类还没改口径的相对路径，落回自带的副本，照样打得开。 */
  const cands = [path.resolve(PAGES_ROOT, rel), path.resolve(TREE, rel),
    path.resolve(PAGES_BUNDLED, rel), path.resolve(DATA_BUNDLED, rel.replace(/^data\//, ''))];
  const ok = cands.filter(p => inside(p, TREE) || inside(p, PAGES_BUNDLED) || inside(p, DATA_BUNDLED));
  if(!ok.length) return new Response('forbidden', { status:403 });
  let target = ok[0];
  for(const p of ok){ try{ if(fs.statSync(p).isFile()){ target = p; break; } }catch(e){} }
  try{
    const buf = fs.readFileSync(target);
    return new Response(buf, { headers:{ 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control':'no-store', 'Access-Control-Allow-Origin':'*' } });
  }catch(e){ return new Response('not found: ' + rel, { status:404 }); }
}

/* ---------- 原生对话框 + 磁盘读写，给 preload 的兼容层用 ----------
   FD_AUTOTEST_PICK 是路径数组，探针跑的时候按顺序当作"用户选中的东西"返回，
   原生对话框没法自动化点，整条链只能这样验。 */
const autotest = (() => { try{ return JSON.parse(process.env.FD_AUTOTEST_PICK || '[]'); }catch(e){ return []; } })();
function nextPick(){
  const v = autotest.shift();
  if(v === undefined) return { paths: [] };
  return { paths: Array.isArray(v) ? v : [v] };
}

/* ---------- 选文件、选目录记上一次那一处（外21 乙-1）----------
   各记各的，不是一条全局记忆：壁纸记壁纸的来处、更新包记更新包的来处，互不串。
   键用的是调用方本来就传的那个 id（FileSystemAccess 那套标准字段，真浏览器里也是拿它记目录的），
   所以谁递了 id 谁就有记忆，没递的照旧开在系统默认那一处，行为一个字不变。
   落在用户目录里那一格 ui-paths.json，记事本可看可删（和 ui-band.json 同一待遇）。 */
function uiPaths(){
  try{ return JSON.parse(fs.readFileSync(dataPath('ui-paths.json'), 'utf8')) || {}; }catch(err){ return {}; }
}
function uiPathStart(id){
  if(!id) return '';
  const p = String(uiPaths()[String(id)] || '');
  /* 记的那一处没了（挪盘、删了）就当没记：给对话框一个不存在的目录，它会开到一个说不清的地方 */
  try{ return p && fs.statSync(p).isDirectory() ? p : ''; }catch(err){ return ''; }
}
function uiPathRemember(id, picked){
  if(!id || !picked) return;
  let dir = '';
  try{ dir = fs.statSync(picked).isDirectory() ? picked : path.dirname(picked); }catch(err){ return; }
  const m = uiPaths();
  if(m[String(id)] === dir) return;
  m[String(id)] = dir;
  try{
    const p = dataPath('ui-paths.json');
    fs.mkdirSync(path.dirname(p), { recursive:true });
    fs.writeFileSync(p, JSON.stringify(m, null, 2), 'utf8');
  }catch(err){}
}

ipcMain.handle('fsa:pickFiles', async (e, opts) => {
  if(autotest.length) return nextPick();
  const o = opts || {};
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
    title: o.title || '选文件', properties: o.multiple ? ['openFile','multiSelections'] : ['openFile'],
    defaultPath: uiPathStart(o.id), filters: toFilters(o.accept)
  });
  if(r.canceled || !r.filePaths.length) return { paths:[] };
  uiPathRemember(o.id, r.filePaths[0]);
  return { paths: r.filePaths };
});

ipcMain.handle('fsa:pickDir', async (e, opts) => {
  if(autotest.length) return nextPick();
  const o = opts || {};
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
    title: o.title || '选目录', defaultPath: uiPathStart(o.id), properties:['openDirectory', 'createDirectory']
  });
  if(r.canceled || !r.filePaths.length) return { paths:[] };
  uiPathRemember(o.id, r.filePaths[0]);
  return { paths: r.filePaths };
});
ipcMain.handle('fs:read', async (e, p) => {
  const buf = await fs.promises.readFile(p);
  const st = await fs.promises.stat(p);
  return { name: path.basename(p), data: new Uint8Array(buf), type: MIME_TYPE_BY_EXT[path.extname(p).toLowerCase()] || 'application/octet-stream',
    lastModified: Math.round(st.mtimeMs) };
});
const MIME_TYPE_BY_EXT = { '.html':'text/html', '.txt':'text/plain', '.json':'application/json', '.yaml':'text/yaml', '.yml':'text/yaml',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.webp':'image/webp', '.bmp':'image/bmp' };
ipcMain.handle('fs:write', async (e, p, data, mkdir) => {
  if(mkdir) await fs.promises.mkdir(path.dirname(p), { recursive:true });
  await fs.promises.writeFile(p, Buffer.isBuffer(data) || data instanceof Uint8Array ? data : Buffer.from(String(data), 'utf8'));
  return true;
});
/* 只往末尾接一段（为写那一章的逐字记录用）：这条路只能加，不能盖 ——
   历史记录要的是"程序里没有改写的那一手"，所以主进程也不给第二个口子。 */
ipcMain.handle('fs:append', async (e, p, text) => {
  await fs.promises.mkdir(path.dirname(p), { recursive:true });
  await fs.promises.appendFile(p, Buffer.from(String(text), 'utf8'));
  return true;
});
ipcMain.handle('fs:stat', async (e, p) => {
  try{ const st = await fs.promises.stat(p); return { exists:true, isDirectory:st.isDirectory(), size:st.size, mtime:Math.round(st.mtimeMs) }; }
  catch(err){ return { exists:false }; }
});
/* 只读文件的一段：内嵌歌词在 mp3 / flac / m4a / mkv 的头部标签里，
   没必要为了一行歌词把整首歌搬进内存（页面那边走 File.slice，同样只读这一段）。 */
ipcMain.handle('fs:readRange', async (e, p, start, length) => {
  const fd = await fs.promises.open(p, 'r');
  try{
    const st = await fd.stat();
    const from = Math.max(0, Math.min(st.size, Math.floor(Number(start) || 0)));
    const len = Math.max(0, Math.min(st.size - from, Math.floor(Number(length) || 0)));
    const buf = Buffer.alloc(len);
    if(len) await fd.read(buf, 0, len, from);
    return new Uint8Array(buf);
  }finally{ await fd.close(); }
});
ipcMain.handle('fs:mkdir', async (e, p) => { await fs.promises.mkdir(p, { recursive:true }); return true; });
/* 删文件 / 删目录：只删数据目录以内，挡越界的算法在 preload 的 pagePath 里，和写文件同一套 */
ipcMain.handle('fs:unlink', async (e, p, recursive) => {
  try{ await fs.promises.rm(p, { recursive:!!recursive, force:true }); }
  catch(err){ await fs.promises.unlink(p); }
  return true;
});
ipcMain.handle('fs:list', async (e, p) => {
  try{ return await fs.promises.readdir(p, { withFileTypes:true })
    .then(es => es.map(x => ({ name:x.name, kind: x.isDirectory() ? 'directory' : 'file' }))); }
  catch(err){ return []; }
});
/* 整棵目录树的 stat 一次报完：开机那份文件缓存靠 size+mtime 比对，
   几百个文件要是逐个问一遍，光 ipc 往返就把省下来的时间吃回去了。
   只收点名的后缀，深度和条数各设一道顶，不读内容。 */
ipcMain.handle('fs:tree', async (e, p, exts) => {
  const want = Array.isArray(exts) && exts.length ? exts.map(x => String(x).toLowerCase()) : null;
  const out = [], MAXN = 20000, MAXD = 12;
  async function walk(dir, base, depth){
    if(out.length >= MAXN || depth > MAXD) return;
    let es; try{ es = await fs.promises.readdir(dir, { withFileTypes:true }); }catch(err){ return; }
    for(const x of es){
      const rel = base ? base + '/' + x.name : x.name;
      if(x.isDirectory()){ await walk(path.join(dir, x.name), rel, depth + 1); continue; }
      const low = x.name.toLowerCase();
      if(want && !want.some(s => low.endsWith(s))) continue;
      try{ const st = await fs.promises.stat(path.join(dir, x.name));
        out.push({ path:rel, name:x.name, size:st.size, mtime:Math.round(st.mtimeMs) }); }catch(err){}
    }
  }
  await walk(String(p || ''), '', 0);
  return out;
});
/* 按路径读一个文本文件（比对完指纹之后，只读变了的那几个） */
ipcMain.handle('fs:readText', async (e, p) => {
  try{ return await fs.promises.readFile(String(p || ''), 'utf8'); }catch(err){ return null; }
});
ipcMain.handle('cfg:closeGet', async () => readCloseMode());
ipcMain.handle('cfg:closeSet', async (e, m) => writeCloseMode(m));

/* ---------- FD 数据：数据\userdata-<app>\ 就是默认数据目录 ----------
   页面那一套"选一个目录授权"是给沙箱用的，exe 没这个限制，
   所以明文 json 直接落在数据目录里，记事本就能看能改，整个文件夹拷走数据跟着走。
   只允许读写用户目录以内，越界的相对路径一律拒。 */
const DATA_DIR = () => app.getPath('userData');
function dataPath(rel){
  const root = path.resolve(DATA_DIR());
  const p = path.resolve(root, String(rel || ''));
  if(p !== root && !p.startsWith(root + path.sep)) throw new Error('数据路径跑出了用户目录：' + rel);
  return p;
}
ipcMain.handle('data:dir', async () => DATA_DIR());
ipcMain.handle('data:read', async (e, rel) => {
  try{ return await fs.promises.readFile(dataPath(rel), 'utf8'); }catch(err){ return null; }
});
ipcMain.handle('data:write', async (e, rel, text) => {
  const p = dataPath(rel);
  await fs.promises.mkdir(path.dirname(p), { recursive:true });
  await fs.promises.writeFile(p, String(text), 'utf8');
  return true;
});
ipcMain.handle('data:list', async () => {
  try{ return (await fs.promises.readdir(DATA_DIR(), { withFileTypes:true })).filter(x => x.isFile()).map(x => x.name).sort(); }
  catch(err){ return []; }
});
/* ---------- 定期备份（外30 戊组）----------
   抄的这一颗在 backup.cjs 里，它自己不认识 Electron：fs / path 从这儿递下去，
   自检脚本拿同一颗跑真的临时目录，量得出的才算做完。
   默认就一处：data\ 那一层。书、文稿、卡片、看板、逐字记录、插图、插件、词库，
   连同这个宿主的用户目录 data\userdata-fd\（明文 json 那几份配置）都在它底下 ——
   用户目录是数据层的一个子目录，不是并列的第二处，所以不各列一条（列两条就把配置抄了两遍）。
   他自己再点的文件夹走 cfg.extra 递进来。 */
const BACKUP = require('./backup.cjs')({ fs, path });
/* 要抄的几处：默认就数据层那一棵，外加他自己点的文件夹 */
function backupRoots(cfg){
  const out = [{ label:'数据', dir:DATA_ROOT }];
  for(const x of ((cfg && cfg.extra) || [])){
    const dir = String((x && x.dir) || '');
    if(!dir) continue;
    out.push({ label:String((x && x.label) || '').trim() || path.basename(dir) || '外加', dir });
  }
  /* 名字撞了要给号：两颗根重名会一起写进同一个子文件夹，后抄的那份把先抄的顶掉 */
  const 见 = new Map();
  for(const r of out){
    const n = 见.get(r.label) || 0; 见.set(r.label, n + 1);
    if(n) r.label = r.label + '-' + (n + 1);
  }
  return out;
}
/* 落点不许跑在被抄的其中一处里面那一层防护在 backup.cjs 里（自检脚本拿得到那一颗） */
ipcMain.handle('backup:run', async (e, cfg) => await BACKUP.run(
  Object.assign({}, cfg || {}, { dest:String((cfg && cfg.dest) || '') }), backupRoots(cfg)));
ipcMain.handle('backup:last', async (e, dest) => await BACKUP.last(String(dest || '')));
/* 到点没、下一颗表该设到哪一刻：上一次抄在哪一个文件夹里只有磁盘知道，页面问这一句拿账 */
ipcMain.handle('backup:check', async (e, cfg) => await BACKUP.check(cfg && typeof cfg === 'object' ? cfg : {}));
/* 挑目录走页面那口子（showDirectoryPicker）就行，这一条只是把「上次挑到哪儿」的主进程口径递上来 */
ipcMain.handle('backup:roots', async () => backupRoots({}));
ipcMain.handle('cfg:rimeGet', async () => readRimeDir());
ipcMain.handle('cfg:rimeSet', async (e, p) => writeRimeDir(p));
/* 从前这里还有一条 'rime:themes'：把 Rime 用户目录里 build\weasel.yaml、weasel.yaml、weasel.custom.yaml
   三份原文一并读回页面，交给 Flow-Desk 解析成配色。件-9 整条撤下 Rime 配色，这条通道跟着撤了；
   上面那两条 cfg:rime* 留着 —— 那是声笔输入法练习指 Rime 用户目录用的，读词库和方案，与配色无关。 */
/* ---------- 系统字体清单 ----------
   页面里那个 queryLocalFonts 要用户手势 + 授权弹窗，开机静默读不到，所以这里用系统自带的
   PowerShell 走 WPF 的字体表（一家一条，底下有哪几档真脸系统自己报）。
   枚举要将近一秒，所以结果缓存成明文：开机先立刻把缓存那份给页面用，同一时刻后台重数一遍再推过来。 */
ipcMain.handle('font:list', async (e, force) => await listInstalledFonts(!!force));
/* ---------- 粘网址 → 抓标题 ----------
   页面里 fetch 别的域名会被同源策略拦掉，只能主进程去取。只读 <title>，四秒不回来就算了。
   编码按 utf-8 试，读不通再退回 gbk（老中文站还是这个编码）。 */
ipcMain.handle('web:title', async (e, url) => {
  try{
    const u = new URL(String(url || ''));
    if(!/^https?:$/.test(u.protocol)) return '';
    const r = await net.fetch(u.href, { signal:AbortSignal.timeout(4000), headers:{ 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if(!r.ok) return '';
    const buf = new Uint8Array(await r.arrayBuffer());
    let html = '';
    try{ html = new TextDecoder('utf-8', { fatal:true }).decode(buf); }
    catch(err){ try{ html = new TextDecoder('gbk').decode(buf); }catch(e2){ html = new TextDecoder().decode(buf); } }
    const m = /<title[^>]*>([\s\S]{0,400}?)<\/title>/i.exec(html);
    return m ? htmlTitle(m[1]) : '';
  }catch(err){ return ''; }
});
function htmlTitle(s){
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d))
    .replace(/&nbsp;/gi, ' ').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ').trim().slice(0, 120);
}
function fontsCache(){ return dataPath('fonts-cache.json'); }
async function readFontsCache(){
  try{
    const j = JSON.parse(await fs.promises.readFile(fontsCache(), 'utf8'));
    return Array.isArray(j.fonts) && j.fonts.length ? { fonts:j.fonts, faces:(j.faces && typeof j.faces === 'object') ? j.faces : {} } : null;
  }catch(err){ return null; }
}
async function writeFontsCache(got){
  const p = fontsCache();
  await fs.promises.mkdir(path.dirname(p), { recursive:true });
  await fs.promises.writeFile(p, JSON.stringify({ at:Date.now(), fonts:got.fonts, faces:got.faces }), 'utf8');
}
/* 缓存多久都先交给页面用 —— 从前这里有一档「7 天以内才算数」，过期就当没读过：
   新装的字体因此要好几天才出现在清单里（作者 2026-10-08 抓到的「中 500 哪去了」正是这一条，
   外加 preload 那一句把「强制重读」那个参数吞了，点「重读系统字体」也走的是缓存）。
   现在开机就在后台重数一遍（refreshFonts），数完铺回缓存并推给所有窗口，慢的那一秒多不挡界面。
   fontsBusy：那一趟正在跑的时候记着它的承诺，页面同一时刻来问就等这一份，不另开子进程。 */
let fontsBusy = null;
async function listInstalledFonts(force){
  /* 开机那趟后台重数正在跑：等它一份就行，别另开一趟子进程（同一份数据，开两趟只是白等） */
  if(fontsBusy){ const g = await fontsBusy; if(g && g.fonts && g.fonts.length) return g; }
  if(!force){
    const c = await readFontsCache();
    if(c) return c;
  }
  try{
    const got = await enumerateFonts();
    await writeFontsCache(got);
    return got;
  }catch(err){
    console.warn('字体枚举失败：' + err.message);
    const c = await readFontsCache();
    return c || { fonts:[], faces:{} };
  }
}
/* 开机后台重数 + 推给所有窗口；同一时刻只跑一趟 */
async function refreshFonts(){
  if(fontsBusy) return fontsBusy;
  fontsBusy = (async () => {
    try{
      const got = await enumerateFonts();
      await writeFontsCache(got);
      for(const w of BrowserWindow.getAllWindows())
        { try{ if(!w.isDestroyed()) w.webContents.send('font:changed', got); }catch(e){} }
      logLine('字体', '后台重数完：' + got.fonts.length + ' 家');
      return got;
    }catch(err){ logLine('字体', '后台重数没成：' + err.message); return null; }
    finally{ fontsBusy = null; }
  })();
  return fontsBusy;
}
/* 系统自己报的那个档名 → CSS 的数。这张表不是我从字体名字里编的：
   它是 WPF 那个 FontWeight 结构的九个名字（FontWeights 里就这几个静态值，ToString 出来的就是它们），
   加上「系统直接给数」的那一型 —— 微软雅黑细 = 290、Segoe UI Semilight = 350，这种非整档的数系统原样报出来。
   认不出的档名回 0，调用处把这一张脸丢掉，不硬给一个数。 */
const FF_WEIGHT_NUM = { thin:100, extralight:200, ultralight:200, light:300, normal:400, regular:400,
  medium:500, semibold:600, demibold:600, bold:700, extrabold:800, ultrabold:800,
  black:900, heavy:900, extrablack:950, ultrablack:950 };
function ffWeightNum(档){
  const s = String(档 || '').trim().toLowerCase();
  if(/^\d{2,4}$/.test(s)) return +s;
  return FF_WEIGHT_NUM[s] || 0;
}
/* ---------- 系统字体清单：一趟数出「哪一家、底下有哪几档真脸」 ----------
   从前走 GDI 的 InstalledFontCollection：它只给名字，一家底下的 Light / Medium 被它当成三个独立字体族报回来，
   所以界面上摆出「宋体（22 个）」那种没法的分类，字重只能靠名字尾巴猜
   （作者 2026-10-08：「系统字体扫一下那么快，显示本地字体快得很，你设置一下那么慢」「你现在就换」）。
   现在改吃 WPF 的 SystemTypefaces：一条就是一张真脸，带着系统自己给的档名（Light / Normal / Medium / 290 …）。
   两样当场扔掉：① IsBoldSimulated / IsObliqueSimulated —— 那是系统没有这张脸却现合成的假粗假斜，
     霞鹜文楷等宽因此从六条回到细 / 标准 / 中 三档，和「设置 → 个性化 → 字体」看到的完全一样；
   ② 非 Normal 的拉伸（等线那一族的窄体另算，字重滑杆要的是粗细，不是宽窄）。
   中文字体名要用 UTF-8 出来，不然管道里是本地代码页的字节，node 按 UTF-8 解就是乱码。 */
/* 那一段 PowerShell 单独抽出来一颗：界面上要判的是「合成出来的假粗假斜有没有被扔掉、非 Normal 的拉伸有没有被扔掉」，
   探针直接钉这一句原文，删掉一半当场就红（藏在子进程里判不着）。 */
function fontScanCmd(){
  return '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;' +
    'Add-Type -AssemblyName PresentationCore,WindowsBase;' +
    '[System.Windows.Media.Fonts]::SystemTypefaces | ForEach-Object {' +
    'if($_.IsBoldSimulated -or $_.IsObliqueSimulated){return};' +
    'if($_.Stretch.ToString() -ne "Normal"){return};' +
    '$f=$_.FontFamily; $l=""; $e="";' +
    'if($f.FamilyNames.ContainsKey("zh-cn")){$l=$f.FamilyNames.Item("zh-cn")};' +
    'if($f.FamilyNames.ContainsKey("en-us")){$e=$f.FamilyNames.Item("en-us")};' +
    '$d=""; if($_.FaceNames.ContainsKey("en-us")){$d=$_.FaceNames.Item("en-us")}' +
    'else{foreach($k in $_.FaceNames){$d=$k.Value;break}};' +
    '($f.Source,[string]$_.Weight,$d,$e,$l) -join [char]9 }';
}
function enumerateFonts(){
  return new Promise((res, rej) => {
    const cmd = fontScanCmd();
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', cmd],
      { windowsHide:true });
    const chunks = [];
    let err = '';
    p.stdout.on('data', d => chunks.push(d));
    p.stderr.on('data', d => { err += String(d); });
    p.on('error', e => rej(e));
    p.on('close', code => {
      try{ res(parseFontOut(Buffer.concat(chunks).toString('utf8'), code, err)); }
      catch(e){ rej(e); }
    });
  });
}
/* 子进程吐回来的那一段原文 → { fonts, faces }。单独抽出来一颗，src\tools\font-scan-live.mjs
   拿真机器上的输出直接喂这一颗，判的是同一份代码，不在工具里抄第二份。 */
function parseFontOut(txt, code, err){
  /* 开头偶尔粘一个 BOM，用码位剔掉，别让它混进第一个字体名 */
  const rows = (txt.charCodeAt(0) === 0xFEFF ? txt.slice(1) : txt)
    .split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(s => s.split('\t'));
  if(!rows.length) throw new Error('PowerShell 没吐出字体表（退出码 ' + code + '）' + (err ? '：' + String(err).slice(0, 160) : ''));
  const got = parseFontRows(rows);
  if(!got.fonts.length) throw new Error('字体表里一家都没认出来（读了 ' + rows.length + ' 行）');
  return got;
}
/* 一行一张脸 → 「哪一家、底下有哪几档」。一家一条，中文名当脸面（没中文名就用系统那个源名）；
   源名和英文名一起登记进字重表，这样 CSS 里写「霞鹜文楷等宽」还是「LXGW WenKai Mono」都读得到同一份档。
   认不出档数的每一张脸（系统报了个表里没有的名字）丢掉，不硬给一个数。 */
function parseFontRows(rows){
  const fonts = [], faces = {};
  const 认 = (名, 档, 脸) => {
    if(!名) return;
    if(!faces[名]) faces[名] = [];
    if(!faces[名].some(x => x.w === 档)) faces[名].push({ w:档, 名:脸 || String(档) });
  };
  for(const r of rows){
    const [源, 档名, 脸名, 英名, 中名] = (r || []).map(x => String(x === undefined || x === null ? '' : x).trim());
    const 档 = ffWeightNum(档名);
    if(!源 || !档) continue;
    const 脸面 = 中名 || 源;
    if(!fonts.includes(脸面)) fonts.push(脸面);
    认(源, 档, 脸名);
    if(英名 && 英名 !== 源) 认(英名, 档, 脸名);
    if(中名 && 中名 !== 源) 认(中名, 档, 脸名);
  }
  for(const k of Object.keys(faces)) faces[k].sort((a, b) => a.w - b.w);
  return { fonts, faces };
}
/* ---------- 色卡图读色号：Windows 自带的离线 OCR，一次性子进程 ----------
   色卡照片里印的那串色号才是准的（采样会被相机、屏幕、灯光带偏），所以把图交给
   Windows.Media.Ocr 认字。子进程脚本里现编译一段 C# 去调 WinRT（和 SMTC 桥同一套做法），
   stdout 一行 JSON：{ok,lang,ow,oh,lines:[{t,x,y,w,h}]}。
   不联网、不装东西；系统没装 OCR 识别包就报不成，页面里自动退回按采样色建卡。 */
const OCR = () => path.join(__dirname, 'ocr-swatch.ps1');
function ocrSwatch(p){
  return new Promise(res => {
    if(!fs.existsSync(OCR())) return res({ ok:false, msg:'没找到 ocr-swatch.ps1' });
    let pr;
    try{
      pr = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', OCR(), '-Path', String(p)], { windowsHide:true });
    }catch(e){ return res({ ok:false, msg:String((e && e.message) || e) }); }
    const chunks = [];
    let err = '', over = false;
    const timer = setTimeout(() => {
      over = true;
      try{ pr.kill(); }catch(e){}
      res({ ok:false, msg:'OCR 三十秒没回来' });
    }, 30000);
    pr.stdout.on('data', d => chunks.push(d));
    pr.stderr.on('data', d => { err += String(d); });
    pr.on('error', e => {
      if(over) return; over = true; clearTimeout(timer);
      res({ ok:false, msg:String((e && e.message) || e) });
    });
    pr.on('close', () => {
      if(over) return; over = true; clearTimeout(timer);
      const txt = Buffer.concat(chunks).toString('utf8');
      const line = (txt.charCodeAt(0) === 0xFEFF ? txt.slice(1) : txt)
        .split(/\r?\n/).map(s => s.trim()).filter(s => s.startsWith('{')).pop();
      if(!line) return res({ ok:false, msg:'OCR 没吐出结果' + (err ? '：' + err.slice(0, 160) : '') });
      try{ res(JSON.parse(line)); }
      catch(e){ res({ ok:false, msg:'OCR 结果读不了：' + line.slice(0, 160) }); }
    });
  });
}
ipcMain.handle('ocr:swatch', async (e, p) => await ocrSwatch(String(p || '')));
/* ---------- 看板节点上的本地图片（第 12 条）----------
   任意本地路径走不进 fdapp:// 那套映射，所以主进程把字节读出来、按节点宽缩一份，
   转成 data URL 交给页面 —— 项目里不存图片副本，节点上只留那一行路径。
   看大图交给系统默认的看图程序（shell.openPath）。 */
const IMG_MIME = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif',
  '.webp':'image/webp', '.bmp':'image/bmp', '.svg':'image/svg+xml' };
ipcMain.handle('img:peek', async (e, p, maxW) => {
  const f = String(p || '');
  if(!path.isAbsolute(f)) return { ok:false, miss:'这一条不是本地绝对路径：' + f };
  let st;
  try{ st = fs.statSync(f); }catch(err){ return { ok:false, miss:'这个位置读不到东西' }; }
  if(!st.isFile()) return { ok:false, miss:'这一条不是一个文件' };
  if(st.size > 64 * 1024 * 1024) return { ok:false, miss:'这张图太大（超过 64 MB）' };
  const ext = path.extname(f).toLowerCase();
  const mime = IMG_MIME[ext] || 'image/png';
  let buf;
  try{ buf = fs.readFileSync(f); }catch(err){ return { ok:false, miss:'这张图打不开：' + String((err && err.message) || err) }; }
  let im = null;
  try{ im = nativeImage.createFromBuffer(buf); }catch(err){ im = null; }
  if(im && !im.isEmpty()){
    const s = im.getSize();
    const want = Math.max(64, Math.min(1200, Number(maxW) || 360));
    /* 比要的宽就缩一份：data URL 里塞原图，节点一多内存先撑不住 */
    let url = '';
    if(s.width > want){ try{ url = im.resize({ width:want }).toDataURL(); }catch(err){ url = ''; } }
    if(!url) url = 'data:' + mime + ';base64,' + buf.toString('base64');
    return { ok:true, url, w:s.width, h:s.height, big:f };
  }
  /* svg 之类 nativeImage 认不了的，原样交给页面，那一层自己会画 */
  return { ok:true, url:'data:' + mime + ';base64,' + buf.toString('base64'), w:0, h:0, big:f };
});
ipcMain.handle('img:open', async (e, p) => {
  const f = String(p || '');
  if(!path.isAbsolute(f)) return { ok:false, msg:'这一条不是本地绝对路径' };
  /* 先自己确认文件在不在：不在就别交给 shell —— Windows 会自己弹「找不到文件」，
     那玩意儿是系统模态框，会把这一路 await 死在这儿，整个页面跟着卡住。 */
  let st = null;
  try{ st = fs.statSync(f); }catch(err){ st = null; }
  if(!st || !st.isFile()) return { ok:false, msg:'这个文件不在原来的位置了：' + f };
  try{ const msg = await require('electron').shell.openPath(f); return { ok:!msg, msg:msg || '' }; }
  catch(err){ return { ok:false, msg:String((err && err.message) || err) }; }
});
/* ---------- SMTC 桥：常驻隐藏 PowerShell 子进程，事件一行一条 JSON ----------
   Windows 的媒体会话只能走 WinRT，而 PowerShell 挂不上 WinRT 事件，
   所以子进程脚本里现编译一段 C# 去挂（探针验过：切歌 / 暂停 / 进度都在十几毫秒内出事件行）。
   没有变化时子进程就阻塞在 ReadLine，一个定时器都不装：页面拿事件里的 pos + 自己的墙上时钟插值，
   只有插值跑到时长之外（漂过 0.5 秒）才回来补读一次。
   监听跟着音乐遥控器走：这个脚本住在包里（说明书 assets.watcher 点的名），名单里没这个包就不起。
   包可能是解开的文件夹、也可能是一个 zip，而 powershell 只认盘上的一个文件，所以用之前先把它
   落地一份到 %LOCALAPPDATA%\Flow-Desk\watcher\ —— 和底下 players\ 那本小抄同一个约定，
   三个 exe 共用一份，内容一模一样就不重写。 */
const WDIR = () => path.join(process.env.LOCALAPPDATA || app.getPath('appData'), 'Flow-Desk', 'watcher');
/* 这一家说明书里 assets.<key> 指的是包里哪个文件；包里没带 / 包不在这棵树上时，
   退回 app 层自带的那一份兜底副本（整个文件夹拷去别的电脑、还没建过 data\plugins\ 的那种）。 */
function packAssetOf(id, key){
  const p = packScan().packs.find(x => x.id === id);
  const rel = p && p.manifest && p.manifest.assets && p.manifest.assets[key];
  return rel ? { id, rel:String(rel) } : null;
}
/* 把包里那一个文件落到 watcher\ 底下，回来告诉你在盘上的哪儿；包没装 / 包里没带 = null */
function landAsset(id, key){
  const a = packAssetOf(id, key);
  let buf = a ? packRaw(a.id, a.rel) : null;
  let name = a ? path.basename(a.rel) : '';
  if(!buf){
    /* 出厂兜底：这棵树上还没有插件那一格时，取出厂那一格（resources\app\data\plugins\<id>\）里的同一份。
       外20 改的口径：随行文件（监听脚本、桥插件）的原件在包里，app 层不收第二份，
       所以兜底也只能顺着出厂那一格走 —— 那儿本来就是「恢复出厂」取原文的地方，一份东西两个用途。
       以前这三行点的是 resources\app\smtc-watcher.ps1 和 resources\app\plugin\mb_FlowDesk.dll
       （出包时另落的两份副本），而 vol-watcher.ps1 那一支点的是个从来没存在过的文件名：
       真到了没有包的时候，音量那一条一定落空，一句错都不报。
       名字只取 basename —— manifest 里写什么也不许顺着往上爬。 */
    const fac = path.join(DATA_BUNDLED, 'plugins', id);
    try{
      const fm = JSON.parse(fs.readFileSync(path.join(fac, 'manifest.json'), 'utf8'));
      const rel = fm && fm.assets ? path.basename(String(fm.assets[key] || '')) : '';
      if(rel){ const side = path.join(fac, rel);
        if(fs.statSync(side).isFile()){ buf = fs.readFileSync(side); name = rel; } }
    }catch(e){}
  }
  if(!buf) return null;
  const to = path.join(WDIR(), name);
  try{
    fs.mkdirSync(WDIR(), { recursive:true });
    let old = null; try{ old = fs.readFileSync(to); }catch(e){}
    if(old && old.equals(buf)) return to;
    fs.writeFileSync(to, buf);
    logLine('音乐', '监听的随行文件重新落地：' + name + (a ? '（从 ' + a.id + ' 的包里）' : '（出厂那一格里取的兜底）'));
    return to;
  }catch(err){ return null; }
}
const WATCHER = () => landAsset('music-remote', 'watcher');
const media = { child:null, last:null, msg:'', dead:false, tries:0, buf:'', ready:false, killed:false, gen:0 };
/* 页面上还挂着几处音乐：音乐遥控器卡片一块、⛶ 整页一块、为写停靠那边一块，各报各的 hold。
   数到 0 就把子进程停掉 —— 撤了卡还让后台一直挂着 SMTC，就是「监听跟着功能走」没做到。 */
const mediaHolds = new Map();
function mediaHoldCount(){ let n = 0; for(const v of mediaHolds.values()) n += (Number(v) || 0); return n; }
function mediaStop(why){
  media.killed = true;
  media.gen++;           /* 这一代的子进程说的话从这一刻起一律不算，免得它迟到的 close 把新起的那个顶掉 */
  if(media.child){ try{ media.child.kill(); }catch(e){} }
  media.child = null; media.buf = ''; media.ready = false; media.tries = 0; media.last = null;
  media.dead = false;      /* 是被撤掉的，不是坏掉的：装回来还得起得来 */
  media.msg = String(why || '');
  logLine('音乐', '监听收掉了：' + media.msg);
}
/* 后台监听该不该起：音乐遥控器没装 → 不起；装了但桌面上／停靠里一处都没挂着 → 也不起。
   起得来的时机是「有一处音乐挂上来了」（media:hold），不是页面一开就常驻。 */
function mediaGate(){
  if(!packHas('music-remote')) return '音乐遥控器没装 · 想听歌去「添加插件」里把它装回来';
  if(mediaHoldCount() === 0) return '这一处桌面上没有挂着音乐遥控器 · 挂上来就开始监听';
  return '';
}

function mediaStart(){
  if(media.child || media.dead) return;
  if(mediaGate()) return;
  const ps1 = WATCHER();
  if(!ps1 || !fs.existsSync(ps1)) { media.dead = true; media.msg = '没在音乐遥控器的包里找到监听的脚本'; return; }
  let p;
  try{
    p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1],
      { windowsHide:true });
  }catch(e){ media.dead = true; media.msg = String((e && e.message) || e); return; }
  media.child = p; media.buf = ''; media.killed = false; media.dead = false; media.msg = '';
  const gen = media.gen;      /* 这个子进程的话只在这一代里算数 */
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', d => {
    if(media.gen !== gen) return;
    media.buf += d;
    let i;
    while((i = media.buf.indexOf('\n')) >= 0){
      const line = media.buf.slice(0, i).trim(); media.buf = media.buf.slice(i + 1);
      if(line) mediaLine(line);
    }
  });
  p.stderr.on('data', d => { if(media.gen !== gen) return; const s = String(d).trim(); if(s) media.msg = s.slice(0, 200); });
  p.on('error', e => {
    if(media.gen !== gen) return;
    media.dead = true; media.msg = String((e && e.message) || e);
    logLine('音乐', '监听起不来：' + media.msg); mediaTell({ ev:'bye', ok:false, msg:media.msg });
  });
  p.on('close', code => {
    if(media.gen !== gen) return;
    media.child = null;
    /* 意外退出就再试一次，最多三回；再不行就把话讲明白，不装作还在跑 */
    if(code !== 0 && !media.dead && !media.killed && media.tries < 3 && media.ready){ media.tries++; setTimeout(mediaStart, 1200); return; }
    media.dead = true;
    if(!media.msg) media.msg = '媒体子进程退出了（退出码 ' + code + '）';
    logLine('音乐', '监听停了：' + media.msg);
    mediaTell({ ev:'bye', ok:false, msg:media.msg });
  });
}
function mediaLine(line){
  let j;
  try{ j = JSON.parse(line); }catch(e){ return; }
  if(j.ev === 'bye'){ media.dead = true; media.msg = j.msg || ''; mediaTell(j); return; }
  if(j.ev === 'ready'){ media.ready = true; mediaSay({ cmd:'self', app:APP.label }); mediaSay({ cmd:'pick', app:playRead('pin.txt') }); }
  /* 只有带 seq 的那一行才是真快照。命令回显（{"ev":"cmd",...,"ok":true}）里一个歌曲字段都没有，
     过去它也被当成最新状态存下来，卡上收到就把歌名、歌手、专辑洗成空白 —— 监听看着就是"没监上"。 */
  if(typeof j.seq === 'number') media.last = j.session === null ? null : j;
  mediaTell(j);
}
/* 窗口没了 = 它报上来的那几处 hold 一起清零，别留一笔还挂在账上 */
app.on('web-contents-created', (e, c) => {
  try{
    c.on('destroyed', () => {
      mediaHolds.delete(c.id);
      if(mediaHoldCount() === 0){
        if(media.child) mediaStop('挂着音乐的窗口关了');
        if(vol.child) volStop('挂着音乐的窗口关了');
      }
    });
  }catch(err){}
});
function mediaSay(obj){
  if(!media.child || !media.child.stdin.writable) return false;
  try{ media.child.stdin.write(JSON.stringify(obj) + '\n'); return true; }
  catch(err){ return false; }
}
function mediaTell(j){
  for(const w of BrowserWindow.getAllWindows())
    { try{ if(!w.isDestroyed()) w.webContents.send('media:state', { supported:true, msg:media.msg, state:media.last, ev:j }); }catch(e){} }
}
ipcMain.handle('media:state', () => {
  const g = mediaGate();
  if(g) return { supported:false, msg:g, state:null };
  mediaStart();
  return { supported: !media.dead, msg: media.msg, state: media.last };
});
/* 这一块页面上还挂着几处音乐：挂一处报一次 hold，撤一处报一次 release。
   总数归零就把子进程收掉 —— 撤了卡后台还在听，就是监听没跟着功能走。 */
ipcMain.handle('media:hold', (e) => {
  const n = (mediaHolds.get(e.sender.id) || 0) + 1;
  mediaHolds.set(e.sender.id, n);
  mediaStart();      /* 第一处音乐挂上来 = 后台监听该起了（mediaStart 自己有闸） */
  volStart();        /* 音量控制长在音乐遥控器里：系统音量那位也跟着起，同一本账 */
  return { ok:true, holds:n };
});
ipcMain.handle('media:release', (e) => {
  const n = Math.max(0, (mediaHolds.get(e.sender.id) || 0) - 1);
  mediaHolds.set(e.sender.id, n);
  if(mediaHoldCount() === 0){
    if(media.child) mediaStop('页面上最后一处音乐也撤了');
    if(vol.child) volStop('页面上最后一处音乐也撤了');
  }
  return { ok:true, holds:n };
});
ipcMain.handle('media:cmd', (e, msg) => {
  const g = mediaGate();
  if(g) return { ok:false, msg:g };
  mediaStart();
  const cmd = String((msg && msg.cmd) || '');
  if(!['play', 'pause', 'toggle', 'next', 'prev', 'stop', 'seek', 'snapshot', 'pick'].includes(cmd)) return { ok:false, msg:'不认的媒体命令：' + cmd };
  if(!media.child || !media.child.stdin.writable) return { ok:false, msg: media.msg || '媒体子进程没起来' };
  const pos = Math.max(0, Number((msg && msg.pos) || 0));
  const body = cmd === 'pick' ? { cmd, app:String((msg && msg.app) || '').slice(0, 300) } : { cmd, pos };
  try{ media.child.stdin.write(JSON.stringify(body) + '\n'); }
  catch(err){ return { ok:false, msg:String((err && err.message) || err) }; }
  if(cmd === 'pick') playWrite('pin.txt', body.app);
  return { ok:true, msg:'' };
});

/* ---------- 系统音量：常驻 PowerShell 监视器读写 Windows 主音量（Core Audio） ----------
   动的是系统音量本身，不是页面里哪个音频元素的旋钮：脚本里现编译一段 C# 挂上
   IAudioEndpointVolume 的回调 —— 硬件音量键、托盘音量合成器、别的程序改音量，都会
   当场推一行事件上来，页面跟着真实系统状态走，一个定时器都不装（监听跟着功能走：
   音乐遥控器挂几处，media:hold 那本账就是它的起/收时机，见上面那两个 handler）。
   节流合并：滑杆一路拖每像素一个值，这里只记最新一个，每 90ms 往子进程写一次 ——
   绝不是一像素生一次进程；子进程常驻，写的是它的 stdin，本来就不生新进程。
   静音那条接口的老实账：SetMute 不发回调（微软的接口就这样），所以谁下命令谁当场
   回声一条最新状态；别的程序动了静音，会跟着下一次音量事件或下一次一次性读取补上。 */
const vol = { child:null, buf:'', last:null, msg:'', raw:'', dead:false, tries:0, killed:false, ready:false, gen:0, pend:null, timer:null };
/* 监听脚本那头能说的话是英文（PowerShell 的异常文本、它自己那句收摊话），界面上不许冒英文：
   给他看的一律换成一句中文，原话留着进日志和悬停说明 —— 出错时我要查的还是那句原文。 */
function volMsg(raw){
  const t = String(raw || '').trim();
  vol.raw = t.slice(0, 300);
  if(/watcher closed/i.test(t)) vol.msg = '音量监听收摊了，正在重起';
  else if(/command failed/i.test(t)) vol.msg = '音量命令没执行成';
  else if(/denied|forbidden|privilege/i.test(t)) vol.msg = '系统不让改音量（权限被拒）';
  else if(t) vol.msg = '音量监听出了岔子，原话进了日志';
  else vol.msg = '音量监听停了';
}
function volGate(){
  if(!packHas('music-remote')) return '音乐遥控器没装 · 系统音量控制长在这个插件里';
  return '';
}
function volStop(why){
  vol.killed = true;
  vol.gen++;             /* 这一代子进程迟到的 close 不许顶掉新起的那个 */
  if(vol.child){ try{ vol.child.kill(); }catch(e){} }
  vol.child = null; vol.buf = ''; vol.ready = false; vol.tries = 0; vol.dead = false;
  if(vol.timer){ clearTimeout(vol.timer); vol.timer = null; }
  vol.pend = null;
  vol.msg = String(why || '');
  logLine('音量', '音量监听收掉了：' + vol.msg);
}
function volStart(){
  if(vol.child || vol.dead) return;
  if(volGate()) return;
  const ps1 = landAsset('music-remote', 'volwatcher');
  if(!ps1 || !fs.existsSync(ps1)){ vol.dead = true; vol.msg = '没在音乐遥控器的包里找到音量的监听脚本'; return; }
  let p;
  try{
    p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1],
      { windowsHide:true });
  }catch(e){ vol.dead = true; vol.msg = String((e && e.message) || e); return; }
  vol.child = p; vol.buf = ''; vol.killed = false; vol.dead = false; vol.msg = '';
  const gen = vol.gen;
  p.stdout.setEncoding('utf8');
  p.stdout.on('data', d => {
    if(vol.gen !== gen) return;
    vol.buf += d;
    let i;
    while((i = vol.buf.indexOf('\n')) >= 0){
      const line = vol.buf.slice(0, i).trim(); vol.buf = vol.buf.slice(i + 1);
      if(line) volLine(line);
    }
  });
  p.stderr.on('data', d => { if(vol.gen !== gen) return; const s = String(d).trim(); if(s) volMsg(s); });
  p.on('error', e => {
    if(vol.gen !== gen) return;
    vol.dead = true; volMsg(String((e && e.message) || e));
    logLine('音量', '音量监听起不来：' + vol.raw); volTell();
  });
  p.on('close', code => {
    if(vol.gen !== gen) return;
    vol.child = null; vol.pend = null;
    if(vol.timer){ clearTimeout(vol.timer); vol.timer = null; }
    if(vol.killed) return;               /* 我们自己收的摊：下一句命令会重起一代，别在这儿判死 */
    if(vol.tries < 3){ vol.tries++; setTimeout(volStart, 1200); return; }
    vol.dead = true;
    if(!vol.msg){ vol.msg = '音量子进程退出了（退出码 ' + code + '）'; vol.raw = 'exit ' + code; }
    logLine('音量', '音量监听停了，重起过 ' + vol.tries + ' 次没救回来：' + vol.raw); volTell();
  });
}
function volLine(line){
  let j;
  try{ j = JSON.parse(line); }catch(e){ return; }
  if(j.ev === 'bye'){
    /* 脚本自己说收摊（stdin 关了，或者它撞了个错就退）。从前这里把 vol.dead 钉成真，
       而 volStart 头一句就是 `if(vol.child || vol.dead) return` —— 音量这一路从此一辈子起不来：
       滑杆每拖一下回一句 ok:false，弹到界面上的还是脚本那句英文（2026-10-08 他报的「控制不了音量还摆个虚假按钮」）。
       收摊不等于坏：记下这句话、把这一代的号抬走（它迟到的 close 不许顶掉新起的那一代），再起一代。 */
    vol.gen++; vol.child = null; vol.buf = ''; vol.ready = false;
    volMsg(j.msg);
    if(vol.timer){ clearTimeout(vol.timer); vol.timer = null; }
    if(!vol.killed && vol.tries < 3){ vol.tries++; setTimeout(volStart, 300); }
    else vol.dead = true;
    volTell(); return;
  }
  if(j.ev === 'vol'){
    vol.ready = true; vol.tries = 0;      /* 活着推上来一行，重起的预算就归零 */
    vol.last = { vol: Math.max(0, Math.min(100, Math.round(Number(j.vol) || 0))), muted: !!j.muted };
  }
  volTell();
}
function volTell(){
  for(const w of BrowserWindow.getAllWindows())
    { try{ if(!w.isDestroyed()) w.webContents.send('vol:state', { supported: !vol.dead, msg: vol.msg, state: vol.last }); }catch(e){} }
}
function volSay(obj){
  volStart();
  if(!vol.child || !vol.child.stdin.writable) return false;
  try{ vol.child.stdin.write(JSON.stringify(obj) + '\n'); return true; }
  catch(err){ return false; }
}
/* 一次性读取（不轮询）：卡挂上来时问一次，往后的更新全走事件广播 */
ipcMain.handle('vol:get', () => {
  const g = volGate();
  if(g) return { supported:false, msg:g, state:null };
  volSay({ cmd:'get' });
  return { supported: !vol.dead, msg: vol.msg, state: vol.last };
});
/* 滑杆拖：只记最新值，90ms 合并写一次（节流合并）；真正的显示值以系统回声为准 */
ipcMain.handle('vol:set', (e, v) => {
  const g = volGate();
  if(g) return { ok:false, msg:g };
  volStart();
  if(vol.dead) return { ok:false, msg: vol.msg || '音量监听没起来' };
  vol.pend = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
  if(vol.timer == null) vol.timer = setTimeout(() => {
    vol.timer = null;
    if(vol.pend == null) return;
    const want = vol.pend; vol.pend = null;
    if(!volSay({ cmd:'set', vol:want })) volTell();
  }, 90);
  return { ok:true, vol: vol.pend };
});
/* mode: 0 取消静音 / 1 静音 / 2 切换（默认切换） */
ipcMain.handle('vol:mute', (e, mode) => {
  const g = volGate();
  if(g) return { ok:false, msg:g };
  const on = mode === 0 || mode === 'off' ? 0 : (mode === 1 || mode === 'on' ? 1 : 2);
  volStart();
  if(vol.dead) return { ok:false, msg: vol.msg || '音量监听没起来' };
  if(!volSay({ cmd:'mute', on })) return { ok:false, msg: vol.msg || '音量监听没起来' };
  return { ok:true };
});

/* ---------- 明暗模式那一轴（外13-M）：系统深浅状态 + 变更事件 ----------
   主进程只干一件事：把「操作系统现在是深色还是浅色」报给页面，外加它一变就喊一声。
   明亮 / 黑暗 这一档到底怎么用（跟随系统 / 按一日内时间 / 手动）全在页面那一头
   （src\_fd\src\fd3-shell.js 的 Ming），这一层不参与判定，也不动 nativeTheme.themeSource ——
   它是默认值 system，把它钉死等于替 Chromium 里那些原生控件（滚动条、表单）选边站。
   口径和音量那一路完全一样：开机问一次 + 往后全凭事件，一个定时器都不设。
   休眠醒来 / 解锁屏幕（见文件尾 ready 那一趟）走的是同一条广播：页面那一头发着的
   「到点再醒」那个定时器会被系统一起挂住，醒来收到这一句就重认一遍时刻、再发一个唤醒 ——
   按时间切换那一档不许靠高频轮询去兜。 */
function mingTell(why){
  const d = { dark:!!nativeTheme.shouldUseDarkColors, at:Date.now(), why:String(why || '') };
  for(const w of BrowserWindow.getAllWindows())
    { try{ if(!w.isDestroyed()) w.webContents.send('ming:system', d); }catch(e){} }
}
ipcMain.handle('ming:system', () => ({ dark:!!nativeTheme.shouldUseDarkColors }));
nativeTheme.on('updated', () => mingTell('系统深浅变了'));

/* ---------- 播放器小抄：一个明文小文件夹 ----------
   %LOCALAPPDATA%\Flow-Desk\players\
     pin.txt       指定播放器的名字（SMTC 的 SourceAppUserModelId，比如 MusicBee.exe）；空的 = 自动挑正在放的那个
     musicbee.txt  Flow-Desk Bridge 插件写的「现在在放哪个文件」，一行路径，插件改一次推一次
     musicdir.txt  音乐文件夹（一行绝对路径）：歌词的「同目录同名」往这里找，连子文件夹一起穿透
     music.txt     音乐遥控器那几个开关，一行一个 key=value：note / trans / sync / off
                   · fsNote fsMain fsTrans（注音·原文·翻译各自的字号，百分比，100 = 照旧）
                   · fwNote fwMain fwTrans（同一档的粗细，0 = 不覆盖）
                   （注音、翻译开不开，歌词校准几秒兜一次，歌词整体延后几毫秒）
   挂着音乐的这几处读的是同一份，所以 Flow-Desk 设置里改一下，为写停靠那边跟着变，不用两边各存一份。
   文件监听负责推：谁改了都当场广播，页面不轮询。 */
const LA_BASE = process.env.LOCALAPPDATA || app.getPath('appData');
const PLAYDIR = path.join(LA_BASE, 'Flow-Desk', 'players');
/* 外40 搬家时这一格跟着程序名换成了 Flow-Desk。MusicBee 里那颗桥插件的路径是编译死的，
   所以那一段时间里两格都得读写、都得盯 —— 2026-10-10 新的一颗装上后桥插件已经只往这一格写
   （`bridge.log` 里 02:48 那两行就是它写的），旧那一格连代码一起撤了。
   以后这一格的名字要和 `src\pack\plugin\FlowDeskBridge.cs` 里那一句一起改，改一处另一边就断了。 */
function playRead(name){
  try{ return fs.readFileSync(path.join(PLAYDIR, name), 'utf8').replace(/\s+$/, ''); }catch(e){ return ''; }
}
function playWrite(name, value){
  const to = name === 'pin.txt' ? String(value || '') : String(value || '').replace(/\s+$/, '');
  try{ if(playRead(name) === to) return { ok:true, msg:'' }; }catch(e){}   /* 内容没动就别碰文件：一碰就惊一次监听 */
  try{
    fs.mkdirSync(PLAYDIR, { recursive:true });
    fs.writeFileSync(path.join(PLAYDIR, name), to + '\n', 'utf8');
    return { ok:true, msg:'' };
  }catch(err){ return { ok:false, msg:String((err && err.message) || err) }; }
}
function playState(){ return { pin:playRead('pin.txt'), mbPath:playRead('musicbee.txt'), music:playRead('musicdir.txt'),
  flags:playFlags(), dir:PLAYDIR }; }
/* music.txt：一行一个 key=value，读不出来当没有。
   注音/翻译这两个开关 Flow-Desk 卡片和为写停靠要共用一份，存页面自己的 store 里就是两份，
   所以走这条小抄 —— 谁改了文件监听当场广播，两边一起跟着变。 */
function playFlags(){
  const out = {};
  for(const ln of playRead('music.txt').split(/\r?\n/)){
    const i = ln.indexOf('=');
    if(i > 0) out[ln.slice(0, i).trim()] = ln.slice(i + 1).trim();
  }
  return out;
}
function playFlagSet(key, value){
  const k = String(key || '').replace(/[^\w-]/g, '').slice(0, 24);
  if(!k) return { ok:false, msg:'开关名不对' };
  const cur = playFlags();
  const v = String(value == null ? '' : value).replace(/[\r\n]/g, '').slice(0, 200);
  if(cur[k] === v) return { ok:true, msg:'' };
  cur[k] = v;
  return playWrite('music.txt', Object.keys(cur).map(x => x + '=' + cur[x]).join('\n'));
}
let playTimer = null, playLast = '';
function playWatch(){
  try{ fs.mkdirSync(PLAYDIR, { recursive:true }); }catch(e){}
  const 动 = () => {
    clearTimeout(playTimer);
    playTimer = setTimeout(() => {
      const st = playState();
      if(JSON.stringify(st) === playLast) return;
      playLast = JSON.stringify(st);
      for(const w of BrowserWindow.getAllWindows())
        { try{ if(!w.isDestroyed()) w.webContents.send('media:players', st); }catch(e){} }
      /* 指定播放器是改在文件里的，子进程得跟着换目标；它自己会在 ready 时补读一次 */
      mediaSay({ cmd:'pick', app:st.pin });
    }, 200);
  };
  try{ fs.watch(PLAYDIR, 动); }catch(e){}
}
playWatch();
ipcMain.handle('media:players', () => { playLast = JSON.stringify(playState()); return { ok:true, state:playState() }; });
ipcMain.handle('media:pin', (e, app) => {
  const r = playWrite('pin.txt', app);
  if(r.ok) mediaSay({ cmd:'pick', app:String(app || '').slice(0, 300) });
  return r;
});
/* 音乐文件夹：原生对话框挑一个，绝对路径写进 musicdir.txt。
   页面拿到的还是那个路径串，自己包成目录句柄（见 preload 的 mediaDirHandle）——
   歌词的「同目录同名」和穿透子文件夹都从这一条路走，开发服务器才换成 showDirectoryPicker。 */
ipcMain.handle('media:dirPick', async (e) => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
    title:'挑音乐文件夹', properties:['openDirectory']
  });
  if(r.canceled || !r.filePaths.length) return { ok:true, kept:playRead('musicdir.txt') };
  const p = String(r.filePaths[0] || '');
  const w = playWrite('musicdir.txt', p);
  return { ok:w.ok, msg:w.msg, music:p };
});
ipcMain.handle('media:dirSet', (e, p) => playWrite('musicdir.txt', p));
/* 音乐遥控器的开关：写 music.txt 一行，文件监听把新值广播回两边 */
ipcMain.handle('media:flag', (e, k, v) => playFlagSet(k, v));

/* ---------- 给本地播放器装监听插件 ----------
   MusicBee 本体不往系统的媒体控件写任何东西（一个字都不发），所以光靠 SMTC 读不到它。
   补上的办法是给它装一个插件：插件文件跟着音乐遥控器那个插件走（data\plugins\music-remote\mb_FlowDesk.dll，
   说明书里 assets.bridge 点的名），要用的时候先从包里落到 %LOCALAPPDATA%\Flow-Desk\watcher\，
   这个按钮做的事就是 —— 找出 MusicBee 装在哪，把 dll 拷进它的 Plugins\，同名先留 .bak，
   然后告诉他重启 MusicBee。它调的是 MusicBee 自己的插件 API，所以只治 MusicBee 一家；
   别的播放器（Spotify / PotPlayer / 媒体播放器 / 网页播放器）本来就自己发 SMTC，不需要插件。
   音乐遥控器卸掉了 ⇒ 包里那份不在，这按钮就说实话：先把它装回来。 */

function mbDriveRoots(){
  const out = [];
  for(let c = 65; c <= 90; c++){
    const d = String.fromCharCode(c) + ':\\';
    try{ if(fs.existsSync(d)) out.push(d); }catch(e){}
  }
  return out;
}
/* 挨个可能的落点看过去：装在哪、便携摆在哪、开始菜单那种 Programs 目录。
   认「这一层有 musicbee.exe」，只认到目录不算，免得撞见同名文件夹。 */
function mbGuesses(){
  const g = [];
  for(const d of mbDriveRoots()){
    g.push(path.join(d, 'MusicBee'), path.join(d, 'Programs', 'MusicBee'),
      path.join(d, 'Program Files', 'MusicBee'), path.join(d, 'Program Files (x86)', 'MusicBee'),
      path.join(d, 'Apps', 'MusicBee'), path.join(d, 'Software', 'MusicBee'));
  }
  const appData = process.env.LOCALAPPDATA || app.getPath('appData');
  g.push(path.join(appData, 'Programs', 'MusicBee'), path.join(appData, 'MusicBee'));
  return g.filter(x => x);
}
function runOut(cmd, args, ms){
  return new Promise(res => {
    const p = spawn(cmd, args, { windowsHide:true });
    let out = '';
    const t = setTimeout(() => { try{ p.kill(); }catch(e){} res(out); }, ms || 4000);
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', () => {});
    p.on('error', () => { clearTimeout(t); res(''); });
    p.on('close', () => { clearTimeout(t); res(out); });
  });
}
/* 正在放的 MusicBee 会把 dll 咬住，覆盖必失败，所以先看进程 */
async function mbRunning(){
  const out = await runOut('tasklist.exe', ['/FI', 'IMAGENAME eq MusicBee.exe', '/NH'], 6000);
  return /MusicBee\.exe/i.test(String(out));
}
/* 三条路找安装目录：正在跑的进程 → 注册表 App Paths → 常见落点挨个试 */
async function mbDir(){
  const ps = await runOut('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '(Get-Process MusicBee -ErrorAction SilentlyContinue | Select-Object -First 1).Path'], 8000);
  const line = String(ps).split('\n').map(s => s.trim()).filter(s => /musicbee\.exe$/i.test(s))[0] || '';
  if(line){
    const d = path.dirname(line);
    if(fs.existsSync(d)) return d;
  }
  const reg = await runOut('reg.exe', ['query',
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\MusicBee.exe', '/ve'], 6000);
  const m = /REG_SZ\s+(\S+musicbee\.exe)/i.exec(String(reg));
  if(m){
    const d = path.dirname(m[1]);
    if(fs.existsSync(d)) return d;
  }
  for(const g of mbGuesses()){
    try{ if(fs.existsSync(path.join(g, 'MusicBee.exe'))) return g; }catch(e){}
  }
  return '';
}
ipcMain.handle('media:bridge', async () => {
  if(!packHas('music-remote'))
    return { ok:false, msg:'音乐遥控器这个插件没装，插件文件就在它的包里。去「添加插件」把它装回来再按这个按钮。' };
  const from = landAsset('music-remote', 'bridge');
  if(!from)
    return { ok:false, msg:'音乐遥控器的包里没带插件文件（说明书 assets.bridge 那个），这一份包不完整' };
  const dir = await mbDir();
  if(!dir)
    return { ok:false, found:false,
      msg:'没检测到 MusicBee 装在哪。手动装一次也行：把 ' + from + ' 拷到 <MusicBee>\\Plugins\\ 里（同名就覆盖），再开 MusicBee。' };
  const plugins = path.join(dir, 'Plugins');
  const to = path.join(plugins, 'mb_FlowDesk.dll');
  if(await mbRunning())
    return { ok:false, busy:true, dir,
      msg:'MusicBee 正开着，插件文件被它咬住了。先在托盘里右键 MusicBee 选「退出」（不是关窗口），再点一次这个按钮。目标位置：' + to };
  try{
    fs.mkdirSync(plugins, { recursive:true });
    if(fs.existsSync(to)){
      const bak = to + '.bak';
      fs.copyFileSync(to, bak);
      logLine('插件', '旧插件留了备份：' + bak);
    }
    fs.copyFileSync(from, to);
    const kb = Math.round(fs.statSync(to).size / 1024);
    logLine('插件', '已装 ' + to + '（' + kb + 'KB）');
    return { ok:true, dir, to, kb, msg:'插件已装到 ' + to + '（' + kb + 'KB）· 开 MusicBee 就能监到，正在放的歌会把文件路径写进 players\\musicbee.txt' };
  }catch(err){
    return { ok:false, dir, msg:'拷不过去（' + String((err && err.message) || err) + '）：手动把 ' + from + ' 拷到 ' + plugins + ' 里' };
  }
});

/* ---------- 重新构建 ----------
   配方向导存的 plugins\<id>.js 要在生成页面时才内嵌进 html（运行时不 fetch、不 eval），
   所以「改代码」里那个按钮就是把 Flow-Desk 那一份页面重新生成一遍：
   为写和声笔输入法练习的代码都拼在这一份里，不再各出一张页。
   用这个 exe 自带的 electron 当 node（ELECTRON_RUN_AS_NODE=1）跑源码目录里的 build.mjs。
   源码目录记在 root.json 的 src 里；整个文件夹拷到没源码的机器上，这一项就报回去。
   装卸组件走的也是这一趟，所以要给页面报进度：每一步开工前 send 一句 rebuild:step，
   顶上那条进度条吃的是「第几步 / 共几步 + 这一步在做什么」，不是猜的百分比。 */
ipcMain.handle('sys:rebuild', async (e) => {
  if(!ROOTS.src) return { ok:false, msg:'这台机器没记下源码在哪儿，重新构建不了' };
  const say = step => { try{ e.sender.send('rebuild:step', step); }catch(err){} };
  const steps = [
    { label:'生成 Flow-Desk 页面', pct:8 }, { label:'页面生成好了', pct:92 }
  ];
  const lines = [];
  const script = path.join(ROOTS.src, '_fd', 'build.mjs');
  if(!fs.existsSync(script)) return { ok:false, msg:'找不到构建脚本：' + script };
  say(steps[0]);
  const r = await runBuild(script, path.dirname(script),
    line => say(Object.assign({}, steps[0], { log:String(line).trim().slice(0, 120) })));
  if(r.code !== 0) return { ok:false, msg:'Flow-Desk 页面构建失败（' + r.code + '）：\n' + (r.err || r.out) };
  lines.push(...r.out.split('\n').map(s => s.trim()).filter(s => s.startsWith('WROTE')));
  say(steps[1]);
  /* 插件名单是整张页共用的：卸了一个包，为写和声笔输入法练习那两段代码也没了。
     所有窗口都广播一句，让它们自己提示「刷新才换血」，不替用户 reload。 */
  try{
    for(const w of BrowserWindow.getAllWindows()){
      if(w.isDestroyed()) continue;
      try{ w.webContents.send('rebuild:done', { files:lines }); }catch(err){}
    }
  }catch(err){}
  return { ok:true, msg:lines.join('\n') || '构建跑完了，但没听说写了哪个文件' };
});
function runBuild(script, cwd, onLine, args){
  return new Promise(res => {
    /* FD_TREE 一起带过去：构建脚本才知道该往哪棵树的 页面\ 生成、从 数据\plugins 取配方
       （探针实例指到测试树上，不会碰他那一棵） */
    const env = Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE:'1', FD_TREE:TREE });
    const p = spawn(process.execPath, [script].concat(args || []), { cwd, env, windowsHide:true });
    let out = '', err = '';
    p.stdout.on('data', d => {
      out += d;
      if(onLine) for(const s of String(d).split('\n')) if(s.trim()) onLine(s);
    });
    p.stderr.on('data', d => { err += d; });
    p.on('error', e => res({ code:-1, out, err:String((e && e.message) || e) }));
    p.on('close', code => res({ code, out, err }));
  });
}

/* ---------- #237 界面文字清单：读写 / 打开 / 改动清单 / 写回源码 / 搬旧提示语 / 磁盘监听 ----------
   清单在 data\ui-text.yaml，按「程序 · 页名」分组，组里一行一个地方：冒号左边是界面上原来那句话，
   右边写你要的字。
   三个程序跑的是同一份运行时（sh-text.js），读的都是磁盘这一份；它一变，主进程广播
   ui-text:changed，各窗口当场换字，不用重启 —— 外部编辑器存盘、页面里「保存清单」，
   走的都是这同一条广播。
   「把改动写进程序」分两步：plan 只出改动清单（哪句改成哪句、源码里哪几行），页面摆给
   用户看，点头之后 apply 才改源码，再把 Flow-Desk 那一份页面重新生成一遍（清单左边那句跟着刷新）。
   uitext.cjs 带着兜底 require：拷到没源码的机器上，读清单、改字、广播照样好使，
   只有 plan/apply 会照实回「源码不在」。 */
let UIT = null;
try{ UIT = require('./uitext.cjs'); }catch(e){}
/* 卡片默认大小清单（#251）：扫源码、摆清单、写回，全在 cardsize.cjs，和界面文字同一套路。
   清单在 data\card-size.yaml，一张卡片两行：卡片名底下「出厂:」是源码现在给的大小，
   「你要:」写你要的大小；桌面卡片只有 Flow-Desk 有，这一份只管它。
   它一变，广播 card-size:changed，页面按新默认重新盖大小。 */
let CSZ = null;
try{ CSZ = require('./cardsize.cjs'); }catch(e){}
const CARD_SIZE_FILE = () => path.join(DATA_ROOT, 'card-size.yaml');
function readCardSizeRaw(){ try{ return fs.readFileSync(CARD_SIZE_FILE(), 'utf8'); }catch(e){ return ''; } }
function ensureCardSize(){
  const f = CARD_SIZE_FILE();
  try{ if(fs.existsSync(f)) return { ok:true, file:f }; }catch(e){}
  /* 开机那一趟没铺成（老包 / 那一趟被别的程序占着），这儿补一次：先从自带那份落，落不到再扫源码现生成 */
  try{ if(layList(DATA_ROOT, 'card-size.yaml', null)) return { ok:true, file:f }; }catch(e){}
  if(!CSZ) return { ok:false, file:f, msg:'这份产物里没带 cardsize.cjs，生成不了清单' };
  try{ CSZ.refresh(TREE); return { ok:fs.existsSync(f), file:f }; }
  catch(err){ return { ok:false, file:f, msg:'生成清单失败：' + String((err && err.message) || err) }; }
}
function cardSizeEdits(){
  try{ return CSZ ? CSZ.parse(readCardSizeRaw()).filter(r => r.to) : []; }catch(e){ return []; }
}
function broadcastCardSize(text){
  for(const w of BrowserWindow.getAllWindows()){
    if(w.isDestroyed()) continue;
    try{ w.webContents.send('card-size:changed', text); }catch(err){}
  }
}
/* Flow-Desk 那一份页面重新生成：界面文字的「把改动写进程序」和卡片大小的那一趟都走这条路。
   为写和声笔输入法练习的代码拼在同一份里，改一次字三份都跟着刷。
   say(进度一行) 把 rebuild:step 发回发起的那个窗口；不成就把是哪一步报回来的说清楚。 */
async function rebuildPages(say){
  const steps = [
    { label:'Flow-Desk 页面重新生成', pct:24 }, { label:'页面生成好了', pct:94 }
  ];
  const job = { script: path.join(ROOTS.src, '_fd', 'build.mjs'), dir: path.join(ROOTS.src, '_fd') };
  if(!fs.existsSync(job.script)) return { ok:false, msg:'找不到构建脚本：' + job.script };
  say(steps[0]);
  const b = await runBuild(job.script, job.dir, null, []);
  if(b.code !== 0) return { ok:false, msg:'源码改了，但页面重新生成失败（Flow-Desk 回了 ' + b.code + '）：\n' +
    String(b.err || b.out).slice(0, 4000) };
  say(steps[1]);
  return { ok:true };
}
const UI_TEXT_FILE = () => path.join(DATA_ROOT, 'ui-text.yaml');
function readUiTextRaw(){ try{ return fs.readFileSync(UI_TEXT_FILE(), 'utf8'); }catch(e){ return ''; } }
/* 清单不在 data\ 就先落到 data\（自带那份 → 扫源码现生成），生成不动也照样把话回清楚 */
function ensureUiText(){
  const f = UI_TEXT_FILE();
  try{ if(fs.existsSync(f)) return { ok:true, file:f }; }catch(e){}
  try{ if(layList(DATA_ROOT, 'ui-text.yaml', null)) return { ok:true, file:f }; }catch(e){}
  if(!UIT) return { ok:false, file:f, msg:'这份产物里没带 uitext.cjs，生成不了清单' };
  try{ UIT.refresh(TREE); return { ok:fs.existsSync(f), file:f }; }
  catch(err){ return { ok:false, file:f, msg:'生成清单失败：' + String((err && err.message) || err) }; }
}
function uiTextEdits(){
  try{ return UIT ? UIT.parse(readUiTextRaw()).filter(r => r.to) : []; }catch(e){ return []; }
}
/* 清单一变要跟上的事：各窗口换字、托盘菜单重摆、托盘那份缓存丢掉 */
let trayTextCache = null;
function broadcastUiText(text){
  trayTextCache = null;
  for(const w of BrowserWindow.getAllWindows()){
    if(w.isDestroyed()) continue;
    try{ w.webContents.send('ui-text:changed', text); }catch(err){}
  }
  try{ if(tray && !tray.isDestroyed()) tray.setContextMenu(trayMenu()); }catch(e){}
}
ipcMain.handle('ui-text:read', async () => {
  ensureUiText();
  return { text: readUiTextRaw(), file: UI_TEXT_FILE() };
});
ipcMain.handle('ui-text:write', async (e, text) => {
  try{
    const g = ensureUiText();
    if(!g.ok && g.msg) return g;
    fs.mkdirSync(DATA_ROOT, { recursive:true });
    fs.writeFileSync(UI_TEXT_FILE(), String(text || ''));
    broadcastUiText(String(text || ''));
    return { ok:true };
  }catch(err){ return { ok:false, msg:String((err && err.message) || err) }; }
});
ipcMain.handle('ui-text:open', async () => {
  const g = ensureUiText();
  if(!g.ok) return { ok:false, msg:g.msg || '这份清单还没生成' };
  try{
    const msg = await require('electron').shell.openPath(g.file);
    return { ok:!msg, msg: msg ? '打不开：' + msg : '' };
  }catch(err){ return { ok:false, msg:String((err && err.message) || err) }; }
});
ipcMain.handle('ui-text:plan', async () => {
  if(!UIT || !ROOTS.src) return { ok:false, msg:'这台机器不知道源码在哪，写不回（清单照旧能改界面上的字）' };
  try{ const p = UIT.plan(TREE, uiTextEdits()); return { ok:true, list:p.list, miss:p.miss }; }
  catch(err){ return { ok:false, msg:String((err && err.message) || err) }; }
});
/* 真写回：改源码 → Flow-Desk 那一份页面重新生成 → 清单里那句原话跟着变新字 → 广播 rebuild:done 让各窗口提示刷新。
   不替用户 reload（编辑器里可能还有没存的内容），沿用 sys:rebuild 那一套。 */
ipcMain.handle('ui-text:apply', async (e, list) => {
  if(!UIT || !ROOTS.src) return { ok:false, msg:'这台机器不知道源码在哪，写不回' };
  const edits = Array.isArray(list) ? list : uiTextEdits();
  const say = step => { try{ e.sender.send('rebuild:step', step); }catch(err){} };
  let r = null;
  try{ r = UIT.apply(TREE, edits); }
  catch(err){ return { ok:false, msg:'改源码这一步就失败了：' + String((err && err.message) || err) }; }
  if(!r.done.length) return { ok:false, msg:'没有可写的改动（清单里冒号右边还都空着，或者写得跟左边一样）' };
  const b = await rebuildPages(say);
  if(!b.ok) return { ok:false, msg:b.msg + '\n这一趟写掉的 ' + r.done.length + ' 句源码已经是新字了' };
  for(const w of BrowserWindow.getAllWindows()){
    if(w.isDestroyed()) continue;
    try{ w.webContents.send('rebuild:done', { files:['界面文字写回 ' + r.done.length + ' 句'] }); }catch(err){}
  }
  broadcastUiText(readUiTextRaw());
  const missNote = r.miss.length ? '；另有 ' + r.miss.length + ' 处没找到原话，没动它们' : '';
  return { ok:true, msg:'已写进源码并重新生成页面：' + r.done.length + ' 句' + missNote + '（各窗口刷新就是新字）' };
});
/* 重启自己：界面文字清单/卡片大小清单「把改动写进程序」之后，托盘菜单、窗口标题这些
   开机认一次的东西要重开才换得过来。走和 quitApp 同一条路（isQuitting + close + quit），
   before-quit 该摘的托盘、该杀的音乐桥都照旧；relaunch 排在退出之后起新的。 */
ipcMain.handle('app:restart', async () => {
  try{ app.relaunch(); }catch(e){ return { ok:false, msg:'这台机器重启不了：' + ((e && e.message) || e) }; }
  setTimeout(() => { app.isQuitting = true; const w = live(); if(w) w.close(); app.quit(); }, 250);
  return { ok:true };
});
/* ---------- #251 卡片大小清单：读写 / 问改动清单 / 写回源码 ----------
   和界面文字那五条一个形状：read/write 走磁盘这一份，plan 只出改动清单，
   apply 改源码再把 Flow-Desk 那一份页面重新生成一遍（清单里出厂那一行跟着构建刷成新大小）。
   不显示文件路径、不提供「打开清单」按钮 —— 和界面文字同一要求。 */
ipcMain.handle('card-size:read', async () => {
  ensureCardSize();
  return { text: readCardSizeRaw(), file: CARD_SIZE_FILE() };
});
ipcMain.handle('card-size:write', async (e, text) => {
  try{
    const g = ensureCardSize();
    if(!g.ok && g.msg) return g;
    fs.mkdirSync(DATA_ROOT, { recursive:true });
    fs.writeFileSync(CARD_SIZE_FILE(), String(text || ''));
    broadcastCardSize(String(text || ''));
    return { ok:true };
  }catch(err){ return { ok:false, msg:String((err && err.message) || err) }; }
});
ipcMain.handle('card-size:plan', async () => {
  if(!CSZ || !ROOTS.src) return { ok:false, msg:'这台机器不知道源码在哪，写不回（清单照旧能改卡片大小）' };
  try{ const p = CSZ.plan(TREE, cardSizeEdits()); return { ok:true, list:p.list, miss:p.miss }; }
  catch(err){ return { ok:false, msg:String((err && err.message) || err) }; }
});
ipcMain.handle('card-size:apply', async (e, list) => {
  if(!CSZ || !ROOTS.src) return { ok:false, msg:'这台机器不知道源码在哪，写不回' };
  const edits = Array.isArray(list) ? list : cardSizeEdits();
  const say = step => { try{ e.sender.send('rebuild:step', step); }catch(err){} };
  let r = null;
  try{ r = CSZ.apply(TREE, edits); }
  catch(err){ return { ok:false, msg:'改源码这一步就失败了：' + String((err && err.message) || err) }; }
  if(!r.done.length) return { ok:false, msg:'没有可写的改动（「你要」那一行还都空着或者跟出厂一样）' };
  const b = await rebuildPages(say);
  if(!b.ok) return { ok:false, msg:b.msg + '\n这一趟写掉的 ' + r.done.length + ' 处源码已经是新大小了' };
  for(const w of BrowserWindow.getAllWindows()){
    if(w.isDestroyed()) continue;
    try{ w.webContents.send('rebuild:done', { files:['卡片大小写回 ' + r.done.length + ' 处'] }); }catch(err){}
  }
  broadcastCardSize(readCardSizeRaw());
  const missNote = r.miss.length ? '；另有 ' + r.miss.length + ' 行认不出那张卡片，没动它们' : '';
  return { ok:true, msg:'已写进源码并重新生成页面：' + r.done.length + ' 处' + missNote + '（各窗口刷新就是新大小）' };
});
/* ---------- #291 #292 库文件：data\palettes.yaml 色卡（成套那一份）、data\cards.yaml 色卡（一个一个攒的那一份）、
   data\looks.yaml 外观方案、data\images.yaml 图片库清单、data\lib-pending.json 待实现清单 ----------
   和上面那两份清单的区别在第一次：这几份不是从 resources\app\data 铺下来的，
   是页面开机发现自己存档里那些方案（色卡、当前外观）还没进文件，就当场写一份出来 ——
   现成的颜色一条不丢，自己填的、从图里取的那些都跟着走。
   格式（一条方案一段，段名就是界面上那个名字）归页面认，主进程只搬原文：
   读、写、磁盘那一份被外部编辑器改了就把新原文广播回去（lib:changed），各窗口当场重认。
   这一串名字就是唯一的闸：页面里每多一份库文件要在这里登记一次，开发服务器那一份（src\_fd\fd-serve.mjs 的 LIB_NAMES）跟着同一张表。
   漏登记的表现很难看：界面上改得动、报一句「存不进文件」、重启就没了 —— 色卡那一份（cards.yaml）就漏过一整轮，
   所以 src\tools\probes\test-libnames.mjs 每台盯着「页面里出现的每个库文件名，两道闸里都必须在册」。 */
const LIB_NAMES = ['palettes.yaml', 'cards.yaml', 'looks.yaml', 'lib-pending.json', 'images.yaml'];
const libFile = n => path.join(DATA_ROOT, n);
function readLibRaw(n){ try{ return fs.readFileSync(libFile(n), 'utf8'); }catch(e){ return ''; } }
function broadcastLib(n, text){
  for(const w of BrowserWindow.getAllWindows()){
    if(w.isDestroyed()) continue;
    try{ w.webContents.send('lib:changed', { name:n, text }); }catch(err){}
  }
}
ipcMain.handle('lib:read', async (e, name) => {
  const n = String(name || '');
  if(!LIB_NAMES.includes(n)) return { ok:false, text:'', file:'', msg:'不认这一份库文件：' + n };
  return { ok:true, text: readLibRaw(n), file: libFile(n) };
});
ipcMain.handle('lib:write', async (e, name, text) => {
  const n = String(name || '');
  if(!LIB_NAMES.includes(n)) return { ok:false, msg:'不认这一份库文件：' + n };
  try{
    fs.mkdirSync(DATA_ROOT, { recursive:true });
    fs.writeFileSync(libFile(n), String(text || ''));
    broadcastLib(n, String(text || ''));
    return { ok:true };
  }catch(err){ return { ok:false, msg:String((err && err.message) || err) }; }
});
/* 旧「提示语」搬进清单：{ 原句: 改后的句子 }，只填右边还空着的行，搬过再搬不重复。
   phrases.json / State 里的 phrase 那一份原件都不动、不删。 */
ipcMain.handle('ui-text:adopt', async (e, map) => {
  if(!UIT) return { ok:false, adopted:0, msg:'这份产物里没带 uitext.cjs' };
  try{
    const g = ensureUiText();
    if(!g.ok) return { ok:false, adopted:0, msg:g.msg };
    const a = UIT.adoptPhrases(readUiTextRaw(), map && typeof map === 'object' ? map : {});
    if(a.adopted){
      fs.writeFileSync(UI_TEXT_FILE(), a.text);
      broadcastUiText(a.text);
    }
    return { ok:true, adopted:a.adopted };
  }catch(err){ return { ok:false, adopted:0, msg:String((err && err.message) || err) }; }
});
/* 外部编辑器改了磁盘这一份 → 300ms 内合并成一次广播。盯的是 data\ 目录里这个名字，
   不是文件本身：Notepad++ 存盘可能换一个新文件进来，盯文件会跟丢。
   #251：卡片大小清单也住在 data\，两份各走各的广播，盯法一样。
   #275：开发期那份改字工具（D:\Programs\Tools Folder\aitools）点一行就往 data\uitext-jump.json
   写一句「哪个程序的哪一页、界面上哪句话、源码的第几行」，这里收到就转给各窗口。
   只有开发的时候用得上：将来推送的版本把这一段和页面里那一段（fd3-shell.js 的 #275 那一块）一起注释掉。 */
let uiTextWatchTimer = null, cardSizeWatchTimer = null, uiTextWatched = false;
const libWatchTimers = {};
const JUMP_FILE = () => path.join(DATA_ROOT, 'uitext-jump.json');
function broadcastUiTextJump(obj){
  for(const w of BrowserWindow.getAllWindows()){
    if(w.isDestroyed()) continue;
    try{ w.webContents.send('uitext:jump', obj); }catch(err){}
  }
}
function startUiTextWatch(){
  if(uiTextWatched) return;
  try{
    fs.mkdirSync(DATA_ROOT, { recursive:true });
    fs.watch(DATA_ROOT, (ev, name) => {
      const n = String(name || '').toLowerCase();
      if(LIB_NAMES.includes(n)){                                   /* #291 #292 色卡 / 外观方案 */
        clearTimeout(libWatchTimers[n]);
        libWatchTimers[n] = setTimeout(() => broadcastLib(n, readLibRaw(n)), 300);
        return;
      }
      if(n === 'card-size.yaml'){
        clearTimeout(cardSizeWatchTimer);
        cardSizeWatchTimer = setTimeout(() => broadcastCardSize(readCardSizeRaw()), 300);
        return;
      }
      if(n === 'uitext-jump.json'){                                   /* #275 */
        try{
          const j = JSON.parse(fs.readFileSync(JUMP_FILE(), 'utf8'));
          broadcastUiTextJump(j);
        }catch(err){}
        return;
      }
      if(n !== 'ui-text.yaml') return;
      clearTimeout(uiTextWatchTimer);
      uiTextWatchTimer = setTimeout(() => broadcastUiText(readUiTextRaw()), 300);
    });
    uiTextWatched = true;
  }catch(e){}
}

/* 托盘那四句也吃清单：出处是「Flow-Desk 主进程 · 窗口菜单与托盘」；
   主进程这份是三端共用的底子，所以哪一端写的行都认。 */
function trayText(s){
  if(!trayTextCache){
    const m = new Map();
    try{
      for(const r of UIT ? UIT.parse(readUiTextRaw()) : []){
        if(r.to && /^(Flow-Desk 主进程|共用模块|功能包)/.test(r.prog)) m.set(r.page + '\u0000' + r.from, r.to);
      }
    }catch(e){}
    trayTextCache = m;
  }
  const v = trayTextCache.get('窗口菜单与托盘\u0000' + s);
  return v || s;
}

/* ---------- 插件：这一层有什么 / 名单改成哪几个 / 把一个包放进来 ----------
   插件住在 数据\plugins\：解开的文件夹（<id>\manifest.json + main.js）和压好的 <id>.zip 都认，
   同一个 id 两种都在就用文件夹 —— 和本地生成页面那把尺（src\_build\packs.mjs）同一口径。
   名单反着记（off.json = 被卸掉的），所以往这一格里丢一个文件夹、重启就生效；
   丢的是 zip 的话由 packAdopt() 开机摊成文件夹（见下面那一段）。
   页面认这几条：列（有哪些包 + 名单）、写名单、导入一个包、读写某一格里的文件。
   代码不进产物了（乙案：运行时一家家 import），所以名单改了、代码存了就只刷新这一页，
   不再跑 sys:rebuild 重新生成页面；那趟只留给真的改了 src\ 的情况。 */
const PACKS_DIR = () => path.join(DATA_ROOT, 'plugins');
const OFF_LIST = 'off.json';
const OLD_LIST = 'installed.json';   /* 外41 六段之前那份「装了哪些」，读到一次就换算掉 */
/* #277：装完、删完功能之后两份清单马上跟着变。
   界面文字和卡片大小都是照着源码扫出来的，包里新写的那几句话、新摆的那张卡片，
   扫一遍才进清单；扫完直接写回 data\ 那两份明文，写盘这一下又让上面那个盯目录的
   fs.watch 抓到，各窗口的页面当场换字、新卡片按新大小摆 —— 不用重启，也不用重新生成页面。
   排在回话之后跑（setImmediate）：这一趟要把整棵树的源码读一遍，别让它挡着页面上那个进度条。 */
function refreshLists(){
  /* 这台机器不知道源码在哪（拷到没源码的机器上那份产物）就别扫：
     扫出来是空的，写盘会把用户已经写好的那几行改动一起抹掉 */
  if(!ROOTS.src) return;
  setImmediate(() => {
    for(const mod of [() => UIT, () => CSZ]){
      let m = null;
      try{ m = mod(); }catch(e){}
      if(!m || typeof m.refresh !== 'function') continue;
      try{ const r = m.refresh(TREE); logLine('清单', '重扫 ' + ((r && r.file) || '') + '：' + ((r && r.rows) || 0) + ' 行'); }
      catch(err){ logLine('清单', '重扫没成：' + String((err && err.message) || err)); }
    }
  });
}
/* 一个包摊平后的样子：id + 说明书 + 它是文件夹还是 zip + 文件列表（文件夹） */
function packOne(dir, name, kind){
  const up = require('./updater.cjs');
  if(kind === 'dir'){
    const f = path.join(dir, name, 'manifest.json');
    if(!fs.existsSync(f)) return null;
    let m = null;
    try{ m = JSON.parse(fs.readFileSync(f, 'utf8')); }catch(e){ return { id:name, kind, error:'说明书读不成那份格式：' + e.message }; }
    return { id:name, kind, manifest:m, files:fs.readdirSync(path.join(dir, name)) };
  }
  let buf = null;
  try{ buf = fs.readFileSync(path.join(dir, name + '.zip')); }catch(e){ return null; }
  let m = null;
  try{
    const items = up.zipIndex(buf);
    const it = items.find(x => x.name === 'manifest.json');
    if(!it) return { id:name, kind, error:'压缩包里没带说明书' };
    m = JSON.parse(up.unzipEntry(buf, it).toString('utf8'));
  }catch(e){ return { id:name, kind, error:'zip 读不动：' + String((e && e.message) || e) }; }
  return { id:name, kind, manifest:m };
}
/* 扫一遍：文件夹先收，同名 zip 就不收了（文件夹赢，和生成页面那头一致）。
   分两趟收而不是照着 readdir 的顺序边走边记 —— 名字排序碰巧让 zip 先露面的话，
   同一个包会在页面上列两行。 */
function packScan(){
  const dir = PACKS_DIR();
  let names = [];
  try{ names = fs.readdirSync(dir); }catch(e){ return { dir, packs:[], off:[], error:'' }; }
  const out = [], seen = new Set();
  const dirs = [], zips = [];
  for(const n of names){
    if(n.startsWith('.') || n.startsWith('_') || n === OFF_LIST || n === OLD_LIST) continue;
    let st = null;
    try{ st = fs.statSync(path.join(dir, n)); }catch(e){ continue; }
    if(st.isDirectory()) dirs.push(n);
    else if(n.endsWith('.zip')) zips.push(n);
  }
  for(const n of dirs){
    const p = packOne(dir, n, 'dir');
    if(p){ out.push(p); seen.add(n); }
  }
  for(const n of zips){
    const id = n.slice(0, -4);
    if(seen.has(id)) continue;
    const p = packOne(dir, id, 'zip');
    if(p){ out.push(p); seen.add(id); }
  }
  let off = [];
  /* 老那份「装了哪些」换算一次：扫到的每一家，老名单里没记的就进 off，换完把老那份删掉。
     只此一趟，不留两条路并读 —— 并读就是永远拆不掉的那类兜底。 */
  try{
    const 老 = path.join(dir, OLD_LIST);
    if(fs.existsSync(老)){
      let ids = null;
      try{ const j = JSON.parse(fs.readFileSync(老, 'utf8')); ids = Array.isArray(j) ? j : (Array.isArray(j.installed) ? j.installed : null); }catch(e){ ids = null; }
      const 卸 = Array.isArray(ids) ? [...seen].filter(x => !ids.map(String).includes(x)) : [];
      fs.writeFileSync(path.join(dir, OFF_LIST), JSON.stringify({ off:卸 }, null, 2) + '\n', 'utf8');
      fs.rmSync(老);
      logLine('插件', '名单换算 ' + OLD_LIST + ' → ' + OFF_LIST + '：记为卸掉 ' + 卸.length + ' 家（扫到 ' + seen.size + ' 家）');
    }
  }catch(e){}
  try{
    const j = JSON.parse(fs.readFileSync(path.join(dir, OFF_LIST), 'utf8'));
    off = (Array.isArray(j) ? j : (Array.isArray(j.off) ? j.off : [])).map(String);
  }catch(e){ off = []; }
  return { dir, packs:out, off, error:'' };
}
/* 这个插件在不在？off.json 缺省（还没装卸过）= 一家都没卸，扫到的全生效，和生成页面那把尺同一个口径。
   连 data\plugins\ 这一层都没有（整个文件夹拷到别的电脑、还没动过）也算全当装了 ——
   那份产物本来就是按出厂名单拼的，这时候说「没装」会把出厂功能自己关掉。
   真在这棵树上卸过（名字在 off 里）才算没装；包不在了同样算没装。 */
function packHas(id){
  const name = String(id);
  let dir = '';
  try{ dir = PACKS_DIR(); }catch(e){}
  if(dir && !fs.existsSync(dir)) return true;
  const s = packScan();
  if(!s.packs.some(p => p.id === name)) return false;
  return !s.off.includes(name);
}
/* 从包里取一个文件的原始字节：文件夹直接读，zip 从里头拆出来（两个 exe 都能看到包里那份底本）。
   rel 是说明书里写的相对路径（斜杠分隔），带 .. 或者空段的一律不认，别让它顺着爬出包外。 */
function packRaw(id, rel){
  const clean = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if(!clean || clean.split('/').some(s => s === '..' || s === '.' || !s)) return null;
  const p = packScan().packs.find(x => x.id === String(id));
  if(!p) return null;
  const up = require('./updater.cjs');
  if(p.kind === 'dir'){
    const dir = path.join(PACKS_DIR(), p.id);
    const f = path.join(dir, ...clean.split('/'));
    if(f !== dir && !f.startsWith(dir + path.sep)) return null;
    try{ return fs.readFileSync(f); }catch(e){ return null; }
  }
  let buf = null;
  try{ buf = fs.readFileSync(path.join(PACKS_DIR(), p.id + '.zip')); }catch(e){ return null; }
  try{
    const items = up.zipIndex(buf);
    const it = items.find(x => x.name === clean);
    if(!it) return null;
    return up.unzipEntry(buf, it);
  }catch(e){ return null; }
}
ipcMain.handle('pack:list', () => packScan());
/* 页面要包里的一份文件（词库底本那种）：给文本，读不到就说读不到，页面上给一句白话和一个选文件的入口。
   有个大小闸：过大的东西走 IPC 会把窗口卡住，那一种该由包自己摊到数据层去读。 */
const PACK_FILE_MAX = 24 * 1024 * 1024;
ipcMain.handle('pack:file', (e, id, rel) => {
  const buf = packRaw(id, rel);
  if(!buf) return { ok:false, msg:'包里没有这份文件：' + String(id) + '/' + String(rel) };
  if(buf.length > PACK_FILE_MAX)
    return { ok:false, msg:'这份文件 ' + Math.round(buf.length / 1048576) + 'MB，太大不走这条路' };
  try{ return { ok:true, text:buf.toString('utf8'), size:buf.length }; }
  catch(err){ return { ok:false, msg:'读不出文本：' + String((err && err.message) || err) }; }
});
/* 名单：页面递上来的是「开着的」那几家（界面那头的说法没改），这里换成「卸掉的」落盘 ——
     off = 这一格里扫到的全部 - 开着的。传 null 就是删掉这份文件（= 一家都不卸）。
   写完顺手查一眼音乐遥控器还在不在：不在 ⇒ 后台监听立刻收掉（不等窗口关），
   「监听跟着音乐插件走」要的就是这个 —— 卡卸了还在后台转进程，说不通。 */
function packAfterSet(){
  try{ if(!packHas('music-remote') && media.child) mediaStop('音乐遥控器卸掉了'); }catch(err){}
}
ipcMain.handle('pack:set', (e, ids) => {
  const dir = PACKS_DIR();
  try{ fs.mkdirSync(dir, { recursive:true }); }catch(err){ return { ok:false, msg:'插件目录建不出来：' + String((err && err.message) || err) }; }
  const f = path.join(dir, OFF_LIST);
  if(ids === null || ids === undefined){
    try{ if(fs.existsSync(f)) fs.rmSync(f); packAfterSet(); return { ok:true }; }
    catch(err){ return { ok:false, msg:'名单删不掉：' + String((err && err.message) || err) }; }
  }
  if(!Array.isArray(ids)) return { ok:false, msg:'名单得是一份 id 列表' };
  const 开着 = new Set(ids.map(String));
  let 全部 = [];
  try{ 全部 = packScan().packs.map(p => String(p.id)); }catch(err){}
  const txt = JSON.stringify({ off:全部.filter(x => !开着.has(x)) }, null, 2) + '\n';
  try{ fs.writeFileSync(f, txt, 'utf8'); packAfterSet(); return { ok:true, ids:ids.map(String) }; }
  catch(err){ return { ok:false, msg:'名单写不进去：' + String((err && err.message) || err) }; }
});
/* 导入一个包：页面挑一样东西进来，两种形状都认 ——
     一个 <id>.zip（别人传给你的成品包）
     一个解开的文件夹（里面有 manifest.json；本地开发、两台机器之间拷图纸都用得上）
   落点就是 数据\plugins\，和生成页面那把尺认的同一个位置。
   #246：本地一律落成解开的文件夹 —— zip 只是外头传给你的运输形状，
   进了门就摊开：能直接看见里面每个文件、想改哪份改哪份，「改代码」也直接指真文件。
   同名已经在那儿了就报错退回去，绝不动手盖掉他原有的包。 */
function packManifestOf(buf){
  const up = require('./updater.cjs');
  const items = up.zipIndex(buf);
  const it = items.find(x => x.name === 'manifest.json');
  if(!it) throw new Error('这个压缩包里没带说明书，不像一个插件');
  const m = JSON.parse(up.unzipEntry(buf, it).toString('utf8'));
  return { items, manifest:m };
}
function walkPackDir(dir, rel, out){
  for(const e of fs.readdirSync(path.join(dir, rel), { withFileTypes:true })){
    if(e.name.startsWith('.')) continue;
    const r = rel ? rel + '/' + e.name : e.name;
    if(e.isDirectory()) walkPackDir(dir, r, out);
    else out.push(r);
  }
}
/* 把一份 zip 摊成 plugins\<id>\：每一先查脏路径，再落地；有一份坏的不留半截 —— 整格删掉重来。
   界面里「导入插件」和开机那趟 packAdopt() 用的是这同一把尺，摊法只有一处。 */
function expandZipPack(dir, buf, id){
  let m = null, items = [];
  try{ const r = packManifestOf(buf); m = r.manifest; items = r.items; }
  catch(err){ return { ok:false, msg:'这个包读不动：' + String((err && err.message) || err) }; }
  const to = path.join(dir, id);
  let count = 0;
  try{
    for(const it of items){
      const rel = String(it.name || '').replace(/\\/g, '/');
      if(rel.endsWith('/')) continue;                       /* 有人压包会把文件夹也记一条，跳过 */
      if(!rel) throw new Error('空路径');
      const seg = rel.split('/').filter(x => x && x !== '.');
      if(!seg.length || seg.some(x => x === '..')) throw new Error('包里有脏路径，不敢落地：' + rel);
      const dest = path.join(to, ...seg);
      if(!dest.startsWith(to + path.sep)) throw new Error('包里有脏路径，不敢落地：' + rel);
      const data = require('./updater.cjs').unzipEntry(buf, it);
      fs.mkdirSync(path.dirname(dest), { recursive:true });
      fs.writeFileSync(dest, data);
      count++;
    }
  }catch(err){
    try{ fs.rmSync(to, { recursive:true, force:true }); }catch(e){}
    return { ok:false, msg:'这个包落不成：' + String((err && err.message) || err) };
  }
  return { ok:true, files:count, name:m.name || id };
}
/* 开机那一趟：往 plugins\ 里丢的 zip，没有同名摊开那一份的就当场摊开。
   「放进插件文件夹，重启软件就生效」这一条由这里落地 —— 丢文件夹的直接被扫到（名单反着记，见 off.json），
   丢 zip 的摊完也算到。摊不成的一家只记一句日志，不影响别家开机。 */
function packAdopt(){
  const dir = PACKS_DIR();
  let names = [];
  try{ names = fs.readdirSync(dir); }catch(e){ return []; }
  const 摊了 = [];
  for(const n of names){
    if(n.startsWith('.') || n.startsWith('_') || !n.endsWith('.zip')) continue;
    const id = n.slice(0, -4);
    if(!/^[A-Za-z0-9._-]+$/.test(id)) continue;
    if(fs.existsSync(path.join(dir, id))) continue;         /* 已经有摊开的那一份：zip 只是运输件，不覆盖 */
    let buf = null;
    try{ buf = fs.readFileSync(path.join(dir, n)); }catch(e){ continue; }
    const r = expandZipPack(dir, buf, id);
    if(r.ok){ 摊了.push(id); logLine('插件', '开机摊开 ' + n + ' → ' + id + '\\ · ' + r.files + ' 份'); }
    else logLine('插件', '那份 zip 没摊开（' + n + '）：' + r.msg);
  }
  return 摊了;
}
ipcMain.handle('pack:import', (e, payload) => {
  const dir = PACKS_DIR();
  const p = payload || {};
  const bad = m => ({ ok:false, msg:m });
  const src = path.resolve(String(p.src || ''));
  let st = null;
  try{ st = fs.statSync(src); }catch(err){ return bad('那份东西读不到：' + src); }
  try{ fs.mkdirSync(dir, { recursive:true }); }catch(err){ return bad('插件目录建不出来：' + String((err && err.message) || err)); }
  try{
    if(st.isFile()){
      if(!/\.zip$/i.test(src)) return bad('挑文件这一条只收压缩包 · 解开的样子请挑那个文件夹');
      const buf = fs.readFileSync(src);
      let m = null;
      try{ m = packManifestOf(buf).manifest; }
      catch(err){ return bad('这个包读不动：' + String((err && err.message) || err)); }
      const id = String(m.id || path.basename(src, path.extname(src))).trim();
      if(!/^[A-Za-z0-9._-]+$/.test(id)) return bad('包名不干净，不敢落地：' + id);
      if(fs.existsSync(path.join(dir, id)) || fs.existsSync(path.join(dir, id + '.zip')))
        return bad('这里已经有一份「' + id + '」了 · 要换先把它挪走');
      const r = expandZipPack(dir, buf, id);
      if(!r.ok) return bad(r.msg);
      refreshLists();                                              /* #277：新包里的字和卡片大小立刻进清单 */
      return { ok:true, id, where:id + '/', files:r.files, name:r.name };
    }
    if(st.isDirectory()){
      const f = path.join(src, 'manifest.json');
      if(!fs.existsSync(f)) return bad('这个文件夹里没带说明书，不像一个插件');
      let m = null;
      try{ m = JSON.parse(fs.readFileSync(f, 'utf8')); }
      catch(err){ return bad('说明书读不成那份格式：' + String((err && err.message) || err)); }
      const id = String(m.id || path.basename(src)).trim();
      if(!/^[A-Za-z0-9._-]+$/.test(id)) return bad('包名不干净，不敢落地：' + id);
      const to = path.join(dir, id);
      if(fs.existsSync(to) || fs.existsSync(to + '.zip')) return bad('这里已经有一份「' + id + '」了 · 要换先把它挪走');
      const list = [];
      walkPackDir(src, '', list);
      for(const rel of list){
        const dest = path.join(to, ...rel.split('/'));
        if(dest !== to && !dest.startsWith(to + path.sep)) return bad('包里有脏路径，不敢落地：' + rel);
        fs.mkdirSync(path.dirname(dest), { recursive:true });
        fs.copyFileSync(path.join(src, ...rel.split('/')), dest);
      }
      refreshLists();                                              /* #277：新包里的字和卡片大小立刻进清单 */
      return { ok:true, id, where:id + '/', files:list.length, name:m.name || id };
    }
    return bad('挑的东西既不是文件也不是文件夹');
  }catch(err){ return bad('导入失败：' + String((err && err.message) || err)); }
});
/* 卸一个包时勾了「同步清除数据」：按说明书点名的那几个明文文件删掉（数据层里，不碰包本身）。
   包里的东西一概不删 —— 装得回来靠的就是它还在。
   基准是 DATA_DIR()（= 这个宿主的用户目录，data\userdata-fd|wnw|rp），不是 data\ 那一层：
   说明书里 dataKeys 写的就是「notes.json」这种用户目录里的相对名，Store 也按这个位置读写。
   第二个参数 shared 走另一把尺：sharedKeys 点的是数据层根（data\）那一侧、跟着功能走的东西
   （词库底本那种：<包名>-bank/data.txt）。它不在用户目录里，只能在 data\ 底下，
   而且 plugins\ 那一层和名单本身绝不碰。 */
ipcMain.handle('pack:wipe', (e, files, shared) => {
  const del = [];
  for(const rel of (Array.isArray(files) ? files : [])){
    if(!String(rel || '').trim()) continue;
    let f;
    try{ f = dataPath(rel); }catch(err){ continue; }   /* 跑出用户目录的一律不动 */
    try{ if(fs.existsSync(f)){ fs.rmSync(f, { recursive:true, force:true }); del.push(String(rel)); } }catch(err){}
  }
  const root = path.resolve(DATA_ROOT);
  const comp = path.resolve(PACKS_DIR());
  for(const rel of (Array.isArray(shared) ? shared : [])){
    const s = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if(!s || s.split('/').some(x => x === '..' || x === '.' || !x)) continue;
    const f = path.join(root, ...s.split('/'));
    const rf = path.resolve(f);
    if(!rf.startsWith(root + path.sep)) continue;                 /* 数据层根以外不动 */
    if(rf === comp || rf.startsWith(comp + path.sep)) continue;   /* 包和名单永远留着 */
    try{ if(fs.existsSync(rf)){ fs.rmSync(rf, { recursive:true, force:true }); del.push(s); } }catch(err){}
  }
  return { ok:true, removed:del };
});
/* 一键清理所有用户数据（外42 二）：这一趟只写那张字条，真删在开机那一趟（文件顶上 userWipe 那一段）。
   已经排着就不重写，只把时间戳留着 —— 连着点两次不该变成排两趟。 */
ipcMain.handle('data:wipe', () => {
  try{
    fs.mkdirSync(DATA_ROOT, { recursive:true });
    if(fs.existsSync(WIPE_FILE())) return { ok:true, queued:true, already:true, file:WIPE_FILE() };
    fs.writeFileSync(WIPE_FILE(), JSON.stringify({ requestedAt:new Date().toLocaleString(), keep:WIPE_KEEP }, null, 2) + '\n', 'utf8');
    return { ok:true, queued:true, already:false, file:WIPE_FILE() };
  }catch(e){ return { ok:false, msg:'那张待清的字条写不下去：' + ((e && e.code) || e) }; }
});

/* ---------- 插件那一格里的文件：读 / 写 / 抹掉一整格 / 恢复出厂 ----------
   「改代码」编辑的就是 data\plugins\<id>\main.js 本身：存了就是新的，
   页面刷新一下就是这一份 —— 乙案之后代码不在产物里拼着，重新生成页面那一趟就没用了。
   闸和落地都在 comp-files.cjs（包名干净 · 相对路径不许往外爬 · 落点必须在 plugins\ 里）。
   出厂原文取 resources\app\data\plugins\ 那一格，恢复出厂 = 从那儿把这一份拷回来。 */
ipcMain.handle('comp:read', (e, id, rel) => { try{ return COMP.read(id, rel); }
  catch(err){ return { ok:false, msg:String((err && err.message) || err) }; } });
/* 这一格里有哪几份文本文件：页面上「改代码」那个挑文件的下拉吃这个 */
ipcMain.handle('comp:list', (e, id) => { try{ return COMP.list(id); }
  catch(err){ return { ok:false, msg:String((err && err.message) || err) }; } });
/* #277：改代码存一次、整格删掉一次、恢复出厂一次 —— 这三趟都动了包里的源码，
   两份清单跟着扫一遍，界面上那些字和卡片大小才跟得上现在这一份代码。 */
ipcMain.handle('comp:write', (e, id, rel, text) => { try{ const r = COMP.write(id, rel, text); if(r && r.ok) refreshLists(); return r; }
  catch(err){ return { ok:false, msg:String((err && err.message) || err) }; } });
ipcMain.handle('comp:delete', (e, id) => { try{ const r = COMP.remove(id); if(r && r.ok) refreshLists(); return r; }
  catch(err){ return { ok:false, msg:String((err && err.message) || err) }; } });
ipcMain.handle('comp:restore', (e, id, rel) => { try{ const r = COMP.restore(id, rel); if(r && r.ok) refreshLists(); return r; }
  catch(err){ return { ok:false, msg:String((err && err.message) || err) }; } });
ipcMain.handle('comp:factory', (e, id) => ({ ok:true, files:COMP.factoryFiles(id), has:COMP.hasFactory(id) }));

/* ---------- 图标：一个名字一张图，丢进文件夹当场就换，不用重启 ----------
   四个出处，页面按同一个名字使唤：
   · 树根 icons\ —— 界面通用那些（对齐 / 行距 / 关闭 / 齿轮…），文件名去掉后缀就是名字；
   · icons\ 下面那一层子文件夹 —— 名字念作「文件夹名-文件名」；只认一层，不再往里钻；
   · data\images\ —— 方案资源那一屏的图片库（外29 丁组：背景图 / 取色素材 / 纹理·四方连续图三种用途都攒在这一格），
     念作「images-<文件名>」，排在后面、同名不抢；
   · 插件自己那张 data\plugins\<id>\images\icon.svg —— 名字叫 pack-<id>，包卸了图跟着没。
   svg 在页面里当遮罩使，颜色跟着字色走（按钮选中变主题色，图标自己跟着变）；
   png 那类原样显示，保留图自己的颜色。图标层不读注册表、不外链网络，只认这六个后缀。 */
const ICON_EXT = ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
const ICON_DIR = path.join(TREE, 'icons');
/* 方案资源 · 图片库（外29 丁组）：他自己导进来的那些图，背景图 / 取色素材 / 纹理·四方连续图三种用途都攒在这一格。
   扫进图标那一张表，念作「images-<文件名>」，清单（data\images.yaml）只管名字和用途。
   预设纹理那一批 2026-10-08 按作者的话全撤了（icons\textures\ 那十一张、data\textures.yaml、data\textures\ 那一格），
   从此平铺小图只有一条来路：导进图片库。 */
const DATA_IMG_DIR = path.join(DATA_ROOT, 'images');
/* 包里的这张不认文件名，只认 icon.这个先后里的第一个后缀：同时丢 svg 和 png 就用 svg */
function iconIn(dir){
  for(const ext of ICON_EXT){
    try{ const f = path.join(dir, 'icon' + ext); if(fs.statSync(f).isFile()) return f; }catch(e){}
  }
  return '';
}
/* 文件名带空格、中文，CSS 类名装不下 —— 页面那侧 sh-ico.js 的 cssName 是同一个换算，两边对得上 */
function iconKey(n){ return String(n).replace(/[^a-zA-Z0-9_-]/g, '-'); }
/* 地址尾巴带上当初写入的时间：同名换一张图，光是内容变了不算 —— 清单变了才会广播，
   页面那侧再把这个时间当版本用，页面手里那张旧的也就作废了。 */
function iconUrl(f){
  let t = 0;
  try{ t = Math.floor(fs.statSync(f).mtimeMs); }catch(e){}
  return toUrl(f) + '?at=' + t;
}
/* 扫一次要转一圈包目录，插件页每列一行都要问「这个包带图没有」，
   所以结果留半秒：装卸包、丢图那几趟由下面那个 watch 把缓存作废，不会读到旧的。 */
let iconCache = null, iconCacheAt = 0;
function iconScan(){
  if(iconCache && Date.now() - iconCacheAt < 500) return iconCache;
  const out = {};
  /* icons\ 顶上这一层 + 往下一层子文件夹。
     子文件夹里的那张叫「文件夹名-文件名」，只认一层，再往里钻不算图标。
     keepFirst：名字已经被人占了就让住 —— 数据层那一批走这一条，见下面那一趟。 */
  const take = (dir, pre, keepFirst) => {
    try{
      for(const st of fs.readdirSync(dir, { withFileTypes:true })){
        if(st.isDirectory()){
          if(!pre && st.name && !st.name.startsWith('.')) take(path.join(dir, st.name), iconKey(st.name) + '-');
          continue;
        }
        const nm = String(st.name || '');
        const ext = path.extname(nm).toLowerCase();
        if(!ICON_EXT.includes(ext)) continue;
        const k = pre + iconKey(nm.slice(0, nm.length - ext.length));
        if(!k) continue;
        if(keepFirst && out[k]) continue;
        out[k] = iconUrl(path.join(dir, nm));
      }
    }catch(e){}
  };
  take(ICON_DIR, '');
  /* 图片库那一格（外29 丁组）。「已有名字就不抢」：icons\ 里那张赢，
     他导进来的一张平铺图不该顶掉界面上那些正经图标（对齐 / 关闭 / 齿轮…）的名字。 */
  take(DATA_IMG_DIR, 'images-', true);
  try{
    for(const st of fs.readdirSync(PACKS_DIR(), { withFileTypes:true })){
      if(!st.isDirectory() || st.name.startsWith('.') || st.name.startsWith('_')) continue;
      const f = iconIn(path.join(PACKS_DIR(), st.name, 'images'));
      if(f) out['pack-' + iconKey(st.name)] = iconUrl(f);
    }
  }catch(e){}
  iconCache = out; iconCacheAt = Date.now();
  return out;
}
ipcMain.handle('icons:list', async () => iconScan());
/* 往 icons\ 换图、往包里丢图、装包卸包——三条路都汇到这儿。250 毫秒并一次，
   清单真变了才广播；顺便把监视补一遍，因为刚装出来的包那个 images 文件夹开机时还不存在。 */
let iconTimer = null, iconLast = '';
const iconWatched = new Set();
function iconWatchAdd(dir){
  let isDir = false;
  try{ isDir = fs.statSync(dir).isDirectory(); }catch(e){}
  if(!isDir){ iconWatched.delete(dir); return; }   /* 文件夹没了就松手，重新长出来再盯 */
  if(iconWatched.has(dir)) return;
  try{ fs.watch(dir, () => iconTell()); iconWatched.add(dir); }catch(e){}
}
function iconWatchAll(){
  iconWatchAdd(ICON_DIR);
  /* icons\ 下面那一层子文件夹也盯上：往里换一张图同样当场广播 */
  try{
    for(const st of fs.readdirSync(ICON_DIR, { withFileTypes:true })){
      if(st.isDirectory() && st.name && !st.name.startsWith('.')) iconWatchAdd(path.join(ICON_DIR, st.name));
    }
  }catch(e){}
  /* 图片库那一格（外29 丁组）：导完一张当场就该在图库那一屏里看得见，不能等重启。
     这一格可能这会儿还不存在（一台机器上一次都没导过），iconWatchAdd 认不出来就松手，
     长出来了由下面那一条盯 data\ 这一层的 watch 补上。 */
  iconWatchAdd(DATA_IMG_DIR);
  iconWatchAdd(PACKS_DIR());
  try{
    for(const st of fs.readdirSync(PACKS_DIR(), { withFileTypes:true })){
      if(!st.isDirectory() || st.name.startsWith('.') || st.name.startsWith('_')) continue;
      iconWatchAdd(path.join(PACKS_DIR(), st.name, 'images'));
    }
  }catch(e){}
}
/* data\images\ 这一格第一次长出来的那一下，光盯它本身盯不到（盯的时候它还不存在）。
   所以另起一条只盯 data\ 这一层的 watch，收到「这一格动过」就去把监视补一遍 ——
   过滤得死死的只认这一个名字：data\ 底下写日志、存布局、改名单都勤，全收进来就是每写一次重扫一遍图标。 */
let dataImgWatched = false;
function watchDataImgDir(){
  if(dataImgWatched) return;
  try{
    fs.watch(DATA_ROOT, (ev, name) => {
      if(String(name || '') !== 'images') return;
      iconTell();
    });
    dataImgWatched = true;
  }catch(e){}
}
watchDataImgDir();
function iconTell(){
  clearTimeout(iconTimer);
  iconTimer = setTimeout(() => {
    iconWatchAll();
    iconCacheAt = 0;               /* 文件动过：缓存作废，这一趟是真去数一遍 */
    const table = iconScan(), key = JSON.stringify(table);
    if(key === iconLast) return;
    iconLast = key;
    for(const w of BrowserWindow.getAllWindows())
      { try{ if(!w.isDestroyed()) w.webContents.send('icons:changed', table); }catch(e){} }
  }, 250);
}
iconWatchAll();

/* ---------- 词库分类改名 → 真去改写引用了这个分类名的代码（第 6 条）----------
   分类名在代码里就是一个带引号的字符串（'对抗.优势'、"桥段模板"），配方 json 里也一样。
   所以只动「整串正好等于旧名」和「整串以旧名 + . 开头」这两种，写在界面文字里的同名散文不碰。
   扫两处：源码的 _shared\*.js（那些取词的地方）和 数据\plugins\ 里的配方（.js + .recipe.json）。
   改完由页面自己叫 sys:rebuild 重打产物。 */
function catRenameHits(txt, from, to){
  let n = 0;
  const out = String(txt).replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/g, s => {
    const q = s[0], body = s.slice(1, -1);
    if(body.indexOf('\\') >= 0 || !body) return s;
    if(body === from){ n++; return q + to + q; }
    if(body.startsWith(from + '.')){ n++; return q + (to + body.slice(from.length)) + q; }
    /* '模块条目.' + mod 这种拼法：前缀那一半自己也是一串，旧名正好是它 */
    if(body.endsWith('.') && body.slice(0, -1) === from){ n++; return q + (to + '.') + q; }
    return s;
  });
  return { text: out, n };
}
ipcMain.handle('code:catRename', async (e, from, to) => {
  const a = String(from || '').trim(), b = String(to || '').trim();
  if(!a || !b || a === b) return { ok:false, msg:'旧名新名得不一样' };
  if(!ROOTS.src) return { ok:false, msg:'这台机器没记下源码在哪儿，代码引用改不了' };
  /* 两处：源码里 _shared\ 那几份（宿主和共用底子，改完要重新构建 Flow-Desk 页面才生效）、
     插件自己那一格 data\plugins\<id>\（乙案之后是一层层文件夹，main.js 在包里，所以这层得往深里走）。 */
  const srcFiles = [];
  const collect = (dir, exts, deep) => {
    let names = [];
    try{ names = fs.readdirSync(dir); }catch(err){ return; }
    for(const nm of names){
      const f = path.join(dir, nm);
      let st = null;
      try{ st = fs.statSync(f); }catch(err){ continue; }
      if(st.isDirectory()){ if(deep) collect(f, exts, true); continue; }
      if(st.isFile() && exts.includes(path.extname(nm).toLowerCase())) srcFiles.push(f);
    }
  };
  collect(path.join(ROOTS.src, '_shared'), ['.js'], false);
  collect(path.join(TREE, 'data', 'plugins'), ['.js', '.json'], true);
  const hits = [], bad = [], packs = new Set();
  for(const f of srcFiles){
    const nm = path.basename(f);
    let txt = '';
    try{ txt = fs.readFileSync(f, 'utf8'); }catch(err){ bad.push(nm + '：读不出'); continue; }
    if(txt.indexOf(a) < 0) continue;
    const r = catRenameHits(txt, a, b);
    if(!r.n) continue;
    try{ fs.writeFileSync(f, r.text); hits.push({ file:f, n:r.n }); }
    catch(err){ bad.push(nm + '：写不进去（' + String((err && err.message) || err) + '）'); }
    /* 记下改到了哪几家：页面拿这个决定「刷新这一页就换」还是「得重新构建 Flow-Desk 页面」 */
    const inPack = path.relative(path.join(TREE, 'data', 'plugins'), f).split(path.sep)[0];
    if(inPack && inPack !== '..') packs.add(String(inPack));
  }
  const SRC_DIR = path.join(ROOTS.src, '_shared');
  return { ok:true, hits, bad, packs:Array.from(packs),
    src:hits.filter(x => String(x.file).startsWith(SRC_DIR)).length,
    comp:hits.filter(x => !String(x.file).startsWith(SRC_DIR)).length,
    msg: hits.length ? ('改了 ' + hits.length + ' 个文件 · 共 ' + hits.reduce((x, y) => x + y.n, 0) + ' 处') : '代码里没有引用【' + a + '】的地方' };
});

/* ---------- 本地更新（第 16 条 · 甲案：更新包 = 一个 zip）----------
   设置→程序→关于 里那几个按钮走这四条口子：看版本 → 挑包 → 看包 → 装包。
   装这一步不在主进程里干：要挪的 页面\ 和 resources\app\ 正被程序自己读着，
   所以 upd:start 只把 updater.cjs（跟 main.cjs 同一层，就在 resources\app\ 里）用 detach 起来，
   自己退出去，让那个 exe 等关干净了再挪。
   带运行时的那种包还要挪三个 exe —— 正在跑的这个就是要被挪的那个，
   所以那种情况先把这个 exe 拷一份到临时目录，用拷贝去跑 updater.cjs。
   数据\ 在那一头有硬检查：包里凡是带 数据 或 userdata 的路径，updater 直接判错停工。 */
const UPDATER = path.join(__dirname, 'updater.cjs');
const UPD_DIR = path.join(TREE, 'update');
/* 页面产物的当前版本号：和开页面一个口径，从 pages\ 的文件名里取（取不到就是没装好）。
   只有 Flow-Desk 这一张页了 —— 为写和声笔输入法练习的代码都拼在它里面，各自不再出独立页面，
   页面上「关于」那一行的后两个号直接从内核要（window.WNW_KERNEL.version、window.RP_KERNEL.version）。 */
const UPD_PAT = { fd:['', 'Flow_Desk_'] };
function updVersions(){
  const out = {};
  for(const k of Object.keys(UPD_PAT)){
    const [sub, pre] = UPD_PAT[k];
    const f = latestIn(path.join(PAGES_ROOT, sub, pre + '*.html'));
    out[k] = f ? path.basename(f).slice(pre.length, -'.html'.length) : '';
  }
  return out;
}
function updBackups(){
  const dir = path.join(UPD_DIR, 'backups');
  let list = [];
  try{ list = fs.readdirSync(dir).filter(n => !n.startsWith('.')).sort().reverse(); }catch(e){}
  return list.slice(0, 5);
}
function updRead(zip){
  const up = require('./updater.cjs');
  const opened = up.openZip(String(zip || ''));
  return { up, marker: opened.marker, plan: up.audit(opened.items) };
}
ipcMain.handle('upd:info', () => {
  return { ok:true, tree:TREE, pages:PAGES_ROOT, data:DATA_ROOT, upd:UPD_DIR,
    versions:updVersions(), backups:updBackups(), updater:fs.existsSync(UPDATER),
    running:runningSiblings() };
});
ipcMain.handle('upd:pick', async (e) => {
  /* 乙-1：挑更新包记更新包的来处 —— 他自己那句话：「更新记住更新包文件夹」。
     这一条是专用通道，没有 id 可拿，键就地定死一个。 */
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
    title:'挑更新包', defaultPath: uiPathStart('fd-update'), properties:['openFile'], filters:[{ name:'Flow-Desk 更新包', extensions:['zip'] }]
  });
  if(r.canceled || !r.filePaths.length) return { ok:false, cancel:true, msg:'没挑包' };
  uiPathRemember('fd-update', r.filePaths[0]);
  return { ok:true, zip:r.filePaths[0] };
});
ipcMain.handle('upd:plan', (e, zip) => {
  try{
    const { marker, plan } = updRead(zip);
    const now = updVersions();
    const cmp = k => cmpVer(verNum(String(marker.versions[k] || '')), verNum(String(now[k] || '')));
    const diff = ['fd'].map(k => cmp(k)).reduce((a, b) => a || b, 0);
    return { ok:true, zip:String(zip), marker, plan, now,
      newer:diff > 0, same:diff === 0, behind:diff < 0,
      busy:runningSiblings(),
      parts:plan.runtime ? 'pages + 程序代码 + 运行时' : 'pages + 程序代码' };
  }catch(e){ return { ok:false, msg:((e && e.message) || String(e)) }; }
});
ipcMain.handle('upd:start', (e, zip) => {
  const busy = runningSiblings();
  if(busy.length) return { ok:false, msg:'先把 ' + busy.join('、') + ' 关掉，那些文件正被它们读着' };
  let job;
  try{
    const { up, plan } = updRead(zip);
    const stamp = up.stamp();
    job = { zip:String(zip), tree:TREE, upd:UPD_DIR, stamp };
    /* 带运行时的包要动 exe：这份脚本就不能从树里那个跑，先拷去临时目录 */
    let exe = process.execPath, script = UPDATER;
    if(plan.runtime){
      const tmp = path.join(require('os').tmpdir(), 'FlowDesk-update-' + stamp);
      fs.mkdirSync(tmp, { recursive:true });
      exe = path.join(tmp, APP.label + '.exe');
      script = path.join(tmp, 'updater.cjs');
      fs.copyFileSync(process.execPath, exe);
      fs.copyFileSync(UPDATER, script);
      job.tmp = tmp;
    }
    const p = spawn(exe, [script, JSON.stringify(job)], {
      env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE:'1' }),
      detached:true, stdio:'ignore'
    });
    p.unref();
  }catch(err){ return { ok:false, msg:'装不起来：' + ((err && err.message) || err) }; }
  logLine('更新', '本地更新开始 · 包 ' + path.basename(job.zip) + ' · 装完自动起新版');
  /* 这句先回给页面，让关于页把话说完，再退出 */
  setTimeout(() => { app.isQuitting = true; const w = live(); if(w) w.close(); app.quit(); }, 700);
  return { ok:true, msg:'开始装，这一版这就退出，装完自己起来' };
});
ipcMain.on('win:closeAnswer', (e, action) => doClose(String(action)));
function toFilters(accept){
  if(!accept) return [];
  const exts = [];
  for(const list of Object.values(accept)) for(const x of list) if(x.startsWith('.')) exts.push(x.slice(1));
  return exts.length ? [{ name:'选定类型', extensions:[...new Set(exts)] }] : [];
}

/* ---------- 关窗口的三种走法：问问我 / 最小化到托盘 / 直接退出 ----------
   选择存 exe 旁的 userdata-<app>\close-choice.json，明文，删掉就是恢复默认。 */
const CLOSE_FILE = () => path.join(app.getPath('userData'), 'close-choice.json');
function readCloseMode(){
  try{ const m = JSON.parse(fs.readFileSync(CLOSE_FILE(), 'utf8')).mode;
       return (m === 'tray' || m === 'quit') ? m : 'ask'; }
  catch(e){ return 'ask'; }
}
function writeCloseMode(m){
  const mode = (m === 'tray' || m === 'quit') ? m : 'ask';
  try{ fs.mkdirSync(path.dirname(CLOSE_FILE()), { recursive:true });
       fs.writeFileSync(CLOSE_FILE(), JSON.stringify({ mode }, null, 2), 'utf8'); }catch(e){}
  return mode;
}

/* ---------- RP 指 Rime 用户目录：指一次就记在 exe 旁的明文 json，开机自动重读 ----------
   没记过就用小企鹅的默认位置 %APPDATA%\Rime；那个目录也不存在才回空串，让页面照旧走手动选。 */
const RIME_FILE = () => path.join(app.getPath('userData'), 'rime-dir.json');
function readRimeDir(){
  try{ const p = JSON.parse(fs.readFileSync(RIME_FILE(), 'utf8')).path;
       if(typeof p === 'string') return p; }catch(e){}
  const d = process.env.APPDATA ? path.join(process.env.APPDATA, 'Rime') : '';
  if(d){ try{ if(fs.statSync(d).isDirectory()) return d; }catch(e){} }
  return '';
}
function writeRimeDir(p){
  try{ fs.mkdirSync(path.dirname(RIME_FILE()), { recursive:true });
       fs.writeFileSync(RIME_FILE(), JSON.stringify({ path: String(p || '') }, null, 2), 'utf8'); }catch(e){}
  return true;
}

/* 窗口关掉之后 win 这个对象就废了，再碰它就抛 Object has been destroyed ——
   所以外面一律走 live()，别直接读 win。 */
function live(){ return (win && !win.isDestroyed()) ? win : null; }

function hideToTray(){ const w = live(); if(w) w.hide(); }
function quitApp(){ app.isQuitting = true; const w = live(); if(w) w.close(); app.quit(); }

/* 关窗口时问页面：页面用 FD 那套配色弹自己的框，答完回 action。
   二十秒没回话（页面卡了、框没弹出来）就按「退出」收 —— 以前这里落到托盘，
   托盘格子又没收干净，结果就是窗口关了、进程还留在后台。 */
function askToClose(){
  const w = live();
  if(!w) return;
  pending = true;
  w.webContents.send('fd:close-ask');
  setTimeout(() => { if(pending){ pending = false; quitApp(); } }, 20000);
}
function doClose(action){
  if(!pending) return;
  pending = false;
  if(action === 'quit') quitApp();
  else if(action === 'tray') hideToTray();
}

/* ---------- 窗口 ---------- */
let win = null, tray = null, pending = false;

/* ---------- 运行日志 ----------
   data\logs\ 一天一个文件，每行开头是 FD|，后面跟着这一行的事。
   记的都是"当时看不出来、回头才知道"的事：
   页面崩了自动重载、窗口卡住、白屏加载失败、渲染进程里的报错、主进程抛的异常。
   探针 / 开发实例（带 FD_USERDATA）写到探针目录旁边，不往他的 logs\ 里掺。
   写日志这件事自己绝不能把程序带倒，所以整条路都裹在 try 里，失败就当没写。 */
const LOG_TAG = 'FD|';
/* 日志跟着数据走：落在 data\logs\，软件更新换 pages\ 的时候不会把它一起换掉 */
const LOG_DIR = process.env.FD_USERDATA
  ? path.join(path.dirname(path.resolve(process.env.FD_USERDATA)), 'logs')
  : path.join(DATA_ROOT, 'logs');
const pad2 = n => String(n).padStart(2, '0');
function logDay(d){ return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
let logQ = Promise.resolve(), logMade = false;
function logLine(kind, msg){
  try{
    const d = new Date();
    const line = '[' + logDay(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) +
      '.' + String(d.getMilliseconds()).padStart(3, '0') + '] ' + LOG_TAG + String(kind || '') + ' ' +
      String(msg == null ? '' : msg).replace(/\s*\n\s*/g, ' ⏎ ').slice(0, 900) + '\n';
    if(!logMade){ logMade = true; try{ fs.mkdirSync(LOG_DIR, { recursive:true }); }catch(e){} }
    /* 排着队写：这一行整行落地才写下一行，别和同时写这个文件的人咬出半截 */
    const f = path.join(LOG_DIR, logDay(d) + '.log');
    logQ = logQ.then(() => fs.promises.appendFile(f, line)).catch(() => {});
  }catch(e){}
}
/* 开机那趟摆树（prepareTrees）跑在这行之前，那时日志还没就位，所以在这儿补记一笔。
   没摆成（blocked）这一趟先不记 —— data\logs\ 还没落地，写日志就得凭空建出一个 data\，
   那会让下一趟改名撞上同名。要说的话走开机那道弹窗。 */
if(!MIGRATE.blocked) MIGRATE.log.forEach(s => logLine('搬家', s));
/* 同一趟里清用户数据那一笔也补上（userWipe 在日志还没就位的时候就要跑，所以只能事后记） */
WIPE.log.forEach(s => logLine('清数据', s));
/* 主进程自己出事的最后一道记录：记完照旧走原来的路，不改变行为 */
process.on('uncaughtException', e => logLine('异常', '主进程未捕获：' + ((e && (e.stack || e.message)) || e)));
process.on('unhandledRejection', e => logLine('异常', '主进程 Promise 没人接：' + ((e && (e.stack || e.message)) || e)));

/* 一个窗口该记的：崩了重载、窗口卡住、这一页载入完成 */
function watchLogs(w){
  let frozen = 0;
  w.webContents.on('render-process-gone', (e, d) => {
    logLine('崩溃', '渲染进程没了（' + ((d && (d.reason + '/' + d.exitCode)) || '?') + '），自动重新载入');
    w.reload();
  });
  w.on('unresponsive', () => { frozen = Date.now(); logLine('卡住', '窗口没响应，先记一笔'); });
  w.on('responsive', () => { logLine('卡住', frozen ? '缓过来了，卡了约 ' + (Date.now() - frozen) + ' 毫秒' : '缓过来了'); frozen = 0; });
  w.webContents.on('did-finish-load', () => { logLine('载入', '完成 ' + shortUrl(w.webContents)); });
}
/* 报错不分主窗口还是嵌在里面的：FD 的卡片、封面里的 WNW / RP 都是各自的 webContents，
   哪一层出的错就在行首标出是哪一页，不然只知道"FD 报错了"没有用。
   载入完成不记在这儿：卡片一刷新就是十几条，会把有用的淹了。 */
app.on('web-contents-created', (e, c) => {
  c.on('did-fail-load', (ev, code, desc, url, main) => {
    /* -3 是页面自己打断的跳转（还没载入完就换了地址），天天有，不算事 */
    if(code === -3) return;
    logLine('载入', '失败 code=' + code + ' ' + desc + ' ' + String(url || '').slice(0, 200));
  });
  c.on('preload-error', (ev, p, err) => {
    logLine('异常', 'preload 出错 ' + p + '：' + ((err && (err.stack || err.message)) || err));
  });
  /* 页面里的报错送不到主进程，只有这一条路能捞回来（level 3 = error） */
  c.on('console-message', (ev, level, message, line, sourceId) => {
    if(level < 3) return;
    /* 在控制台里现敲的语句没有文件名，这时候就别拼那截尾巴 */
    const at = sourceId ? ' @' + String(sourceId).split('/').pop() + (line ? ':' + line : '') : '';
    logLine('页面', '[' + shortUrl(c) + '] ' + message + at);
  });
});
function shortUrl(c){
  try{ return String(c.getURL() || '').split('/').pop().slice(0, 46) || '空白'; }catch(e){ return '已关掉的页'; }
}

/* Flow-Desk 没有系统标题栏也没有原生菜单条：顶部那一栏是页面里自绘的，配色跟首页一致。
   走 titleBarStyle:'hidden' 而不是 frame:false —— 后者在 Windows 上最大化会把页面
   四边裁掉一圈（约 8px），拖拽边缘缩放也不如留着厚边框稳；前者只藏标题栏，框还在。 */

function makeWindow(){
  const entry = resolveEntry(APP.entry);
  const opts = {
    width: APP.win.width, height: APP.win.height,
    minWidth: 720, minHeight: 480,
    title: APP.label,
    backgroundColor: '#ffffff',
    titleBarStyle: 'hidden',
    show: false,
    webPreferences:{
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: false, nodeIntegration: false, sandbox: false,
      /* 「空白网页」那一档要看真网站，得用 <webview>：普通 iframe 装不进大多数站点 ——
         人家在响应头里写了 frame-ancestors，地址栏敲进去只剩一片白。
         这一档只开网页区，不给它 node：webview 里的页面和主页面各一层，互相碰不到。 */
      webviewTag: true,
      /* 两层各递一个门牌号给 preload：fdapp:// 的地址是从 页面\ 起算的，
         pagePath 要把相对路径换算回磁盘，必须按和 serve 同一个口径认路 */
      additionalArguments: ['--fd-app=fd', '--fd-root=' + TREE,
        '--fd-pages=' + PAGES_ROOT, '--fd-data=' + DATA_ROOT, '--fd-label=' + APP.label]
    }
  };
  /* 托盘和任务栏用同一张图 */
  const ic = iconFile();
  if(ic) opts.icon = ic;
  const w = new BrowserWindow(opts);
  w.once('ready-to-show', () => w.show());
  w.on('close', e => {
    if(app.isQuitting) return;
    e.preventDefault();
    const mode = readCloseMode();
    if(mode === 'tray') hideToTray();
    else if(mode === 'quit'){ app.isQuitting = true; w.close(); }
    else askToClose();
  });
  w.webContents.setWindowOpenHandler(({ url }) => {
    /* 页面里 target=_blank 的链接：本地文件开新窗口，外部链接交给系统默认的上网程序 */
    if(url.startsWith('fdapp://')) return { action:'allow' };
    require('electron').shell.openExternal(url);
    return { action:'deny' };
  });
  if(!entry){
    logLine('启动', '找不到页面：按 ' + PAGES_ROOT + '\\' + APP.entry + ' 这个样式没找到文件');
    w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
      '<meta charset="utf-8"><body style="font:15px/1.9 system-ui;padding:40px">' +
      '<h2>' + APP.label + '：找不到页面文件</h2><p>按这个样式去找：' + PAGES_ROOT + '\\' + APP.entry +
      '<br>改版本号之后请把 app/root.json 或 app/main.cjs 里的 entry 对一下。</p>'));
    return w;
  }
  w.loadURL(toUrl(entry));
  /* 页面里的 <title> 本来就叫这个名字，再拼一次就成了「Flow-Desk · Flow-Desk」。
     只有页面自己把标题改成了别的东西（为写显示书名）才拼在后面。 */
  w.webContents.on('page-title-updated', (e, t) => {
    e.preventDefault();
    w.setTitle(t && t !== APP.label ? APP.label + ' · ' + t : APP.label);
  });
  /* 崩了自动重载 + 卡住 / 白屏 / 页面报错都记进 日志\（原来这句是静默重载，出了事查不到） */
  watchLogs(w);
  w.on('maximize', () => tellWinState());
  w.on('unmaximize', () => tellWinState());
  w.on('enter-full-screen', () => tellWinState());
  w.on('leave-full-screen', () => tellWinState());
  wireKeys(w);
  return w;
}

/* 无框窗口的标题栏是页面画的，最大化按钮的长相得跟着系统状态变 */
function tellWinState(){
  const w = live();
  if(w) w.webContents.send('win:state', winState());
}
function winState(){
  const w = live();
  return { maximized: w ? w.isMaximized() : false, fullscreen: w ? w.isFullScreen() : false };
}

/* ---------- 无框窗口的键盘入口 ----------
   菜单条去掉以后菜单上的快捷键也就没了，这里自己接上——只接自绘菜单里那几项。
   Ctrl+C / V / Z 那套不用管，Blink 自己在输入框里处理。 */
function wireKeys(w){
  w.webContents.on('before-input-event', (e, input) => {
    if(input.type !== 'keyDown') return;
    const k = String(input.key || '').toLowerCase();
    const mod = input.control || input.meta;
    if(k === 'f11'){ winCtl('fullscreen'); e.preventDefault(); return; }
    if(!mod) return;
    if(k === 'r'){ winCtl(input.shift ? 'reloadForce' : 'reload'); e.preventDefault(); return; }
    if(k === 'q'){ winCtl('quit'); e.preventDefault(); return; }
    if(k === 'h'){ winCtl('help'); e.preventDefault(); return; }
    if(k === '=' || k === '+'){ winCtl('zoomIn'); e.preventDefault(); return; }
    if(k === '-'){ winCtl('zoomOut'); e.preventDefault(); return; }
    if(k === '0'){ winCtl('zoomReset'); e.preventDefault(); return; }
  });
}

/* ---------- 自绘标题栏 / 自绘菜单的操作 ----------
   页面里点一下就送到这儿；关闭一律走 w.close()，关窗口那张「问问我 / 收进托盘」的框照旧拦。 */
function winCtl(act){
  const a = String(act || '');
  if(a === 'quit'){ quitApp(); return winState(); }
  const w = live();
  if(!w) return winState();
  if(a === 'min') w.minimize();
  else if(a === 'max'){ w.isMaximized() ? w.unmaximize() : w.maximize(); }
  else if(a === 'close') w.close();
  else if(a === 'reload') w.reload();
  else if(a === 'reloadForce') w.webContents.reloadIgnoringCache();
  else if(a === 'fullscreen') w.setFullScreen(!w.isFullScreen());
  else if(a === 'zoomIn' || a === 'zoomOut' || a === 'zoomReset'){
    const z = w.webContents.getZoomFactor();
    w.webContents.setZoomFactor(a === 'zoomIn' ? Math.min(2, +(z + .1).toFixed(2))
      : a === 'zoomOut' ? Math.max(.5, +(z - .1).toFixed(2)) : 1);
  }
  else if(a === 'help') w.webContents.send('fd:help');
  else if(a === 'state') return winState();
  tellWinState();
  return winState();
}
ipcMain.handle('win:ctl', (e, act) => winCtl(act));

/* ---------- 应用菜单 ----------
   Flow-Desk 不用 Electron 那条英文菜单：菜单栏和标题栏都是页面里自绘的，配色跟着首页走，
   原先挂在这上面的快捷键改由 wireKeys 接。 */
function buildMenu(){ Menu.setApplicationMenu(null); }

/* 图标就认三张图：exe 旁边的 icons\ 优先（改起来不用进 resources），
   其次 resources\app\icons\（打包带出去的默认那张），都没有才现画一个纯色方块。
   要求写在 FD 的帮助文档里：PNG / 正方形 / 256×256 起 / 文件名固定。 */
function iconFile(){
  const f = APP.icon + '.png';
  for(const dir of [path.join(path.dirname(process.execPath), 'icons'), path.join(__dirname, 'icons')]){
    const p = path.join(dir, f);
    try{ if(fs.statSync(p).isFile()) return p; }catch(e){}
  }
  return null;
}
function trayIcon(){
  const f = iconFile();
  if(f){
    const im = nativeImage.createFromPath(f);
    if(!im.isEmpty()) return im.resize({ width:16, height:16 });
  }
  const size = 16, px = Buffer.alloc(size * size * 4);
  const col = [90, 130, 210, 255];
  for(let i = 0; i < size * size; i++){ px[i*4] = col[0]; px[i*4+1] = col[1]; px[i*4+2] = col[2]; px[i*4+3] = col[3]; }
  return nativeImage.createFromBuffer(px, { width:size, height:size });
}
function showWin(){
  if(!win || win.isDestroyed()) win = makeWindow();
  if(!win.isVisible()) win.show();
  win.focus();
}
/* 托盘一次开机只建一个：Windows 那条通知区域格子要等 Explorer 自己回收，
   先 destroy 再 new 会让托盘上短暂多出一个重复图标（旧格子还没收，新格子已经挂上）。
   所以重建窗口、重新载入页面这些路径一律不碰托盘；菜单内容要变得走 setContextMenu 换一份。 */
function trayMenu(){
  return Menu.buildFromTemplate([
    { label: APP.label, enabled:false },
    { label: trayText('显示 / 隐藏'), click:() => { const w = live(); if(!w){ showWin(); return; } w.isVisible() ? w.hide() : (w.show(), w.focus()); } },
    { type:'separator' },
    { label: trayText('重新载入页面'), click:() => { const w = live(); if(w) w.reload(); } },
    { type:'separator' },
    { label: trayText('退出'), click:() => quitApp() }
  ]);
}
function buildTray(){
  if(tray){ tray.setContextMenu(trayMenu()); return; }
  tray = new Tray(trayIcon());
  tray.setToolTip(APP.label);
  tray.setContextMenu(trayMenu());
  tray.on('click', () => { const w = live(); if(!w){ showWin(); return; } w.isVisible() ? w.minimize() : (w.show(), w.focus()); });
}

/* 便携：用户数据跟着文件夹走，如今落在 data\userdata-fd\（一个程序一份），
   单实例锁也按这个目录分。开发时用 FD_USERDATA 指到别处。
   还没搬成（比如搬家那趟被别的程序挡了）就照旧用老位置，绝不因为换了地方而让他看到一份空数据。 */
function userDataDir(){
  const cand = [path.join(DATA_ROOT, 'userdata-fd'), path.join(TREE, 'userdata-fd'),
    path.join(path.dirname(process.execPath), 'userdata-fd')];
  for(const p of cand){ try{ if(fs.existsSync(p)) return p; }catch(e){} }
  return cand[0];
}
app.setName(APP.label);
app.setPath('userData', process.env.FD_USERDATA || userDataDir());

/* ---------- 程序唯一 ----------
   Electron 自带的锁认的是 userData 目录，也就是认「哪个文件夹」：把 Flow-Desk 拷一份、
   或者老布局的 程序\ 里还留着旧 exe，两处各起一个，托盘上就是两个一样的图标，
   两份还同时吃同一套 fdapp:// 数据。所以再加一道跨文件夹的闸门：
   本机固定端口，谁先起来谁占着；后到的问一句「你是我们这个程序吗」，
   是 —— 让位，并叫它把窗口露出来；不是（端口被别的程序占了）—— 照常起，不误伤。
   探针 / 开发实例（带 FD_USERDATA，或 FD_TREE 指到别处那棵树）不走这道闸门，否则测试全被挡在门外。 */
const SOLO_PORT = 47821;
const SOLO_SAY = 'FD-SOLO fd';
const SOLO_OK = 'FD-SOLO-OK fd';
function soloGuard(done){
  const port = SOLO_PORT;
  if(!port || process.env.FD_USERDATA || process.env.FD_TREE) return done(true);
  let settled = false;
  const go = ok => { if(!settled){ settled = true; done(ok); } };
  const srv = netNode.createServer(sk => {
    sk.on('data', d => {
      if(String(d).trim() === SOLO_SAY){ sk.end(SOLO_OK); showWin(); }
      else sk.end('FD-SOLO-NO');
    });
    sk.on('error', () => sk.destroy());
  });
  srv.on('error', e => {
    if(e.code !== 'EADDRINUSE') return go(true);
    ask(3);
  });
  /* 问三次，别拿一次的沉默定「这端口上住的不是我们」。旧写法是「1.5 秒没回就照常起」——
     活着的 Flow-Desk 主进程正卡在磁盘活上（写页面、写词库那几秒）就来不及回话，于是两处
     各起一个、托盘上多出一格一样的图标，这就是「托盘图标偶发重复」在代码里的那条路。
     现在讲确定的回答（FD-SOLO-OK / FD-SOLO-NO）当场算数；超时、连上就断这种含糊的再问一遍，
     三次全没回话才照常起 —— 端口被别的程序占着时照样不误伤。 */
  function ask(left){
    const sk = netNode.connect(port, '127.0.0.1');
    let answer = '';
    let over = false;
    const settle = ok => { if(!over){ over = true; go(ok); } };
    const again = () => {
      if(over) return;
      over = true;
      if(left > 1) return setTimeout(() => ask(left - 1), 400);
      // 回话里开头是 OK 就是让位，别的（包括一句没回）都照常起
      go(answer.indexOf(SOLO_OK) !== 0);
    };
    sk.setTimeout(1500, () => { sk.destroy(); again(); });
    sk.on('data', d => { answer += d; });
    sk.on('error', again);
    sk.on('close', () => {
      if(answer.indexOf(SOLO_OK) === 0) return settle(false);
      if(answer) return settle(true);
      again();
    });
    sk.write(SOLO_SAY + '\n');
  }
  srv.listen({ host:'127.0.0.1', port, exclusive:true }, () => go(true));
}

const gotLock = app.requestSingleInstanceLock();
if(!gotLock) app.quit();
/* 树没摆正就不开机：三层名字还没改过来 / 用户数据还挤在 pages\ 里，这种状态一起窗口，
   程序读到的 data\ 是个空壳 —— 看着像"数据全没了"，比不开机糟得多。
   当面对他把话说清（哪一个还开着、该怎么做），一个目录不建、一个字节不动，收工。
   探针和开发实例（FD_USERDATA / FD_TREE）不在这条路上：它们本就不吃这棵树的状态。 */
else if(MIGRATE.blocked && !process.env.FD_USERDATA && !process.env.FD_TREE){
  app.whenReady().then(() => {
    try{
      dialog.showMessageBoxSync({
        type:'warning', title: APP.label, buttons:['好'], defaultId:0,
        message:'这一次先别开',
        detail: MIGRATE.blocked
      });
    }catch(e){}
    console.log('[摆树] ' + MIGRATE.blocked);
    app.exit(0);
  });
}
else {
  app.on('second-instance', () => { logLine('启动', '又点了一次图标，把已有的窗口露出来'); showWin(); });
  soloGuard(ok => {
    if(!ok){ app.quit(); return; }
    app.whenReady().then(() => {
      protocol.handle('fdapp', serve);
      buildMenu();
      const entry = resolveEntry(APP.entry);
      logLine('启动', APP.label + ' 页面=' + (entry ? path.basename(entry) : '（没找到）') +
        ' 数据=' + DATA_DIR() + ' 日志=' + LOG_DIR + ' Electron=' + process.versions.electron);
      /* 开机第一件事就是把 plugins\ 里丢进来的 zip 摊开（丢文件夹的那家不用摊，扫目录直接认）——
         窗口还没加载，页面那一趟 packList 看到的就是摊好的形状。 */
      try{ packAdopt(); }catch(err){ logLine('插件', '开机摊开这一趟没跑成：' + String((err && err.message) || err)); }
      win = makeWindow();
      buildTray();
      /* #237：开机就把清单备好在磁盘上（没有就现扫源码生成），然后盯着 data\ 里的这一份 */
      ensureUiText();
      ensureCardSize();
      startUiTextWatch();
      /* 本地字体：开机就在后台重数一遍（装了新字体不该等谁去点「读系统字体」才看得见）。
         页面那头的 font:list 拿的是缓存，这一趟数完把新的推过去，界面自己刷新。 */
      refreshFonts();
      /* 明暗那一轴（外13-M）：休眠醒来要补一次 —— 页面那一头的定时唤醒是被系统一起挂起的，
         醒来后「按一日内时间切换」那一档得重认一遍时刻、顺带把系统深浅再报一次。
         powerMonitor 这一层只在 ready 之后才接（官方就这么要求的）。 */
      try{
        powerMonitor.on('resume', () => { mingTell('睡醒重认一次'); });
        powerMonitor.on('unlock-screen', () => { mingTell('解锁重认一次'); });
      }catch(e){ logLine('明暗', '休眠唤醒那条事件接不上：' + ((e && e.message) || e)); }
      app.on('activate', () => { if(BrowserWindow.getAllWindows().filter(x => !x.isDestroyed()).length === 0) win = makeWindow(); });
    });
    /* 窗口全关就等于退出。最小化到托盘走的是 hide，窗口还在，不会走到这一条；
       真走到这一条，说明窗口是被关掉的 —— 那就把进程收干净，别留一个没窗口的程序在后台。 */
    app.on('window-all-closed', () => { app.quit(); });
    app.on('before-quit', () => { app.isQuitting = true; logLine('退出', '程序退出');
      /* 退出前主动把托盘摘掉，别等 Explorer 自己发现进程没了 —— 那样托盘上会留一格假图标 */
      if(tray){ try{ tray.destroy(); }catch(e){} tray = null; }
      if(media.child){ try{ media.child.kill(); }catch(e){} media.child = null; } });
  });
}
