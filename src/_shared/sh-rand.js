/* ============================================================
   零碎帮手 · 随机三个
   ----------
   从前这三个在 Flow-Desk 的 fd8-tools.js 和为写的 w1-core.js 各写了一遍，函数体逐字相同；
   而 _shared 里那几处用它们的（sh-gen）拼在 Flow-Desk 顶层，吃的只是 FD 那一份，
   为写闭包里的另一份只在它自己那十七段里生效 —— 改一处只生效一半。
   现在只这一份，谁都用它。没有依赖，排在装配单最前面。
   ============================================================ */
function randInt(min, max){ return min + Math.floor(Math.random() * (max - min + 1)); }
function pickOne(arr){ return arr && arr.length ? arr[randInt(0, arr.length - 1)] : ''; }
function shuffle(a){ for(let i = a.length - 1; i > 0; i--){ const j = randInt(0, i); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
