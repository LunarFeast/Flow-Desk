
/* ============================================================
   gate-merge46.mjs · 外46 四：仓并成两棵（六家插件带历史并回主仓）
   ------------------------------------------------------------
     node src/tools/probes/gate-merge46.mjs
   钉的是这么几件事：
     一、六家的代码真的在主仓里被跟踪（不只是盘上躺着）；
     二、为写那一家一个字节都不许进主仓（它是收费的那一个）；
     三、忽略规则实测：该认的认、该排的排，插件那一格不许有第三种东西露在外面；
     四、名单只有一份：七家全在 plugin-repos 那张表里，发布脚本 import 它，别处不再抄一份；
     五、号两种形状各走各的：为写逐字节比自己那棵，六家拿主仓里动过自己那些份的那一笔；
     六、那六家的历史是真接进来的：并入那一笔有两个爹，第二个爹自带这一家的格，而且不在主线上。
   ============================================================ */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { rd, 记账, ROOT } from './lib-slice.mjs';
import { 家, REPOS } from '../../_build/plugin-repos.mjs';

const 台 = 记账('gate-merge46');
const 问 = a => { try{ return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim(); }catch(e){ return ''; } };
const 成 = a => { try{ execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }); return true; }catch(e){ return false; } };
const 行 = s => String(s || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const rel = rd('src/_build/release.mjs');
const 闸 = rd('src/tools/probes/gate-pack46.mjs');
const 跟踪 = 问(['ls-files']).split(/\r?\n/).filter(Boolean);
const 六 = 家.filter(j => !j.仓).map(j => j.id);

台.题('一、六家的代码在主仓里被跟踪');
台.数('表里不带仓的几家', 六.join('、'));
for(const id of 六){
  const 格 = 'data/plugins/' + id + '/';
  const 份 = 跟踪.filter(f => f.startsWith(格));
  台.判(id + ' 那一格里 main.js 与插件清单都被跟踪（现在 ' + 份.length + ' 份）',
    份.includes(格 + 'main.js') && 份.includes(格 + 'manifest.json'));
}
for(const f of ['src/_build/p1.js', 'src/_build/p6.js', 'src/_build/rp-kernel.mjs', 'src/_build/rp-base.html',
                 'src/_wcustom/build-kernel.mjs', 'src/_wcustom/src/sh-code.js',
                 'src/pack/plugin/FlowDeskBridge.cs', 'src/pack/plugin/build-plugin.ps1'])
  台.判(f + ' 进仓了', 跟踪.includes(f));

台.题('二、为写那一家一个字节都不许在主仓里');
台.判('插件那一格里没有 why-not-write', !跟踪.some(f => f.startsWith('data/plugins/why-not-write/')));
台.判('src 底下没有 _wnw', !跟踪.some(f => f.startsWith('src/_wnw/')));

台.题('三、忽略规则实测');
for(const q of ['data/plugins/notes/main.js', 'src/_wcustom/src/sh-code.js', 'src/pack/plugin/FlowDeskBridge.cs', 'src/_build/p1.js'])
  台.判(q + ' 该认（没被排掉）', !成(['check-ignore', '-q', '--', q]));
for(const q of ['data/plugins/off.json', 'data/plugins/why-not-write/main.js', 'data/plugins-factory/notes/main.js',
                 'src/_wnw/src/w1-core.js', 'src/_wcustom/wnw-custom-kernel.js', 'src/pack/plugin/dist/mb_FlowDesk.dll'])
  台.判(q + ' 该排掉', 成(['check-ignore', '-q', '--', q]));
const 露 = 问(['status', '--porcelain', '--untracked-files=all', '--', 'data/plugins']);
台.判('插件那一格没有第三种东西露在外面（现在 ' + (露 ? 行(露).length : 0) + ' 处）', 露 === '');

台.题('四、名单只有一份');
台.判('表里七家全登着', 家.length === 7);
台.判('带仓的只剩为写那一家', REPOS.length === 1 && REPOS[0].id === 'why-not-write');
const 货架 = fs.readdirSync(ROOT + 'data/plugins', { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
台.判('表上那七家与插件那一格盘上的七家一一对齐', JSON.stringify(货架) === JSON.stringify(家.map(j => j.id).sort()));
台.判('发布脚本 import 的是那一张表（不抄第二份）', /import \{ 家 as 家表/.test(rel) && !rel.includes("'Flow-Desk-plugin-"));
台.判('gate-pack46 第六节不再自带一份仓名表', !闸.includes("'notes': 'Flow-Desk-plugin-Notes'"));

台.题('五、号两种形状');
台.判('带仓那一家照旧逐字节比自己那棵', /function 会动吗\(job, dir\)/.test(rel) && /if\(job\.仓\)\{/.test(rel));
台.判('不带仓那六家拿主仓里动过自己那些份的那一笔', /function 主仓那一笔\(job\)/.test(rel) && rel.includes('.concat(job.from)'));
台.判('问那一笔时两种「只写号」的写法都跳过', rel.includes("'--grep=^记号 ', '--grep=发布记号'"));
台.判('不带仓那六家的号写回走主仓那一笔提交', /git\(TREE, \['commit', '-q', '-m', '记号 /.test(rel));
for(const id of 六){
  const 笔 = 问(['log', '-1', '--format=%h', '--invert-grep', '--grep=^记号 ', '--grep=发布记号', '--'].concat(家.find(x => x.id === id).from));
  const 在 = 问(['ls-tree', '--name-only', 笔 || 'HEAD', 'data/plugins/' + id + '/']);
  台.判(id + ' 问得出最后一笔（' + (笔 || '没问出') + '），那一笔里这一家的格还在',
    /^[0-9a-f]{7,}$/.test(笔) && 行(在).length >= 3);
}

台.题('六、那六家的历史是真接进来的');
for(const j of 家.filter(x => !x.仓)){
  const 一笔 = 问(['log', '-1', '--format=%H', '--grep=' + j.中文 + '那一家并回主仓']);
  if(!一笔){ 台.判(j.id + ' 找得到并回主仓那一笔', false); continue; }
  const 爹 = 问(['rev-list', '--parents', '-n', '1', 一笔]).split(/\s+/).slice(1);
  台.判(j.中文 + ' 的并入提交有两个爹（现在 ' + 爹.length + ' 个）', 爹.length >= 2);
  const 外树 = 问(['ls-tree', '--name-only', 爹[1], 'data/plugins/' + j.id]);
  台.判('第二个爹里就有这一家的格（' + 行(外树).length + ' 项）—— 带的是自己那一棵的过去', 行(外树).length > 0);
  const 主线 = 问(['rev-list', '--first-parent', 'HEAD']);
  台.判(j.中文 + ' 的第二个爹不在主线上（不是把主干重排一遍）', !行(主线).includes(爹[1]));
}
台.判('为写那一家没有并进来（盘上六棵克隆的历史一条都不在主仓里）', 问(['log', '--grep=为写那一家并回主仓']) === '');

台.收尾();
