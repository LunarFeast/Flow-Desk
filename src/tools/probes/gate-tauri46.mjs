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
const 判断 = rd('src/_tauri/src/core/fs_policy.rs') + '\n' + rd('src/_tauri/src/core/mod.rs');
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

台.收尾();
