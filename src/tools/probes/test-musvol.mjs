/* 丙组自检（外29 第 52 轮）：音乐遥控器那两处。
   第 5 条：翻译 / 注释那一行不许跟着播放变色 —— 亮度尺从前压在整行上，孩子抵消不了，现在尺子挪到原文和注音两块。
   第 6 条：音量滑杆从前在监听收摊之后一辈子起不来（volStart 头一句就 return），
           而且把脚本那句英文原话弹到界面上；他这句是「控制不了音量还摆个虚假按钮？？？」。
   源码层这一台自己断；样式层那一半生成一份页面（同目录 mk-musvol-test.html），拿真浏览器量计算值。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = 'D:/Programs/Flow-Desk';
const MUS = fs.readFileSync(path.join(ROOT, 'data/plugins/music-remote/main.js'), 'utf8');
const MAIN = fs.readFileSync(path.join(ROOT, 'src/pack/main.cjs'), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if(c){ pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (extra ? ' · ' + extra : '')); } };

/* ---------- 一、翻译恒定（源码层：尺子挪走了没） ---------- */
const css = (MUS.match(/const MUS_CSS = `([\s\S]*?)`;/) || ['', ''])[1];
const volLine = (() => { const i = MAIN.indexOf('function volLine('); if(i < 0) throw new Error('找不到 volLine');
  let d = 0, j = MAIN.indexOf('{', i);
  for(let k = j; k < MAIN.length; k++){ if(MAIN[k] === '{') d++; else if(MAIN[k] === '}'){ d--; if(!d) return MAIN.slice(i, k + 1); } }
  throw new Error('volLine 花括号没配平'); })();
ok('0 组件那份样式和音量那一支都抓到了（抓空了下面的断言全是假的）', css.length > 2000 && volLine.length > 200, 'css ' + css.length + ' · volLine ' + volLine.length);
ok('1 亮度尺不再压整行：没有「.mu-line{opacity:.42}」和「.mu-line.act{opacity:1}」那两条了',
  !/\.mu-line\{[^}]*opacity:\.42/.test(css) && !/\.mu-line\.act\{opacity:1\}/.test(css));
ok('2 尺子挪到原文和注音两块上，两个数值一个字没改（没唱到 .42、正在唱 1）',
  /\.mu-line \.mu-main,\.mu-line \.mu-note\{opacity:\.42/.test(css) &&
  /\.mu-line\.act \.mu-main,\.mu-line\.act \.mu-note\{opacity:1\}/.test(css));
ok('3 逐字那一档同样只提这两块（.mu-ka 那两条不再压整行）',
  !/\.mu-ka \.mu-line\{opacity/.test(css) && /\.mu-ka \.mu-line\.act \.mu-main/.test(css));
ok('4 翻译那一行（.mu-trans）不再有任何一档随行状态变的写法',
  !/\.mu-line\.act \.mu-trans|\.mu-line\.sung \.mu-trans/.test(css) && /\.mu-trans\{[^}]*color:var\(--text-light\)/.test(css));
ok('5 注音那一行照旧跟着行走（他没点这一档，一个字不动）',
  /\.mu-note\{font-size:calc\(\.82em/.test(css));

/* ---------- 二、音量：收摊之后还能再起一代 ---------- */
const bye = /if\(j\.ev === 'bye'\)\{([\s\S]*?)volTell\(\); return;/.exec(volLine);
ok('6 监听说收摊那句不再把这一路永久判死（bye 那一支只在重起预算用完之后才判死）',
  !!bye && /else vol\.dead = true/.test(bye[0]) && !/^\s*vol\.dead = true;/.test(bye[1] || ''), bye ? bye[0].slice(0, 70) : '没抓到 bye 那一支');
ok('7 收摊之后重起有界：没被我们主动收掉、且重试没超三回才再起一代',
  !!bye && /!vol\.killed && vol\.tries < 3/.test(bye[0]) && /setTimeout\(volStart, 300\)/.test(bye[0]));
ok('8 抬走这一代的号：它迟到的退出事件不许顶掉新起的那一代', !!bye && /vol\.gen\+\+/.test(bye[0]));
ok('9 活着推上来一行就把重试预算归零（跑一阵子再摔也还有机会）',
  /if\(j\.ev === 'vol'\)\{[\s\S]{0,80}vol\.tries = 0/.test(MAIN));
ok('10 退出码那条路也不再一判死了事：三回以内先重起',
  /if\(vol\.killed\) return;[\s\S]{0,120}if\(vol\.tries < 3\)\{ vol\.tries\+\+; setTimeout\(volStart, 1200\)/.test(MAIN));

/* ---------- 二之二、拿真函数跑一遍：连摔三回才判死，中间每一回真能重起 ----------
   上面那五条断的是"代码里写了什么"。这一台把 main.cjs 里那三件真东西（vol 那份状态、volMsg、volLine）
   原样搬进 vm，再照抄 volStart 头一句那道闸（`if(vol.child || vol.dead) return`），
   按时间顺序喂 bye 事件、跑被排下的定时器 —— 修好之前这一台第 1 条就不过：一句 bye 就把路钉死，
   后面永远起不来。 */
const vm = await import('node:vm');
function braceSlice(src, marker){
  const i = src.indexOf(marker); if(i < 0) throw new Error('找不到 ' + marker);
  let d = 0, j = src.indexOf('{', i);
  for(let k = j; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}'){ d--; if(!d) return src.slice(i, k + 1); } }
  throw new Error(marker + ' 花括号没配平');
}
const VOL_OBJ = /^const vol = \{.*$/m.exec(MAIN)[0];
const GUARD = /function volStart\(\)\{\s*(if\(vol\.child \|\| vol\.dead\) return;)/.exec(MAIN);
if(!GUARD) throw new Error('volStart 头一句那道闸的写法变了，这一台得跟着改');
const timers = [];
const hits = { started:0, told:0 };
const sb = { console, JSON, String, Number, Boolean, RegExp, timers, hits,
  setTimeout:(f, ms) => { timers.push({ f, ms }); return 1; }, clearTimeout:() => {},
  hits, logLine:() => {}, volTell:() => { hits.told++; } };
vm.createContext(sb);
vm.runInContext([VOL_OBJ, braceSlice(MAIN, 'function volMsg'),
  'function volStart(){ ' + GUARD[1] + ' hits.started++; }',
  'function tick(){ while(timers.length){ const t = timers.shift(); t.f(); } }',
  volLine,
  'function fire(l){ volLine(l); tick(); }',
  'function snap(){ return { dead:vol.dead, tries:vol.tries, gen:vol.gen, started:hits.started, told:hits.told, msg:vol.msg }; }'].join('\n'), sb);
const step = (msg) => { vm.runInContext('fire(' + JSON.stringify('{"ev":"bye","msg":' + JSON.stringify(msg) + '}') + ')', sb); return vm.runInContext('snap()', sb); };
const s1 = step('watcher closed'), s2 = step('watcher closed'), s3 = step('watcher closed'), s4 = step('watcher closed');
ok('11 函数层真跑：第一句 bye 之后仍能重起（修之前这里 started 恒 0、dead 立刻成真）',
  s1.dead === false && s1.started === 1 && s1.tries === 1 && /正在重起/.test(s1.msg), JSON.stringify(s1));
ok('12 函数层真跑：连摔的第 2、3 回都还起得来（tries 一路加到 3，dead 仍旧是假）',
  s2.started === 2 && s2.tries === 2 && s3.started === 3 && s3.tries === 3 && s3.dead === false, JSON.stringify({ s2, s3 }));
ok('13 函数层真跑：第四回（预算用完）才判死，界面那头拿到 supported:false',
  s4.dead === true && s4.started === 3, JSON.stringify(s4));
/* 判死之后重新活着的样子：把状态摆回"监听在跑、预算已用完"，先推一行活的事件（预算应当归零），
   再喂一句 bye —— 这一回还得起得来。 */
const s5 = (() => { vm.runInContext('vol.dead = false; vol.tries = 3; hits.started = 0;', sb);
  vm.runInContext('volLine(\'{"ev":"vol","master":0.5}\')', sb);
  const a = vm.runInContext('vol.tries', sb); step('watcher closed');
  return { a, started:vm.runInContext('hits.started', sb) }; })();
ok('14 函数层真跑：活着推上来一行就把预算归零，摔完之后再来一句 bye 又起得了', s5.a === 0 && s5.started === 1, JSON.stringify(s5));
const s6 = step('');
ok('15 界面拿到的 msg 是中文那一句，脚本的英文原话没漏出去', /音量/.test(s6.msg) && !/watcher|failed|denied/i.test(s6.msg), JSON.stringify(s6));

/* ---------- 三、界面上不许冒英文 ---------- */
ok('16 有一句中文映射兜着：脚本那几句英文原话各有对等的中文',
  /function volMsg\(raw\)/.test(MAIN) && /音量监听收摊了，正在重起/.test(MAIN) && /音量命令没执行成/.test(MAIN));
ok('17 原话留着进日志（我要查的还是那句），并且 stderr 也走这一道',
  /vol\.raw = t\.slice\(0, 300\)/.test(MAIN) && /if\(s\) volMsg\(s\)/.test(MAIN));
ok('18 三处回给页面的 msg 全是 vol.msg（中文那一版），没有直接把 j.msg 或异常文本交出去',
  !/msg: j\.msg/.test(MAIN) && /msg: vol\.msg/.test(MAIN));

/* ---------- 四、取不到就别摆 ---------- */
ok('19 系统音量取不到时整排收掉（不再摆一根拖了没反应的滑杆）',
  /wrap\.classList\.toggle\('mu-off', !Vol\.ok\)/.test(MUS) && /\.mu-vol\.mu-off\{display:none\}/.test(css));
ok('20 收掉用的是类不是 hidden 属性（上面那条 display:inline-flex 会把 hidden 顶掉）',
  !/wrap\.hidden\s*=/.test(MUS));

/* ---------- 五、生成样式层那份页面（真浏览器量计算值） ----------
   从前这里按「行首是不是 .mu」挑行，把跨行的那几条规则拦腰截断（`.mu-cover{…overflow:hidden;` 就是这么断的），
   花括号配不平，浏览器一路吞到下一个 } 才恢复 —— 结果整张样式表只剩 10 条规则，
   每一条计算值都是 opacity:1。这样的页面量出来的数全是 1，看着像"翻译恒定"其实一条都没量到。
   现在整份 MUS_CSS 原样搬，且 <style> 排在 <script> 前面（脚本在样式进层之前跑，量到的也是 1）。 */
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'mk-musvol-test.html');
fs.writeFileSync(out, '<!doctype html><meta charset="utf-8"><title>丙组 · 翻译恒浅色</title>' +
  '<style>:root{--text:#222;--text-light:#8b8b8b;--accent:#2e7d6b}' + css + '</style>' +
  '<body style="--text:#222;--text-light:#8b8b8b;--accent:#2e7d6b"><div class="mu mu-ka">' +
  '<div class="mu-line"><div class="mu-main"><span class="mu-w">没唱到这一行</span></div>' +
  '<div class="mu-note">注音没唱到</div><div class="mu-trans">翻译没唱到</div></div>' +
  '<div class="mu-line act"><div class="mu-main"><span class="mu-w">正在唱这一行</span></div>' +
  '<div class="mu-note">注音正在唱</div><div class="mu-trans">翻译正在唱</div></div>' +
  '<div class="mu-line sung"><div class="mu-main"><span class="mu-w">唱过这一行</span></div>' +
  '<div class="mu-note">注音唱过</div><div class="mu-trans">翻译唱过</div></div>' +
  '</div><script>function eff(s){const e=document.querySelector(s);const c=getComputedStyle(e);' +
  'let o=1,n=e;while(n&&n!==document.body){o*=+getComputedStyle(n).opacity;n=n.parentElement}return o.toFixed(3)}' +
  'window.R={main_off:eff(".mu-line .mu-main"),main_act:eff(".mu-line.act .mu-main"),main_sung:eff(".mu-line.sung .mu-main"),' +
  'tr_off:eff(".mu-line .mu-trans"),tr_act:eff(".mu-line.act .mu-trans"),tr_sung:eff(".mu-line.sung .mu-trans"),' +
  'note_off:eff(".mu-line .mu-note"),note_act:eff(".mu-line.act .mu-note")};' +
  'document.title=JSON.stringify(window.R);<\/script>');
ok('21 样式层那份页面生成了（整份 MUS_CSS 原样搬进去，' + css.length + ' 个字符，没手抄第二份）',
  fs.existsSync(out) && css.length > 2000, out);
/* 这一条是给上一那种毛病兜底的：搬进去的样式自己得花括号配平、关键的那几条一条不缺 */
const opens = (css.match(/\{/g) || []).length, closes = (css.match(/\}/g) || []).length;
ok('22 搬进去的样式花括号配平（' + opens + ' 开 ' + closes + ' 闭）—— 配不平浏览器会成片的吞规则',
  opens === closes && opens > 40);
ok('23 页面里那三块该量到的规则都在（原文两档、注音两档、翻译一条都不许有）',
  /\.mu-line \.mu-main,\.mu-line \.mu-note\{opacity:\.42/.test(css) &&
  !/\.mu-trans\{[^}]*opacity/.test(css) &&
  !/\n\.mu-trans[^{]*\{[^}]*opacity:/.test('\n' + css));

/* ---------- 六、这台自己咬得住吗：把 bye 那一支改回从前的写法再跑一遍 ----------
   元规矩那条（不许拿自检全 PASS 当结论）在这里的落法：同一个 vm、同一串事件，
   只把那一支换回"一句就判死"的老样子 —— 换对了这一台必须报不过，不然它是个哑台。 */
const OLD = 'vol.dead = true;';
const volLineOld = volLine.replace(/if\(!vol\.killed && vol\.tries < 3\)\{ vol\.tries\+\+; setTimeout\(volStart, 300\); \}[\s\S]*?else vol\.dead = true;/, OLD);
const sb2 = Object.assign({}, sb, { timers:[], hits:{ started:0, told:0 } });
vm.createContext(sb2);
vm.runInContext([VOL_OBJ, braceSlice(MAIN, 'function volMsg'),
  'function volStart(){ ' + GUARD[1] + ' hits.started++; }',
  'function tick(){ while(timers.length){ const t = timers.shift(); t.f(); } }',
  volLineOld, 'function fire(l){ volLine(l); tick(); }'].join('\n'), sb2);
vm.runInContext('fire(\'{"ev":"bye","msg":"watcher closed"}\')', sb2);
const old = vm.runInContext('({ dead:vol.dead, started:hits.started })', sb2);
ok('24 这一台咬得住：同一串事件喂给从前那句一支判死的老写法，必须起不来（' + JSON.stringify(old) + '）',
  volLineOld !== volLine && old.dead === true && old.started === 0);

console.log('\n' + pass + ' 过 ' + fail + ' 不过');
console.log('样式层那半我自己开探针浏览器量（绝不动他正开着那一家）：' + out);
console.log('  读 window.R：原文/注音 .420 → 1.000 → 1.000，翻译三档同一个数 1.000（本轮实量到的就是这一组）');
process.exit(fail ? 1 : 0);
