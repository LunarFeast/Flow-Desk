/* 外27「检查」这一件的自检：audit.mjs 新加的第八节真能抓住第 16 条那一类吗
   —— 不许凭「看着像能」交差。做法：把 audit.mjs 里第八节那一段真实代码原样切出来，
   喂给它一个临时目录，目录里摆几种情形：
     A 一处一块逐字相同、只有选择器不同（第 16 条本尊的样子）        → 该报
     B 四处各写一遍（共用层三处 + 插件一个）                        → 该报「4 处」
     C 短的一行声明在三处各写一遍（省略号那一类惯用写法）            → 不该报（门槛挡掉）
     D 带 ${} 生成的那一串                                            → 整串跳过
     E 两条规则之间夹一段注释                                          → 行号指选择器那一行
   临时目录建在本会话的临时工作区，不碰他的树。 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const AUDIT = fs.readFileSync('D:/Programs/Flow-Desk/src/tools/audit.mjs', 'utf8');
/* 咬位置靠「第八节那一个 ALSO_OK_DUPES」，不咬注释的措辞：
   从前拿一整行带注释的原文当锚点，注释里改了两个字（「现在空」→ 添了三个名单）这台就当场死掉。 */
const HEAD = "head('八、";
const h0 = AUDIT.indexOf(HEAD);
if(h0 < 0) throw new Error('第八节在 audit.mjs 里找不着，切不出来');
const i0 = AUDIT.indexOf('const ALSO_OK_DUPES', h0);
if(i0 < 0) throw new Error('第八节里那个 ALSO_OK_DUPES 找不着 —— 它改名或挪了，这台跟着改');
const i1 = AUDIT.indexOf('\n  if(!n) say(', i0);
if(i1 < 0) throw new Error('本节收尾找不着');
const end = AUDIT.indexOf('\n}\n', i1);
const code = AUDIT.slice(i0, end);
if(code.length < 500) throw new Error('切出来的范围不对，长度 ' + code.length);

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-css-'));
const mk = (rel, text) => { const p = path.join(TMP, rel); fs.mkdirSync(path.dirname(p), { recursive:true }); fs.writeFileSync(p, text, 'utf8'); };
const 衬底 = "content:'';position:absolute;left:-100vw;right:-100vw;bottom:0;z-index:-1;"
  + 'top:calc(-1 * var(--gap-blk,14px) - 6px);background:var(--card-bg,#fff);pointer-events:none';
const 长块 = 'flex:0 0 auto;display:block;white-space:nowrap;align-items:center;'
  + 'justify-content:center;border-radius:3px;padding:0 6px;font-size:.86em;line-height:1.6';

mk('src/_wnw/src/w18-lyric.js', 'addCss(`\n.wnw-lbar::before{' + 衬底 + ';}\n`);\n');
mk('src/_wnw/src/w19-cruise.js', 'addCss(`\n.wnw-czbar::before{' + 衬底 + ';}\n`);\n');
mk('src/_shared/sh-style.js', 'addCss(`\n'
  + '.sh-a b{' + 长块 + '}\n'
  + '.sh-c d{' + 长块 + '}\n'
  + '.sh-e f{' + 长块 + '}\n`);\n');
mk('src/_fd/src/fd3-shell.js', 'addCss(`\n'
  + '.fd-a .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n'
  + '.fd-b .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n'
  + '.fd-c .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n`);\n');
mk('data/plugins/music-remote/main.js', 'K.style(`\n.mu-x y{' + 长块 + '}\n`);\n');
mk('src/_shared/sh-font.js', 'addCss(`${Array.from({length:3},(x,i) => ".hl-" + i + "{color:red}").join("")}\n'
  + '.sh-g z{' + 长块 + ';letter-spacing:.02em;text-transform:none}\n`);\n');
/* E 两条规则之间夹一段注释：报的行号要指到选择器那一行，不许指到注释头上 */
mk('src/_shared/sh-doc.js', 'addCss(`\n.sh-e1 q{' + 长块 + ';margin:0}\n'
  + '/* 这一档是给整页定行距的，\n   换主题不重算 */\n'
  + '.sh-e2 q{' + 长块 + ';margin:0}\n`);\n');

const lines = [], bads = [];
const fn = new Function('fs', 'path', 'exists', 'say', 'bad', 'ROOT', 'SRC_DATA', code);
fn(fs, path, p => { try{ fs.statSync(p); return true; }catch(e){ return false; } },
  s => lines.push(s), s => bads.push(s), TMP, path.join(TMP, 'data'));

const out = [];
const ok = (n, p, note) => out.push({ n, p, note:note || '' });
const 衬底报 = bads.filter(b => /wnw-lbar/.test(b)).join(' ｜ ');
const 长块报 = bads.filter(b => /sh-a b/.test(b)).join(' ｜ ');
const 省略号报 = bads.filter(b => /fd-a \.nm/.test(b)).join(' ｜ ');
const 带生成的报 = bads.filter(b => /sh-g z/.test(b)).join(' ｜ ');

ok('A · 第 16 条那一类（两处、只有选择器不同）报出来',
  /wnw-czbar::before/.test(衬底报) && /2 处/.test(衬底报) && /声明逐字相同/.test(衬底报), 衬底报 || '没报');
ok('B · 四处各写一遍的报「4 处」，插件里那个也一起数进来',
  /4 处/.test(长块报) && /mu-x y/.test(长块报), 长块报 || '没报');
ok('C · 短声明那一惯用写法没报（门槛挡掉）', !省略号报, 省略号报 || '确实没报');
ok('D · 带 ${} 生成的那一整串跳过，没被比成双份',
  !带生成的报 && !/sh-g z/.test(长块报), 带生成的报 || '确实没报');
ok('落点报的是「文件:行号」这一形，行号指的是那一行不是反引号那一行',
  /src\/_wnw\/src\/w18-lyric\.js:2/.test(衬底报), 衬底报.slice(0, 200));
ok('收尾那一行照样说「改到其中一份才显形」',
  lines.some(l => /改到其中一份才显形/.test(l)));

const 夹注释报 = bads.filter(b => /sh-e1 q/.test(b)).join(' ｜ ');
ok('E · 两条规则夹一段注释时，行号指到选择器那一行',
  /sh-doc\.js:2、src\/_shared\/sh-doc\.js:5/.test(夹注释报), 夹注释报 || '没报');

let pass = 0;
for(const r of out){ console.log((r.p ? 'PASS ' : 'FAIL ') + r.n + (r.note ? '  ｜ ' + r.note : '')); if(r.p) pass++; }
console.log('—— ' + pass + ' / ' + out.length + ' 条过');
fs.rmSync(TMP, { recursive:true, force:true });
process.exit(pass === out.length ? 0 : 1);
