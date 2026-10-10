/* ============================================================
   gate-stamp45.mjs · 外45：打包时把真实的号写回每家插件自己的清单文件
   ------------------------------------------------------------
     node src/tools/probes/gate-stamp45.mjs
   钉的是这么几件事：
     一、--dry 那道闸（上一轮就是漏了它，空跑把七份清单写了、七棵仓各提交一笔）；
     二、三种情况各走各自的：真改过代码的补新号 / 还挂着占位死号的补真号 / 号已经是真的一字不碰；
     三、号只有一处真身：清单文件（传进打包的那一串、界面上「关于」读的那一份，都是它）；
     四、tag 钉在代码那一笔上，不钉在「把号写进清单」那一笔上；
     五、盘上那七份清单现在都带 +build. 尾巴，没有一家还是当初那个占位死号。
   ============================================================ */
import fs from 'node:fs';
import { rd, 记账, 切, ROOT } from './lib-slice.mjs';

const 台 = 记账('gate-stamp45');
const rel = rd('src/_build/release.mjs');
const pub = rd('src/pack/publish.mjs');
const ui = rd('src/_fd/src/fd4-builtin.js');
const 写号 = 切(rel, '号写回清单');

台.题('一、--dry 那道闸');
台.判('号写回清单里判了 DRY', 写号.includes('DRY'));
台.判('判 DRY 那一句排在写文件之前', 写号.indexOf('if(DRY)') > 0 && 写号.indexOf('if(DRY)') < 写号.indexOf('fs.writeFileSync'));
台.判('判 DRY 那一句直接 return（不是打个招呼往下走）', /if\(DRY\)[^\n]*return;/.test(写号));
台.判('发布脚本这一整颗在 --dry 下提前退出，走不到打包', rel.includes("process.exit(0)") && rel.includes('--dry：什么都没写'));

台.题('二、三种情况各走各自的');
台.判('真改过代码的那家走新号那一路', 写号.includes('r.动了'));
台.判('认占位死号认的是串上没有 +build. 那一截', 写号.includes('+build'));
台.判('号已经是真的、代码又没动 -> 一个字不碰', 写号.includes('号 === 老) return'));
台.判('写回的时候照原样两空格缩进（不顺手改排版）', 写号.includes('JSON.stringify(m, null, 2)'));

台.题('三、号只有一处真身：清单');
台.判('先写回清单，再拼 FD_PLUGINS（传进打包的就是清单里那一串）', rel.indexOf('号写回清单(r)') < rel.indexOf('FD_PLUGINS:'));
台.判('publish 认传进来的那一家自己的号', pub.includes('递来的家[m.id].version'));
台.判('界面上「关于」那句改口成「清单里没写号」', ui.includes('清单里没写号'));
台.判('界面那份和发布脚本里都不再出现「说明书」这三个字', !ui.includes('说明书') && !rel.includes('说明书'));

台.题('四、tag 钉在代码那一笔');
台.判('打tag 多收一枚「钉在哪一笔」', rel.includes('function 打tag(dir, name, 谁, 钉在)'));
台.判('插件那一棵把代码那一笔递进去', rel.includes("'v' + r.号, r.repo, r.sha"));
台.判('记号那一笔走铺那台、只点这一棵', 写号.includes("'--only=' + r.id") && 写号.includes('发布记号'));

台.题('五、盘上那七份清单现在都带真号');
for(const id of ['notes', 'schedule', 'your-sentences', 'music-remote', 'singbit-input-practice', 'why-not-write', 'wnw-custom']){
  let v = '';
  try{ v = String(JSON.parse(fs.readFileSync(ROOT + 'data/plugins/' + id + '/manifest.json', 'utf8')).version || ''); }catch(e){ v = '（读不到）'; }
  台.判(id + ' 那一格带 +build. 尾巴（现在：' + v + '）', /\+build\.[0-9a-f]{7}$/.test(v));
}

台.收尾();
