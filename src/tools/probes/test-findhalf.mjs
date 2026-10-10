/* 书内查找那一半真的在不在（外29 第 45 轮）：
   2026-10-07 现场报的是「查找和替换，现在这是只有替换没有查找」—— 一查 git 全历史，
   findBookDlg 从初始提交起就只有三个替换按钮 + 打字时后台扫一遍，查找这一半个按钮都没有。
   这台断的是「标题承诺的动作，界面上得有对应控件」这一类，外加新加的「找下一处」真按顺序跳。
   跳那一步跑的是真源码（从 w8-write.js 里抠出 nextHit 进沙箱），不抄第二份。 */
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = fs.readFileSync('D:/Programs/Flow-Desk/src/_wnw/src/w8-write.js', 'utf8');
const i0 = SRC.indexOf('async findBookDlg()');
const body = (() => {
  let d = 0, j = SRC.indexOf('{', i0);
  for(let k = j; k < SRC.length; k++){
    if(SRC[k] === '{') d++;
    else if(SRC[k] === '}'){ d--; if(!d) return SRC.slice(i0, k + 1); }
  }
  throw new Error('findBookDlg 花括号没配平');
})();

let pass = 0, fail = 0;
const ok = (n, c, extra) => { if(c){ pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (extra ? ' · ' + extra : '')); } };

/* ---------- 一、标题里那两件事，界面上都得有对应的控件 ---------- */
const title = /Overlay\.open\('([^']*)'/.exec(body);
const promised = title ? title[1].split(' · ').map(x => x.replace(/^书内/, '')) : [];
ok('0 抓到了 findBookDlg 那一屏（' + (title ? title[1] : '没抓到标题') + ' → 要落地的两件事：' + promised.join('、') + '）',
  !!title && promised.length === 2);
for(const word of promised){
  /* 标题写了什么动词，就该有一个面上的按钮或输入框带着这个词（光在输入框 placeholder 里出现不算控件） */
  const re = new RegExp("[,({]\\s*'[^']*" + word + "[^']*'\\s*[,)}]");
  ok('1 标题承诺的「' + word + '」在界面上落成了按钮', re.test(body), '没在函数体里找到写着这个词的按钮');
}
ok('2 查找那一半有两个按钮：一个明写「查找」，一个「找下一处」',
  /onclick:\(\) => scan\(\) \}, '查找'\)/.test(body) && /'找下一处'/.test(body));
ok('3 替换那一半没被改坏：三个还在（替换正文 / 替换章纲 / 全部替换）',
  /'替换正文'/.test(body) && /'替换章纲'/.test(body) && /'全部替换'/.test(body));

/* ---------- 二、回车：找框扫一遍，换框才动替换 ---------- */
const lineOf = sub => body.split('\n').findIndex(l => l.includes(sub)) + 1;
ok('4 找框回车 = 扫一遍（从前那里一个监听都没有，非等打完字不可）',
  /qi\.addEventListener\('keydown'[^\n]*Enter'\) scan\(\)/.test(body.replace(/\n\s*/g, ' ')), '第 ' + lineOf("qi.addEventListener('keydown'") + ' 行');
ok('5 换框回车照旧是替换，没被这一改带走',
  /ri\.addEventListener\('keydown'[\s\S]{0,220}?go\(/.test(body));
ok('6 两个框都挡了输入法正在拼的那一下（isComposing）',
  (body.match(/isComposing/g) || []).length >= 2);

/* ---------- 三、换一批命中，跳的序号要归零；声明不能在调用后面（TDZ 当场崩） ---------- */
const nCur = (body.match(/cur = -1/g) || []).length;
ok('7 重新扫一遍之后「第几处」归零（scan 里那一笔 + 声明那一笔，共 ' + nCur + ' 处）', nCur >= 2);
const 声明行 = lineOf('let cur = -1'), 首扫行 = (() => {
  const m = [...body.matchAll(/^\s*scan\(\);$/gm)].map(x => body.slice(0, x.index).split('\n').length);
  return m.length ? m[m.length - 1] : 0;
})();
ok('8 let cur 的声明在第一趟 scan() 之前（不然第一次扫就在暂时性死区里崩，整屏打不开）',
  声明行 > 0 && 首扫行 > 声明行, '声明第 ' + 声明行 + ' 行 / 第一趟扫第 ' + 首扫行 + ' 行');

/* ---------- 四、真跑 nextHit：一段一段跳，跳完回到第一段 ---------- */
const nh = (() => {
  const i = body.indexOf('const nextHit = () => {');
  let d = 0, j = body.indexOf('{', i);
  for(let k = j; k < body.length; k++){
    if(body[k] === '{') d++;
    else if(body[k] === '}'){ d--; if(!d) return body.slice(i + 'const nextHit = '.length, k + 1); }
  }
  throw new Error('nextHit 花括号没配平');
})();
const hits = [
  { chTitle:'第一卷', kind:'正文', i:2, n:3 },
  { chTitle:'第二卷', kind:'章纲', i:0, n:1 },
  { chTitle:'第三卷', kind:'正文', i:7, n:2 }
];
const sb = { console };
vm.createContext(sb);
/* 原文那个箭头函数一个字节不改地塞进来，外面只补它要的四样：hits / cur / cnt / this.openHit */
vm.runInContext([
  'globalThis.S = { hits:' + JSON.stringify(hits) + ', cur:-1, cnt:{textContent:""}, opened:[] };',
  'const hits = S.hits, cnt = S.cnt;',
  'let cur = -1;',
  'const this2 = { openHit:it => S.opened.push(it) };',
  'const nextHit = ' + nh.replace(/this\.openHit\(it\)/g, 'this2.openHit(it)') + ';',
  'globalThis.step = () => { S.opened = []; nextHit(); S.cur = cur; };'
].join('\n'), sb);
const run = () => { sb.step(); return { at:sb.S.cur, 报:sb.S.cnt.textContent, 跳:sb.S.opened.length }; };
const r1 = run(), r2 = run(), r3 = run(), r4 = run();
ok('9 连点四趟「找下一处」跳的是 第一→第二→第三→回第一段',
  r1.at === 0 && r2.at === 1 && r3.at === 2 && r4.at === 0, [r1.at, r2.at, r3.at, r4.at].join(','));
ok('10 每一趟都在计数那一行写清了跳到第几段、哪一章、哪一档、第几段、几处',
  /现在跳到第 1 段（第一卷 · 正文 · 第 3 段 · 3 处）/.test(r1.报) && /现在跳到第 3 段（第三卷 · 正文 · 第 8 段 · 2 处）/.test(r3.报), r1.报);
ok('11 一次跳一段，没顺手把编辑区改脏（只喊 openHit 那一手）',
  r1.跳 === 1 && r2.跳 === 1);

/* 没命中的时候不许抛 */
sb.S.hits.length = 0;
let threw = '';
try{ run(); }catch(e){ threw = String((e && e.message) || e); }
ok('12 空的命中表上点「找下一处」不抛，只在那一行说清楚为什么没跳',
  !threw && /先写要找的字|没有这几个字/.test(sb.S.cnt.textContent), threw || sb.S.cnt.textContent);

console.log('\n' + pass + ' 过 ' + fail + ' 不过');
process.exit(fail ? 1 : 0);
