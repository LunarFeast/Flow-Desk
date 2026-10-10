/* 版本号唯一真身（同步 GitHub 第 2 条 · 2026-10-09 他认可 1.4.0-dev 之后立的这一格）
   ------------------------------------------------------------
   从前这串号散在四处各写各的：build.mjs 的产物文件名里钉死一份、为写内核那份答卷里一份
   （1.0.0-dev-1.1.9，他手改的那一段）、声笔练习那份装配里一份（1.0.0-dev-1.0.6）、
   出厂 package.json 里还有一份（1.0.0）。四处互相不认识，所以「现在运行的是哪一版」这个问题
   在代码里没有唯一答案 —— 要往 GitHub 分仓、打标签，先得以这一格为准。

   口径：
   · 前段（shell）= 程序版本，换档由人改 version.json 里那一行；-dev 尾巴表示还在开发中。
   · 后段（content）= 生成流水号，每生成一次页面自己加一，人不手改。
   · 整串 = 前段 + '.' + 后段，例：1.4.0-dev.13。
   · 只有生成那一趟（build.mjs）往这一格写；其余各处要么在同一趟里被写进页面，
     要么照旧从 pages\ 的产物文件名倒着取（build-update / publish / 程序壳 / fd-serve 都是这条），
     所以产物文件名就是版本号的唯一载体，出包出去的包名、更新标记都和页面上的号同源。 */
import fs from 'node:fs';
import path from 'node:path';

const HERE = import.meta.dirname;
const FILE = path.join(HERE, 'version.json');

function 账(){
  let j;
  try{ j = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch(e){ throw new Error('版本号这一格读不到（' + FILE + '）：' + (e && e.message || e)); }
  if(!j || typeof j.shell !== 'string' || !/^\d/.test(j.shell))
    throw new Error('版本号这一格里 shell 不是一串版本号（写成 "1.4.0-dev" 这种）：' + FILE);
  return j;
}
function 串(shell, n){ return shell + '.' + n; }

/* 已经在盘上的那一版（页面上显示、别处倒查都用这一支） */
export function 号(){ const j = 账(); return 串(j.shell, (+j.content || 0)); }
/* 这一趟生成该用的那一版：还没落账，所以是现号 +1 */
export function 下一号(){ const j = 账(); return 串(j.shell, (+j.content || 0) + 1); }
/* 生成成功后落账：把用掉的这一支号记回去。失败的那一趟不记，下一趟接着用同一个号。 */
export function 落账(用了){
  if(!/^\d+(\.\d+)*$/.test(String(用了).split('.').pop()))
    throw new Error('落账要的是整串号（' + 号() + ' 这种形状），给的是：' + 用了);
  const j = 账();
  const n = +String(用了).split('.').pop();
  fs.writeFileSync(FILE, JSON.stringify({ shell:j.shell, content:n }, null, 2) + '\n');
  return 串(j.shell, n);
}
/* 产物页的名字：整条链只认这一个前缀 + 这一串号 */
export function 页名(用了){ return 'Flow_Desk_' + (用了 || 号()) + '.html'; }
