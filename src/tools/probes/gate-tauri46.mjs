/* ============================================================
   gate-tauri46.mjs · 外46 三：Tauri 壳搬通道的第一组 —— 文件读写那一摊十颗
   ------------------------------------------------------------
     node src/tools/probes/gate-tauri46.mjs
   钉的是这么几件事：
     一、主进程里文件读写那一组，每一颗在壳里都有一座对应的桥（名字按 Rust 的规矩换算，页面上请的那串字不动）；
     二、读文件的两颗回的是裸字节，不许在半路化成字符串 —— 页面上拿到的一直是 Buffer；
     三、四层规矩：纯判断那一格里不许出现动磁盘的手，也不许出现壳的名字；
     四、每一颗都上了 main.rs 的注册单（没上单的命令等于不存在）；
     五、纯判断那一格里有测试在跑，而且构建脚本能单独把测试跑一趟；
     六、这一摊要进仓的每一本文本里都不许有这台机器的盘符、帐户名、私人目录名；
     七、骨架那张占位页请的命令是真的存在的（上一版它请了一串没注册的名，读到的是「问不动」）；
     八、窗口那一组：主进程 winCtl 认的十一种动作串，壳里逐条对得上，两颗都上了注册单；
     九、回报给页面的形状还是那两格，两枚事件名 win:state 与 fd:close-ask 两头同一串；
     十、二十秒没回话按「退出」收那一条兜底，两头都得在；
     十一、缩放档位住在纯判断那一格且带测试，托盘那一档 feature 开着；
     十二、壳那一头把记缩放、拦关闭、开机建托盘这三样装上了。
     七、骨架那张占位页请的命令是真的存在的（上一版它请了一串没注册的名，读到的是"问不动"）。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { rd, 记账, ROOT } from './lib-slice.mjs';

const 台 = 记账('gate-tauri46');
const 行 = s => String(s || '').split(/\r?\n/);
const 壳根 = path.join(ROOT, 'src', '_tauri');
const main = rd('src/pack/main.cjs');
const 壳 = rd('src/_tauri/src/main.rs');
const 命令 = rd('src/_tauri/src/tauri_bind/fs_cmds.rs');
const 壳里 = p => rd('src/_tauri/' + p);
const 窗 = 壳里('src/tauri_bind/win_cmds.rs');
const 清单 = 壳里('Cargo.toml');
/* 纯判断那一格整格扫：往后每一颗判断都落在这格，规矩一起管住，不用一颗补一条 */
const 判断 = fs.readdirSync(path.join(壳根, 'src', 'core')).filter(f => f.endsWith('.rs'))
  .map(f => rd('src/_tauri/src/core/' + f)).join('\n');
const 脚本 = rd('src/_tauri/build.mjs');
const 占位页 = rd('src/_tauri/ui/index.html');

/* 名字换算：主进程写「fs:readRange」，Rust 的函数名装不下冒号也装不下驼峰，只能落成「fs_read_range」。
   这道换算放在 JS 桥上做，页面上请壳的那串字一个字不改。 */
const 桥名 = n => n.replace(/:/g, '_').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

台.题('一、文件读写那一组：主进程每一颗，壳里都有一座');
const 撞 = [...main.matchAll(/ipcMain\.(?:handle|on)\('(fs:[A-Za-z]+)'/g)].map(m => m[1]);
const 通道 = [...new Set(撞)].sort();
台.数('主进程里文件读写那一组共几颗', 通道.length + ' 颗 · ' + 通道.join(' '));
台.判('量出来正好十颗（少了就是主进程那边动了，多了就是这一组又添了新颗）', 通道.length === 10);
for(const c of 通道){
  const b = 桥名(c);
  台.判(c + ' 在壳里有对应的一颗 ' + b, new RegExp('pub (?:async )?fn ' + b + '\\s*\\(').test(命令));
}
台.判('壳里那一份的命令标记也是十颗，不多不少', (命令.match(/#\[tauri::command\]/g) || []).length === 10);

台.题('二、读那两颗回裸字节，不化成字符串');
const 回裸字节 = 行(命令).filter(s => s.includes('-> Result<tauri::ipc::Response')).map(s => (s.match(/fn (\w+)/) || [])[1]);
台.数('回裸字节的是哪几颗', 回裸字节.join(' '));
台.判('整读与按区间读这两颗回的是裸字节', 回裸字节.length === 2 && 回裸字节.includes('fs_read') && 回裸字节.includes('fs_read_range'));
台.判('这两颗不许被改成回字符串（页面上拿到的一直是 Buffer）',
  !/fn fs_read(?:_range)?\s*\([^)]*\)\s*->\s*Result<String/.test(命令));

台.题('三、四层规矩：纯判断那一格不动磁盘、不认识壳');
for(const 禁 of ['std::fs', 'File::open', 'File::create', 'fs::write', 'read_to_string', 'tauri::'])
  台.判('纯判断那一格里没有「' + 禁 + '」', !判断.includes(禁));
台.判('动磁盘的那一手住在第三层（命令胶水那一格里真有 std::fs）', 命令.includes('std::fs'));

台.题('四、每一颗都上了注册单');
for(const c of 通道)
  台.判(c + ' → ' + 桥名(c) + ' 在 main.rs 的注册单上', 壳.includes('fs_cmds::' + 桥名(c)));
台.判('注册单上第一颗是报版本与树位的那一颗', 壳.includes('generate_handler![') && 壳.includes('shell_info'));

台.题('五、纯判断那一格有测试在跑，脚本能单独跑它');
台.数('纯判断那一格里几颗测试', (判断.match(/#\[test\]/g) || []).length);
台.判('测试不少于五颗', (判断.match(/#\[test\]/g) || []).length >= 5);
台.判('构建脚本认 --测 这一档', 脚本.includes("argv.includes('--测')") && 脚本.includes("TEST ? 'test'"));
台.判('跑测试那一趟不带 --release（不产壳、不占地方）', /CHECK \|\| TEST \? \[/.test(脚本));
台.判('跑完测试就收尾，不去找那颗 exe', /if\(TEST\)/.test(脚本));

台.题('六、公开面零本机痕迹（这一摊要进仓的每一本文本）');
const 本 = [];
(function 走一格(d){
  for(const e of fs.readdirSync(d, { withFileTypes: true })){
    if(e.name === 'target' || e.name === 'node_modules') continue;
    const p = path.join(d, e.name);
    if(e.isDirectory()) 走一格(p);
    else if(/\.(rs|mjs|json|toml|html|lock)$/.test(e.name)) 本.push(p);
  }
})(壳根);
const 盘符 = /(^|[^A-Za-z0-9])[A-Za-z]:[\\/]/;
const 露 = 本.map(p => ({ p, 文: fs.readFileSync(p, 'utf8') }))
  .filter(x => 盘符.test(x.文) || /87354|MyFiles|CLion|LunarFeast/.test(x.文));
台.数('扫了几本文本', 本.length);
台.判('没有一个字节写着这台机器的盘符、帐户名或私人目录名', 露.length === 0, 露.map(x => path.relative(ROOT, x.p)).join('、'));

台.题('七、骨架那张占位页请的名是真的');
const 请 = [...占位页.matchAll(/invoke\('([A-Za-z_0-9]+)'\)/g)].map(m => m[1]);
台.数('占位页请了哪几颗', 请.join(' '));
台.判('请的每一颗都在注册单上', 请.length > 0 && 请.every(n => 壳.includes(n)));

台.题('八、窗口那一组：主进程 winCtl 认的动作串，壳里逐条对得上');
const 段 = (() => {
  const 起 = main.indexOf('function winCtl(act){');
  const 止 = main.indexOf("ipcMain.handle('win:ctl'", 起);
  return 起 < 0 || 止 < 起 ? '' : main.slice(起, 止);
})();
const 动作 = [...new Set([...段.matchAll(/a === '([A-Za-z]+)'/g)].map(m => m[1]))].sort();
台.数('主进程那边 winCtl 认几种动作', 动作.length + ' 种 · ' + 动作.join(' '));
for(const a of 动作) 台.判('壳里认「' + a + '」这一档', 窗.includes('"' + a + '"'));
台.判('这一组的两颗都上了注册单（win:ctl 与 win:closeAnswer）',
  壳.includes('win_cmds::win_ctl') && 壳.includes('win_cmds::win_close_answer'));

台.题('九、回报给页面的形状与两枚事件名照旧');
台.判('回报的还是那两格 { maximized, fullscreen }',
  /maximized/.test(main) && /fullscreen/.test(main) && /maximized/.test(窗) && /fullscreen/.test(窗));
for(const 件 of ['win:state', 'fd:close-ask'])
  台.判('事件名「' + 件 + '」两头同一串（主进程发得出，壳也发得出）',
    main.includes("'" + 件 + "'") && 窗.includes('"' + 件 + '"'));

台.题('十、二十秒没回话按「退出」收（那条兜底两头都得在）');
const 问段起 = main.indexOf('function askToClose()'), 问段止 = main.indexOf('function doClose(');
台.判('主进程那边确有 20000 毫秒这一道', main.slice(问段起, 问段止).includes('20000'));
台.判('壳这边同一道：from_secs(20) 到点就收摊', 窗.includes('from_secs(20)'));
台.判('问过一次就不再重复问（待回答这块牌要拦两件事）',
  窗.includes('手.待回答') && 窗.includes('手.退出中'));

台.题('十一、窗口那一点纯判断有测试在跑，托盘那一档 feature 开着');
台.判('纯判断那一格里有 win_policy（缩放档位在那儿，带测试）',
  /win_policy/.test(判断) && fs.existsSync(path.join(壳根, 'src', 'core', 'win_policy.rs'))
  && /zoom_step/.test(判断) && (判断.match(/#\[test\]/g) || []).length >= 8);
台.判('缩放档位夹在 0.5 到 2 之间（跟主进程那边 Math.min(2,) Math.max(.5,) 同一档)',
  /0\.5/.test(判断) && /2\.0/.test(判断)
  && /Math.min\(2,/.test(main) && /Math.max\(\.5,/.test(main));
台.判('托盘那一档 feature 开着（关窗口那张框「收进托盘」的落点）',
  /features = \[[^\]]*"tray-icon"/.test(清单));

台.题('十二、壳那一头把三样东西装上了');
for(const 装 of ['.manage(', '.on_window_event(', '.setup('])
  台.判('装上了 ' + 装, 壳.includes(装));
台.判('拦关闭走的是 WindowEvent 里的 CloseRequested', 窗.includes('WindowEvent::CloseRequested'));

台.题('十三、挑文件与挑目录那两颗');
const 挑 = 壳里('src/tauri_bind/pick_cmds.rs');
for(const c of ['fsa:pickFiles', 'fsa:pickDir']){
  const b = 桥名(c);
  台.判(c + ' → ' + b + ' 在壳里有对应的一颗', 挑.includes('fn ' + b) && 壳.includes('pick_cmds::' + b));
}
台.判('回的还是那一格 paths（取消就回空串，跟主进程那边同一形状）',
  main.includes('return { paths:[] }') && 挑.includes('pub struct 一批路径 { paths: Vec<String> }'));
台.判('命令名两头只差冒号与驼峰这一道换算（壳里没有第三种拼法）',
  !/fn fsaPick|fn pick_files|fn pickFiles/.test(挑));

台.题('十四、探针预置与"记住上次挑过哪里"两道都跟着搬过来了');
台.判('预置那串环境变名两头同一串（FD_AUTOTEST_PICK）',
  main.includes('FD_AUTOTEST_PICK') && 挑.includes('FD_AUTOTEST_PICK'));
台.判('记路径那一份文件两头同名（ui-paths.json）', main.includes('ui-paths.json') && 挑.includes('ui-paths.json'));
台.判('记的是"挑中那一样自己是不是目录"，不是调用方说要目录',
  挑.includes('std::fs::metadata(挑中)') && /归格\(挑中, 是目录\)/.test(挑));

台.题('十五、类型筛选那一条的规则两头同一份');
台.判('只认带点的后缀、去重、合成一条叫「选定类型」',
  main.includes("startsWith('.'") && 判断.includes('strip_prefix') && 判断.includes('选定类型'));
台.判('这条规则住在纯判断那一格（不在动手那一格里再抄一遍）',
  判断.includes('pub fn 筛选') && !挑.includes('fn 筛选'));

台.题('十六、对话框走的是官方那颗插件的 Rust 接口');
台.判('Cargo.toml 里登记了 tauri-plugin-dialog', /tauri-plugin-dialog/.test(清单));
台.判('main.rs 里把那颗插件 init 上了', 壳.includes('tauri_plugin_dialog::init()'));
台.判('动对话框的那一手在第三层，判断仍在纯判断那一格',
  挑.includes('blocking_pick_files') && 挑.includes('blocking_pick_folder'));

台.题('十七、没有对等接口的那一条要写着，不许当成已实现');
台.判('主进程那边挑目录的框有"新建文件夹"那一档（createDirectory）', main.includes('createDirectory'));
台.判('壳这一份里明写了这一档在 Rust 这头没有对等接口', 挑.includes('createDirectory'));

台.收尾();
